-- ============================================================================
-- Excluir usuário não pode apagar plantão
--
-- Defeito real, e silencioso. A trava da exclusão (perfil_tem_registros) foi
-- escrita em julho, quando o sistema tinha só o prontuário. O módulo de escala
-- chegou em agosto e trouxe quatro tabelas que apontam para perfis com
-- ON DELETE CASCADE:
--
--   plantoes.perfil_id            -> cascade
--   producao_do_dia.perfil_id     -> cascade
--   trocas_plantao.solicitante_id -> cascade
--   trocas_plantao.destinatario_id-> cascade
--
-- A trava não contava nenhuma delas. Resultado: um anestesiologista com dois
-- anos de plantões e de produção, mas sem avaliação nenhuma feita por ele,
-- passava pela trava — e o `delete from perfis` levava junto a escala inteira
-- e as anotações de produção. Sem aviso, sem confirmação, sem volta.
--
-- Não é hipótese: é exatamente o perfil de quem entrou no sistema pela escala
-- e ainda não usou a avaliação pré-anestésica. E é dinheiro: a produção do dia
-- é a base do que a pessoa tem a receber.
--
-- A correção mantém a regra original — só se apaga quem nunca registrou nada —
-- e passa a contar também o que a escala guarda. Quem tem plantão deixa de ser
-- excluível e passa a ser desativável, que é o que já valia para o prontuário.
--
-- O que NÃO entra na conta, de propósito:
--   modelos_plantao.owner_id       — atalho pessoal, não é histórico
--   locais_atendimento.owner_id    — local particular, idem
--   locais_recentes / sala_leitura / avisos_leitura — estado de tela
-- Nenhum deles é referenciado por registro de outra pessoa, e bloquear a
-- exclusão por causa de um atalho seria transformar a trava em obstáculo.
-- ============================================================================

-- O que a escala guarda desta pessoa. Separado do clínico para a mensagem de
-- erro poder dizer QUAL das duas coisas está travando — "possui 43 registros"
-- não ajuda ninguém a decidir o que fazer.
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
       where solicitante_id = p_perfil_id or destinatario_id = p_perfil_id);
$$;

comment on function public.perfil_tem_escala(uuid) is
  'Plantões, produção e trocas desta pessoa. Todos com FK cascade para perfis: apagar o perfil apagaria estes registros.';

-- Só o prontuário. Mesma lista de julho, agora nomeada pelo que ela é.
create or replace function public.perfil_tem_clinico(p_perfil_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.avaliacoes    where created_by = p_perfil_id)
  + (select count(*) from public.pacientes     where created_by = p_perfil_id)
  + (select count(*) from public.medicamentos  where created_by = p_perfil_id)
  + (select count(*) from public.exames        where created_by = p_perfil_id)
  + (select count(*) from public.exames_fisicos where created_by = p_perfil_id)
  + (select count(*) from public.vias_aereas   where created_by = p_perfil_id)
  + (select count(*) from public.historias     where created_by = p_perfil_id)
  + (select count(*) from public.comorbidades  where created_by = p_perfil_id)
  + (select count(*) from public.escores       where created_by = p_perfil_id)
  + (select count(*) from public.planejamentos where created_by = p_perfil_id)
  + (select count(*) from public.orientacoes   where created_by = p_perfil_id)
  + (select count(*) from public.conclusoes    where created_by = p_perfil_id)
  + (select count(*) from public.documentos    where created_by = p_perfil_id)
  + (select count(*) from public.protocolos    where created_by = p_perfil_id)
  + (select count(*) from public.financeiro    where created_by = p_perfil_id)
  + (select count(*) from public.pagamentos    where created_by = p_perfil_id)
  + (select count(*) from public.auditoria     where user_id    = p_perfil_id);
$$;

-- O nome antigo continua valendo e agora responde a pergunta certa: "apagar
-- este perfil destrói alguma coisa?". Qualquer chamador que já existia passa a
-- ficar correto sem ser alterado.
create or replace function public.perfil_tem_registros(p_perfil_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.perfil_tem_clinico(p_perfil_id) + public.perfil_tem_escala(p_perfil_id);
$$;

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

  -- Duas mensagens, porque as saídas são diferentes. No caso clínico não há
  -- saída: o registro fica onde está, e o certo é desativar. No caso da escala
  -- há — transferir os plantões para o cadastro certo — e a mensagem precisa
  -- dizer isso, senão o administrador conclui que o sistema está travado.
  if v_clinico > 0 then
    raise exception
      'Este usuário tem % registro(s) no prontuário e não pode ser excluído. Use Status: Inativo para revogar o acesso sem perder o histórico clínico.',
      v_clinico;
  end if;

  if v_escala > 0 then
    raise exception
      'Este usuário tem % registro(s) de escala (plantões, produção ou trocas). Apagar o cadastro apagaria todos eles. Transfira os plantões para o cadastro correto antes, ou use Status: Inativo.',
      v_escala;
  end if;

  -- A auditoria guarda quem era, mesmo depois da exclusão.
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_ator.institution_id, auth.uid(), 'perfil', p_perfil_id, 'usuario_excluido',
    jsonb_build_object('nome', v_alvo.nome, 'email', v_alvo.email, 'role', v_alvo.role)
  );

  -- Convites pendentes criados por esta pessoa perdem o sentido.
  delete from public.convites where invited_by = p_perfil_id and status = 'pendente';

  delete from public.perfis where id = p_perfil_id;
end;
$$;

revoke execute on function public.excluir_usuario(uuid)      from anon;
revoke execute on function public.perfil_tem_registros(uuid)  from anon;
revoke execute on function public.perfil_tem_clinico(uuid)    from anon;
revoke execute on function public.perfil_tem_escala(uuid)     from anon;
grant execute on function public.excluir_usuario(uuid)      to authenticated;
grant execute on function public.perfil_tem_registros(uuid)  to authenticated;
grant execute on function public.perfil_tem_clinico(uuid)    to authenticated;
grant execute on function public.perfil_tem_escala(uuid)     to authenticated;
