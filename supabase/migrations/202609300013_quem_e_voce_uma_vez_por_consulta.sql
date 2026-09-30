-- ============================================================================
-- "Quem é você?" uma vez por consulta, não uma vez por linha.
--
-- As regras de acesso perguntam quem está logado (auth.uid()) e, pelas
-- funções auxiliares, de que organização ele é, qual o papel, se monta a
-- escala. Escritas soltas na regra, o Postgres refaz essas perguntas PARA
-- CADA LINHA — e cada auxiliar é uma consulta à tabela de perfis. O
-- verificador de desempenho do Supabase apontou 31 regras assim.
--
-- Dentro de `(select ...)` a pergunta vira um "initplan": respondida uma
-- vez, reaproveitada em todas as linhas. A resposta é a mesma — nenhuma
-- delas depende da linha —, então ninguém passa a ver nem a deixar de ver
-- nada. Medido numa transação desfeita, antes de aplicar: para cada perfil
-- ativo, as linhas visíveis de cada tabela com regra foram as mesmas antes
-- e depois.
--
-- Só entram as perguntas que não olham a linha: auth.uid() e as auxiliares
-- sem argumento ou com argumento fixo. `modulo_liberado(role)` em convites
-- depende da linha e fica como está. O teste desfeito pegou um caso:
-- `local_id = ANY (meus_locais_de_plantao())`, que precisa de um cast para
-- continuar comparando com a lista (ver abaixo).
--
-- A troca é feita sobre o texto que o próprio Postgres guarda da regra, com
-- ALTER POLICY: papel, comando e nome continuam os mesmos.
-- ============================================================================

do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
  v_trocadas int := 0;

  -- Não mexe no que já está protegido nem no que vem qualificado por schema.
  c_antes constant text := '(?<![.\w])';
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') || coalesce(with_check, '')) ~
           '(auth\.uid\(\)|current_institution_id\(\)|current_app_role\(\)|pode_montar_escala\(\)|e_suporte\(\)|meus_locais_de_plantao\(\)|current_has_permission\(''|modulo_liberado\('')'
       -- Já embrulhada (a migração rodou antes): não embrulha de novo.
       and (coalesce(qual, '') || coalesce(with_check, '')) !~
           '\( SELECT (auth\.uid|current_institution_id|current_app_role|pode_montar_escala|e_suporte|meus_locais_de_plantao|current_has_permission|modulo_liberado)\('
  loop
    v_using := r.qual;
    v_check := r.with_check;

    -- As duas expressões passam pela mesma troca.
    for i in 1..2 loop
      declare e text := case i when 1 then v_using else v_check end;
      begin
        if e is not null then
          e := regexp_replace(e, c_antes || 'auth\.uid\(\)', '(select auth.uid())', 'g');
          e := regexp_replace(e, c_antes || '(current_institution_id|current_app_role|pode_montar_escala|e_suporte)\(\)',
                              '(select public.\1())', 'g');
          -- `x = ANY ((select f()))` o Postgres lê como "x está no resultado
          -- da subconsulta" e compara uuid com a lista inteira. O cast faz a
          -- subconsulta voltar a ser a lista.
          e := regexp_replace(e, c_antes || 'meus_locais_de_plantao\(\)',
                              '(select public.meus_locais_de_plantao())::uuid[]', 'g');
          e := regexp_replace(e, c_antes || '(current_has_permission|modulo_liberado)\(''([a-z_]+)''::text\)',
                              '(select public.\1(''\2''::text))', 'g');
        end if;
        if i = 1 then v_using := e; else v_check := e; end if;
      end;
    end loop;

    v_sql := format('alter policy %I on public.%I', r.policyname, r.tablename);
    if v_using is not null then v_sql := v_sql || ' using (' || v_using || ')'; end if;
    if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
    execute v_sql;
    v_trocadas := v_trocadas + 1;
  end loop;

  raise notice 'regras reescritas: %', v_trocadas;
end $$;
