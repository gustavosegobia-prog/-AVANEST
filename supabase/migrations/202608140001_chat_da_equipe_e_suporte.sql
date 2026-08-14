-- ============================================================================
-- Chat da equipe e canal de suporte
--
-- Duas conversas diferentes, com regras diferentes, e por isso duas tabelas
-- em vez de uma com um campo "tipo":
--
--   1. A sala da equipe. Uma por instituição, todo mundo de dentro lê e
--      escreve. É o mural do plantão — "a paciente das 14h chegou", "faltou
--      a guia do convênio". Quem é de outra instituição não vê nada.
--
--   2. Os chamados de suporte. Vão de qualquer usuário para quem cuida do
--      AVANEST, e voltam. Não são da instituição: o colega da mesa ao lado
--      não lê o chamado, porque um relato de problema muitas vezes é uma
--      reclamação, e quem reclama precisa poder falar à vontade.
--
-- O isolamento não depende do navegador em momento nenhum. Toda leitura e
-- toda escrita passam pela RLS, que decide a partir de auth.uid() e do perfil
-- guardado no banco. Um usuário mal-intencionado com a chave pública do
-- projeto não consegue ler a sala de outra clínica nem o chamado de outra
-- pessoa.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Quem é do suporte
--
-- Já existe a coluna super_admin em perfis, protegida contra escrita pelo
-- próprio usuário. Esta função só a lê, e é o único lugar em que o resto do
-- arquivo pergunta "esta pessoa cuida do AVANEST?".
-- ----------------------------------------------------------------------------
create or replace function public.e_suporte()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select super_admin from public.perfis where id = auth.uid() and status = 'ativo'),
    false
  )
$$;

revoke all on function public.e_suporte() from public, anon;
grant execute on function public.e_suporte() to authenticated;

-- ============================================================================
-- 1. Sala da equipe
-- ============================================================================
create table if not exists public.sala_mensagens (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now(),
  -- O limite não é decoração: sem ele, uma única mensagem colada de um
  -- prontuário inteiro entope a sala e a tela de quem lê no celular.
  constraint sala_mensagens_texto check (char_length(btrim(texto)) between 1 and 2000)
);

-- O índice segue a única consulta que a tela faz: as últimas mensagens desta
-- instituição, da mais nova para a mais velha.
create index if not exists sala_mensagens_recentes
  on public.sala_mensagens (institution_id, created_at desc);

alter table public.sala_mensagens enable row level security;

drop policy if exists "equipe_le_a_propria_sala" on public.sala_mensagens;
create policy "equipe_le_a_propria_sala"
on public.sala_mensagens for select to authenticated
using (institution_id = public.current_institution_id());

-- Escrever exige as duas coisas: ser da instituição e assinar com o próprio
-- nome. Sem a segunda metade, alguém poderia inserir uma mensagem em nome de
-- outra pessoa da mesma equipe.
drop policy if exists "equipe_escreve_na_propria_sala" on public.sala_mensagens;
create policy "equipe_escreve_na_propria_sala"
on public.sala_mensagens for insert to authenticated
with check (
  institution_id = public.current_institution_id()
  and autor_id = auth.uid()
);

-- Apagar, só a própria mensagem. É o conserto de quem colou o dado do
-- paciente errado — e não uma forma de editar o que o outro disse.
drop policy if exists "autor_apaga_a_propria_mensagem" on public.sala_mensagens;
create policy "autor_apaga_a_propria_mensagem"
on public.sala_mensagens for delete to authenticated
using (autor_id = auth.uid() and institution_id = public.current_institution_id());

-- Não existe policy de update de propósito: mensagem publicada não muda de
-- texto. Quem errou apaga e escreve de novo, e a equipe vê que aconteceu.

-- ----------------------------------------------------------------------------
-- Até onde cada pessoa já leu
--
-- Uma linha por usuário. É o que faz o balão do canto mostrar quantas
-- mensagens novas existem sem abrir a conversa.
-- ----------------------------------------------------------------------------
create table if not exists public.sala_leitura (
  perfil_id uuid primary key references public.perfis(id) on delete cascade,
  lido_em timestamptz not null default now()
);

