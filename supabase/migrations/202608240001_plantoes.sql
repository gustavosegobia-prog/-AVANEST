-- ===========================================================================
-- Plantões: escala, valor e troca entre colegas
-- ===========================================================================
-- Três tabelas, e cada uma existe por um motivo que as outras não cobrem:
--
--   modelos_plantao — "Pronto Atendimento Mamborê, diurno, 07:00–19:00, R$ X".
--   Sem isso, registrar o plantão da semana são cinco campos por dia. Com
--   isso, é um toque. A ideia vem do caderno que o médico já mantém à mão.
--
--   plantoes — o turno de fato, de uma pessoa, num dia, num local.
--
--   trocas_plantao — o pedido de troca, com quem responde e quando. Plantão
--   trocado no grupo de WhatsApp e não registrado é o que vira discussão no
--   fim do mês; aqui a troca tem dono, data e resposta.
--
-- O valor mora no plantão, não só no modelo, e é editável por quem fez: o
-- combinado muda por plantão (feriado, cobertura, hora extra), e um valor que
-- só o modelo define obrigaria a criar um modelo novo a cada exceção.
--
-- Escala pessoal e escala do grupo usam o mesmo desenho dos locais:
-- compartilhado é o que a equipe inteira enxerga; pessoal é de quem criou.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Modelos
-- ---------------------------------------------------------------------------
create table if not exists public.modelos_plantao (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  -- Null = modelo do grupo, que todos usam. Preenchido = modelo particular.
  owner_id uuid references public.perfis(id) on delete cascade,

  nome text not null,
  local_id uuid references public.locais_atendimento(id) on delete set null,
  hora_inicio time not null default '07:00',
  hora_fim time not null default '19:00',
  valor numeric(12,2) not null default 0 check (valor >= 0),
  -- Cor para o calendário. Guardada como texto curto e não como hex livre:
  -- hex livre deixaria alguém escolher branco sobre branco.
  cor text not null default 'azul'
    check (cor in ('azul','verde','ambar','vermelho','roxo','cinza')),
  ativo boolean not null default true,

  created_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists modelos_por_organizacao_idx
  on public.modelos_plantao (institution_id, ativo, nome);

-- ---------------------------------------------------------------------------
-- Plantões
-- ---------------------------------------------------------------------------
create table if not exists public.plantoes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  -- De quem é o turno. Muda quando uma troca é aceita.
  perfil_id uuid not null references public.perfis(id) on delete cascade,

  local_id uuid references public.locais_atendimento(id) on delete set null,
  modelo_id uuid references public.modelos_plantao(id) on delete set null,

  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  -- Guardado, e não calculado na hora: plantão que vira a noite (19:00 às
  -- 07:00) tem fim menor que o início, e toda tela que precisasse da duração
  -- teria de repetir essa conta — até a primeira esquecer.
  horas numeric(5,2) not null default 0 check (horas >= 0),

  valor numeric(12,2) not null default 0 check (valor >= 0),
  -- escalado: combinado, ainda não aconteceu
  -- realizado: aconteceu, a receber
  -- pago: dinheiro na conta
  -- cancelado: não aconteceu, e fica no histórico em vez de sumir
  situacao text not null default 'escalado'
    check (situacao in ('escalado','realizado','pago','cancelado')),
  pago_em date,

  -- Quando true, o plantão aparece para os colegas como disponível para troca.
  aberto_para_troca boolean not null default false,
  observacoes text,

  created_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A mesma pessoa não faz dois turnos que se sobrepõem no mesmo dia. O índice
-- não cobre a virada da meia-noite, e de propósito: 19:00–07:00 e 07:00–19:00
-- do dia seguinte são turnos legítimos e consecutivos.
create unique index if not exists plantoes_sem_repeticao_idx
  on public.plantoes (perfil_id, data, hora_inicio)
  where situacao <> 'cancelado';

create index if not exists plantoes_por_mes_idx
  on public.plantoes (institution_id, data);
create index if not exists plantoes_meus_idx
  on public.plantoes (perfil_id, data desc);

-- ---------------------------------------------------------------------------
-- Trocas
-- ---------------------------------------------------------------------------
create table if not exists public.trocas_plantao (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  plantao_id uuid not null references public.plantoes(id) on delete cascade,

  solicitante_id uuid not null references public.perfis(id) on delete cascade,
  -- Null = oferecido a todo o grupo; preenchido = convite a uma pessoa.
  destinatario_id uuid references public.perfis(id) on delete cascade,

  status text not null default 'pendente'
    check (status in ('pendente','aceita','recusada','cancelada')),
  respondido_por uuid references public.perfis(id) on delete set null,
  respondido_em timestamptz,
  mensagem text,
  created_at timestamptz not null default now()
);

create index if not exists trocas_abertas_idx
  on public.trocas_plantao (institution_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.modelos_plantao enable row level security;
alter table public.plantoes        enable row level security;
alter table public.trocas_plantao  enable row level security;

drop policy if exists "equipe_le_modelos" on public.modelos_plantao;
create policy "equipe_le_modelos" on public.modelos_plantao
  for select using (
    institution_id = public.current_institution_id()
    and (owner_id is null or owner_id = auth.uid())
  );

drop policy if exists "gerencia_modelos" on public.modelos_plantao;
create policy "gerencia_modelos" on public.modelos_plantao
  for all using (
    institution_id = public.current_institution_id()
    and (public.current_app_role() in ('owner','admin') or owner_id = auth.uid())
  ) with check (
    institution_id = public.current_institution_id()
    and ((owner_id is null and public.current_app_role() in ('owner','admin'))
         or owner_id = auth.uid())
  );

-- A escala do grupo é visível para o grupo: é o sentido de ter escala. Quem
-- cobre a falta de quem precisa saber quem está de plantão hoje.
drop policy if exists "equipe_le_plantoes" on public.plantoes;
create policy "equipe_le_plantoes" on public.plantoes
  for select using (institution_id = public.current_institution_id());

-- Escrever é outra história: cada um mexe no próprio plantão. O administrador
-- monta a escala de todos, que é o trabalho dele.
drop policy if exists "cada_um_no_seu_plantao" on public.plantoes;
create policy "cada_um_no_seu_plantao" on public.plantoes
  for all using (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.current_app_role() in ('owner','admin'))
  ) with check (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.current_app_role() in ('owner','admin'))
  );

