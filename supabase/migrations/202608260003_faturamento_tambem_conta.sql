-- ============================================================================
-- O atendimento faturado também conta na trava da exclusão
--
-- Complemento de 202608260002. Ao reler a lista completa de chaves para
-- public.perfis, sobrou uma que não estava em nenhuma das duas contas:
--
--   financeiro_atendimentos.medico_id -> on delete set null
--
-- Ela não apaga a linha, e por isso não é o mesmo perigo das quatro em
-- cascade. Mas apaga QUEM FEZ: a cobrança continua no faturamento, com valor,
-- convênio e hospital, e sem o anestesiologista. Num registro de dinheiro isso
-- é pior do que parece — é justamente a coluna que responde quem recebe o
-- repasse daquele atendimento.
--
-- Entra em perfil_tem_escala, e não em perfil_tem_clinico, por causa da
-- mensagem: a saída aqui é a mesma da escala — transferir para o cadastro
-- certo antes de apagar —, e não a do prontuário, onde não há saída além de
-- desativar o acesso.
-- ============================================================================

create or replace function public.perfil_tem_escala(p_perfil_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.producao_do_dia where perfil_id = p_perfil_id)
  + (select count(*) from public.plantoes        where perfil_id = p_perfil_id)
  + (select count(*) from public.trocas_plantao
       where solicitante_id = p_perfil_id or destinatario_id = p_perfil_id)
  + (select count(*) from public.financeiro_atendimentos where medico_id = p_perfil_id);
$$;

comment on function public.perfil_tem_escala(uuid) is
  'Plantões, produção, trocas e atendimentos faturados desta pessoa. '
  'Apagar o perfil apagaria os três primeiros (cascade) e deixaria o quarto '
  'sem o médico que o realizou (set null).';

create or replace function public.excluir_usuario(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ator public.perfis;
  v_alvo public.perfis;
  v_clinico integer;
  v_escala  integer;
begin
  select * into v_ator from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_alvo from public.perfis where id = p_perfil_id;

  if v_ator.id is null or v_alvo.id is null
     or v_ator.institution_id <> v_alvo.institution_id
     or v_ator.role not in ('admin','owner') then
    raise exception 'Sem permissão';
  end if;

  if v_alvo.id = auth.uid() then
    raise exception 'Você não pode excluir o próprio acesso';
  end if;

  if v_alvo.role = 'owner' then
    raise exception 'O proprietário não pode ser excluído. Transfira a propriedade antes.';
  end if;

  v_clinico := public.perfil_tem_clinico(p_perfil_id);
  v_escala  := public.perfil_tem_escala(p_perfil_id);

  if v_clinico > 0 then
    raise exception
      'Este usuário tem % registro(s) no prontuário e não pode ser excluído. Use Status: Inativo para revogar o acesso sem perder o histórico clínico.',
      v_clinico;
  end if;

  if v_escala > 0 then
    raise exception
      'Este usuário tem % registro(s) de escala e faturamento (plantões, produção, trocas ou atendimentos faturados). Apagar o cadastro apagaria os plantões e deixaria as cobranças sem médico. Transfira tudo para o cadastro correto antes, ou use Status: Inativo.',
      v_escala;
  end if;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_ator.institution_id, auth.uid(), 'perfil', p_perfil_id, 'usuario_excluido',
    jsonb_build_object('nome', v_alvo.nome, 'email', v_alvo.email, 'role', v_alvo.role)
  );

  delete from public.convites where invited_by = p_perfil_id and status = 'pendente';

  delete from public.perfis where id = p_perfil_id;
end;
$$;

revoke execute on function public.excluir_usuario(uuid)  from anon;
revoke execute on function public.perfil_tem_escala(uuid) from anon;
grant  execute on function public.excluir_usuario(uuid)  to authenticated;
grant  execute on function public.perfil_tem_escala(uuid) to authenticated;
