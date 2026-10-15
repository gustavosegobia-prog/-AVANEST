import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";

// O TÍTULO DA CAPA É A BUSCA, e não a marca. Ninguém pesquisa "AVANEST" antes
// de conhecer o AVANEST; quem procura um sistema digita "software para
// anestesista". A marca continua no fim do título e é o que basta para a busca
// pelo nome — que o Google resolve com qualquer título, porque o domínio já é
// a marca.
//
// O canonical continua aqui: sem ele a capa responde em quatro endereços — com
// e sem www, com e sem barra final, e com qualquer `?utm_...` de campanha.
export const metadata: Metadata = paginaPublica({
  titulo: "Software para anestesista e grupos de anestesia | AVANEST",
  descricao:
    "Software para anestesiologistas: recepção, avaliação pré-anestésica, ficha anestésica, "
    + "manejo de crises, escala e financeiro do grupo. 2 meses grátis.",
  caminho: "/",
});

import Image from "next/image";
import { AppLogo } from "@/components/app-logo";
import { AbrirNoLogin } from "@/components/abrir-no-login";
import { CAMINHO_DA_CAMPANHA } from "@/lib/link-da-campanha";
import { ID_DA_ORGANIZACAO } from "@/lib/schema";
import { RodapePublico } from "@/components/rodape-publico";

// O que o site é, em linguagem de máquina.
//
// O buscador lê o texto da página e adivinha o resto. Isto tira a adivinhação
// de cima dele: que se trata de um programa, que a categoria é saúde, para que
// serve, de quem é a empresa e onde ela fica.
//
// Não muda posição sozinho — nenhuma marcação muda. O que ela muda é o que o
// Google mostra QUANDO já resolveu mostrar, e o quanto ele acerta ao decidir
// para qual busca esta página serve. "Sistema de avaliação pré-anestésica"
// escrito num campo chamado `applicationSubCategory` é uma afirmação; a mesma
// frase solta no meio de um parágrafo é um palpite.
//
// `offers` sem preço de propósito: o valor vem do banco e muda com a campanha,
// e preço escrito à mão aqui viraria mentira no primeiro reajuste — com o
// agravante de o Google mostrar o número velho no resultado da busca.
const DADOS_ESTRUTURADOS = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AVANEST",
  applicationCategory: "HealthApplication",
  applicationSubCategory: "Sistema de avaliação pré-anestésica e gestão de serviços de anestesiologia",
  operatingSystem: "Web",
  url: "https://www.avanest.com.br",
  inLanguage: "pt-BR",
  description:
    "Software para anestesiologistas e grupos de anestesia: recepção com agenda do dia, "
    + "avaliação pré-anestésica em nove etapas com escores de risco, ficha anestésica do "
    + "intraoperatório no tablet, protocolos de crise com doses pelo peso, escala por hospital "
    + "e o financeiro do grupo e de cada médico.",
  featureList: [
    "Recepção: agenda do dia, chegada e etapas do atendimento",
    "Avaliação pré-anestésica digital com ficha, termo e orientações para impressão",
    "Escores de risco: ASA, STOP-BANG, Apfel e índice de Lee (RCRI)",
    "Ficha anestésica do intraoperatório no tablet, impressa em A4",
    "Protocolos de crise em anestesia com doses calculadas pelo peso",
    "Escala de plantões por instituição e escala pessoal, com troca entre colegas",
    "Financeiro do grupo e do médico: produção, faturamento, glosas e repasses",
  ],
  offers: {
    "@type": "Offer",
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    url: "https://www.avanest.com.br/planos",
  },
  // SÓ A REFERÊNCIA À EMPRESA, e não uma cópia dela. A organização completa —
  // nome, logo, CNPJ, contato, Instagram — é declarada uma vez no layout, em
  // `lib/schema.ts`. Aqui ficava um segundo objeto com parte dos mesmos dados,
  // e dois objetos homônimos são duas empresas para o buscador: no dia em que
  // um mudasse, ele ficaria com duas versões da mesma marca e escolheria uma.
  provider: { "@id": ID_DA_ORGANIZACAO },
};

type Modulo = {
  nome: string; texto: string; itens: string[]; link?: [string, string];
  tela: [string, number, number]; alt: string; tablet?: boolean;
  segunda?: [string, number, number, string];
};

/**
 * Os seis módulos, na ordem do dia do serviço: o paciente chega, é avaliado,
 * opera, e a crise pode acontecer na sala; a escala e o dinheiro fecham o mês.
 * Cada frase diz o que o colega faz com o módulo — e cada item é uma coisa que
 * a tela ao lado mostra ou que o sistema de fato faz.
 */
