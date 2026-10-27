import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
import { PaginaLegal } from "@/components/pagina-legal";
import { PreferenciasDeCookies } from "@/components/medicao-de-anuncios";

export const metadata: Metadata = paginaPublica({
  titulo: "Política de Cookies | AVANEST",
  descricao: "Os cookies e dados que o AVANEST guarda no navegador, para quê e por quanto tempo. Anúncio só com seu consentimento, nunca no sistema. Mude sua escolha aqui.",
  caminho: "/cookies",
});

// A POLÍTICA DE COOKIES É UM INVENTÁRIO, e tem de bater com o código.
//
// Cada linha das tabelas abaixo corresponde a um cookie ou a uma chave de
// armazenamento que o sistema grava de verdade (lib/local-ativo.ts,
// lib/evolucao/fila.ts, lib/tema.ts, lib/anuncios.ts, public/sw.js…). Quem
// criar um cookie novo, ou uma chave nova no localStorage, acrescenta a linha
// aqui no mesmo commit — lib/cookies.test.ts confere as principais.
//
// O QUE APARECE E O QUE NÃO APARECE (27/10/2026). A página mostra o que é,
// para quê e por quanto tempo — o que a LGPD e o guia da ANPD pedem. Dos
// cookies de verdade ela mostra o nome, porque é por ele que a pessoa os acha
// e apaga no navegador. As chaves internas do armazenamento local ficam em
// `chaves`, que NÃO é desenhado na tela: servem ao teste, e na página só
// diziam como o sistema funciona por dentro, sem ajudar quem lê.

type Linha = {
  oque: string;
  cookie?: string;
  /** Nomes no código, para o teste conferir. Nunca aparecem na página. */
  chaves?: string[];
  onde: string;
  para: string;
  duracao: string;
};

const NECESSARIOS: Linha[] = [
  {
    oque: "Sessão de login",
    cookie: "sb-…-auth-token",
    onde: "Cookie do AVANEST (gerado pelo Supabase, nosso provedor de login)",
    para: "Manter você conectado com segurança.",
    duracao: "Até você sair da conta; renovado enquanto você usa",
  },
  {
    oque: "Local de atendimento",
    cookie: "avanest_local",
    onde: "Cookie do AVANEST",
    para: "Lembrar o hospital escolhido em “Onde você vai atender hoje?”, para a ficha sair com o nome dele e mostrar só as fichas daquele local.",
    duracao: "30 dias",
  },
  {
    oque: "Lançamentos da ficha ainda não enviados",
    chaves: ["avanest:evolucao-fila:"],
    onde: "Armazenamento local do navegador",
    para: "Guardar os lançamentos da ficha anestésica até o servidor confirmar que recebeu — no centro cirúrgico a rede cai, e nada pode se perder. Contém dados da ficha.",
    duracao: "Apagado assim que o servidor confirma",
  },
  {
    oque: "Sua escolha sobre anúncios",
    chaves: ["avanest:cookies-de-anuncio"],
    onde: "Armazenamento local do navegador",
    para: "Lembrar a sua escolha sobre a medição de anúncios, para não perguntar de novo.",
    duracao: "Até você mudar a escolha ou limpar o navegador",
  },
  {
    oque: "Arquivos do aplicativo",
    chaves: ["avanest-arquivos-v1"],
    onde: "Cache do aplicativo no aparelho",
    para: "Guardar os arquivos do próprio site — código e ícones — para o aplicativo abrir rápido. Nunca guarda páginas, fichas nem dados de pacientes.",
    duracao: "Até a próxima versão do site",
  },
];

