-- ============================================================================
-- Planos comerciais e campanha de lançamento
--
-- Cuidado com o nome das colunas: "instituicoes.plano" já existia e guarda a
-- SITUAÇÃO da assinatura (trial, ativo, suspenso, cancelado, cortesia). O plano
-- comercial contratado — Solo, Equipe 5, Clínica... — entra em "plano_codigo".
-- Renomear a coluna antiga arrastaria dezenas de policies e meia dúzia de
-- funções vivas em produção, então as duas convivem.
--
-- Preço é dado congelado. O que o cliente contratou fica gravado em
-- preco_contratado e nenhuma rotina automática mexe nisso depois: reajuste de
-- tabela vale para quem assinar daqui em diante, nunca para quem já assinou.
-- É isso que sustenta a promessa do preço de fundador.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Catálogo
-- ----------------------------------------------------------------------------
create table if not exists public.planos (
  codigo text primary key,
  nome text not null,
  descricao text not null default '',
  -- Nulo quer dizer "sob consulta": é assim que o Hospital não mostra preço.
  preco_mensal numeric(10,2),
  min_profissionais integer not null default 1,
  -- Nulo quer dizer ilimitado.
  max_profissionais integer,
  destaque boolean not null default false,
  sob_consulta boolean not null default false,
  ordem integer not null default 0,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.planos
  (codigo, nome, descricao, preco_mensal, min_profissionais, max_profissionais,
   destaque, sob_consulta, ordem)
values
  ('solo','Solo','1 anestesiologista',109.00,1,1,true,false,1),
  ('equipe5','Equipe 5','Até 5 anestesiologistas',399.00,1,5,false,false,2),
  ('grupo','Grupo','De 6 a 20 anestesiologistas',999.00,6,20,false,false,4),
  ('clinica','Clínica','Anestesiologistas ilimitados, recepção, financeiro, administração e gestão completa da clínica',1490.00,1,null,false,false,5),
  ('hospital','Hospital','Estrutura hospitalar completa, sob medida',null,1,null,false,true,6)
on conflict (codigo) do nothing;

-- A faixa intermediária (Equipe 8, R$ 599) saiu: de 6 anestesiologistas em
-- diante já é Grupo. O ajuste vem como update além do seed porque o insert
-- acima é "do nothing" — num banco onde a versão anterior já rodou, só o
-- update corrige. Fica inativo em vez de apagado: instituicoes.plano_codigo
-- referencia esta tabela, e apagar quebraria quem já tivesse contratado.
update public.planos set ativo = false, updated_at = now()
where codigo = 'equipe8';
update public.planos
set min_profissionais = 6, descricao = 'De 6 a 20 anestesiologistas', updated_at = now()
where codigo = 'grupo';

-- ----------------------------------------------------------------------------
-- Campanha de lançamento
--
-- Uma linha só. O check em id garante isso: não existe segunda campanha ativa
-- por acidente, e a tela administrativa sempre edita a mesma linha.
-- ----------------------------------------------------------------------------
create table if not exists public.campanha_fundador (
  id boolean primary key default true check (id),
  ativa boolean not null default true,
  limite integer not null default 100 check (limite >= 0),
  preco numeric(10,2) not null default 89.00 check (preco >= 0),
  plano_codigo text not null default 'solo' references public.planos(codigo),
  rotulo text not null default 'Preço Fundador',
  updated_at timestamptz not null default now()
);

insert into public.campanha_fundador (id) values (true) on conflict (id) do nothing;

-- O catálogo e o estado da campanha são informação de vitrine: a página de
-- planos é pública e precisa lê-los sem login. Escrever, ninguém — não há
-- policy de insert/update/delete, só as funções de super-admin lá embaixo.
alter table public.planos enable row level security;
alter table public.campanha_fundador enable row level security;

drop policy if exists planos_leitura_publica on public.planos;
create policy planos_leitura_publica on public.planos for select using (true);

drop policy if exists campanha_leitura_publica on public.campanha_fundador;
create policy campanha_leitura_publica on public.campanha_fundador for select using (true);

grant select on public.planos to anon, authenticated;
grant select on public.campanha_fundador to anon, authenticated;

-- ----------------------------------------------------------------------------
-- O que cada organização contratou
-- ----------------------------------------------------------------------------
alter table public.instituicoes
  add column if not exists plano_codigo text references public.planos(codigo),
  add column if not exists preco_contratado numeric(10,2),
  add column if not exists contratado_em timestamptz,
  add column if not exists preco_fundador boolean not null default false,
  add column if not exists max_profissionais integer,
  -- Marca permanente de quem cancelou sendo fundador. A vaga volta para o
  -- bolo e outra pessoa pode ocupá-la, mas quem cancelou não entra na
  -- campanha de novo — nem agora, nem numa campanha futura.
  --
  -- Se um dia for preciso desfazer (cobrança contestada, cancelamento por
  -- engano), o caminho é o SQL Editor do Supabase: lá auth.uid() é nulo e o
  -- gatilho de proteção deixa passar.
  --   update instituicoes set fundador_perdido = false where id = '...';
  add column if not exists fundador_perdido boolean not null default false;

create index if not exists instituicoes_fundador_idx
  on public.instituicoes (preco_fundador) where preco_fundador;

-- ----------------------------------------------------------------------------
-- Vagas da campanha
--
-- Uma vaga está ocupada quando a organização é fundadora e ou já pagou (plano
-- ativo) ou acabou de abrir o checkout. A janela de 24 h existe para que um
-- checkout abandonado devolva a vaga em vez de segurá-la para sempre — sem
-- ela, cem cliques sem pagamento fechariam a campanha.
-- ----------------------------------------------------------------------------
create or replace function public.fundadoras_ocupadas(p_excluir uuid default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.instituicoes i
  where i.preco_fundador
    and i.plano <> 'cancelado'
    and (p_excluir is null or i.id <> p_excluir)
    and (i.plano = 'ativo' or i.contratado_em > now() - interval '24 hours');
$$;

create or replace function public.vagas_fundador()
returns table (
  ativa boolean, limite integer, ocupadas integer, restantes integer,
  preco numeric, preco_padrao numeric, rotulo text, plano_codigo text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.ativa,
    c.limite,
    public.fundadoras_ocupadas(),
    greatest(0, c.limite - public.fundadoras_ocupadas()),
    c.preco,
    p.preco_mensal,
    c.rotulo,
    c.plano_codigo
  from public.campanha_fundador c
  join public.planos p on p.codigo = c.plano_codigo;
$$;

-- Quanto custa hoje, para quem ainda vai assinar. Enquanto sobrar vaga, o
-- plano da campanha sai pelo preço de lançamento; depois, pelo preço de tabela.
create or replace function public.preco_vigente(p_codigo text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.ativa
     and c.plano_codigo = p.codigo
     and public.fundadoras_ocupadas() < c.limite then c.preco
    else p.preco_mensal
  end
  from public.planos p
  cross join public.campanha_fundador c
  where p.codigo = p_codigo;
$$;

-- O plano mais barato que comporta a equipe de hoje. Serve para a tela de
-- assinatura sugerir algo em vez de mostrar um preço zerado.
create or replace function public.plano_sugerido(p_institution_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.codigo
  from public.planos p
  where p.ativo
    and not p.sob_consulta
    and public.contar_profissionais(p_institution_id)
        between p.min_profissionais and coalesce(p.max_profissionais, 2147483647)
  order by p.preco_mensal
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- Reserva do plano
--
-- Chamada pelo checkout com a chave de serviço, antes de abrir o Mercado Pago.
-- É aqui que o preço é decidido e congelado — o navegador nunca manda valor.
-- ----------------------------------------------------------------------------
create or replace function public.reservar_plano(p_institution_id uuid, p_codigo text)
returns table (preco numeric, fundador boolean, max_profissionais integer, plano_nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano public.planos%rowtype;
  v_campanha public.campanha_fundador%rowtype;
  v_preco numeric;
  v_fundador boolean := false;
  v_era_fundador boolean;
  v_perdido boolean;
  v_situacao text;
  v_preco_antigo numeric;
  v_profissionais integer;
begin
  select * into v_plano from public.planos where codigo = p_codigo and ativo;
  if not found then
    raise exception 'Plano indisponível';
  end if;
  if v_plano.sob_consulta then
    raise exception 'O plano % é contratado por proposta. Fale com o AVANEST.', v_plano.nome;
  end if;

  v_profissionais := public.contar_profissionais(p_institution_id);
  if v_plano.max_profissionais is not null and v_profissionais > v_plano.max_profissionais then
    raise exception 'A organização tem % anestesiologista(s) e o plano % atende até %.',
      v_profissionais, v_plano.nome, v_plano.max_profissionais;
  end if;

  v_preco := v_plano.preco_mensal;

  -- Trava a campanha antes de contar. Duas contratações simultâneas na última
  -- vaga precisam entrar em fila: sem o for update as duas leem "resta 1" e as
  -- duas viram fundadoras.
  select * into v_campanha from public.campanha_fundador where id for update;

  select i.preco_fundador, i.fundador_perdido, i.plano, i.preco_contratado
    into v_era_fundador, v_perdido, v_situacao, v_preco_antigo
  from public.instituicoes i
  where i.id = p_institution_id
  for update;

  if not found then
    raise exception 'Organização não encontrada';
  end if;

  if coalesce(v_perdido, false) then
    -- Cancelou sendo fundador: está fora da campanha para sempre, mesmo que
    -- ainda sobre vaga. Paga o preço de tabela. O ramo vem primeiro de
    -- propósito, para nenhum dos outros dois conseguir devolver o benefício.
    null;

  elsif coalesce(v_era_fundador, false)
     and v_situacao <> 'cancelado'
     and p_codigo = v_campanha.plano_codigo then
    -- Fundador que não cancelou mantém o preço para sempre, mesmo com a
    -- campanha encerrada. É a promessa da oferta de lançamento.
    v_fundador := true;
    v_preco := coalesce(v_preco_antigo, v_campanha.preco);

  elsif v_campanha.ativa
    and v_campanha.plano_codigo = p_codigo
    and public.fundadoras_ocupadas(p_institution_id) < v_campanha.limite then
    v_fundador := true;
    v_preco := v_campanha.preco;
  end if;

  update public.instituicoes
  set plano_codigo = p_codigo,
      preco_contratado = v_preco,
      contratado_em = now(),
      preco_fundador = v_fundador,
      max_profissionais = v_plano.max_profissionais,
      updated_at = now()
  where id = p_institution_id;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (p_institution_id, auth.uid(), 'instituicao', p_institution_id, 'plano_reservado',
    jsonb_build_object('plano', p_codigo, 'preco', v_preco, 'fundador', v_fundador));

  return query select v_preco, v_fundador, v_plano.max_profissionais, v_plano.nome;
end;
$$;

-- ----------------------------------------------------------------------------
-- Limite de assentos
--
-- Trigger em vez de checagem dentro de aceitar_convite: assim vale para todo
-- caminho que crie ou reative um anestesiologista, inclusive o painel de
-- administração. Organização sem plano marcado tem max_profissionais nulo e
-- segue sem limite — é o caso das que já existiam antes da tabela de preços.
-- ----------------------------------------------------------------------------
create or replace function public.limita_assentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_limite integer; v_atuais integer;
begin
  -- Só ocupa assento quem é anestesiologista: perfil ativo com CRM.
  if new.status <> 'ativo' or coalesce(trim(new.crm), '') = '' then
    return new;
  end if;

  -- Update que não mexe na condição de assento não precisa reconferir, senão
  -- trocar o telefone de alguém falharia numa organização já no limite.
  if tg_op = 'UPDATE'
     and old.status = 'ativo'
     and coalesce(trim(old.crm), '') <> ''
     and old.institution_id = new.institution_id then
    return new;
  end if;

  if public.e_super_admin() then
    return new;
  end if;

  select i.max_profissionais into v_limite
  from public.instituicoes i where i.id = new.institution_id;
  if v_limite is null then
    return new;
  end if;

  select count(*)::integer into v_atuais
  from public.perfis p
  where p.institution_id = new.institution_id
    and p.status = 'ativo'
    and coalesce(trim(p.crm), '') <> ''
    and p.id <> new.id;

  if v_atuais >= v_limite then
    raise exception
      'O plano contratado atende até % anestesiologista(s) e a organização já tem %. Amplie o plano para incluir mais alguém.',
      v_limite, v_atuais;
  end if;

  return new;
end;
$$;

drop trigger if exists limita_assentos on public.perfis;
create trigger limita_assentos
  before insert or update on public.perfis
  for each row execute function public.limita_assentos();

-- ----------------------------------------------------------------------------
-- As colunas novas também decidem dinheiro: entram na proteção.
--
-- Sem isto, um admin qualquer rodaria "update instituicoes set
-- preco_contratado = 1, preco_fundador = true" pela API e pagaria um real.
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
    -- Organização nova sempre nasce em teste grátis de 14 dias, sem plano
    -- contratado e sem preço congelado.
    new.plano := 'trial';
    new.assinatura_ate := now() + interval '14 days';
    new.valor_por_profissional := 49.99;
    new.mp_assinatura_id := null;
    new.plano_codigo := null;
    new.preco_contratado := null;
    new.contratado_em := null;
    new.preco_fundador := false;
    new.max_profissionais := null;
    new.fundador_perdido := false;
    return new;
  end if;

  new.plano := old.plano;
  new.assinatura_ate := old.assinatura_ate;
  new.valor_por_profissional := old.valor_por_profissional;
  new.mp_assinatura_id := old.mp_assinatura_id;
  new.plano_codigo := old.plano_codigo;
  new.preco_contratado := old.preco_contratado;
  new.contratado_em := old.contratado_em;
  new.preco_fundador := old.preco_fundador;
  new.max_profissionais := old.max_profissionais;
  new.fundador_perdido := old.fundador_perdido;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Situação da assinatura de quem está logado
--
-- O tipo de retorno mudou, então a função precisa ser derrubada antes: um
-- "create or replace" com colunas novas é recusado pelo Postgres.
-- ----------------------------------------------------------------------------
drop function if exists public.minha_assinatura();
create or replace function public.minha_assinatura()
returns table (
  organizacao text, plano text, assinatura_ate timestamptz,
  dias_restantes integer, profissionais integer, valor_mensal numeric, liberada boolean,
  plano_codigo text, plano_nome text, preco_contratado numeric,
  preco_fundador boolean, max_profissionais integer, contratado_em timestamptz
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
    -- Já contratou: vale o preço congelado. Ainda não: o preço de hoje do
    -- plano que comporta a equipe atual.
    coalesce(i.preco_contratado, public.preco_vigente(public.plano_sugerido(i.id)), 0),
    case
      when i.plano in ('suspenso','cancelado') then false
      when i.assinatura_ate is null then true
      else i.assinatura_ate > now()
    end,
    coalesce(i.plano_codigo, public.plano_sugerido(i.id)),
    (select p.nome from public.planos p
      where p.codigo = coalesce(i.plano_codigo, public.plano_sugerido(i.id))),
    i.preco_contratado,
    i.preco_fundador,
    i.max_profissionais,
    i.contratado_em
  from public.instituicoes i
  join public.perfis p on p.institution_id = i.id
  where p.id = auth.uid() and p.status = 'ativo';
$$;

-- ----------------------------------------------------------------------------
-- Visão do administrador do AVANEST
-- ----------------------------------------------------------------------------
drop function if exists public.listar_organizacoes();
create or replace function public.listar_organizacoes()
returns table (
  id uuid, nome text, tipo text, plano text, assinatura_ate timestamptz,
  profissionais integer, usuarios integer, valor_mensal numeric,
  pacientes integer, avaliacoes integer, criada_em timestamptz,
  plano_codigo text, plano_nome text, preco_fundador boolean,
  max_profissionais integer, contratado_em timestamptz, fundador_perdido boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.perfis sa
    where sa.id = auth.uid() and sa.super_admin and sa.status = 'ativo'
  ) then
    raise exception 'Sem permissão';
  end if;
  return query
  select i.id, i.nome, i.tipo, i.plano, i.assinatura_ate,
    public.contar_profissionais(i.id),
    (select count(*)::integer from public.perfis p where p.institution_id = i.id and p.status = 'ativo'),
    -- A receita da organização é o que ela contratou. Só quem nunca escolheu
    -- plano cai na conta antiga, por cabeça, para a linha não zerar.
    coalesce(i.preco_contratado, round(public.contar_profissionais(i.id) * i.valor_por_profissional, 2)),
    (select count(*)::integer from public.pacientes x where x.institution_id = i.id),
    (select count(*)::integer from public.avaliacoes x where x.institution_id = i.id),
    i.created_at,
    i.plano_codigo,
    (select pl.nome from public.planos pl where pl.codigo = i.plano_codigo),
    i.preco_fundador,
    i.max_profissionais,
    i.contratado_em,
    i.fundador_perdido
  from public.instituicoes i
  order by i.created_at;
end;
$$;

-- ----------------------------------------------------------------------------
-- Administração da tabela de preços e da campanha
--
-- Tudo por função com checagem de super-admin por dentro: as tabelas não têm
-- policy de escrita, então este é o único caminho a partir do navegador.
-- A auditoria é registrada na organização de quem mexeu, porque
-- auditoria.institution_id não aceita nulo.
-- ----------------------------------------------------------------------------
create or replace function public.definir_preco_plano(
  p_codigo text, p_preco numeric default null, p_ativo boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid;
begin
  if not public.e_super_admin() then
    raise exception 'Sem permissão';
  end if;
  if p_preco is not null and p_preco < 0 then
    raise exception 'Preço inválido';
  end if;

  update public.planos
  set preco_mensal = coalesce(p_preco, preco_mensal),
      ativo = coalesce(p_ativo, ativo),
      updated_at = now()
  where codigo = p_codigo;
  if not found then
    raise exception 'Plano não encontrado';
  end if;

  select institution_id into v_org from public.perfis where id = auth.uid();
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_org, auth.uid(), 'plano', null, 'preco_alterado',
    jsonb_build_object('plano', p_codigo, 'preco', p_preco, 'ativo', p_ativo));
end;
$$;

create or replace function public.configurar_campanha(
  p_ativa boolean default null,
  p_limite integer default null,
  p_preco numeric default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_org uuid;
begin
  if not public.e_super_admin() then
    raise exception 'Sem permissão';
  end if;
  if p_limite is not null and p_limite < 0 then
    raise exception 'Limite inválido';
  end if;
  if p_preco is not null and p_preco < 0 then
    raise exception 'Preço inválido';
  end if;

  update public.campanha_fundador
  set ativa = coalesce(p_ativa, ativa),
      limite = coalesce(p_limite, limite),
      preco = coalesce(p_preco, preco),
      updated_at = now()
  where id;

  select institution_id into v_org from public.perfis where id = auth.uid();
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_org, auth.uid(), 'campanha', null, 'campanha_alterada',
    jsonb_build_object('ativa', p_ativa, 'limite', p_limite, 'preco', p_preco));
end;
$$;

-- ----------------------------------------------------------------------------
-- Cancelou, perde o preço de fundador e devolve a vaga.
--
-- Fica junto do registro de pagamento porque é o único lugar onde o
-- cancelamento é confirmado pelo Mercado Pago. Se voltar depois, reservar_plano
-- não encontra mais o benefício e cobra o preço vigente.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Permissões
--
-- Lembrete que já custou caro aqui: o Postgres concede EXECUTE ao PUBLIC assim
-- que a função é criada. Revogar só de "anon, authenticated" não tira nada — é
-- o PUBLIC que precisa sair antes de conceder a quem deve.
-- ----------------------------------------------------------------------------

-- Vitrine: a página de planos é pública.
revoke execute on function public.vagas_fundador() from public;
revoke execute on function public.preco_vigente(text) from public;
grant execute on function public.vagas_fundador() to anon, authenticated;
grant execute on function public.preco_vigente(text) to anon, authenticated;

-- Contagem interna e sugestão de plano: só para quem já está logado.
revoke execute on function public.fundadoras_ocupadas(uuid) from public, anon;
revoke execute on function public.plano_sugerido(uuid) from public, anon;
grant execute on function public.fundadoras_ocupadas(uuid) to authenticated, service_role;
grant execute on function public.plano_sugerido(uuid) to authenticated, service_role;

-- Reservar plano decide preço: só a chave de serviço, pelo checkout.
revoke execute on function public.reservar_plano(uuid, text) from public, anon, authenticated;
grant execute on function public.reservar_plano(uuid, text) to service_role;

revoke execute on function public.registrar_pagamento_assinatura(uuid,text,text,text,numeric,numeric,jsonb)
  from public, anon, authenticated;
grant execute on function public.registrar_pagamento_assinatura(uuid,text,text,text,numeric,numeric,jsonb)
  to service_role;

-- Administração da tabela de preços: a checagem de super-admin é por dentro.
revoke execute on function public.definir_preco_plano(text, numeric, boolean) from public, anon;
revoke execute on function public.configurar_campanha(boolean, integer, numeric) from public, anon;
grant execute on function public.definir_preco_plano(text, numeric, boolean) to authenticated;
grant execute on function public.configurar_campanha(boolean, integer, numeric) to authenticated;

revoke execute on function public.minha_assinatura() from public, anon;
revoke execute on function public.listar_organizacoes() from public, anon;
grant execute on function public.minha_assinatura() to authenticated;
grant execute on function public.listar_organizacoes() to authenticated;

-- Gatilhos não são endpoint de ninguém.
revoke execute on function public.limita_assentos() from public, anon, authenticated;
revoke execute on function public.protege_assinatura() from public, anon, authenticated;
