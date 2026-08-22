-- Preço por profissional, no lugar de preço fixo por faixa.
--
-- Por que mudou. A tabela antiga cobrava um valor fechado por faixa: até 5
-- pessoas R$ 399, de 6 a 12 R$ 999. Isso criava um degrau de 150% exatamente
-- entre 5 e 6 anestesiologistas — o grupo de 6 pagava R$ 166,50 por cabeça,
-- mais do que o anestesiologista sozinho pagava por si.
--
-- E criava uma brecha pior: dividir a equipe em duas organizações saía mais
-- barato do que usar o produto direito. Um grupo de 6 economizava R$ 491 por
-- mês abrindo uma conta "Equipe 5" e uma "Solo". Economizava justamente
-- desmontando o que o plano de grupo vende — equipe junta, chat, auditoria
-- compartilhada. A tabela empurrava o cliente para o pior uso do sistema.
--
-- Com preço por profissional o degrau some, o total sobe sempre que entra
-- alguém, e dividir nunca compensa. Conferido de 1 a 30 pessoas, em todas as
-- divisões possíveis.
--
-- O Solo continua com preço fechado porque uma pessoa não é uma faixa: é o
-- ponto de entrada, e R$ 99 lê melhor do que "R$ 99 por profissional" para
-- quem é um só.

-- ---------------------------------------------------------------------------
-- 1. A coluna nova
-- ---------------------------------------------------------------------------
alter table public.planos
  add column if not exists preco_por_profissional numeric(10,2)
    check (preco_por_profissional is null or preco_por_profissional >= 0);

comment on column public.planos.preco_por_profissional is
  'Valor por anestesiologista ativo. Quando preenchido, manda no preço e o preco_mensal passa a ser só piso.';
comment on column public.planos.preco_mensal is
  'Valor fechado do plano. Nos planos por profissional, funciona como piso mínimo da fatura.';

-- ---------------------------------------------------------------------------
-- 2. A tabela nova
-- ---------------------------------------------------------------------------
-- Solo: 1 pessoa, R$ 99 fechado.
update public.planos
   set preco_mensal = 99.00,
       preco_por_profissional = null,
       min_profissionais = 1, max_profissionais = 1,
       nome = 'Solo', descricao = '1 anestesiologista',
       ativo = true, ordem = 1, updated_at = now()
 where codigo = 'solo';

-- Equipe: 2 a 5, R$ 89 cada. O piso de 178 é o valor de duas pessoas — impede
-- que uma organização com um profissional só caia aqui e pague R$ 89.
update public.planos
   set preco_mensal = 178.00,
       preco_por_profissional = 89.00,
       min_profissionais = 2, max_profissionais = 5,
       nome = 'Equipe', descricao = 'De 2 a 5 anestesiologistas',
       ativo = true, ordem = 2, updated_at = now()
 where codigo = 'equipe5';

-- Grupo: 6 a 12, R$ 75 cada. Piso de 450 = seis pessoas.
update public.planos
   set preco_mensal = 450.00,
       preco_por_profissional = 75.00,
       min_profissionais = 6, max_profissionais = 12,
       nome = 'Grupo', descricao = 'De 6 a 12 anestesiologistas',
       ativo = true, ordem = 3, updated_at = now()
 where codigo = 'grupo';

-- Clínica: 13 ou mais, R$ 70 cada. Piso de 910 = treze pessoas.
--
-- Os R$ 70 são de propósito maiores do que a conta "linear" pediria: com 12
-- pessoas o Grupo custa R$ 900, e treze a R$ 65 dariam R$ 845 — a fatura
-- CAIRIA ao entrar mais um. A R$ 70, treze custam R$ 910 e a curva continua
-- subindo.
update public.planos
   set preco_mensal = 910.00,
       preco_por_profissional = 70.00,
       min_profissionais = 13, max_profissionais = null,
       nome = 'Clínica',
       descricao = '13 ou mais anestesiologistas, com recepção, financeiro e administração',
       ativo = true, ordem = 4, sob_consulta = false, updated_at = now()
 where codigo = 'clinica';

-- Hospital sai da vitrine. Não é delete: instituicoes.plano_codigo referencia
-- esta tabela, e apagar quebraria quem já tivesse contratado.
update public.planos set ativo = false, updated_at = now() where codigo = 'hospital';

-- ---------------------------------------------------------------------------
-- 3. A campanha deixa de ser de preço e passa a ser de tempo
-- ---------------------------------------------------------------------------
-- Descontar preço empatava com o concorrente que cobra R$ 89,90 de tabela, e
-- ainda travava o valor para sempre. Dar meses grátis custa uma vez, cria
-- urgência de verdade e devolve o direito de reajustar depois.
alter table public.campanha_fundador
  add column if not exists meses_gratis integer not null default 0
    check (meses_gratis between 0 and 12),
  add column if not exists termina_em date;

comment on column public.campanha_fundador.meses_gratis is
  'Meses sem cobrança para quem contratar durante a campanha. A data do primeiro vencimento no gateway sai daqui.';
