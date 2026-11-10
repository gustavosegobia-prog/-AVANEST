-- O questionário pré-anestésico que o paciente responde pelo celular.
--
-- A recepção manda pelo WhatsApp um link pessoal (/q/<token>) que vale 7
-- dias. O paciente responde sem login, e pode mandar foto da receita. Na
-- consulta, o médico lê as respostas na avaliação (lib/questionario-pre.ts).
--
-- QUEM VÊ O QUÊ. A regra é a da avaliação: o conteúdo é dado clínico e fica
-- com quem tem a permissão de médico. A recepção manda o link e vê só a
-- situação (enviado, aberto, respondido, vencido), pela função própria, nunca
-- a tabela. O paciente, sem login, só alcança o próprio questionário, pelo
-- token, e só para responder: depois de enviado, nem ele lê de volta.
--
-- O TOKEN. Dois UUID aleatórios, 64 caracteres: impossível de adivinhar. Sem
-- pgcrypto de propósito, porque gen_random_uuid() é do Postgres e não depende
-- do esquema das extensões dentro das funções com search_path fixo.

create table if not exists public.questionarios_pre (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  patient_id uuid not null references public.pacientes(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status text not null default 'enviado' check (status in ('enviado', 'respondido', 'cancelado')),
  respostas jsonb,
  fotos text[] not null default '{}',
  consentimento_em timestamptz,
  enviado_em timestamptz,
  aberto_em timestamptz,
  respondido_em timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  usado_por uuid references public.perfis(id) on delete set null,
  avaliacao_id uuid,
  created_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists questionarios_pre_do_paciente_idx
  on public.questionarios_pre (institution_id, patient_id, created_at desc);

alter table public.questionarios_pre enable row level security;
revoke all on public.questionarios_pre from anon, authenticated;
grant select on public.questionarios_pre to authenticated;

-- Só leitura, e só para quem atende. Criar, responder e marcar como usado
-- passam pelas funções abaixo.
drop policy if exists questionarios_pre_medico_le on public.questionarios_pre;
create policy questionarios_pre_medico_le on public.questionarios_pre
  for select to authenticated
  using (institution_id = (select public.current_institution_id())
         and (select public.current_has_permission('medico')));

-- ── A recepção manda o link ───────────────────────────────────────────────
-- Um questionário aberto por paciente: mandar de novo reaproveita o mesmo
-- link e renova o prazo. Assim o paciente que já começou não perde o que
-- respondeu, e não ficam dois links valendo.
create or replace function public.criar_questionario(p_patient_id uuid, p_agendamento_id uuid default null)
returns table (id uuid, token text, expires_at timestamptz, organizacao text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid := public.current_institution_id();
  v_q public.questionarios_pre;
begin
  if v_inst is null or not (public.current_has_permission('recepcao') or public.current_has_permission('medico')) then
    raise exception 'Sem permissão';
  end if;
  if not exists (select 1 from public.pacientes p where p.id = p_patient_id and p.institution_id = v_inst) then
    raise exception 'Paciente não encontrado';
  end if;
  if p_agendamento_id is not null and not exists (
    select 1 from public.agendamentos a where a.id = p_agendamento_id and a.institution_id = v_inst and a.patient_id = p_patient_id
  ) then
    raise exception 'Consulta não encontrada';
  end if;

  update public.questionarios_pre q
     set expires_at = now() + interval '7 days',
         agendamento_id = coalesce(p_agendamento_id, q.agendamento_id)
   where q.institution_id = v_inst and q.patient_id = p_patient_id
     and q.status = 'enviado' and q.expires_at > now()
  returning * into v_q;

  if v_q.id is null then
    insert into public.questionarios_pre (institution_id, patient_id, agendamento_id, created_by)
    values (v_inst, p_patient_id, p_agendamento_id, auth.uid())
    returning * into v_q;
  end if;

  return query select v_q.id, v_q.token, v_q.expires_at, (select i.nome from public.instituicoes i where i.id = v_inst);
end;
$$;

revoke all on function public.criar_questionario(uuid, uuid) from public, anon;
grant execute on function public.criar_questionario(uuid, uuid) to authenticated;

-- Criar prepara o link; enviado é quando a recepção abre o WhatsApp ou copia
-- a mensagem. Sem a diferença, quem abriu a janela e desistiu veria
-- "Questionário enviado" na agenda de um paciente que não recebeu nada.
create or replace function public.registrar_envio_do_questionario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.questionarios_pre;
begin
  if not (public.current_has_permission('recepcao') or public.current_has_permission('medico')) then
    raise exception 'Sem permissão';
  end if;
  update public.questionarios_pre q set enviado_em = now()
   where q.id = p_id and q.institution_id = public.current_institution_id() and q.status = 'enviado'
  returning * into v_q;
  if v_q.id is null then raise exception 'Questionário não encontrado'; end if;
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_q.institution_id, auth.uid(), 'questionario_pre', v_q.id, 'questionario_enviado',
          jsonb_build_object('paciente', v_q.patient_id, 'agendamento', v_q.agendamento_id));
end;
$$;

revoke all on function public.registrar_envio_do_questionario(uuid) from public, anon;
grant execute on function public.registrar_envio_do_questionario(uuid) to authenticated;

-- ── A situação, para a agenda da recepção ─────────────────────────────────
-- O último questionário de cada paciente, sem nenhuma resposta. O link só
-- preparado, sem envio, não aparece.
create or replace function public.situacao_dos_questionarios(p_patient_ids uuid[])
returns table (patient_id uuid, agendamento_id uuid, situacao text, enviado_em timestamptz,
               respondido_em timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (q.patient_id)
    q.patient_id, q.agendamento_id,
    case when q.status = 'respondido' then 'respondido'
         when q.status = 'cancelado' then 'cancelado'
         when q.expires_at <= now() then 'vencido'
         when q.aberto_em is not null then 'aberto'
         else 'enviado' end,
    q.enviado_em, q.respondido_em, q.expires_at
  from public.questionarios_pre q
  where q.institution_id = public.current_institution_id()
    and (public.current_has_permission('recepcao') or public.current_has_permission('medico'))
    and q.patient_id = any(p_patient_ids)
    and (q.enviado_em is not null or q.status <> 'enviado')
  order by q.patient_id, q.created_at desc;
$$;

revoke all on function public.situacao_dos_questionarios(uuid[]) from public, anon;
grant execute on function public.situacao_dos_questionarios(uuid[]) to authenticated;

-- ── O paciente, sem login ─────────────────────────────────────────────────
-- Só o primeiro nome, o nome do grupo e o sexo do cadastro (a pergunta da
-- gestação depende dele). Nada mais do cadastro sai pelo link.
--
-- Ler não marca "aberto". O WhatsApp abre o link sozinho para montar a
-- prévia, no celular de quem manda, e a recepção veria "aberto" num
-- questionário que o paciente nem viu. Quem marca é a página, já no celular
-- do paciente (marcar_questionario_aberto), e robô de prévia não roda script.
create or replace function public.questionario_publico(p_token text)
returns table (situacao text, primeiro_nome text, organizacao text, sexo text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select case when q.status = 'respondido' then 'respondido'
              when q.status = 'cancelado' then 'cancelado'
              when q.expires_at <= now() then 'vencido'
              else 'aberto' end,
         initcap(split_part(trim(p.nome), ' ', 1)),
         i.nome, p.sexo, q.expires_at
    from public.questionarios_pre q
    join public.pacientes p on p.id = q.patient_id
    join public.instituicoes i on i.id = q.institution_id
   where q.token = p_token;
$$;

revoke all on function public.questionario_publico(text) from public;
grant execute on function public.questionario_publico(text) to anon, authenticated;

create or replace function public.marcar_questionario_aberto(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.questionarios_pre q set aberto_em = now()
   where q.token = p_token and q.status = 'enviado' and q.expires_at > now() and q.aberto_em is null;
$$;

revoke all on function public.marcar_questionario_aberto(text) from public;
grant execute on function public.marcar_questionario_aberto(text) to anon, authenticated;

-- Responde uma vez só. Corrigir alguma coisa fica para a consulta: o médico
-- pode já ter lido, e uma resposta trocada depois não teria registro.
create or replace function public.responder_questionario(p_token text, p_respostas jsonb, p_consentimento boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.questionarios_pre;
begin
  select * into v_q from public.questionarios_pre q where q.token = p_token for update;
  if v_q.id is null then raise exception 'Questionário não encontrado'; end if;
  if v_q.status = 'respondido' then raise exception 'Este questionário já foi respondido.'; end if;
  if v_q.status <> 'enviado' or v_q.expires_at <= now() then
    raise exception 'Este link venceu. Peça um novo à recepção.';
  end if;
  if p_consentimento is not true then raise exception 'Falta o seu consentimento.'; end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' or octet_length(p_respostas::text) > 60000 then
    raise exception 'Respostas inválidas';
  end if;

  update public.questionarios_pre q
     set respostas = p_respostas, status = 'respondido', respondido_em = now(), consentimento_em = now(),
         aberto_em = coalesce(q.aberto_em, now())
   where q.id = v_q.id;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_q.institution_id, null, 'questionario_pre', v_q.id, 'questionario_respondido',
          jsonb_build_object('paciente', v_q.patient_id, 'fotos', cardinality(v_q.fotos)));
  return 'respondido';
end;
$$;

revoke all on function public.responder_questionario(text, jsonb, boolean) from public;
grant execute on function public.responder_questionario(text, jsonb, boolean) to anon, authenticated;

-- ── As fotos da receita ───────────────────────────────────────────────────
-- Quem grava o arquivo é a rota /api/questionario/[token]/foto, com a chave
-- do servidor: o paciente não tem login para o Storage. Estas duas funções
-- são só dela.
create or replace function public.anexar_foto_do_questionario(p_id uuid, p_caminho text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.questionarios_pre q
     set fotos = array_append(q.fotos, p_caminho)
   where q.id = p_id and q.status = 'enviado' and q.expires_at > now()
     and cardinality(q.fotos) < 4
     and p_caminho like q.institution_id::text || '/' || q.id::text || '/%'
  returning cardinality(q.fotos) into v_n;
  if v_n is null then raise exception 'Não foi possível guardar a foto.'; end if;
  return v_n;
end;
$$;

create or replace function public.tirar_foto_do_questionario(p_id uuid, p_caminho text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.questionarios_pre q
     set fotos = array_remove(q.fotos, p_caminho)
   where q.id = p_id and q.status = 'enviado' and q.expires_at > now() and p_caminho = any(q.fotos)
  returning cardinality(q.fotos) into v_n;
  if v_n is null then raise exception 'Foto não encontrada.'; end if;
  return v_n;
end;
$$;

revoke all on function public.anexar_foto_do_questionario(uuid, text) from public, anon, authenticated;
revoke all on function public.tirar_foto_do_questionario(uuid, text) from public, anon, authenticated;
grant execute on function public.anexar_foto_do_questionario(uuid, text) to service_role;
grant execute on function public.tirar_foto_do_questionario(uuid, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('questionarios', 'questionarios', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- O médico lê a foto da própria organização (pasta = organização).
drop policy if exists questionarios_medico_le on storage.objects;
create policy questionarios_medico_le on storage.objects
  for select to authenticated
  using (bucket_id = 'questionarios'
         and (storage.foldername(name))[1] = (select public.current_institution_id())::text
         and (select public.current_has_permission('medico')));

-- ── O médico traz as respostas para a avaliação ───────────────────────────
create or replace function public.marcar_questionario_usado(p_id uuid, p_avaliacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.questionarios_pre;
begin
  if not public.current_has_permission('medico') then raise exception 'Sem permissão'; end if;
  select * into v_q from public.questionarios_pre q
   where q.id = p_id and q.institution_id = public.current_institution_id() and q.status = 'respondido';
  if v_q.id is null then raise exception 'Questionário não encontrado'; end if;
  update public.questionarios_pre q
     set usado_em = coalesce(q.usado_em, now()), usado_por = coalesce(q.usado_por, auth.uid()),
         avaliacao_id = coalesce(q.avaliacao_id, p_avaliacao_id)
   where q.id = p_id;
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_q.institution_id, auth.uid(), 'questionario_pre', p_id, 'questionario_trazido_para_avaliacao',
          jsonb_build_object('avaliacao', p_avaliacao_id));
end;
$$;

revoke all on function public.marcar_questionario_usado(uuid, uuid) from public, anon;
grant execute on function public.marcar_questionario_usado(uuid, uuid) to authenticated;
