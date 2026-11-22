-- A confirmação do plantão sai do dia do plantão e vai para quando a escala é
-- lançada (18/11/2026, aplicada em 22/11/2026: "esse negócio de confirmar todo dia é ruim, a pessoa
-- esquece. Na hora que lançar os plantões da equipe, ele tem que olhar e já
-- confirmar o que ele quer. Se não confirmar, tem que anunciar ou passar para
-- algum colega").
--
-- O QUE MUDA:
--   1. Confirmar vale a qualquer hora antes do plantão — é o "eu faço" de quem
--      recebeu a escala. Continua só o próprio profissional confirmando.
--      Desconfirmar também é dele, enquanto o plantão não aconteceu.
--   2. Plantão que muda de dono (a troca aceita), de dia, de horário ou de
--      local perde a confirmação: o novo dono, ou o mesmo num turno diferente,
--      confirma de novo.
--   3. Ninguém confirma mais no dia. Plantão que já terminou e não foi
--      cancelado vira "realizado" sozinho (realizar_plantoes_passados, rodada
--      pelo agendador da Vercel) — confirmado ou não; o "não confirmado" fica à
--      vista de quem monta a escala. Inclui o plantão pessoal: quem o lançou já
--      disse que vai.
--   4. Os que ficaram para trás como "escalado" (setembro a novembro) viram
--      realizados agora, de uma vez (pedido do responsável, 18/11/2026). O que
--      não aconteceu, quem monta a escala marca como cancelado.

-- 1. Confirmar antes do plantão; só quem está nele.
create or replace function public.confirmacao_de_plantao_honesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.confirmado_em is not distinct from old.confirmado_em
     and new.confirmado_por is not distinct from old.confirmado_por then
    return new;
  end if;

  -- Só quem está no plantão confirma ou desfaz. Confirmação que o chefe dá
  -- sozinho é o plano assinando por si mesmo.
  if auth.uid() is not null and new.perfil_id is distinct from auth.uid() then
    raise exception 'Só quem está no plantão pode confirmá-lo';
  end if;

  if new.confirmado_em is null then
    if old.situacao <> 'escalado' then
      raise exception 'Este plantão já aconteceu: a confirmação não muda mais';
    end if;
    new.confirmado_por := null;
    return new;
  end if;

  if new.situacao = 'cancelado' then
    raise exception 'Plantão cancelado não se confirma';
  end if;

  new.confirmado_por := auth.uid();
  new.confirmado_em := coalesce(new.confirmado_em, now());
  return new;
end;
$$;

-- 2. Mudou o plantão, a confirmação era de outro plantão.
create or replace function public.confirmacao_zera_quando_o_plantao_muda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.perfil_id   is distinct from old.perfil_id
     or new.data        is distinct from old.data
     or new.hora_inicio is distinct from old.hora_inicio
     or new.hora_fim    is distinct from old.hora_fim
     or new.local_id    is distinct from old.local_id
     or new.local_texto is distinct from old.local_texto then
    new.confirmado_em := null;
    new.confirmado_por := null;
  end if;
  return new;
end;
$$;
revoke all on function public.confirmacao_zera_quando_o_plantao_muda() from public, anon, authenticated;

drop trigger if exists confirmacao_zera_quando_muda on public.plantoes;
create trigger confirmacao_zera_quando_muda
  before update of perfil_id, data, hora_inicio, hora_fim, local_id, local_texto on public.plantoes
  for each row execute function public.confirmacao_zera_quando_o_plantao_muda();

-- 3. O que já terminou vira realizado. p_agora existe para o teste simular o dia.
create or replace function public.realizar_plantoes_passados(p_agora timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamp := coalesce(p_agora, now()) at time zone 'America/Sao_Paulo';
  v_total integer;
begin
  with feitos as (
    update public.plantoes pl
       set situacao = 'realizado', updated_at = now()
     where pl.situacao = 'escalado'
       -- O fim do turno, no relógio de Brasília (o noturno termina no dia seguinte).
       and pl.data::timestamp + pl.hora_fim
           + case when pl.hora_fim <= pl.hora_inicio then interval '1 day' else interval '0' end
           < v_agora
    returning pl.institution_id, pl.confirmado_em is not null as confirmado
  ), por_organizacao as (
    select institution_id, count(*)::integer as n,
           count(*) filter (where not confirmado)::integer as sem_confirmacao
      from feitos group by 1
  ), registro as (
    insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
    select institution_id, null, 'plantao', null, 'plantoes_realizados',
           jsonb_build_object('automatico', true, 'plantoes', n, 'sem_confirmacao', sem_confirmacao)
      from por_organizacao
    returning 1
  )
  select coalesce(sum(n), 0)::integer into v_total from por_organizacao;
  return v_total;
end;
$$;
revoke all on function public.realizar_plantoes_passados(timestamptz) from public, anon, authenticated;
grant execute on function public.realizar_plantoes_passados(timestamptz) to service_role;

-- 4. Os que ficaram para trás.
select public.realizar_plantoes_passados();
