-- ============================================================================
-- Revisão de 27/10/2026: o que o painel de desempenho do Supabase aponta.
--
-- 1. Três políticas chamavam auth.uid() direto. O Postgres reavalia a função
--    a cada linha lida; dentro de um (select ...) ela vira um valor só por
--    consulta. A regra é a mesma, palavra por palavra — só muda quando o
--    banco calcula quem está pedindo. ALTER, e não drop + create: a política
--    nunca deixa de existir, nem por um instante.
-- 2. agendamentos tinha dois índices idênticos em (institution_id, data):
--    um de 202607230004 e outro de 202609300016. Fica o da agenda da
--    recepção (202609300016), que é quem usa.
-- Não muda quem lê nem quem grava nada.
-- ============================================================================

alter policy "so_os_meus_procedimentos" on public.producao_procedimentos
  using (institution_id = public.current_institution_id() and perfil_id = (select auth.uid()))
  with check (
    institution_id = public.current_institution_id()
    and perfil_id = (select auth.uid())
    and exists (select 1 from public.producao_do_dia p
                 where p.id = producao_procedimentos.producao_id and p.perfil_id = (select auth.uid())));

alter policy "medico_le_os_seus_movimentos" on public.producao_movimentos
  using (exists (select 1 from public.producao_do_dia p
                  where p.id = producao_movimentos.producao_id
                    and p.perfil_id = (select auth.uid())
                    and p.institution_id = public.current_institution_id()));

alter policy "financeiro_lanca_movimentos" on public.producao_movimentos
  with check (
    public.current_has_permission('financeiro')
    and created_by = (select auth.uid())
    and exists (select 1 from public.producao_do_dia p
                 where p.id = producao_movimentos.producao_id
                   and p.enviado_em is not null
                   and p.institution_id = public.current_institution_id()));

drop index if exists public.agendamentos_institution_data_idx;
