-- Produção e Financeiro (17/11/2026: "analise a produção e o financeiro e
-- corrija e melhore o que for necessário").
--
-- 1. A BAIXA SEM DATA. A Produção do dia mudava a situação para "recebido"
--    sem gravar o dia do recebimento (a Produção do mês já gravava); o
--    fechamento não sabia em que mês somar. A tela foi corrigida; aqui, as
--    seis que ficaram assim recebem o dia da baixa: o da auditoria quando há,
--    senão o da última mudança da linha.
update public.producao_do_dia pr
   set recebido_em = coalesce(
         (select max(a.created_at at time zone 'America/Sao_Paulo')::date
            from public.auditoria a
           where (a.registro_id = pr.id or a.entidade_id = pr.id)
             and a.dados_novos->>'situacao' = 'recebido'),
         (pr.updated_at at time zone 'America/Sao_Paulo')::date)
 where pr.situacao = 'recebido' and pr.recebido_em is null;

-- 2. UM CONVÊNIO, UMA GRAFIA. "Particular" e "PARTICULAR", "Unimed" e
--    "UNIMED" — o mesmo convênio escrito de dois jeitos, porque a ficha
--    anestésica lançava o que veio no papel. As telas já somam os dois juntos,
--    mas a lista e a nota impressa mostravam as duas grafias. Vale a grafia da
--    tabela "Valores por convênio"; sem ela, a mais usada (no empate, a que
--    não está toda em maiúsculas).
create or replace function public.grafia_do_convenio(p_institution uuid, p_convenio text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select cv.convenio from public.convenio_valores cv
      where cv.institution_id = p_institution
        and public.nome_simples(cv.convenio) = public.nome_simples(p_convenio)
      order by cv.ativo desc, cv.updated_at desc nulls last limit 1),
    (select pd.convenio from public.producao_do_dia pd
      where pd.institution_id = p_institution
        and public.nome_simples(pd.convenio) = public.nome_simples(p_convenio)
      group by pd.convenio
      order by count(*) desc, (pd.convenio <> upper(pd.convenio)) desc, pd.convenio limit 1),
    nullif(btrim(regexp_replace(coalesce(p_convenio, ''), '\s+', ' ', 'g')), ''));
$$;
revoke all on function public.grafia_do_convenio(uuid, text) from public, anon, authenticated;

update public.producao_do_dia pd
   set convenio = public.grafia_do_convenio(pd.institution_id, pd.convenio)
 where pd.convenio is distinct from public.grafia_do_convenio(pd.institution_id, pd.convenio);

-- 3. A ficha anestésica lança a produção já na grafia da organização. Igual à
--    versão de 202611170001, mais a linha marcada.
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

  select id into v_id from public.producao_do_dia where evolucao_id = p_id;
  if found then return v_id; end if;

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

  select min(r.momento) filter (where r.dados->>'codigo' = 'inicio_anestesia'),
         max(r.momento) filter (where r.dados->>'codigo' = 'fim_anestesia')
    into v_inicio, v_fim
    from public.registros_vigentes_evolucao(p_id) r
   where r.tipo = 'evento';

  v_data := coalesce(
    case when coalesce(f.dados->>'data_procedimento', '') ~ '^\d{4}-\d{2}-\d{2}$'
         then (f.dados->>'data_procedimento')::date end,
    (coalesce(v_inicio, f.inicio_em) at time zone 'America/Sao_Paulo')::date);
  v_convenio := coalesce(nullif(btrim(f.dados->>'papel_convenio'), ''),
                         nullif(btrim(f.dados->>'convenio'), ''),
                         nullif(btrim(v_convenio_cadastro), ''),
                         'Particular');
  -- A grafia que a organização já usa ("Unimed", e não o "UNIMED" da guia).
  v_convenio := public.grafia_do_convenio(f.institution_id, v_convenio);
  v_procedimento := nullif(btrim(f.dados->>'procedimento'), '');

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

  update public.producao_do_dia pd
     set evolucao_id = p_id,
         procedimento = coalesce(pd.procedimento, v_procedimento),
         local_id = coalesce(pd.local_id, v_local),
         plantao_id = coalesce(pd.plantao_id, v_plantao)
   where pd.id = (
     select x.id from public.producao_do_dia x
      where x.perfil_id = v_perfil and x.institution_id = f.institution_id
        and x.data = v_data and x.evolucao_id is null
        -- Antes: lower(btrim(...)) — "Jose" e "José" viravam duas linhas.
        and public.nome_simples(x.paciente) = public.nome_simples(v_paciente)
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

revoke all on function public.producao_da_ficha(uuid) from public, anon, authenticated;
