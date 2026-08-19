-- ============================================================================
-- A cobrança deixa de ser "do Mercado Pago" e passa a ter provedor
--
-- A conta do Mercado Pago foi bloqueada, e a assinatura ficou sem por onde
-- cobrar. Trocar de provedor não pode ser reescrever o sistema todo, então o
-- vínculo com a cobrança deixa de citar um provedor pelo nome e passa a
-- guardar qual é.
--
-- O que NÃO muda: registrar_pagamento_assinatura continua sendo a única porta
-- que estende validade, com o mesmo unique que impede contar o mesmo
-- pagamento duas vezes. O adaptador de cada provedor traduz o vocabulário
-- dele para 'approved' / 'cancelled' / 'paused' antes de chegar aqui — a
-- regra de negócio não aprende dialeto de gateway.
--
-- As colunas antigas mp_* ficam, preenchidas, para não perder o histórico de
-- quem assinou pelo Mercado Pago.
-- ============================================================================

alter table public.instituicoes
  add column if not exists pagamento_provedor text
    check (pagamento_provedor is null or pagamento_provedor in ('mercadopago','asaas')),
  add column if not exists pagamento_assinatura_id text,
  add column if not exists pagamento_cliente_id text;

comment on column public.instituicoes.pagamento_provedor is
  'Qual gateway cobra esta organização. Null = ninguém ainda (trial, cortesia).';
comment on column public.instituicoes.pagamento_assinatura_id is
  'Id da assinatura no provedor. No Mercado Pago é o preapproval; no Asaas, a subscription.';
comment on column public.instituicoes.pagamento_cliente_id is
  'Id do cliente no provedor, quando ele separa cliente de assinatura (Asaas).';

-- Quem já assinou pelo Mercado Pago continua identificado, agora pelo caminho
-- novo também. Sem isto o webhook antigo acharia a organização e o novo não.
update public.instituicoes
set pagamento_provedor = 'mercadopago',
    pagamento_assinatura_id = mp_assinatura_id
where mp_assinatura_id is not null
  and pagamento_assinatura_id is null;

-- Duas organizações não podem apontar para a mesma assinatura: seria cobrar
-- uma e liberar a outra. O índice é parcial porque a maioria é null.
create unique index if not exists instituicoes_assinatura_provedor_idx
  on public.instituicoes (pagamento_provedor, pagamento_assinatura_id)
  where pagamento_assinatura_id is not null;

-- ----------------------------------------------------------------------------
-- As colunas novas entram na mesma proteção das antigas
--
-- Este é o ponto perigoso da migração. As policies deixam owner e admin
-- atualizarem a própria organização, e sem esta trava qualquer administrador
-- poderia rodar, direto da API:
--
--   update instituicoes set pagamento_provedor='asaas',
--                           pagamento_assinatura_id='<id de outra conta>';
--
-- e sequestrar os pagamentos de outra organização para a própria — o webhook
-- procura a organização por esse par. Elas voltam ao valor antigo, igual às
-- demais colunas de dinheiro.
-- ----------------------------------------------------------------------------
create or replace function public.protege_assinatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.e_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Organização nova sempre nasce em teste grátis de 14 dias.
    new.plano := 'trial';
    new.assinatura_ate := now() + interval '14 days';
    new.valor_por_profissional := 49.99;
    new.mp_assinatura_id := null;
    new.pagamento_provedor := null;
    new.pagamento_assinatura_id := null;
    new.pagamento_cliente_id := null;
    return new;
  end if;

  new.plano := old.plano;
  new.assinatura_ate := old.assinatura_ate;
  new.valor_por_profissional := old.valor_por_profissional;
  new.mp_assinatura_id := old.mp_assinatura_id;
  new.pagamento_provedor := old.pagamento_provedor;
  new.pagamento_assinatura_id := old.pagamento_assinatura_id;
  new.pagamento_cliente_id := old.pagamento_cliente_id;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Guardar o vínculo, dizendo qual provedor
