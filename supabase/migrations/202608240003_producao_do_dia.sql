-- ===========================================================================
-- Produção do dia: o que foi anestesiado, para cobrar depois
-- ===========================================================================
-- O caderninho que o anestesista já mantém no bolso do pijama. No fim do
-- plantão ele anota o nome, o convênio e a cirurgia de cada paciente, e é
-- dessa lista que sai a cobrança do mês.
--
-- Por que uma tabela nova, e não financeiro_atendimentos
--
-- Aquela exige patient_id: nasce de um paciente cadastrado com avaliação
-- pré-anestésica feita aqui dentro. É o caminho formal, e está certo que
-- seja. Mas o plantão não funciona assim: o anestesista cobre a sala, faz
-- oito anestesias e não avaliou nenhuma delas no sistema — foram cirurgias
-- de urgência, ou o pré foi feito por outro colega, ou em papel. Exigir
-- cadastro completo de paciente para anotar um nome transformaria uma
-- anotação de dez segundos em cinco minutos de digitação, e o resultado
-- conhecido disso é que a pessoa volta para o papel.
--
-- Então aqui o paciente é TEXTO. É anotação, não prontuário: não vira
-- documento clínico, não entra em ficha, não é assinado por ninguém.
--
-- Privacidade
--
-- Nome de paciente é dado de saúde. Esta lista é ESTRITAMENTE pessoal: nem
-- o administrador da organização enxerga a de outro profissional. Não é
-- excesso de zelo — é a diferença entre "o serviço sabe quem estava de
-- plantão" (escala, que é do grupo) e "o serviço sabe quem cada um
-- anestesiou" (aqui, que não é). O RLS abaixo é a única coisa que garante
-- isso, e por isso ele não tem exceção para papel nenhum.
-- ===========================================================================

create table if not exists public.producao_do_dia (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  -- De quem é a anotação. Nunca muda, nem quando o plantão troca de dono:
  -- quem anestesiou foi quem anestesiou, e quem cobra é essa pessoa.
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  -- O plantão de onde a anotação saiu, quando saiu de um. É opcional porque
  -- anestesia fora de plantão existe — cirurgia eletiva agendada, favor para
  -- um colega — e uma anotação que só existe presa a um turno perderia
  -- justamente o caso em que a cobrança é mais fácil de esquecer.
  plantao_id uuid references public.plantoes(id) on delete set null,

  data date not null,
  paciente text not null,
  -- "Particular" é o padrão porque é o caso em que esquecer de cobrar custa
  -- o valor inteiro: convênio ainda deixa rastro no faturamento do hospital,
  -- particular não deixa rastro nenhum.
  convenio text not null default 'Particular',
  procedimento text,
  valor numeric(12,2) not null default 0 check (valor >= 0),

  -- a_cobrar: anotado, ainda não virou cobrança
  -- faturado: nota emitida ou guia enviada
  -- recebido: dinheiro na conta
  -- glosado: o convênio recusou
  situacao text not null default 'a_cobrar'
    check (situacao in ('a_cobrar','faturado','recebido','glosado')),
  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A consulta que a tela faz é sempre "o meu mês": perfil e data.
create index if not exists producao_por_pessoa_idx
  on public.producao_do_dia (perfil_id, data desc);
create index if not exists producao_por_plantao_idx
  on public.producao_do_dia (plantao_id);

alter table public.producao_do_dia enable row level security;

-- ---------------------------------------------------------------------------
-- Uma política só, sem exceção para administrador
--
-- Em quase toda tabela deste sistema o owner/admin enxerga tudo, porque ele
-- responde pela organização. Aqui não, e é deliberado: a lista de pacientes
-- que um anestesista atendeu não é informação de gestão. Quem precisar
-- conferir faturamento tem o módulo Financeiro, que trabalha sobre paciente
-- cadastrado e atendimento formal.
--
-- Se um dia isso mudar, muda com uma decisão explícita e um comentário novo
-- aqui — não de raspão, junto de outra coisa.
-- ---------------------------------------------------------------------------
drop policy if exists "so_a_minha_producao" on public.producao_do_dia;
create policy "so_a_minha_producao" on public.producao_do_dia
  for all to authenticated
  using (
    institution_id = public.current_institution_id()
    and perfil_id = auth.uid()
  )
  with check (
    institution_id = public.current_institution_id()
    and perfil_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- updated_at que não depende de a tela lembrar
-- ---------------------------------------------------------------------------
create or replace function public.toca_producao_do_dia()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists producao_do_dia_touch on public.producao_do_dia;
create trigger producao_do_dia_touch
  before update on public.producao_do_dia
  for each row execute function public.toca_producao_do_dia();

revoke execute on function public.toca_producao_do_dia() from public, anon, authenticated;
