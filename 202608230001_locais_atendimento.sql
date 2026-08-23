-- ===========================================================================
-- Locais de atendimento: onde o médico está trabalhando hoje
-- ===========================================================================
-- Um anestesiologista atende em vários hospitais. Hoje o nome do lugar é
-- digitado à mão em pacientes.hospital, texto livre, uma vez por paciente — e
-- é isso que sai nos documentos. Escrever "Santa Casa" cinquenta vezes por mês
-- é trabalho repetido e, pior, cada erro de digitação vira um hospital novo.
--
-- ATENÇÃO AO NOME. Já existe public.instituicoes, e ela é OUTRA coisa: é a
-- organização que assina e paga, e current_institution_id() é a base de todo o
-- RLS do sistema. Local de atendimento é onde se trabalha; instituição é quem
-- contrata. Um grupo de anestesia (uma instituicao) atende em vários hospitais
-- (vários locais_atendimento). Confundir os dois quebraria o isolamento entre
-- clientes, então eles não se encostam em lugar nenhum.
--
-- pacientes.hospital continua existindo e não é migrado. As avaliações antigas
-- seguem imprimindo o que sempre imprimiram; as novas passam a preferir o
-- local vinculado. Nada some.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A tabela
-- ---------------------------------------------------------------------------
create table if not exists public.locais_atendimento (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,

  -- Null = local do grupo, que todo mundo da organização usa. Preenchido =
  -- local particular daquele médico, que só ele enxerga. Os dois casos do
  -- pedido cabem numa coluna só, sem tabela de compartilhamento.
  owner_id uuid references public.perfis(id) on delete cascade,

  nome text not null,
  nome_fantasia text,
  cnpj text,
  tipo text not null default 'hospital'
    check (tipo in ('hospital','clinica','consultorio','centro_cirurgico','outro')),

  endereco text, numero text, bairro text, cidade text, estado text, cep text,
  telefone text, email text,

  logo_url text,
  grupo_anestesia text,
  logo_grupo_url text,
  observacoes text,

  -- Arquivado não aceita avaliação nova, mas as antigas continuam abrindo
  -- normalmente. É o que o pedido chama de arquivar, e é diferente de apagar.
  ativo boolean not null default true,

  created_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.locais_atendimento is
  'Onde o médico atende. NÃO confundir com instituicoes, que é quem contrata o AVANEST.';
comment on column public.locais_atendimento.owner_id is
  'Null = local compartilhado com toda a organização. Preenchido = particular daquele profissional.';

create index if not exists locais_por_organizacao_idx
  on public.locais_atendimento (institution_id, ativo, nome);

-- Duas Santa Casa iguais na mesma organização é erro de digitação, não escolha.
-- O índice é sobre nome normalizado para "SANTA CASA" e "Santa Casa" colidirem.
create unique index if not exists locais_nome_unico_idx
  on public.locais_atendimento (institution_id, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nome)));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.locais_atendimento enable row level security;

-- Ler: os locais da minha organização, menos os particulares de outra pessoa.
drop policy if exists "equipe_le_locais" on public.locais_atendimento;
create policy "equipe_le_locais" on public.locais_atendimento
  for select using (
    institution_id = public.current_institution_id()
    and (owner_id is null or owner_id = auth.uid())
  );

