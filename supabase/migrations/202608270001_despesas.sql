-- ============================================================================
-- Despesas: o outro lado do caixa
--
-- O Financeiro só tinha entrada. Faturado, recebido, a receber, glosa — tudo
-- do dinheiro que chega, nada do que sai. Sem saída não é fluxo de caixa, é
-- relatório de faturamento; e a pergunta que um dono de serviço faz no fim do
-- mês não é "quanto entrou", é "sobrou quanto".
--
-- DE QUEM É A DESPESA. `perfil_id` nulo quer dizer despesa do serviço —
-- aluguel, contador, secretária —, que num grupo se rateia. Preenchido quer
-- dizer despesa de uma pessoa: anuidade do CRM, congresso, o carro que leva de
-- um hospital a outro. A distinção existe porque, no modelo em que cada um
-- leva o que produziu, só a primeira entra na conta comum.
--
-- O QUE ESTA TABELA NÃO FAZ. Não tem parcelamento nem competência separada da
-- data. Despesa parcelada se lança uma vez por parcela, com a data de cada
-- uma — que é como o extrato do cartão chega e como o contador confere. Um
-- campo "parcela 3/12" pareceria mais completo e criaria a pergunta de qual
-- mês a parcela pertence, que é justamente a que a data já responde.
-- ============================================================================

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,

  -- Null = do serviço, rateada. Preenchido = de uma pessoa.
  perfil_id uuid references public.perfis(id) on delete set null,

  data date not null,
  descricao text not null check (btrim(descricao) <> ''),
  categoria text not null default 'outra'
    check (categoria in (
      'pessoal',      -- secretária, encargos, quem trabalha para o serviço
      'impostos',     -- ISS, IRPJ, honorários do contador
      'estrutura',    -- aluguel, água, luz, internet, telefone
      'material',     -- medicamentos, descartáveis, gases
      'equipamento',  -- compra, manutenção, calibração
      'seguro',       -- responsabilidade civil profissional
      'formacao',     -- CRM, sociedade, congresso, curso
      'software',     -- sistemas e assinaturas, este incluído
      'transporte',   -- combustível e deslocamento entre hospitais
      'outra'
    )),
  valor numeric(12,2) not null check (valor >= 0),

  -- Só marca que se repete todo mês. NÃO lança sozinha: uma despesa que o
  -- sistema cria sem ninguém mandar é uma linha que aparece no fechamento sem
  -- dono, e quem confere não sabe se foi paga. A tela usa isto para lembrar de
  -- lançar, e o lançamento continua sendo um ato de alguém.
  recorrente boolean not null default false,

  -- Quando a despesa é de um hospital específico. Opcional: a maioria não é.
  local_id uuid references public.locais_atendimento(id) on delete set null,
  observacoes text,

  created_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A consulta da tela é sempre "o mês da organização".
create index if not exists despesas_por_mes_idx
  on public.despesas (institution_id, data desc);
create index if not exists despesas_por_pessoa_idx
  on public.despesas (perfil_id, data desc);

alter table public.despesas enable row level security;

-- ---------------------------------------------------------------------------
-- Quem vê e quem mexe
--
-- Despesa do serviço é informação de gestão: quem responde pelo caixa precisa
-- dela para fechar o mês. Despesa pessoal é da pessoa — e também de quem
-- administra, porque o fechamento tem de bater, e um total que esconde linhas
-- vira uma diferença que ninguém explica em dezembro.
--
-- `financeiro` entra junto de owner e admin: é o papel criado justamente para
-- operar esta tela, e sem ele a pessoa contratada para fechar o mês não
-- enxergaria metade da conta.
-- ---------------------------------------------------------------------------
drop policy if exists "despesas_do_servico" on public.despesas;
create policy "despesas_do_servico" on public.despesas
  for all to authenticated
  using (
    institution_id = public.current_institution_id()
    and (
      perfil_id = auth.uid()
      or public.current_app_role() in ('owner', 'admin', 'financeiro')
    )
  )
  with check (
    institution_id = public.current_institution_id()
    and (
      perfil_id = auth.uid()
      or public.current_app_role() in ('owner', 'admin', 'financeiro')
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at sem depender de a tela lembrar
-- ---------------------------------------------------------------------------
create or replace function public.toca_despesas()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists despesas_touch on public.despesas;
create trigger despesas_touch
  before update on public.despesas
  for each row execute function public.toca_despesas();

revoke execute on function public.toca_despesas() from public, anon, authenticated;
