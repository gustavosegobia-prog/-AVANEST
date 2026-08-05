import type { Metadata } from "next";
import { PaginaLegal } from "@/components/pagina-legal";

export const metadata: Metadata = {
  title: "Política de Privacidade | AvaNEST",
  description: "Como o AVANEST trata dados pessoais e dados de saúde, conforme a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      resumo="Como o AVANEST trata dados pessoais, em especial dados de saúde, conforme a Lei nº 13.709/2018 (LGPD)."
      vigencia="3 de agosto de 2026"
    >
      <h2>1. Quem responde pelo quê</h2>
      <p>
        Esta é a parte mais importante e costuma ser a menos explicada. Há dois papéis distintos:
      </p>
      <ul>
        <li>
          <b>Dados de pacientes.</b> Quem decide coletá-los e para quê é a organização contratante —
          o anestesiologista, o grupo ou a clínica. Ela é a <b>controladora</b>. O AVANEST é{" "}
          <b>operador</b>: trata os dados apenas para prestar o serviço e conforme as instruções
          dela.
        </li>
        <li>
          <b>Dados de conta e cobrança</b> (quem contrata, e-mail de acesso, plano, pagamentos).
          Aqui o AVANEST é o <b>controlador</b>.
        </li>
      </ul>
      <p>
        Na prática: se um paciente quiser exercer direitos sobre seus dados, o pedido deve ser
        dirigido à clínica ou ao médico que o atendeu. O AVANEST apoia a organização a atender esse
        pedido, mas não decide sozinho sobre esses dados.
      </p>

      <h2>2. Que dados são tratados</h2>
      <p><b>De pacientes, inseridos pela organização:</b></p>
      <ul>
        <li>Identificação: nome, CPF, RG, data de nascimento, sexo.</li>
        <li>Contato: telefone, e-mail, endereço, cidade, UF, CEP.</li>
        <li>Convênio: operadora, número de carteirinha, validade, plano.</li>
        <li>Atendimento: hospital, cirurgia, especialidade, procedimento, data e horário.</li>
        <li>
          <b>Dados de saúde</b> — anamnese, comorbidades, alergias, medicamentos em uso, exame
          físico, avaliação de via aérea, resultados de exames, escores de risco, plano anestésico e
          conclusão. A LGPD classifica esses dados como <b>pessoais sensíveis</b> (art. 5º, II).
        </li>
        <li>Documentos anexados ao atendimento.</li>
        <li>Registros financeiros do atendimento: valor, convênio, nota fiscal, pagamentos.</li>
      </ul>
      <p><b>De usuários do sistema:</b> nome, e-mail, CRM, RQE, perfil de acesso e situação.</p>
      <p>
        <b>Registros de auditoria:</b> quem fez o quê e quando, incluindo endereço IP. Existem para
        rastreabilidade e segurança — sem eles não é possível saber quem alterou um registro clínico.
      </p>
      <p>
        <b>Pagamento:</b> o AVANEST guarda o identificador da assinatura e o e-mail do pagador.{" "}
        <b>Dados de cartão nunca passam pelos nossos servidores</b> — quem os processa é o Mercado
        Pago.
      </p>

      <h2>3. Para que são usados</h2>
      <ul>
        <li>Prestar o serviço: registrar a avaliação e emitir ficha, termo e orientações.</li>
        <li>Autenticar usuários e controlar o que cada perfil pode ver.</li>
        <li>Cobrar a assinatura e emitir documentos fiscais.</li>
        <li>Cumprir obrigações legais de guarda de prontuário.</li>
        <li>Segurança: registrar acessos e alterações, e investigar incidentes.</li>
      </ul>
      <p>
        Não usamos dados de pacientes para publicidade, não os vendemos e não os cedemos a
        terceiros. Não treinamos modelos de inteligência artificial com dados de pacientes.
      </p>

      <h2>4. Bases legais</h2>
      <ul>
        <li>
          <b>Dados de saúde:</b> tutela da saúde, em procedimento realizado por profissionais de
          saúde (art. 11, II, "f" da LGPD), e cumprimento de obrigação legal e regulatória
          (art. 11, II, "a").
        </li>
        <li><b>Dados cadastrais de pacientes:</b> execução do serviço e obrigação legal (art. 7º, II e V).</li>
        <li><b>Dados de conta e cobrança:</b> execução do contrato (art. 7º, V).</li>
        <li><b>Auditoria e segurança:</b> legítimo interesse e obrigação legal (art. 7º, IX e II).</li>
      </ul>

      <h2>5. Com quem os dados são compartilhados</h2>
      <p>
        Somente com fornecedores necessários para o serviço funcionar, cada um com acesso restrito à
        sua função:
      </p>
      <ul>
        <li><b>Supabase</b> — banco de dados, autenticação e armazenamento de arquivos.</li>
        <li><b>Vercel</b> — hospedagem da aplicação.</li>
        <li><b>Mercado Pago</b> — processamento de pagamentos (não recebe dados de pacientes).</li>
      </ul>
      <p>
        Também compartilhamos quando houver ordem judicial ou requisição de autoridade competente.
      </p>
      <p>
        <b>Transferência internacional:</b> a infraestrutura desses fornecedores pode estar fora do
        Brasil. Nesses casos a transferência se dá com as salvaguardas contratuais dos respectivos
        fornecedores, nos termos do art. 33 da LGPD.
      </p>

      <h2>6. Por quanto tempo</h2>
      <ul>
        <li>
          <b>Registros clínicos:</b> no mínimo <b>20 anos</b> a contar do último registro, conforme
          a Resolução CFM nº 1.821/2007. Esse prazo é obrigatório e prevalece sobre pedido de
          exclusão.
        </li>
        <li><b>Registros financeiros e fiscais:</b> pelo prazo da legislação tributária.</li>
        <li><b>Auditoria:</b> enquanto útil à segurança e à prestação de contas.</li>
        <li><b>Conta de usuário:</b> enquanto houver vínculo com a organização.</li>
      </ul>

      <h2>7. Como os dados são protegidos</h2>
      <ul>
        <li>Tráfego cifrado (HTTPS) e dados cifrados em repouso pela infraestrutura.</li>
        <li>
          <b>Isolamento por organização aplicado no banco de dados</b>, e não apenas na tela: cada
          consulta é filtrada pela organização de quem a fez.
        </li>
        <li>Perfis de acesso: a recepção não vê conteúdo clínico; o financeiro não vê avaliação.</li>
        <li>Senhas guardadas com hash — ninguém no AVANEST consegue ler a sua.</li>
        <li>Registro de auditoria das ações relevantes.</li>
        <li>Backups automáticos da base.</li>
      </ul>

      <h2>8. Direitos do titular</h2>
      <p>O art. 18 da LGPD garante a você:</p>
      <ul>
        <li>Confirmar se há tratamento e acessar seus dados.</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
        <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
        <li>Solicitar portabilidade.</li>
        <li>Saber com quem os dados foram compartilhados.</li>
        <li>Revogar consentimento, quando essa for a base legal aplicável.</li>
      </ul>
      <p>
        <b>Pacientes:</b> procure a clínica ou o médico que realizou o atendimento — é a
        controladora dos seus dados. <b>Usuários do sistema:</b> escreva para{" "}
        <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a>.
      </p>
      <p>
        Lembrando: registros clínicos têm guarda obrigatória por lei, e por isso um pedido de
        exclusão não os alcança antes do prazo legal.
      </p>

      <h2>9. Incidentes</h2>
      <p>
        Havendo incidente de segurança com risco relevante aos titulares, comunicaremos as
        organizações afetadas e a Autoridade Nacional de Proteção de Dados nos prazos da lei,
        informando o que aconteceu, quais dados foram atingidos e as medidas tomadas.
      </p>

      <h2>10. Cookies</h2>
      <p>
        O AVANEST usa apenas cookies necessários para manter você conectado e lembrar sua preferência
        de tema. Não há cookies de publicidade nem rastreamento de terceiros.
      </p>

      <h2>11. Encarregado (DPO) e contato</h2>
      <p>
        Encargo exercido por G. Segobia Serviços Médicos LTDA. Contato para assuntos de proteção de
        dados: <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a>.
      </p>

      <h2>12. Alterações</h2>
      <p>
        Esta política pode ser atualizada. Mudanças relevantes serão comunicadas por e-mail ou dentro
        do sistema, com a data de vigência indicada no topo desta página.
      </p>
    </PaginaLegal>
  );
}
