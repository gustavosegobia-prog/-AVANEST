-- Índice em toda chave estrangeira que ainda não tinha (22/11/2026).
--
-- O verificador de desempenho do Supabase apontou 146 chaves estrangeiras sem
-- índice que as cubra, em 59 tabelas (perfis de quem criou, organização,
-- paciente, local…). Hoje o volume é pequeno e não pesa; quando os grupos
-- crescerem, apagar um perfil ou um paciente e listar "tudo deste paciente"
-- passariam a ler a tabela inteira.
--
-- O laço acha, no próprio catálogo, cada chave estrangeira do esquema public
-- sem um índice cujas primeiras colunas sejam as da chave, e cria um índice
-- simples para ela (<tabela>_<colunas>_fk_idx). `if not exists`: rodar de novo
-- não duplica nada, e o que um índice existente já cobre fica como está.

do $$
declare
  r record;
begin
  for r in
    with fks as (
      select c.conrelid, c.conkey,
             (select array_agg(a.attname::text order by k.ord)
                from unnest(c.conkey) with ordinality k(attnum, ord)
                join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as colunas
        from pg_constraint c
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    )
    select f.conrelid::regclass as tabela, f.colunas,
           left(c.relname || '_' || array_to_string(f.colunas, '_') || '_fk_idx', 63) as nome
      from fks f
      join pg_class c on c.oid = f.conrelid
     where not exists (
       select 1 from pg_index i
        where i.indrelid = f.conrelid
          and (i.indkey::int2[])[0:array_length(f.conkey, 1) - 1] @> f.conkey
          and (i.indkey::int2[])[0:array_length(f.conkey, 1) - 1] <@ f.conkey)
  loop
    execute format('create index if not exists %I on %s (%s)', r.nome, r.tabela,
      (select string_agg(quote_ident(x), ', ') from unnest(r.colunas) x));
  end loop;
end;
$$;