alter table public.sala_leitura enable row level security;

drop policy if exists "cada_um_marca_a_propria_leitura" on public.sala_leitura;
create policy "cada_um_marca_a_propria_leitura"
on public.sala_leitura for all to authenticated
using (perfil_id = auth.uid())
with check (perfil_id = auth.uid());

-- ============================================================================
-- 2. Chamados de suporte
-- ============================================================================
create table if not exists public.chamados (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  aberto_por uuid not null references auth.users(id) on delete cascade,
  assunto text not null,
  status text not null default 'aberto' check (status in ('aberto','respondido','resolvido')),
  created_at timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  -- Quando cada lado olhou a conversa pela última vez. Os dois campos são
  -- escritos pela função marcar_chamado_visto, nunca direto pela tela.
  visto_autor_em timestamptz,
  visto_suporte_em timestamptz,
  constraint chamados_assunto check (char_length(btrim(assunto)) between 3 and 120)
);

-- A fila do suporte é sempre "o que mexeu por último primeiro".
create index if not exists chamados_por_movimento on public.chamados (ultima_em desc);
create index if not exists chamados_por_autor on public.chamados (aberto_por, ultima_em desc);

create table if not exists public.chamado_mensagens (
  id uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now(),
  constraint chamado_mensagens_texto check (char_length(btrim(texto)) between 1 and 4000)
);

create index if not exists chamado_mensagens_do_chamado
  on public.chamado_mensagens (chamado_id, created_at);

alter table public.chamados enable row level security;
alter table public.chamado_mensagens enable row level security;

-- Duas pessoas enxergam um chamado: quem abriu e o suporte. Mais ninguém —
-- nem o administrador da mesma clínica. Um relato de problema costuma ser uma
-- reclamação, e quem reclama precisa poder falar sem plateia.
drop policy if exists "autor_e_suporte_leem_o_chamado" on public.chamados;
create policy "autor_e_suporte_leem_o_chamado"
on public.chamados for select to authenticated
using (aberto_por = auth.uid() or public.e_suporte());

drop policy if exists "usuario_abre_o_proprio_chamado" on public.chamados;
create policy "usuario_abre_o_proprio_chamado"
on public.chamados for insert to authenticated
with check (
  aberto_por = auth.uid()
  and institution_id = public.current_institution_id()
);

-- Só o suporte muda o estado de um chamado. Se o autor pudesse, "resolvido"
-- deixaria de querer dizer alguma coisa.
drop policy if exists "suporte_atualiza_o_chamado" on public.chamados;
create policy "suporte_atualiza_o_chamado"
on public.chamados for update to authenticated
using (public.e_suporte())
with check (public.e_suporte());

drop policy if exists "autor_e_suporte_leem_as_mensagens" on public.chamado_mensagens;
create policy "autor_e_suporte_leem_as_mensagens"
on public.chamado_mensagens for select to authenticated
using (
  exists (
    select 1 from public.chamados c
    where c.id = chamado_mensagens.chamado_id
      and (c.aberto_por = auth.uid() or public.e_suporte())
  )
);

drop policy if exists "autor_e_suporte_respondem" on public.chamado_mensagens;
create policy "autor_e_suporte_respondem"
on public.chamado_mensagens for insert to authenticated
with check (
  autor_id = auth.uid()
  and exists (
    select 1 from public.chamados c
    where c.id = chamado_mensagens.chamado_id
      and (c.aberto_por = auth.uid() or public.e_suporte())
  )
);