comment on column public.campanha_fundador.termina_em is
  'Último dia da campanha. Nulo = sem prazo, só o limite de vagas.';

update public.campanha_fundador
   set ativa = true,
       meses_gratis = 2,
       termina_em = date '2026-10-31',
       -- Sem limite de vagas: a campanha agora fecha por data.
       limite = 2147483647,
       rotulo = '2 meses grátis',
       -- preco deixa de ser usado como desconto; fica com o valor do Solo para
       -- não sobrar um número antigo mentindo dentro da tabela.
       preco = 99.00,
       updated_at = now()
 where id;

-- ---------------------------------------------------------------------------
-- 4. vagas_fundador passa a considerar a data
-- ---------------------------------------------------------------------------
create or replace function public.vagas_fundador()
returns table (ativa boolean, limite integer, ocupadas integer, restantes integer,
               preco numeric, plano_codigo text, rotulo text,
               meses_gratis integer, termina_em date)
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Campanha com data vencida não está ativa, mesmo com a flag ligada.
    c.ativa and (c.termina_em is null or c.termina_em >= current_date),
    c.limite,
    public.fundadoras_ocupadas(),
    greatest(0, c.limite - public.fundadoras_ocupadas()),
    c.preco, c.plano_codigo, c.rotulo,
    c.meses_gratis, c.termina_em
  from public.campanha_fundador c
  where c.id;
$$;

revoke all on function public.vagas_fundador() from public;
grant execute on function public.vagas_fundador() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. reservar_plano: multiplica pelo número de profissionais
-- ---------------------------------------------------------------------------
-- Muda três coisas em relação à versão anterior:
--
--   a) o preço passa a ser por profissional, com piso;
--   b) o mínimo de profissionais do plano passa a ser conferido — antes só o
--      máximo era, então uma organização de 1 pessoa conseguia contratar o
--      Grupo e pagar menos do que o Solo;
--   c) a campanha devolve meses grátis em vez de preço travado, e respeita a
--      data de término.
create or replace function public.reservar_plano(p_institution_id uuid, p_codigo text)
returns table (preco numeric, fundador boolean, max_profissionais integer,
               plano_nome text, meses_gratis integer, profissionais integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano public.planos%rowtype;
  v_campanha public.campanha_fundador%rowtype;
  v_preco numeric;
  v_fundador boolean := false;
  v_meses integer := 0;
  v_perdido boolean;
  v_profissionais integer;
  v_campanha_valendo boolean;
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

  -- O mínimo também é regra, e antes não era conferido. Sem isto, uma
  -- organização de uma pessoa contratava a Clínica e pagava o piso de outra
  -- faixa — ou, dependendo dos números, menos do que o Solo.
  if v_plano.min_profissionais is not null and v_profissionais < v_plano.min_profissionais then
    raise exception 'O plano % é para % anestesiologista(s) ou mais, e a organização tem %.',
      v_plano.nome, v_plano.min_profissionais, v_profissionais;
  end if;

  -- Preço: por profissional quando o plano é assim, sempre respeitando o piso.
  if v_plano.preco_por_profissional is not null then
    v_preco := greatest(v_plano.preco_mensal,
                        v_plano.preco_por_profissional * greatest(v_profissionais, 1));
  else
    v_preco := v_plano.preco_mensal;
  end if;

  -- Trava a campanha antes de ler. Duas contratações simultâneas na última
  -- vaga precisam entrar em fila.
  select * into v_campanha from public.campanha_fundador where id for update;

  select i.fundador_perdido into v_perdido
  from public.instituicoes i where i.id = p_institution_id for update;
  if not found then
    raise exception 'Organização não encontrada';
  end if;

  v_campanha_valendo := v_campanha.ativa
    and (v_campanha.termina_em is null or v_campanha.termina_em >= current_date)
    and public.fundadoras_ocupadas(p_institution_id) < v_campanha.limite;

  -- Quem cancelou durante a campanha não volta a ela. O ramo vem primeiro de
  -- propósito, para nenhum outro caminho devolver o benefício.
  if coalesce(v_perdido, false) then
    null;
  elsif v_campanha_valendo then
    v_fundador := true;
    v_meses := v_campanha.meses_gratis;
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
    jsonb_build_object('plano', p_codigo, 'preco', v_preco, 'profissionais', v_profissionais,
                       'fundador', v_fundador, 'meses_gratis', v_meses));

  return query select v_preco, v_fundador, v_plano.max_profissionais,
                      v_plano.nome, v_meses, v_profissionais;
end;
$$;

revoke all on function public.reservar_plano(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. preco_vigente, que é o que a página pública de planos lê
-- ---------------------------------------------------------------------------
-- Sem parâmetro de tamanho de equipe ela não tem como multiplicar, então
-- devolve o piso — que é exatamente o "a partir de" que a tela mostra.
create or replace function public.preco_vigente(p_codigo text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select p.preco_mensal from public.planos p where p.codigo = p_codigo and p.ativo;
$$;

revoke all on function public.preco_vigente(text) from public;
grant execute on function public.preco_vigente(text) to anon, authenticated;
