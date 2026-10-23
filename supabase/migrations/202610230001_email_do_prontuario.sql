-- ===========================================================================
-- O e-mail que recebe a avaliação para o prontuário do hospital
-- ===========================================================================
-- Ao concluir a avaliação pré-anestésica, a AVANEST manda o PDF da ficha para
-- um endereço do hospital, e o próprio hospital anexa no prontuário (Tasy ou o
-- sistema que for). Este é o endereço.
--
-- COLUNA PRÓPRIA, E NÃO O `email` QUE O LOCAL JÁ TEM. O `email` de contato foi
-- preenchido para outra coisa — recepção, faturamento — e reaproveitá-lo faria
-- um local cadastrado em agosto começar a receber ficha de paciente sem que
-- ninguém tivesse pedido. Dado clínico só vai para quem foi indicado para
-- recebê-lo: coluna vazia (o padrão) = nada é enviado.
--
-- O RLS do local já vale para ela: quem edita o local (administrador, para o
-- do grupo; o próprio médico, para o particular) é quem decide o destino. O
-- servidor lê daqui na hora de mandar; a tela nunca escolhe o endereço.
--
-- O registro de cada envio fica na auditoria (avaliacao_enviada_prontuario),
-- e não numa coluna da avaliação: avaliação concluída é imutável
-- (proteger_avaliacao_concluida), e um envio não é alteração do documento.
-- ===========================================================================

alter table public.locais_atendimento
  add column if not exists email_prontuario text;

comment on column public.locais_atendimento.email_prontuario is
  'Endereço do hospital que recebe o PDF da avaliação concluída, para arquivo no prontuário. Vazio = não envia.';