const MODULOS: Modulo[] = [
  {
    nome: "Recepção",
    texto: "A agenda do dia por médico e por hospital. A recepção marca, registra a chegada e acompanha cada paciente até a consulta terminar, sem abrir o conteúdo clínico.",
    itens: ["Agendado, aguardando, em atendimento e concluído na mesma lista", "Busca por nome, CPF ou telefone",
      "Falta, desmarcação e reagendamento ficam no histórico"],
    tela: ["/capa/recepcao.webp", 1600, 956],
    alt: "Recepção do AVANEST: a agenda do dia com pacientes concluídos, em atendimento e aguardando (dados fictícios)",
  },
  {
    nome: "Consulta pré-anestésica",
    texto: "Nove etapas no celular ou no computador. Lee, STOP-Bang e Apfel saem calculados do que já foi respondido, e a ASA é você quem escolhe.",
    itens: ["Ficha, termo de consentimento e orientações impressos no timbre do hospital",
      "O medicamento a suspender sai com o prazo escrito", "Os dados da consulta seguem para a ficha anestésica"],
    link: ["/avaliacao-pre-anestesica", "Guia da avaliação pré-anestésica"],
    tela: ["/capa/avaliacao-computador.webp", 1600, 1025],
    alt: "Avaliação pré-anestésica no AVANEST: as nove etapas e a identificação da paciente (dados fictícios)",
  },
  {
    nome: "Ficha anestésica",
    texto: "A folha de anestesia no tablet, dentro da sala. Você toca no gráfico para lançar PA e FC e registra medicação, infusão, gases e eventos com um toque.",
    itens: ["Doses sugeridas pelo peso e pela idade, que você confere antes de registrar",
      "Salva a cada lançamento e guarda autor e horário de cada registro", "Imprime em A4 no formato da folha de papel"],
    link: ["/ficha-anestesica", "O que a ficha anestésica deve conter"],
    tela: ["/capa/ficha-anestesica.webp", 1500, 1042], tablet: true,
    alt: "Ficha anestésica no tablet: gases, infusões, líquidos, sinais vitais e a lista de medicação (dados fictícios)",
  },
  {
    nome: "Manejo de crises",
    texto: "49 protocolos de crise em anestesia, de PCR e anafilaxia a hipertermia maligna e via aérea difícil. Com o peso e a idade do paciente, as doses saem calculadas, com o volume de cada apresentação.",
    itens: ["Agir agora em passos numerados, para ler de longe", "Ritmos de parada como aparecem no monitor",
      "Cada protocolo cita a diretriz de onde saiu e sai em PDF para deixar na sala"],
    tela: ["/capa/manejo-de-crises.webp", 1600, 1000],
    alt: "Hipertermia maligna no AVANEST: dantroleno calculado para 72 kg, com o volume em frascos (dados fictícios)",
  },
  {
    nome: "Escala pessoal e do grupo",
    texto: "Uma escala por hospital para o grupo e a sua, reunindo todos os lugares onde você trabalha. O plantão troca de mãos com aceite, e o nome de quem pediu e de quem aceitou fica registrado.",
    itens: ["Mês, semana ou lista, com os feriados marcados", "Cada médico recebe os próprios plantões por e-mail",
      "Plantões fora do grupo entram na sua escala e só você vê"],
    link: ["/escala-medica", "Escala médica do grupo"],
    tela: ["/capa/escala.webp", 1600, 956],
    alt: "Minha escala no AVANEST: o mês com os plantões em dois hospitais e o total a receber (dados fictícios)",
  },
  {
    nome: "Financeiro pessoal e do grupo",
    texto: "Para o grupo, produção, notas, glosas, recebimentos e repasses, com a composição de cada número. Para você, quanto fez, quanto recebeu e quanto ainda falta receber.",
    itens: ["Faturado, recebido e a receber por convênio e por competência", "Glosas com prazo de recurso e cobranças em atraso apontadas",
      "Meu financeiro: o ano em um gráfico, plantão por plantão"],
    link: ["/recursos", "O controle financeiro por dentro"],
    tela: ["/capa/financeiro-grupo.webp", 1600, 956],
    alt: "Financeiro do grupo no AVANEST: recebido, a receber, faturado e recebimentos por convênio (dados fictícios)",
    segunda: ["/capa/financeiro-pessoal.webp", 1600, 956, "Meu financeiro: o total do mês e o gráfico do ano do médico (dados fictícios)"],
  },
];

