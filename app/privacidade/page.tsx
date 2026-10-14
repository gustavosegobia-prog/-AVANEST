import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
import { PaginaLegal } from "@/components/pagina-legal";

export const metadata: Metadata = paginaPublica({
  titulo: "Política de Privacidade | AVANEST",
  // 157 caracteres, pelo mesmo motivo da página de Termos: com 70 o buscador
  // ignorava a descrição e escrevia a dele. Quem procura isto quer saber
  // exatamente estas quatro coisas — quem responde, onde ficam, por quanto
  // tempo e o que dá para exigir —, então elas vão no resultado da busca.
  descricao: "Como o AVANEST trata dados pessoais e dados de saúde sob a LGPD: quem é controlador e quem é operador, onde os dados ficam, por quanto tempo e seus direitos.",
  caminho: "/privacidade",
});

// O QUE ESTÁ ESCRITO AQUI TEM DE SER VERDADE NO CÓDIGO. Cada fornecedor da
// seção 6 é um serviço que o sistema chama de fato (lib/email.ts,
// components/turnstile.tsx, lib/push.ts, lib/texto-do-laudo.ts…), e cada
// promessa ("o PDF é montado no aparelho", "a foto do laudo não sai dele")
// descreve como o código funciona hoje. Mudou o código, muda o texto.

const SECOES = [
  ["quem", "Quem somos e quem responde pelo quê"],
  ["dados", "Que dados são tratados"],
  ["criancas", "Dados de crianças e adolescentes"],
  ["finalidades", "Para que são usados"],
  ["bases", "Bases legais"],
  ["compartilhamento", "Com quem os dados são compartilhados"],
  ["aparelho", "O que fica no seu aparelho"],
  ["prazos", "Por quanto tempo"],
  ["seguranca", "Como os dados são protegidos"],
  ["automatizadas", "Decisões automatizadas e inteligência artificial"],
  ["direitos", "Seus direitos e como exercê-los"],
  ["incidentes", "Incidentes"],
  ["cookies", "Cookies"],
  ["contato", "Encarregado (DPO) e contato"],
  ["alteracoes", "Alterações"],
] as const;

const n = (id: (typeof SECOES)[number][0]) => SECOES.findIndex(([s]) => s === id) + 1;

