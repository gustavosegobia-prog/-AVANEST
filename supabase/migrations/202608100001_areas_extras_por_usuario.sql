-- Áreas extras por usuário.
--
-- A coluna `permissoes` já existia e o dashboard já a lia: quem tem
-- role 'financeiro' e permissoes ['recepcao'] enxerga as duas abas. O que
-- faltava era um jeito de preencher essa coluna sem abrir o banco na mão.
--
-- A função de atualizar perfil ganha o parâmetro. Ela é a única porta para
-- essa coluna vinda da tela — a RLS não permite ao usuário editar o próprio
-- perfil, e é assim que continua.

drop function if exists public.admin_atualizar_perfil(uuid, text, text, text, text, text);

create or replace function public.admin_atualizar_perfil(
  p_perfil_id uuid,
  p_role text,
  p_status text,
  p_nome text,
  p_crm text default null,
  p_rqe text default null,
  p_permissoes text[] default null
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfis;
  v_target public.perfis;
  v_permissoes text[];
begin
  select * into v_actor from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_target from public.perfis where id = p_perfil_id;

  if v_actor.id is null or v_target.id is null
     or v_actor.institution_id <> v_target.institution_id
     or v_actor.role not in ('admin','owner') then
    raise exception 'Sem permissão';
  end if;

  if p_role not in ('recepcao','medico','financeiro','admin','owner')
     or p_status not in ('ativo','inativo') then
    raise exception 'Perfil ou status inválido';
  end if;

  if (v_target.role = 'owner' or p_role = 'owner') and v_actor.role <> 'owner' then
    raise exception 'Somente o proprietário pode alterar proprietário';
  end if;

  if p_perfil_id = auth.uid() and p_status <> 'ativo' then
    raise exception 'Você não pode desativar o próprio acesso';
  end if;

  -- Nulo quer dizer "não mexa nas áreas extras": chamadas antigas, feitas
  -- antes desta migração existir, continuam salvando nome e status sem
  -- apagar o que já estava concedido.
  if p_permissoes is null then
    v_permissoes := v_target.permissoes;
  else
    -- Só as quatro áreas do painel. 'owner' fica de fora de propósito: quem
    -- pode virar proprietário se decide pelo campo de perfil, que já tem a
    -- trava acima. Deixar 'owner' entrar por aqui seria uma segunda porta
    -- para a mesma coisa, e sem a mesma tranca.
    select coalesce(array_agg(distinct item order by item), '{}')
      into v_permissoes
      from unnest(p_permissoes) as item
     where item in ('recepcao','medico','financeiro','admin');

    -- A área que já é o perfil principal não precisa constar duas vezes.
    select coalesce(array_agg(item order by item), '{}')
      into v_permissoes
      from unnest(v_permissoes) as item
     where item <> p_role;
  end if;

  update public.perfis
  set role = p_role,
      status = p_status,
      nome = trim(p_nome),
      crm = nullif(trim(coalesce(p_crm,'')), ''),
      rqe = nullif(trim(coalesce(p_rqe,'')), ''),
      permissoes = v_permissoes,
      updated_at = now()
  where id = p_perfil_id
  returning * into v_target;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_actor.institution_id, auth.uid(), 'perfil', v_target.id, 'perfil_atualizado',
    jsonb_build_object('role', p_role, 'status', p_status, 'permissoes', v_permissoes)
  );

  return v_target;
end;
$$;

revoke all on function public.admin_atualizar_perfil(uuid,text,text,text,text,text,text[]) from public, anon;
grant execute on function public.admin_atualizar_perfil(uuid,text,text,text,text,text,text[]) to authenticated;
