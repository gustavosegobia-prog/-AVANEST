-- A troca de médico da consulta entra no histórico.
--
-- Até aqui o histórico só guardava a SITUAÇÃO (agendado → chegou → …). Quem
-- era o médico, e quando mudou, não ficava em lugar nenhum. Isso virou falha
-- quando o médico passou a poder assumir o paciente de um colega pela área
-- médica: a consulta continuava no nome do primeiro, na lista dele e na
-- recepção, enquanto outro avaliava. Agora quem inicia a avaliação vira o
-- médico da consulta (dashboard-client.tsx), e o gatilho registra a troca —
-- de quem, para quem, por quem e quando.
--
-- 'assumiu' = o próprio médico se pôs na consulta; 'indicado' = alguém (a
-- recepção, a administração) escolheu o médico.

alter table public.agendamento_eventos
  add column if not exists medico_de uuid references public.perfis(id) on delete set null,
  add column if not exists medico_para uuid references public.perfis(id) on delete set null;

alter table public.agendamento_eventos drop constraint if exists agendamento_eventos_origem_check;
alter table public.agendamento_eventos add constraint agendamento_eventos_origem_check
  check (origem in ('registro', 'criacao', 'auditoria', 'ultima_mudanca', 'medico'));

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
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.agendamento_eventos (institution_id, agendamento_id, de, para, por, em, origem)
    values (new.institution_id, new.id, old.status, new.status, coalesce(auth.uid(), new.status_by), now(), 'registro');
  end if;

  if new.medico_id is distinct from old.medico_id then
    insert into public.agendamento_eventos
      (institution_id, agendamento_id, de, para, por, em, origem, detalhe, medico_de, medico_para)
    values (new.institution_id, new.id, old.status, new.status, auth.uid(), now(), 'medico',
            case when new.medico_id is not null and new.medico_id = auth.uid() then 'assumiu' else 'indicado' end,
            old.medico_id, new.medico_id);
  end if;
  return null;
end;
$$;
revoke execute on function public.agendamento_registra_evento() from public, anon, authenticated;
