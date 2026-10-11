-- A ficha anestésica encerrada entra sozinha na Produção.
--
-- Quem anestesiou já disse tudo na ficha: paciente, convênio, cirurgia, data
-- e horários. Anotar de novo na Produção, no fim do plantão, era digitar a
-- mesma coisa duas vezes — e o que se digita duas vezes uma hora falta.
--
-- QUANDO: ao encerrar. Ficha aberta pode ser de uma cirurgia que nem
-- aconteceu; encerrada é anestesia feita.
--
-- PARA QUEM: o anestesiologista responsável da ficha, se tem conta nesta
-- organização. A Produção é pessoal (o RLS dela não abre exceção para
-- ninguém): a linha nasce na lista DELE, mesmo que outra pessoa da equipe
-- tenha encerrado. Responsável sem conta (colega de fora) não tem Produção
-- aqui, e a ficha encerra do mesmo jeito.
--
-- UMA VEZ SÓ: a linha guarda de que ficha veio (evolucao_id, único).
-- Reabrir e encerrar de novo não cria outra nem sobrescreve o que o médico
-- já mexeu (valor, convênio, situação). Se ele já tinha anotado à mão o
-- mesmo paciente no mesmo dia, a ficha se liga a essa anotação em vez de
-- duplicar.
--
-- O QUE VAI: data do procedimento, paciente, convênio, cirurgia, o hospital
-- (o da avaliação; senão o dos plantões dele no dia, quando são todos do
-- mesmo) e o plantão (quando o dia tem um só) — a mesma regra da tela de
-- Produção. Nas observações, o horário da anestesia pelos eventos da ficha.
-- Valor fica em zero, como na anotação à mão: entra na hora de faturar.
--
-- Se algo der errado aqui, a ficha encerra assim mesmo: a Produção é
-- conveniência, o encerramento é o documento.

alter table public.producao_do_dia
  add column if not exists evolucao_id uuid references public.evolucoes_anestesicas(id) on delete set null;
create unique index if not exists producao_uma_por_ficha
  on public.producao_do_dia (evolucao_id) where evolucao_id is not null;

