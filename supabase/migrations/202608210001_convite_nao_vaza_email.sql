-- O convite deixa de entregar o e-mail de quem já não pode usá-lo.
--
-- convite_info é chamável por anon — precisa ser: quem abre o link de convite
-- ainda não tem conta. Ela recebe o token e devolve organização, papel, e-mail
-- e se o convite vale. O token tem 256 bits de entropia, então não há como
-- adivinhar.
--
-- O problema não é adivinhar: é que a função devolvia o e-mail mesmo quando o
-- convite já tinha sido usado ou já tinha vencido. E o link de convite não
-- desaparece depois de usado — ele fica no WhatsApp da pessoa, no e-mail dela,
-- às vezes num grupo. Meses depois, quem abrisse aquele link continuava vendo
-- o e-mail de um profissional da clínica, para sempre.
--
-- Dado pessoal exposto por um endereço que sobrevive ao seu propósito. A tela
-- do convite só precisa do e-mail para preencher o campo de quem VAI se
-- cadastrar; se o convite não vale mais, não há cadastro para preencher e o
-- e-mail não serve para nada ali.
--
-- A organização continua saindo mesmo no convite inválido, e isso é
-- deliberado: é o que permite a tela dizer "o convite da Clínica X expirou,
-- peça um novo" em vez de um erro seco que ninguém sabe a quem levar.

create or replace function public.convite_info(p_token text)
returns table (organizacao text, papel text, email text, valido boolean)
language sql
security definer
set search_path = public
as $$
  select
    i.nome,
    c.role,
    case when c.status = 'pendente' and c.expires_at > now() then c.email end,
    (c.status = 'pendente' and c.expires_at > now())
  from public.convites c
  join public.instituicoes i on i.id = c.institution_id
  where c.token = p_token;
$$;

revoke all on function public.convite_info(text) from public;
grant execute on function public.convite_info(text) to anon, authenticated;
