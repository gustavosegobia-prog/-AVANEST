-- ============================================================================
-- O tipo de anestesia no mapa cirúrgico
--
-- Pedido de 07/11/2026: "colocar no mapa o tipo de anestesia, porque tem muita
-- anestesia que é local, que a gente não faz. Pode aparecer lá local, porém
-- não vai contar na nossa produção. Tem que aparecer porque às vezes pede
-- sedação."
--
-- Uma coluna, vazia em tudo o que já existe. A regra de contar fica no
-- aplicativo (lib/centro-cirurgico.ts, atoDeAnestesia): o paciente só com
-- anestesia local continua no mapa e nos tempos de sala do centro, e sai dos
-- atos de anestesia — o resumo do dia, os atos por anestesista e por convênio.
-- Pedida a sedação, o tipo vira 'local_sedacao' e o ato volta a contar.
--
-- Não apaga nada. As políticas de centro_casos já valem para a coluna nova:
-- quem monta o mapa escreve, quem vê o mapa lê.
-- ============================================================================

alter table public.centro_casos
  add column if not exists tipo_anestesia text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'centro_casos_tipo_anestesia_valido') then
    alter table public.centro_casos add constraint centro_casos_tipo_anestesia_valido
      check (tipo_anestesia is null or tipo_anestesia in
        ('geral', 'raqui', 'peridural', 'combinada', 'bloqueio', 'sedacao', 'local', 'local_sedacao'));
  end if;
end $$;
