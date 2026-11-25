-- Cancelamento sem devolução (25/11/2026, regra do dono, item 5 dos Termos).
--
-- No período grátis (15 dias), cancelar não custa nada: o cartão não é
-- cobrado. Depois dele, a mensalidade é cobrada e cancelar só suspende as
-- próximas cobranças: o acesso vai até o fim do mês pago, e o que foi pago
-- não volta. Antes havia devolução do mês quando se cancelava em até 14 dias
-- do último pagamento — e, no período grátis, a tela contava os dias a partir
-- do cadastro do cartão (um "pagamento" de R$ 0,00) e falava em devolução de
-- algo que nunca foi pago.
--
-- As colunas reembolso_devido e prazo_de_reembolso continuam em
-- minha_assinatura e cancelar_assinatura, sempre false e 0, para quem ainda
-- as lê não quebrar. A coluna instituicoes.reembolso_devido fica como
-- histórico.
--
-- Período grátis: plano "trial" (contas de campanha, sem cartão) ou assinatura
-- no cartão que ainda não teve nenhum pagamento acima de R$ 0,00.

create or replace function public.assinatura_em_teste(p_institution_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select i.plano = 'trial'
        or (i.pagamento_assinatura_id is not null
            and not exists (select 1 from public.assinatura_eventos e
                             where e.institution_id = i.id and e.tipo = 'pagamento'
                               and e.status = 'approved' and coalesce(e.valor, 0) > 0))
      from public.instituicoes i where i.id = p_institution_id), false);
$$;

revoke all on function public.assinatura_em_teste(uuid) from public, anon, authenticated;

-- minha_assinatura ganha em_teste no fim (a tela usa pelo nome; quem não lê o
-- campo novo não muda). Mudar o tipo de retorno exige recriar a função.
drop function public.minha_assinatura();

create function public.minha_assinatura()
returns table(organizacao text, plano text, assinatura_ate timestamp with time zone, dias_restantes integer,
  profissionais integer, valor_mensal numeric, liberada boolean, cancelada_em timestamp with time zone,
  reembolso_devido boolean, dias_de_uso integer, prazo_de_reembolso integer, provedor text, tem_cobranca boolean,
  em_teste boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
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
    -- Sem devolução desde 25/11/2026.
    false,
    case when public.inicio_do_ciclo(i.id) is null then null
         else floor(extract(epoch from (now() - public.inicio_do_ciclo(i.id))) / 86400)::integer end,
    0,
    i.pagamento_provedor,
    i.pagamento_assinatura_id is not null,
    public.assinatura_em_teste(i.id)
  from public.instituicoes i
  join public.perfis p on p.institution_id = i.id
  where p.id = auth.uid() and p.status = 'ativo';
$function$;

revoke all on function public.minha_assinatura() from public, anon;
grant execute on function public.minha_assinatura() to authenticated, service_role;

-- O cancelamento não marca devolução, em período grátis ou não.
create or replace function public.cancelar_assinatura(p_motivo text default null::text)
returns table(cancelada_em timestamp with time zone, acesso_ate timestamp with time zone, reembolso_devido boolean, dias_de_uso integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_perfil public.perfis; v_instituicao public.instituicoes;
        v_inicio timestamptz; v_dias integer; v_reembolso boolean;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null or v_perfil.role not in ('owner','admin') then
    raise exception 'Somente o proprietário ou o administrador pode cancelar a assinatura';
  end if;
  select * into v_instituicao from public.instituicoes where id = v_perfil.institution_id;
  if v_instituicao.id is null then raise exception 'Organização não encontrada'; end if;

  v_inicio := public.inicio_do_ciclo(v_instituicao.id);
  v_dias := case when v_inicio is null then null
                 else floor(extract(epoch from (now() - v_inicio)) / 86400)::integer end;
  v_reembolso := false;

  if v_instituicao.cancelada_em is not null then
    return query select v_instituicao.cancelada_em, v_instituicao.assinatura_ate, false, v_dias;
    return;
  end if;

  perform set_config('avanest.interno', '1', true);
  update public.instituicoes
  set cancelada_em = now(), cancelada_por = auth.uid(),
      cancelamento_motivo = nullif(btrim(coalesce(p_motivo,'')), ''),
      reembolso_devido = v_reembolso, updated_at = now()
  where id = v_instituicao.id returning * into v_instituicao;
  perform set_config('avanest.interno', '', true);

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_instituicao.id, auth.uid(), 'assinatura', v_instituicao.id, 'assinatura_cancelada',
    jsonb_build_object('motivo', v_instituicao.cancelamento_motivo,
      'acesso_ate', v_instituicao.assinatura_ate, 'plano', v_instituicao.plano,
      'dias_de_uso', v_dias, 'reembolso_devido', false,
      'em_teste', public.assinatura_em_teste(v_instituicao.id),
      'regra', 'sem devolução (25/11/2026)'));

  return query select v_instituicao.cancelada_em, v_instituicao.assinatura_ate, v_reembolso, v_dias;
end;
$function$;

-- O prazo de devolução deixou de existir. A função fica (devolvendo 0) para
-- nada que ainda a chame quebrar.
create or replace function public.dias_de_reembolso()
returns integer
language sql
immutable
set search_path = ''
as $$ select 0 $$;
