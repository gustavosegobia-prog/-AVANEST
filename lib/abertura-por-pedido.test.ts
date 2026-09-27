import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * O PEDIDO DE ABRIR NUMA ABA SE GASTA AO SER ATENDIDO.
 *
 * O sino e a caixa de avisos mandam a tela abrir numa aba: o aviso de troca
 * cai em Trocas, o lembrete de dinheiro cai em Produção. Isso é bom, e é o
 * que faz o clique resolver em vez de só informar.
 *
 * O defeito era o pedido NÃO TER FIM. Ele viajava como propriedade, e
 * propriedade não se gasta: quem uma vez clicou em "9 plantões sem receber"
 * passava a cair em Produção toda vez que abrisse a Escala, pelo resto da
 * sessão. Bastava sair para o Médico e voltar — a tela remonta, o efeito roda
 * de novo com o pedido de semanas atrás, e o calendário simplesmente não
 * aparecia mais. A pessoa não tem como adivinhar que aquilo veio de um clique
 * antigo; para ela o sistema "abre errado".
 *
 * O token não resolvia: ele distingue um clique do seguinte, e numa
 * remontagem não há clique nenhum para distinguir. Quem tem de apagar o
 * pedido é quem o guardou — o painel.
 *
 * Estes testes leem os arquivos que vão para produção, e não uma cópia da
 * regra: regra copiada para o teste continua passando depois de o código
 * mudar, que é o contrário do que ela existe para fazer.
 */
const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("a Escala avisa que atendeu, e o painel esquece o pedido", () => {
  const escala = ler("components/plantoes.tsx");
  assert.ok(/onAberturaAtendida\?\.\(\)/.test(escala),
    "a Escala voltou a atender o pedido sem avisar quem o guardou");

  const painel = ler("app/dashboard/dashboard-client.tsx");
  assert.ok(/const esquecerAberturaDaEscala = useCallback\(\(\) => setAberturaDaEscala\(null\), \[\]\)/
    .test(painel), "sumiu o esquecimento do pedido da Escala");
  assert.ok(/onAberturaAtendida=\{esquecerAberturaDaEscala\}/.test(painel),
    "a Escala deixou de receber o aviso de esquecer");
  // ESTÁVEL. A função entra nas dependências do efeito da Escala; recriada a
  // cada render, ela faria o efeito rodar sem parar.
  assert.ok(/useCallback\(\(\) => setAberturaDaEscala\(null\), \[\]\)/.test(painel),
    "o esquecimento deixou de ser estável e vira laço de render");
});

test("o Admin esquece do mesmo jeito", () => {
  // Mesmo defeito, um andar abaixo: quem uma vez clicou em "+ Nova escala"
  // passava a abrir o Admin em Locais pelo resto da sessão.
  const painel = ler("app/dashboard/dashboard-client.tsx");
  assert.ok(/const esquecerAberturaDoAdmin = useCallback\(\(\) => setAberturaDoAdmin\(null\), \[\]\)/
    .test(painel), "sumiu o esquecimento do pedido do Admin");
  assert.ok(/abrirEm=\{aberturaDoAdmin\} onAberturaAtendida=\{esquecerAberturaDoAdmin\}/.test(painel),
    "o Admin deixou de receber o aviso de esquecer");
});

test("a Escala continua abrindo no calendário por padrão", () => {
  // O estado inicial é a única coisa que responde "onde a Escala abre quando
  // ninguém pediu nada" — e é para onde a tela volta agora que o pedido se
  // gasta.
  const escala = ler("components/plantoes.tsx");
  assert.ok(/const \[aba, setAba\] = useState<[^>]*>\("escala"\)/.test(escala),
    "a Escala deixou de abrir no calendário quando ninguém pediu outra aba");
});
