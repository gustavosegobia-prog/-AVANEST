-- Campo estruturado para o rascunho clínico da avaliação.
-- RLS já aplicada à tabela avaliacoes continua protegendo este conteúdo.
alter table public.avaliacoes
  add column if not exists dados jsonb not null default '{}'::jsonb;

comment on column public.avaliacoes.dados is
  'Rascunho estruturado da avaliação pré-anestésica; conteúdo clínico protegido por RLS.';
