-- A agenda da Recepção: médico da consulta, histórico de situação,
-- transições válidas no banco e reagendamento que preserva o registro.
--
-- O QUE JÁ EXISTIA E CONTINUA: os seis estados de agendamentos.status
-- (agendado, confirmado, presente, faltou, cancelado, reagendado), a função
-- registrar_presenca (com a auditoria e a limpeza do lançamento vazio ao
-- desmarcar) e as regras de acesso da tabela. Nada é renomeado nem apagado.
--
-- O QUE FALTAVA:
--  1. status_at/status_by guardavam só a ÚLTIMA mudança. Agora cada mudança
--     vira uma linha em agendamento_eventos (quem, quando, de, para). Os
--     registros antigos recebem apenas o que de fato está gravado: a criação
--     (created_at/created_by) e as mudanças que a auditoria registrou — sem
--     "de" quando ele não foi guardado. Nada é inventado.
--  2. Qualquer transição era aceita — inclusive "presente" numa consulta da
--     semana que vem, ou desfazer a chegada de quem já está em avaliação. As
--     regras passam a valer no banco, para a função e para o update direto.
--  3. Não havia médico na consulta. medico_id é opcional; sem ele, a agenda
--     usa quem iniciou a avaliação, quando houver.
--  4. Reagendar marca a consulta antiga como "reagendado" e cria a nova,
--     ligada a ela por reagendado_de — as duas ficam no histórico.

alter table public.agendamentos
  add column if not exists medico_id uuid references public.perfis(id) on delete set null,
  add column if not exists reagendado_de uuid references public.agendamentos(id) on delete set null;

create index if not exists agendamentos_instituicao_data on public.agendamentos (institution_id, data);

-- ── Histórico ──────────────────────────────────────────────────────────────

create table if not exists public.agendamento_eventos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  de text,
  para text not null,
  por uuid references public.perfis(id) on delete set null,
  em timestamptz not null default now(),
  -- 'registro' = gravado no momento da mudança; 'auditoria' e 'ultima_mudanca'
  -- = trazido de registros anteriores a esta tabela; 'criacao' = a marcação.
  origem text not null default 'registro'
    check (origem in ('registro', 'criacao', 'auditoria', 'ultima_mudanca')),
  detalhe text
);
create index if not exists agendamento_eventos_por_agendamento on public.agendamento_eventos (agendamento_id, em);

alter table public.agendamento_eventos enable row level security;

-- Lê quem lê a agenda. Ninguém escreve direto: só os gatilhos abaixo.
drop policy if exists agenda_le_eventos on public.agendamento_eventos;
create policy agenda_le_eventos on public.agendamento_eventos
  for select to authenticated
  using (
    institution_id = (select public.current_institution_id())
    and (
      (select public.current_app_role()) = any (array['recepcao', 'medico', 'admin', 'owner'])
      or (select public.current_has_permission('recepcao'))
      or (select public.current_has_permission('medico'))
    )
  );
revoke insert, update, delete, truncate on public.agendamento_eventos from anon, authenticated;
grant select on public.agendamento_eventos to authenticated;

-- ── Transições válidas ─────────────────────────────────────────────────────

create or replace function public.transicao_de_agendamento_valida(
  p_de text, p_para text, p_data date, p_tem_avaliacao boolean
) returns text
language sql stable
as $$
  -- Devolve NULL quando pode; senão, o motivo.
  select case
    when p_de = p_para then null
    when p_de = 'reagendado' then 'Esta consulta foi reagendada: altere a nova marcação.'
    when p_para in ('presente', 'faltou')
         and p_data > (now() at time zone 'America/Sao_Paulo')::date
      then 'Chegada e falta só podem ser registradas no dia da consulta ou depois.'
    when p_de = 'presente' and p_tem_avaliacao
      then 'O atendimento já começou: a chegada não pode mais ser desfeita.'
    when p_de = 'presente' and p_para not in ('agendado', 'confirmado')
      then 'Paciente já chegou: desfaça a chegada antes de mudar a situação.'
    when p_de in ('faltou', 'cancelado') and p_para not in ('agendado', 'reagendado')
      then 'Reative a consulta antes de mudar a situação.'
    when p_para = 'reagendado' and p_de not in ('agendado', 'confirmado', 'faltou', 'cancelado')
      then 'Só consultas que ainda não aconteceram podem ser reagendadas.'
    else null
  end
$$;