export default function PrivacidadePage() {
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      resumo="Como o AVANEST trata dados pessoais, em especial dados de saúde, conforme a Lei nº 13.709/2018 (LGPD)."
      vigencia="14 de outubro de 2026"
    >
      <div className="legalEmResumo">
        <p><b>Em resumo</b></p>
        <ul>
          <li>Os dados dos pacientes são da clínica ou do médico que atende. O AVANEST guarda e processa esses dados por conta deles.</li>
          <li>Não vendemos dados. Não usamos dados de pacientes para publicidade nem para treinar ou alimentar inteligência artificial.</li>
          <li>Cada organização só vê os próprios dados, e essa separação é feita no banco de dados.</li>
          <li>Registros clínicos ficam guardados por no mínimo 20 anos, como exige o Conselho Federal de Medicina.</li>
          <li>Dentro do sistema não há cookie de publicidade nem rastreador de terceiros.</li>
          <li>Dúvidas e pedidos: <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a>.</li>
        </ul>
      </div>

      <nav aria-label="Nesta página">
        <ol className="legalSumario">
          {SECOES.map(([id, titulo], i) => <li key={id}><a href={`#${id}`}>{i + 1}. {titulo}</a></li>)}
        </ol>
      </nav>

      <h2 id="quem">{n("quem")}. Quem somos e quem responde pelo quê</h2>
      <p>
        O AVANEST é operado por <b>G. Segobia Serviços Médicos Ltda.</b>, CNPJ 55.965.276/0001-04. Há
        dois papéis distintos, e eles decidem a quem você se dirige:
      </p>
      <ul>
        <li>
          <b>Dados de pacientes.</b> Quem decide coletá-los e para quê é a organização contratante —
          o anestesiologista, o grupo ou a clínica. Ela é a <b>controladora</b>. O AVANEST é{" "}
          <b>operador</b>: trata os dados apenas para prestar o serviço e conforme as instruções
          dela.
        </li>
        <li>
          <b>Dados de conta e cobrança</b> (quem contrata, e-mail de acesso, plano, pagamentos, uso da
          conta). Aqui o AVANEST é o <b>controlador</b>.
        </li>
      </ul>
      <p>
        Na prática: se um paciente quiser exercer direitos sobre seus dados, o pedido deve ser
        dirigido à clínica ou ao médico que o atendeu. O AVANEST apoia a organização a atender esse
        pedido, mas não decide sozinho sobre esses dados.
      </p>

      <h2 id="dados">{n("dados")}. Que dados são tratados</h2>
      <p><b>De pacientes, inseridos pela organização:</b></p>
      <ul>
        <li>Identificação: nome, CPF, RG, data de nascimento, sexo.</li>
        <li>Contato: telefone, e-mail, endereço, cidade, UF, CEP.</li>
        <li>Convênio: operadora, número de carteirinha, validade, plano.</li>
        <li>Atendimento: hospital, cirurgia, especialidade, procedimento, data e horário.</li>
        <li>
          <b>Dados de saúde</b> — anamnese, comorbidades, alergias, medicamentos em uso, exame
          físico, avaliação de via aérea, resultados de exames, escores de risco, plano anestésico,
          conclusão e a ficha anestésica do procedimento (sinais vitais, medicamentos, técnica,
          intercorrências). A LGPD classifica esses dados como <b>pessoais sensíveis</b> (art. 5º, II).
        </li>
        <li>Documentos anexados ao atendimento.</li>
        <li>Registros financeiros do atendimento: valor, convênio, nota fiscal, pagamentos.</li>
      </ul>
      <p><b>De usuários do sistema:</b> nome, e-mail, CRM, RQE, perfil de acesso, situação, escala de plantões e mensagens trocadas na sala da equipe.</p>
      <p>
        <b>Dados técnicos de acesso:</b> endereço IP, data e hora, navegador e aparelho. Fazem parte
        dos registros de auditoria — quem fez o quê e quando —, que existem para rastreabilidade e
        segurança: sem eles não é possível saber quem alterou um registro clínico.
      </p>
      <p>
        <b>Pagamento:</b> o AVANEST guarda o identificador da assinatura e o e-mail do pagador.{" "}
        <b>Dados de cartão nunca passam pelos nossos servidores</b> — quem os processa é a Stripe.
      </p>

      <h2 id="criancas">{n("criancas")}. Dados de crianças e adolescentes</h2>
      <p>
        A anestesia pediátrica exige registrar dados de crianças e adolescentes. Eles são tratados no
        melhor interesse deles (LGPD, art. 14), apenas para a tutela da saúde, pela organização que
        realiza o atendimento — que é quem colhe a autorização do responsável legal quando ela é
        necessária, como no termo de consentimento assinado pelo responsável. O AVANEST não usa esses
        dados para nenhuma outra finalidade.
      </p>

      <h2 id="finalidades">{n("finalidades")}. Para que são usados</h2>
      <ul>
        <li>Prestar o serviço: registrar a avaliação e a ficha anestésica e emitir ficha, termo e orientações.</li>
        <li>Autenticar usuários e controlar o que cada perfil pode ver.</li>
        <li>Enviar os avisos do serviço — convites, plantões, trocas, mensagens da equipe e cobrança — por e-mail e por notificação, para quem as liga.</li>
        <li>Cobrar a assinatura e emitir documentos fiscais.</li>
        <li>
          Acompanhar o uso das contas (último acesso, recursos usados) para suporte, para gerir o
          período de teste e para melhorar o produto — com contagens e datas, sem ler o conteúdo
          clínico.
        </li>
        <li>Cumprir obrigações legais de guarda de prontuário e de registros de acesso.</li>
        <li>Segurança: registrar acessos e alterações, e investigar incidentes.</li>
        <li>
          Medir os anúncios do AVANEST nas páginas públicas do site, só para quem aceita o cookie de
          anúncios (seção {n("cookies")}).
        </li>
      </ul>
      <p>
        <b>Não</b> usamos dados de pacientes para publicidade, <b>não</b> os vendemos e <b>não</b> os
        cedemos a terceiros. <b>Não</b> treinamos modelos de inteligência artificial com dados de
        pacientes, nem os enviamos a serviços de inteligência artificial.
      </p>

      <h2 id="bases">{n("bases")}. Bases legais</h2>
      <ul>
        <li>
          <b>Dados de saúde:</b> tutela da saúde, em procedimento realizado por profissionais de
          saúde (art. 11, II, &quot;f&quot; da LGPD), e cumprimento de obrigação legal e regulatória
          (art. 11, II, &quot;a&quot;).
        </li>
        <li><b>Dados de crianças e adolescentes:</b> as mesmas, no melhor interesse deles (art. 14).</li>
        <li><b>Dados cadastrais de pacientes:</b> execução do serviço e obrigação legal (art. 7º, II e V).</li>
        <li><b>Dados de conta, cobrança, avisos e uso da conta:</b> execução do contrato e legítimo interesse (art. 7º, V e IX).</li>
        <li><b>Auditoria e segurança:</b> legítimo interesse e obrigação legal (art. 7º, IX e II).</li>
        <li><b>Registros de acesso à aplicação:</b> obrigação legal (Marco Civil da Internet, Lei nº 12.965/2014, art. 15).</li>
        <li>
          <b>Cookie de medição de anúncios</b>, nas páginas públicas do site: consentimento
          (art. 7º, I), que pode ser retirado a qualquer momento (seção {n("cookies")}).
        </li>
      </ul>

      <h2 id="compartilhamento">{n("compartilhamento")}. Com quem os dados são compartilhados</h2>
      <p>
        <b>Dentro da organização:</b> os profissionais da sua organização veem os dados conforme o
        perfil de acesso que o responsável por ela definiu. Uma organização nunca vê os dados de
        outra.
      </p>
      <p>
        <b>Fornecedores:</b> somente os necessários para o serviço funcionar, cada um com acesso
        restrito à sua função e obrigado por contrato a proteger os dados:
      </p>
      <ul>
        <li><b>Supabase</b> — banco de dados, login e armazenamento de arquivos.</li>
        <li><b>Vercel</b> — hospedagem do site e do sistema.</li>
        <li><b>Stripe</b> — processamento de pagamentos. Não recebe dados de pacientes.</li>
        <li>
          <b>Serviço de envio de e-mail</b> (Resend ou SendGrid) — convites, avisos de plantão e
          cobrança. Não recebe dados de saúde.
        </li>
        <li>
          <b>Cloudflare</b> — verificação anti-robô (Turnstile) no login, no cadastro e na recuperação
          de senha. Recebe dados técnicos do navegador, só para essa verificação.
        </li>
        <li>
          <b>Apple, Google e Mozilla</b> — entregam as notificações no celular e no navegador de quem
          as liga. O conteúdo vai cifrado de ponta a ponta: o serviço de entrega não consegue lê-lo.
        </li>
        <li>
          <b>jsDelivr</b> — rede pública de onde o navegador baixa o programa gratuito que lê fotos de
          laudos (Tesseract). Só o programa é baixado; a foto é lida no próprio aparelho e não é
          enviada (seção {n("aparelho")}).
        </li>
        <li>
          <b>Google</b> — medição dos anúncios do AVANEST (Google Ads), só nas páginas públicas do
          site e só para quem aceita o cookie. Não recebe dados de pacientes nem nada do que é
          registrado dentro do sistema.
        </li>
      </ul>
      <p>
        A fonte de letra e os demais arquivos do site são servidos pelo próprio AVANEST, e não por
        terceiros.
      </p>
      <p>
        Também compartilhamos quando houver ordem judicial ou requisição de autoridade competente,
        no limite do que for exigido.
      </p>
      <p>
        <b>Transferência internacional:</b> a infraestrutura desses fornecedores pode estar fora do
        Brasil. Nesses casos a transferência se dá com as salvaguardas contratuais dos respectivos
        fornecedores, nos termos do art. 33 da LGPD.
      </p>

      <h2 id="aparelho">{n("aparelho")}. O que fica no seu aparelho</h2>
      <ul>
        <li>
          <b>Lançamentos da ficha anestésica ainda não salvos.</b> No centro cirúrgico a rede cai: o
          lançamento fica guardado no navegador até o servidor confirmar que recebeu, e então é
          apagado dali. Por isso, antes de limpar os dados do navegador ou trocar de aparelho, confira
          que a ficha mostra tudo como salvo.
        </li>
        <li>
          <b>PDF da ficha no iPhone e no iPad.</b> O PDF é montado no próprio aparelho e vai só para
          onde você mandar — impressora, Arquivos, WhatsApp. Uma vez compartilhado, o arquivo fica sob
          a responsabilidade de quem o enviou e de quem o recebeu: prefira canais da instituição e
          evite grupos pessoais.
        </li>
        <li>
          <b>Fotos de laudos.</b> A leitura do texto da foto acontece no navegador; a imagem não é
          enviada a nenhum serviço de terceiros.
        </li>
        <li>
          <b>Mensagens da sala da equipe.</b> Para quem ligou as notificações, o começo da mensagem
          aparece na tela bloqueada do celular dos colegas. Evite escrever dados de pacientes no
          chat.
        </li>
        <li>
          <b>Preferências</b>, como tema e painéis recolhidos, que não saem do navegador. A lista
          completa está na <a href="/cookies">Política de Cookies</a>.
        </li>
      </ul>

      <h2 id="prazos">{n("prazos")}. Por quanto tempo</h2>
      <ul>
        <li>
          <b>Registros clínicos:</b> no mínimo <b>20 anos</b> a contar do último registro, conforme
          a Resolução CFM nº 1.821/2007. Esse prazo é obrigatório e prevalece sobre pedido de
          exclusão, inclusive após o fim da assinatura.
        </li>
        <li><b>Registros financeiros e fiscais:</b> pelo prazo da legislação tributária.</li>
        <li><b>Registros de acesso à aplicação</b> (IP, data e hora): no mínimo 6 meses, como exige o Marco Civil da Internet (art. 15).</li>
        <li><b>Demais registros de auditoria:</b> enquanto úteis à segurança e à prestação de contas.</li>
        <li><b>Conta de usuário:</b> enquanto houver vínculo com a organização.</li>
        <li><b>Cookies e dados no navegador:</b> os prazos de cada um estão na <a href="/cookies">Política de Cookies</a>.</li>
      </ul>
      <p>
        A organização pode pedir a exportação dos seus dados a qualquer momento, em formato legível
        por máquina, como dizem os <a href="/termos">Termos de Uso</a>.
      </p>

      <h2 id="seguranca">{n("seguranca")}. Como os dados são protegidos</h2>
      <ul>
        <li>Tráfego cifrado (HTTPS) e dados cifrados em repouso pela infraestrutura.</li>
        <li>
          <b>Isolamento por organização aplicado no banco de dados</b>, e não apenas na tela: cada
          consulta é filtrada pela organização de quem a fez.
        </li>
        <li>Perfis de acesso: a recepção não vê conteúdo clínico; o financeiro não vê avaliação.</li>
        <li>Verificação em duas etapas obrigatória para proprietários e administradores.</li>
        <li>Senhas guardadas com hash — ninguém no AVANEST consegue ler a sua.</li>
        <li>Verificação anti-robô no login, no cadastro e na recuperação de senha.</li>
        <li>Registro de auditoria das ações relevantes.</li>
        <li>Backups automáticos da base.</li>
      </ul>

      <h2 id="automatizadas">{n("automatizadas")}. Decisões automatizadas e inteligência artificial</h2>
      <p>
        Calculadoras, escores, sugestões de dose e alertas (de alergia, por exemplo) são apoio ao
        profissional. <b>A decisão clínica é sempre de quem atende</b>; o sistema não decide nada
        sobre o paciente sozinho.
      </p>
      <p>
        A única decisão automática sobre pessoas é administrativa: uma conta em período de teste da
        campanha que fica 14 dias sem entrar é pausada. Nada é apagado, e basta escrever para{" "}
        <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a> para reativar ou pedir a
        revisão por uma pessoa (LGPD, art. 20).
      </p>

      <h2 id="direitos">{n("direitos")}. Seus direitos e como exercê-los</h2>
      <p>O art. 18 da LGPD garante a você:</p>
      <ul>
        <li>Confirmar se há tratamento e acessar seus dados.</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
        <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos.</li>
        <li>Solicitar portabilidade.</li>
        <li>Saber com quem os dados foram compartilhados.</li>
        <li>Ser informado sobre a possibilidade de não dar consentimento, e o que acontece se não der.</li>
        <li>Retirar o consentimento, quando essa for a base legal aplicável.</li>
        <li>Opor-se a tratamento feito em desacordo com a lei.</li>
      </ul>
      <p>
        <b>Pacientes:</b> procure a clínica ou o médico que realizou o atendimento — é a
        controladora dos seus dados. <b>Usuários do sistema:</b> escreva para{" "}
        <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a>.
      </p>
      <p>
        Para proteger você, podemos pedir uma confirmação de identidade antes de entregar ou alterar
        dados. A confirmação e o acesso em formato simplificado são respondidos de imediato; a
        declaração completa, em até <b>15 dias</b> (art. 19). Se a resposta não resolver, você pode
        reclamar à Autoridade Nacional de Proteção de Dados (ANPD), em{" "}
        <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer">gov.br/anpd</a>.
      </p>
      <p>
        Lembrando: registros clínicos têm guarda obrigatória por lei, e por isso um pedido de
        exclusão não os alcança antes do prazo legal.
      </p>

      <h2 id="incidentes">{n("incidentes")}. Incidentes</h2>
      <p>
        Havendo incidente de segurança com risco relevante aos titulares, comunicaremos as
        organizações afetadas e a Autoridade Nacional de Proteção de Dados nos prazos da lei,
        informando o que aconteceu, quais dados foram atingidos e as medidas tomadas.
      </p>

      <h2 id="cookies">{n("cookies")}. Cookies</h2>
      <p>
        Dentro do sistema, o AVANEST usa apenas cookies necessários — para manter você conectado e
        lembrar o local de atendimento — e guarda no navegador as suas preferências de tela. Ali não
        há cookie de publicidade nem rastreamento de terceiros.
      </p>
      <p>
        Nas páginas públicas do site (a página inicial, os planos, os guias e o cadastro), e somente
        se você aceitar no aviso de cookies, usamos o cookie do Google Ads para saber quais anúncios
        trouxeram visitas e cadastros — sem remarketing nem anúncio personalizado. Se você recusar,
        ou não responder, ele não é carregado.
      </p>
      <p>
        Cada cookie, para que serve e por quanto tempo fica está na{" "}
        <a href="/cookies">Política de Cookies</a>, onde você também{" "}
        <a href="/cookies#preferencias">muda a sua escolha</a> a qualquer momento.
      </p>

      <h2 id="contato">{n("contato")}. Encarregado (DPO) e contato</h2>
      <p>
        Encargo exercido por G. Segobia Serviços Médicos Ltda., CNPJ 55.965.276/0001-04. Contato para
        assuntos de proteção de dados:{" "}
        <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a>.
      </p>

      <h2 id="alteracoes">{n("alteracoes")}. Alterações</h2>
      <p>
        Esta política pode ser atualizada. Mudanças relevantes serão comunicadas por e-mail ou dentro
        do sistema, com a data de vigência indicada no topo desta página. A versão anterior é
        enviada a quem pedir.
      </p>
    </PaginaLegal>
  );
}
