-- ============================================================================
-- Dois meses grátis, sem cartão
--
-- "Use por 2 meses grátis e após, se gostar, assine."
--
-- O DEFEITO DE ORIGEM: `criar_organizacao` nunca escrevia `assinatura_ate`. A
-- coluna `plano` nascia 'trial' pelo default, e o login mandava TODO MUNDO em
-- 'trial' direto para a tela de pagamento. Ou seja: não existia teste grátis —
-- existia uma porta fechada, e cada conta era aberta na mão, uma a uma,
-- marcada como 'cortesia'. Das sete organizações de hoje, cinco são cortesia
-- dada a dedo e duas pararam na tela de pagamento e cancelaram.
--
-- POR MÊS FECHADO, e não por 60 dias corridos. O valor deste sistema chega
-- atrasado: o plantão é em outubro, a nota sai em novembro, o dinheiro cai em
-- dezembro. Sessenta dias contados de 28 de setembro entregariam DOIS dias do
-- primeiro mês, e quem entrasse no fim do mês conheceria metade do produto de
-- quem entrou no dia 1º. Até o fim do segundo mês seguinte, todo mundo vive
-- dois fechamentos inteiros — e ninguém recebe menos do que a frase promete:
-- quem entra em 28/09 vai até 30/11, dois meses e dois dias.
--
-- A mesma conta está em lib/teste-gratis.ts, que é quem escreve a data na
-- tela. As duas precisam concordar, e por isso o teste de lá confere os mesmos
-- casos de borda que este comentário descreve.
-- ============================================================================

-- O último instante do segundo mês seguinte.
--
-- Menos um microssegundo, e não a meia-noite do dia seguinte: com a meia-noite
-- quem abrisse o sistema às nove da manhã do último dia encontraria a conta já
-- vencida — um dia a menos do que o combinado, justamente no dia em que a
-- pessoa está decidindo se assina.
create or replace function public.fim_do_teste_gratis(a_partir_de timestamptz default now())
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select date_trunc('month', a_partir_de) + interval '3 months' - interval '1 microsecond'
$$;

comment on function public.fim_do_teste_gratis(timestamptz) is
  'Fim do teste de dois meses: o último instante do segundo mês seguinte ao da entrada.';

revoke execute on function public.fim_do_teste_gratis(timestamptz) from public, anon;
grant execute on function public.fim_do_teste_gratis(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- A criação da organização passa a datar o teste
-- ---------------------------------------------------------------------------
create or replace function public.criar_organizacao(
  p_tipo text,
  p_nome_organizacao text,
  p_nome_usuario text,
  p_crm text default null,
  p_rqe text default null
)
returns public.perfis
language plpgsql
security definer
set search_path = ''
as $$
declare v_instituicao public.instituicoes; v_perfil public.perfis; v_email text; v_nome text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if exists (select 1 from public.perfis where id = auth.uid()) then
    raise exception 'Este usuário já pertence a uma organização'; end if;
  if p_tipo not in ('individual','grupo') then raise exception 'Tipo de organização inválido'; end if;
  if coalesce(trim(p_nome_usuario),'') = '' then raise exception 'Informe o nome do responsável'; end if;
  select email into v_email from auth.users where id = auth.uid();
  v_nome := nullif(trim(coalesce(p_nome_organizacao,'')),'');
  if p_tipo = 'individual' then v_nome := coalesce(v_nome, trim(p_nome_usuario) || ' — Individual');
  elsif v_nome is null then raise exception 'Informe o nome do grupo'; end if;

  -- AQUI ESTÁ A CAMPANHA. `plano` já vinha 'trial' pelo default da coluna; o
  -- que faltava era a data, e sem ela o teste não tinha fim nem começo — era
  -- só um rótulo que trancava a porta.
  insert into public.instituicoes (nome, tipo, status, email, plano, assinatura_ate)
  values (v_nome, p_tipo, 'ativa', v_email, 'trial', public.fim_do_teste_gratis())
  returning * into v_instituicao;

  insert into public.perfis (id, institution_id, nome, role, crm, rqe, status, must_reset, email)
  values (auth.uid(), v_instituicao.id, trim(p_nome_usuario), 'owner',
    nullif(trim(coalesce(p_crm,'')),''), nullif(trim(coalesce(p_rqe,'')),''), 'ativo', false, v_email)
  returning * into v_perfil;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_instituicao.id, auth.uid(), 'instituicao', v_instituicao.id, 'organizacao_criada',
    jsonb_build_object('tipo', p_tipo, 'nome', v_nome,
                       'teste_ate', v_instituicao.assinatura_ate));
  return v_perfil;
end;
$$;

revoke execute on function public.criar_organizacao(text, text, text, text, text) from public, anon;
grant execute on function public.criar_organizacao(text, text, text, text, text) to authenticated;
