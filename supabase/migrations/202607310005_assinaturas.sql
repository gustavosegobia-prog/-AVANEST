-- ============================================================================
-- Assinaturas
--
-- Cobrança por anestesiologista ativo, com 14 dias de teste gratuito.
-- "Anestesiologista" é o usuário ativo com CRM cadastrado — recepção e
-- financeiro não entram na conta.
--
-- O isolamento entre organizações continua sendo responsabilidade do RLS.
-- A assinatura é uma trava comercial, verificada no servidor a cada acesso.
-- ============================================================================

alter table public.instituicoes
  add column if not exists plano text not null default 'trial',
  add column if not exists assinatura_ate timestamptz,
  add column if not exists valor_por_profissional numeric(10,2) not null default 49.99,
  add column if not exists mp_assinatura_id text;

alter table public.instituicoes drop constraint if exists instituicoes_plano_check;
alter table public.instituicoes
  add constraint instituicoes_plano_check check (plano in ('trial','ativo','suspenso','cancelado','cortesia'));

-- As organizações que já existiam não podem ser cobradas retroativamente.
update public.instituicoes
set plano = 'cortesia'
where plano = 'trial' and created_at < now() - interval '1 day' and assinatura_ate is null;

-- O trial das novas organizações começa no cadastro.
update public.instituicoes
set assinatura_ate = created_at + interval '14 days'
where plano = 'trial' and assinatura_ate is null;

-- Quem administra o AVANEST enxerga todas as organizações.
alter table public.perfis
  add column if not exists super_admin boolean not null default false;

-- Quantos anestesiologistas a organização tem hoje.
create or replace function public.contar_profissionais(p_institution_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.perfis
  where institution_id = p_institution_id
    and status = 'ativo'
    and coalesce(trim(crm), '') <> '';
$$;

-- Situação da assinatura de quem está logado, para a tela decidir o que exibir.
-- Cortesia também tem prazo: quem ganhou seis meses volta a pagar no sétimo.
-- Sem data marcada, o acesso é livre — é assim que se concede cortesia eterna.
create or replace function public.minha_assinatura()
returns table (
  organizacao text, plano text, assinatura_ate timestamptz,
  dias_restantes integer, profissionais integer, valor_mensal numeric, liberada boolean
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
    end
  from public.instituicoes i
  join public.perfis p on p.institution_id = i.id
  where p.id = auth.uid() and p.status = 'ativo';
$$;

-- ============================================================================
-- Visão do administrador do AVANEST
-- ============================================================================
-- A função devolve uma coluna chamada "id", então toda referência a perfis
-- precisa de apelido: "where id = auth.uid()" seria ambíguo e derruba a função.
create or replace function public.listar_organizacoes()
returns table (
  id uuid, nome text, tipo text, plano text, assinatura_ate timestamptz,
  profissionais integer, usuarios integer, valor_mensal numeric,
  pacientes integer, avaliacoes integer, criada_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.perfis sa
    where sa.id = auth.uid() and sa.super_admin and sa.status = 'ativo'
  ) then
    raise exception 'Sem permissão';
  end if;
  return query
  select i.id, i.nome, i.tipo, i.plano, i.assinatura_ate,
    public.contar_profissionais(i.id),
    (select count(*)::integer from public.perfis p where p.institution_id = i.id and p.status = 'ativo'),
    round(public.contar_profissionais(i.id) * i.valor_por_profissional, 2),
    (select count(*)::integer from public.pacientes x where x.institution_id = i.id),
    (select count(*)::integer from public.avaliacoes x where x.institution_id = i.id),
    i.created_at
  from public.instituicoes i
  order by i.created_at;
end;
$$;

-- A validade é calculada aqui, com o relógio do banco. O navegador do
-- administrador não decide até quando alguém pagou.
drop function if exists public.definir_assinatura(uuid, text, timestamptz);
create or replace function public.definir_assinatura(
  p_institution_id uuid, p_plano text, p_meses numeric default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text; v_ate timestamptz;
begin
  if not exists (
    select 1 from public.perfis sa
    where sa.id = auth.uid() and sa.super_admin and sa.status = 'ativo'
  ) then
    raise exception 'Sem permissão';
  end if;
  if p_plano not in ('trial','ativo','suspenso','cancelado','cortesia') then
    raise exception 'Plano inválido';
  end if;

  v_ate := case when p_meses is null then null
                else now() + (p_meses || ' months')::interval end;

  update public.instituicoes
  set plano = p_plano, assinatura_ate = v_ate, updated_at = now()
  where id = p_institution_id
  returning nome into v_nome;

  if v_nome is null then raise exception 'Organização não encontrada'; end if;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (p_institution_id, auth.uid(), 'instituicao', p_institution_id, 'assinatura_alterada',
    jsonb_build_object('plano', p_plano, 'ate', v_ate, 'organizacao', v_nome));
end;
$$;

revoke execute on function public.minha_assinatura() from anon;
revoke execute on function public.listar_organizacoes() from anon;
revoke execute on function public.definir_assinatura(uuid,text,numeric) from anon;
revoke execute on function public.contar_profissionais(uuid) from anon;
grant execute on function public.minha_assinatura() to authenticated;
grant execute on function public.listar_organizacoes() to authenticated;
grant execute on function public.definir_assinatura(uuid,text,numeric) to authenticated;
grant execute on function public.contar_profissionais(uuid) to authenticated;
