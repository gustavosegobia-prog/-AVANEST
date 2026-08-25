-- ===========================================================================
-- Confirmação de plantão: quem esteve lá diz que esteve
-- ===========================================================================
-- A escala é um PLANO. O relatório que vai para o financeiro no fim do mês é
-- uma folha de pagamento, e plano não paga ninguém: o plantão trocado na
-- véspera, o que foi cancelado por sala fechada, o que ficou meio turno — tudo
-- isso continua na escala exatamente igual ao que aconteceu de verdade.
--
-- Sem confirmação, quem monta a folha tem duas escolhas ruins: pagar pelo plano
-- e errar, ou ligar para doze pessoas perguntando o que aconteceu. A
-- confirmação é a pessoa que trabalhou dizendo que trabalhou, no dia, em um
-- toque — e é isso que dá ao financeiro um documento que ele pode pagar sem
-- conferir.
--
-- Só o próprio profissional confirma. Um administrador confirmando pelos
-- outros devolveria o problema ao ponto de partida: seria de novo o plano
-- assinando por si mesmo. A política de UPDATE que já existe permite ao
-- administrador escrever na linha do colega, e é por isso que a regra de quem
-- pode confirmar mora no gatilho abaixo, e não na política.
-- ===========================================================================

alter table public.plantoes
  add column if not exists confirmado_em timestamptz,
  add column if not exists confirmado_por uuid references public.perfis(id) on delete set null;

comment on column public.plantoes.confirmado_em is
  'Quando quem trabalhou confirmou que trabalhou. Nulo = ainda é só plano.';

-- O relatório do mês filtra por isto; sem índice, ele varre a tabela inteira
-- da organização toda vez que alguém imprime.
create index if not exists plantoes_confirmados_idx
  on public.plantoes (institution_id, data) where confirmado_em is not null;

-- ---------------------------------------------------------------------------
-- Duas regras que o banco garante, e a tela não tem como garantir sozinha
-- ---------------------------------------------------------------------------
create or replace function public.confirmacao_de_plantao_honesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.confirmado_em is not distinct from old.confirmado_em
     and new.confirmado_por is not distinct from old.confirmado_por then
    return new;
  end if;

  -- Desconfirmar é permitido: quem confirmou por engano corrige. O que não se
  -- pode é confirmar em nome de outra pessoa.
  if new.confirmado_em is null then
    new.confirmado_por := null;
    return new;
  end if;

  -- 1. Só quem trabalhou confirma. Isto é o valor inteiro da funcionalidade:
  --    uma confirmação que o chefe pode dar sozinho é o plano assinando por si
  --    mesmo, e o financeiro volta a não ter documento nenhum.
  if new.perfil_id is distinct from auth.uid() then
    raise exception 'Só quem fez o plantão pode confirmá-lo';
  end if;

  -- 2. Não se confirma o futuro. Confirmar em janeiro o plantão de março é
  --    exatamente o plano de novo, com outro nome — e é o que aconteceria
  --    naturalmente: a pessoa abre o mês, vê os botões e confirma todos.
  --    O fuso é o de Brasília porque o dia do plantão é o dia daqui; em UTC,
  --    um plantão que começa às 21h só poderia ser confirmado depois da
  --    meia-noite.
  if new.data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Este plantão ainda não aconteceu';
  end if;

  new.confirmado_por := auth.uid();
  new.confirmado_em := coalesce(new.confirmado_em, now());
  return new;
end;
$$;

drop trigger if exists confirmacao_honesta on public.plantoes;
create trigger confirmacao_honesta
  before update of confirmado_em, confirmado_por on public.plantoes
  for each row execute function public.confirmacao_de_plantao_honesta();
