-- ============================================================================
-- Plantão privado volta a ser "só você vê" também para quem monta a escala.
--
-- A tela marca o plantão privado com "· só você vê", e o código da escala
-- diz "o banco já não devolve os [privados] dos outros". Mas a política
-- `cada_um_no_seu_plantao` (FOR ALL, recriada em 202608290004 junto com o
-- escalista) libera tudo para quem pode montar a escala — inclusive LER os
-- privados dos colegas. Medido: na INOVANEST, o proprietário recebia os 13
-- plantões privados dos outros médicos. A tela nunca os usa (a escala do
-- grupo tira os privados; a pessoal mostra só os seus): o dado chegava ao
-- aparelho à toa, contra o que a tela promete.
--
-- A política passa a valer, para quem monta a escala, só no que NÃO é
-- privado. Os privados de cada um continuam dele — ler, alterar e apagar.
-- Como UPDATE e DELETE com WHERE também passam pelas regras de leitura,
-- quem monta a escala deixa igualmente de conseguir mexer no privado dos
-- outros, o que já era a regra escrita em 202608240005.
-- ============================================================================

drop policy if exists "cada_um_no_seu_plantao" on public.plantoes;
create policy "cada_um_no_seu_plantao" on public.plantoes
  for all using (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or (public.pode_montar_escala() and privado = false))
  ) with check (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or (public.pode_montar_escala() and privado = false))
  );
