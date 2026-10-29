-- ============================================================================
-- Convite por link para a função Centro cirúrgico (29/10/2026).
--
-- O João, da FUNDHOSPAR, tentou gerar o link de convite da enfermeira do mapa
-- e o banco recusou: "new row violates row-level security policy for table
-- convites". A regra só aceitava convite para 'admin' ou para uma função cujo
-- módulo está na lista da organização (`modulo_liberado`). O mapa do centro
-- cirúrgico não é módulo dessa lista: ele é liberado por recurso
-- (`centro_liberado`). Então o link para 'centro' era recusado em toda
-- organização, enquanto o convite por e-mail passava — a rota do e-mail confere
-- `pode_montar_centro`. O João foi para o e-mail, que caiu no spam.
--
-- Agora o link segue a mesma regra do e-mail: 'centro' entra onde quem convida
-- pode montar o mapa (`pode_montar_centro`: mesma organização, mapa liberado e
-- permissão de montar). O resto da regra fica igual, palavra por palavra.
-- ALTER, e não drop + create: a política nunca deixa de existir.
-- ============================================================================

alter policy "owner_admin_gerencia_convites" on public.convites
  using (
    exists (select 1 from public.perfis p
             where p.id = (select auth.uid()) and p.status = 'ativo'
               and p.institution_id = convites.institution_id
               and p.role = any (array['admin', 'owner'])))
  with check (
    exists (select 1 from public.perfis p
             where p.id = (select auth.uid()) and p.status = 'ativo'
               and p.institution_id = convites.institution_id
               and p.role = any (array['admin', 'owner']))
    and (role = 'admin'
         or public.modulo_liberado(role)
         or (role = 'centro' and public.pode_montar_centro(convites.institution_id))));
