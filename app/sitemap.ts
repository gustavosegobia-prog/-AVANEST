import type { MetadataRoute } from "next";

// A lista de páginas que existem para serem encontradas.
//
// Só as públicas. Página que exige login não entra: o buscador seria mandado
// para um redirecionamento ao /login, e um sitemap cheio de endereço que não
// devolve conteúdo ensina o Google a confiar menos no arquivo inteiro.
//
// `priority` não é promessa de posição — é só a importância relativa DENTRO
// deste site, para o buscador saber o que reler primeiro quando tiver pressa.
// A capa e o que o sistema faz vêm antes dos documentos legais.
//
// A data é a do build. Serve como "esta versão é desta hora": num site que
// muda toda semana, data fixa escrita à mão vira mentira no primeiro deploy.

const PAGINAS: Array<{ caminho: string; prioridade: number; frequencia: "weekly" | "monthly" | "yearly" }> = [
  { caminho: "/", prioridade: 1.0, frequencia: "weekly" },
  { caminho: "/recursos", prioridade: 0.9, frequencia: "weekly" },
  { caminho: "/planos", prioridade: 0.9, frequencia: "weekly" },
  { caminho: "/comecar", prioridade: 0.7, frequencia: "monthly" },
  { caminho: "/criar-conta", prioridade: 0.5, frequencia: "monthly" },
  { caminho: "/login", prioridade: 0.3, frequencia: "yearly" },
  { caminho: "/termos", prioridade: 0.3, frequencia: "yearly" },
  { caminho: "/privacidade", prioridade: 0.3, frequencia: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();
  return PAGINAS.map(({ caminho, prioridade, frequencia }) => ({
    url: `https://www.avanest.com.br${caminho}`,
    lastModified: agora,
    changeFrequency: frequencia,
    priority: prioridade,
  }));
}
