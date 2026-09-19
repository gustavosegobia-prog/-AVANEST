-- ============================================================================
-- "Parado" passa a significar parado, e não "não digitou a senha de novo"
--
-- O DEFEITO. `pausar_inativos_da_campanha` decidia pelo `last_sign_in_at`. Esse
-- campo só muda quando alguém digita e-mail e senha OUTRA VEZ — quem fica
-- logado no celular usa o sistema por semanas sem nunca gerar um login novo. É
-- o comportamento de quem instalou e está usando, ou seja, exatamente o cliente
-- que não se quer desligar.
--
-- Medido contra a base real, o campo mentia em quase metade dos casos:
--
--   Lucas Quijo   48 dias pelo login   → 23 de verdade
--   Matheus       45                   →  6
--   Taylor        34                   →  3
--   Thais         22                   →  2
--   Igor          15                   →  3
--   o próprio dono do produto  2       →  0
--
-- O caso que obrigou a corrigir: o cadastro da campanha que mais usa o produto
-- lançou sete plantões, R$ 6.498, em três sessões ao longo de dois dias — e não
-- relogou nenhuma vez. Do jeito antigo, ele seria pausado por inatividade no
-- meio do fechamento do mês dele, com um recado para procurar o suporte.
--
-- A ATIVIDADE É PESSOAL, E NÃO DA ORGANIZAÇÃO. Ficha e paciente são tabelas da
-- instituição: contar tudo que a organização fez faria o trabalho de um único
-- anestesista manter a equipe inteira "ativa" no relatório — e um serviço com
-- dez médicos nunca mostraria ninguém parado. Por isso cada tabela é filtrada
-- por quem fez: `created_by`, e no plantão também o `perfil_id`, porque o dono
-- do plantão é quem o confirma e quem lança o valor.
--
-- UMA DEFINIÇÃO SÓ, para o relatório e para a pausa. Antes o relatório olhava
-- uma coisa (mexeu em ficha ou plantão) e a pausa olhava outra (login). Duas
-- definições de "ativo" no mesmo produto garantem que um dia elas discordem, e
-- o dia em que discordam é o dia em que o e-mail diz uma coisa e o sistema faz
-- outra.
-- ============================================================================

create or replace function public.ultima_atividade(p_perfil uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    -- O piso é a criação da conta: quem nunca fez nada está parado desde que
    -- se cadastrou, e não desde 1970. Sem isto, `greatest` com tudo nulo
    -- devolveria nulo e a conta escaparia de qualquer comparação.
    u.created_at,
    u.last_sign_in_at,
    (select max(x.updated_at) from public.plantoes x
       where x.perfil_id = p.id or x.created_by = p.id),
    (select max(x.updated_at) from public.avaliacoes x where x.created_by = p.id),
    (select max(x.updated_at) from public.pacientes x where x.created_by = p.id)
  )
  from public.perfis p
  join auth.users u on u.id = p.id
  where p.id = p_perfil
$$;

comment on function public.ultima_atividade(uuid) is
  'A última vez que ESTA PESSOA fez alguma coisa: entrou, ou mexeu em plantão, ficha ou paciente que é dela. Definição única de "ativo", usada pelo relatório diário e pela pausa por inatividade.';

revoke execute on function public.ultima_atividade(uuid) from public, anon, authenticated;
grant execute on function public.ultima_atividade(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- O relatório passa a devolver a data, para o e-mail contar a mesma história
-- ---------------------------------------------------------------------------
drop function if exists public.relatorio_de_uso();

create function public.relatorio_de_uso()
returns table (
  perfil_id uuid, nome text, email text, crm text,
  organizacao text, plano text, origem text,
  conta_criada timestamptz, ultimo_acesso timestamptz, teste_ate timestamptz,
  pacientes int, avaliacoes int, avaliacoes_concluidas int, plantoes int,
  aparelhos int, ativo_nas_24h boolean, ultima_atividade timestamptz
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
    -- Continua sendo da ORGANIZAÇÃO de propósito: esta coluna responde "a casa
    -- se mexeu hoje?", que é outra pergunta. Quem responde "esta pessoa se
    -- mexeu?" é a coluna ao lado.
    (exists (select 1 from public.avaliacoes x where x.institution_id = p.institution_id
               and x.updated_at > now() - interval '24 hours')
     or exists (select 1 from public.plantoes x where x.perfil_id = p.id
                  and x.updated_at > now() - interval '24 hours')
     or u.last_sign_in_at > now() - interval '24 hours'),
    public.ultima_atividade(p.id)
  from public.perfis p
  join auth.users u on u.id = p.id
  join public.instituicoes i on i.id = p.institution_id
  where p.status = 'ativo'
  order by public.ultima_atividade(p.id) desc nulls last
$$;

comment on function public.relatorio_de_uso() is
  'Uso de cada pessoa, para o relatório diário do dono do produto. Lê auth.users e atravessa organizações: só o service_role executa.';

revoke execute on function public.relatorio_de_uso() from public, anon, authenticated;
grant execute on function public.relatorio_de_uso() to service_role;

-- ---------------------------------------------------------------------------
-- E a pausa deixa de contar login
-- ---------------------------------------------------------------------------
-- As quatro travas continuam onde estavam, e continuam sendo o que impede esta
-- função de alcançar equipe convidada, cortesia ou assinante. O que muda é uma
-- linha: a data comparada.
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
     -- ERA `coalesce(u.last_sign_in_at, u.created_at)`, e era o defeito: quem
     -- fica logado no celular nunca gera login novo. `ultima_atividade` já
     -- inclui o login, então esta troca só AMPLIA o que conta como sinal de
     -- vida — ninguém que escapava antes passa a ser pausado agora.
     and public.ultima_atividade(p.id) < now() - make_interval(days => p_dias)
   returning p.id, p.nome, coalesce(p.email, u.email),
             floor(extract(epoch from (now() - public.ultima_atividade(p.id)))/86400)::int;
end;
$$;

comment on function public.pausar_inativos_da_campanha(int) is
  'Pausa contas VINDAS DA CAMPANHA (origem preenchida) sem atividade há N dias. Conta atividade de verdade, não login. Nunca toca em cortesia, assinante, equipe convidada nem em conta já pausada. Só o service_role executa.';

revoke execute on function public.pausar_inativos_da_campanha(int) from public, anon, authenticated;
grant execute on function public.pausar_inativos_da_campanha(int) to service_role;
