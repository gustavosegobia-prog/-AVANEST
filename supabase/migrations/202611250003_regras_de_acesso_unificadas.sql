-- Uma regra de acesso por ação (23/11/2026). As 28 tabelas abaixo tinham duas
-- ou mais regras permissivas para a mesma ação — "area_extra_le" junto de
-- "acesso_clinico_*", "equipe_le_plantoes" junto de "cada_um_no_seu_plantao" — e
-- o Postgres avalia TODAS em cada linha lida (79 avisos multiple_permissive_policies
-- do Supabase).
--
-- O QUE CADA UM VÊ E GRAVA NÃO MUDA. Regras permissivas da mesma ação se somam
-- com OU; aqui elas viram uma regra só, com o OU escrito:
--   leitura  = OU das condições de quem lê (SELECT e ALL);
--   criação  = OU das conferências (WITH CHECK, ou a condição quando não há);
--   edição   = OU das condições e OU das conferências (UPDATE e ALL);
--   exclusão = OU das condições (DELETE e ALL).
-- As regras que valiam para "public" passam a valer para "authenticated": todas
-- exigem institution_id = current_institution_id(), que é nulo sem login, então
-- o visitante anônimo já não passava em nenhuma. Nenhuma tabela tem regra
-- restritiva nem FORCE ROW LEVEL SECURITY.
--
-- Validado no banco real em 25/11/2026, antes de aplicar, numa transação
-- desfeita no fim: 17 usuários reais, um de cada combinação de organização,
-- papel e permissões (inclusive super-admin e inativos), e o anônimo leram e
-- travaram para edição cada tabela antes e depois — 952 medidas. Usuários
-- logados: nenhuma diferença, linha a linha. Anônimo: antes dava "permissão
-- negada" (a regra para "public" chamava uma função que ele não pode
-- executar), depois lê zero linhas, em todas as tabelas.
--
-- Cada regra nova leva no comentário os nomes das que ela juntou.
do $$
declare
  tabelas text[] := array[
    'agendamentos','auditoria','avaliacoes','comorbidades','conclusoes','convenio_valores',
    'documentos','escores','exames','exames_fisicos','historias','locais_atendimento',
    'marcas_da_clinica','medicamentos','modelos_plantao','orientacoes','pacientes','perfis',
    'planejamentos','plantoes','procedimentos_da_clinica','producao_do_dia','producao_movimentos',
    'producao_procedimentos','protocolos','tuss_codigos','tuss_versoes','vias_aereas'];
  t text;
  a record;
  origem text;
  usando text;
  conferindo text;
  sem_condicao boolean;
  sem_conferencia boolean;
  antigas text[];
  novas text[];
  s text;
begin
  foreach t in array tabelas loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
                and (permissive <> 'PERMISSIVE' or roles not in ('{public}'::name[], '{authenticated}'::name[]))) then
      raise exception 'A tabela % tem regra fora do padrão; nada foi mudado.', t;
    end if;
    if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relname = t and c.relforcerowsecurity) then
      raise exception 'A tabela % força as regras para o dono; nada foi mudado.', t;
    end if;

    novas := '{}';
    for a in select * from (values
        ('SELECT', 'regra_de_leitura', 1), ('INSERT', 'regra_de_criacao', 2),
        ('UPDATE', 'regra_de_edicao', 3), ('DELETE', 'regra_de_exclusao', 4)) v(acao, nome, ordem)
      order by ordem
    loop
      select string_agg(policyname, ', ' order by policyname),
             string_agg(distinct '(' || qual || ')', ' OR ' order by '(' || qual || ')'),
             string_agg(distinct '(' || coalesce(with_check, qual) || ')', ' OR '
                        order by '(' || coalesce(with_check, qual) || ')'),
             bool_or(qual is null),
             bool_or(qual is null and with_check is null)
        into origem, usando, conferindo, sem_condicao, sem_conferencia
        from pg_policies
       where schemaname = 'public' and tablename = t and cmd in (a.acao, 'ALL');
      continue when origem is null;
      if a.acao in ('SELECT', 'UPDATE', 'DELETE') and sem_condicao then
        raise exception 'A tabela % tem regra de % sem condição; nada foi mudado.', t, a.acao;
      end if;
      if a.acao in ('INSERT', 'UPDATE') and sem_conferencia then
        raise exception 'A tabela % tem regra de % sem conferência; nada foi mudado.', t, a.acao;
      end if;
      novas := novas || (
        format('create policy %I on public.%I as permissive for %s to authenticated', a.nome, t, lower(a.acao))
        || case when a.acao in ('SELECT', 'UPDATE', 'DELETE') then ' using (' || usando || ')' else '' end
        || case when a.acao in ('INSERT', 'UPDATE') then ' with check (' || conferindo || ')' else '' end);
      novas := novas || format('comment on policy %I on public.%I is %L', a.nome, t, 'Junta (23/11/2026): ' || origem);
    end loop;

    select array_agg(policyname) into antigas from pg_policies where schemaname = 'public' and tablename = t;
    foreach s in array coalesce(antigas, '{}') loop
      execute format('drop policy %I on public.%I', s, t);
    end loop;
    foreach s in array novas loop
      execute s;
    end loop;
  end loop;
end $$;
