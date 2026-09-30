-- ============================================================================
-- Funções auxiliares saem do alcance de quem está logado.
--
-- 202609020001 tirou estas funções do visitante anônimo e as devolveu a
-- `authenticated`, pensando nas telas de administração. Mas elas não
-- conferem NADA — recebem o identificador de qualquer organização ou pessoa
-- e respondem. Medido pelo verificador de segurança do Supabase: qualquer
-- usuário logado, de qualquer organização, perguntava quantos profissionais
-- outra organização tem, quando começa o ciclo de cobrança dela, que plano
-- lhe cabe, se um perfil alheio tem registros clínicos ou de escala, e se um
-- paciente de outra organização tem atendimento aberto. As duas de limpeza
-- ainda APAGAVAM avisos adiados e recibos de aviso de todas as organizações
-- a pedido de qualquer um.
--
-- Nenhuma tela chama estas funções. Quem as usa:
--   * atendimento_aberto_do_paciente — só a rota de faturar, com a chave de
--     serviço;
--   * contar_profissionais, inicio_do_ciclo, perfil_tem_clinico,
--     perfil_tem_escala — só outras funções SECURITY DEFINER do dono
--     postgres (minha_assinatura, cancelar_assinatura, reservar_plano,
--     listar_organizacoes, excluir_usuario, perfil_tem_registros), que as
--     chamam com os privilégios do dono, não de quem está logado;
--   * plano_sugerido, perfil_tem_registros, limpar_* — ninguém.
-- A chave de serviço continua podendo chamar todas.
-- ============================================================================

revoke execute on function public.atendimento_aberto_do_paciente(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.contar_profissionais(uuid)                 from public, anon, authenticated;
revoke execute on function public.inicio_do_ciclo(uuid)                      from public, anon, authenticated;
revoke execute on function public.plano_sugerido(uuid)                       from public, anon, authenticated;
revoke execute on function public.perfil_tem_clinico(uuid)                   from public, anon, authenticated;
revoke execute on function public.perfil_tem_escala(uuid)                    from public, anon, authenticated;
revoke execute on function public.perfil_tem_registros(uuid)                 from public, anon, authenticated;
revoke execute on function public.limpar_adiamentos_vencidos()               from public, anon, authenticated;
revoke execute on function public.limpar_recibos_de_aviso()                  from public, anon, authenticated;

grant execute on function public.atendimento_aberto_do_paciente(uuid, uuid) to service_role;
grant execute on function public.contar_profissionais(uuid)                 to service_role;
grant execute on function public.inicio_do_ciclo(uuid)                      to service_role;
grant execute on function public.plano_sugerido(uuid)                       to service_role;
grant execute on function public.perfil_tem_clinico(uuid)                   to service_role;
grant execute on function public.perfil_tem_escala(uuid)                    to service_role;
grant execute on function public.perfil_tem_registros(uuid)                 to service_role;
grant execute on function public.limpar_adiamentos_vencidos()               to service_role;
grant execute on function public.limpar_recibos_de_aviso()                  to service_role;

-- ----------------------------------------------------------------------------
-- producao_recebida ainda olhava só o papel. É a lista "Produção enviada" da
-- aba Produção do Financeiro; quem tem o Financeiro como área extra (uma
-- recepcionista, por exemplo) abria a aba e recebia "Sem permissão". Passa a
-- perguntar o mesmo que o resto do Financeiro desde 202609300008.
-- ----------------------------------------------------------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public.producao_recebida(text)'::regprocedure);
  v_velho text := $v$if public.current_app_role() not in ('financeiro', 'owner', 'admin') then$v$;
  v_novo  text := $v$if not public.current_has_permission('financeiro') then$v$;
begin
  if position(v_velho in v_def) = 0 then
    raise exception 'producao_recebida mudou de forma inesperada — confira antes de trocar a checagem';
  end if;
  execute replace(v_def, v_velho, v_novo);
end $$;
