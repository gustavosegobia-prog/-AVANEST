-- ===========================================================================
-- Profissional sem acesso: quem entra na escala e não usa o sistema
-- ===========================================================================
-- O anestesiologista mais velho do grupo não tem e-mail, não vai instalar
-- nada e não quer saber de senha — mas trabalha, entra na escala e recebe. Um
-- sistema que só sabe cadastrar quem faz login obriga o grupo a inventar um
-- e-mail para ele, e aí existe uma conta de verdade, com senha de verdade,
-- que ninguém controla.
--
-- Aqui ele é um perfil como qualquer outro, com uma marca: não tem acesso.
-- Aparece na escala, na equipe e no faturamento; não aparece em nada que
-- pressuponha alguém do outro lado da tela.
--
-- POR QUE A CONTA DE AUTENTICAÇÃO CONTINUA EXISTINDO
--
-- Todo o sistema é construído sobre `perfis.id = auth.uid()`: é assim que o
-- RLS sabe de quem é cada linha, em toda tabela. Um perfil com id que não
-- vem de auth.users obrigaria a revisar essa regra em todo lugar — e regra de
-- isolamento revisada às pressas é vazamento entre organizações.
--
-- Então a conta nasce, e nasce inútil: endereço em domínio .invalid, que a
-- RFC 2606 reserva justamente para nunca existir, e senha aleatória que
-- ninguém — nem quem cadastrou — chega a ver. Não há login possível, não há
-- recuperação de senha possível, e o RLS continua funcionando como sempre.
-- ===========================================================================

alter table public.perfis
  add column if not exists sem_acesso boolean not null default false;

comment on column public.perfis.sem_acesso is
  'Profissional que existe para ser escalado e faturado, sem login. '
  'A conta de autenticação existe por causa de perfis.id = auth.uid(), '
  'mas tem endereço em domínio .invalid e senha que ninguém conhece.';

-- Quem não entra no sistema não tem por que ter permissão de área nenhuma, e
-- não faz sentido pedir troca de senha a quem nunca vai ver uma tela de login.
update public.perfis
   set permissoes = '{}', must_reset = false
 where sem_acesso and (permissoes is distinct from '{}' or must_reset);
