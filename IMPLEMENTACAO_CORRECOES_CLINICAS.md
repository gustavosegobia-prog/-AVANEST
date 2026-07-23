# AVANEST — correções clínicas consolidadas

Versão preparada em 23/07/2026.

## Escopo implementado

1. Presença e falta na recepção
   - Os botões **Presente** e **Faltou** atualizam o atendimento no banco.
   - A tela é atualizada após a gravação e exibe o novo estado.
   - O registro inclui data, hora e usuário responsável pela alteração.

2. Idade, peso ideal e peso ajustado
   - Datas de nascimento que resultem em idade menor que 0 ou maior que 130 anos são recusadas.
   - O peso ideal usa a fórmula de Devine conforme sexo e altura.
   - O peso ajustado é exibido quando o peso real ultrapassa o peso ideal.

3. Anamnese contextual
   - Respostas **Sim** abrem exemplos rápidos e campos específicos.
   - Doença respiratória inclui doença, controle, última crise, internação/UTI/intubação e medicamentos.
   - Anticoagulantes incluem indicação e data/hora da última dose.

4. Avaliação em fluxo contínuo
   - Todas as etapas ficam na mesma página.
   - Não há paginação por **Anterior** ou **Salvar e continuar**.
   - O menu superior leva à seção escolhida e o salvamento automático continua ativo.

5. Base de medicamentos
   - Base inicial criada a partir do **Guia Perioperatório de Medicamentos — versão 1.0, revisão 07/2026**.
   - Exibe princípio ativo, classe, conduta, prazo, última dose sugerida, reinício, ajustes, exceções e fonte.
   - Toda orientação precisa ser confirmada individualmente pelo anestesiologista.
   - Medicamentos sem regra cadastrada continuam disponíveis, mas exigem orientação manual e confirmação.

6. Concentrado de hemácias
   - Quando a opção for **Sim**, aparece o campo obrigatório **Quantidade de CH**.
   - A quantidade é incluída no resumo e nos documentos.

7. Identificação do anestesiologista
   - Nome, CRM/UF e RQE são preenchidos a partir do perfil conectado.
   - Os campos permanecem editáveis.
   - A auditoria registra separadamente o usuário autenticado, seus dados, data e hora da conclusão.

8. Termo de consentimento
   - Conteúdo substituído pelo documento fornecido **FICHA PRÉ-ANESTÉSICA INOVANEST (Eder Samorano Fortes).pdf**.
   - Mantém os itens de informação, riscos, autorização e campos de assinatura de paciente, testemunha e data.

## Validação

- Compilação de produção do Next.js concluída sem erros.
- TypeScript validado.
- Rotas de login, recuperação de senha, painel, avaliação e documentos geradas com sucesso.

