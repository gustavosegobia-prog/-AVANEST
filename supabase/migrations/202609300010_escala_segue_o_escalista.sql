-- ============================================================================
-- Quem manda na escala, no banco, passa a ser quem monta a escala.
--
-- lib/escalista.ts: eleito o escalista (em geral um anestesiologista), "só
-- ele e o proprietário mexem". A função pode_montar_escala() já diz isso.
-- Mas o gatilho que protege a escala do grupo e as três políticas de escrita
-- dos plantões ainda perguntavam "é administrador?". Medido numa transação
-- desfeita, com um plantão real de outro médico:
--   - médico ELEITO escalista: remarcar e apagar plantão de colega RECUSADO
--     pelo gatilho — justamente quem monta a escala não conseguia montar;
--   - administrador NÃO escalista, com escalista eleito: remarcar e apagar
--     CONSEGUIA — a tela escondia o botão, o banco deixava.
--
-- Tudo passa a perguntar pode_montar_escala(). Organização sem escalista
-- eleito não muda: nela todo administrador monta, como antes. O
-- proprietário nunca perde.
-- ============================================================================

drop policy if exists "lanca_o_seu_plantao" on public.plantoes;
create policy "lanca_o_seu_plantao" on public.plantoes
  for insert to authenticated with check (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.pode_montar_escala())
    -- Privado só para si, nunca para outro.
    and (privado = false or perfil_id = auth.uid())
  );

drop policy if exists "altera_o_seu_plantao" on public.plantoes;
create policy "altera_o_seu_plantao" on public.plantoes
  for update to authenticated using (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.pode_montar_escala())
  ) with check (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.pode_montar_escala())
    and (privado = false or perfil_id = auth.uid())
  );

-- O privado é seu e some quando você quiser; o da escala do grupo, só quem
-- monta a escala apaga.
drop policy if exists "apaga_o_que_e_so_seu" on public.plantoes;
create policy "apaga_o_que_e_so_seu" on public.plantoes
  for delete to authenticated using (
    institution_id = public.current_institution_id()
    and (public.pode_montar_escala() or (perfil_id = auth.uid() and privado))
  );

-- O gatilho: troca só a pergunta de quem manda, no corpo que já está no
-- banco (a mesma técnica de 202609300004).
do $gatilho$
declare
  v_def text;
  v_velho text := $v$v_manda boolean := public.current_app_role() in ('owner','admin');$v$;
  v_novo text := $v$v_manda boolean := public.pode_montar_escala();$v$;
begin
  v_def := pg_get_functiondef('public.plantao_do_grupo_protegido()'::regprocedure);
  if position(v_velho in v_def) > 0 then
    execute replace(v_def, v_velho, v_novo);
  elsif position(v_novo in v_def) = 0 then
    raise exception 'plantao_do_grupo_protegido mudou de forma inesperada; revise antes de aplicar';
  end if;
end
$gatilho$;