-- ----------------------------------------------------------------------------
create or replace function public.vincular_assinatura(
  p_institution_id uuid,
  p_provedor text,
  p_assinatura_id text,
  p_cliente_id text default null,
  p_email text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_provedor not in ('mercadopago','asaas') then
    raise exception 'Provedor de pagamento desconhecido: %', p_provedor;
  end if;

  update public.instituicoes
  set pagamento_provedor = p_provedor,
      pagamento_assinatura_id = p_assinatura_id,
      pagamento_cliente_id = coalesce(p_cliente_id, pagamento_cliente_id),
      mp_payer_email = coalesce(p_email, mp_payer_email),
      -- A coluna antiga segue preenchida só quando o provedor é o antigo, para
      -- o webhook do Mercado Pago continuar achando quem já assinou por lá.
      mp_assinatura_id = case when p_provedor = 'mercadopago' then p_assinatura_id
                              else mp_assinatura_id end,
      updated_at = now()
  where id = p_institution_id;
  if not found then raise exception 'Organização não encontrada'; end if;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (p_institution_id, null, 'instituicao', p_institution_id, 'assinatura_vinculada',
    jsonb_build_object('provedor', p_provedor, 'assinatura', p_assinatura_id,
                       'cliente', p_cliente_id, 'pagador', p_email));
end;
$$;

-- ----------------------------------------------------------------------------
-- De quem é esta assinatura
--
-- O provedor entra na busca de propósito. Sem ele, um id repetido entre dois
-- gateways acharia a organização errada — improvável, mas é dinheiro, e o
-- custo de incluir a coluna é zero.
-- ----------------------------------------------------------------------------
create or replace function public.instituicao_por_assinatura(
  p_provedor text, p_assinatura_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.instituicoes
  where pagamento_provedor = p_provedor
    and pagamento_assinatura_id = p_assinatura_id
  limit 1;
$$;

-- Nada disto pode ser chamado do navegador: quem usa é o webhook, com a chave
-- de serviço. Revogar do PUBLIC, e não só de authenticated: o Postgres concede
-- EXECUTE ao PUBLIC assim que a função nasce, e essa porta aberta deixaria
-- qualquer usuário logado se vincular à cobrança de outra pessoa.
revoke execute on function public.vincular_assinatura(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.instituicao_por_assinatura(text,text) from public, anon, authenticated;
grant execute on function public.vincular_assinatura(uuid,text,text,text,text) to service_role;
grant execute on function public.instituicao_por_assinatura(text,text) to service_role;

-- ----------------------------------------------------------------------------
-- A tela precisa saber se há cobrança de verdade por trás
--
-- Sem isto o painel mostra "cancelar assinatura" para quem está em cortesia ou
-- em teste, e o cancelamento não teria o que cancelar.
-- ----------------------------------------------------------------------------
drop function if exists public.minha_assinatura();

create function public.minha_assinatura()
returns table (
  organizacao text, plano text, assinatura_ate timestamptz,
  dias_restantes integer, profissionais integer, valor_mensal numeric, liberada boolean,
  cancelada_em timestamptz, reembolso_devido boolean,
  dias_de_uso integer, prazo_de_reembolso integer,
  provedor text, tem_cobranca boolean
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
    case when i.cancelada_em is not null then coalesce(i.reembolso_devido, false)
         else public.inicio_do_ciclo(i.id) is not null
              and floor(extract(epoch from (now() - public.inicio_do_ciclo(i.id))) / 86400)
                  <= public.dias_de_reembolso()
    end,
    case when public.inicio_do_ciclo(i.id) is null then null
         else floor(extract(epoch from (now() - public.inicio_do_ciclo(i.id))) / 86400)::integer end,
    public.dias_de_reembolso(),
    i.pagamento_provedor,
    i.pagamento_assinatura_id is not null
  from public.instituicoes i
  join public.perfis p on p.institution_id = i.id
  where p.id = auth.uid() and p.status = 'ativo';
$$;

revoke execute on function public.minha_assinatura() from anon;
grant execute on function public.minha_assinatura() to authenticated;
