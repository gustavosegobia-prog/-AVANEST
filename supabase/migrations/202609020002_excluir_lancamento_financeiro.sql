-- Excluir um lançamento do Financeiro — e só o administrador.
--
-- POR QUE PRECISA EXISTIR: quando um paciente é apagado, o lançamento que
-- nasceu da avaliação dele fica. Ele aparece na lista como "quitado · R$ 0,00",
-- sem nada a registrar, e mesmo assim continua contando no fechamento do mês.
-- Não há como corrigi-lo pela tela: valor zero já está certo, e o paciente que
-- explicaria a linha não existe mais. A única saída honesta é apagar.
--
-- POR QUE SÓ ADMINISTRADOR E PROPRIETÁRIO: excluir é diferente de corrigir. A
-- linha some do fechamento, e quem confere a conta no mês seguinte não tem como
-- saber que ela existiu — a não ser pela auditoria. A recepção lança e corrige;
-- apagar é de quem responde pelo caixa.
--
-- SECURITY INVOKER (o padrão, e é de propósito): a RLS de
-- `financeiro_atendimentos` continua valendo, e a função não empresta
-- privilégio nenhum a quem a chama. O `institution_id` é conferido à mão além
-- disso, para que a mensagem de erro seja a mesma — "não encontrado nesta
-- organização" — tanto para o id inexistente quanto para o de outra casa: a
-- existência de um lançamento alheio também é informação.
--
-- AS DUAS RECUSAS:
--
--   Período fechado. Conferir o período é assinar um número. Apagar uma linha
--   de um mês já conferido muda o que alguém assinou.
--
--   Lançamento com pagamento. Dinheiro que entrou é história. O caminho ali é
--   estornar o pagamento primeiro, que é outra decisão e deixa outro rastro.
--
-- A auditoria é escrita ANTES do delete, com nome do paciente, convênio, valor,
-- período e nota: depois da linha apagada, o id sozinho não diz nada a quem for
-- conferir.
create or replace function public.excluir_lancamento_financeiro(p_atendimento_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_row public.financeiro_atendimentos;
  v_paciente text;
  v_eu public.perfis;
begin
  select * into v_eu from public.perfis where id = auth.uid();
  if v_eu.id is null or v_eu.status <> 'ativo' then
    raise exception 'Sem permissão';
  end if;

  if v_eu.role not in ('admin','owner') then
    raise exception 'Só administrador ou proprietário pode excluir lançamento';
  end if;

  select * into v_row from public.financeiro_atendimentos
   where id = p_atendimento_id and institution_id = v_eu.institution_id;
  if v_row.id is null then
    raise exception 'Lançamento não encontrado nesta organização';
  end if;

  if v_row.fechado_at is not null then
    raise exception 'Este período já foi fechado e não pode mais ser alterado';
  end if;

  if coalesce(v_row.recebido, 0) > 0
     or exists (select 1 from public.financeiro_pagamentos p where p.atendimento_id = v_row.id) then
    raise exception 'Este lançamento tem pagamento registrado. Estorne o pagamento antes de excluir.';
  end if;

  select nome into v_paciente from public.pacientes where id = v_row.patient_id;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_eu.institution_id, v_eu.id, 'financeiro_atendimento', v_row.id, 'excluido',
    jsonb_build_object(
      'paciente', coalesce(v_paciente, '(paciente removido)'),
      'convenio', v_row.convenio,
      'valor', v_row.valor,
      'periodo', v_row.periodo,
      'nota_fiscal', v_row.nota_fiscal));

  delete from public.financeiro_atendimentos where id = p_atendimento_id;
end;
$$;

comment on function public.excluir_lancamento_financeiro(uuid) is
  'Apaga um lançamento do Financeiro. Só administrador e proprietário; recusa período fechado e lançamento com pagamento registrado. Grava a auditoria com paciente, convênio e valor antes de apagar.';

-- PUBLIC sai, e `authenticated` entra nominalmente — pelo mesmo motivo da
-- migração 202609020001: o Postgres concede EXECUTE a PUBLIC em toda função
-- nova, e `anon` herda de PUBLIC. Sem esta revogação, um visitante sem sessão
-- alcançaria a função. Ela barraria sozinha ("Sem permissão", porque
-- `auth.uid()` é nulo) — mas função de administração não tem por que ser
-- sequer alcançável de fora.
revoke execute on function public.excluir_lancamento_financeiro(uuid) from public, anon;
grant  execute on function public.excluir_lancamento_financeiro(uuid) to authenticated;