drop policy if exists "equipe_le_trocas" on public.trocas_plantao;
create policy "equipe_le_trocas" on public.trocas_plantao
  for select using (institution_id = public.current_institution_id());

drop policy if exists "equipe_pede_troca" on public.trocas_plantao;
create policy "equipe_pede_troca" on public.trocas_plantao
  for insert with check (
    institution_id = public.current_institution_id()
    and solicitante_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- As horas se calculam sozinhas
--
-- Deixar para a tela significaria que a tela de cadastro, a de edição e a
-- importação futura repetiriam a mesma conta — e a que esquecesse gravaria
-- zero sem ninguém perceber, porque zero é um número plausível.
-- ---------------------------------------------------------------------------
create or replace function public.calcula_horas_do_plantao()
returns trigger
language plpgsql
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

drop trigger if exists horas_do_plantao on public.plantoes;
create trigger horas_do_plantao
  before insert or update of hora_inicio, hora_fim on public.plantoes
  for each row execute function public.calcula_horas_do_plantao();

-- ---------------------------------------------------------------------------
-- Aceitar uma troca
--
-- Troca é transferência de responsabilidade por um turno, e por isso não é um
-- update solto na tela: passa por aqui, onde o dono muda, o pedido é fechado e
-- a auditoria registra quem assumiu. Sem isso, dois colegas poderiam aceitar o
-- mesmo plantão e ninguém saberia qual valeu.
-- ---------------------------------------------------------------------------
create or replace function public.aceitar_troca(p_troca_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_troca public.trocas_plantao%rowtype; v_antigo uuid;
begin
  select * into v_troca from public.trocas_plantao
   where id = p_troca_id
     and institution_id = public.current_institution_id()
   for update;
  if not found then raise exception 'Troca não encontrada'; end if;

  if v_troca.status <> 'pendente' then
    raise exception 'Esta troca já foi respondida';
  end if;
  if v_troca.solicitante_id = auth.uid() then
    raise exception 'Você não pode aceitar a própria troca';
  end if;
  -- Convite dirigido só é aceito por quem foi convidado.
  if v_troca.destinatario_id is not null and v_troca.destinatario_id <> auth.uid() then
    raise exception 'Esta troca foi oferecida a outro profissional';
  end if;

  select perfil_id into v_antigo from public.plantoes where id = v_troca.plantao_id;

  update public.plantoes
     set perfil_id = auth.uid(), aberto_para_troca = false, updated_at = now()
   where id = v_troca.plantao_id;

  update public.trocas_plantao
     set status = 'aceita', respondido_por = auth.uid(), respondido_em = now()
   where id = p_troca_id;

  -- Os outros pedidos abertos para o mesmo plantão perdem o objeto.
  update public.trocas_plantao
     set status = 'cancelada', respondido_em = now()
   where plantao_id = v_troca.plantao_id and status = 'pendente' and id <> p_troca_id;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_troca.institution_id, auth.uid(), 'plantao', v_troca.plantao_id, 'troca_aceita',
          jsonb_build_object('de', v_antigo, 'para', auth.uid(), 'troca', p_troca_id));
end;
$$;

revoke execute on function public.aceitar_troca(uuid) from public, anon;
grant  execute on function public.aceitar_troca(uuid) to authenticated;
revoke execute on function public.calcula_horas_do_plantao() from public, anon, authenticated;