-- ----------------------------------------------------------------------------
-- Cada mensagem move o chamado
--
-- O gatilho existe para que o estado do chamado seja consequência das
-- mensagens, e não um campo que a tela precisa lembrar de atualizar junto.
-- Uma tela que esquece deixa um chamado respondido parecendo aberto.
--
-- É security definer porque quem escreve não tem permissão de update em
-- chamados: o autor responde à própria conversa, mas quem carimba
-- "respondido" é o banco.
-- ----------------------------------------------------------------------------
create or replace function public.chamado_ao_receber_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_do_suporte boolean;
begin
  select coalesce(p.super_admin, false) into v_do_suporte
    from public.perfis p where p.id = new.autor_id;

  update public.chamados
     set ultima_em = new.created_at,
         -- Resposta do suporte fecha o ciclo; qualquer palavra do usuário
         -- reabre, inclusive num chamado já dado como resolvido.
         status = case when v_do_suporte then 'respondido' else 'aberto' end
   where id = new.chamado_id;

  return new;
end;
$$;

drop trigger if exists chamado_movimenta on public.chamado_mensagens;
create trigger chamado_movimenta
after insert on public.chamado_mensagens
for each row execute function public.chamado_ao_receber_mensagem();

-- ----------------------------------------------------------------------------
-- Abrir um chamado
--
-- Assunto e primeira mensagem entram juntos: um chamado sem texto não é um
-- relato, é uma linha vazia na fila. Fazer isso em duas chamadas da tela
-- deixaria essa linha vazia para trás sempre que a segunda falhasse.
-- ----------------------------------------------------------------------------
create or replace function public.abrir_chamado(p_assunto text, p_texto text)
returns public.chamados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.perfis;
  v_chamado public.chamados;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null then
    raise exception 'Sem permissão';
  end if;

  if char_length(btrim(coalesce(p_assunto,''))) < 3 then
    raise exception 'Escreva um assunto com pelo menos 3 letras';
  end if;
  if char_length(btrim(coalesce(p_texto,''))) < 1 then
    raise exception 'Escreva o que aconteceu';
  end if;

  insert into public.chamados (institution_id, aberto_por, assunto, visto_autor_em)
  values (v_perfil.institution_id, auth.uid(), btrim(p_assunto), now())
  returning * into v_chamado;

  insert into public.chamado_mensagens (chamado_id, autor_id, texto)
  values (v_chamado.id, auth.uid(), btrim(p_texto));

  return v_chamado;
end;
$$;

revoke all on function public.abrir_chamado(text,text) from public, anon;
grant execute on function public.abrir_chamado(text,text) to authenticated;