create or replace function public.producao_da_ficha(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.evolucoes_anestesicas%rowtype;
  v_id uuid;
  v_perfil uuid;
  v_texto_perfil text;
  v_paciente text;
  v_convenio_cadastro text;
  v_convenio text;
  v_procedimento text;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_data date;
  v_local uuid;
  v_local_plantao uuid;
  v_plantao uuid;
  v_minutos integer;
  v_obs text;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id;
  if not found then return null; end if;

  -- Já foi para a Produção numa encerrada anterior: não duplica nem mexe.
  select id into v_id from public.producao_do_dia where evolucao_id = p_id;
  if found then return v_id; end if;

  -- O responsável, e só se é alguém desta organização com conta ativa.
  select e->>'perfil_id' into v_texto_perfil
    from jsonb_array_elements(case when jsonb_typeof(f.dados->'equipe') = 'array'
                                   then f.dados->'equipe' else '[]'::jsonb end) e
   where e->>'funcao' = 'responsavel'
     and coalesce(e->>'perfil_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   limit 1;
  v_perfil := v_texto_perfil::uuid;
  if v_perfil is null or not exists (
    select 1 from public.perfis p
     where p.id = v_perfil and p.institution_id = f.institution_id and p.status = 'ativo'
  ) then
    return null;
  end if;

  select p.nome, p.convenio into v_paciente, v_convenio_cadastro
    from public.pacientes p where p.id = f.patient_id;
  if coalesce(btrim(v_paciente), '') = '' then return null; end if;

  -- Os horários da anestesia, pelos eventos que valem (os corrigidos e os
  -- excluídos ficam de fora — a mesma leitura da tela e da impressão).
  select min(r.momento) filter (where r.dados->>'codigo' = 'inicio_anestesia'),
         max(r.momento) filter (where r.dados->>'codigo' = 'fim_anestesia')
    into v_inicio, v_fim
    from public.registros_vigentes_evolucao(p_id) r
   where r.tipo = 'evento';

  v_data := coalesce(
    case when coalesce(f.dados->>'data_procedimento', '') ~ '^\d{4}-\d{2}-\d{2}$'
         then (f.dados->>'data_procedimento')::date end,
    (coalesce(v_inicio, f.inicio_em) at time zone 'America/Sao_Paulo')::date);
  -- A célula "Convênio" do papel vence o cadastro; sem nenhum, Particular,
  -- o mesmo padrão da Produção.
  v_convenio := coalesce(nullif(btrim(f.dados->>'papel_convenio'), ''),
                         nullif(btrim(f.dados->>'convenio'), ''),
                         nullif(btrim(v_convenio_cadastro), ''),
                         'Particular');
  v_procedimento := nullif(btrim(f.dados->>'procedimento'), '');

  -- Hospital e plantão: a regra da tela de Produção.
  select a.local_atendimento_id into v_local from public.avaliacoes a where a.id = f.avaliacao_id;
  select case when count(*) = 1 then (array_agg(pl.id))[1] end,
         case when count(distinct pl.local_id) = 1 then (array_agg(pl.local_id) filter (where pl.local_id is not null))[1] end
    into v_plantao, v_local_plantao
    from public.plantoes pl
   where pl.perfil_id = v_perfil and pl.institution_id = f.institution_id
     and pl.data = v_data and pl.situacao <> 'cancelado';
  v_local := coalesce(v_local, v_local_plantao);

  v_obs := 'Da ficha anestésica';
  if v_inicio is not null and v_fim is not null and v_fim > v_inicio then
    v_minutos := round(extract(epoch from (v_fim - v_inicio)) / 60);
    v_obs := v_obs || format(' · anestesia %s às %s (%sh%s)',
      to_char(v_inicio at time zone 'America/Sao_Paulo', 'HH24:MI'),
      to_char(v_fim at time zone 'America/Sao_Paulo', 'HH24:MI'),
      v_minutos / 60, lpad((v_minutos % 60)::text, 2, '0'));
  end if;

  -- O mesmo paciente já anotado à mão no mesmo dia: liga a ficha a essa
  -- linha e completa só o que estava vazio.
  update public.producao_do_dia pd
     set evolucao_id = p_id,
         procedimento = coalesce(pd.procedimento, v_procedimento),
         local_id = coalesce(pd.local_id, v_local),
         plantao_id = coalesce(pd.plantao_id, v_plantao)
   where pd.id = (
     select x.id from public.producao_do_dia x
      where x.perfil_id = v_perfil and x.institution_id = f.institution_id
        and x.data = v_data and x.evolucao_id is null
        and lower(btrim(x.paciente)) = lower(btrim(v_paciente))
      order by x.created_at
      limit 1)
  returning pd.id into v_id;
  if v_id is not null then return v_id; end if;

  insert into public.producao_do_dia
    (institution_id, perfil_id, plantao_id, local_id, data, paciente, convenio, procedimento, observacoes, evolucao_id)
  values
    (f.institution_id, v_perfil, v_plantao, v_local, v_data, btrim(v_paciente), v_convenio, v_procedimento, v_obs, p_id)
  returning id into v_id;
  return v_id;
end;
$$;
-- Só o encerramento chama: ninguém cria linha na Produção de outra pessoa por fora.
revoke all on function public.producao_da_ficha(uuid) from public, anon, authenticated;

create or replace function public.encerrar_evolucao(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare f public.evolucoes_anestesicas%rowtype;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id for update;
  if not found or not public.pode_evolucao(f.institution_id) then raise exception 'FOLHA_INEXISTENTE'; end if;
  if f.status <> 'aberta' then raise exception 'FOLHA_ENCERRADA'; end if;
  update public.evolucoes_anestesicas
     set status = 'encerrada', encerrada_em = now(), encerrada_por = auth.uid(), updated_at = now()
   where id = p_id;
  insert into public.evolucao_versoes(evolucao_id, institution_id, versao, dados, registros, encerrada_em, encerrada_por)
  values (p_id, f.institution_id, f.versao, f.dados,
          coalesce((select jsonb_agg(to_jsonb(r)) from public.registros_vigentes_evolucao(p_id) r), '[]'::jsonb),
          now(), auth.uid());
  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (f.institution_id, auth.uid(), 'evolucao_anestesica', p_id, 'encerrar',
          jsonb_build_object('versao', f.versao));
  -- A Produção do responsável. Falhar aqui não desfaz o encerramento.
  begin
    perform public.producao_da_ficha(p_id);
  exception when others then
    raise warning 'producao_da_ficha(%): %', p_id, sqlerrm;
  end;
  return f.versao;
end;
$$;
revoke all on function public.encerrar_evolucao(uuid) from public;
grant execute on function public.encerrar_evolucao(uuid) to authenticated;
