import type { MetadataRoute } from "next";

// O que o Google pode ler.
//
// Duas responsabilidades, e a segunda importa mais que a primeira.
//
// A de buscador: apontar o sitemap, para ele não depender de sair seguindo
// link por link até achar as páginas.
//
// A de privacidade: as áreas de dentro tratam dado clínico de paciente. Elas
// já exigem login e um robô sem sessão não veria nada — mas "não consegue ler"
// e "não deve tentar" são coisas diferentes. Um dia uma dessas páginas ganha um
// pedaço público por engano, e a diferença entre um erro e um vazamento indexado
// é esta lista aqui. Ela é a tranca, não o cadeado.
//
// Bloquear caminho que exige login não custa posição nenhuma: o Google nunca
// teve como indexar aquilo mesmo.

const PRIVADO = [
  "/api/",
  "/dashboard",
  "/avaliacoes",
  "/pacientes",
  "/locais",
  "/organizacoes",
  "/assinatura",
  "/calculos",
  "/atualizar-senha",
  "/recuperar-senha",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVADO }],
    sitemap: "https://www.avanest.com.br/sitemap.xml",
  };
}
