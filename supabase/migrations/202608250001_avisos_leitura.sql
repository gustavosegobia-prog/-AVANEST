-- ===========================================================================
-- Quando você olhou a caixa de avisos pela última vez
-- ===========================================================================
-- Uma linha por pessoa, com um carimbo de tempo. É tudo.
--
-- Não existe tabela de notificações neste sistema, e é de propósito. Os avisos
-- são derivados das tabelas que já guardam a verdade: uma troca pendente é um
-- aviso porque está pendente, e deixa de ser no instante em que alguém
-- responde — sem ninguém precisar apagar nada. Uma tabela de avisos exigiria
-- que todo lugar que cria um fato lembrasse de inserir a cópia dele, e o
-- primeiro que esquecesse produziria um plantão oferecido sem aviso nenhum:
-- um defeito que não dá erro, só não avisa.
--
-- O que a derivação não resolve sozinha é "eu já vi isso". O que PEDE resposta
-- não precisa de marcador — some quando você responde. Já "o Matheus assumiu
-- seu plantão" é notícia: se ninguém marcar, fica para sempre. É só para essa
-- metade que esta tabela existe.
--
-- Mesma forma de sala_leitura, que faz o mesmo papel para o chat. Duas tabelas
-- de uma coluna, e não uma tabela genérica de marcadores: a genérica pediria
-- uma coluna "tipo" e um check para dizer quais tipos valem, o que é mais
-- código para guardar exatamente a mesma informação.
-- ===========================================================================

create table if not exists public.avisos_leitura (
  perfil_id uuid primary key references public.perfis(id) on delete cascade,
  lido_em timestamptz not null default now()
);

comment on table public.avisos_leitura is
  'Quando cada pessoa abriu a caixa de avisos. Só as notícias dependem disto; o que pede resposta some ao ser respondido.';

alter table public.avisos_leitura enable row level security;

-- Cada um marca a própria leitura, e ninguém lê a de ninguém. Não há caso de
-- uso para o administrador saber quando o colega olhou os avisos, e a coluna
-- responderia "quando esta pessoa esteve online pela última vez" — que é
-- vigilância de equipe, não funcionalidade de escala.
drop policy if exists "cada_um_marca_os_proprios_avisos" on public.avisos_leitura;
create policy "cada_um_marca_os_proprios_avisos"
on public.avisos_leitura for all to authenticated
using (perfil_id = auth.uid())
with check (perfil_id = auth.uid());
