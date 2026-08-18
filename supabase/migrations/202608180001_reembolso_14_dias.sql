-- ============================================================================
-- Reembolso só nos 14 primeiros dias do ciclo
--
-- O cancelamento continua livre: qualquer dia, sem multa, sem passar por
-- atendimento. O que passa a ter prazo é o dinheiro de volta.
--
--   Cancelou até 14 dias depois de pagar  →  devolve o valor daquele mês.
--   Cancelou depois disso                 →  não devolve; o acesso segue até
--                                            o fim do mês já pago.
--
-- Prender o cancelamento em si seria nulo pelo Código de Defesa do Consumidor
-- e contradiria a página de planos, que promete "cancele quando quiser".
-- Condicionar o reembolso é outra coisa: é política comercial, e 14 dias é o
-- dobro dos 7 dias de arrependimento do art. 49 — quem cancela na primeira
-- semana está coberto de qualquer jeito.
--
-- Nada aqui movimenta dinheiro. O banco calcula e registra se o reembolso é
-- devido; a devolução é feita à mão, e a auditoria é o que diz quais foram.
-- ============================================================================

-- A decisão fica gravada na linha da instituição, e não recalculada depois:
-- o prazo pode mudar, e quem cancelou sob a regra antiga não pode ver a
-- própria resposta mudar de ideia semanas depois.
alter table public.instituicoes add column if not exists reembolso_devido boolean;
comment on column public.instituicoes.reembolso_devido is
  'Decidido no momento do cancelamento: se ele caiu dentro do prazo de reembolso. Não recalcula depois.';

-- Quantos dias de reembolso. Num lugar só, para a tela, a função e a auditoria
-- não discordarem quando o prazo mudar.
create or replace function public.dias_de_reembolso()
returns integer language sql immutable as $$ select 14 $$;

-- ----------------------------------------------------------------------------
-- Quando começou o mês que está correndo
--
-- A resposta boa é a data do último pagamento aprovado — é a partir dela que a
-- pessoa gastou o dinheiro. Sem registro de pagamento (cortesia, cobrança
-- combinada por fora, assinatura antiga), sobra estimar recuando um mês do
-- vencimento. E se não houver nem vencimento, não há ciclo nem reembolso.
-- ----------------------------------------------------------------------------
create or replace function public.inicio_do_ciclo(p_institution_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.created_at
       from public.assinatura_eventos e
      where e.institution_id = p_institution_id
        and e.tipo = 'pagamento'
        and e.status = 'approved'
      order by e.created_at desc
      limit 1),
    (select i.assinatura_ate - interval '1 month'
       from public.instituicoes i
      where i.id = p_institution_id
        and i.assinatura_ate is not null)
  );
$$;