create or replace function public.agendamento_antes_de_gravar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_motivo text;
begin
  if new.medico_id is not null
     and (tg_op = 'INSERT' or new.medico_id is distinct from old.medico_id)
     and not exists (select 1 from public.perfis p
                     where p.id = new.medico_id and p.institution_id = new.institution_id) then
    raise exception 'Médico não encontrado nesta organização.';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    v_motivo := public.transicao_de_agendamento_valida(old.status, new.status, old.data, old.avaliacao_id is not null);
    if v_motivo is not null then
      raise exception '%', v_motivo using errcode = 'P0001';
    end if;
    -- Quem e quando vêm do banco, não da tela: um update direto não escolhe
    -- o próprio carimbo.
    new.status_by := coalesce(auth.uid(), new.status_by);
    new.status_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists agendamento_antes_de_gravar on public.agendamentos;
create trigger agendamento_antes_de_gravar
  before insert or update on public.agendamentos
  for each row execute function public.agendamento_antes_de_gravar();

create or replace function public.agendamento_registra_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.agendamento_eventos (institution_id, agendamento_id, de, para, por, em, origem, detalhe)
    values (new.institution_id, new.id, null, new.status, coalesce(new.created_by, auth.uid()), new.created_at, 'criacao',
            case when new.reagendado_de is not null then 'reagendamento' end);
  elsif new.status is distinct from old.status then
    insert into public.agendamento_eventos (institution_id, agendamento_id, de, para, por, em, origem)
    values (new.institution_id, new.id, old.status, new.status, coalesce(auth.uid(), new.status_by), now(), 'registro');
  end if;
  return null;
end;
$$;
revoke execute on function public.agendamento_registra_evento() from public, anon, authenticated;
revoke execute on function public.agendamento_antes_de_gravar() from public, anon, authenticated;

drop trigger if exists agendamento_registra_evento on public.agendamentos;
create trigger agendamento_registra_evento
  after insert or update on public.agendamentos
  for each row execute function public.agendamento_registra_evento();

-- ── O que já estava gravado, e só isso ─────────────────────────────────────

insert into public.agendamento_eventos (institution_id, agendamento_id, de, para, por, em, origem)
select a.institution_id, a.id, null, 'agendado', a.created_by, a.created_at, 'criacao'
from public.agendamentos a
where not exists (select 1 from public.agendamento_eventos e where e.agendamento_id = a.id and e.origem = 'criacao');

insert into public.agendamento_eventos (institution_id, agendamento_id, de, para, por, em, origem)
select au.institution_id, au.entidade_id, null, au.detalhes->>'status', au.actor_id, au.created_at, 'auditoria'
from public.auditoria au
join public.agendamentos a on a.id = au.entidade_id
where au.entidade = 'agendamento' and au.acao = 'status_alterado' and au.detalhes ? 'status'
  and not exists (select 1 from public.agendamento_eventos e
                  where e.agendamento_id = au.entidade_id and e.origem = 'auditoria' and e.em = au.created_at);

-- A última mudança guardada na própria linha, quando a auditoria não a tem.
insert into public.agendamento_eventos (institution_id, agendamento_id, de, para, por, em, origem)
select a.institution_id, a.id, null, a.status, a.status_by, a.status_at, 'ultima_mudanca'
from public.agendamentos a
where a.status_at is not null
  and not exists (select 1 from public.agendamento_eventos e
                  where e.agendamento_id = a.id and e.para = a.status and e.origem in ('auditoria', 'ultima_mudanca', 'registro'));

-- ── Criação com médico ─────────────────────────────────────────────────────

create or replace function public.criar_paciente_e_agendamento(p_paciente jsonb, p_agendamento jsonb)
returns jsonb
language plpgsql
set search_path = public
as $function$
declare
  v_paciente public.pacientes;
  v_agendamento public.agendamentos;
begin
  insert into public.pacientes (
    institution_id, created_by, nome, cpf, rg, data_nascimento, sexo, telefone, email,
    endereco, cidade, uf, cep, hospital, cirurgia, especialidade, procedimento, convenio,
    numero_carteirinha, validade, plano, data_consulta, horario, observacoes
  ) values (
    (p_paciente->>'institution_id')::uuid,
    nullif(p_paciente->>'created_by', '')::uuid,
    p_paciente->>'nome', nullif(p_paciente->>'cpf',''), nullif(p_paciente->>'rg',''),
    nullif(p_paciente->>'data_nascimento','')::date, nullif(p_paciente->>'sexo',''),
    nullif(p_paciente->>'telefone',''), nullif(p_paciente->>'email',''), nullif(p_paciente->>'endereco',''),
    nullif(p_paciente->>'cidade',''), nullif(p_paciente->>'uf',''), nullif(p_paciente->>'cep',''),
    nullif(p_paciente->>'hospital',''), nullif(p_paciente->>'cirurgia',''), nullif(p_paciente->>'especialidade',''),
    nullif(p_paciente->>'procedimento',''), nullif(p_paciente->>'convenio',''),
    nullif(p_paciente->>'numero_carteirinha',''), nullif(p_paciente->>'validade','')::date,
    nullif(p_paciente->>'plano',''), nullif(p_paciente->>'data_consulta','')::date,
    nullif(p_paciente->>'horario','')::time, nullif(p_paciente->>'observacoes','')
  ) returning * into v_paciente;

  insert into public.agendamentos (
    institution_id, patient_id, data, horario, hospital, procedimento, convenio, observacoes, created_by, medico_id
  ) values (
    v_paciente.institution_id, v_paciente.id, (p_agendamento->>'data')::date,
    nullif(p_agendamento->>'horario','')::time, nullif(p_agendamento->>'hospital',''),
    nullif(p_agendamento->>'procedimento',''), nullif(p_agendamento->>'convenio',''),
    nullif(p_agendamento->>'observacoes',''), nullif(p_agendamento->>'created_by','')::uuid,
    nullif(p_agendamento->>'medico_id','')::uuid
  ) returning * into v_agendamento;

  return jsonb_build_object('patient_id', v_paciente.id, 'appointment_id', v_agendamento.id);