-- ----------------------------------------------------------------------------
-- Marcar um chamado como visto
--
-- Cada lado tem a sua coluna, e a função escolhe qual pelo quem-está-chamando
-- em vez de aceitar isso como parâmetro. Se fosse parâmetro, o autor poderia
-- carimbar a coluna do suporte e a fila do suporte esvaziaria sozinha.
-- ----------------------------------------------------------------------------
create or replace function public.marcar_chamado_visto(p_chamado_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chamado public.chamados;
begin
  select * into v_chamado from public.chamados where id = p_chamado_id;
  if v_chamado.id is null then
    return;
  end if;

  if public.e_suporte() then
    update public.chamados set visto_suporte_em = now() where id = p_chamado_id;
  elsif v_chamado.aberto_por = auth.uid() then
    update public.chamados set visto_autor_em = now() where id = p_chamado_id;
  end if;
end;
$$;

revoke all on function public.marcar_chamado_visto(uuid) from public, anon;
grant execute on function public.marcar_chamado_visto(uuid) to authenticated;

-- ============================================================================
-- Tempo real
--
-- Sem isto a conversa só apareceria na próxima vez que a tela perguntasse ao
-- banco, e um chat que demora meio minuto para mostrar a resposta não é usado
-- duas vezes. A RLS continua valendo aqui: o Realtime do Supabase aplica as
-- mesmas policies antes de entregar cada linha, então ninguém recebe pelo
-- socket o que não poderia ler pela consulta.
-- ============================================================================
alter publication supabase_realtime add table public.sala_mensagens;
alter publication supabase_realtime add table public.chamado_mensagens;
alter publication supabase_realtime add table public.chamados;

-- ============================================================================
-- Leituras prontas para a tela
--
-- A tela precisa de nomes, e nome não é uma coisa que ela possa buscar
-- sozinha: a RLS de perfis é por instituição, então quem cuida do AVANEST não
-- consegue ler o nome de quem abriu um chamado em outra clínica — e nem
-- deveria, por uma consulta solta. As funções abaixo resolvem o nome dentro do
-- banco e devolvem só o que aquela pessoa pode ver, sem abrir a tabela de
-- perfis para ninguém.
-- ============================================================================

create or replace function public.sala_conversa(p_limite int default 80)
returns table (
  id uuid,
  texto text,
  created_at timestamptz,
  autor_id uuid,
  autor_nome text,
  autor_papel text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.texto, m.created_at, m.autor_id,
         coalesce(p.nome, 'Usuário removido'), coalesce(p.role, '')
    from public.sala_mensagens m
    left join public.perfis p on p.id = m.autor_id
   where m.institution_id = public.current_institution_id()
   order by m.created_at desc
   limit greatest(1, least(coalesce(p_limite, 80), 200))
$$;

revoke all on function public.sala_conversa(int) from public, anon;
grant execute on function public.sala_conversa(int) to authenticated;

-- Quantas mensagens da sala chegaram depois da última vez que esta pessoa
-- olhou. As dela mesma não contam: ninguém tem recado novo de si próprio.
create or replace function public.sala_nao_lidas()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.sala_mensagens m
   where m.institution_id = public.current_institution_id()
     and m.autor_id <> auth.uid()
     and m.created_at > coalesce(
       (select l.lido_em from public.sala_leitura l where l.perfil_id = auth.uid()),
       '-infinity'::timestamptz
     )
$$;

revoke all on function public.sala_nao_lidas() from public, anon;
grant execute on function public.sala_nao_lidas() to authenticated;

-- A lista de chamados que a pessoa pode ver: os seus, se for usuário; todos,
-- se for o suporte. É a mesma função para os dois porque a diferença está em
-- quem chama, não no que a tela pede — e uma tela que escolhe entre "listar os
-- meus" e "listar todos" é uma tela que pode escolher errado.
create or replace function public.chamados_visiveis()
returns table (
  id uuid,
  assunto text,
  status text,
  created_at timestamptz,
  ultima_em timestamptz,
  autor_nome text,
  clinica text,
  sou_o_autor boolean,
  nao_lidas integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.assunto, c.status, c.created_at, c.ultima_em,
         coalesce(p.nome, 'Usuário removido'),
         coalesce(i.nome, '—'),
         c.aberto_por = auth.uid(),
         (select count(*)::int
            from public.chamado_mensagens m
           where m.chamado_id = c.id
             and m.autor_id <> auth.uid()
             and m.created_at > coalesce(
               case when public.e_suporte() then c.visto_suporte_em else c.visto_autor_em end,
               '-infinity'::timestamptz))
    from public.chamados c
    left join public.perfis p on p.id = c.aberto_por
    left join public.instituicoes i on i.id = c.institution_id
   where c.aberto_por = auth.uid() or public.e_suporte()
   order by c.ultima_em desc
   limit 200
$$;

revoke all on function public.chamados_visiveis() from public, anon;
grant execute on function public.chamados_visiveis() to authenticated;

create or replace function public.chamado_conversa(p_chamado_id uuid)
returns table (
  id uuid,
  texto text,
  created_at timestamptz,
  autor_nome text,
  do_suporte boolean,
  sou_eu boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.texto, m.created_at,
         case when coalesce(p.super_admin, false) then 'Suporte AVANEST'
              else coalesce(p.nome, 'Usuário removido') end,
         coalesce(p.super_admin, false),
         m.autor_id = auth.uid()
    from public.chamado_mensagens m
    join public.chamados c on c.id = m.chamado_id
    left join public.perfis p on p.id = m.autor_id
   where m.chamado_id = p_chamado_id
     and (c.aberto_por = auth.uid() or public.e_suporte())
   order by m.created_at
$$;

revoke all on function public.chamado_conversa(uuid) from public, anon;
grant execute on function public.chamado_conversa(uuid) to authenticated;
