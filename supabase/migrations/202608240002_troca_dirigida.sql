-- ===========================================================================
-- Troca dirigida: para o grupo inteiro ou para uma pessoa só
-- ===========================================================================
-- A coluna destinatario_id já existia e já significava isso — null é oferta ao
-- grupo, preenchido é convite a alguém. O que faltava era o outro lado: quem
-- recebe precisa poder recusar, e quem pediu precisa poder desistir.
--
-- Sem isto, um pedido nascia e não morria nunca. A lista de trocas encheria de
-- convites que ninguém respondeu e ninguém pode limpar, até virar uma tela que
-- as pessoas param de abrir.
--
-- Recusar e cancelar são funções, e não um update com policy, pelo mesmo
-- motivo de aceitar_troca: elas dizem QUEM pode fazer o quê. Uma policy de
-- update na tabela deixaria o solicitante marcar o próprio pedido como
-- "aceita" — e o plantão trocaria de dono sem ninguém ter concordado.
-- ===========================================================================

/**
 * Recusar um convite.
 *
 * Só quem recebeu recusa. Uma oferta aberta ao grupo não se recusa: quem não
 * quer simplesmente não assume, e deixar qualquer um "recusar" apagaria a
 * oferta para os outros dez colegas.
 */
create or replace function public.recusar_troca(p_troca_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_troca public.trocas_plantao%rowtype;
begin
  select * into v_troca from public.trocas_plantao
   where id = p_troca_id and institution_id = public.current_institution_id()
   for update;
  if not found then raise exception 'Troca não encontrada'; end if;
  if v_troca.status <> 'pendente' then raise exception 'Esta troca já foi respondida'; end if;
  if v_troca.destinatario_id is null then
    raise exception 'Esta oferta é aberta ao grupo e não precisa ser recusada';
  end if;
  if v_troca.destinatario_id <> auth.uid() then
    raise exception 'Este convite é de outro profissional';
  end if;

  update public.trocas_plantao
     set status = 'recusada', respondido_por = auth.uid(), respondido_em = now()
   where id = p_troca_id;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_troca.institution_id, auth.uid(), 'plantao', v_troca.plantao_id, 'troca_recusada',
          jsonb_build_object('troca', p_troca_id, 'solicitante', v_troca.solicitante_id));
end;
$$;

/** Desistir do pedido. Só quem pediu — e o administrador, que arruma bagunça. */
create or replace function public.cancelar_troca(p_troca_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_troca public.trocas_plantao%rowtype;
begin
  select * into v_troca from public.trocas_plantao
   where id = p_troca_id and institution_id = public.current_institution_id()
   for update;
  if not found then raise exception 'Troca não encontrada'; end if;
  if v_troca.status <> 'pendente' then raise exception 'Esta troca já foi respondida'; end if;
  if v_troca.solicitante_id <> auth.uid()
     and public.current_app_role() not in ('owner','admin') then
    raise exception 'Só quem pediu a troca pode cancelá-la';
  end if;

  update public.trocas_plantao
     set status = 'cancelada', respondido_por = auth.uid(), respondido_em = now()
   where id = p_troca_id;

  -- Se não sobrou nenhum pedido, o plantão deixa de aparecer como oferecido.
  update public.plantoes p
     set aberto_para_troca = false, updated_at = now()
   where p.id = v_troca.plantao_id
     and not exists (select 1 from public.trocas_plantao t
                      where t.plantao_id = p.id and t.status = 'pendente');
end;
$$;

revoke execute on function public.recusar_troca(uuid)  from public, anon;
revoke execute on function public.cancelar_troca(uuid) from public, anon;
grant  execute on function public.recusar_troca(uuid)  to authenticated;
grant  execute on function public.cancelar_troca(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- aceitar_troca ganha o caso do convite dirigido a quem já não pode
--
-- A versão anterior deixava passar um detalhe: aceitar um plantão que cai em
-- cima de outro que a pessoa já tem. O índice único da tabela recusaria com
-- erro de banco, que na tela vira "algo deu errado" — mensagem que não ajuda
-- ninguém a entender que o problema é conflito de horário.
-- ---------------------------------------------------------------------------
create or replace function public.aceitar_troca(p_troca_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_troca public.trocas_plantao%rowtype; v_plantao public.plantoes%rowtype; v_antigo uuid;
begin
  select * into v_troca from public.trocas_plantao
   where id = p_troca_id and institution_id = public.current_institution_id()
   for update;
  if not found then raise exception 'Troca não encontrada'; end if;

  if v_troca.status <> 'pendente' then raise exception 'Esta troca já foi respondida'; end if;
  if v_troca.solicitante_id = auth.uid() then
    raise exception 'Você não pode aceitar a própria troca';
  end if;
  if v_troca.destinatario_id is not null and v_troca.destinatario_id <> auth.uid() then
    raise exception 'Esta troca foi oferecida a outro profissional';
  end if;

  select * into v_plantao from public.plantoes where id = v_troca.plantao_id;
  if not found then raise exception 'O plantão desta troca não existe mais'; end if;

  if exists (
    select 1 from public.plantoes p
     where p.perfil_id = auth.uid()
       and p.data = v_plantao.data
       and p.hora_inicio = v_plantao.hora_inicio
       and p.situacao <> 'cancelado'
  ) then
    raise exception 'Você já tem um plantão nesse dia e horário';
  end if;

  v_antigo := v_plantao.perfil_id;

  update public.plantoes
     set perfil_id = auth.uid(), aberto_para_troca = false, updated_at = now()
   where id = v_troca.plantao_id;

  update public.trocas_plantao
     set status = 'aceita', respondido_por = auth.uid(), respondido_em = now()
   where id = p_troca_id;

  update public.trocas_plantao
     set status = 'cancelada', respondido_em = now()
   where plantao_id = v_troca.plantao_id and status = 'pendente' and id <> p_troca_id;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_troca.institution_id, auth.uid(), 'plantao', v_troca.plantao_id, 'troca_aceita',
          jsonb_build_object('de', v_antigo, 'para', auth.uid(), 'troca', p_troca_id));
end;
$$;

revoke execute on function public.aceitar_troca(uuid) from public, anon;
grant  execute on function public.aceitar_troca(uuid) to authenticated;
