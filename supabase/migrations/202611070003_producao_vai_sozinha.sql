-- ============================================================================
-- A produção vai sozinha ao financeiro, todo dia, para quem escolher
--
-- Pedido de 07/11/2026: "enviar todo final do dia. Ele vai acumulando para o
-- financeiro". Até aqui o envio era só pelo botão "Enviar ao financeiro", que
-- manda o mês.
--
-- POR PESSOA, E NÃO PELA ORGANIZAÇÃO. A tela de produção promete ao médico
-- que a lista é dele até ele enviar ("nem o administrador enxerga"). Ligar
-- para o grupo inteiro mostraria ao financeiro a produção de quem não pediu.
-- Cada um liga na própria tela; começa desligado para todos.
--
-- A rotina roda depois da meia-noite (app/api/producao/enviar-do-dia, pelo
-- agendador da Vercel) e manda o que é de ONTEM para trás e ainda não foi:
-- o dia de hoje fica aberto, e o lançado tarde vai na noite seguinte. Depois
-- de enviado o médico continua corrigindo, como já era; "Desfazer envio"
-- continua valendo, e o que voltar é reenviado na noite seguinte.
--
-- Não apaga nada.
-- ============================================================================

alter table public.perfis
  add column if not exists producao_vai_sozinha boolean not null default false;

-- Ligar ou desligar, só o próprio. A escolha fica na auditoria.
create or replace function public.definir_producao_vai_sozinha(p_ligado boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_inst uuid;
begin
  if auth.uid() is null or p_ligado is null then
    raise exception 'Não autorizado.';
  end if;
  update public.perfis set producao_vai_sozinha = p_ligado
   where id = auth.uid() and status = 'ativo'
  returning institution_id into v_inst;
  if not found then
    raise exception 'Não autorizado.';
  end if;
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_inst, auth.uid(), 'perfil', auth.uid(), 'producao_vai_sozinha', jsonb_build_object('ligado', p_ligado));
  return p_ligado;
end;
$$;

revoke all on function public.definir_producao_vai_sozinha(boolean) from public, anon;
grant execute on function public.definir_producao_vai_sozinha(boolean) to authenticated;

-- A rotina da noite: o que é até `p_ate` (ontem), de quem ligou, ainda não
-- enviado. Uma linha de auditoria por pessoa, como o envio pelo botão.
create or replace function public.enviar_producao_sozinha(p_ate date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_total integer;
begin
  -- Nunca o dia que ainda está correndo, nem depois dele.
  if p_ate is null or p_ate >= (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data inválida: a rotina manda só até ontem.';
  end if;

  with enviados as (
    update public.producao_do_dia pr
       set enviado_em = now()
      from public.perfis pf
     where pf.id = pr.perfil_id
       and pf.institution_id = pr.institution_id
       and pf.status = 'ativo'
       and pf.producao_vai_sozinha
       and pr.enviado_em is null
       and pr.data <= p_ate
    returning pr.institution_id, pr.perfil_id
  ), por_pessoa as (
    select institution_id, perfil_id, count(*)::integer as n from enviados group by 1, 2
  ), registro as (
    insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
    select institution_id, perfil_id, 'producao', null, 'producao_enviada',
           jsonb_build_object('automatico', true, 'ate', p_ate, 'itens', n)
      from por_pessoa
    returning 1
  )
  select coalesce(sum(n), 0)::integer into v_total from por_pessoa;
  return v_total;
end;
$$;

revoke all on function public.enviar_producao_sozinha(date) from public, anon, authenticated;
grant execute on function public.enviar_producao_sozinha(date) to service_role;
