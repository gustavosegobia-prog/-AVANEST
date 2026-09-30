-- ============================================================================
-- A lista de convênios chega a quem cadastra paciente e a quem anota a
-- Produção — só os nomes, sem os preços.
--
-- convenio_valores só é legível por financeiro/administrador/proprietário.
-- Mas duas telas de outros papéis leem dela: o cadastro de paciente da
-- recepção (page.tsx diz "A recepção também precisa") e as sugestões de
-- convênio da Produção do dia dos médicos. Conferido no banco, numa
-- transação desfeita: médico e recepção enxergavam ZERO convênios. A
-- recepção via só a lista fixa de convênios comuns, sem os da organização
-- (CISCOMCAM, COPEL, SAS...) e sem esconder os desativados; o médico não
-- recebia sugestão nenhuma — e a correção de grafia da Produção
-- (grafiaConhecida) não tinha com o que comparar.
--
-- Os PREÇOS continuam restritos: esta função devolve o nome e se está
-- ativo, e nada mais. Mostrar valor negociado com convênio a toda a equipe
-- é outra decisão, e não é esta.
-- ============================================================================

create or replace function public.convenios_da_organizacao()
returns table(convenio text, ativo boolean)
language sql
stable
security definer
set search_path = public
as $$
  select cv.convenio, bool_or(cv.ativo)
    from public.convenio_valores cv
   where cv.institution_id = public.current_institution_id()
     and cv.procedimento is null
     and cv.hospital is null
   group by cv.convenio
   order by cv.convenio
$$;

revoke all on function public.convenios_da_organizacao() from public, anon;
grant execute on function public.convenios_da_organizacao() to authenticated;
