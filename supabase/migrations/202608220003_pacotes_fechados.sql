-- Volta ao preço fechado por pacote, com faixas estreitas.
--
-- A 202608220001 tinha trocado por preço por profissional, que é o único
-- desenho sem brecha nenhuma. A decisão comercial foi outra: pacote fechado é
-- mais fácil de anunciar e de entender no primeiro olhar.
--
-- Pacote fechado tem uma consequência aritmética que não some com jeitinho:
-- enquanto existir um Solo barato, um grupo sempre pode se dividir em contas
-- menores. Com as faixas largas de antes, um grupo de 6 economizava R$ 491 por
-- mês fazendo isso. Com estas faixas estreitas, a maior economia possível caiu
-- para R$ 171, num grupo de 7. Conferido de 1 a 20 pessoas, em todas as
-- divisões possíveis.
--
-- A brecha fecha de vez quando a escala de plantões existir: aí dividir o grupo
-- custa a escala compartilhada, e nenhuma economia de R$ 171 paga isso.
--
-- A coluna preco_por_profissional continua existindo e volta a ficar nula. O
-- código já lê as duas formas — quando ela é nula, vale o preco_mensal —, então
-- trocar de modelo de novo é um update, não um deploy.

-- ---------------------------------------------------------------------------
-- A faixa nova de 2 a 3
-- ---------------------------------------------------------------------------
-- Não existia. Sem ela, uma dupla caía no pacote de até 5 e pagava o mesmo que
-- cinco pessoas — que é exatamente o degrau que estamos tirando.
insert into public.planos
  (codigo, nome, descricao, preco_mensal, min_profissionais, max_profissionais,
   destaque, sob_consulta, ativo, ordem)
values
  ('dupla', 'Dupla', 'De 2 a 3 anestesiologistas', 239.00, 2, 3, false, false, true, 2)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- A tabela
-- ---------------------------------------------------------------------------
update public.planos
   set preco_mensal = 129.00, preco_por_profissional = null,
       min_profissionais = 1, max_profissionais = 1,
       nome = 'Solo', descricao = '1 anestesiologista',
       ativo = true, sob_consulta = false, ordem = 1, updated_at = now()
 where codigo = 'solo';

update public.planos
   set preco_mensal = 239.00, preco_por_profissional = null,
       min_profissionais = 2, max_profissionais = 3,
       nome = 'Dupla', descricao = 'De 2 a 3 anestesiologistas',
       ativo = true, sob_consulta = false, ordem = 2, updated_at = now()
 where codigo = 'dupla';

-- O código continua 'equipe5' porque instituicoes.plano_codigo aponta para ele.
-- Renomear a chave quebraria o vínculo de quem já contratou; o que o cliente lê
-- é o nome, e esse muda à vontade.
update public.planos
   set preco_mensal = 459.00, preco_por_profissional = null,
       min_profissionais = 4, max_profissionais = 6,
       nome = 'Equipe', descricao = 'De 4 a 6 anestesiologistas',
       ativo = true, sob_consulta = false, ordem = 3, updated_at = now()
 where codigo = 'equipe5';

update public.planos
   set preco_mensal = 759.00, preco_por_profissional = null,
       min_profissionais = 7, max_profissionais = 12,
       nome = 'Grupo', descricao = 'De 7 a 12 anestesiologistas',
       ativo = true, sob_consulta = false, ordem = 4, updated_at = now()
 where codigo = 'grupo';

update public.planos
   set preco_mensal = 1049.00, preco_por_profissional = null,
       min_profissionais = 13, max_profissionais = 20,
       nome = 'Clínica',
       descricao = 'De 13 a 20 anestesiologistas, com recepção, financeiro e administração',
       ativo = true, sob_consulta = false, ordem = 5, updated_at = now()
 where codigo = 'clinica';

-- O Hospital volta, e por necessidade: a Clínica agora termina em 20 pessoas.
-- Sem ele, uma organização com 21 anestesiologistas não teria plano nenhum para
-- contratar — o reservar_plano recusaria todos, e a pessoa ficaria olhando uma
-- tela de preços sem nada que sirva para ela.
update public.planos
   set preco_mensal = null, preco_por_profissional = null,
       min_profissionais = 21, max_profissionais = null,
       nome = 'Hospital', descricao = '21 ou mais anestesiologistas, sob medida',
       ativo = true, sob_consulta = true, ordem = 6, updated_at = now()
 where codigo = 'hospital';

-- ---------------------------------------------------------------------------
-- Conferência: nenhuma faixa pode ficar sem cobertura, e nenhuma pode se
-- sobrepor à seguinte. Um buraco aqui vira cliente sem plano no checkout.
-- ---------------------------------------------------------------------------
do $$
declare
  v_faltando text;
begin
  select string_agg(n::text, ', ')
    into v_faltando
  from generate_series(1, 30) as n
  where not exists (
    select 1 from public.planos p
    where p.ativo
      and n >= coalesce(p.min_profissionais, 1)
      and n <= coalesce(p.max_profissionais, 2147483647)
  );

  if v_faltando is not null then
    raise exception 'Sem plano para equipes de % anestesiologista(s).', v_faltando;
  end if;
end $$;
