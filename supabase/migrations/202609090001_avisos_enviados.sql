-- ============================================================================
-- O que já tocou no telefone
--
-- ISTO CONTINUA NÃO SENDO UMA TABELA DE NOTIFICAÇÕES. lib/avisos.ts explica por
-- que ela não existe, e a razão vale igual aqui: aviso guardado envelhece
-- separado do fato que o originou. O que mora nesta tabela não é o aviso — é o
-- RECIBO. "Este lembrete já foi para o telefone desta pessoa, neste instante."
--
-- Sem o recibo o lembrete diário não teria memória nenhuma, e a pendência, que
-- por natureza não some sozinha, faria o telefone repetir a mesma frase todo
-- dia até a pessoa desligar as notificações. E aí ela perderia junto o pedido
-- de troca de um colega, que é o aviso que ninguém quer perder.
--
-- A CHAVE É A MESMA DO ADIAR — "tipo:id", `plantao_a_receber:plantao-2026-07`.
-- É de propósito: os dois respondem à mesma pergunta ("de quanto em quanto
-- tempo isto merece voltar?") sobre a mesma coisa, e usar identificadores
-- diferentes faria adiar um aviso no sino e ele continuar tocando no telefone.
-- ============================================================================

create table if not exists public.avisos_enviados (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  chave text not null,
  -- O ÚLTIMO envio, e não o primeiro: é dele que sai a conta do silêncio. Uma
  -- linha por chave, atualizada a cada toque — guardar o histórico completo
  -- daria uma tabela que cresce para sempre para responder uma pergunta que só
  -- olha os últimos sete dias.
  enviado_em timestamptz not null default now(),
  primary key (perfil_id, chave)
);

comment on table public.avisos_enviados is
  'Recibo de lembrete enviado ao telefone. Evita repetir o mesmo aviso todo dia; a chave é a mesma de avisos_adiados.';

alter table public.avisos_enviados enable row level security;

-- SEM POLÍTICA NENHUMA, e isso é a decisão e não o esquecimento.
--
-- Com RLS ligada e nenhuma política, ninguém autenticado lê nem escreve — só a
-- chave de serviço, que roda fora do RLS. É exatamente quem precisa: quem
-- escreve aqui é o servidor, depois de o serviço de push aceitar a mensagem.
-- Deixar o navegador escrever permitiria a qualquer pessoa com uma sessão
-- válida calar os próprios lembretes por sete dias — ou, pior, os de um colega.
--
-- Ler também não serve para nada na tela: o sino mostra a pendência, não o
-- recibo.

-- A consulta do lembrete pergunta sempre "o que já mandei para estas pessoas".
create index if not exists avisos_enviados_por_perfil
  on public.avisos_enviados (perfil_id, enviado_em);

-- Limpeza do que já não decide nada. O silêncio dura sete dias; um recibo de
-- noventa dias atrás só ocupa espaço e confunde quem for investigar.
create or replace function public.limpar_recibos_de_aviso()
returns integer
language sql
security definer
set search_path = ''
as $$
  with apagados as (
    delete from public.avisos_enviados
    where enviado_em < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from apagados
$$;

revoke execute on function public.limpar_recibos_de_aviso() from public, anon;
