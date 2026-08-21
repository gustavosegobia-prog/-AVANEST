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

const CABECALHOS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS }];
  },
};

export default nextConfig;
