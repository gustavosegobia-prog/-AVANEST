-- ===========================================================================
-- Local em preparação: cadastrado, e ainda não anunciado à equipe
-- ===========================================================================
-- O hospital já está no cadastro, com logo, endereço e escala sendo montada —
-- e o contrato ainda não foi assinado, ou a equipe ainda não foi avisada.
-- Quem administra precisa trabalhar nele; os outros não podem nem saber que
-- ele existe.
--
-- POR QUE NÃO SERVE O `ativo` QUE JÁ EXISTE
--
-- Arquivar esconde de todos, inclusive de quem administra: o local some da
-- escolha e some da coluna da escala, e aí não há onde montar a escala dele.
-- São duas ideias diferentes: `ativo` é "ainda usamos aqui", `oculto` é "ainda
-- não contamos para ninguém". Um local pode estar ativo e oculto ao mesmo
-- tempo — é exatamente o caso de agora.
--
-- ONDE A REGRA MORA
--
-- Na função meus_locais(), que é por onde a tela de "onde você vai trabalhar
-- hoje" e a coluna da Escala pegam a lista, e também na policy de leitura da
-- tabela. As duas, e não só a função: a função é security definer e passa por
-- cima do RLS, então ela precisa filtrar sozinha; a policy protege quem
-- consultar a tabela direto.
--
-- selecionar_local() ganha a mesma trava. Sem ela, alguém que descobrisse o
-- id — de um plantão antigo, de um documento impresso — conseguiria adotar
-- como local ativo um hospital que não deveria enxergar.
-- ===========================================================================

alter table public.locais_atendimento
  add column if not exists oculto boolean not null default false;

comment on column public.locais_atendimento.oculto is
  'Local em preparação: só quem administra a organização enxerga. Diferente '
  'de ativo=false, que é arquivamento e esconde de todos.';

-- ---------------------------------------------------------------------------
-- Leitura da tabela
-- ---------------------------------------------------------------------------
drop policy if exists "equipe_le_locais" on public.locais_atendimento;
create policy "equipe_le_locais" on public.locais_atendimento
  for select using (
    institution_id = public.current_institution_id()
    and (owner_id is null or owner_id = auth.uid())
    and (oculto = false or public.current_app_role() in ('owner','admin'))
  );

-- ---------------------------------------------------------------------------
-- A lista que as telas usam
-- ---------------------------------------------------------------------------
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
   -- Arquivado continua aparecendo para quem administra, para poder reativar;
   -- para os demais some da escolha, que é o sentido de arquivar.
     and (l.ativo or public.current_app_role() in ('owner','admin'))
   -- Em preparação: mesma ideia, outro motivo. Quem administra precisa dele na
   -- tela para montar a escala; para a equipe ele ainda não existe.
     and (l.oculto = false or public.current_app_role() in ('owner','admin'))
   order by r.usado_em desc nulls last, l.nome;
$$;

-- ---------------------------------------------------------------------------
-- Adotar como local da sessão
-- ---------------------------------------------------------------------------
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
     and (l.oculto = false or public.current_app_role() in ('owner','admin'));

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
