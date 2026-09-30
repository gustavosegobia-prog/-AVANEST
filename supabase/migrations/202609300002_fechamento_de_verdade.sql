-- ============================================================================
-- "Confirmar conferência" nunca fechou nada. Corrige, e ganha volta.
--
-- TRÊS FUNÇÕES JÁ CONFEREM `fechado_at is not null` antes de mexer num
-- lançamento — registrar_pagamento_financeiro, estornar_pagamento_financeiro,
-- excluir_lancamento_financeiro. A coluna existe desde 202607230004. E em
-- nenhum lugar do banco, em nenhuma migração, algo já escreveu nela: a
-- proteção do mês fechado está pronta e nunca disparou, porque nada nunca
-- chegou a fechar um período de verdade.
--
-- "Confirmar conferência" (conferir_periodo_financeiro) só grava
-- `financeiro_periodos.status = 'conferido'` — e mais nada. Os lançamentos
-- daquele mês continuam com `fechado_at` nulo para sempre, e a tela que diz
-- "Revise antes da conferência" está avisando de um risco que a conferência
-- não impede: dinheiro pode ser registrado, estornado ou apagado num mês que
-- a pessoa já confirmou ter conferido.
--
-- A CORREÇÃO: a própria conferência passa a fechar. Confirmar é o único botão
-- que existe na tela hoje, o texto já fala dele como o passo final, e não há
-- uso real de um terceiro estado "conferido mas ainda destrancado" em lugar
-- nenhum — criar um agora seria adicionar um passo que ninguém pediu. O que
-- muda: ao confirmar, além de `financeiro_periodos.status` virar 'fechado'
-- (não mais 'conferido' — pulando direto, porque não existe uso do estado
-- intermediário), `fechado_at`/`fechado_by` são gravados também em CADA
-- `financeiro_atendimentos` daquele período. É essa gravação que faltava para
-- as três funções de guarda começarem a proteger de verdade.
--
-- E GANHA VOLTA: reabrir_periodo_financeiro, só para quem administra, com
-- motivo obrigatório. Reabrir devolve ao estado 'aberto' — não a 'conferido':
-- se o período está sendo reaberto é porque algo vai mudar, e o que mudar
-- precisa passar por uma conferência nova antes de fechar de novo, não
-- herdar a conferência velha como se nada tivesse acontecido.
-- ============================================================================

create or replace function public.conferir_periodo_financeiro(p_periodo text)
returns public.financeiro_periodos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_institution uuid;
  v_row public.financeiro_periodos;
  v_agora timestamptz := now();
begin
  select institution_id into v_institution
  from public.perfis
  where id = auth.uid()
    and status = 'ativo'
    and role in ('financeiro','admin','owner');

  if v_institution is null then
    raise exception 'Sem permissão';
  end if;

  insert into public.financeiro_periodos(
    institution_id, periodo, status, conferido_by, conferido_at,
    fechado_by, fechado_at, observacoes
  ) values (
    v_institution, p_periodo, 'fechado', auth.uid(), v_agora,
    auth.uid(), v_agora, null
  )
  on conflict (institution_id, periodo) do update
  set status = 'fechado',
      conferido_by = auth.uid(),
      conferido_at = v_agora,
      fechado_by = auth.uid(),
      fechado_at = v_agora,
      observacoes = null,
      updated_at = v_agora
  returning * into v_row;

  -- A TRAVA DE VERDADE. Sem esta linha, `fechado_at` nunca sai de nulo em
  -- lançamento nenhum, e as três funções que já checam essa coluna continuam
  -- protegendo um mês que ninguém nunca fechou.
  update public.financeiro_atendimentos
     set fechado_at = v_agora, fechado_by = auth.uid()
   where institution_id = v_institution
     and periodo = p_periodo
     and fechado_at is null;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_institution, auth.uid(), 'financeiro_periodo', v_row.id, 'periodo_fechado',
    jsonb_build_object('periodo', p_periodo)
  );

  return v_row;
end;
$$;

-- ============================================================================
-- Reabrir. Só admin/owner, e só com motivo escrito.
--
-- "financeiro" confere; só quem administra reabre. Fechar um mês é revisão;
-- reabrir é desfazer uma revisão que já foi assinada, e a régua sobe.
-- ============================================================================
create or replace function public.reabrir_periodo_financeiro(p_periodo text, p_motivo text)
returns public.financeiro_periodos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_institution uuid;
  v_row public.financeiro_periodos;
begin
  if p_motivo is null or length(trim(p_motivo)) < 5 then
    raise exception 'Escreva o motivo da reabertura.';
  end if;

  select institution_id into v_institution
  from public.perfis
  where id = auth.uid()
    and status = 'ativo'
    and role in ('admin','owner');

  if v_institution is null then
    raise exception 'Só administrador ou proprietário pode reabrir um período fechado.';
  end if;

  select * into v_row from public.financeiro_periodos
   where institution_id = v_institution and periodo = p_periodo;

  if v_row.id is null or v_row.status <> 'fechado' then
    raise exception 'Este período não está fechado.';
  end if;

  -- VOLTA PARA 'aberto', e não para 'conferido': o que for corrigido agora
  -- precisa de uma conferência NOVA antes de fechar de novo — herdar a
  -- conferência antiga seria fechar de novo sem ninguém ter olhado a
  -- correção.
  update public.financeiro_periodos
     set status = 'aberto',
         conferido_by = null, conferido_at = null,
         fechado_by = null, fechado_at = null,
         observacoes = p_motivo,
         updated_at = now()
   where id = v_row.id
  returning * into v_row;

  update public.financeiro_atendimentos
     set fechado_at = null, fechado_by = null
   where institution_id = v_institution and periodo = p_periodo;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_institution, auth.uid(), 'financeiro_periodo', v_row.id, 'periodo_reaberto',
    jsonb_build_object('periodo', p_periodo, 'motivo', p_motivo)
  );

  return v_row;
end;
$$;

revoke all on function public.reabrir_periodo_financeiro(text,text) from public, anon;
grant execute on function public.reabrir_periodo_financeiro(text,text) to authenticated;

comment on function public.conferir_periodo_financeiro(text) is
  'Fecha o período: marca financeiro_periodos como fechado E propaga fechado_at/fechado_by para cada financeiro_atendimentos do período — sem isso a trava das outras três funções fica sempre destravada.';
comment on function public.reabrir_periodo_financeiro(text,text) is
  'Reabre um período fechado. Só admin/owner, motivo obrigatório (>=5 caracteres). Volta para "aberto", não "conferido": o que mudar precisa de conferência nova.';