const PREFERENCIAS: Linha[] = [
  { oque: "Tema claro ou escuro", chaves: ["avanest:tema"], onde: "Armazenamento local", para: "Abrir o sistema com o tema que você escolheu.", duracao: "Até você mudar" },
  { oque: "Tutorial de boas-vindas", chaves: ["avanest_tutorial_v3"], onde: "Armazenamento local", para: "Não mostrar de novo o tutorial que você já viu.", duracao: "Até limpar o navegador" },
  { oque: "Valores do financeiro", chaves: ["avanest_esconder_valores"], onde: "Armazenamento local", para: "Esconder ou mostrar os valores na tela.", duracao: "Até você mudar" },
  { oque: "Arrumação da tela", chaves: ["avanest:painel:", "avanest:evo-pre", "avanest:escala-impressa"], onde: "Armazenamento local", para: "Painéis abertos ou recolhidos e o modelo de impressão da escala.", duracao: "Até você mudar" },
  { oque: "Medicamentos favoritos", chaves: ["avanest:evo-favoritos:", "avanest.doses.favoritos"], onde: "Armazenamento local", para: "Os favoritos da ficha e da calculadora de doses.", duracao: "Até você mudar" },
  { oque: "Aplicativo e notificações", chaves: ["avanest-instalar-convite", "avanest-push-convite"], onde: "Armazenamento local", para: "Quando voltar a sugerir instalar o aplicativo ou ligar as notificações.", duracao: "7 e 14 dias" },
  { oque: "TV do centro cirúrgico", chaves: ["avanest:tv-tema", "avanest:tv-recarregou-para", "avanest:tv-voltar-tela-cheia"], onde: "Armazenamento local e da sessão", para: "Fundo claro ou escuro, e voltar à tela cheia depois que a TV se atualiza sozinha.", duracao: "O fundo, até você mudar; o resto, até fechar a aba" },
  { oque: "Abertura da marca", chaves: ["avanest:abertura"], onde: "Armazenamento da sessão", para: "Não repetir a animação de abertura na mesma visita.", duracao: "Até fechar a aba" },
];

const ANUNCIOS: Linha[] = [
  {
    oque: "Medição do Google Ads",
    cookie: "_gcl_au",
    onde: "Cookie do Google no domínio do AVANEST",
    para: "Ligar uma visita ou um cadastro ao anúncio do Google que a trouxe.",
    duracao: "90 dias",
  },
  {
    oque: "Cookies do Google nos domínios dele",
    onde: "Google (por exemplo google.com e doubleclick.net)",
    para: "A mesma medição, do lado do Google, conforme a política de privacidade dele.",
    duracao: "Definida pelo Google",
  },
];

