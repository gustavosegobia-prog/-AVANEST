-- ===========================================================================
-- Local em preparação: some para todos, menos para quem o escondeu
-- ===========================================================================
-- A primeira versão desta regra dizia "quem administra vê". Numa organização
-- com dois administradores isso é vazamento: o hospital que ainda não foi
-- anunciado aparece para o outro administrador, que não estava na conversa.
--
-- Agora o local guarda QUEM o escondeu, e só essa pessoa o enxerga.
--
-- O dono da organização enxerga junto, e não é exceção de conveniência: sem
-- ela, o administrador que escondeu um local e depois saiu do grupo levaria
-- o hospital embora — ninguém mais conseguiria reativá-lo, nem saberia que
-- ele existe. O dono é quem responde pela organização; ele é o fundo do poço.
-- ===========================================================================

alter table public.locais_atendimento
  add column if not exists oculto_por uuid references public.perfis(id) on delete set null;

comment on column public.locais_atendimento.oculto_por is
  'Quem escondeu o local. Só essa pessoa — e o dono da organização — o enxerga '
  'enquanto oculto for verdadeiro.';

-- Locais já escondidos antes desta regra ficam visíveis a quem é dono, que é
-- o comportamento anterior aplicado à pessoa certa. Sem isto eles sumiriam
-- para todo mundo no instante em que esta migração rodasse.
update public.locais_atendimento l
   set oculto_por = (
     select p.id from public.perfis p
      where p.institution_id = l.institution_id and p.role = 'owner'
      order by p.created_at limit 1)
 where l.oculto and l.oculto_por is null;

-- ---------------------------------------------------------------------------
-- A mesma frase, nos três lugares onde a regra precisa valer
-- ---------------------------------------------------------------------------
drop policy if exists "equipe_le_locais" on public.locais_atendimento;
create policy "equipe_le_locais" on public.locais_atendimento
  for select using (
    institution_id = public.current_institution_id()
    and (owner_id is null or owner_id = auth.uid())
    and (
      oculto = false
      or oculto_por = auth.uid()
      or public.current_app_role() = 'owner'
    )
  );

drop function if exists public.meus_locais();

create or replace function public.meus_locais()
returns table (
  id uuid, nome text, nome_fantasia text, tipo text, cidade text, estado text,
  logo_url text, grupo_anestesia text, particular boolean, ativo boolean,
  oculto boolean, usado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.nome, l.nome_fantasia, l.tipo, l.cidade, l.estado,
         l.logo_url, l.grupo_anestesia, l.owner_id is not null, l.ativo,
         l.oculto, r.usado_em
    from public.locais_atendimento l
    left join public.locais_recentes r
           on r.local_id = l.id and r.perfil_id = auth.uid()
   where l.institution_id = public.current_institution_id()
     and (l.owner_id is null or l.owner_id = auth.uid())
   -- Arquivado continua aparecendo para quem administra, para poder reativar.
     and (l.ativo or public.current_app_role() in ('owner','admin'))
   -- Em preparação: só quem escondeu, e o dono da organização.
     and (l.oculto = false or l.oculto_por = auth.uid()
          or public.current_app_role() = 'owner')
   order by r.usado_em desc nulls last, l.nome;
$$;

create or replace function public.selecionar_local(p_local_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  select true into v_ok
    from public.locais_atendimento l
   where l.id = p_local_id
     and l.ativo
     and l.institution_id = public.current_institution_id()
     and (l.owner_id is null or l.owner_id = auth.uid())
     and (l.oculto = false or l.oculto_por = auth.uid()
          or public.current_app_role() = 'owner');

  if not coalesce(v_ok, false) then
    return false;
  end if;

  insert into public.locais_recentes (perfil_id, local_id, usado_em)
  values (auth.uid(), p_local_id, now())
  on conflict (perfil_id, local_id) do update set usado_em = now();

  return true;
end;
$$;

revoke execute on function public.meus_locais()          from public, anon;
revoke execute on function public.selecionar_local(uuid) from public, anon;
grant  execute on function public.meus_locais()          to authenticated;
grant  execute on function public.selecionar_local(uuid) to authenticated;
