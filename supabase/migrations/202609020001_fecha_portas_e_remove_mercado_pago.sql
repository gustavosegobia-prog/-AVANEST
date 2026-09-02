-- Duas limpezas: quem pode chamar as funções, e o que sobrou do Mercado Pago.
--
-- ===========================================================================
-- 1. FUNÇÕES QUE O VISITANTE NÃO LOGADO ALCANÇAVA
-- ===========================================================================
--
-- Um visitante sem sessão conseguia perguntar quantos profissionais uma
-- organização tem (`contar_profissionais` devolvia 13) e quantos registros um
-- perfil tem (`perfil_tem_registros` devolvia 5), sabendo o UUID. UUID não se
-- adivinha, então o risco prático era baixo — mas função auxiliar de tela de
-- administração não tem por que ser alcançável de fora.
--
-- O DETALHE QUE FAZ A CORREÇÃO FUNCIONAR: o Postgres concede EXECUTE a PUBLIC
-- em toda função nova, e `anon` herda de PUBLIC. Nas permissões isso aparece
-- como `=X/postgres` — grantee vazio. `contar_profissionais` não tinha nenhuma
-- concessão explícita para `anon`, e ainda assim ele executava.
--
-- Ou seja: `revoke execute ... from anon` sozinho não teria efeito nenhum.
-- Quem tem de sair é PUBLIC, e `authenticated` recebe de volta na linha
-- seguinte — explicitamente, que é como uma permissão deve existir.
--
-- As de gatilho não recebem nada: o Postgres não checa EXECUTE para função de
-- trigger, ela roda pelo dono da tabela. Ninguém precisa poder chamá-las à mão.

-- Auxiliares de tela de administração — eram estas que vazavam contagem.
revoke execute on function public.contar_profissionais(uuid) from public, anon;
grant  execute on function public.contar_profissionais(uuid) to authenticated;

revoke execute on function public.perfil_tem_registros(uuid) from public, anon;
grant  execute on function public.perfil_tem_registros(uuid) to authenticated;

revoke execute on function public.perfil_tem_clinico(uuid) from public, anon;
grant  execute on function public.perfil_tem_clinico(uuid) to authenticated;

revoke execute on function public.perfil_tem_escala(uuid) from public, anon;
grant  execute on function public.perfil_tem_escala(uuid) to authenticated;

-- Ações de administração. Todas já barram sozinhas com "Sem permissão" — foi
-- simulado, chamando as três como anônimo dentro de uma transação abortada.
-- Continuam barrando; o que muda é não serem sequer alcançáveis.
revoke execute on function public.excluir_usuario(uuid) from public, anon;
grant  execute on function public.excluir_usuario(uuid) to authenticated;

revoke execute on function public.definir_assinatura(uuid, text, numeric) from public, anon;
grant  execute on function public.definir_assinatura(uuid, text, numeric) to authenticated;

revoke execute on function public.definir_na_escala(uuid, boolean) from public, anon;
grant  execute on function public.definir_na_escala(uuid, boolean) to authenticated;

-- Criação de organização: a tela /comecar redireciona quem não tem sessão para
-- o login antes de chegar no formulário. Nunca foi chamada por anônimo.
revoke execute on function public.criar_organizacao(text, text, text, text, text) from public, anon;
grant  execute on function public.criar_organizacao(text, text, text, text, text) to authenticated;

-- Dados da própria sessão: sem sessão não devolvem nada, mas também não têm
-- por que aceitar a chamada. O login só as consulta DEPOIS do signIn.
revoke execute on function public.minha_assinatura() from public, anon;
grant  execute on function public.minha_assinatura() to authenticated;

revoke execute on function public.meus_locais_de_plantao() from public, anon;
grant  execute on function public.meus_locais_de_plantao() to authenticated;

-- Regras de preço e reembolso. Nenhuma tela do site as chama direto; quem usa
-- `dias_de_reembolso` são `minha_assinatura` e `cancelar_assinatura`, que são
-- SECURITY DEFINER e rodam pelo dono — a revogação não as afeta.
revoke execute on function public.preco_vigente(text) from public, anon;
grant  execute on function public.preco_vigente(text) to authenticated;

revoke execute on function public.dias_de_reembolso() from public, anon;
grant  execute on function public.dias_de_reembolso() to authenticated;

-- Funções de gatilho: ninguém as chama à mão, nem precisa poder.
revoke execute on function public.chamado_ao_receber_mensagem() from public, anon, authenticated;
revoke execute on function public.confirmacao_de_plantao_honesta() from public, anon, authenticated;
revoke execute on function public.plantao_do_grupo_protegido() from public, anon, authenticated;
revoke execute on function public.protege_super_admin() from public, anon, authenticated;
revoke execute on function public.proteger_avaliacao_concluida() from public, anon, authenticated;

-- AS DUAS QUE FICAM ABERTAS, e por quê: as páginas de convite e de planos são
-- lidas por quem ainda não tem conta. Fechá-las quebraria o cadastro.
-- PUBLIC sai de qualquer forma — a concessão passa a ser nominal.
revoke execute on function public.convite_info(text) from public;
grant  execute on function public.convite_info(text) to anon, authenticated;

revoke execute on function public.vagas_fundador() from public;
grant  execute on function public.vagas_fundador() to anon, authenticated;

-- ===========================================================================
-- 2. O QUE SOBROU DO MERCADO PAGO
-- ===========================================================================
--
-- `assinaturas_mp` tinha RLS ligado e nenhuma política — ninguém conseguia
-- lê-la pela API —, e nenhuma linha de código do site a usava. Com ela vinham
-- duas funções, `vincular_assinatura_mp` e `instituicao_por_preapproval`,
-- igualmente órfãs: o pagamento passou para o Stripe e não há rota de webhook
-- do Mercado Pago no site.
--
-- A única linha era de uma organização com plano cancelado, e o mesmo
-- identificador continua guardado em `instituicoes.mp_assinatura_id` — a
-- história do pagamento não se perde. Guardo o conteúdo na auditoria antes de
-- apagar, porque tabela que some sem deixar rastro é pior que tabela morta.
--
-- As colunas `instituicoes.mp_assinatura_id` e `mp_payer_email` FICAM. São
-- histórico de cobrança de organizações reais, e apagá-las é outra decisão —
-- maior, e de quem é dono do negócio.
insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
select a.institution_id, null, 'assinatura_mp', a.id, 'tabela_removida',
       jsonb_build_object(
         'preapproval_id', a.preapproval_id,
         'payer_email', a.payer_email,
         'criada_em', a.created_at,
         'motivo', 'integração com Mercado Pago substituída pelo Stripe; tabela e funções sem uso')
from public.assinaturas_mp a;

drop function if exists public.vincular_assinatura_mp(uuid, text, text);
drop function if exists public.instituicao_por_preapproval(text);
drop table if exists public.assinaturas_mp;