function Tabela({ titulo, linhas }: { titulo: string; linhas: Linha[] }) {
  return (
    <div className="legalTabelaCaixa">
      <table className="legalTabela">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr><th scope="col">O quê</th><th scope="col">Onde fica</th><th scope="col">Para quê</th><th scope="col">Por quanto tempo</th></tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.oque}>
              <th scope="row">{l.oque}{l.cookie && <> <code translate="no">{l.cookie}</code></>}</th>
              <td data-rotulo="Onde fica">{l.onde}</td>
              <td data-rotulo="Para quê">{l.para}</td>
              <td data-rotulo="Por quanto tempo">{l.duracao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <PaginaLegal
      titulo="Política de Cookies"
      resumo="Quais cookies e dados guardados no navegador o AVANEST usa, para quê, por quanto tempo — e como mudar a sua escolha."
      vigencia="27 de outubro de 2026"
    >
      <div className="legalEmResumo">
        <p><b>Em resumo</b></p>
        <ul>
          <li>Dentro do sistema há só o necessário para funcionar e as suas preferências de tela. Nenhum cookie de publicidade, nenhum rastreador de terceiros.</li>
          <li>Nas páginas públicas, o cookie do Google Ads só entra se você clicar em “Aceitar”. Recusar não muda nada no uso do site.</li>
          <li>Você muda a escolha quando quiser, logo abaixo.</li>
        </ul>
      </div>

      <h2>1. O que são cookies</h2>
      <p>
        Cookies são pequenos arquivos de texto que um site guarda no seu navegador. Além deles, o
        AVANEST usa o armazenamento local do navegador (<span translate="no">localStorage</span> e{" "}
        <span translate="no">sessionStorage</span>), que funciona de modo parecido e fica só no seu
        aparelho. Esta política trata dos dois, como pede o guia da Autoridade Nacional de Proteção
        de Dados (ANPD) sobre cookies.
      </p>

      <h2 id="preferencias">2. Suas preferências</h2>
      <p>A escolha vale para este navegador, neste aparelho, e muda na hora.</p>
      <PreferenciasDeCookies />

      <h2>3. Necessários — sempre ativos</h2>
      <p>
        Sem eles o sistema não funciona, por isso não dependem de consentimento: servem para executar
        o contrato com quem usa o AVANEST e para a segurança do serviço (LGPD, art. 7º, V e IX).
      </p>
      <Tabela titulo="Cookies e dados necessários" linhas={NECESSARIOS} />
      <p>
        No login, no cadastro e na recuperação de senha, a verificação anti-robô{" "}
        <b translate="no">Cloudflare Turnstile</b> confere que quem envia o formulário é uma pessoa. Ela
        não grava cookie de rastreamento no nosso domínio; a Cloudflare recebe dados técnicos do
        navegador (como o endereço IP) só para essa verificação.
      </p>

      <h2>4. Preferências — só no seu aparelho</h2>
      <p>
        Lembram como você gosta de usar o sistema. Não saem do navegador, não vão para nenhum
        servidor e não identificam você para ninguém.
      </p>
      <Tabela titulo="Preferências guardadas no aparelho" linhas={PREFERENCIAS} />

      <h2 id="anuncios">5. Medição de anúncios — só com o seu consentimento</h2>
      <p>
        O AVANEST anuncia no Google. Para saber quais anúncios trazem visitas e cadastros, usa o
        cookie do Google Ads — <b>só nas páginas públicas do site</b> (página inicial, planos, guias,
        escores, cadastro e estas páginas legais) e <b>só depois do seu “Aceitar”</b>. Sem resposta,
        ou com “Recusar”, o código do Google nem é baixado.
      </p>
      <Tabela titulo="Cookies de medição de anúncios" linhas={ANUNCIOS} />
      <ul>
        <li>
          <b>Nunca dentro do sistema.</b> Lá ficam os dados de pacientes, e o código do Google não é
          carregado — nem para quem aceitou.
        </li>
        <li>
          <b>Só para medir.</b> O código é configurado sem remarketing, sem anúncio personalizado e sem
          Google Analytics.
        </li>
        <li><b>Nenhum dado de paciente</b>, nem nada do que é registrado no sistema, é enviado ao Google.</li>
        <li>Base legal: o seu consentimento (LGPD, art. 7º, I), que pode ser retirado a qualquer momento.</li>
      </ul>

      <h2>6. Como mudar ou apagar</h2>
      <ul>
        <li>
          <b>Aqui nesta página</b>, na seção 2. Ao retirar o consentimento, o AVANEST apaga os cookies
          do Google que estavam no domínio dele. Os que o Google guarda nos domínios dele só o Google, ou
          o seu navegador, podem apagar.
        </li>
        <li>
          <b>No navegador.</b> Todo navegador permite ver e apagar cookies e dados de sites nas
          configurações de privacidade.
        </li>
      </ul>
      <p className="legalDestaque">
        <b>Antes de limpar os dados do navegador</b>, confira na ficha anestésica que todos os
        lançamentos aparecem como salvos. Lançamento ainda pendente fica só no aparelho, e limpar os
        dados apaga o que não chegou ao servidor. Apagar os cookies necessários também desconecta você.
      </p>

      <h2>7. Contato</h2>
      <p>
        Dúvidas sobre cookies ou sobre os seus dados:{" "}
        <a href="mailto:contato@avanest.com.br">contato@avanest.com.br</a>. O tratamento de dados
        pessoais como um todo está na <a href="/privacidade">Política de Privacidade</a>.
      </p>
    </PaginaLegal>
  );
}
