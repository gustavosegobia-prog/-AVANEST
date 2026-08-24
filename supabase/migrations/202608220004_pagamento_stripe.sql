-- ============================================================================
-- O Stripe passa a cobrar, e a validade deixa de ser somada
--
-- Duas coisas, e elas andam juntas de propósito: quem estende o acesso é a
-- mesma função que aprende o provedor novo, e separar em duas migrações
-- deixaria uma janela em que o webhook do Stripe grava pagamento mas não sabe
-- até quando liberar.
--
-- 1. 'stripe' entra onde 'asaas' e 'mercadopago' já estavam.
-- 2. registrar_pagamento_assinatura ganha p_acesso_ate: quando o gateway diz
--    até quando o cliente pagou, é essa data que vale.
--
-- O que NÃO muda: registrar_pagamento_assinatura continua sendo a única porta
-- que estende validade, com o mesmo unique que impede contar o mesmo pagamento
-- duas vezes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. O provedor novo
-- ---------------------------------------------------------------------------
-- A restrição nasceu junto com a coluna, com nome gerado pelo Postgres. Trocar
-- pelo nome explícito agora evita ter de adivinhá-lo na próxima vez.
alter table public.instituicoes
  drop constraint if exists instituicoes_pagamento_provedor_check;
alter table public.instituicoes
  drop constraint if exists instituicoes_pagamento_provedor_conhecido;
alter table public.instituicoes
  add constraint instituicoes_pagamento_provedor_conhecido
  check (pagamento_provedor is null
         or pagamento_provedor in ('mercadopago','asaas','stripe'));

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
  if p_provedor not in ('mercadopago','asaas','stripe') then
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

-- ---------------------------------------------------------------------------
-- 2. A validade passa a vir do gateway
--
-- O que havia: v_ate := greatest(now(), v_ate) + p_meses meses.
--
-- Isso erra devagar, nos dois sentidos. Para cima, porque o aviso chega horas
-- depois da cobrança e a conta parte de now(): cada renovação empurra a
-- validade um pouco além do que foi pago, e em um ano são semanas de acesso
-- que ninguém pagou. Para baixo, porque com dois meses de campanha o cliente
-- ficava bloqueado do fim do teste de 14 dias até a primeira fatura.
--
-- O Stripe diz current_period_end em todo aviso de fatura paga. Quando a data
-- vem, ela manda. Quando não vem — Mercado Pago e Asaas não mandam —, a soma
-- de meses continua valendo, e nada muda para quem já está lá.
--
-- greatest com a validade atual, e não substituição pura: um aviso atrasado do
-- Stripe pode chegar depois de um mais novo, e a data velha não pode encurtar
-- um acesso já estendido.
-- ---------------------------------------------------------------------------

-- Sai a versão de 7 argumentos. Se as duas convivessem, uma chamada com os 7
-- parâmetros nomeados casaria com ambas e o Postgres recusaria por ambiguidade
-- — o que derrubaria o webhook do Asaas, que chama exatamente assim.
drop function if exists public.registrar_pagamento_assinatura(
  uuid, text, text, text, numeric, numeric, jsonb);

create or replace function public.registrar_pagamento_assinatura(
  p_institution_id uuid,
  p_mp_id text,
  p_tipo text,
  p_status text,
  p_valor numeric default null,
  p_meses numeric default 1,
  p_payload jsonb default null,
  p_acesso_ate timestamptz default null)
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
    if p_acesso_ate is not null then
      v_ate := greatest(coalesce(v_ate, now()), p_acesso_ate);
    else
      v_ate := greatest(now(), coalesce(v_ate, now())) + (p_meses || ' months')::interval;
    end if;
    update public.instituicoes
    set plano = 'ativo', assinatura_ate = v_ate, updated_at = now()
    where id = p_institution_id;

  elsif p_status in ('cancelled', 'canceled') then
    -- A vaga volta para o bolo (preco_fundador = false) e outra organização
    -- pode ocupá-la. Quem cancelou fica marcado e não entra mais na campanha.
    -- O "or fundador_perdido" preserva a marca de quem já tinha cancelado
    -- antes: sem isso, um segundo cancelamento a apagaria.
    update public.instituicoes
    set plano = 'cancelado',
        preco_fundador = false,
        fundador_perdido = preco_fundador or fundador_perdido,
        updated_at = now()
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

-- ---------------------------------------------------------------------------
-- Permissões
--
-- Lembrete que já custou caro aqui: o Postgres concede EXECUTE ao PUBLIC assim
-- que a função é criada. A assinatura mudou, então é uma função nova aos olhos
-- do Postgres — e nasceu com a porta aberta de novo.
-- ---------------------------------------------------------------------------
revoke execute on function public.registrar_pagamento_assinatura(
  uuid,text,text,text,numeric,numeric,jsonb,timestamptz) from public, anon, authenticated;
grant execute on function public.registrar_pagamento_assinatura(
  uuid,text,text,text,numeric,numeric,jsonb,timestamptz) to service_role;

revoke execute on function public.vincular_assinatura(uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.vincular_assinatura(uuid,text,text,text,text) to service_role;