export default function HomePage() {
  const whatsappUrl =
    "https://wa.me/5541997870810?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20conversa%20de%2015%20minutos%20sobre%20o%20AVANEST.";

  return (
    <main className="avnLanding avnCapa">
      {/* Aberto pelo atalho da tela de início, vai direto para o login. */}
      <AbrirNoLogin />
      <script
        type="application/ld+json"
        // O conteúdo é a constante logo acima, escrita à mão neste arquivo:
        // nada aqui vem de usuário, de banco ou de URL, então não há entrada
        // externa para escapar.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DADOS_ESTRUTURADOS) }}
      />
      {/* `avnNavCapa`: no computador esta barra acompanha a moldura do hero,
          que é mais larga que a caixa central das outras páginas. Sem a classe,
          o logo nasce à direita do começo do título. */}
      <header className="avnNav avnNavCapa">
        <AppLogo />
        <nav>
          {/* Dois rótulos para o mesmo link, e o CSS escolhe. No celular, "O que
              o sistema faz" quebrava em TRÊS linhas e o botão subia por cima do
              logo. Encurtar para todo mundo custaria a frase que explica o
              destino — que é o trabalho do rótulo numa página de venda. */}
          <a className="avnLogin avnNavExplica" href="/recursos">
            <span className="avnSoLargo">O que o sistema faz</span>
            <span className="avnSoEstreito">Recursos</span>
          </a>
          <a className="avnLogin" href="/login">Login</a>
          {/* Sem "Ver planos" aqui: na capa os planos já têm botão próprio, ao
              lado do "Começar grátis", e dois botões de destaque disputando a
              mesma tela dividiam a atenção. */}
        </nav>
      </header>

      {/* A CAPA MOSTRA O SISTEMA DE VERDADE. A foto anterior era uma imagem
          gerada: monitor com o logo antigo de coração, "AVANEST" gravado num
          carrinho de anestesia — como se o produto fosse um aparelho — e um
          texto ilegível com erro ("Solver rascunho") na tela. Para quem vai
          confiar a avaliação pré-anestésica a um sistema, a primeira imagem
          dele não pode ser inventada. Estas são capturas da avaliação real,
          com uma paciente fictícia (public/capa). */}
      <section className="avnHero avnHeroComTelas">
        <div className="avnHeroContent">
          <p className="avnEyebrow">GESTÃO INTELIGENTE EM ANESTESIOLOGIA</p>
          {/* O BENEFÍCIO PRIMEIRO, a lista de funções depois. O título anterior
              ("Da avaliação pré-anestésica ao fluxo de caixa do serviço")
              dizia o que o sistema cobre; este diz o que ele devolve a quem
              usa. O que ele cobre vem logo abaixo, nos seis módulos. */}
          <h1>Menos burocracia. Mais tempo para o que realmente importa.</h1>
          <p className="avnLead">
            Gestão clínica, escalas e finanças em uma única plataforma,
            desenvolvida por anestesiologista para anestesiologistas.
          </p>
          {/* OS SEIS MÓDULOS, um por linha curta, em duas colunas no computador.
              Cada um tem a sua tela real mais abaixo, em "O sistema por dentro". */}
          <ul className="avnBeneficios avnModulosLista">
            <li>Recepção</li>
            <li>Consulta pré-anestésica</li>
            <li>Ficha anestésica</li>
            <li>Manejo de crises</li>
            <li>Escala pessoal e do grupo</li>
            <li>Financeiro pessoal e do grupo</li>
          </ul>
          {/* O TESTE GRÁTIS É A AÇÃO PRINCIPAL, e o próprio botão diz a oferta —
              sem título nem descrição repetindo "2 meses grátis" acima dele.
              A linha de baixo diz a condição antes do clique: o cartão é
              cadastrado no início, e a primeira cobrança só vem depois. */}
          <div className="avnOferta">
            <div className="avnActions">
              <a className="avnPrimary" href={`${CAMINHO_DA_CAMPANHA}?de=site`}>Começar 2 meses grátis</a>
              <a className="avnSecondary" href="/planos">Conhecer os planos</a>
            </div>
            <p className="avnOfertaApoio">Primeira cobrança só depois dos 2 meses. Cancele antes e não paga nada.</p>
            <p className="avnAjuda">
              Precisa de ajuda? <a href={whatsappUrl} target="_blank" rel="noreferrer">Fale com nossa equipe pelo WhatsApp</a>.
            </p>
          </div>
        </div>
        <div className="avnHeroTelas">
          <figure className="avnTelaComputador">
            <div className="avnTelaBarra" aria-hidden="true"><i /><i /><i /><span>avanest.com.br</span></div>
            <Image
              src="/capa/avaliacao-computador.webp" width={1600} height={1025} priority
              sizes="(min-width: 1101px) 52vw, calc(100vw - 40px)"
              alt="Avaliação pré-anestésica no AVANEST: as nove etapas, a identificação da paciente e o IMC e o peso ideal calculados (dados fictícios)"
            />
          </figure>
          <figure className="avnTelaCelular">
            <Image
              src="/capa/avaliacao-celular.webp" width={780} height={1688}
              sizes="(min-width: 1101px) 200px, 34vw"
              alt="No celular, o Índice de Lee calculado a partir da cirurgia e da creatinina (dados fictícios)"
            />
          </figure>
          <p className="avnTelaLegenda">Telas reais do sistema, com paciente fictícia.</p>
        </div>
      </section>

      {/* DOIS CAMINHOS, logo depois da primeira tela. O AVANEST serve ao
          anestesiologista que trabalha sozinho e ao grupo que tem escala,
          recepção e financeiro — e cada um decide por motivos diferentes. Um
          texto só, para os dois, acabava falando com nenhum. */}
      <section className="avnPerfis" aria-labelledby="avn-perfis-titulo">
        <h2 id="avn-perfis-titulo">Para quem trabalha sozinho e para quem coordena um grupo.</h2>
        <div className="avnPerfisGrade">
          <article>
            <h3>Sou anestesiologista</h3>
            <p className="avnPerfilQuem">Trabalho por conta própria, em um ou em vários hospitais.</p>
            <ul>
              <li>A avaliação pré-anestésica no celular e a ficha anestésica no tablet, dentro da sala.</li>
              <li>Os plantões de todos os hospitais reunidos em uma escala só.</li>
              <li>O que você fez, recebeu e ainda tem a receber, mês a mês.</li>
            </ul>
            <a className="avnPerfilBotao primario" href={`${CAMINHO_DA_CAMPANHA}?de=perfil-individual`}>Começar 2 meses grátis</a>
          </article>
          <article>
            <h3>Gerencio um grupo de anestesia</h3>
            <p className="avnPerfilQuem">Coordeno a escala, a recepção e o financeiro de uma equipe.</p>
            <ul>
              <li>A escala do grupo por hospital, com as trocas entre colegas registradas.</li>
              <li>Recepção, área médica e financeiro com acessos separados por função.</li>
              <li>Os mesmos protocolos de crise, com doses pelo peso, para toda a equipe.</li>
              <li>O fechamento do mês e os repasses, com a composição de cada número.</li>
            </ul>
            <a className="avnPerfilBotao" href="/planos">Ver planos para grupos</a>
            <a className="avnPerfilAlt" href={whatsappUrl} target="_blank" rel="noreferrer">Prefere conversar antes? Fale com a gente</a>
          </article>
        </div>
      </section>

      {/* O SISTEMA POR DENTRO. Cada módulo com a tela de verdade, capturada do
          sistema com dados fictícios (public/capa). Quem vai confiar o
          consultório, a sala e o caixa a um sistema quer ver a tela antes de
          criar a conta, e não um desenho dela. */}
      <section className="avnModulos" id="como-funciona" aria-labelledby="avn-modulos-titulo">
        <h2 id="avn-modulos-titulo">Da recepção ao fechamento do mês, no mesmo sistema.</h2>
        <p className="avnModulosLead">
          Seis módulos com os mesmos pacientes, a mesma equipe e os mesmos hospitais. O que entra
          na consulta segue para a sala, e o que acontece na sala chega ao financeiro.
        </p>
        {MODULOS.map((m) => (
          <article key={m.nome} className="avnModulo">
            <div className="avnModuloTexto">
              <h3>{m.nome}</h3>
              <p>{m.texto}</p>
              <ul>{m.itens.map((x) => <li key={x}>{x}</li>)}</ul>
              {m.link && <a className="avnCartaoLink" href={m.link[0]}>{m.link[1]} →</a>}
            </div>
            <figure className={`avnModuloTela ${m.tablet ? "avnModuloTablet" : ""}`}>
              {!m.tablet && <div className="avnTelaBarra" aria-hidden="true"><i /><i /><i /><span>avanest.com.br</span></div>}
              <Image src={m.tela[0]} width={m.tela[1]} height={m.tela[2]} alt={m.alt} loading="lazy"
                sizes="(min-width: 1101px) 640px, calc(100vw - 40px)" />
              {m.segunda && (
                <span className="avnModuloSegunda">
                  <Image src={m.segunda[0]} width={m.segunda[1]} height={m.segunda[2]} alt={m.segunda[3]} loading="lazy"
                    sizes="(min-width: 1101px) 300px, 45vw" />
                </span>
              )}
            </figure>
          </article>
        ))}
        <p className="avnModulosNota">Telas reais do sistema, com pacientes e médicos fictícios.</p>
        <div className="avnActions">
          <a className="avnPrimary" href={`${CAMINHO_DA_CAMPANHA}?de=modulos`}>Começar 2 meses grátis</a>
          <a className="avnSecondary avnVerTudo" href="/recursos">Ver todos os recursos</a>
        </div>
      </section>
      {/* PERGUNTAS FREQUENTES, em texto na página. Respondem às dúvidas de
          quem chega pela busca ("o AVANEST faz a ficha anestésica?") e levam
          cada uma à página que trata do assunto por inteiro. Sem marcação
          FAQPage: o Google encerrou o suporte a ela em junho de 2026. */}
      <section className="recBloco avnPerguntasCapa" aria-labelledby="avn-perguntas">
        <h2 id="avn-perguntas">Perguntas frequentes</h2>
        <div className="conteudoPerguntas">
          <article>
            <h3>O que um software para anestesista precisa fazer?</h3>
            <p>Registrar a avaliação pré-anestésica e a ficha de anestesia com o que a Resolução
              CFM 2.174/2017 pede, apoiar a equipe numa crise, organizar a escala e mostrar o que
              foi produzido e recebido. O AVANEST faz isso no mesmo lugar, com a recepção junto.</p>
          </article>
          <article>
            <h3>O AVANEST faz a ficha anestésica?</h3>
            <p>Faz. A ficha de anestesia do intraoperatório é preenchida no tablet durante o caso,
              puxa os dados da avaliação pré-anestésica e sai impressa em A4 no formato da folha de
              papel. O que cada ficha deve conter está na página da{" "}
              <a href="/ficha-anestesica">ficha anestésica</a>.</p>
          </article>
          <article>
            <h3>Tem protocolo para crise em anestesia?</h3>
            <p>Tem. São 49 protocolos, de PCR e anafilaxia a hipertermia maligna e via aérea
              difícil. Com o peso e a idade do paciente, as doses saem calculadas, com o volume de
              cada apresentação. Cada protocolo cita a diretriz de onde saiu.</p>
          </article>
          <article>
            <h3>Serve para a escala médica do grupo?</h3>
            <p>Sim. Uma escala por hospital, troca de plantão com aceite, aviso no celular e o
              fechamento do mês. Veja como funciona a <a href="/escala-medica">escala médica</a>.</p>
          </article>
          <article>
            <h3>Funciona no celular?</h3>
            <p>Sim. Abre no navegador e pode ser <a href="/app">instalado na tela de início</a> do
              iPhone e do Android.</p>
          </article>
          <article>
            <h3>Quanto custa?</h3>
            <p>Os dois primeiros meses são grátis: você cadastra o cartão no início e a primeira
              cobrança só vence depois deles. Os valores estão em <a href="/planos">planos e preços</a>.</p>
          </article>
          <article>
            <h3>Os dados dos pacientes ficam seguros?</h3>
            <p>Cada serviço só enxerga os próprios dados, a trava fica no banco de dados e cada
              alteração guarda autor, data e hora. A recepção não abre o conteúdo clínico.</p>
          </article>
        </div>
      </section>
      {/* O FECHAMENTO: quem leu até aqui decidiu ou quase. A oferta de novo,
          com a condição dita do mesmo jeito que no topo. */}
      <section className="avnFechamento" aria-labelledby="avn-fechamento">
        <h2 id="avn-fechamento">Use no seu próximo plantão.</h2>
        <p>2 meses grátis com o sistema completo. A primeira cobrança só vence depois deles, e
          cancelando antes você não paga nada.</p>
        <div className="avnActions">
          <a className="avnPrimary" href={`${CAMINHO_DA_CAMPANHA}?de=fim-da-capa`}>Começar 2 meses grátis</a>
          <a className="avnSecondary" href={whatsappUrl} target="_blank" rel="noreferrer">Conversar no WhatsApp</a>
        </div>
      </section>
      <RodapePublico />
      <a
        className="avnInstagram"
        href="https://www.instagram.com/useavanest/"
        target="_blank"
        rel="noreferrer"
        aria-label="@useavanest no Instagram"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span>@useavanest</span>
      </a>
    </main>
  );
}
