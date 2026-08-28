-- ============================================================================
-- A produção enviada, de um período inteiro
--
-- O Financeiro passou a somar as três fontes de receita do serviço, e para a
-- produção ele consultava `producao_do_dia` direto. A consulta funciona e não
-- dá erro — devolve menos linhas. A política daquela tabela é `perfil_id =
-- auth.uid()` SEM exceção para administrador, e isso é deliberado: a lista de
-- pacientes que um colega anestesiou não é informação de gestão.
--
-- O resultado era o pior tipo de defeito: num grupo, a linha "Produção
-- anestésica" mostrava só a do próprio usuário, sem nenhum aviso de que faltava
-- o resto. Um número menor que o real, com cara de número certo.
--
-- `producao_recebida(p_mes)` já resolvia isso para UM mês, com a permissão
-- certa e sem vazar o que não deve. Falta o período: o envelhecimento olha doze
-- meses, e doze chamadas seriam doze idas ao banco para montar uma tabela.
--
-- Esta função é a mesma, com duas datas. Vale a mesma regra: só o que foi
-- ENVIADO ao financeiro entra. Produção anotada e não enviada é rascunho do
-- profissional, e contá-la como receita do serviço colocaria no caixa dinheiro
-- que ninguém mandou cobrar.
-- ============================================================================

create or replace function public.producao_do_periodo(p_de date, p_ate date)
returns table (
  id uuid, perfil_id uuid, data date, paciente text, convenio text,
  procedimento text, valor numeric, situacao text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_app_role() not in ('financeiro', 'owner', 'admin') then
    raise exception 'Sem permissão para ver a produção enviada';
  end if;
  if p_de is null or p_ate is null or p_de > p_ate then
    raise exception 'Período inválido';
  end if;

  return query
    select pr.id, pr.perfil_id, pr.data, pr.paciente, pr.convenio,
           pr.procedimento, pr.valor, pr.situacao
      from public.producao_do_dia pr
     where pr.institution_id = public.current_institution_id()
       and pr.enviado_em is not null
       and pr.data between p_de and p_ate
     order by pr.data desc;
end;
$$;

-- O Postgres concede EXECUTE ao PUBLIC em toda função nova, e PUBLIC inclui o
-- visitante sem login. Esta é `security definer` e passa por cima do RLS.
revoke execute on function public.producao_do_periodo(date, date) from public, anon;
grant  execute on function public.producao_do_periodo(date, date) to authenticated;
