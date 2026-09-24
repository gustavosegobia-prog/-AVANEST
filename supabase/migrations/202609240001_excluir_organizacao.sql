-- ============================================================================
-- Excluir uma organização de vez, do painel do super-admin
--
-- Existe porque a lista acumula organização que nunca saiu do papel: cadastro
-- de teste, grupo que desistiu antes de convidar alguém, nome digitado errado.
-- Cancelar deixa a linha lá para sempre, e uma lista cheia de lixo faz o dono
-- do produto parar de ler a própria lista.
--
-- ----------------------------------------------------------------------------
-- AS TRAVAS, E POR QUE ELAS SÃO DO BANCO
--
-- Escritas só na tela, bastaria uma chamada nova meses adiante para apagar
-- prontuário. Aqui elas valem por qualquer caminho:
--
--   1. só super-admin executa;
--   2. NUNCA a organização de quem está excluindo — trancar-se do lado de fora
--      do próprio sistema é um clique que não tem volta pela interface;
--   3. NUNCA uma organização que tenha paciente, ficha ou usuário.
--
-- A TERCEIRA É A QUE IMPORTA. Ficha pré-anestésica é prontuário, e prontuário
-- no Brasil tem guarda obrigatória de vinte anos — o CFM não dá ao dono da
-- plataforma o direito de apagar o prontuário que um anestesiologista assinou.
-- As chaves estrangeiras de `pacientes`, `avaliacoes` e `perfis` já são
-- RESTRICT, ou seja, o banco recusaria de qualquer jeito; o que esta função
-- acrescenta é CONTAR ANTES e devolver uma frase que explica, em vez de um
-- erro de integridade que ninguém entende.
--
-- Quem quiser sumir com uma organização que tem prontuário continua tendo
-- "Cancelar": ela sai de circulação e os documentos ficam.
-- ============================================================================

create or replace function public.excluir_organizacao(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
  v_pacientes int;
  v_avaliacoes int;
  v_perfis int;
  v_minha uuid;
begin
  if not public.e_super_admin() then
    raise exception 'Apenas o super-admin pode excluir uma organização.';
  end if;

  select i.nome into v_nome from public.instituicoes i where i.id = p_id;
  if v_nome is null then
    raise exception 'Organização não encontrada.';
  end if;

  select p.institution_id into v_minha from public.perfis p where p.id = auth.uid();
  if v_minha = p_id then
    raise exception 'Esta é a sua própria organização. Excluí-la deixaria você sem acesso ao sistema.';
  end if;

  select count(*) into v_pacientes from public.pacientes x where x.institution_id = p_id;
  select count(*) into v_avaliacoes from public.avaliacoes x where x.institution_id = p_id;
  select count(*) into v_perfis    from public.perfis x     where x.institution_id = p_id;

  if v_pacientes > 0 or v_avaliacoes > 0 or v_perfis > 0 then
    raise exception
      'Não dá para excluir "%": tem % paciente(s), % ficha(s) e % usuário(s). Ficha pré-anestésica é prontuário e não se apaga. Use Cancelar para tirar de circulação.',
      v_nome, v_pacientes, v_avaliacoes, v_perfis;
  end if;

  -- O resto some por cascata: convites, locais, modelos de plantão, termos de
  -- consentimento, mensagens da sala. Nada disso é prontuário.
  delete from public.instituicoes where id = p_id;
  return v_nome;
end;
$$;

comment on function public.excluir_organizacao(uuid) is
  'Exclui DEFINITIVAMENTE uma organização vazia. Recusa a organização do próprio super-admin e qualquer uma com paciente, ficha ou usuário — prontuário não se apaga. Só super-admin executa.';

revoke execute on function public.excluir_organizacao(uuid) from public, anon;
grant execute on function public.excluir_organizacao(uuid) to authenticated;
