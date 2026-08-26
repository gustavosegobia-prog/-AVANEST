-- ============================================================================
-- A escala de um hospital é de quem trabalha nele
--
-- Até aqui, quem entrava na organização via a escala de todos os hospitais
-- dela. Fazia sentido quando o grupo tinha um lugar só; com três, o
-- anestesiologista que cobre o pronto-atendimento passou a ver, dia a dia, a
-- escala inteira de dois hospitais onde nunca pisou — quem trabalha com quem,
-- quem está de plantão à noite, quem cobriu o fim de semana.
--
-- A regra nova, decidida pelo Gustavo: quem administra vê tudo, porque é ele
-- quem monta a escala e precisa enxergar o buraco de cobertura antes de
-- escalar alguém; os demais veem os hospitais em que estão escalados.
--
-- POR QUE NO BANCO, E NÃO NA TELA. Esconder o hospital da lista impede o
-- clique, não o pedido: a mesma consulta feita fora da tela continuaria
-- devolvendo tudo. A regra mora onde o dado mora.
--
-- A JANELA DE TRÊS MESES. Sem ela, quem fez um plantão de cobertura uma vez em
-- 2025 veria aquele hospital para sempre, e "sair de lá" nunca aconteceria.
-- Com ela, quem é escalado passa a ver na hora, e quem deixou de ser escalado
-- some da lista depois de o último plantão envelhecer. Inclui o futuro: a
-- escala do mês que vem aparece assim que o nome entra nela.
-- ============================================================================

-- Os locais onde eu tenho plantão. `security definer` para não recorrer: um
-- subselect em plantoes dentro da política de plantoes reaplicaria a política
-- a si mesma.
create or replace function public.meus_locais_de_plantao()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct local_id), '{}')
    from public.plantoes
   where perfil_id = auth.uid()
     and local_id is not null
     and data >= (current_date - interval '3 months');
$$;

comment on function public.meus_locais_de_plantao() is
  'Locais onde quem está logado tem plantão nos últimos três meses ou no futuro. '
  'Base da regra de quem enxerga a escala de qual hospital.';

revoke execute on function public.meus_locais_de_plantao() from anon;
grant  execute on function public.meus_locais_de_plantao() to authenticated;

drop policy if exists "equipe_le_plantoes" on public.plantoes;
create policy "equipe_le_plantoes" on public.plantoes
  for select using (
    institution_id = public.current_institution_id()
    and (privado = false or perfil_id = auth.uid())
    and (
      -- Quem monta a escala vê a escala inteira. É o trabalho dele.
      public.current_app_role() in ('owner','admin')
      -- O meu plantão é meu, em qualquer lugar.
      or perfil_id = auth.uid()
      -- Plantão sem local cadastrado não pertence a hospital nenhum: esconder
      -- deixaria linhas invisíveis sem que ninguém pudesse consertá-las.
      or local_id is null
      -- E a escala dos hospitais em que eu trabalho.
      or local_id = any (public.meus_locais_de_plantao())
    )
  );

-- ============================================================================
-- O QUE ESTA MUDANÇA LEVA JUNTO, e é preciso saber:
--
-- Plantão oferecido "ao grupo" num hospital deixa de aparecer para quem não
-- trabalha lá. É coerente com a regra — não se cobre um plantão num hospital
-- em que não se está escalado —, mas é uma mudança de comportamento: antes o
-- anúncio alcançava a organização inteira.
--
-- Quem ainda não tem nenhum plantão lançado não vê escala de grupo nenhuma. A
-- tela precisa dizer isso com todas as letras, senão o recém-chegado abre a
-- Escala, encontra o vazio e conclui que o sistema está quebrado.
-- ============================================================================
