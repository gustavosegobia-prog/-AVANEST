-- ============================================================================
-- Caminho de busca travado nas quatro funções que faltavam
--
-- O auditor do Supabase aponta `function_search_path_mutable` nestas quatro.
-- Vale registrar o tamanho real do problema, porque o nome do aviso assusta
-- mais do que deveria: TODAS são SECURITY INVOKER. Rodam com os privilégios de
-- quem chama, então não há escalada possível — o pior caso é a função resolver
-- um nome numa tabela ou função plantada em outro esquema pelo próprio usuário
-- que já teria aquele acesso.
--
-- Se fossem SECURITY DEFINER a conversa seria outra, e é por isso que todas as
-- funções deste projeto que rodam com poder emprestado já nascem com
-- `set search_path`.
--
-- Fecha-se assim mesmo porque custa uma linha e porque aviso que fica aceso
-- para sempre é aviso que ninguém lê mais no dia em que aparecer um grave.
--
-- `search_path = ''` é o mais apertado possível. Funciona aqui porque nenhuma
-- delas consulta tabela: só mexem em `new.*` e chamam `now()`, `round()` e
-- `extract()`, que vivem em `pg_catalog` — e o `pg_catalog` é pesquisado antes
-- de tudo, sempre, independentemente do caminho configurado.
-- ============================================================================

create or replace function public.calcula_horas_do_plantao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_minutos integer;
begin
  v_minutos := (extract(epoch from new.hora_fim) - extract(epoch from new.hora_inicio)) / 60;
  -- Fim menor que início é plantão que vira a noite: 19:00 às 07:00 são 12
  -- horas, não menos doze.
  if v_minutos <= 0 then
    v_minutos := v_minutos + 24 * 60;
  end if;
  new.horas := round(v_minutos / 60.0, 2);
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.dias_de_reembolso()
returns integer
language sql
immutable
set search_path = ''
as $$ select 14 $$;

create or replace function public.toca_despesas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.toca_producao_do_dia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
