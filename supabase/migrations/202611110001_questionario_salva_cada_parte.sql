-- O questionário salva cada parte (11/11/2026: "se ele não preencher tudo e
-- esquecer de entrar novamente, já fica salvo pra mim?").
--
-- Antes, o que o paciente respondia ficava só no celular dele até tocar em
-- "Enviar respostas": quem parava no meio e não voltava não deixava nada para
-- o médico. Agora, a cada "Continuar", as respostas vão para o banco. O
-- questionário continua "enviado" (o paciente pode voltar e terminar enquanto
-- o link valer), e o médico vê o que já foi respondido, marcado como
-- incompleto, com as partes que faltaram.
--
-- As respostas parciais se SOMAM às já salvas: quem começou num celular e
-- continuou em outro não apaga o que respondeu no primeiro. A tela do médico
-- limpa o que ficou sem sentido (lib/questionario-pre.ts, limparRespostas).

alter table public.questionarios_pre add column if not exists parte integer;
alter table public.questionarios_pre add column if not exists salvo_em timestamptz;

-- O paciente, sem login, pelo token. Só enquanto o link vale e o
-- questionário não foi enviado; e só com o consentimento, que ele dá na
-- abertura, antes da primeira parte.
create or replace function public.salvar_parte_do_questionario(
  p_token text, p_respostas jsonb, p_parte integer, p_consentimento boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.questionarios_pre;
  v_juntas jsonb;
begin
  select * into v_q from public.questionarios_pre q where q.token = p_token for update;
  if v_q.id is null then raise exception 'Questionário não encontrado'; end if;
  if v_q.status <> 'enviado' or v_q.expires_at <= now() then
    raise exception 'Este link venceu ou já foi respondido.';
  end if;
  if p_consentimento is not true then raise exception 'Falta o seu consentimento.'; end if;
  if p_parte is null or p_parte < 1 or p_parte > 20 then raise exception 'Parte inválida'; end if;
  if p_respostas is null or jsonb_typeof(p_respostas) <> 'object' then raise exception 'Respostas inválidas'; end if;
  v_juntas := coalesce(v_q.respostas, '{}'::jsonb) || p_respostas;
  if octet_length(v_juntas::text) > 60000 then raise exception 'Respostas inválidas'; end if;

  update public.questionarios_pre q
     set respostas = v_juntas,
         parte = greatest(coalesce(q.parte, 0), p_parte),
         salvo_em = now(),
         consentimento_em = coalesce(q.consentimento_em, now()),
         aberto_em = coalesce(q.aberto_em, now())
   where q.id = v_q.id;
  return greatest(coalesce(v_q.parte, 0), p_parte);
end;
$$;

revoke all on function public.salvar_parte_do_questionario(text, jsonb, integer, boolean) from public;
grant execute on function public.salvar_parte_do_questionario(text, jsonb, integer, boolean) to anon, authenticated;

-- A recepção vê "incompleto" quando já há parte salva e o paciente não enviou.
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
         when coalesce(q.parte, 0) > 0 then 'incompleto'
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

-- O médico pode trazer para a ficha também o questionário incompleto.
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
   where q.id = p_id and q.institution_id = public.current_institution_id()
     and (q.status = 'respondido' or (q.status = 'enviado' and q.respostas is not null));
  if v_q.id is null then raise exception 'Questionário não encontrado'; end if;
  update public.questionarios_pre q
     set usado_em = coalesce(q.usado_em, now()), usado_por = coalesce(q.usado_por, auth.uid()),
         avaliacao_id = coalesce(q.avaliacao_id, p_avaliacao_id)
   where q.id = p_id;
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_q.institution_id, auth.uid(), 'questionario_pre', p_id, 'questionario_trazido_para_avaliacao',
          jsonb_build_object('avaliacao', p_avaliacao_id, 'completo', v_q.status = 'respondido'));
end;
$$;
