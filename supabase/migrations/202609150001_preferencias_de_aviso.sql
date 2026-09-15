-- ============================================================================
-- Cada um decide o que toca no telefone dele
--
-- Até aqui havia um interruptor só: notificação ligada ou desligada, tudo
-- junto. Quem se incomodava com um aviso desligava todos — inclusive o pedido
-- de troca da sexta, que é o que ninguém quer perder. Um interruptor único não
-- é preferência: é escolha entre ruído e silêncio.
--
-- ----------------------------------------------------------------------------
-- POR QUE UMA COLUNA EM `perfis`, E NÃO UMA TABELA
--
-- A preferência é um-para-um com a pessoa e nunca é consultada sozinha: quem
-- pergunta "esta pessoa quer este aviso?" já está com o perfil na mão. A rota
-- do cron, que é a mais cara do sistema, já faz `select id from perfis where id
-- in (...)` — acrescentar uma coluna a esse select custa zero, e uma tabela à
-- parte custaria mais uma ida ao banco por execução.
--
-- ----------------------------------------------------------------------------
-- NULO QUER DIZER TUDO LIGADO
--
-- Por isso a coluna não tem default e ninguém precisa ser migrado: as contas
-- que já existem continuam recebendo o que recebiam ontem, e conta nova nasce
-- certa sem nada ser gravado na criação. Quem nunca abriu a tela de
-- preferências não tem linha nenhuma aqui — e é assim que a maioria vai ficar.
--
-- A leitura do nulo mora em lib/preferencias-de-aviso.ts (`comPadrao`), junto
-- com a regra de que só um `false` explícito desliga. Chave que falta também é
-- "ligado": assim, preferência criada daqui a seis meses nasce ligada para
-- quem já salvou as de hoje, em vez de nascer desligada em silêncio.
--
-- ----------------------------------------------------------------------------
-- POR QUE UMA FUNÇÃO, E NÃO UMA POLÍTICA DE UPDATE
--
-- `perfis` guarda `role`, `permissoes`, `status` e `super_admin` NA MESMA
-- LINHA. Hoje só proprietário e administrador podem atualizar a tabela, e é
-- por isso: abrir um update para a pessoa mexer na própria linha entregaria a
-- ela, junto, o próprio papel — um médico se promoveria a proprietário com um
-- PATCH direto no PostgREST, e RLS por coluna não existe no Postgres.
--
-- A função escreve UMA coluna, na PRÓPRIA linha, e ignora o resto. É o mesmo
-- desenho de `definir_cor_escala`, pela mesma razão.
-- ============================================================================

alter table public.perfis
  add column if not exists preferencias_aviso jsonb;

comment on column public.perfis.preferencias_aviso is
  'Quais notificações esta pessoa quer receber. NULO = todas, e é o estado normal de quem nunca mexeu. Só um false explícito desliga; ver lib/preferencias-de-aviso.ts.';

-- ---------------------------------------------------------------------------
-- Salvar as próprias preferências
-- ---------------------------------------------------------------------------
-- Recebe o objeto inteiro e grava o objeto inteiro: são sete interruptores que
-- a tela mostra juntos e a pessoa salva de uma vez. Gravar chave por chave
-- exigiria sete idas ao banco para uma tela em que se costuma mexer em duas.
--
-- AS CHAVES SÃO FILTRADAS AQUI TAMBÉM, e não só no TypeScript. O corpo vem do
-- navegador: sem o filtro, qualquer sessão válida gravaria um jsonb de dez mil
-- chaves na própria linha — e a coluna é lida em toda execução do cron, para
-- todo mundo que tem aparelho.
create or replace function public.salvar_preferencias_de_aviso(p_preferencias jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limpo jsonb := '{}'::jsonb;
  v_chave text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if p_preferencias is null or jsonb_typeof(p_preferencias) <> 'object' then
    raise exception 'Preferências inválidas';
  end if;

  -- A lista é a mesma de lib/preferencias-de-aviso.ts. Escrita duas vezes, sim:
  -- é a fronteira entre o que o navegador manda e o que o banco guarda, e uma
  -- fronteira que confia na outra ponta não é fronteira. O teste de lá confere
  -- que as duas listas continuam iguais.
  foreach v_chave in array array[
    'escala_publicada','lembrete_plantao','plantao_alterado',
    'plantao_cancelado','plantao_trocado','som','vibracao'
  ] loop
    if jsonb_typeof(p_preferencias -> v_chave) = 'boolean' then
      v_limpo := v_limpo || jsonb_build_object(v_chave, p_preferencias -> v_chave);
    end if;
  end loop;

  update public.perfis set preferencias_aviso = v_limpo, updated_at = now()
   where id = auth.uid();

  return v_limpo;
end;
$$;

comment on function public.salvar_preferencias_de_aviso(jsonb) is
  'Grava as preferências de notificação da própria pessoa. Só esta coluna, só a própria linha: perfis guarda role e permissoes ao lado, e um update aberto entregaria o papel junto.';

-- O Postgres concede EXECUTE a PUBLIC por padrão em toda função nova. Sem este
-- revoke, um visitante anônimo poderia chamá-la — e ela falharia no `auth.uid()
-- is null`, mas a porta estaria aberta de qualquer forma.
revoke execute on function public.salvar_preferencias_de_aviso(jsonb) from public, anon;
grant execute on function public.salvar_preferencias_de_aviso(jsonb) to authenticated;
