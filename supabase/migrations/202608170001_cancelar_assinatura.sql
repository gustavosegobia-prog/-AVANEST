-- ============================================================================
-- Cancelamento da assinatura pela própria conta
--
-- A página de planos promete "sem fidelidade, cancele quando quiser". Até
-- agora isso só existia como frase: não havia por onde cancelar, e a única
-- saída era pedir por WhatsApp. Uma promessa comercial que depende de o
-- vendedor atender o telefone não é uma promessa.
--
-- O ponto delicado é o que acontece com o acesso. Quem paga em 1º de agosto e
-- cancela em 3 de agosto pagou o mês inteiro — cortar na hora seria ficar com
-- o dinheiro e tirar o serviço. Então cancelar aqui quer dizer uma coisa só:
-- não renova mais. O acesso segue até a data que já estava paga, e acaba
-- sozinho quando ela passa.
--
-- Por isso o cancelamento NÃO mexe em `plano` nem em `assinatura_ate`.
-- minha_assinatura() já corta o acesso quando assinatura_ate vence; marcar
-- plano='cancelado' cortaria na mesma hora, que é justamente o que não se
-- quer. A coluna nova só registra a intenção e a data.
-- ============================================================================

alter table public.instituicoes
  add column if not exists cancelada_em timestamptz,
  add column if not exists cancelada_por uuid references auth.users(id) on delete set null,
  add column if not exists cancelamento_motivo text;

comment on column public.instituicoes.cancelada_em is
  'Quando o cliente pediu para não renovar. Não corta o acesso: ele vai até assinatura_ate.';

-- ----------------------------------------------------------------------------
-- Cancelar
--
-- Só dono e administrador da própria organização. É a ação mais forte que a
-- tela oferece, e ninguém cancela a assinatura de outra clínica: a função lê a
-- instituição do perfil de quem chamou, e não aceita isso como parâmetro.
-- ----------------------------------------------------------------------------
create or replace function public.cancelar_assinatura(p_motivo text default null)
returns public.instituicoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.perfis;
  v_instituicao public.instituicoes;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null or v_perfil.role not in ('owner','admin') then
    raise exception 'Somente o proprietário ou o administrador pode cancelar a assinatura';
  end if;

  select * into v_instituicao from public.instituicoes where id = v_perfil.institution_id;
  if v_instituicao.id is null then
    raise exception 'Organização não encontrada';
  end if;
  if v_instituicao.cancelada_em is not null then
    -- Já cancelada: devolve como está, sem carimbar uma data nova por cima da
    -- original. A primeira é a que vale para qualquer conversa depois.
    return v_instituicao;
  end if;

  update public.instituicoes
  set cancelada_em = now(),
      cancelada_por = auth.uid(),
      cancelamento_motivo = nullif(btrim(coalesce(p_motivo,'')), ''),
      updated_at = now()
  where id = v_instituicao.id
  returning * into v_instituicao;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_instituicao.id, auth.uid(), 'assinatura', v_instituicao.id, 'assinatura_cancelada',
    jsonb_build_object(
      'motivo', v_instituicao.cancelamento_motivo,
      'acesso_ate', v_instituicao.assinatura_ate,
      'plano', v_instituicao.plano
    )
  );

  return v_instituicao;
end;
$$;

revoke all on function public.cancelar_assinatura(text) from public, anon;
grant execute on function public.cancelar_assinatura(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Voltar atrás
--
-- Enquanto o período pago não venceu, desfazer é só limpar a marca. Depois de
-- vencido não adianta: aí não é reativar, é assinar de novo, e quem decide o
-- preço nesse caso é a campanha vigente — não a de quando ele saiu.
-- ----------------------------------------------------------------------------
create or replace function public.reativar_assinatura()
returns public.instituicoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.perfis;
  v_instituicao public.instituicoes;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if v_perfil.id is null or v_perfil.role not in ('owner','admin') then
    raise exception 'Somente o proprietário ou o administrador pode reativar a assinatura';
  end if;

  select * into v_instituicao from public.instituicoes where id = v_perfil.institution_id;
  if v_instituicao.cancelada_em is null then
    return v_instituicao;
  end if;
  if v_instituicao.assinatura_ate is not null and v_instituicao.assinatura_ate <= now() then
    raise exception 'O período pago já venceu. Para voltar, é preciso assinar de novo.';
  end if;

  update public.instituicoes
  set cancelada_em = null, cancelada_por = null, cancelamento_motivo = null, updated_at = now()
  where id = v_instituicao.id
  returning * into v_instituicao;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_instituicao.id, auth.uid(), 'assinatura', v_instituicao.id, 'assinatura_reativada',
          jsonb_build_object('acesso_ate', v_instituicao.assinatura_ate));

  return v_instituicao;
end;
$$;

revoke all on function public.reativar_assinatura() from public, anon;
grant execute on function public.reativar_assinatura() to authenticated;

-- ----------------------------------------------------------------------------
-- A tela precisa saber que está cancelada
--
-- Sem esta coluna a mais, a tela mostraria "assinatura ativa até 12/09" a quem
-- acabou de cancelar, e a pessoa cancelaria de novo achando que não pegou.
-- ----------------------------------------------------------------------------
-- Trocar as colunas de retorno exige derrubar antes: o Postgres não deixa
-- um create or replace mudar a assinatura de saída da função.
drop function if exists public.minha_assinatura();

create function public.minha_assinatura()
returns table (
  organizacao text, plano text, assinatura_ate timestamptz,
  dias_restantes integer, profissionais integer, valor_mensal numeric, liberada boolean,
  cancelada_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.nome,
    i.plano,
    i.assinatura_ate,
    case when i.assinatura_ate is null then null
         else greatest(0, extract(day from i.assinatura_ate - now())::integer) end,
    public.contar_profissionais(i.id),
    round(public.contar_profissionais(i.id) * i.valor_por_profissional, 2),
    case
      when i.plano in ('suspenso','cancelado') then false
      when i.assinatura_ate is null then true
      else i.assinatura_ate > now()
    end,
    -- Cancelada não entra no cálculo de `liberada`: o acesso segue até a data
    -- paga. Quem corta é o vencimento, na linha acima.
    i.cancelada_em
  from public.instituicoes i
  join public.perfis p on p.institution_id = i.id
  where p.id = auth.uid() and p.status = 'ativo';
$$;

revoke execute on function public.minha_assinatura() from anon;
grant execute on function public.minha_assinatura() to authenticated;
