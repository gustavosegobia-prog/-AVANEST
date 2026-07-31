-- ============================================================================
-- Mercado Pago — assinatura recorrente
--
-- O AVANEST nunca decide sozinho que alguém pagou. Quem estende a validade é
-- o webhook, e só depois de conferir o pagamento direto na API do Mercado
-- Pago. Por isso estas funções são chamadas com a chave de serviço, fora do
-- alcance do navegador do cliente.
--
-- Todo evento recebido fica gravado. Se o mesmo pagamento chegar duas vezes —
-- e o Mercado Pago reenvia mesmo —, o unique em mp_id impede cobrar em dobro
-- de validade.
-- ============================================================================

alter table public.instituicoes
  add column if not exists mp_payer_email text;

create table if not exists public.assinatura_eventos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  mp_id text not null unique,
  tipo text not null,
  status text not null,
  valor numeric(10,2),
  meses numeric,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assinatura_eventos_institution_idx
  on public.assinatura_eventos (institution_id, created_at desc);

alter table public.assinatura_eventos enable row level security;

-- A organização enxerga o próprio histórico de cobrança; escrever, ninguém.
drop policy if exists organizacao_le_seus_pagamentos on public.assinatura_eventos;
create policy organizacao_le_seus_pagamentos on public.assinatura_eventos
  for select using (institution_id = current_institution_id());

-- Guarda o vínculo com a assinatura criada no Mercado Pago.
create or replace function public.vincular_assinatura_mp(
  p_institution_id uuid, p_preapproval_id text, p_payer_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.instituicoes
  set mp_assinatura_id = p_preapproval_id,
      mp_payer_email = p_payer_email,
      updated_at = now()
  where id = p_institution_id;
  if not found then raise exception 'Organização não encontrada'; end if;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (p_institution_id, null, 'instituicao', p_institution_id, 'assinatura_vinculada',
    jsonb_build_object('preapproval', p_preapproval_id, 'pagador', p_payer_email));
end;
$$;

-- Registra um evento do Mercado Pago e, se for pagamento aprovado, estende a
-- validade. Devolve a nova data para o webhook poder registrar no log.
--
-- A extensão parte da data que valer mais: quem paga adiantado não perde os
-- dias que ainda tinha; quem paga atrasado recomeça de hoje.
create or replace function public.registrar_pagamento_assinatura(
  p_institution_id uuid,
  p_mp_id text,
  p_tipo text,
  p_status text,
  p_valor numeric default null,
  p_meses numeric default 1,
  p_payload jsonb default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_ate timestamptz; v_gravados integer;
begin
  insert into public.assinatura_eventos (institution_id, mp_id, tipo, status, valor, meses, payload)
  values (p_institution_id, p_mp_id, p_tipo, p_status, p_valor, p_meses, p_payload)
  on conflict (mp_id) do nothing;
  get diagnostics v_gravados = row_count;

  select i.assinatura_ate into v_ate from public.instituicoes i where i.id = p_institution_id;
  if v_ate is null and not exists (select 1 from public.instituicoes i where i.id = p_institution_id) then
    raise exception 'Organização não encontrada';
  end if;

  -- Evento repetido não estende nada de novo.
  if v_gravados = 0 then return v_ate; end if;

  if p_status = 'approved' then
    v_ate := greatest(now(), coalesce(v_ate, now())) + (p_meses || ' months')::interval;
    update public.instituicoes
    set plano = 'ativo', assinatura_ate = v_ate, updated_at = now()
    where id = p_institution_id;

  elsif p_status in ('cancelled', 'canceled') then
    update public.instituicoes set plano = 'cancelado', updated_at = now()
    where id = p_institution_id;

  elsif p_status = 'paused' then
    update public.instituicoes set plano = 'suspenso', updated_at = now()
    where id = p_institution_id;
  end if;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (p_institution_id, null, 'instituicao', p_institution_id, 'pagamento_registrado',
    jsonb_build_object('mp_id', p_mp_id, 'tipo', p_tipo, 'status', p_status,
                       'valor', p_valor, 'ate', v_ate));
  return v_ate;
end;
$$;

-- Descobre de quem é a assinatura quando o Mercado Pago avisa citando só o
-- preapproval.
create or replace function public.instituicao_por_preapproval(p_preapproval_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.instituicoes where mp_assinatura_id = p_preapproval_id limit 1;
$$;

-- Nada disso pode ser chamado do navegador: só a chave de serviço usa.
--
-- Tem de revogar do PUBLIC. O Postgres concede EXECUTE ao PUBLIC assim que a
-- função é criada, e revogar de "anon, authenticated" deixaria essa porta
-- aberta — qualquer usuário logado poderia chamar registrar_pagamento_assinatura
-- e se dar anos de acesso sem pagar. Estas funções não conferem permissão por
-- dentro de propósito: quem as chama é o webhook, com a chave de serviço.
revoke execute on function public.vincular_assinatura_mp(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.registrar_pagamento_assinatura(uuid,text,text,text,numeric,numeric,jsonb) from public, anon, authenticated;
revoke execute on function public.instituicao_por_preapproval(text) from public, anon, authenticated;

grant execute on function public.vincular_assinatura_mp(uuid,text,text) to service_role;
grant execute on function public.registrar_pagamento_assinatura(uuid,text,text,text,numeric,numeric,jsonb) to service_role;
grant execute on function public.instituicao_por_preapproval(text) to service_role;
