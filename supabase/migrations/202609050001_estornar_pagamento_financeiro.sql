-- Estornar um pagamento do Financeiro.
--
-- POR QUE PRECISA EXISTIR: a função de excluir lançamento recusa quem tem
-- pagamento registrado, e a mensagem manda "estornar o pagamento antes de
-- excluir". Só que o estorno NÃO EXISTIA em lugar nenhum do sistema — nem
-- função, nem botão. O lançamento do Raimundo Nonato, R$ 400,00 recebidos,
-- ficou num beco: a tela oferecia Excluir, a função recusava, e o caminho que
-- ela apontava não tinha porta.
--
-- Um botão que nunca pode dar certo é pior do que nenhum: ele promete, e a
-- pessoa tenta de novo achando que errou.
--
-- POR QUE SÓ ADMINISTRADOR E PROPRIETÁRIO: é a mesma régua de excluir. Dinheiro
-- que entrou é história; desfazer o registro dele muda o fechamento e a conta
-- que alguém já leu. A recepção registra pagamento; desfazer é de quem responde
-- pelo caixa.
--
-- SECURITY INVOKER (o padrão, de propósito): a RLS de
-- `financeiro_atendimentos` e de `financeiro_pagamentos` continua valendo, e a
-- função não empresta privilégio a quem a chama. O `institution_id` é conferido
-- à mão além disso, para a mensagem ser a mesma — "não encontrado nesta
-- organização" — tanto para o id inexistente quanto para o de outra casa: a
-- existência de um pagamento alheio também é informação.
--
-- A RECUSA: período fechado. Conferir o período é assinar um número, e desfazer
-- um pagamento de mês conferido muda o que alguém assinou. Aqui não há a
-- segunda recusa de excluir — o pagamento É o que se está desfazendo.
--
-- A AUDITORIA É ESCRITA ANTES do delete, com paciente, convênio, valor, método
-- e o período: depois da linha apagada, o id sozinho não diz nada a quem for
-- conferir por que a conta do mês mudou.
create or replace function public.estornar_pagamento_financeiro(p_pagamento_id uuid)
returns public.financeiro_atendimentos
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_eu public.perfis;
  v_pag public.financeiro_pagamentos;
  v_item public.financeiro_atendimentos;
  v_paciente text;
  v_recebido numeric;
begin
  select * into v_eu from public.perfis where id = auth.uid();
  if v_eu.id is null or v_eu.status <> 'ativo' then
    raise exception 'Sem permissão';
  end if;

  if v_eu.role not in ('admin','owner') then
    raise exception 'Só administrador ou proprietário pode estornar pagamento';
  end if;

  select * into v_pag from public.financeiro_pagamentos
   where id = p_pagamento_id and institution_id = v_eu.institution_id;
  if v_pag.id is null then
    raise exception 'Pagamento não encontrado nesta organização';
  end if;

  -- `for update` porque duas pessoas estornando o mesmo lançamento ao mesmo
  -- tempo deixariam `recebido` errado: as duas leriam o mesmo valor e as duas
  -- subtrairiam dele.
  select * into v_item from public.financeiro_atendimentos
   where id = v_pag.atendimento_id
   for update;
  if v_item.id is null then
    raise exception 'Lançamento não encontrado nesta organização';
  end if;

  if v_item.fechado_at is not null then
    raise exception 'Este período já foi fechado e não pode mais ser alterado';
  end if;

  select nome into v_paciente from public.pacientes where id = v_item.patient_id;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_eu.institution_id, v_eu.id, 'financeiro_atendimento', v_item.id, 'pagamento_estornado',
    jsonb_build_object(
      'paciente', coalesce(v_paciente, '(paciente removido)'),
      'convenio', v_item.convenio,
      'valor', v_pag.valor,
      'metodo', v_pag.metodo,
      'periodo', v_item.periodo));

  delete from public.financeiro_pagamentos where id = v_pag.id;

  -- `greatest(0, ...)` porque um `recebido` negativo não existe: se a soma dos
  -- pagamentos e o campo tiverem divergido alguma vez, o estorno não é o lugar
  -- de propagar o erro.
  v_recebido := greatest(0, coalesce(v_item.recebido, 0) - v_pag.valor);

  update public.financeiro_atendimentos
     set recebido = v_recebido,
         -- "Glosa" e "cancelado" são decisões sobre a COBRANÇA, e não sobre o
         -- dinheiro. Um estorno não as desfaz: quem glosou continua tendo
         -- glosado. Só o par aguardando/pago acompanha o saldo.
         status = case
           when v_item.status in ('glosa','cancelado') then v_item.status
           when v_recebido >= v_item.valor and v_item.valor > 0 then 'pago'
           else 'aguardando'
         end,
         data_recebimento = case when v_recebido > 0 then v_item.data_recebimento else null end,
         updated_at = now()
   where id = v_item.id
  returning * into v_item;

  return v_item;
end;
$$;

comment on function public.estornar_pagamento_financeiro(uuid) is
  'Desfaz um pagamento do Financeiro e devolve o lançamento ao saldo anterior. Só administrador e proprietário; recusa período fechado. Grava a auditoria com paciente, convênio, valor e método antes de apagar.';

-- PUBLIC sai e `authenticated` entra nominalmente, pelo mesmo motivo das
-- migrações 202609020001 e 202609020002: o Postgres concede EXECUTE a PUBLIC em
-- toda função nova, e `anon` herda de PUBLIC. A função barraria sozinha
-- ("Sem permissão", porque `auth.uid()` é nulo), mas função de administração
-- não tem por que ser sequer alcançável de fora.
revoke execute on function public.estornar_pagamento_financeiro(uuid) from public, anon;
grant  execute on function public.estornar_pagamento_financeiro(uuid) to authenticated;