revoke all on function public.inicio_do_ciclo(uuid) from public, anon;
grant execute on function public.inicio_do_ciclo(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Cancelar, agora dizendo se o dinheiro volta
--
-- A decisão é tomada e gravada no momento do cancelamento, e não calculada
-- depois: o prazo pode mudar, e quem cancelou sob a regra antiga não pode ver
-- a própria resposta mudar de ideia semanas depois.
-- ----------------------------------------------------------------------------
-- O retorno mudou de uma linha de instituicoes para as quatro colunas da
-- resposta: create or replace não troca assinatura de saída.
drop function if exists public.cancelar_assinatura(text);

create function public.cancelar_assinatura(p_motivo text default null)
returns table (
  cancelada_em timestamptz,
  acesso_ate timestamptz,
  reembolso_devido boolean,
  dias_de_uso integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.perfis;
  v_instituicao public.instituicoes;
  v_inicio timestamptz;
  v_dias integer;
  v_reembolso boolean;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null or v_perfil.role not in ('owner','admin') then
    raise exception 'Somente o proprietário ou o administrador pode cancelar a assinatura';
  end if;

  select * into v_instituicao from public.instituicoes where id = v_perfil.institution_id;
  if v_instituicao.id is null then
    raise exception 'Organização não encontrada';
  end if;

  v_inicio := public.inicio_do_ciclo(v_instituicao.id);
  v_dias := case when v_inicio is null then null
                 else floor(extract(epoch from (now() - v_inicio)) / 86400)::integer end;
  -- Sem ciclo conhecido não há reembolso a prometer: é o caso da cortesia, que
  -- não teve pagamento nenhum.
  v_reembolso := v_dias is not null and v_dias <= public.dias_de_reembolso();

  if v_instituicao.cancelada_em is not null then
    -- Já cancelada: devolve o que ficou registrado da primeira vez, sem
    -- recalcular. A resposta dada ao cliente não muda depois.
    return query
      select v_instituicao.cancelada_em, v_instituicao.assinatura_ate,
             coalesce(v_instituicao.reembolso_devido, false),
             v_dias;
    return;
  end if;

  update public.instituicoes
  set cancelada_em = now(),
      cancelada_por = auth.uid(),
      cancelamento_motivo = nullif(btrim(coalesce(p_motivo,'')), ''),
      reembolso_devido = v_reembolso,
      updated_at = now()
  where id = v_instituicao.id
  returning * into v_instituicao;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_instituicao.id, auth.uid(), 'assinatura', v_instituicao.id, 'assinatura_cancelada',
    jsonb_build_object(
      'motivo', v_instituicao.cancelamento_motivo,
      'acesso_ate', v_instituicao.assinatura_ate,
      'plano', v_instituicao.plano,
      'dias_de_uso', v_dias,
      'reembolso_devido', v_reembolso,
      'prazo_de_reembolso_dias', public.dias_de_reembolso()
    )
  );

  return query select v_instituicao.cancelada_em, v_instituicao.assinatura_ate, v_reembolso, v_dias;
end;
$$;

revoke all on function public.cancelar_assinatura(text) from public, anon;
grant execute on function public.cancelar_assinatura(text) to authenticated;

-- Reativar precisa limpar a marca do reembolso junto: quem voltou atrás não
-- tem devolução a receber.
create or replace function public.reativar_assinatura()
returns public.instituicoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.perfis;
  v_instituicao public.instituicoes;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null or v_perfil.role not in ('owner','admin') then
    raise exception 'Somente o proprietário ou o administrador pode reativar a assinatura';
  end if;

  select * into v_instituicao from public.instituicoes where id = v_perfil.institution_id;
  if v_instituicao.cancelada_em is null then
    return v_instituicao;
  end if;
  if v_instituicao.assinatura_ate is not null and v_instituicao.assinatura_ate <= now() then
    raise exception 'O período pago já venceu. Para voltar, é preciso assinar de novo.';
  end if;

  update public.instituicoes
  set cancelada_em = null, cancelada_por = null, cancelamento_motivo = null,
      reembolso_devido = null, updated_at = now()
  where id = v_instituicao.id
  returning * into v_instituicao;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_instituicao.id, auth.uid(), 'assinatura', v_instituicao.id, 'assinatura_reativada',
          jsonb_build_object('acesso_ate', v_instituicao.assinatura_ate));

  return v_instituicao;
end;
$$;

revoke all on function public.reativar_assinatura() from public, anon;
grant execute on function public.reativar_assinatura() to authenticated;

-- ----------------------------------------------------------------------------
-- A tela precisa saber, ANTES de cancelar, se ainda dá tempo
--
-- Dizer só depois seria a pior versão: a pessoa cancela achando que recebe de
-- volta e descobre que não. O aviso tem de estar na tela enquanto ela decide.
-- ----------------------------------------------------------------------------
drop function if exists public.minha_assinatura();

create function public.minha_assinatura()
returns table (
  organizacao text, plano text, assinatura_ate timestamptz,
  dias_restantes integer, profissionais integer, valor_mensal numeric, liberada boolean,
  cancelada_em timestamptz, reembolso_devido boolean,
  dias_de_uso integer, prazo_de_reembolso integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.nome,
    i.plano,
    i.assinatura_ate,
    case when i.assinatura_ate is null then null
         else greatest(0, extract(day from i.assinatura_ate - now())::integer) end,
    public.contar_profissionais(i.id),
    round(public.contar_profissionais(i.id) * i.valor_por_profissional, 2),
    case
      when i.plano in ('suspenso','cancelado') then false
      when i.assinatura_ate is null then true
      else i.assinatura_ate > now()
    end,
    i.cancelada_em,
    -- Já cancelada: vale o que foi decidido na hora. Ainda ativa: é a previsão
    -- de como seria se cancelasse agora.
    case when i.cancelada_em is not null then coalesce(i.reembolso_devido, false)
         else public.inicio_do_ciclo(i.id) is not null
              and floor(extract(epoch from (now() - public.inicio_do_ciclo(i.id))) / 86400)
                  <= public.dias_de_reembolso()
    end,
    case when public.inicio_do_ciclo(i.id) is null then null
         else floor(extract(epoch from (now() - public.inicio_do_ciclo(i.id))) / 86400)::integer end,
    public.dias_de_reembolso()
  from public.instituicoes i
  join public.perfis p on p.institution_id = i.id
  where p.id = auth.uid() and p.status = 'ativo';
$$;

revoke execute on function public.minha_assinatura() from anon;
grant execute on function public.minha_assinatura() to authenticated;
