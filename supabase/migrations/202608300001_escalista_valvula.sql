-- ============================================================================
-- A saída de emergência da escala
--
-- A regra do escalista foi escrita com uma válvula: "o proprietário nunca
-- perde — escalista de férias, com a senha perdida ou fora do grupo não pode
-- trancar a escala do mês do lado de fora".
--
-- No primeiro uso real a válvula não existia. A INOVANEST tem 14 pessoas
-- ativas, 4 administradores e ZERO proprietários — a organização nasceu sem
-- `owner`. Marcado o primeiro escalista, os 4 administradores perderam o poder
-- e não sobrou ninguém para destravar: um grupo de 13 anestesiologistas com
-- ponto único de falha na escala do mês.
--
-- O super-admin passa a montar escala também. É a mesma pessoa que já
-- consegue dar cortesia, suspender e cancelar assinatura pelo painel da
-- plataforma; recusar-lhe o lançamento de um plantão enquanto o grupo está
-- travado é rigor sem função.
--
-- ---------------------------------------------------------------------------
-- O QUE ISTO **NÃO** RESOLVE, e é importante não confundir.
--
-- A policy de `plantoes` continua exigindo
-- `institution_id = current_institution_id()`, e essa função devolve a
-- organização do PRÓPRIO perfil. Então o super-admin destrava a organização a
-- que ele pertence — e só ela. Para as outras, isto não é resgate nenhum.
--
-- Alargar a policy para o super-admin escrever em qualquer organização seria
-- outra decisão, bem maior: daria a uma conta o poder de mexer na escala de
-- serviços que não são dela. Não é o que este arquivo faz.
--
-- O conserto de verdade continua sendo estrutural: TODA organização precisa de
-- um `owner`. Esta migração é o cinto, não o freio.
-- ============================================================================

create or replace function public.pode_montar_escala()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role = 'owner'
        or p.escalista
        -- A válvula. Lida da mesma linha, sem uma segunda consulta.
        or p.super_admin
        -- Ninguém eleito nesta organização: segue a regra antiga.
        or (p.role = 'admin' and not exists (
              select 1 from public.perfis e
               where e.institution_id = p.institution_id
                 and e.escalista and e.status = 'ativo'))
      from public.perfis p
     where p.id = auth.uid() and p.status = 'ativo'
  ), false)
$$;

revoke execute on function public.pode_montar_escala() from public, anon;
grant execute on function public.pode_montar_escala() to authenticated;