-- Escrever: administrador da organização cria local do grupo; qualquer
-- profissional cria o seu particular. A checagem de owner_id no WITH CHECK é o
-- que impede alguém marcar como "do grupo" um local que só ele deveria ter.
drop policy if exists "admin_gerencia_locais" on public.locais_atendimento;
create policy "admin_gerencia_locais" on public.locais_atendimento
  for all using (
    institution_id = public.current_institution_id()
    and (
      public.current_app_role() in ('owner','admin')
      or owner_id = auth.uid()
    )
  ) with check (
    institution_id = public.current_institution_id()
    and (
      (owner_id is null and public.current_app_role() in ('owner','admin'))
      or owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- O vínculo com a avaliação
-- ---------------------------------------------------------------------------
alter table public.avaliacoes
  add column if not exists local_atendimento_id uuid
    references public.locais_atendimento(id) on delete set null,
  -- Snapshot em jsonb, e não em oito colunas separadas. Esta tabela já guarda
  -- dados e snapshot_conclusao assim, o snapshot nunca é consultado campo a
  -- campo — só lido inteiro na hora de imprimir —, e acrescentar um campo ao
  -- cadastro de locais amanhã não vai exigir migration nenhuma.
  add column if not exists local_snapshot jsonb;

comment on column public.avaliacoes.local_snapshot is
  'Como o local estava no dia do atendimento. Documento antigo não pode mudar porque o hospital trocou de endereço.';

create index if not exists avaliacoes_por_local_idx
  on public.avaliacoes (institution_id, local_atendimento_id);

-- on delete set null preserva a avaliação se alguém apagar o local; o snapshot
-- continua lá e o documento segue imprimindo o nome certo. É por isso que o
-- snapshot existe, e não apenas a chave estrangeira.

-- ---------------------------------------------------------------------------
-- O snapshot se preenche sozinho
--
-- Deixar isso para o código da aplicação seria confiar em que todo caminho que
-- cria avaliação lembre de copiar os dados. Já são três (tela do médico,
-- recepção e agendamento atômico), e o quarto que aparecer esqueceria.
-- ---------------------------------------------------------------------------
create or replace function public.congela_local_da_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_local public.locais_atendimento%rowtype;
begin
  if new.local_atendimento_id is null then
    return new;
  end if;

  -- Só congela uma vez. Reabrir uma avaliação para corrigir uma resposta não
  -- pode reescrever o cabeçalho do documento que o paciente já assinou.
  if tg_op = 'UPDATE' and old.local_snapshot is not null
     and old.local_atendimento_id is not distinct from new.local_atendimento_id then
    new.local_snapshot := old.local_snapshot;
    return new;
  end if;

  select * into v_local from public.locais_atendimento
   where id = new.local_atendimento_id;
  if not found then
    return new;
  end if;

  -- O local tem de ser da mesma organização da avaliação. Sem esta linha, um
  -- id adivinhado carimbaria o nome de outra clínica num documento nosso.
  if v_local.institution_id is distinct from new.institution_id then
    raise exception 'Local de atendimento não pertence a esta organização';
  end if;

  new.local_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'id',            v_local.id,
    'nome',          v_local.nome,
    'nome_fantasia', v_local.nome_fantasia,
    'cnpj',          v_local.cnpj,
    'tipo',          v_local.tipo,
    'endereco',      v_local.endereco,
    'numero',        v_local.numero,
    'bairro',        v_local.bairro,
    'cidade',        v_local.cidade,
    'estado',        v_local.estado,
    'cep',           v_local.cep,
    'telefone',      v_local.telefone,
    'logo_url',      v_local.logo_url,
    'grupo_anestesia', v_local.grupo_anestesia,
    'logo_grupo_url',  v_local.logo_grupo_url,
    'congelado_em',  to_jsonb(now())
  ));
  return new;
end;
$$;

drop trigger if exists congela_local on public.avaliacoes;
create trigger congela_local
  before insert or update of local_atendimento_id on public.avaliacoes
  for each row execute function public.congela_local_da_avaliacao();

-- ---------------------------------------------------------------------------
-- Recentes
--
-- Uma linha por profissional e local, com a data do último uso. Guardar o
-- histórico inteiro daria uma tabela que só cresce para responder uma pergunta
-- de três itens.
-- ---------------------------------------------------------------------------
create table if not exists public.locais_recentes (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  local_id uuid not null references public.locais_atendimento(id) on delete cascade,
  usado_em timestamptz not null default now(),
  primary key (perfil_id, local_id)
);

alter table public.locais_recentes enable row level security;

