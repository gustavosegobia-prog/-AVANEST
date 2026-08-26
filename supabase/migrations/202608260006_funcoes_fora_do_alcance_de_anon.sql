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
-- convite_info FICA DE FORA, de propósito: a tela de convite roda antes de a
-- pessoa ter conta, e é ela que mostra o nome da organização a quem foi
-- convidado. Revogar ali quebraria o cadastro por convite. É a única função
-- desta lista que precisa de anon, e por isso é a única com a exceção escrita.
-- ============================================================================

revoke execute on function public.abrir_chamado(text, text) from anon;
revoke execute on function public.admin_atualizar_perfil(uuid, text, text, text, text, text) from anon;
revoke execute on function public.admin_atualizar_perfil(uuid, text, text, text, text, text, text[]) from anon;
revoke execute on function public.cancelar_assinatura(text) from anon;
revoke execute on function public.chamado_conversa(uuid) from anon;
revoke execute on function public.chamados_visiveis() from anon;
revoke execute on function public.e_suporte() from anon;
revoke execute on function public.financeiro_listar_pacientes() from anon;
revoke execute on function public.inicio_do_ciclo(uuid) from anon;
revoke execute on function public.marcar_chamado_visto(uuid) from anon;
revoke execute on function public.reativar_assinatura() from anon;
revoke execute on function public.sala_conversa(int) from anon;
revoke execute on function public.sala_nao_lidas() from anon;

-- As de gatilho. Elas nunca são chamadas por ninguém — o banco as executa
-- sozinho, com os poderes da tabela —, então revogar não muda o funcionamento
-- e fecha a porta de chamá-las à mão fora do contexto do gatilho.
revoke execute on function public.chamado_ao_receber_mensagem() from anon;
revoke execute on function public.confirmacao_de_plantao_honesta() from anon;
revoke execute on function public.plantao_do_grupo_protegido() from anon;
revoke execute on function public.protege_super_admin() from anon;

-- E as duas de hoje, para nascerem com a tranca posta.
revoke execute on function public.definir_na_escala(uuid, boolean) from anon;
revoke execute on function public.meus_locais_de_plantao() from anon;
