import type { NextConfig } from "next";

// Cabeçalhos de segurança.
//
// Não havia nenhum. Cada linha abaixo fecha uma porta concreta, e a que mais
// importa aqui não é a mais famosa:
//
// Referrer-Policy — o endereço de uma ficha carrega o id da avaliação
//   (/avaliacoes/38bfa990-.../documentos). Sem esta linha, qualquer clique em
//   link externo, ou qualquer recurso de outro domínio na página, leva esse
//   endereço inteiro no cabeçalho Referer. É dado de paciente saindo do
//   sistema sem ninguém autorizar. "same-origin" manda o endereço completo só
//   para nós mesmos, e nada para fora.
//
// frame-ancestors / X-Frame-Options — sem eles a tela pode ser embutida num
//   iframe invisível sobre a página do atacante. O médico pensa que está
//   clicando em outra coisa e clica em "Excluir avaliação". Duas linhas
//   porque navegador antigo entende só X-Frame-Options e o padrão novo é a
//   diretiva do CSP.
//
// HSTS — obriga https nas visitas seguintes. Sem ele, a primeira requisição
//   em http de uma rede hostil pode ser interceptada antes do redirecionamento.
//
// nosniff — impede o navegador de adivinhar o tipo de um arquivo e executar
//   como script algo que devia ser texto.
//
// Permissions-Policy — o AVANEST não usa câmera, microfone nem localização.
//   Declarar isso desliga o acesso para a página e para qualquer coisa
//   embutida nela.
//
// O CSP aqui é de propósito curto: frame-ancestors, base-uri, form-action e
// object-src. Não entra script-src porque o Next injeta script embutido, e um
// script-src escrito sem poder testar em produção quebraria o site inteiro —
// que é um estrago maior do que o buraco que fecharia. Fica anotado como
// próximo passo, com nonce, e medido antes de subir.

// A REGIÃO das funções fica em vercel.json: gru1, São Paulo — a mesma do
// banco (Supabase sa-east-1) e de quem usa. No padrão da Vercel (Washington)
// cada consulta ao banco cruzava o continente, e uma troca de página faz
// várias delas em sequência.

const CABECALHOS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // COOP — uma página de outro site, aberta a partir do AVANEST (ou que abriu
  //   o AVANEST), não ganha referência à nossa janela: sem `window.opener`
  //   para redirecionar a aba do sistema para um login falso. A variante
  //   "allow-popups" mantém o que o próprio app abre (WhatsApp, e-mail).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

// A FOLHA DE IMPRESSÃO DA FICHA é a exceção, e só para o próprio site: o
// "Imprimir" da ficha a carrega escondida num iframe e abre a janela de
// imprimir ali mesmo (components/evolucao/imprimir-ficha.tsx), sem aba nova.
// Ela é só leitura — não tem botão que exclua ou altere nada —, e o
// `'self'` continua impedindo qualquer outro site de embuti-la. No Next, a
// regra que vem depois vence a de cima para o mesmo cabeçalho.
const IMPRESSAO_EMBUTIVEL = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

// A VERSÃO DO SITE (lib/versao.ts): o commit que a Vercel está publicando,
// escrito no código do navegador e no do servidor no mesmo build. Fora da
// Vercel fica "local" dos dois lados — e versões iguais nunca recarregam nada.
const VERSAO_DO_SITE = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "local";

const nextConfig: NextConfig = {
  env: { VERSAO_DO_SITE },
  async headers() {
    return [
      { source: "/:path*", headers: CABECALHOS },
      { source: "/evolucao/:id/imprimir", headers: IMPRESSAO_EMBUTIVEL },
      // A fonte do site: o nome do arquivo leva a versão, então pode ficar
      // um ano no aparelho sem perguntar de novo.
      { source: "/fontes/:arquivo", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