end;
$function$;

-- ── Reagendar ──────────────────────────────────────────────────────────────

create or replace function public.reagendar_consulta(
  p_agendamento_id uuid, p_data date, p_horario time, p_medico_id uuid default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_antigo public.agendamentos;
  v_novo uuid;
begin
  select * into v_antigo from public.agendamentos where id = p_agendamento_id;
  if v_antigo.id is null then
    raise exception 'Agendamento não encontrado ou sem permissão';
  end if;
  if p_data < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A nova data não pode ser anterior a hoje.';
  end if;
  if p_horario is not null and exists (
    select 1 from public.agendamentos
    where institution_id = v_antigo.institution_id and data = p_data and horario = p_horario
      and status not in ('cancelado', 'reagendado') and id <> v_antigo.id
  ) then
    raise exception 'Já existe uma consulta às % nesta data.', to_char(p_horario, 'HH24:MI');
  end if;

  -- A antiga vira "reagendado" pelo caminho de sempre: auditoria e limpeza
  -- do lançamento vazio, como no desmarcar.
  perform public.registrar_presenca(v_antigo.id, 'reagendado');

  insert into public.agendamentos (
    institution_id, patient_id, data, horario, hospital, procedimento, convenio, observacoes,
    created_by, medico_id, reagendado_de
  ) values (
    v_antigo.institution_id, v_antigo.patient_id, p_data, p_horario, v_antigo.hospital,
    v_antigo.procedimento, v_antigo.convenio, v_antigo.observacoes,
    auth.uid(), coalesce(p_medico_id, v_antigo.medico_id), v_antigo.id
  ) returning id into v_novo;

  return v_novo;
end;
$$;
revoke execute on function public.reagendar_consulta(uuid, date, time, uuid) from public, anon;
grant execute on function public.reagendar_consulta(uuid, date, time, uuid) to authenticated;

-- ── O andamento sem o conteúdo clínico ─────────────────────────────────────
--
-- A recepção não lê avaliações (RLS de avaliacoes). Para saber se o paciente
-- está EM ATENDIMENTO ou se o atendimento foi CONCLUÍDO, ela recebe só isto:
-- a etapa e quem atende. Nenhum campo da avaliação sai daqui.

create or replace function public.andamento_da_agenda(p_de date, p_ate date)
returns table (agendamento_id uuid, etapa text, medico_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select a.id,
         case av.status when 'concluida' then 'concluido' when 'rascunho' then 'em_atendimento' end,
         coalesce(a.medico_id, av.created_by)
  from public.agendamentos a
  left join public.avaliacoes av on av.id = a.avaliacao_id
  where a.institution_id = public.current_institution_id()
    and a.data between p_de and p_ate
    and (
      public.current_app_role() = any (array['recepcao', 'medico', 'admin', 'owner'])
      or public.current_has_permission('recepcao')
      or public.current_has_permission('medico')
    )
$$;
revoke execute on function public.andamento_da_agenda(date, date) from public, anon;
grant execute on function public.andamento_da_agenda(date, date) to authenticated;

-- Quem pode ser o médico da consulta: só nome e id.
create or replace function public.medicos_da_organizacao()
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome
  from public.perfis p
  where p.institution_id = public.current_institution_id()
    and p.status = 'ativo'
    and coalesce(p.atuacao_medica, p.role = 'medico')
    and (
      public.current_app_role() = any (array['recepcao', 'medico', 'admin', 'owner'])
      or public.current_has_permission('recepcao')
      or public.current_has_permission('medico')
    )
  order by p.nome
$$;
revoke execute on function public.medicos_da_organizacao() from public, anon;
grant execute on function public.medicos_da_organizacao() to authenticated;
