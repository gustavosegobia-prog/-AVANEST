-- ============================================================================
-- Adiar um aviso
--
-- O sino não tem tabela de notificações: cada aviso é DERIVADO do que é verdade
-- agora — dez plantões de julho sem receber são um aviso porque continuam sem
-- receber. É um bom desenho, e cria um problema: não há nada para "apagar". Um
-- botão de descartar seria mentira, porque o aviso voltaria no recarregamento
-- seguinte, com a pendência intacta.
--
-- O que falta não é apagar, é ADIAR. "Já sei dos plantões de julho, me lembre
-- daqui a uma semana" é uma decisão, e decisão se guarda. É a diferença entre
-- esconder o problema e agendar a volta dele.
--
-- ---------------------------------------------------------------------------
-- O QUE NÃO PODE SER ADIADO, e a regra é de produto e não de banco.
--
-- Pedido de troca não entra: do outro lado há um colega esperando resposta, e
-- adiar seria deixá-lo no vácuo sem que ele soubesse. Para esse caso existem
-- Assumir e Recusar, no próprio sino. Adiável é só o lembrete que se repete e
-- que ninguém mais está esperando.
-- ============================================================================

create table if not exists public.avisos_adiados (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  -- "tipo:id" do aviso — `plantao_a_receber:plantao-2026-07`. Chave do mundo do
  -- código, e não do banco: estes avisos não são linhas de tabela nenhuma, são
  -- contas feitas na hora, e o único identificador estável que possuem é este.
  chave text not null,
  -- Até quando fica escondido. Data, e não instante: "some pelo resto de hoje"
  -- não é o que ninguém quer dizer ao adiar um lembrete de faturamento.
  ate date not null,
  criado_em timestamptz not null default now(),
  primary key (perfil_id, chave)
);

comment on table public.avisos_adiados is
  'Avisos do sino que a pessoa mandou voltar depois. Não apaga nada: o aviso é derivado da pendência e reaparece em `ate`.';

alter table public.avisos_adiados enable row level security;

-- Cada um adia os seus, e só os seus. Sem institution_id de propósito: o adiar
-- é da PESSOA, e ela leva a decisão junto se mudar de organização — enquanto
-- o aviso, que é derivado, some sozinho quando a pendência deixa de ser dela.
drop policy if exists "cada_um_adia_o_seu" on public.avisos_adiados;
create policy "cada_um_adia_o_seu" on public.avisos_adiados
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- A leitura pergunta sempre "o que está adiado para mim, ainda valendo".
create index if not exists avisos_adiados_vigentes
  on public.avisos_adiados (perfil_id, ate);

-- Limpeza do que já venceu. Não é obrigatória — a consulta filtra por data —,
-- mas sem ela a tabela guarda para sempre cada adiamento já expirado de cada
-- pessoa, e daqui a dois anos ninguém vai lembrar de olhar.
create or replace function public.limpar_adiamentos_vencidos()
returns integer
language sql
security definer
set search_path = ''
as $$
  with apagados as (
    delete from public.avisos_adiados where ate < current_date - interval '30 days'
    returning 1
  )
  select count(*)::integer from apagados
$$;

revoke execute on function public.limpar_adiamentos_vencidos() from public, anon;