drop policy if exists "cada_um_ve_seus_recentes" on public.locais_recentes;
create policy "cada_um_ve_seus_recentes" on public.locais_recentes
  for all using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- ---------------------------------------------------------------------------
-- O que a tela pede
-- ---------------------------------------------------------------------------

/**
 * Os locais que eu posso usar, recentes primeiro.
 *
 * Uma chamada só em vez de duas: a tela precisa das duas listas ao mesmo tempo,
 * e separar em "recentes" e "todos" faria duas viagens para montar uma tela.
 */
create or replace function public.meus_locais()
returns table (
  id uuid, nome text, nome_fantasia text, tipo text, cidade text, estado text,
  logo_url text, grupo_anestesia text, particular boolean, ativo boolean,
  usado_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.nome, l.nome_fantasia, l.tipo, l.cidade, l.estado,
         l.logo_url, l.grupo_anestesia, l.owner_id is not null, l.ativo,
         r.usado_em
    from public.locais_atendimento l
    left join public.locais_recentes r
           on r.local_id = l.id and r.perfil_id = auth.uid()
   where l.institution_id = public.current_institution_id()
     and (l.owner_id is null or l.owner_id = auth.uid())
   -- Arquivado continua aparecendo para quem administra, para poder reativar;
   -- para os demais some da escolha, que é o sentido de arquivar.
     and (l.ativo or public.current_app_role() in ('owner','admin'))
   order by r.usado_em desc nulls last, l.nome;
$$;

/**
 * Marca o local como usado agora, e devolve se ele ainda vale.
 *
 * A tela guarda o local escolhido no navegador. Guardar não é autorizar: quem
 * saiu do grupo, ou teve o local arquivado, continuaria com um id válido no
 * armazenamento local. Por isso a escolha passa por aqui, do lado do servidor,
 * toda vez que a sessão começa.
 */
create or replace function public.selecionar_local(p_local_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean;
begin
  select true into v_ok
    from public.locais_atendimento l
   where l.id = p_local_id
     and l.ativo
     and l.institution_id = public.current_institution_id()
     and (l.owner_id is null or l.owner_id = auth.uid());

  if not coalesce(v_ok, false) then
    return false;
  end if;

  insert into public.locais_recentes (perfil_id, local_id, usado_em)
  values (auth.uid(), p_local_id, now())
  on conflict (perfil_id, local_id) do update set usado_em = now();

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoria
--
-- Entra na tabela que já existe, com o mesmo formato das outras ações. O
-- pedido falava em registrar médico, local, data e hora: os três primeiros são
-- colunas de auditoria, e a hora é o created_at dela.
-- ---------------------------------------------------------------------------
create or replace function public.registra_local_na_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    coalesce(new.institution_id, old.institution_id),
    auth.uid(),
    'local_atendimento',
    coalesce(new.id, old.id),
    lower(tg_op),
    jsonb_build_object('nome', coalesce(new.nome, old.nome),
                       'ativo', coalesce(new.ativo, old.ativo))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists audita_locais on public.locais_atendimento;
create trigger audita_locais
  after insert or update or delete on public.locais_atendimento
  for each row execute function public.registra_local_na_auditoria();

-- ---------------------------------------------------------------------------
-- Permissões
--
-- O PUBLIC ganha EXECUTE assim que a função nasce; revogar dele é o que
-- fecha a porta, e revogar só de anon/authenticated não tiraria nada.
-- ---------------------------------------------------------------------------
revoke execute on function public.meus_locais() from public, anon;
revoke execute on function public.selecionar_local(uuid) from public, anon;
grant  execute on function public.meus_locais() to authenticated;
grant  execute on function public.selecionar_local(uuid) to authenticated;

-- Gatilhos não são endpoint de ninguém.
revoke execute on function public.congela_local_da_avaliacao() from public, anon, authenticated;
revoke execute on function public.registra_local_na_auditoria() from public, anon, authenticated;
