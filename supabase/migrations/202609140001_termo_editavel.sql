-- ============================================================================
-- O termo de consentimento passa a ser de cada organização
--
-- Até aqui o texto era constante no código: o mesmo termo para todo mundo, e
-- para mudar uma vírgula era preciso alterar o sistema. Mas o termo é
-- documento jurídico DA CLÍNICA, não da plataforma. Cada serviço tem o seu,
-- revisado pelo advogado dele, e quem responde por ele em juízo é a
-- organização — que até agora não tinha como sequer trocar uma palavra.
--
-- ----------------------------------------------------------------------------
-- POR QUE A TABELA NÃO ACEITA UPDATE NEM DELETE
--
-- Este é o texto que o paciente ASSINA. Se uma edição pudesse alterar o que já
-- foi impresso, reimprimir a avaliação de março traria um papel diferente do
-- que aquele paciente assinou em março — e o documento guardado no prontuário
-- deixaria de bater com o que o sistema diz que foi assinado. Num processo, é
-- a diferença entre ter e não ter consentimento documentado.
--
-- Então cada edição INSERE uma linha nova, e nenhuma linha é jamais alterada
-- ou removida. Não há política de update nem de delete, e as permissões são
-- revogadas por cima disso: com RLS ligado, o que não tem política é recusado,
-- e o `revoke` cobre o caso de alguém acrescentar uma política sem se dar
-- conta do que está soltando junto.
--
-- Na impressão, a escolha é pela data: vale a versão que estava valendo quando
-- a avaliação foi concluída — ver `termoVigenteEm` em lib/termo-consentimento.
-- É a mesma regra de `local_snapshot` e `snapshot_conclusao`, e pela mesma
-- razão: um documento de março não pode ser carimbado com o hospital, nem com
-- o termo, de hoje.
--
-- E é por isso que NADA precisa mudar no momento de concluir a avaliação: as
-- duas rotas de conclusão — a tela e a RPC `concluir_avaliacao` — seguem
-- intocadas, e as avaliações antigas continuam imprimindo o texto de fábrica,
-- que é o que elas de fato imprimiram.
--
-- SEM LINHA NENHUMA É O ESTADO NORMAL. A organização que nunca editou não tem
-- registro aqui, e imprime o padrão do código. A tabela guarda a DIFERENÇA,
-- não o texto de todo mundo — copiar o padrão para dentro de cada organização
-- na criação da conta congelaria em cada uma a versão do dia em que ela
-- entrou, e uma correção de redação nunca mais alcançaria ninguém.
-- ============================================================================

create table if not exists public.termos_consentimento (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  -- As três partes de prosa. O cabeçalho, o parágrafo de abertura e as linhas
  -- de assinatura não estão aqui de propósito: são montados com o cadastro
  -- (nome do paciente, nome e logo do local, cidade) e é por serem montados
  -- que já saem sozinhos na ficha e no termo. Editáveis à mão, passariam a
  -- mentir no dia em que o cadastro mudasse.
  itens text[] not null check (cardinality(itens) > 0),
  riscos text[] not null check (cardinality(riscos) > 0),
  autorizacao text not null check (length(btrim(autorizacao)) > 0),
  criado_em timestamptz not null default now(),
  -- Quem escreveu. `set null` porque a pessoa pode sair da organização, e a
  -- versão do termo não pode sair junto — ela ainda é o texto de documentos
  -- assinados.
  criado_por uuid references public.perfis(id) on delete set null
);

comment on table public.termos_consentimento is
  'Versões do termo de consentimento de cada organização. Append-only: cada edição insere uma linha, nenhuma é alterada ou removida, e a impressão escolhe pela data de conclusão da avaliação. Sem linha nenhuma = usa o texto padrão do código.';

-- A consulta da impressão é sempre "as versões desta organização, da mais
-- recente para a mais antiga".
create index if not exists termos_consentimento_por_organizacao
  on public.termos_consentimento (institution_id, criado_em desc);

alter table public.termos_consentimento enable row level security;

-- LER: qualquer pessoa ativa da organização. Quem imprime o termo é o
-- anestesiologista, não o administrador — uma leitura restrita a admin faria
-- toda ficha sair com o texto de fábrica justamente na organização que o
-- editou, e ninguém entenderia por quê.
drop policy if exists "equipe_le_o_termo" on public.termos_consentimento;
create policy "equipe_le_o_termo"
on public.termos_consentimento for select to authenticated
using (institution_id = public.current_institution_id());

-- ESCREVER: só proprietário e administrador. É documento jurídico da
-- organização, e a responsabilidade por ele é de quem responde por ela.
drop policy if exists "admin_versiona_o_termo" on public.termos_consentimento;
create policy "admin_versiona_o_termo"
on public.termos_consentimento for insert to authenticated
with check (institution_id = public.current_institution_id()
            and public.current_app_role() in ('admin','owner')
            and criado_por = auth.uid());

-- Nem update nem delete existem como política, e também não existem como
-- permissão. Ver o cabeçalho: uma versão alterada muda um documento que já foi
-- assinado.
revoke update, delete on public.termos_consentimento from authenticated, anon;

-- TRUNCATE junto, e não é excesso de zelo: TRUNCATE NÃO PASSA PELO RLS. As
-- políticas acima recusariam linha por linha, mas um TRUNCATE levaria a tabela
-- inteira sem consultar nenhuma delas — e aqui a tabela inteira é o texto de
-- documentos assinados. O default do Supabase concede TRUNCATE a `anon` e a
-- `authenticated` em toda tabela nova; numa tabela que só cresce, ele não tem
-- por que existir.
revoke truncate on public.termos_consentimento from authenticated, anon;
