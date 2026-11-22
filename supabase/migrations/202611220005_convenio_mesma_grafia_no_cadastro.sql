-- A mesma grafia para o mesmo convênio no cadastro do paciente (22/11/2026):
-- "Sus" (3) vira "SUS" e "UNIMED" (2) vira "Unimed", como na Produção e na
-- lista de sugestões. Daqui em diante a ficha anestésica grava o paciente novo
-- na grafia conhecida (lib/convenios.ts, convenioDoCadastro).
update public.pacientes
   set convenio = 'SUS'
 where public.nome_simples(convenio) = 'sus' and convenio <> 'SUS';

update public.pacientes
   set convenio = 'Unimed'
 where public.nome_simples(convenio) = 'unimed' and convenio <> 'Unimed';
