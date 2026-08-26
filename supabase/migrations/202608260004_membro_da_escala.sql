-- ============================================================================
-- Quem entra na lista de nomes da escala
--
-- Até aqui, estar na escala era consequência do cadastro: médico ativo com CRM
-- aparecia na fila de nomes, e não havia como tirá-lo dali sem tirar o CRM ou
-- desativar o acesso — duas coisas que significam outra coisa. Um residente em
-- rodízio, um colega que só faz avaliação, alguém que saiu do plantão mas
-- continua atendendo: todos apareciam para escalar, e a fila de nomes de quem
-- monta a escala virava uma lista de todo mundo.
--
-- A partir daqui são duas perguntas separadas: a pessoa está cadastrada, e a
-- pessoa entra na escala. A primeira continua sendo o cadastro; a segunda é
-- esta coluna.
--
-- PADRÃO `true`, E ISSO É DELIBERADO. Quem já estava na fila continua nela no
-- instante em que esta migração roda. Uma coluna que nascesse `false` faria a
-- escala do mês perder todos os nomes de uma vez, e quem abrisse a tela
-- concluiria que o sistema apagou a equipe.
-- ============================================================================

alter table public.perfis
  add column if not exists na_escala boolean not null default true;

comment on column public.perfis.na_escala is
  'Aparece na fila de nomes de quem monta a escala. Separado do cadastro: '
  'estar cadastrado e entrar na escala são duas decisões diferentes.';

-- ---------------------------------------------------------------------------
-- A função que muda isso
-- ---------------------------------------------------------------------------
-- Dedicada, e não mais um parâmetro em admin_atualizar_perfil, por um motivo
-- prático: aquela função grava papel, status, nome, CRM, RQE e permissões de
-- uma vez. Marcar uma caixa de seleção numa lista de dez pessoas passaria a
-- reescrever os seis campos de cada uma, e um erro de digitação em qualquer
-- lugar da tela viraria perda de CRM. Esta toca uma coluna só.
-- ---------------------------------------------------------------------------
create or replace function public.definir_na_escala(
  p_perfil_id uuid,
  p_na_escala boolean
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ator public.perfis;
  v_alvo public.perfis;
  v_resultado public.perfis;
begin
  select * into v_ator from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_alvo from public.perfis where id = p_perfil_id;

  if v_ator.id is null or v_alvo.id is null
     or v_ator.institution_id <> v_alvo.institution_id
     or v_ator.role not in ('admin','owner') then
    raise exception 'Sem permissão';
  end if;

  -- Recepção e financeiro não entram na escala em circunstância nenhuma: a
  -- escala é o documento de quem responde pela anestesia. Deixar a marcação
  -- passar aqui criaria uma pessoa "na escala" que a tela nunca mostraria, e
  -- ninguém entenderia por quê.
  if p_na_escala and v_alvo.role in ('recepcao','financeiro') then
    raise exception 'Recepção e financeiro não entram na escala';
  end if;

  update public.perfis
     set na_escala = p_na_escala, updated_at = now()
   where id = p_perfil_id
  returning * into v_resultado;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_ator.institution_id, auth.uid(), 'perfil', p_perfil_id,
    case when p_na_escala then 'entrou_na_escala' else 'saiu_da_escala' end,
    jsonb_build_object('nome', v_alvo.nome)
  );

  return v_resultado;
end;
$$;

revoke execute on function public.definir_na_escala(uuid, boolean) from anon;
grant  execute on function public.definir_na_escala(uuid, boolean) to authenticated;
