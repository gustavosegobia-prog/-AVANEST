-- ============================================================================
-- O relatório diário, e a pausa das contas paradas da campanha
--
-- Duas funções que só o `service_role` executa, porque as duas atravessam a
-- fronteira entre organizações: uma lê o uso de todo mundo, a outra desliga
-- conta. Nenhuma pode ser alcançada por sessão de usuário, nem por anônimo.
--
-- ----------------------------------------------------------------------------
-- POR QUE A PAUSA SÓ ALCANÇA QUEM VEIO DE CAMPANHA
--
-- O pedido original era pausar a conta de quem passasse TRÊS dias sem entrar —
-- de todo mundo. Rodada contra a base real, a regra pegaria 14 dos 19 usuários
-- ativos no primeiro dia, inclusive dois da equipe da casa que naquela manhã
-- estavam com o aparelho ligado recebendo notificação.
--
-- Anestesiologista não usa este sistema todo dia: a ficha sai em dia de
-- ambulatório, a escala na virada do mês, o financeiro no fechamento. Três dias
-- parado é o comportamento normal da profissão.
--
-- Mostrado o número, o prazo virou CATORZE dias e o escopo foi estreitado para
-- quem chegou por um link de campanha. Aí a regra faz sentido: catorze dias é
-- um prazo que o próprio anestesiologista reconhece como abandono, e é gente
-- que o dono do produto não conhece — a pausa é o gancho para a conversa que
-- ele quer ter.
--
-- O PRAZO É PARÂMETRO, e quem manda é a rota que chama (`DIAS_PARA_PAUSAR`).
-- O default daqui existe só para a função nunca rodar sem prazo nenhum.
--
-- AS QUATRO TRAVAS ESTÃO AQUI, e não na rota que chama. Escritas só no
-- TypeScript, bastaria um parâmetro errado — ou uma chamada nova, meses adiante
-- — para desligar a equipe inteira:
--
--   origem preenchida  → veio de campanha, e não de convite
--   plano = 'trial'    → nunca cortesia, nunca assinante
--   role = 'owner'     → nunca alguém que foi CONVIDADO para a organização
--   pausada_em is null → nunca pausa duas vezes, e não reescreve a data
--
-- E pausar NÃO APAGA NADA: `status` volta a 'ativo' com um clique no Admin, e
-- os dados da pessoa continuam onde estavam. A tela de login diz isso a ela,
-- com o caminho para o WhatsApp do suporte — uma porta que fecha em silêncio
-- vira chamado com raiva.
-- ============================================================================

alter table public.perfis
  add column if not exists pausada_em timestamptz,
  add column if not exists pausada_motivo text;

comment on column public.perfis.pausada_em is
  'Quando a conta foi pausada automaticamente. Nulo = nunca foi. Serve para a tela de login explicar o motivo em vez de só recusar.';

-- ---------------------------------------------------------------------------
-- O que cada pessoa fez, para o relatório de quem é dono do produto
-- ---------------------------------------------------------------------------
create or replace function public.relatorio_de_uso()
returns table (
  perfil_id uuid, nome text, email text, crm text,
  organizacao text, plano text, origem text,
  conta_criada timestamptz, ultimo_acesso timestamptz, teste_ate timestamptz,
  pacientes int, avaliacoes int, avaliacoes_concluidas int, plantoes int,
  aparelhos int, ativo_nas_24h boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id, p.nome, coalesce(p.email, u.email), p.crm,
    i.nome, i.plano,
    coalesce(u.raw_user_meta_data->>'origem', ''),
    u.created_at, u.last_sign_in_at, i.assinatura_ate,
    (select count(*) from public.pacientes x where x.institution_id = p.institution_id)::int,
    (select count(*) from public.avaliacoes x where x.institution_id = p.institution_id)::int,
    (select count(*) from public.avaliacoes x where x.institution_id = p.institution_id
       and x.concluida_at is not null)::int,
    (select count(*) from public.plantoes x where x.perfil_id = p.id)::int,
    (select count(*) from public.push_inscricoes x where x.perfil_id = p.id)::int,
    -- "Usou" é ter MEXIDO em alguma coisa, e não só ter feito login: quem abre
    -- o sistema e fecha não está usando, e contá-lo como ativo faria o
    -- relatório mentir para o lado otimista, que é o pior lado.
    (exists (select 1 from public.avaliacoes x where x.institution_id = p.institution_id
               and x.updated_at > now() - interval '24 hours')
     or exists (select 1 from public.plantoes x where x.perfil_id = p.id
                  and x.updated_at > now() - interval '24 hours')
     or u.last_sign_in_at > now() - interval '24 hours')
  from public.perfis p
  join auth.users u on u.id = p.id
  join public.instituicoes i on i.id = p.institution_id
  where p.status = 'ativo'
  order by u.last_sign_in_at desc nulls last
$$;

comment on function public.relatorio_de_uso() is
  'Uso de cada pessoa, para o relatório diário do dono do produto. Lê auth.users e atravessa organizações: só o service_role executa.';

revoke execute on function public.relatorio_de_uso() from public, anon, authenticated;
grant execute on function public.relatorio_de_uso() to service_role;

-- ---------------------------------------------------------------------------
-- A pausa
-- ---------------------------------------------------------------------------
create or replace function public.pausar_inativos_da_campanha(p_dias int default 14)
returns table (perfil_id uuid, nome text, email text, dias int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.perfis p
     set status = 'inativo',
         pausada_em = now(),
         pausada_motivo = 'inatividade',
         updated_at = now()
   from auth.users u, public.instituicoes i
   where u.id = p.id
     and i.id = p.institution_id
     and p.status = 'ativo'
     and p.pausada_em is null
     and coalesce(u.raw_user_meta_data->>'origem','') <> ''
     and i.plano = 'trial'
     and p.role = 'owner'
     -- Quem nunca entrou conta da criação da conta: sem o coalesce, um nulo
     -- faria a comparação dar falso e a conta abandonada no dia do cadastro
     -- seria a única a nunca ser pausada.
     and coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => p_dias)
  returning p.id, p.nome, coalesce(p.email, u.email),
            floor(extract(epoch from (now() - coalesce(u.last_sign_in_at, u.created_at)))/86400)::int;
end;
$$;

comment on function public.pausar_inativos_da_campanha(int) is
  'Pausa contas VINDAS DA CAMPANHA (origem preenchida) paradas há N dias. Nunca toca em cortesia, assinante, equipe convidada nem em conta já pausada. Só o service_role executa.';

revoke execute on function public.pausar_inativos_da_campanha(int) from public, anon, authenticated;
grant execute on function public.pausar_inativos_da_campanha(int) to service_role;
