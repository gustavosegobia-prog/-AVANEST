import type { Metadata } from "next";
import { PaginaLegal } from "@/components/pagina-legal";

export const metadata: Metadata = {
  // O endereço oficial desta página.
  //
  // Sem canonical, `avanest.com.br/x`, `www.avanest.com.br/x` e a mesma página
  // com `?utm_source=...` são três endereços distintos para o buscador, que
  // então divide entre eles a força que deveria ser de um só — e escolhe
  // sozinho qual mostrar. O canonical não fica no layout de propósito: no Next
  // ele é HERDADO, e um canonical no layout apontaria TODAS as páginas para a
  // capa, que é bem pior do que não ter nenhum.
  alternates: { canonical: "/termos" },
  title: "Termos de Uso | AVANEST",
  description: "Condições de uso do AVANEST, sistema de gestão em anestesiologia.",
};

export default function TermosPage() {
  return (
    <PaginaLegal
      titulo="Termos de Uso"
      resumo="Estas condições regem o uso do AVANEST. Ao criar uma conta ou usar o sistema, você concorda com elas."
      vigencia="19 de agosto de 2026"
    >
      <h2>1. Quem somos</h2>
      <p>
        O AVANEST é operado por <b>G. Segobia Serviços Médicos Ltda.</b>, CNPJ 55.965.276/0001-04,
        adiante chamada AVANEST. Contato: <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a>.
      </p>

      <h2>2. O que o AVANEST é — e o que não é</h2>
      <p>
        O AVANEST é uma ferramenta de <b>registro e organização</b> do trabalho do anestesiologista:
        a avaliação pré-anestésica, a escala de plantões, a produção do dia e o acompanhamento do
        que há a faturar e a receber. Ele organiza dados que o profissional insere, aplica escores
        conhecidos (ASA, Índice de Lee, STOP-Bang, Apfel) e produz documentos a partir disso.
      </p>
      <p className="legalDestaque">
        O AVANEST <b>não pratica atos médicos</b>. Não diagnostica, não prescreve, não indica
        conduta e não substitui o julgamento clínico. Escores, alertas e orientações sobre
        medicamentos são <b>apoio à decisão</b>. A responsabilidade pela avaliação, pela conduta e
        pelo que é assinado é inteiramente do profissional habilitado que a realiza.
      </p>

      <h2>3. Quem pode usar</h2>
      <p>
        O acesso é individual e destinado a profissionais de saúde e à equipe administrativa da
        organização contratante. Cada pessoa responde pelo que faz com seu login. Não compartilhe
        senha: o sistema registra as ações por usuário, e uma senha compartilhada torna o registro
        inútil e a responsabilidade indefinida.
      </p>
      <p>
        Quem responde pela organização é responsável por manter a lista de usuários atualizada e por
        remover o acesso de quem deixou a equipe.
      </p>

      <h2>4. Organizações e isolamento</h2>
      <p>
        Cada organização é um espaço fechado. Pacientes, avaliações, documentos e informações
        financeiras de uma organização não são acessíveis a nenhuma outra. Novos integrantes só
        entram por convite de quem administra a organização.
      </p>

      <h2>5. Planos, pagamento e renovação</h2>
      <p>
        Os preços vigentes são os exibidos em <a href="/planos">avanest.com.br/planos</a>. A
        assinatura é mensal e recorrente, processada pela <b>Stripe</b>. O AVANEST não recebe
        nem armazena números de cartão: eles são digitados na página do provedor de pagamento.
      </p>
      <p>
        Cada plano comporta um número máximo de anestesiologistas. Para incluir mais profissionais,
        é necessário mudar de plano.
      </p>
      <p>
        <b>Preço de fundador:</b> quando a campanha de lançamento estiver ativa e houver vaga, o
        valor promocional fica garantido enquanto a assinatura seguir ativa e ininterrupta.
        Cancelada a assinatura, a vaga retorna para o grupo de vagas disponíveis e a organização
        <b> não retorna à campanha</b> — uma nova contratação será pelo preço de tabela vigente.
      </p>
      <p>
        <b>Cancelamento:</b> pode ser feito a qualquer momento pela própria conta, em
        <b>Assinatura</b>, sem passar por atendimento. O acesso permanece até o fim do período já
        pago. Não há multa nem fidelidade. O valor do mês em curso é devolvido quando o cancelamento
        ocorre em até <b>14 dias</b> do último pagamento; depois desse prazo não há devolução
        proporcional.
      </p>
      <p>
        <b>Falta de pagamento:</b> vencida a assinatura, o acesso ao sistema é bloqueado. Os dados
        continuam guardados e voltam a ficar acessíveis com a regularização, observado o item 8.
      </p>
      <p>
        <b>Nota fiscal, recibo e dúvidas de cobrança:</b>{" "}
        <a href="mailto:financeiro@avanest.com.br">financeiro@avanest.com.br</a>.
      </p>

      <h2>6. Período de teste</h2>
      <p>
        Novas organizações começam com um período de teste gratuito. Encerrado o período sem
        contratação, o acesso é bloqueado até que um plano seja contratado.
      </p>

      <h2>7. Seus dados são seus</h2>
      <p>
        Os dados clínicos e cadastrais inseridos pertencem à organização contratante e aos
        respectivos pacientes. O AVANEST os trata como <b>operador</b>, seguindo as instruções da
        organização, conforme detalhado na <a href="/privacidade">Política de Privacidade</a>.
      </p>
      <p>
        O AVANEST não vende, aluga nem cede dados de pacientes a terceiros, e não os utiliza para
        finalidade alheia à prestação do serviço.
      </p>

      <h2>8. Guarda e exclusão</h2>
      <p>
        Prontuário é documento de guarda obrigatória. O AVANEST mantém os registros clínicos pelo
        prazo exigido pela legislação e pelas normas do Conselho Federal de Medicina —{" "}
        <b>no mínimo 20 anos</b> a contar do último registro, conforme a Resolução CFM nº 1.821/2007.
        Esse prazo prevalece sobre pedido de exclusão, inclusive após o encerramento da assinatura.
      </p>
      <p>
        A organização pode solicitar a exportação de seus dados a qualquer momento, em formato
        legível por máquina.
      </p>

      <h2>9. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o serviço disponível, mas ele depende de infraestrutura de terceiros
        e da internet. Não garantimos funcionamento ininterrupto. Manutenções programadas serão
        avisadas com antecedência sempre que possível.
      </p>
      <p>
        Recomendamos imprimir ou arquivar os documentos essenciais de cada atendimento. Nenhum
        sistema substitui a cautela de ter à mão o que é indispensável no dia da cirurgia.
      </p>
      <p>
        <b>Suporte:</b> incluído em todos os planos, pela aba de chamados dentro do sistema ou por{" "}
        <a href="mailto:suporte@avanest.com.br">suporte@avanest.com.br</a>.
      </p>

      <h2>10. Limite de responsabilidade</h2>
      <p>
        O AVANEST responde por falhas do próprio serviço, nos limites da lei. Não responde por
        decisões clínicas, por dados inseridos incorretamente, nem por consequências do uso do
        sistema fora do previsto nestes termos.
      </p>
      <p>
        Havendo responsabilidade do AVANEST por falha do serviço, ela fica limitada ao valor pago
        pela organização nos 12 meses anteriores ao evento.
      </p>

      <h2>11. Uso indevido</h2>
      <p>
        É vedado tentar acessar dados de outra organização, burlar controles de acesso, automatizar
        acessos sem autorização, ou usar o sistema para finalidade ilícita. A conta envolvida pode
        ser suspensa imediatamente, sem prejuízo das medidas cabíveis.
      </p>

      <h2>12. Alterações</h2>
      <p>
        Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas por e-mail ou
        dentro do sistema com pelo menos 30 dias de antecedência. Seguir usando o AVANEST após a
        vigência significa concordar com o texto novo.
      </p>

      <h2>13. Foro</h2>
      <p>
        Aplica-se a lei brasileira. Fica eleito o foro da comarca de Campo Mourão, Paraná, para
        dirimir questões oriundas destes termos.
      </p>
    </PaginaLegal>
  );
}
