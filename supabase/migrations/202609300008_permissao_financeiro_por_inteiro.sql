-- ============================================================================
-- Quem recebeu a permissão de Financeiro passa a ver o Financeiro inteiro.
--
-- O sistema dá acesso por PAPEL ou por PERMISSÃO: uma recepcionista pode
-- ganhar a permissão "financeiro" e a área aparece para ela. Os lançamentos
-- e pagamentos respeitam isso (current_has_permission('financeiro')). Mas
-- quatro regras de acesso e três funções olhavam só o PAPEL — e essa pessoa
-- via um Financeiro pela metade, sem aviso:
--   - convênios sem preço → todo lançamento que ela criava nascia em R$ 0;
--   - a produção enviada recusada → o total dela sem a produção do mês;
--   - só as despesas lançadas por ela → Resultado do mês sem as do serviço;
--   - períodos invisíveis e fechar recusado → todo mês "em preparação".
-- Conferido no banco numa transação desfeita, simulando o papel
-- recepção + permissão financeiro — que é o de uma pessoa ativa hoje.
--
-- Tudo passa a usar current_has_permission('financeiro'), que já cobre
-- administrador, proprietário, papel financeiro e as permissões
-- "financeiro" e "todos". O que é de ADMINISTRADOR continua sendo só dele:
-- reabrir período, estornar pagamento, excluir lançamento e editar a tabela
-- de preços não mudam.
-- ============================================================================

-- ── Regras de acesso ────────────────────────────────────────────────────────
drop policy if exists financeiro_gerencia_periodos on public.financeiro_periodos;
create policy financeiro_gerencia_periodos on public.financeiro_periodos
  for all
  using (institution_id = public.current_institution_id()
         and public.current_has_permission('financeiro')
         and public.modulo_liberado('financeiro'))
  with check (institution_id = public.current_institution_id()
              and public.current_has_permission('financeiro')
              and public.modulo_liberado('financeiro'));

drop policy if exists despesas_do_servico on public.despesas;
create policy despesas_do_servico on public.despesas
  for all
  using (institution_id = public.current_institution_id()
         and public.modulo_liberado('financeiro')
         and (perfil_id = auth.uid() or public.current_has_permission('financeiro')))
  with check (institution_id = public.current_institution_id()
              and public.modulo_liberado('financeiro')
              and (perfil_id = auth.uid() or public.current_has_permission('financeiro')));

drop policy if exists financeiro_le_valores_convenio on public.convenio_valores;
create policy financeiro_le_valores_convenio on public.convenio_valores
  for select
  using (institution_id = public.current_institution_id()
         and public.current_has_permission('financeiro')
         and public.modulo_liberado('financeiro'));

drop policy if exists financeiro_le_o_que_foi_enviado on public.producao_do_dia;
create policy financeiro_le_o_que_foi_enviado on public.producao_do_dia
  for select
  using (institution_id = public.current_institution_id()
         and enviado_em is not null
         and public.current_has_permission('financeiro'));

-- ── Funções ─────────────────────────────────────────────────────────────────
create or replace function public.producao_do_periodo(p_de date, p_ate date)
returns table(id uuid, perfil_id uuid, data date, paciente text, convenio text, procedimento text, valor numeric, situacao text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_has_permission('financeiro') then
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

create or replace function public.resumo_producao_do_mes(p_periodo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio date;
  v_resumo jsonb;
begin
  if not public.current_has_permission('financeiro') then
    raise exception 'Sem permissão para ver a produção enviada';
  end if;
  if p_periodo !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido: use o formato AAAA-MM';
  end if;
  v_inicio := to_date(p_periodo || '-01', 'YYYY-MM-DD');

  select jsonb_build_object('anotacoes', count(*), 'valor', coalesce(sum(pr.valor), 0))
    into v_resumo
    from public.producao_do_dia pr
   where pr.institution_id = public.current_institution_id()
     and pr.enviado_em is not null
     and pr.situacao <> 'cancelado'
     and pr.data >= v_inicio
     and pr.data < (v_inicio + interval '1 month')::date;

  return v_resumo;
end;
$$;

create or replace function public.conferir_periodo_financeiro(p_periodo text)
returns public.financeiro_periodos
language plpgsql
set search_path = public
as $$
declare
  v_institution uuid;
  v_row public.financeiro_periodos;
  v_agora timestamptz := now();
  v_producao jsonb;
begin
  perform set_config('avanest.escrita_financeira', 'sim', true);
  if not public.current_has_permission('financeiro') then
    raise exception 'Sem permissão';
  end if;
  v_institution := public.current_institution_id();
  if v_institution is null then
    raise exception 'Sem permissão';
  end if;

  v_producao := public.resumo_producao_do_mes(p_periodo);

  insert into public.financeiro_periodos(
    institution_id, periodo, status, conferido_by, conferido_at,
    fechado_by, fechado_at, observacoes, producao_no_fechamento
  ) values (
    v_institution, p_periodo, 'fechado', auth.uid(), v_agora,
    auth.uid(), v_agora, null, v_producao
  )
  on conflict (institution_id, periodo) do update
  set status = 'fechado',
      conferido_by = auth.uid(),
      conferido_at = v_agora,
      fechado_by = auth.uid(),
      fechado_at = v_agora,
      observacoes = null,
      producao_no_fechamento = v_producao,
      updated_at = v_agora
  returning * into v_row;

  update public.financeiro_atendimentos
     set fechado_at = v_agora, fechado_by = auth.uid()
   where institution_id = v_institution
     and periodo = p_periodo
     and fechado_at is null;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_institution, auth.uid(), 'financeiro_periodo', v_row.id, 'periodo_fechado',
    jsonb_build_object('periodo', p_periodo, 'producao', v_producao)
  );

  return v_row;
end;
$$;
