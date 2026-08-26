-- ============================================================================
-- Nenhuma função de dado ao alcance de quem não entrou
--
-- O Postgres concede EXECUTE a PUBLIC em toda função nova, e PUBLIC inclui o
-- papel `anon` — o visitante sem login. Boa parte das funções deste sistema é
-- `security definer`, ou seja, roda com os poderes de quem a criou e passa por
-- cima do RLS. As duas coisas juntas significam que qualquer pessoa com a URL
-- e a chave pública do projeto podia CHAMAR essas funções.
--
-- Conferi uma a uma antes de escrever isto, e nenhuma vaza hoje: todas filtram
-- por `auth.uid()` ou por `current_institution_id()`, e com anon esses dois são
-- nulos, o que devolve zero linha. Não é buraco aberto — é a tranca faltando
-- numa porta que hoje está fechada por dentro.
--
-- O que se ganha é o dia em que alguém acrescentar uma consulta a uma dessas
-- funções e esquecer o filtro. Hoje isso viraria um endereço público de leitura
-- de dado clínico. Depois disto, vira um erro de permissão.
--
-- POR NOME, E NÃO POR ASSINATURA. A primeira versão deste arquivo listava cada
-- função com os tipos dos argumentos, e quebrou na primeira execução:
-- `admin_atualizar_perfil` tinha ganhado um sétimo parâmetro numa migração
-- posterior, e a assinatura de seis que eu havia lido do histórico não existe
-- mais no banco. Um REVOKE que erra a assinatura não avisa que errou — ele
-- falha, e derruba tudo o que vinha depois na mesma execução.
--
-- Aqui o bloco pergunta ao catálogo quais funções existem com aquele nome e
-- revoga cada uma. Sobrevive a parâmetro novo, a sobrecarga e a função que
-- ainda não foi criada.
--
-- convite_info FICA DE FORA, de propósito: a tela de convite roda antes de a
-- pessoa ter conta, e é ela que mostra o nome da organização a quem foi
-- convidado. Revogar ali quebraria o cadastro por convite.
-- ============================================================================

do $revogar$
declare
  v_nome text;
  v_assinatura text;
  v_contou int := 0;
begin
  foreach v_nome in array array[
    -- Funções que devolvem ou mudam dado. Nenhuma delas tem razão para ser
    -- chamada por quem não entrou no sistema.
    'abrir_chamado', 'admin_atualizar_perfil', 'cancelar_assinatura',
    'chamado_conversa', 'chamados_visiveis', 'e_suporte',
    'financeiro_listar_pacientes', 'inicio_do_ciclo', 'marcar_chamado_visto',
    'reativar_assinatura', 'sala_conversa', 'sala_nao_lidas',
    'definir_na_escala', 'meus_locais_de_plantao',
    -- As de gatilho. O banco as executa sozinho, com os poderes da tabela, e
    -- por isso revogar não muda o funcionamento — só fecha a porta de
    -- chamá-las à mão fora do contexto do gatilho.
    'chamado_ao_receber_mensagem', 'confirmacao_de_plantao_honesta',
    'plantao_do_grupo_protegido', 'protege_super_admin'
  ]
  loop
    for v_assinatura in
      select format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_nome
    loop
      execute format('revoke execute on function %s from anon', v_assinatura);
      v_contou := v_contou + 1;
    end loop;
  end loop;

  raise notice 'Revogado o acesso de anon a % função(ões).', v_contou;
end
$revogar$;
