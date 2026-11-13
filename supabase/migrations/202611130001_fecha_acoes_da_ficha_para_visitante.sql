-- Varredura de segurança (13/11/2026, os avisos do Supabase).
--
-- 1. As ações da ficha anestésica (encerrar, reabrir, excluir, salvar o
--    cabeçalho, mudar o intervalo) podiam ser CHAMADAS por quem não está
--    logado. Não faziam nada — cada uma confere pode_evolucao(), que exige
--    usuário — mas a porta não precisa ficar aberta. As duas funções de
--    gatilho da ficha também saem do alcance (gatilho não precisa de EXECUTE
--    para disparar). O porteiro das duas etapas e as funções de leitura usadas
--    pelas regras de acesso ficam como estão: o questionário do paciente e o
--    convite, sem login, passam por elas.
-- 2. Quatro funções auxiliares da ficha sem search_path fixo: ficam com o
--    "public", o mesmo de hoje, sem depender de quem chama.

grant execute on function public.definir_intervalo_evolucao(uuid, integer) to authenticated;
grant execute on function public.encerrar_evolucao(uuid) to authenticated;
grant execute on function public.excluir_evolucao(uuid, text) to authenticated;
grant execute on function public.reabrir_evolucao(uuid, text) to authenticated;
grant execute on function public.salvar_cabecalho_evolucao(uuid, integer, jsonb) to authenticated;

revoke execute on function public.definir_intervalo_evolucao(uuid, integer) from public, anon;
revoke execute on function public.encerrar_evolucao(uuid) from public, anon;
revoke execute on function public.excluir_evolucao(uuid, text) from public, anon;
revoke execute on function public.reabrir_evolucao(uuid, text) from public, anon;
revoke execute on function public.salvar_cabecalho_evolucao(uuid, integer, jsonb) from public, anon;
revoke execute on function public.evolucao_antes_de_criar() from public, anon, authenticated;
revoke execute on function public.evolucao_registro_antes_de_gravar() from public, anon, authenticated;

alter function public._evo_mcg(text) set search_path = public;
alter function public._evo_num(jsonb, text) set search_path = public;
alter function public.valida_registro_evolucao(text, jsonb, numeric) set search_path = public;
alter function public.evolucao_registro_imutavel() set search_path = public;
