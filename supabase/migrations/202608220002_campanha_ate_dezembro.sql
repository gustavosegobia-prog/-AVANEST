-- A campanha de lançamento vai até 31 de dezembro de 2026.
--
-- Era 31 de outubro. Migração separada de propósito: a 202608220001 já foi
-- aplicada, e migração aplicada não se reescreve — quem rodou a primeira ficaria
-- com o banco dizendo outubro e o arquivo dizendo dezembro, sem nada que
-- explicasse a diferença. Uma linha nova conta a história inteira.
--
-- Só a data muda. Os dois meses grátis, o preço por profissional e as faixas
-- continuam como estão.

update public.campanha_fundador
   set termina_em = date '2026-12-31',
       ativa = true,
       updated_at = now()
 where id;
