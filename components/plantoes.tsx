"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import { ProducaoDoDia, ProducaoDoMes, type Producao } from "@/components/producao-do-dia";
import { OlhoValores, useValoresOcultos } from "@/components/olho-valores";
import {
  corpoDaFolha, cssDasCores, escaparHTML, faixa, folhaDeFaturamento, folhaDeFechamento, folhaDePlantoesPorLocal,
  folhaDeProducao, hhmm, money, podeConfirmar,
  apelidosDaEquipe, filtroDeHospital, montarICS, nomeCurto, nomeDoPeriodo,
  ondeFica, partesDoPlantao, plantaoNaEscala, plural, somarHoras, TURNOS_DO_DIA, TURNOS_RAPIDOS,
  turnosCobertos,
} from "@/lib/escala";
import {
  nomeDoArquivo, planilhaDeFaturamento, planilhaDePlantoes, planilhaPorConvenio,
} from "@/lib/planilha";
import { baixarXLSX } from "@/lib/xlsx";
import { MeuFinanceiro } from "@/components/meu-financeiro";
import { feriadosDoMes } from "@/lib/feriados";
import { avisarPush } from "@/components/ativar-notificacoes";
import { hoje, dataLocal, mesAtual, somarMeses, ultimoDiaDoMes } from "@/lib/data-local";

// Plantões: a escala, o valor e a troca.
//
// A aba fica no topo, ao lado de Médico, porque plantão não é assunto do
// Financeiro — é o trabalho em si. Quem entra aqui quer três respostas:
// onde eu trabalho este mês, quanto isso dá, e quem cobre o dia que eu não
// posso.
//
// O modelo é a ideia central. "Mamborê diurno, 07:00–19:00, R$ 1.100" fica
// salvo, e lançar o mês vira um toque por dia em vez de cinco campos. Foi
// copiado do caderno que o próprio médico já mantém no celular — não é
// invenção nossa, é o hábito que já existe.

type Modelo = {
  id: string; nome: string; local_id: string | null; owner_id: string | null;
  hora_inicio: string; hora_fim: string; valor: number; cor: string; ativo: boolean;
};
type Plantao = {
  id: string; perfil_id: string; local_id: string | null; modelo_id: string | null;
  data: string; hora_inicio: string; hora_fim: string; horas: number;
  valor: number; situacao: string; pago_em: string | null;
  aberto_para_troca: boolean; observacoes: string | null;
  // Plantão de fora: sedação em consultório, hospital que não é do grupo. Só
  // quem lançou enxerga — o RLS não devolve os dos outros nem para o chefe —,
  // e por isso o lugar vem escrito à mão, sem passar pelo cadastro de locais.
  privado: boolean; local_texto: string | null;
  // Quem trabalhou dizendo que trabalhou. Nulo = ainda é só plano, e o
  // fechamento do mês não paga plano.
  confirmado_em: string | null;
};
type Colega = { id: string; nome: string };
type Troca = {
  id: string; plantao_id: string; solicitante_id: string;
  destinatario_id: string | null; status: string; mensagem: string | null;
  created_at: string;
};

const MESES = ["janeiro","fevereiro","março","abril","maio","junho",
               "julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS = ["D","S","T","Q","Q","S","S"];

// Atalhos de duração. 6h e 12h cobrem o padrão; o horário continua editável,
// porque plantão de 24h e cobertura de 4h existem e não podem ficar de fora.
const DURACOES = [6, 12, 24] as const;

/**
 * A folha da escala, numa janela só dela.
 *
 * Janela nova, e não impressão da própria tela. A alternativa seria esconder o
 * painel inteiro no @media print, e o site já tem regras de impressão para a
 * ficha e para o termo — mexer no que vale para "tudo" para acertar uma tela
 * põe em risco o documento que o paciente leva assinado para casa.
 *
 * Aqui a folha é escrita do zero, com o CSS dela junto: o que sai na
 * impressora é exatamente o que está nesta função, e nada mais.
 */
const MARGEM_MM = 8;
/** A4 em pixels de CSS: 1px = 1/96 pol, 1 pol = 25,4 mm. */
const MM = 96 / 25.4;
const FOLHA = {
  landscape: { largura: (297 - 2 * MARGEM_MM) * MM, altura: (210 - 2 * MARGEM_MM) * MM },
  portrait: { largura: (210 - 2 * MARGEM_MM) * MM, altura: (297 - 2 * MARGEM_MM) * MM },
};

/**
 * Encolhe a folha até ela caber numa página — e nem um ponto além disso.
 *
 * A escala do grupo é PREGADA NA PAREDE do centro cirúrgico. Uma folha que
 * escorrega para a segunda página não é uma folha comprida: são dois papéis, e
 * o segundo tem quatro dias do mês. Ninguém prega dois. Na prática o mês some
 * pela metade, que é o oposto do que a folha existe para fazer.
 *
 * A conta é de uma passada só, e cabe provar que basta. Na largura W a folha
 * mede H de altura e a página aceita A. Se H > A, o fator é k = A/H. Alargar o
 * conteúdo para W/k nunca AUMENTA a altura — mais largura só faz caber mais
 * coisa por linha —, então a nova altura H' ≤ H, e a altura final H'·k ≤ H·k =
 * A. A largura final volta a ser (W/k)·k = W, exatamente a da página. Nenhuma
 * medição às cegas, nenhum laço que pode não terminar.
 *
 * Encolher o desenho inteiro, e não a fonte: mudar o tamanho da letra reflui o
 * texto e um nome que cabia passa a quebrar em duas linhas, o que aumenta a
 * altura de volta. O zoom preserva as proporções que já foram conferidas.
 *
 * O piso de 55% é o ponto em que a letra fica pequena demais para ser lida a um
 * passo da parede. Abaixo disso a folha não serve mais, e insistir seria
 * entregar um papel ilegível em vez de um papel em duas páginas.
 *
 * DUAS camadas, e isso não é preciosismo — foi o defeito. A primeira versão
 * encolhia um elemento só, e o PDF continuou saindo com duas páginas: o
 * `transform` muda o DESENHO e não a caixa de layout, e é pela caixa que o
 * navegador decide onde cortar a página. O de dentro encolhe; o de fora tem a
 * altura exata da página e corta o que passar. Sem o de fora, o zoom é
 * enfeite: a folha fica menorzinha e quebra na mesma linha de antes.
 */
function caberNumaFolha(doc: Document, caixa: { largura: number; altura: number }): void {
  const folha = doc.getElementById("folha");
  const papel = doc.getElementById("papel");
  if (!folha || !papel) return;

  folha.style.width = `${caixa.largura}px`;
  papel.style.width = `${caixa.largura}px`;
  const alto = papel.scrollHeight;
  if (alto <= caixa.altura) return;

  // O 0,995 é folga contra arredondamento: a conta prova que cabe, e meio
  // pixel de sobra transformaria "cabe exatamente" em segunda página em branco.
  const aplicar = (k: number) => {
    papel.style.transform = `scale(${k})`;
    papel.style.width = `${caixa.largura / k}px`;
    return papel.scrollHeight * k;
  };

  papel.style.transformOrigin = "top left";
  let k = Math.max(0.55, (caixa.altura / alto) * 0.995);
  const usado = aplicar(k);

  // Segunda tentativa, só para não encolher mais do que precisa. Alargar o
  // papel costuma derrubar a altura bem abaixo do necessário — um mês pesado
  // saía a 63% quando 85% bastavam, e 20% de letra a menos numa folha lida a um
  // passo da parede é diferença que se sente. A tentativa é conferida antes de
  // valer: se a nova altura não couber, volta para a primeira, que é a que tem
  // prova. Melhor uma folha um pouco pequena do que uma folha cortada.
  if (usado < caixa.altura * 0.92) {
    const maior = Math.min(1, k * (caixa.altura / usado) * 0.99);
    if (aplicar(maior) <= caixa.altura) k = maior;
    else aplicar(k);
  }

  folha.style.height = `${caixa.altura}px`;
  // O corte só entra quando o conteúdo comprovadamente cabe. No mês que nem no
  // piso de 55% couber — algo além de qualquer escala real —, a folha volta a
  // quebrar em duas páginas em vez de esconder um dia do mês. Perder um dia
  // caladamente numa escala de plantão é pior do que qualquer folha feia.
  folha.style.overflow = papel.scrollHeight * k <= caixa.altura ? "hidden" : "visible";
  if (folha.style.overflow === "visible") folha.style.height = "auto";
}

function imprimirFolha(titulo: string, corpo: string,
                       orientacao: "landscape" | "portrait" = "landscape",
                       umaFolhaSo = false, emCores = true): boolean {
  const janela = window.open("", "_blank", "width=1100,height=800");
  if (!janela) return false;
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escaparHTML(titulo)}</title><style>
@page{size:A4 ${orientacao};margin:${MARGEM_MM}mm}
*{box-sizing:border-box}
body{margin:0;font:10.5px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111}
/* O zoom vive em #papel; #folha é a moldura do tamanho da página que impede a
   quebra. Transform na raiz do documento é tratado de forma diferente por cada
   motor na hora de imprimir, e a caixa de layout não acompanha o desenho. */
#papel{transform-origin:top left}
h1{font-size:15px;margin:0 0 2px}
.sub{color:#555;font-size:10.5px;margin:0 0 7px}
/* O timbre da instituição. Centralizado, como o da ficha do paciente: é o
   mesmo papel, saído da mesma clínica, e duas convenções diferentes de
   cabeçalho no mesmo consultório parecem dois sistemas. */
.marca{display:flex;align-items:center;justify-content:center;gap:9px;
       padding-bottom:6px;margin-bottom:9px;border-bottom:1.5px solid #333}
.marca img{max-height:40px;max-width:170px;object-fit:contain}
.marca b{font-size:14px;letter-spacing:.3px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{font-size:9px;text-transform:uppercase;letter-spacing:.3px;color:#444;
   padding:3px 4px;border:1px solid #bbb;background:#f1f1f1}
/* Altura MÍNIMA da célula, e não fixa: um mês tranquilo continua enchendo a
   folha em vez de virar uma tira de tabela no alto de uma página vazia, e um
   mês cheio pode crescer — quem devolve o crescimento para dentro da página é
   o zoom de caberNumaFolha.
   Eram 76px, dimensionados para a célula antiga, que trazia uma linha por
   turno. Com as três faixas M/T/N e uma pastilha por pessoa, a célula cheia
   passou a ter o triplo da altura: o mês pesado batia no piso de 55% do zoom e
   ainda saía em três folhas. 46px é o piso de um dia vago; o dia cheio cresce
   por conta própria. */
td{border:1px solid #bbb;vertical-align:top;height:46px;padding:3px 4px}
td.vazio{background:#fafafa}
/* Fim de semana e feriado com fundo próprio, como na tela. Numa grade de sete
   colunas iguais a virada da semana só se descobre lendo o cabeçalho lá em
   cima e contando para baixo — e é no fim de semana que a escala fica mais
   apertada e mais conferida.
   As COR dessas faixas — e a das pastilhas, e a do número do dia — não está
   aqui: vem de cssDasCores(), que tem uma resposta para a folha colorida e
   outra para a preto e branco. Aqui fica só o que não muda com a escolha. */
td .d{font-size:10px;font-weight:800;display:block;margin-bottom:1px}
td .fer{display:block;font-style:normal;text-decoration:none;font-size:7.5px;
  font-weight:800;line-height:1.15;margin-bottom:1px}
td .t{display:block;margin-bottom:3px;line-height:1.25}
td .t b{font-size:10.5px;display:block}
td .t span{font-size:10px;color:#333}
/* A faixa do turno: a letra à esquerda, quem está nela à direita. A letra é
   uma coluna fixa para que M, T e N fiquem alinhados de célula em célula — é
   esse alinhamento que deixa ler "quem faz as noites" correndo o olho na
   horizontal, em vez de dia por dia. */
.fx{display:flex;align-items:flex-start;gap:3px;margin-bottom:1px}
.fx>b{flex:none;width:8px;font-size:7.5px;font-weight:800;color:#777;
  line-height:1.7;text-align:center}
.fx .q{display:flex;flex-wrap:wrap;align-items:center;gap:0;min-width:0}
.fx .vago{font-style:normal;font-size:8px;color:#aaa;line-height:1.6}
/* O hospital, quando a folha cobre mais de um. Ocupa a linha inteira do bloco:
   sem isso, o nome do serviço entraria na fileira das pastilhas e pareceria
   mais um plantonista. */
.fx u{flex-basis:100%;font-style:normal;text-decoration:none;font-size:7px;
  font-weight:800;letter-spacing:.2px;text-transform:uppercase;color:#666}
/* A tira de nomes embaixo do título, com as mesmas pastilhas do calendário. */
.legenda{display:flex;flex-wrap:wrap;gap:0;margin:0 0 6px}
.legenda .p{font-size:9px;padding:1px 5px}
${cssDasCores(emCores)}
/* A linha do turno que ninguém confirmou fica marcada no papel. Sem fundo ela
   se distingue só pela palavra "Aguardando" na quinta coluna, que é justamente
   a que o olho não percorre ao conferir uma folha de pagamento. O
   print-color-adjust é obrigatório: sem ele o navegador descarta fundos ao
   imprimir, e a marca existiria só na tela. */
.pendente td{background:#fff4e0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lista{margin-top:10px}
/* O relatório de fechamento é uma lista longa — trinta dias vezes sete
   pessoas —, e ele não é lido a um passo da parede como a escala: é conferido
   na mesa, com o extrato do lado. Letra menor aqui é folha a menos no grampo,
   e não legibilidade a menos. */
.lista td,.lista th{height:auto;padding:3px 6px;font-size:9.5px}
.lista td{vertical-align:middle}
/* O resumo do grupo tem três colunas curtas: em largura total elas viram três
   faixas de 9cm com uma palavra dentro cada. */
.lista.resumo{max-width:460px}
h2{font-size:11.5px;margin:11px 0 3px;padding-bottom:2px;border-bottom:1.5px solid #333;
   break-after:avoid;page-break-after:avoid}
h2 small{font-weight:400;color:#555;font-size:9.5px;margin-left:6px}
/* A quebra de dentro do hospital: quem paga. Sem régua, e não em versalete —
   ela divide, mas não pode competir com o nome do hospital, que é o que
   separa uma nota da outra. */
h3{font-size:10.5px;margin:9px 0 2px;break-after:avoid;page-break-after:avoid}
h3 small{font-weight:400;color:#555;font-size:9.5px;margin-left:6px}
/* O que ainda não tem pagador. Some da soma de todo mundo e precisa saltar aos
   olhos na folha, senão a pessoa emite as três notas e descobre o quarto bloco
   no mês seguinte. */
/* A linha de total, no pé de cada tabela. É o número que vai para o campo de
   valor da nota, então ela é a única linha em negrito da tabela e leva um
   traço grosso em cima — o olho encontra o fim da coluna sem ler as outras. */
tfoot tr.total td{font-weight:700;background:#f1f1f1;border-top:2px solid #333;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
tfoot tr.total.pendente td{background:#fff4e0;color:#8a4b00}
h3.pendente,p.sub.pendente{color:#8a4b00;font-weight:700}
p.sub.pendente{background:#fff4e0;border-left:3px solid #d98200;padding:7px 10px;
  border-radius:5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.num{text-align:right}
.rodape{margin-top:7px;font-size:8.5px;color:#666;display:flex;justify-content:space-between}
tr,td,th{break-inside:avoid;page-break-inside:avoid}
</style></head><body><div id="folha"><div id="papel">${corpo}</div></div></body></html>`);
  janela.document.close();
  janela.focus();
  // O print imediato pega a folha antes de o navegador medir a tabela, e sai
  // com a primeira linha cortada.
  //
  // Desde que o timbre da instituição entrou, há uma imagem a esperar — e ela
  // vem da rede. Imprimir no tempo fixo de antes sairia com o logo faltando ou
  // com a altura dele ainda em zero, empurrando a tabela para cima. Daí a
  // espera pelo `load` do logo; o teto de 4s existe porque um logo que não
  // carrega não pode segurar a impressão da escala: a folha sai sem ele, que é
  // exatamente o que sai hoje para quem não cadastrou logo nenhum.
  const logo = janela.document.querySelector<HTMLImageElement>(".marca img");
  const pronto = !logo || logo.complete
    ? Promise.resolve()
    : Promise.race([
        new Promise<void>((ok) => {
          logo.addEventListener("load", () => ok(), { once: true });
          logo.addEventListener("error", () => ok(), { once: true });
        }),
        new Promise<void>((ok) => setTimeout(ok, 4000)),
      ]);
  void pronto.then(() => setTimeout(() => {
    // O ajuste vem DEPOIS do logo carregar. Medir antes dá uma altura sem a
    // imagem, e o zoom sairia calculado para uma folha que não é a que
    // imprime — com o logo dentro, ela voltaria a passar para a segunda página.
    if (umaFolhaSo) caberNumaFolha(janela.document, FOLHA[orientacao]);
    janela.print();
  }, 300));
  return true;
}

/**
 * Entrega um arquivo ao usuário sem passar por servidor nenhum.
 *
 * A escala já está na memória da aba; mandá-la para um endpoint só para
 * receber de volta seria expor o mês inteiro de plantões numa requisição que
 * não precisa existir.
 */
function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  // Sem o revoke, cada exportação deixa o arquivo inteiro preso na memória da
  // aba até ela fechar. O atraso existe porque revogar antes de o download
  // começar cancela o próprio download no Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Uma cor por médico, estável.
 *
 * O índice vem da posição na lista da equipe, e não de um sorteio: a mesma
 * pessoa precisa ter a mesma cor toda vez que a tela abre, senão a cor não
 * ajuda a reconhecer ninguém — vira enfeite.
 */
const CORES_MEDICO = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"] as const;

/**
 * Colorida ou preto e branco, guardado no navegador.
 *
 * A impressora do centro cirúrgico é a mesma todo mês. Perguntar de novo a cada
 * impressão seria um clique repetido trinta vezes por ano para dizer a mesma
 * coisa; e escolher por ele, errado, gasta uma folha e a paciência de quem já
 * mandou imprimir.
 *
 * Isto é um estado que mora FORA do React — no localStorage —, e é por isso que
 * a leitura passa por `useSyncExternalStore` em vez de um efeito que chama
 * setState. No servidor não há localStorage: o instantâneo de lá é sempre
 * "colorida", e o React reconcilia sozinho depois da hidratação, sem a
 * renderização em cascata que um efeito provocaria.
 *
 * O evento `storage` entra porque a escolha é do aparelho, e não da aba: quem
 * troca para P&B numa aba e imprime na outra tem de imprimir em P&B.
 */
const MODO_DA_FOLHA = "avanest:escala-impressa";
const ouvintesDoModo = new Set<() => void>();

function assinarModoDaFolha(avisar: () => void): () => void {
  ouvintesDoModo.add(avisar);
  const doNavegador = () => avisar();
  window.addEventListener("storage", doNavegador);
  return () => { ouvintesDoModo.delete(avisar); window.removeEventListener("storage", doNavegador); };
}

// Devolve string, e não objeto: `useSyncExternalStore` compara o instantâneo
// com o anterior, e um objeto novo a cada leitura seria sempre "mudou" — o
// componente renderizaria sem parar.
function modoDaFolha(): string {
  try { return localStorage.getItem(MODO_DA_FOLHA) === "pb" ? "pb" : "cor"; } catch { return "cor"; }
}

// Sai colorida por padrão porque é a que casa com a tela. Quem tem impressora
// monocromática troca uma vez, e não pensa mais no assunto.
const modoDaFolhaNoServidor = () => "cor";

function guardarModoDaFolha(cores: boolean) {
  try { localStorage.setItem(MODO_DA_FOLHA, cores ? "cor" : "pb"); }
  catch { /* navegador com armazenamento bloqueado imprime colorido */ }
  for (const avisar of ouvintesDoModo) avisar();
}

/** Quanto o dedo precisa andar para a gaveta abrir, e a largura dela. */
const ARRASTO_ABRE = 44;
const ARRASTO_LARGURA = 92;

/**
 * A linha que abre uma gaveta vermelha quando se arrasta para a esquerda.
 *
 * O apagar saiu de botão fixo por um motivo de uso, não de estética: a lista é
 * lida no celular entre um caso e outro, e o que se faz nela todo mês é marcar
 * que o plantão foi pago — não apagar. Botão vermelho parado ao lado do polegar
 * na coluna que mais se toca é um erro esperando acontecer; o lugar dele é
 * atrás de um gesto que ninguém faz sem querer.
 *
 * A gaveta ABRE, e não apaga sozinha ao soltar. Arrastar e ver sumir é o
 * bastante para perder um plantão num ônibus chacoalhando — aqui o gesto revela
 * o botão, e apagar continua sendo um toque deliberado com confirmação.
 *
 * O gesto vertical vence sempre que for maior que o horizontal: sem essa regra,
 * rolar a lista com o polegar meio torto abre gaveta em cada linha por onde o
 * dedo passa.
 *
 * E existe um caminho sem gesto nenhum. Arrastar não é anunciado por leitor de
 * tela e não existe no teclado: o mesmo botão está aqui o tempo todo, fora da
 * vista, e aparece inteiro assim que recebe foco. Quem navega por Tab apaga do
 * mesmo jeito que quem arrasta.
 */
function LinhaComGaveta({
  podeApagar, onApagar, descricao, children,
}: {
  podeApagar: boolean;
  onApagar: () => void;
  descricao: string;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  // Enquanto o dedo está na tela o deslocamento acompanha; ao soltar, ele salta
  // para 0 ou para a largura da gaveta. A transição só existe no salto — ligada
  // durante o arrasto, a linha ficaria atrasada em relação ao dedo.
  const [arrastando, setArrastando] = useState(false);

  if (!podeApagar) return <>{children}</>;

  return (
    <div className="plantaoArrasta">
      <div
        className="plantaoArrastaCorpo"
        style={{ transform: `translateX(${dx}px)`, transition: arrastando ? "none" : undefined }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          inicio.current = { x: t.clientX, y: t.clientY };
          setArrastando(true);
        }}
        onTouchMove={(e) => {
          if (!inicio.current) return;
          const t = e.touches[0];
          const andou = t.clientX - inicio.current.x;
          // Rolagem vertical vence. Sem isto, descer a lista com o polegar
          // torto abre gaveta em cada linha por onde o dedo passa.
          if (Math.abs(t.clientY - inicio.current.y) > Math.abs(andou)) { setDx(0); return; }
          // Só para a esquerda, e nunca além da gaveta: puxar para a direita
          // não revela nada e arrastar 300px não deve descolar a linha da tela.
          setDx(Math.max(-ARRASTO_LARGURA, Math.min(0, andou)));
        }}
        onTouchEnd={() => {
          setArrastando(false);
          setDx((d) => (d < -ARRASTO_ABRE ? -ARRASTO_LARGURA : 0));
          inicio.current = null;
        }}
      >
        {children}
      </div>
      <button
        type="button" className="plantaoGaveta"
        aria-label={`Apagar plantão de ${descricao}`}
        onClick={() => { setDx(0); onApagar(); }}
      >
        Apagar
      </button>
    </div>
  );
}

export function Plantoes({
  perfilId, institutionId, locais, ehAdmin, colegas, escalaveis, semCRM = [],
  localAtivoId = null, abrirEm = null, onAvisosMudaram, onEquipeMudou, onNovoLocal,
  equipe = [],
}: {
  perfilId: string;
  institutionId: string;
  locais: LocalDisponivel[];
  ehAdmin: boolean;
  /**
   * Todo mundo da organização, para RESOLVER NOME.
   *
   * Inclui inativo e quem não tem CRM de propósito: um plantão lançado no mês
   * passado por alguém que hoje saiu do grupo precisa continuar mostrando o
   * nome de quem estava escalado. Sem isso a escala de março vira uma fileira
   * de "Profissional".
   */
  colegas: Colega[];
  /**
   * Quem pode ENTRAR na escala: médico ativo com CRM.
   *
   * Quem anestesia responde pelo ato com o registro dele, e a escala é o
   * documento de quem responde. Recepção e financeiro usam o sistema e não
   * entram aqui.
   */
  escalaveis: Colega[];
  /**
   * Todo mundo do cadastro que PODE entrar na escala — médico ativo — com o
   * estado atual de cada um. É a lista que a janela de composição mostra.
   */
  equipe?: { id: string; nome: string; crm: string | null; naEscala: boolean }[];
  /** Ativos sem CRM no cadastro. Não some da tela: vira aviso. */
  semCRM?: string[];
  localAtivoId?: string | null;
  /**
   * Em que aba abrir, quando quem manda abrir é de fora — hoje, o sino.
   *
   * O `token` existe porque a aba é ESTADO desta tela, e a pessoa pode sair
   * dela depois de chegar. Sem o token, um segundo clique no mesmo aviso não
   * mudaria a propriedade, o efeito não rodaria de novo e o sino pareceria
   * quebrado. Com ele, cada clique é um pedido novo.
   */
  abrirEm?: { aba: "escala" | "producao" | "trocas"; token: number } | null;
  /**
   * Avisa o painel de que o sino ficou desatualizado.
   *
   * Os avisos são montados no servidor, na abertura da página. Responder uma
   * troca aqui dentro muda a lista desta tela e não muda a do sino — e o
   * contador continuava mostrando um pedido já respondido até alguém recarregar
   * a página inteira. Quem responde a um pedido e vê o alerta continuar
   * conclui, com razão, que a resposta não foi registrada.
   *
   * Chamado só depois das ações que mexem no que o sino conta. Chamar a cada
   * carregamento faria a página se recarregar em círculo.
   */
  onAvisosMudaram?: () => void;
  /**
   * Abrir o cadastro de hospitais.
   *
   * Um hospital novo é um cadastro, e o cadastro mora no Admin. Mas quem
   * descobre que falta um hospital descobre AQUI, olhando a lista de escalas —
   * e mandar a pessoa procurar sozinha em outra área é onde ela desiste. O
   * atalho leva ao lugar certo; ele não duplica o formulário.
   *
   * Só para quem administra: quem não administra não cadastra local, e um
   * botão que termina em porta fechada é pior do que botão nenhum.
   */
  onNovoLocal?: () => void;
  /**
   * Alguém novo entrou na equipe por esta tela.
   *
   * Separado de `onAvisosMudaram` de propósito: são dois fatos diferentes, e
   * um nome que serve para os dois é um nome que não explica nenhum. O painel
   * pode acabar ligando os dois na mesma recarga — mas isso é decisão dele,
   * não desta tela.
   */
  onEquipeMudou?: () => void;
}) {
  const [mes, setMes] = useState(mesAtual());
  const [aba, setAba] = useState<"escala" | "producao" | "modelos" | "trocas" | "meufinanceiro">("escala");
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [trocas, setTrocas] = useState<Troca[]>([]);
  /**
   * Os plantões citados pelas trocas pendentes, de QUALQUER mês.
   *
   * Separado de `plantoes` de propósito: aquele é o mês na tela e alimenta o
   * calendário. Misturar um plantão de setembro na lista de agosto seria
   * arriscar que ele apareça onde não devia. Aqui ele serve só para a aba de
   * Trocas conseguir desenhar a linha.
   */
  const [plantoesDeTrocas, setPlantoesDeTrocas] = useState<Plantao[]>([]);
  // Escala do grupo ou só a minha. Duas leituras da mesma tela: "onde eu
  // trabalho este mês" e "quem está de plantão no dia 12".
  const [escopo, setEscopo] = useState<"minha" | "grupo">("minha");
  /**
   * Qual hospital a escala do grupo está mostrando.
   *
   * Só vale para a escala do grupo, e é aí que está a diferença entre as
   * duas. Um grupo de anestesia cobre várias instituições ao mesmo tempo, e
   * misturá-las num calendário só não é uma lista mais completa: é uma lista
   * ilegível. Duas linhas "07-19h" no mesmo dia, uma da Santa Casa e outra do
   * Hospital da Unimed, não se distinguem — e é a escala de dois serviços
   * diferentes, com equipes diferentes.
   *
   * Na escala pessoal acontece o oposto: misturar é a graça. O médico quer
   * ver o mês inteiro dele num lugar só, não importa em quantos hospitais
   * esteja espalhado.
   *
   * Começa no local onde a pessoa está atendendo hoje, que ela já respondeu
   * ao entrar no sistema. Sem essa resposta, no primeiro hospital do cadastro
   * — e não em "todos": a visão de conjunto saiu da coluna porque não é a
   * escala de lugar nenhum, e abrir nela deixaria a tela mostrando justamente
   * o que se decidiu não mostrar.
   */
  const [hospital, setHospital] = useState<string>(
    localAtivoId ?? locais.find((l) => l.ativo)?.id ?? "todos",
  );
  const { oculto: valorOculto, alternar: esconderValores, mascara } = useValoresOcultos();
  const [pedindoTroca, setPedindoTroca] = useState<Plantao | null>(null);
  // Os hospitais em que você tem, ou já teve, plantão. Decide quais escalas de
  // grupo a coluna da esquerda oferece.
  const [meusLocais, setMeusLocais] = useState<Set<string>>(new Set());
  // Lançar sem modelo. O modelo é atalho, não pré-requisito: exigir que a
  // pessoa crie um modelo antes de registrar o primeiro plantão é uma parede
  // logo na entrada, e foi exatamente onde a tela travou no primeiro uso.
  // O dia e para quem. A pessoa vem junto porque o formulário manual pode ser
  // aberto de dentro do atalho rápido — escolheu o colega, quer outro horário —
  // e reabrir com "Para mim" apagaria a escolha que a pessoa acabou de fazer.
  const [lancando, setLancando] = useState<{ dia: string; para: string } | null>(null);

  const nomePorId = useMemo(() => new Map(colegas.map((c) => [c.id, c.nome])), [colegas]);
  const localPorId = useMemo(() => new Map(locais.map((l) => [l.id, nomeDoLocal(l)])), [locais]);
  /**
   * O timbre de um local: nome e logo, do jeito que o papel precisa.
   *
   * Sai da lista que a tela já tem em mãos, e não de uma consulta nova: o
   * cadastro do local já veio com o logo quando a página montou, e ir buscá-lo
   * de novo na hora de imprimir só acrescentaria uma espera entre o clique e a
   * janela de impressão.
   */
  const marcaDe = useCallback((id: string | null) => {
    const local = id ? locais.find((l) => l.id === id) : null;
    return local ? { nome: nomeDoLocal(local), logo: local.logo_url } : null;
  }, [locais]);
  // O calendário precisa dizer QUAL plantão é, não só que existe um. Cor e
  // nome vêm do modelo; sem modelo, o rótulo cai no horário, que ainda
  // distingue diurno de noturno.
  // Convênios que a organização já usa, para o campo do caderninho sugerir
  // "Unimed" em vez de exigir que se digite de novo a cada paciente.
  const [conveniosConhecidos, setConvenios] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data } = await createClient()
        .from("convenio_valores").select("convenio").eq("ativo", true);
      if (!vivo) return;
      const nomes = [...new Set((data ?? []).map((r) => String(r.convenio).trim()).filter(Boolean))];
      setConvenios(["Particular", ...nomes.filter((n) => n.toLowerCase() !== "particular")].sort());
    })();
    return () => { vivo = false; };
  }, []);

  const emCores = useSyncExternalStore(
    assinarModoDaFolha, modoDaFolha, modoDaFolhaNoServidor) === "cor";

  const corPorMedico = useMemo(() => {
    const m = new Map<string, string>();
    colegas.forEach((c, i) => m.set(c.id, CORES_MEDICO[i % CORES_MEDICO.length]));
    return m;
  }, [colegas]);

  /**
   * A cor de cada hospital, para o calendário da escala pessoal.
   *
   * Ordenado por id, e não pela ordem em que a lista chega. `meus_locais()`
   * devolve os locais recentes na frente — a ordem muda a cada dia e é
   * diferente para cada pessoa —, e cor tirada da posição nessa lista trocaria
   * de hospital toda semana. Cor que muda não identifica nada; vira enfeite.
   *
   * O id nunca muda, nem quando o hospital troca de razão social.
   */
  const corPorLocal = useMemo(() => {
    const m = new Map<string, string>();
    [...locais].sort((a, b) => a.id.localeCompare(b.id))
      .forEach((l, i) => m.set(l.id, CORES_MEDICO[i % CORES_MEDICO.length]));
    return m;
  }, [locais]);

  // Os feriados nacionais do mês na tela. Recalculado só quando o mês muda:
  // é conta pura, sem rede e sem banco — feriado nacional é lei publicada, e
  // uma escala que precisa de internet para saber que 1º de maio é feriado
  // deixa de funcionar exatamente no plantão em que a rede do hospital cai.
  const feriados = useMemo(() => feriadosDoMes(mes), [mes]);

  // O nome curto de cada colega para os botões de escalar rápido.
  const apelidos = useMemo(() => apelidosDaEquipe(colegas), [colegas]);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const tresMesesAtras = dataLocal(new Date(Date.now() - 92 * 86400000));
    const primeiro = `${mes}-01`;
    const ultimo = ultimoDiaDoMes(mes);
    const [{ data: mods }, { data: plans, error }, { data: trs }, { data: onde }] = await Promise.all([
      supabase.from("modelos_plantao").select("*").eq("ativo", true).order("nome"),
      supabase.from("plantoes").select("*").gte("data", primeiro).lte("data", ultimo).order("data"),
      supabase.from("trocas_plantao").select("*").eq("status", "pendente").order("created_at", { ascending: false }),
      // Em que hospitais ESTA pessoa trabalha — de qualquer mês, e não só do
      // que está aberto: quem cobre um lugar uma vez por trimestre veria a
      // escala de lá sumir e voltar conforme o mês na tela.
      //
      // A janela é a MESMA de meus_locais_de_plantao(), que é a regra do
      // banco. Duas janelas diferentes fariam a coluna oferecer um hospital
      // cuja escala o banco já esconde, e o clique cairia num mês vazio sem
      // explicação nenhuma.
      supabase.from("plantoes").select("local_id")
        .eq("perfil_id", perfilId).not("local_id", "is", null)
        .gte("data", tresMesesAtras),
    ]);
    setMeusLocais(new Set((onde ?? []).map((r) => r.local_id as string)));
    setCarregando(false);
    if (error) { setErro("Não foi possível carregar os plantões."); return; }
    setModelos((mods ?? []) as Modelo[]);
    setPlantoes((plans ?? []) as Plantao[]);
    setTrocas((trs ?? []) as Troca[]);

    // TROCA DE OUTRO MÊS PRECISA DO PLANTÃO DELA.
    //
    // Os plantões vêm só do mês aberto; as trocas pendentes vêm de todos. Em
    // 31 de agosto, um convite para um plantão de 2 de setembro chegava no
    // sino, no telefone — e a lista de Pedidos recebidos aparecia VAZIA,
    // porque a linha não achava o plantão e desistia de se desenhar. Não havia
    // onde aceitar, e nada na tela dizia por quê.
    const pendentes = (trs ?? []) as Troca[];
    const jaTenho = new Set(((plans ?? []) as Plantao[]).map((x) => x.id));
    const faltam = [...new Set(pendentes.map((x) => x.plantao_id))].filter((id) => !jaTenho.has(id));
    if (faltam.length) {
      const { data: extras } = await supabase.from("plantoes").select("*").in("id", faltam);
      setPlantoesDeTrocas((extras ?? []) as Plantao[]);
    } else {
      setPlantoesDeTrocas([]);
    }
  }, [mes]);

  useEffect(() => { void carregar(); }, [carregar]);

  const meus = plantoes.filter((p) => p.perfil_id === perfilId && p.situacao !== "cancelado");
  const resumo = useMemo(() => {
    const total = meus.reduce((s, p) => s + Number(p.valor), 0);
    const pago = meus.filter((p) => p.situacao === "pago").reduce((s, p) => s + Number(p.valor), 0);
    const horas = meus.reduce((s, p) => s + Number(p.horas), 0);
    return { total, pago, aberto: total - pago, horas, turnos: meus.length };
  }, [meus]);

  function mudarMes(passo: number) {
    setMes(somarMeses(mes, passo));
  }

  /**
   * Lançar a partir de um modelo, para mim ou para um colega.
   *
   * `para` é o atalho de escalar rápido: escolhe-se a pessoa, clica-se no
   * modelo, e o turno entra na escala dela. A trava de administrador é a mesma
   * do lançamento manual — o RLS recusaria de qualquer forma, e conferir aqui
   * evita a tentativa virar um erro seco na tela.
   */
  async function lancar(dia: string, modelo: Modelo, para?: string) {
    setErro(""); setAviso("");
    const dono = ehAdmin && para ? para : perfilId;
    const supabase = createClient();
    const { error } = await supabase.from("plantoes").insert({
      institution_id: institutionId, perfil_id: dono,
      local_id: modelo.local_id, modelo_id: modelo.id,
      data: dia, hora_inicio: modelo.hora_inicio, hora_fim: modelo.hora_fim,
      // Mesma regra do lançamento manual: quanto o colega recebe é combinado
      // dele com quem paga, e ele ajusta na própria lista. O valor do modelo é
      // o seu, não o dele.
      valor: dono === perfilId ? modelo.valor : 0, created_by: perfilId,
    });
    if (error) {
      setErro(error.code === "23505"
        ? dono === perfilId
          ? "Você já tem um plantão nesse dia e horário."
          : `${nomePorId.get(dono) ?? "Esse profissional"} já tem um plantão nesse dia e horário.`
        : "Não foi possível lançar o plantão.");
      return;
    }
    // O painel do dia fica ABERTO quando se escala outra pessoa: montar a
    // escala é escalar seis nomes seguidos no mesmo dia, e fechar a cada
    // clique obrigaria a reabrir o dia toda vez. Para si mesmo fecha, que é o
    // gesto único de quem só lança o próprio plantão.
    if (dono === perfilId) setDiaAberto(null);
    else setAviso(`Plantão de ${nomeCurto(nomePorId.get(dono) ?? "")} lançado em ${dia.slice(8, 10)}/${dia.slice(5, 7)}.`);
    void carregar();
  }

  async function lancarAvulso(dados: {
    data: string; local_id: string; local_texto: string;
    hora_inicio: string; hora_fim: string;
    valor: number; perfil_id: string; privado: boolean;
  }) {
    setErro(""); setAviso("");
    // Quem monta a escala do serviço lança para os outros; quem não é
    // administrador só lança para si — o RLS recusaria de qualquer forma, e
    // forçar aqui evita a tentativa virar um erro seco na tela.
    //
    // Plantão privado é sempre para si, mesmo sendo administrador: um turno
    // que só a outra pessoa enxerga, lançado por você, é agenda dela — e o
    // banco recusa.
    const dono = ehAdmin && dados.perfil_id && !dados.privado ? dados.perfil_id : perfilId;
    const { error } = await createClient().from("plantoes").insert({
      institution_id: institutionId, perfil_id: dono,
      // Um ou outro, nunca os dois: é o que a constraint do banco exige, e o
      // que impede a mesma linha de ter dois lugares diferentes.
      //
      // Sem local escolhido, vale o que foi escrito à mão — e isso não é mais
      // privilégio do plantão privado. Antes, não achar o hospital na lista
      // deixava o plantão sem lugar nenhum, e a folha impressa dizia "Sem
      // local" num dia em que a pessoa esteve em algum lugar. Escrever o nome é
      // sempre melhor do que não dizer nada.
      local_id: dados.privado ? null : (dados.local_id || null),
      local_texto: dados.privado || !dados.local_id
        ? (dados.local_texto.trim() || null)
        : null,
      privado: dados.privado,
      data: dados.data,
      hora_inicio: dados.hora_inicio, hora_fim: dados.hora_fim,
      // O valor de um plantão que você escala para outra pessoa é combinado
      // entre ela e quem paga: entra zero, e ela ajusta na própria lista.
      valor: dono === perfilId ? dados.valor : 0, created_by: perfilId,
    });
    if (error) {
      // A recusa VOLTA para quem chamou, em vez de virar só um aviso no topo da
      // página. Com o diálogo aberto por cima, aquele aviso ficava atrás dele:
      // o sistema recusava, escrevia o motivo, e a pessoa via um botão que não
      // fazia nada. Cara de travamento, sendo que a resposta estava pronta.
      const motivo = error.code === "23505"
        ? dono === perfilId
          ? "Você já tem um plantão nesse dia e horário."
          : `${nomePorId.get(dono) ?? "Esse profissional"} já tem um plantão nesse dia e horário.`
        : "Não foi possível lançar o plantão.";
      setErro(motivo);
      return motivo;
    }
    setErro("");
    setLancando(null);
    if (dados.privado) {
      setAviso("Plantão lançado só na sua escala. Ninguém do grupo enxerga este turno.");
    } else if (dono !== perfilId) {
      setAviso(`Plantão lançado para ${nomePorId.get(dono) ?? "o profissional"}. Ele aparece na escala dele, que pode ajustar o valor e pedir troca.`);
    }
    void carregar();
    return null;
  }

  async function atualizar(id: string, campos: Partial<Plantao>) {
    setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("plantoes")
      .update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
    // A mensagem do banco vem inteira. As recusas daqui são regras de escala —
    // "este plantão é do grupo, passe para um colega" —, e traduzir isso para
    // "não foi possível salvar" esconde justamente a parte que diz o que fazer.
    if (error) { setErro(error.message || "Não foi possível salvar a alteração."); return; }
    void carregar();
  }

  /**
   * "Recebido": um toque, e a data do pagamento junto.
   *
   * A data entra aqui porque é aqui que ela existe — o dia em que se apertou o
   * botão é o dia em que o dinheiro caiu. O seletor de situação nunca a
   * gravava, e um plantão "pago" sem `pago_em` é um plantão que o fechamento do
   * mês não consegue somar no mês certo.
   *
   * Volta atrás porque quem marca o mês inteiro de enfiada erra uma linha, e a
   * correção não pode exigir abrir o seletor para desfazer um toque.
   */
  async function marcarRecebido(plantao: Plantao) {
    const recebido = plantao.situacao === "pago";
    await atualizar(plantao.id, recebido
      ? { situacao: "realizado", pago_em: null }
      : { situacao: "pago", pago_em: hoje() });
  }

  async function pedirTroca(plantao: Plantao, destinatarioId: string, mensagem: string) {
    setErro(""); setAviso("");
    const supabase = createClient();
    const { data: criada, error } = await supabase.from("trocas_plantao").insert({
      institution_id: institutionId, plantao_id: plantao.id,
      solicitante_id: perfilId,
      // String vazia significa "todo o grupo"; o banco guarda null, que é o
      // que aceitar_troca lê para saber que qualquer um pode assumir.
      destinatario_id: destinatarioId || null,
      mensagem: mensagem.trim() || null,
    }).select("id").single();
    if (error) { setErro("Não foi possível registrar o pedido de troca."); return; }
    // Depois de gravado, e sem esperar: o plantão já está oferecido: se a
    // notificação falhar, o colega ainda vê na aba Trocas.
    if (criada?.id) avisarPush({ tipo: "troca", id: criada.id });
    await supabase.from("plantoes").update({ aberto_para_troca: true }).eq("id", plantao.id);
    setPedindoTroca(null);
    setAviso(destinatarioId
      ? "Convite enviado. Ele aparece na aba Trocas do colega."
      : "Plantão oferecido ao grupo. Qualquer colega pode assumir.");
    void carregar();
    onAvisosMudaram?.();
  }


/**
 * Por que nenhum aviso saiu.
 *
 * Cada motivo pede uma ação DIFERENTE de uma pessoa diferente: a chave é do
 * dono do sistema, o alvo vazio é de quem monta a escala, e o aparelho é de
 * cada colega. Uma frase só para os três mandava sempre cobrar a pessoa errada.
 */
const EXPLICA_ZERO: Record<string, string> = {
  "sem-chave":
    "As notificações não estão configuradas no servidor — nada foi enviado. "
    + "Isso é configuração do sistema, não da equipe.",
  "sem-alvo":
    "Ninguém a avisar neste mês: o aviso vai só para quem tem plantão lançado, "
    + "e você não é avisado dos seus próprios. Lance a escala antes de avisar.",
  "sem-aparelho":
    "A escala tem gente, mas nenhum deles ligou as notificações no aparelho — "
    + "o aviso não tinha para onde ir.",
  "falha-consulta":
    "Não consegui ler a escala do mês para saber quem avisar. Tente de novo; "
    + "se repetir, me avise.",
  desconhecido:
    "O aviso não saiu e o servidor não disse por quê. Me avise se repetir.",
};
  /**
   * "A escala do mês está pronta" — dito de propósito, e não adivinhado.
   *
   * O aviso vai só para quem TEM plantão no mês. Avisar a equipe inteira de
   * uma escala em que a pessoa não entrou é o tipo de notificação que ensina
   * a ignorar as próximas.
   */
  const [avisando, setAvisando] = useState(false);
  async function avisarEquipe() {
    setErro(""); setAviso(""); setAvisando(true);
    try {
      const resposta = await fetch("/api/push/avisar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "escala", mes }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) { setErro(dados.error ?? "Não foi possível avisar agora."); return; }
      if (dados.enviadas) {
        setAviso(`Aviso enviado para ${dados.enviadas} aparelho${dados.enviadas > 1 ? "s" : ""} da equipe.`);
        return;
      }
      // Zero enviados tem TRÊS causas, e duas não são culpa da equipe. A
      // mensagem antiga dizia sempre a terceira — mandando o dono do serviço
      // cobrar os colegas por uma chave que faltava no servidor.
      setErro(EXPLICA_ZERO[String(dados.motivo ?? "")] ?? EXPLICA_ZERO.desconhecido);
    } finally {
      setAvisando(false);
    }
  }

  async function responderTroca(trocaId: string, acao: "aceitar_troca" | "recusar_troca" | "cancelar_troca") {
    setErro(""); setAviso("");
    const { error } = await createClient().rpc(acao, { p_troca_id: trocaId });
    if (error) { setErro(error.message); return; }
    // Cancelar é o próprio solicitante desistindo — não há a quem avisar.
    if (acao !== "cancelar_troca") avisarPush({ tipo: "troca_resolvida", id: trocaId });
    setAviso(acao === "aceitar_troca"
      ? "Plantão assumido. A escala foi atualizada e a troca ficou registrada na auditoria."
      : acao === "recusar_troca" ? "Convite recusado." : "Pedido cancelado.");
    void carregar();
    onAvisosMudaram?.();
  }

  /**
   * Apagar. Só o que é privado, ou por quem monta a escala.
   *
   * Plantão da escala do grupo não se apaga: sai passando para um colega que
   * aceite. O banco recusa com essa frase, e a tela repete o que ele disse em
   * vez de traduzir por conta própria — mensagem inventada aqui envelhece
   * separada da regra que a produziu.
   */
  async function remover(id: string) {
    const alvo = plantoes.find((p) => p.id === id);
    const pergunta = alvo?.privado
      ? "Apagar este plantão? Ele é só seu, ninguém do grupo o enxerga."
      : "Remover este plantão da escala?";
    if (!confirm(pergunta)) return;
    setErro(""); setAviso("");
    // O .select() no fim não é enfeite: a política de apagar do banco esconde
    // a linha em vez de recusar, e sem ele um DELETE barrado volta como
    // sucesso com zero linhas — a tela diria "removido" e o plantão
    // continuaria na escala. Com ele, zero linhas é resposta e vira aviso.
    const { data, error } = await createClient()
      .from("plantoes").delete().eq("id", id).select("id");
    if (error) { setErro(error.message || "Não foi possível remover o plantão."); return; }
    if (!data || data.length === 0) {
      setErro("Este plantão está na escala do grupo e não pode ser apagado."
        + " Use \"Passar plantão\" e escolha um colega — ele sai da sua escala quando o colega aceitar.");
      return;
    }
    void carregar();
  }

  /**
   * A seção aberta, como a coluna a enxerga.
   *
   * Aba e escopo continuam sendo dois estados porque significam coisas
   * diferentes — que painel mostrar e de quem é a escala —, mas a coluna
   * apresenta um item por seção. Aqui os dois viram um nome só, e irPara faz
   * o caminho de volta: sem isso, "Minha escala" e "Escala do grupo"
   * apareceriam ambas acesas, já que as duas são a aba "escala".
   */

  // O contador da coluna conta o que espera resposta SUA: convite dirigido a
  // você, mais oferta aberta de outra pessoa. Contar os seus próprios pedidos
  // faria o número pedir uma ação que não é sua.
  const trocasParaMim = trocas.filter((t) => t.solicitante_id !== perfilId
    && (t.destinatario_id === null || t.destinatario_id === perfilId)).length;

  const hojeISO = hoje();
  // Um relógio só para a lista inteira. Chamar new Date() dentro do map faria
  // trinta linhas perguntarem a hora trinta vezes — e, na virada de um minuto,
  // duas linhas do mesmo mês responderiam coisas diferentes.
  const agora = new Date();
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const primeiroDiaSemana = new Date(ano, m - 1, 1).getDay();

  // O que a tela está mostrando, uma vez só. O calendário, a lista, a folha
  // impressa e o arquivo de agenda leem daqui — se cada um refizesse o filtro,
  // bastaria um deles esquecer o "situacao !== cancelado" para a escala
  // impressa sair diferente da que está na tela.
  // A coluna lista os hospitais do CADASTRO, e não só os que já têm plantão.
  // Escala de hospital vazio não é um beco: é exatamente onde o administrador
  // vai para montá-la, e o botão de lançar está ali.
  const locaisAtivos = useMemo(() => locais.filter((l) => l.ativo), [locais]);
  /**
   * As escalas de grupo que ESTA pessoa vê na coluna.
   *
   * Quem monta a escala vê todas — não dá para montar a escala de um hospital
   * que não aparece na tela. Os demais veem os hospitais em que trabalham: a
   * escala da Unimed não diz nada a quem nunca pisou lá, e três serviços na
   * coluna fazem procurar o seu entre os que não são.
   *
   * Isto acompanha a regra do banco, e não a substitui: a política de leitura
   * de `plantoes` diz a mesma coisa, e é ela que barra. Esta lista existe para
   * a coluna não oferecer um nome cujo conteúdo o banco já esconde.
   *
   * Quem ainda não tem plantão nenhum não vê escala de grupo — antes via todas.
   * Mudou porque o banco mudou: mostrar os nomes agora levaria a um mês vazio,
   * que é pior do que não mostrar. Quem cai nesse caso lê o porquê na tela.
   */
  const locaisDaColuna = useMemo(() => {
    if (ehAdmin) return locaisAtivos;
    return locaisAtivos.filter((l) => meusLocais.has(l.id));
  }, [ehAdmin, locaisAtivos, meusLocais]);

  // Id que não corresponde a hospital nenhum cai em "todos": é o que impede um
  // local arquivado, ou um cadastro que mudou, de esvaziar a tela em silêncio.
  const hospitalAtivo = filtroDeHospital(hospital, locaisAtivos.map((l) => l.id));

  // O nome do hospital só cabe na célula quando ela mistura hospitais. Aberta
  // num deles, seria a mesma palavra repetida em trinta e um quadrados.
  const mostraLocalNaCelula = hospitalAtivo === "todos" || hospitalAtivo === "sem";

  const daEscala = useMemo(
    () => plantoes.filter((p) => p.situacao !== "cancelado"
      && (escopo === "grupo" || p.perfil_id === perfilId)
      // O plantão privado nunca entra na escala do grupo, nem na sua. O banco
      // já não devolve os dos outros; o seu volta, e sem esta linha ele cairia
      // em "Sem hospital" — dentro da escala do grupo, que é o único lugar
      // onde ele não deve estar.
      && (escopo !== "grupo" || !p.privado)
      // A escala pessoal mistura os hospitais de propósito; a do grupo é uma
      // por hospital, pelo motivo explicado em `hospital`.
      && (escopo !== "grupo" || plantaoNaEscala(p.local_id, hospitalAtivo))),
    [plantoes, escopo, perfilId, hospitalAtivo],
  );

  // O sino manda em que aba esta tela abre. Um aviso de troca que caísse no
  // calendário deixaria a pessoa procurando o pedido dia a dia — e o pedido
  // está a uma aba de distância, com o dia, o horário e os dois botões.
  useEffect(() => {
    if (!abrirEm) return;
    setAba(abrirEm.aba);
    if (abrirEm.aba === "escala") setEscopo("minha");
    // RECARREGA JUNTO COM O SALTO.
    //
    // Assumir um plantão pelo sino muda o dono do turno, e o calendário desta
    // tela é carregado no navegador — `router.refresh()` remonta o servidor e
    // não toca nele. Sem esta linha, quem assume pelo sino vê o aviso sumir e
    // o calendário continuar mostrando o nome do colega, e conclui que não
    // pegou.
    void carregar();
  }, [abrirEm, carregar]);

  const secaoAtiva = aba === "escala"
    ? (escopo === "minha" ? "minha" : `grupo:${hospitalAtivo}`)
    : aba;

  function irPara(secao: string) {
    if (secao === "minha") { setAba("escala"); setEscopo("minha"); return; }
    if (secao.startsWith("grupo:")) {
      setAba("escala"); setEscopo("grupo"); setHospital(secao.slice(6));
      return;
    }
    setAba(secao as "producao" | "modelos" | "trocas" | "meufinanceiro");
  }

  /**
   * Os cartões de resumo são de Minha escala, e de mais lugar nenhum.
   *
   * Todos eles contam a mesma coisa: os SEUS plantões, as SUAS horas, o SEU
   * dinheiro. Ao lado da escala do grupo, que mostra o turno da equipe, eles
   * respondem uma pergunta que ninguém fez ali — e pior, parecem falar do que
   * está na tela. Em Trocas e Modelos é a mesma história: são listas, não
   * painéis.
   */
  const mostraMetricas = aba === "escala" && escopo === "minha";

  /** O que esta escala mostra, em uma frase. */
  const notaDaEscala = escopo === "minha"
    ? "Todos os seus turnos, de todos os hospitais, num lugar só — inclusive os plantões só seus."
    : hospitalAtivo === "todos"
      // Sem item na coluna: só se chega aqui por hospital arquivado ou
      // organização sem local cadastrado. A frase diz o caminho de volta.
      ? "Nenhum hospital aberto — a escala está mostrando todos juntos. Escolha um hospital na coluna ao lado."
      : hospitalAtivo === "sem"
        ? "Plantões lançados sem hospital. Abra o dia e relance com o local para eles entrarem na escala certa."
        : `Escala da equipe em ${locaisAtivos.find((l) => l.id === hospitalAtivo)
            ? nomeDoLocal(locaisAtivos.find((l) => l.id === hospitalAtivo)!) : "—"}. `
          + "Você edita apenas os seus turnos.";

  /**
   * Os turnos de um dia, agrupados por hospital E horário.
   *
   * O hospital entra na chave, e não é detalhe: sem ele, o plantão das 07h da
   * Santa Casa e o das 07h do Hospital da Unimed caíam na mesma linha, com as
   * iniciais das duas equipes juntas. A tela mostrava uma escala que não
   * existe em lugar nenhum.
   */
  const turnosDoDia = useCallback((dia: string) => {
    const doDia = daEscala.filter((p) => p.data === dia);
    return Object.values(doDia.reduce<Record<string, {
      chave: string; localId: string | null; inicio: string; fim: string;
      horas: number; gente: Plantao[];
    }>>((acc, p) => {
      const chave = `${p.local_id ?? "-"}|${p.hora_inicio}|${p.hora_fim}`;
      acc[chave] ??= {
        chave, localId: p.local_id, inicio: p.hora_inicio, fim: p.hora_fim,
        horas: Number(p.horas), gente: [],
      };
      acc[chave].gente.push(p);
      return acc;
    }, {})).sort((a, b) => a.inicio.localeCompare(b.inicio)
      || String(a.localId).localeCompare(String(b.localId)));
  }, [daEscala]);

  /**
   * O dia dividido em manhã, tarde e noite.
   *
   * O turno continua sendo lançado com a hora que a pessoa quiser: um fica até
   * as 13h, outro faz o dia inteiro, outro entra às 19h. A faixa não é uma
   * gaveta em que o plantão precisa caber — ela é LIDA do horário. Por isso o
   * de 07-19h aparece na manhã e na tarde: às 15h ele está lá, e uma tarde em
   * branco numa tela feita para achar buraco de cobertura faria alguém escalar
   * gente em cima de um plantão que já existe.
   *
   * As três faixas aparecem sempre que o dia tem alguém, inclusive as vazias.
   * O vazio é a informação: "sábado à noite não tem ninguém" é a pergunta que
   * traz o coordenador a esta tela.
   */
  const faixasDoDia = useCallback((dia: string) => {
    const turnos = turnosDoDia(dia);
    if (turnos.length === 0) return [];
    return TURNOS_DO_DIA.map((faixaDoDia) => {
      const blocos = turnos.filter((t) => turnosCobertos(t.inicio, t.fim).includes(faixaDoDia.id));
      // Vendo hospitais diferentes de uma vez, duas equipes na mesma faixa
      // viram uma fileira só de iniciais — e uma escala que não existe em
      // lugar nenhum. O nome separa as equipes; num hospital só ele seria a
      // mesma palavra repetida trinta vezes na tela.
      const locais = new Set(blocos.map((b) => b.localId ?? "-"));
      return { ...faixaDoDia, blocos, separarPorLocal: mostraLocalNaCelula && locais.size > 1 };
    });
  }, [turnosDoDia, mostraLocalNaCelula]);

  /**
   * A escala no calendário do celular.
   *
   * O mesmo arquivo serve aos dois: o iPhone abre .ics direto no Calendário e o
   * Google Agenda importa em Configurações → Importar. Não há "botão do
   * Google" separado porque o link do Google cria um evento por vez, e uma
   * escala tem vinte.
   */
  function exportarAgenda() {
    setErro(""); setAviso("");
    if (daEscala.length === 0) { setErro("Não há plantão neste mês para exportar."); return; }
    baixar(
      `escala-${escopo}-${mes}.ics`,
      montarICS(daEscala.map((p) => ({
        id: p.id, data: p.data, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim,
        titulo: escopo === "grupo"
          ? `Plantão · ${nomePorId.get(p.perfil_id) ?? "equipe"}`
          : `Plantão${ondeFica(p, localPorId, "") ? ` · ${ondeFica(p, localPorId, "")}` : ""}`,
        onde: ondeFica(p, localPorId, ""),
      }))),
      "text/calendar;charset=utf-8",
    );
    setAviso("Arquivo baixado. No iPhone, toque nele e escolha Adicionar. No Google Agenda: Configurações → Importar e exportar → Importar.");
  }

  /**
   * A produção do mês em papel, para mandar para o faturamento.
   *
   * Folha retrato, e não paisagem como a escala: é uma lista de nomes, e
   * lista de nome pede coluna estreita e folha em pé.
   */
  function imprimirProducao(itens: Producao[]) {
    setErro(""); setAviso("");
    const { titulo, corpo } = folhaDeProducao(
      itens.map((i) => ({
        data: i.data, paciente: i.paciente, convenio: i.convenio,
        procedimento: i.procedimento, valor: Number(i.valor), situacao: i.situacao,
      })),
      MESES[m - 1], ano, new Date(),
      // A produção sai timbrada pela instituição escolhida na entrada — é a
      // folha que vai para o faturamento DELA.
      marcaDe(localAtivoId),
    );
    if (!imprimirFolha(titulo, corpo, "portrait")) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up para este site e tente de novo.");
    }
  }

  /**
   * A nota de plantões do mês, por hospital.
   *
   * Sai de `meus`, e não de `daEscala`: a folha que vira nota é de todos os
   * hospitais em que a pessoa trabalhou no mês, independentemente de qual
   * hospital está escolhido na tela naquele momento. Quem filtrou a escala
   * para ver a de um hospital não quis, com isso, emitir nota só daquele.
   *
   * Sem timbre. As outras folhas timbram quando são de um lugar só; esta é a
   * folha das VÁRIAS, e um logo no alto diria que a página inteira é daquele
   * hospital — justamente o que ela não é.
   */
  function imprimirPlantoesParaNota() {
    setErro(""); setAviso("");
    if (meus.length === 0) { setErro("Não há plantão seu neste mês para pôr em nota."); return; }
    const { titulo, corpo } = folhaDePlantoesPorLocal(
      meus.map((p) => ({
        data: p.data, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim,
        horas: Number(p.horas), valor: Number(p.valor),
        local: ondeFica(p, localPorId, ""),
      })),
      MESES[m - 1], ano, new Date(),
    );
    if (!imprimirFolha(titulo, corpo, "portrait")) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up para este site e tente de novo.");
    }
  }

  /**
   * A mesma coisa da folha, só que em planilha.
   *
   * A folha impressa resolve levar papel ao hospital. Não resolve o outro
   * caminho: mandar por e-mail para quem emite a nota. Contador não redigita
   * PDF, e ninguém quer conferir vinte plantões a olho antes de somar.
   *
   * De propósito lê `meus`, e não `daEscala`: a nota é da pessoa. Num grupo,
   * exportar a escala inteira mandaria ao contador o plantão dos colegas.
   */
  function baixarPlanilhaDePlantoes() {
    setErro(""); setAviso("");
    if (meus.length === 0) { setErro("Não há plantão seu neste mês para pôr em planilha."); return; }
    baixarXLSX(nomeDoArquivo("plantoes", mes), planilhaDePlantoes(
      meus.map((p) => ({
        data: p.data, local: ondeFica(p, localPorId, "Local não informado"),
        turno: `${p.hora_inicio.slice(0, 5)} às ${p.hora_fim.slice(0, 5)}`,
        horas: Number(p.horas), valor: Number(p.valor), situacao: p.situacao,
      })),
    ));
  }

  function baixarPlanilhaDeFaturamento(itens: Producao[]) {
    setErro(""); setAviso("");
    if (itens.length === 0) { setErro("Não há anotação neste mês para pôr em planilha."); return; }
    baixarXLSX(nomeDoArquivo("faturamento", mes), planilhaDeFaturamento(
      itens.map((i) => ({
        data: i.data, paciente: i.paciente, convenio: i.convenio,
        procedimento: i.procedimento, valor: Number(i.valor), situacao: i.situacao,
        local: (i.local_id && localPorId.get(i.local_id)) || lugarPeloPlantao(i.plantao_id),
        pagador: i.pagador ?? null,
      })),
    ), `Faturamento ${mes}`);
  }

  /**
   * A lista do mês por operadora, em planilha.
   *
   * A terceira folha impressa ganhou o par que as outras duas já tinham. Ela
   * serve a uma conversa diferente: a nota de plantões responde ao hospital, a
   * de faturamento a quem emite a nota, e esta responde à OPERADORA — é a que
   * se abre ao lado do extrato da Unimed para conferir um lote.
   */
  function baixarPlanilhaPorConvenio(itens: Producao[]) {
    setErro(""); setAviso("");
    if (itens.length === 0) { setErro("Não há anotação neste mês para pôr em planilha."); return; }
    baixarXLSX(nomeDoArquivo("convenios", mes), planilhaPorConvenio(
      itens.map((i) => ({
        data: i.data, paciente: i.paciente, convenio: i.convenio,
        procedimento: i.procedimento, valor: Number(i.valor), situacao: i.situacao,
      })),
    ), `Convênios ${mes}`);
  }

  /**
   * O lugar de um plantão que não é hospital cadastrado.
   *
   * Plantão de fora — sedação em consultório, cobertura particular, hospital
   * que não é do serviço — guarda o lugar como texto livre em `local_texto`,
   * e não aponta para o cadastro. A escala já sabe disso e imprime o texto; a
   * produção não sabia, porque ela só tem `local_id`.
   *
   * Sem esta ponte, o paciente anestesiado num plantão desses saía em "Sem
   * hospital" na folha de faturamento mesmo com o lugar escrito, a uma linha
   * de distância, no plantão de onde ele veio — e a nota do ato sairia sem
   * saber contra quem. O que o plantão sabe, a nota do ato pode usar.
   */
  const lugarPeloPlantao = useCallback((plantaoId: string | null) => {
    if (!plantaoId) return "";
    const p = plantoes.find((x) => x.id === plantaoId);
    return p ? ondeFica(p, localPorId, "") : "";
  }, [plantoes, localPorId]);

  /**
   * A nota de faturamento do mês, por hospital e por quem paga.
   *
   * O nome do hospital vem do cadastro, pelo `local_id` da anotação; faltando
   * ele, vem do plantão de onde o paciente saiu. Anotação sem os dois vai para
   * "Sem hospital" em vez de sumir: um paciente fora de qualquer nota é uma
   * cobrança perdida, e ele precisa aparecer para ser consertado.
   */
  function imprimirFaturamento(itens: Producao[]) {
    setErro(""); setAviso("");
    const { titulo, corpo } = folhaDeFaturamento(
      itens.map((i) => ({
        data: i.data, paciente: i.paciente, convenio: i.convenio,
        procedimento: i.procedimento, valor: Number(i.valor), situacao: i.situacao,
        local: (i.local_id && localPorId.get(i.local_id)) || lugarPeloPlantao(i.plantao_id),
        pagador: i.pagador ?? null,
      })),
      MESES[m - 1], ano, new Date(),
    );
    if (!imprimirFolha(titulo, corpo, "portrait")) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up para este site e tente de novo.");
    }
  }

  /**
   * A escala em papel.
   *
   * Duas folhas diferentes, e não uma com um filtro: a do grupo é a que se
   * prega na parede, e nela não entra valor nenhum — quanto cada um recebe é
   * assunto dele com quem paga, e uma folha na parede do centro cirúrgico é
   * lida por todo mundo que passa. A pessoal é a que vai junto do talão, e essa
   * traz o valor porque é para isso que ela serve.
   */
  /**
   * O fechamento do mês, para o financeiro.
   *
   * Retrato, e não paisagem como a escala: é uma lista de nomes com uma tabela
   * por pessoa, e isso quer folha em pé. E sem o "uma folha só" da escala — o
   * fechamento de doze anestesiologistas ocupa três páginas por natureza, e
   * espremer tudo numa página faria a letra ficar pequena demais para conferir
   * um valor a pagar.
   */
  function imprimirFechamento() {
    setErro(""); setAviso("");
    if (daEscala.length === 0) { setErro("Não há plantão neste mês para fechar."); return; }
    const { titulo, corpo } = folhaDeFechamento(
      daEscala.map((p) => ({
        perfilId: p.perfil_id,
        profissional: nomePorId.get(p.perfil_id) ?? "",
        data: p.data, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim,
        horas: Number(p.horas), valor: Number(p.valor), situacao: p.situacao,
        local: ondeFica(p, localPorId, ""),
        confirmadoEm: p.confirmado_em,
      })),
      MESES[m - 1], ano, new Date(), marcaDe(hospital === "todos" || hospital === "sem" ? null : hospital),
    );
    if (!imprimirFolha(titulo, corpo, "portrait")) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up para este site e tente de novo.");
    }
  }

  /**
   * Confirmar que o plantão aconteceu.
   *
   * O banco recusa confirmar plantão de outra pessoa e plantão do futuro — as
   * duas regras que dão valor ao documento estão lá, e não aqui, porque uma
   * regra que só existe na tela é uma regra que some quando alguém chama a API
   * direto. A tela só evita a tentativa e repete o que o banco disse.
   */
  async function confirmar(plantao: Plantao) {
    setErro(""); setAviso("");
    const { error } = await createClient().from("plantoes")
      .update({ confirmado_em: plantao.confirmado_em ? null : new Date().toISOString() })
      .eq("id", plantao.id);
    if (error) { setErro(error.message || "Não foi possível confirmar o plantão."); return; }
    void carregar();
    onAvisosMudaram?.();
  }

  /**
   * Põe ou tira alguém da fila de nomes da escala.
   *
   * Não cadastra ninguém: a pessoa já tem conta no sistema. São duas perguntas
   * diferentes — estar cadastrado e entrar na escala — e esta tela responde só
   * a segunda. Cadastrar continua sendo em Admin, com convite e e-mail, que é
   * o caminho que deixa a pessoa com login próprio.
   *
   * A troca vale na hora na lista aberta, e o painel é recarregado ao fechar:
   * marcar cinco nomes não pode custar cinco recarregamentos da página.
   */
  async function alternarNaEscala(id: string, entra: boolean) {
    setErro("");
    const { error } = await createClient().rpc("definir_na_escala", {
      p_perfil_id: id, p_na_escala: entra,
    });
    if (error) { setErro(error.message); return false; }
    return true;
  }

  function imprimirEscala() {
    setErro(""); setAviso("");
    if (daEscala.length === 0) { setErro("Não há plantão neste mês para imprimir."); return; }
    // O timbre só entra quando a folha inteira é de uma instituição só. A do
    // grupo já vem filtrada por hospital e cai sempre nesse caso; a pessoal
    // depende do mês — quem rodou três hospitais em agosto recebe a folha sem
    // timbre, porque não existe um lugar que responda pelo papel todo. O
    // `local_texto` do plantão de fora entra na conta com prefixo próprio:
    // sedação em consultório não é o hospital, e sozinha não timbra nada.
    const ondeEsteve = new Set(daEscala.map((p) => p.local_id ?? `fora:${(p.local_texto ?? "").trim()}`));
    const unico = ondeEsteve.size === 1 ? [...ondeEsteve][0] : null;

    const { titulo, corpo } = corpoDaFolha({
      doGrupo: escopo === "grupo",
      mes, nomeMes: MESES[m - 1], ano, diasNoMes, primeiroDiaSemana,
      impressoEm: new Date(),
      instituicao: unico && !unico.startsWith("fora:") ? marcaDe(unico) : null,
      // As cores do papel são as MESMAS da tela, e vêm daqui de propósito.
      // Quem confere a escala está com a folha na parede e o celular na mão:
      // se a folha sorteasse as cores por conta própria, o Matheus verde do
      // calendário sairia roxo no papel, e a cor deixaria de ser atalho para
      // virar mais uma coisa a conferir.
      //
      // As chaves são o texto que a folha escreve na pastilha — nome curto na
      // escala do grupo, nome do hospital na pessoal —, porque é por ele que
      // `corpoDaFolha` procura a cor. O índice é o mesmo `i % 8` que gera as
      // classes med-m1…m8 da tela.
      cores: escopo === "grupo"
        ? new Map(colegas.map((c, i) => [nomeCurto(c.nome), i % CORES_MEDICO.length]))
        : new Map([...locais].sort((a, b) => a.id.localeCompare(b.id))
            .map((l, i) => [nomeDoLocal(l), i % CORES_MEDICO.length])),
      plantoes: daEscala.map((p) => ({
        data: p.data, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim,
        horas: Number(p.horas), valor: Number(p.valor), situacao: p.situacao,
        local: ondeFica(p, localPorId, ""),
        profissional: nomePorId.get(p.perfil_id) ?? "",
      })),
    });
    // Uma folha só, sempre. A escala é pregada na parede: a segunda página com
    // os quatro últimos dias do mês não é pregada por ninguém, e o mês some
    // pela metade.
    if (!imprimirFolha(titulo, corpo, "landscape", true, emCores)) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up para este site e tente de novo.");
    }
  }

  if (carregando) return <div className="emptyClinical">Carregando plantões…</div>;

  return (
    <div className="clinicalMain plantaoMain">
      <section className="clinicalWelcome">
        <div>
          <h1>Escala</h1>
          <p>Seus plantões, o valor de cada turno e as trocas com a equipe.</p>
        </div>
      </section>

      {erro && <p className="clinicalError">{erro}</p>}
      {aviso && <p className="financeSuccess" role="status">{aviso}</p>}

      {/* O olho esconde TUDO, e não só o dinheiro: quantos plantões alguém faz
          no mês é informação de quem faz, e a escala é aberta no corredor do
          centro cirúrgico com gente ao lado. O rótulo do cartão fica — cartão
          em branco não diz o que está escondido, e a pessoa mostra tudo de
          novo só para lembrar o que era. */}
      {mostraMetricas && (() => {
        // Os cartões viram lista para o olho poder morar no ÚLTIMO deles,
        // qualquer que ele seja: na escala do grupo os três de dinheiro não
        // existem, e um botão preso ao "A receber" sumiria junto com eles.
        const cartoes = [
          { chave: "turnos", valor: String(resumo.turnos), rotulo: "Plantões no mês", cor: "" },
          { chave: "horas", valor: `${resumo.horas.toLocaleString("pt-BR")}h`, rotulo: "Horas", cor: "" },
          { chave: "total", valor: money(resumo.total), rotulo: "Total do mês", cor: "blue" },
          { chave: "pago", valor: money(resumo.pago), rotulo: "Recebido", cor: "green" },
          { chave: "aberto", valor: money(resumo.aberto), rotulo: "A receber", cor: "amber" },
        ];
        return (
        <section className="metricGrid plantaoMetrics">
          {cartoes.map((c, i) => (
            <div className="metricCard" key={c.chave}>
              {/* O rótulo fica; só o número some. Cartão em branco não diz o
                  que está escondido, e a pessoa acaba mostrando tudo de novo
                  só para lembrar o que era. */}
              <strong className={c.cor}>{mascara(c.valor)}</strong>
              <span>{c.rotulo}</span>
              {i === cartoes.length - 1 && (
                <OlhoValores oculto={valorOculto} onAlternar={esconderValores} />
              )}
            </div>
          ))}
        </section>
        );
      })()}

      {/* Uma coluna, como no Médico, no Financeiro e no Admin. Antes eram duas
          fileiras de pílulas empilhadas — seção em cima, escopo embaixo —, e
          além de ocuparem duas alturas antes do calendário davam à Escala uma
          navegação diferente da de todas as outras áreas do sistema. */}
      <div className="financeLayout">
        <nav className="financeTarefas" aria-label="Seções da Escala">
          {([
            ["grupo", "Escala"],
            ["minha", "Minha escala"],
            // Uma escala por hospital, cada uma na sua linha. O grupo não tem
            // uma escala: tem a da Santa Casa, a do Hospital da Unimed, a do
            // Instituto. Serviços diferentes, equipes diferentes — e cada uma
            // se lê inteira sem a outra atravessada no meio.
            ["grupo", "Escala do grupo"],
            // O cadeado marca o hospital que a equipe ainda não enxerga. Quem
            // não administra nunca vê este item — o banco não devolve o local —,
            // e quem administra precisa saber qual escala está montando às
            // claras e qual está montando em silêncio.
            ...locaisDaColuna.map((l) =>
              [`grupo:${l.id}`, `${nomeDoLocal(l)}${l.oculto ? " 🔒" : ""}`] as [string, string]),
            // A coluna lista hospitais, e só. Saíram daqui "Todos os
            // hospitais" — a pergunta dele, "onde eu estou este mês?", Minha
            // escala responde melhor, já juntando tudo — e "Sem hospital",
            // que era uma gaveta de conserto ocupando lugar de escala.
            //
            // Plantão sem lugar continua existindo e continua visível em Minha
            // escala, que não filtra por hospital. O que ele não tem mais é
            // linha própria na escala do grupo: uma escala é de um serviço, e
            // "nenhum serviço" não é um deles.
            // Um hospital novo é um cadastro, e cadastro mora no Admin — mas
            // quem descobre que falta um hospital descobre AQUI, olhando esta
            // lista. Mandar procurar sozinho em outra área é onde a pessoa
            // desiste. O item leva ao lugar certo; não duplica o formulário.
            ...(ehAdmin && onNovoLocal
              ? [["novoLocal", "+ Nova escala"] as [string, string]]
              : []),
            ["grupo", "Equipe"],
            ["trocas", "Trocas", trocasParaMim],
            ["grupo", "Faturamento"],
            ["producao", "Produção"],
            // A conta da PESSOA, e não a do serviço. Ela mora aqui, e não no
            // Financeiro, porque o anestesiologista do grupo não tem acesso ao
            // Financeiro — nem deveria: o caixa comum não é assunto dele. O
            // dele é.
            ["meufinanceiro", "Meu financeiro"],
            ["grupo", "Configuração"],
            ["modelos", "Modelos"],
          ] as [string, string, number?][]).map(([id, rotulo, contador], i) =>
            id === "grupo"
              ? <span className="financeTarefaGrupo" key={`g${i}`}>{rotulo}</span>
              : <button
                  type="button" key={id}
                  // O tutorial ancora nesta marca para acender o item enquanto
                  // fala dele. Nome estável, independente do rótulo.
                  data-secao={id}
                  className={id === "novoLocal" ? "escalaNova"
                    : secaoAtiva === id ? "active" : ""}
                  aria-current={secaoAtiva === id ? "true" : undefined}
                  onClick={() => id === "novoLocal" ? onNovoLocal?.() : irPara(id)}
                >
                  <span>{rotulo}</span>
                  {contador ? <b className="financeTarefaContador">{contador}</b> : null}
                </button>,
          )}
        </nav>

        <div className="financeConteudo">
      {aba === "escala" && (
        <>
          <p className="plantaoEscopoNota">{notaDaEscala}</p>

          {/* Quem não aparece para escalar, e por quê.
              Sem esta linha, o coordenador abre a fila de nomes, não encontra
              um colega que trabalha ali todo dia e conclui que a tela está
              quebrada — em vez de ir preencher o CRM que falta. Só para quem
              monta a escala: é ele quem tem onde consertar. */}
          {ehAdmin && escopo === "grupo" && semCRM.length > 0 && (
            <p className="plantaoNota">
              {plural(semCRM.length, "profissional está", "profissionais estão")} fora
              da escala por falta de CRM: <strong>{semCRM.join(", ")}</strong>.
              Preencha em <strong>Admin → Equipe</strong>.
            </p>
          )}
          {/* Fica aqui, e não na barra de ações do calendário, por dois
              motivos. O primeiro é de lugar: quem descobre que falta um nome
              descobre olhando a fila de nomes, e é aqui que ela é discutida. O
              segundo é de largura: aquela barra já tem quatro botões, e um
              quinto a faz quebrar no celular. */}
          {!ehAdmin && escopo === "grupo" && locaisDaColuna.length === 0 && (
            <p className="plantaoNota">
              A escala de um hospital aparece para quem está escalado nele, e você
              ainda não tem plantão em nenhum. Os seus estão em{" "}
              <strong>Minha escala</strong>.
            </p>
          )}
          {ehAdmin && escopo === "grupo" && (
            <p className="plantaoNota plantaoAdicionar">
              <span>
                {plural(escalaveis.length, "profissional na escala", "profissionais na escala")}.
              </span>
              <button type="button" className="outlineClinical"
                onClick={() => setAdicionando(true)}>
                Quem entra na escala
              </button>
            </p>
          )}
          <section className="clinicalPanel">
            {/* A barra fica AQUI, colada no calendário, e não no cabeçalho da
                página. Mudar o mês e lançar um plantão são ações sobre o
                calendário: separadas dele por dois blocos de resumo, a pessoa
                trocava o mês e perdia de vista o que tinha mudado. */}
            <div className="plantaoBarra">
              <div className="plantaoMesNav">
                <button className="outlineClinical" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
                <strong>{MESES[m - 1]} {ano}</strong>
                <button className="outlineClinical" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
                {/* Depois de folhear três meses para trás, voltar é um toque. */}
                {mes !== mesAtual() && (
                  <button className="outlineClinical" onClick={() => setMes(mesAtual())}>Hoje</button>
                )}
              </div>
              <div className="plantaoBarraAcoes">
                {/* Avisar a equipe é um BOTÃO, e não um efeito de lançar
                    plantão. Montar a escala do mês são trinta inserções: um
                    push por linha faria trinta telefones apitarem trinta
                    vezes, e a equipe desligaria a notificação na mesma tarde.
                    Quem monta decide quando a escala está pronta. */}
                {ehAdmin && escopo !== "minha" && (
                  <button className="outlineClinical" disabled={avisando} onClick={() => void avisarEquipe()}
                    title="Toca o telefone de quem tem plantão neste mês">
                    {avisando ? "Avisando..." : "Avisar a equipe"}
                  </button>
                )}
                <button className="outlineClinical" onClick={exportarAgenda}
                  title="Baixa um arquivo .ics: o iPhone abre no Calendário e o Google Agenda importa">
                  Google/Apple
                </button>
                {/* A escolha fica COLADA no botão, e não numa tela de
                    configuração: ela só existe no instante de imprimir, e é
                    ali que se lembra qual é a impressora da sala. Os dois
                    rótulos ficam visíveis o tempo todo — um interruptor que
                    mostra só o estado atual obriga a decifrar se "Colorida"
                    é o que está ligado ou o que o clique vai fazer. */}
                <span className="folhaModo" role="group" aria-label="Como imprimir a escala">
                  <button type="button" className={emCores ? "ativo" : ""}
                    aria-pressed={emCores} onClick={() => guardarModoDaFolha(true)}
                    title="Uma cor por pessoa, como no calendário da tela">Colorida</button>
                  <button type="button" className={emCores ? "" : "ativo"}
                    aria-pressed={!emCores} onClick={() => guardarModoDaFolha(false)}
                    title="Para impressora monocromática: pastilhas brancas com o nome em preto">P&amp;B</button>
                </span>
                <button className="outlineClinical" onClick={imprimirEscala}>Imprimir</button>
                {/* Só para quem monta a escala, e só na visão do grupo. É uma
                    folha de pagamento: traz o nome e o valor de cada colega, e
                    na escala pessoal não haveria "cada colega" nenhum. */}
                {ehAdmin && escopo === "grupo" && (
                  <button className="outlineClinical" onClick={imprimirFechamento}
                    title="Dia, horas e valor de cada profissional no mês, para o financeiro">
                    Fechamento do mês
                  </button>
                )}
                <button className="primaryClinical compact"
                  onClick={() => setLancando({
                    dia: hojeISO.startsWith(mes) ? hojeISO : `${mes}-01`, para: perfilId,
                  })}>
                  + Lançar plantão
                </button>
              </div>
            </div>
            <div className="plantaoCalendario">
              <div className="plantaoSemana">{DIAS.map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="plantaoGrade">
                {Array.from({ length: primeiroDiaSemana }).map((_, i) => <span key={`v${i}`} />)}
                {Array.from({ length: diasNoMes }, (_, i) => {
                  const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
                  const doDia = daEscala.filter((p) => p.data === dia);
                  const fimDeSemana = new Date(`${dia}T12:00:00`).getDay() % 6 === 0;
                  const feriado = feriados.get(dia);

                  // Na escala do grupo o dia sai em três faixas — M, T, N — com
                  // quem cobre cada uma. É como a escala é lida na parede do
                  // hospital: primeiro o turno, depois quem está nele. Só a
                  // letra, porque "Manhã" por extenso três vezes não cabe num
                  // quadrado de calendário, e o nome inteiro está no title.
                  const faixasDia = escopo === "grupo" ? faixasDoDia(dia) : [];
                  // Na escala pessoal a etiqueta é por TURNO, e não por
                  // plantão: o de 24 horas rende duas. O corte em duas
                  // etiquetas passa a valer aqui, e não na contagem de
                  // plantões — senão o "+1" diria que há um plantão escondido
                  // quando o escondido é a metade noturna do mesmo turno.
                  const etiquetasDoDia = escopo === "grupo" ? [] : doDia.flatMap((p) =>
                    partesDoPlantao(p.hora_inicio, p.hora_fim).map((parte) => ({ p, parte })));

                  return (
                    <button
                      type="button" key={dia}
                      className={`plantaoDia${dia === hojeISO ? " hoje" : ""}${fimDeSemana ? " fds" : ""}`
                        + `${feriado ? ` feriado f-${feriado.tipo}` : ""}${diaAberto === dia ? " aberto" : ""}`}
                      onClick={() => setDiaAberto(diaAberto === dia ? null : dia)}
                      title={feriado ? `${feriado.nome}${feriado.tipo === "facultativo" ? " (ponto facultativo)" : ""}` : undefined}
                      // Para quem usa leitor de tela, a pastilha azul do número
                      // não existe: `aria-current="date"` é o que anuncia "hoje".
                      aria-current={dia === hojeISO ? "date" : undefined}
                      aria-label={`${i + 1}${dia === hojeISO ? " — hoje" : ""}${feriado ? ` — ${feriado.nome}` : ""} — ${doDia.length ? plural(doDia.length, "plantão", "plantões") : "sem plantão"}`}
                    >
                      <b>{i + 1}</b>
                      {/* O nome do feriado, e não só uma cor. Cor sozinha diz
                          "tem algo diferente aqui" e obriga a procurar o que é;
                          numa escala o que importa é qual feriado — o plantão
                          de Natal não se negocia como o de Corpus Christi. */}
                      {feriado && <u className="plantaoFeriado">{feriado.nome}</u>}
                      <span className="plantaoEtiquetas">
                        {escopo === "grupo"
                          ? <>
                              {faixasDia.map((f) => (
                                <i key={f.id} className={`plantaoFaixa${f.blocos.length ? "" : " vazia"}`}
                                  title={f.blocos.length
                                    ? `${f.nome} — ` + f.blocos.map((t) =>
                                        `${faixa(t.inicio, t.fim)}`
                                        + `${t.localId ? ` ${localPorId.get(t.localId) ?? ""}` : ""}`
                                        + `: ${t.gente.map((g) => nomePorId.get(g.perfil_id) ?? "").join(", ")}`
                                      ).join(" · ")
                                    : `${f.nome} — ninguém escalado`}>
                                  <b>{f.letra}</b>
                                  <span className="plantaoQuem">
                                    {f.blocos.length === 0 && <em className="plantaoVazio">—</em>}
                                    {f.blocos.map((t) => (
                                      <span key={t.chave} className="plantaoBloco">
                                        {/* O nome do hospital só entra quando a
                                            faixa junta equipes de hospitais
                                            diferentes: sem ele, os nomes das
                                            duas viram uma fileira só e a tela
                                            mostra uma escala que não existe. */}
                                        {f.separarPorLocal && (
                                          <u className="plantaoOnde1">
                                            {t.localId ? localPorId.get(t.localId) ?? "—" : "Sem local"}
                                          </u>
                                        )}
                                        {/* O primeiro nome, e não as iniciais.
                                            "EO" e "MG" só se lê depois de
                                            decorar quem é quem — e quem abre a
                                            escala é justamente quem ainda não
                                            decorou. "Lucas" e "Matheus" se leem
                                            de primeira.

                                            O apelido sobe de degrau sozinho
                                            quando dois se chamam Lucas: vira
                                            "Lucas Q." e "Lucas M.". É a mesma
                                            regra dos botões de lançar plantão,
                                            então o nome no calendário é
                                            exatamente o nome do chip que se
                                            tocou para escalar. */}
                                        {t.gente.slice(0, 3).map((g) => (
                                          <em key={g.id} className={`med-${corPorMedico.get(g.perfil_id) ?? "m8"}${g.perfil_id === perfilId ? " eu" : ""}`}>
                                            {apelidos.get(g.perfil_id) ?? nomeCurto(nomePorId.get(g.perfil_id) ?? "")}
                                          </em>
                                        ))}
                                        {/* Três, e não quatro: nome ocupa cinco
                                            vezes o que duas letras ocupavam, e
                                            o quarto empurrava a faixa para uma
                                            terceira linha na célula. */}
                                        {t.gente.length > 3 && <em className="plantaoMais">+{t.gente.length - 3}</em>}
                                      </span>
                                    ))}
                                  </span>
                                </i>
                              ))}
                            </>
                          : <>
                              {/* Escala pessoal: horário e onde. O lugar é o que
                                  muda de um plantão para outro na agenda de quem
                                  roda três hospitais. */}
                              {/* A cor é do HOSPITAL, e não do modelo do
                                  plantão. O modelo é uma conveniência de quem
                                  lança — quem lança à mão não tem modelo
                                  nenhum, e a etiqueta saía cinza. Na escala
                                  pessoal a pergunta é "onde eu estou hoje?",
                                  então quem manda na cor é o lugar. */}
                              {/* O de 24 horas vira duas etiquetas, Diurno e
                                  Noturno, cada uma com o hospital. São dois
                                  turnos de verdade — quem faz o plantão inteiro
                                  está lá de dia e de noite —, e "07-07h" numa
                                  etiqueta só não se distinguia de um diurno
                                  quando o mês mistura os dois. */}
                              {etiquetasDoDia.slice(0, 2).map(({ p, parte }) => (
                                <i key={`${p.id}-${parte.id}`}
                                  className={`plantaoEtiqueta etqLocal med-${p.local_id ? corPorLocal.get(p.local_id) ?? "m8" : "m8"}`}
                                  title={`${nomeDoPeriodo(p.hora_inicio, p.hora_fim)} · ${faixa(p.hora_inicio, p.hora_fim)}${ondeFica(p, localPorId, "") ? ` · ${ondeFica(p, localPorId, "")}` : ""}`}>
                                  <b>{parte.rotulo}</b>
                                  <span>{ondeFica(p, localPorId)}</span>
                                </i>
                              ))}
                              {etiquetasDoDia.length > 2 && <i className="plantaoMais">+{etiquetasDoDia.length - 2}</i>}
                            </>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* O painel mostra o que ESTA escala mostra, e não a tabela inteira.
              Recebendo `plantoes` cru, ele listava os plantões de todo mundo —
              em Minha escala, num calendário vazio, abrir um dia trazia o
              plantão de um colega em outro hospital, com botão de remover e
              tudo. A escala aberta é a pergunta; o dia aberto é a mesma
              pergunta, num dia só. */}
          {diaAberto && (
            <DiaDetalhe
              dia={diaAberto} plantoes={daEscala.filter((p) => p.data === diaAberto)}
              modelos={modelos} perfilId={perfilId} ehAdmin={ehAdmin}
              pessoal={escopo === "minha"}
              institutionId={institutionId} conveniosConhecidos={conveniosConhecidos}
              colegas={escalaveis} apelidos={apelidos} corPorMedico={corPorMedico}
              nomePorId={nomePorId} localPorId={localPorId}
              onLancar={lancar} onLancarAvulso={(d, p) => setLancando({ dia: d, para: p })}
              onRemover={remover} onPassar={(p) => setPedindoTroca(p)}
              onConfirmar={(p) => void confirmar(p)}
              onFechar={() => setDiaAberto(null)}
            />
          )}

          <section className="clinicalPanel">
            <div className="panelTitle">
              <strong>{escopo === "grupo" ? `Escala da equipe em ${MESES[m - 1]}` : `Meus plantões em ${MESES[m - 1]}`}</strong>
            </div>
            {/* Os nomes das colunas, uma vez só no alto.
                Antes cada linha carregava "Valor" e "Situação" em cima do
                próprio campo: quinze plantões viravam quinze repetições do
                mesmo par de palavras, e cada uma custava uma altura de rótulo.
                Um mês não cabia na tela. Aqui o nome é dito uma vez e a linha
                fica com a altura do campo. */}
            {daEscala.length > 0 && (
              <div className="escalaCabeca" aria-hidden="true">
                <span>Dia</span>
                <span>{escopo === "grupo" ? "Quem" : "Onde"}</span>
                <span>Valor</span>
                <span>Situação</span>
                <span />
              </div>
            )}
            {daEscala.length === 0
              ? <div className="emptyClinical compactEmpty">Nenhum plantão lançado neste mês. Toque num dia do calendário para lançar.</div>
              : daEscala.map((p) => {
                const meu = p.perfil_id === perfilId;
                return (
                /* A gaveta só existe onde apagar tem chance de dar certo: o
                   plantão de fora, que é seu e só seu, e a escala do grupo para
                   quem a monta. Oferecer o gesto numa linha que o banco vai
                   recusar é ensinar um caminho que termina em erro. */
                <LinhaComGaveta
                  key={p.id}
                  podeApagar={(meu && p.privado) || ehAdmin}
                  onApagar={() => void remover(p.id)}
                  descricao={`${Number(p.data.slice(8, 10))}/${p.data.slice(5, 7)}`}
                >
                {/* Grade de colunas fixas, e não flex com quebra. As linhas de
                   colega têm menos controles que as suas, e em flex isso
                   empurrava valor, situação e botão para posições diferentes a
                   cada linha — a lista virava um degrau. Aqui cada coluna tem
                   lugar marcado, ocupado ou não. */}
                <div className="plantaoLinha escalaLinha">
                  <span className="plantaoQuando">
                    <strong>{Number(p.data.slice(8, 10))}/{p.data.slice(5, 7)}</strong>
                    <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)} · {p.horas}h</small>
                  </span>
                  <span className="plantaoOnde">
                    <strong>{escopo === "grupo" ? nomePorId.get(p.perfil_id) ?? "Profissional" : ondeFica(p, localPorId)}</strong>
                    <small>{escopo === "grupo" ? ondeFica(p, localPorId) : null}</small>
                    {p.aberto_para_troca && <small className="plantaoTrocaAviso">oferecido para troca</small>}
                  </span>
                  {/* O valor do colega não é editável nem visível: quanto cada
                      um recebe é assunto dele com quem paga, e a escala não
                      precisa expor isso para funcionar. O RLS recusaria a
                      escrita de qualquer forma; esconder evita a tentativa. */}
                  <span className="plantaoCelula">
                    {meu ? (
                        <input
                          aria-label="Valor do plantão"
                          defaultValue={Number(p.valor) || ""} placeholder="R$ 0,00" inputMode="decimal"
                          onBlur={(e) => {
                            const v = Number(e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
                            if (Number.isFinite(v) && v !== Number(p.valor)) void atualizar(p.id, { valor: v });
                          }}
                        />
                    ) : <span className="plantaoDeColega">de colega</span>}
                  </span>
                  <span className="plantaoCelula">
                    {meu && (
                        /* A data do pagamento anda junto com a situação. Sem
                           isto, "Pago" pelo seletor deixava pago_em vazio e o
                           fechamento do mês não sabia em que mês somar. */
                        <select aria-label="Situação do plantão"
                          value={p.situacao} onChange={(e) => void atualizar(p.id, {
                          situacao: e.target.value,
                          pago_em: e.target.value === "pago"
                            ? p.pago_em ?? hoje()
                            : null,
                        })}>
                          <option value="escalado">Escalado</option>
                          <option value="realizado">Realizado</option>
                          <option value="pago">Pago</option>
                          {/* "Cancelado" some da escala igualzinho a apagar, e
                              some sem ninguém saber. Num plantão do grupo é a
                              mesma regra do Remover: sai passando para um
                              colega. O banco recusa de qualquer forma; tirar a
                              opção evita o erro depois do clique. */}
                          {(p.privado || ehAdmin || p.situacao === "cancelado") && (
                            <option value="cancelado">Cancelado</option>
                          )}
                        </select>
                    )}
                  </span>
                  <span className="plantaoCelula">
                    {/* Plantão privado não se oferece: o colega não o enxerga,
                        não sabe onde fica nem quanto vale, e aceitaria às
                        cegas. Ele se apaga, que é o que faz sentido para um
                        turno que só existe para você. */}
                    {/* Um botão só, e ele acompanha a vida do plantão: antes do
                        dia dá para passar adiante; no dia e depois, o que falta
                        é dizer que aconteceu; confirmado, o que falta é o
                        dinheiro cair. Três botões lado a lado numa linha de
                        celular seriam três alvos de dedo onde cabe um, e dois
                        deles sempre sem sentido para aquele dia.

                        Passar um plantão de ontem não existe, e confirmar o de
                        semana que vem o banco recusa — o botão não oferece nem
                        um nem outro. */}
                    {meu && !p.privado && (
                      <span className="plantaoAcao">
                        {p.data > hojeISO ? (
                          <button className="outlineClinical" onClick={() => setPedindoTroca(p)}>
                            {p.aberto_para_troca ? "Trocar de novo" : "Passar plantão"}
                          </button>
                        ) : !p.confirmado_em ? (
                          podeConfirmar(p, agora) ? (
                            <button className="outlineClinical plantaoConfirmar"
                              title="Confirma que você fez este plantão. É o que o fechamento do mês soma."
                              onClick={() => void confirmar(p)}>
                              Confirmar
                            </button>
                          ) : (
                            /* A janela fechou. Um botão morto aqui só serviria
                               para produzir o erro do banco a cada toque; o
                               selo diz o que aconteceu e por quê. */
                            <span className="statusChip waiting"
                              title="A confirmação era no dia do plantão. Ele continua no fechamento do mês, marcado como não confirmado.">
                              NÃO CONFIRMADO
                            </span>
                          )
                        ) : (
                          <button
                            className={`outlineClinical plantaoRecebido${p.situacao === "pago" ? " sim" : ""}`}
                            aria-pressed={p.situacao === "pago"}
                            title={`Confirmado em ${new Date(p.confirmado_em).toLocaleDateString("pt-BR")}`}
                            onClick={() => void marcarRecebido(p)}>
                            {p.situacao === "pago" ? "Recebido ✓" : "Recebido"}
                          </button>
                        )}
                      </span>
                    )}
                    {/* No lugar onde ficava o Apagar: o que de fato se faz
                        nesta lista todo mês. O plantão de fora é cobrado por
                        quem o fez, e o que ele espera é o dinheiro cair —
                        "recebido" é o único estado que muda depois do turno.
                        Apagar mudou de lugar: arrasta-se a linha para a
                        esquerda. */}
                    {meu && p.privado && (
                      <span className="plantaoAcao">
                        <button
                          className={`outlineClinical plantaoRecebido${p.situacao === "pago" ? " sim" : ""}`}
                          aria-pressed={p.situacao === "pago"}
                          onClick={() => void marcarRecebido(p)}
                        >
                          {p.situacao === "pago" ? "Recebido ✓" : "Recebido"}
                        </button>
                      </span>
                    )}
                  </span>
                </div>
                </LinhaComGaveta>
                );
              })}
          </section>
        </>
      )}

      {aba === "meufinanceiro" && (
        <MeuFinanceiro
          perfilId={perfilId} institutionId={institutionId}
          mes={mes} nomeMes={MESES[m - 1]} ano={ano}
          // Ela busca o ANO inteiro por conta própria: a Escala só carrega o mês
          // aberto, e o gráfico de doze colunas precisa dos outros onze.
          //
          // Tocar numa coluna troca o mês da ESCALA INTEIRA, e não só o do
          // gráfico. É o certo: quem foi ver março no gráfico quer o março da
          // escala também, e dois "mês atual" diferentes na mesma tela seria
          // um jeito garantido de a pessoa ler o número errado.
          onEscolherMes={setMes}
          nomeDoLocalPeloId={(id) => (id && localPorId.get(id)) || ""}
        />
      )}

      {aba === "producao" && (
        <ProducaoDoMes
          mes={mes} nomeMes={MESES[m - 1]} ano={ano}
          locais={locais.map((l) => ({ id: l.id, nome: nomeDoLocal(l) }))}
          lugarPeloPlantao={lugarPeloPlantao} onMudarMes={mudarMes} onEscolherMes={setMes}
          onImprimir={imprimirProducao}
          onImprimirFaturamento={imprimirFaturamento}
          onImprimirPlantoes={imprimirPlantoesParaNota}
          onPlanilhaPlantoes={baixarPlanilhaDePlantoes}
          onPlanilhaFaturamento={baixarPlanilhaDeFaturamento}
          onPlanilhaConvenio={baixarPlanilhaPorConvenio}
        />
      )}

      {aba === "modelos" && (
        <ModelosPainel
          modelos={modelos} locais={locais} perfilId={perfilId}
          institutionId={institutionId} ehAdmin={ehAdmin}
          onMudou={() => { void carregar(); }}
        />
      )}

      {aba === "trocas" && (
        <TrocasPainel
          trocas={trocas} plantoes={[...plantoes, ...plantoesDeTrocas]} perfilId={perfilId}
          nomePorId={nomePorId} localPorId={localPorId} onResponder={responderTroca}
        />
      )}
        </div>
      </div>

      {/* Os modais ficam fora da grade: são sobreposições de tela inteira, e
          dentro da coluna herdariam a largura dela. */}
      {lancando && (
        <LancarPlantao
          dia={lancando.dia} para={lancando.para} locais={locais} modelos={modelos}
          // O hospital cuja escala está aberta já vem escolhido. Quem entrou na
          // escala do FUNDHOSPAR para lançar um plantão do FUNDHOSPAR não
          // deveria ter de dizer isso de novo — e o campo vinha com o primeiro
          // da lista, que é o hospital errado em toda escala menos uma.
          //
          // "todos" e "sem" não são hospitais: nesses dois a escala mistura
          // lugares, e aí não há o que herdar.
          localSugerido={["todos", "sem"].includes(hospitalAtivo) ? "" : hospitalAtivo}
          colegas={escalaveis} apelidos={apelidos} corPorMedico={corPorMedico}
          perfilId={perfilId} ehAdmin={ehAdmin}
          onFechar={() => setLancando(null)} onSalvar={lancarAvulso}
        />
      )}

      {pedindoTroca && (
        <PedirTroca
          plantao={pedindoTroca} colegas={escalaveis.filter((c) => c.id !== perfilId)}
          localPorId={localPorId}
          onFechar={() => setPedindoTroca(null)}
          onEnviar={(destino, msg) => void pedirTroca(pedindoTroca, destino, msg)}
        />
      )}

      {adicionando && (
        <QuemEntraNaEscala
          equipe={equipe}
          onAlternar={alternarNaEscala}
          onFechar={() => { setAdicionando(false); onEquipeMudou?.(); }}
        />
      )}

    </div>
  );
}

function DiaDetalhe({
  dia, plantoes, modelos, colegas, apelidos, corPorMedico,
  perfilId, ehAdmin, pessoal, institutionId, conveniosConhecidos,
  nomePorId, localPorId, onLancar, onLancarAvulso, onRemover, onPassar, onConfirmar, onFechar,
}: {
  dia: string; plantoes: Plantao[]; modelos: Modelo[]; perfilId: string;
  colegas: Colega[]; apelidos: Map<string, string>; corPorMedico: Map<string, string>;
  ehAdmin: boolean; pessoal: boolean;
  institutionId: string; conveniosConhecidos: string[];
  nomePorId: Map<string, string>; localPorId: Map<string, string>;
  onLancar: (dia: string, modelo: Modelo, para: string) => void;
  onLancarAvulso: (dia: string, para: string) => void;
  onRemover: (id: string) => void;
  onPassar: (p: Plantao) => void;
  onConfirmar: (p: Plantao) => void;
  onFechar: () => void;
}) {
  const [d, mm, aa] = [dia.slice(8, 10), dia.slice(5, 7), dia.slice(0, 4)];
  // A anotação se liga ao plantão quando não há dúvida de qual é. Com dois
  // turnos seus no mesmo dia, escolher um por conta própria seria chute.
  const meusDoDia = plantoes.filter((p) => p.perfil_id === perfilId && p.situacao !== "cancelado");
  // O hospital do dia, quando os turnos do dia são todos do mesmo — manhã e
  // noite no mesmo lugar continuam sendo um hospital só. Com dois hospitais no
  // mesmo dia não há resposta certa, e a anotação nasce sem: pôr um por conta
  // própria mandaria o paciente para a nota do hospital errado, e a lista do
  // mês tem o campo para dizer qual é.
  const localUnicoDoDia = (() => {
    const onde = new Set(meusDoDia.map((p) => p.local_id).filter(Boolean));
    return onde.size === 1 ? ([...onde][0] as string) : null;
  })();

  /**
   * Para quem o próximo clique escala.
   *
   * A escala do serviço era montada numa planilha: clicar na célula do dia,
   * abrir a lista, escolher o nome. São dois toques, e é o que se repete
   * quarenta vezes numa tarde de montagem. Aqui é o mesmo gesto — escolher a
   * pessoa, clicar no turno —, e a escolha FICA de pé entre um lançamento e
   * outro, porque quem monta a escala costuma pôr a mesma pessoa em vários
   * dias seguidos.
   *
   * Nasce em "mim" e só existe para quem monta a escala. Sem ser
   * administrador, o único destino possível é você mesmo — e o RLS confirma.
   */
  const [para, setPara] = useState(perfilId);
  // O dia de hoje decide qual botão a sua linha mostra: antes dele, passar
  // adiante; a partir dele, confirmar. O banco recusa confirmar o futuro, e um
  // botão que só existe para dar erro não deve existir.
  const hojeISO = hoje();
  // Na minha escala o destino é sempre eu. A escolha feita na escala do grupo
  // ficava pendurada no componente ao trocar de aba — e o painel do meu dia
  // aparecia escrito "Turno de Lucas", oferecendo lançar para outra pessoa
  // dentro da escala que é só minha.
  const escalaOutro = ehAdmin && !pessoal && para !== perfilId;
  const destino = escalaOutro ? para : perfilId;
  // Quem já está neste dia: escalar duas vezes a mesma pessoa no mesmo turno
  // é o erro mais fácil de cometer clicando rápido, e o banco recusa com um
  // erro seco. Marcado no botão, ele nem chega a ser clicado.
  const jaNoDia = new Set(plantoes.filter((p) => p.situacao !== "cancelado").map((p) => p.perfil_id));

  /**
   * Clicar no dia leva até o dia.
   *
   * O painel sempre abriu logo abaixo do calendário — e um mês de seis
   * semanas tem quase oitocentos pixels de altura, então ele nascia fora da
   * tela. Quem clicava no dia 23 via a página não mudar nada, clicava de novo
   * e fechava o painel que tinha acabado de abrir.
   *
   * O foco vai junto da rolagem, e não só ela: quem usa teclado precisa que o
   * próximo Tab caia dentro do painel que abriu, não de volta no calendário.
   * `preventScroll` porque o scrollIntoView acima já escolheu a posição — sem
   * ele o navegador rola uma segunda vez, e o painel dá um pulo.
   */
  const painel = useRef<HTMLElement>(null);
  useEffect(() => {
    const alvo = painel.current;
    if (!alvo) return;
    const suave = typeof window !== "undefined"
      && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    alvo.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "center" });
    alvo.focus({ preventScroll: true });
  }, [dia]);

  return (
    <section className="clinicalPanel plantaoDetalhe" ref={painel} tabIndex={-1}>
      <div className="panelTitle">
        <strong>{d}/{mm}/{aa}</strong>
        <span>{plantoes.length ? `${plural(plantoes.length, "plantão", "plantões")} na escala` : "nenhum plantão neste dia"}</span>
        <button className="outlineClinical" onClick={onFechar} style={{ marginLeft: "auto" }}>Fechar</button>
      </div>

      {plantoes.map((p) => (
        <div className="plantaoLinha" key={p.id}>
          <span className="plantaoQuando">
            <strong>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)}</strong>
            <small>{p.horas}h</small>
          </span>
          <span className="plantaoOnde">
            <strong>{nomePorId.get(p.perfil_id) ?? "Profissional"}</strong>
            <small>{ondeFica(p, localPorId)}{p.privado ? " · só você vê" : ""}</small>
          </span>
          {/* No SEU plantão, a ação do dia vem primeiro — e ela muda com o
              dia: antes, passar adiante; no dia e depois, confirmar que
              aconteceu. Só o confirmado entra no fechamento do mês, então
              esconder esse botão aqui é esconder o passo que faz a pessoa
              ser paga.

              Havia um defeito nesta escolha: quem administra caía no ramo do
              "Remover" ANTES de qualquer coisa, e nunca via "Passar plantão"
              no próprio turno — justamente quem monta a escala, e mais precisa
              repassar. Agora o poder de administrador entra como botão a mais,
              e não no lugar da ação de quem trabalhou.

              Plantão privado não confirma: ele não entra no fechamento do
              grupo, e confirmar o que ninguém vai pagar é um passo sem fim.

              O plantão do grupo não se apaga — sai passando para um colega que
              aceite, porque quem some de um turno sem avisar deixa o buraco
              para o dia da cirurgia. */}
          {p.perfil_id === perfilId ? (
            <span className="plantaoDetalheAcoes">
              {p.privado ? null : p.data > hojeISO ? (
                <button className="outlineClinical" onClick={() => onPassar(p)}
                  title="Este plantão é da escala do grupo: ele sai da sua escala quando um colega aceitar">
                  {p.aberto_para_troca ? "Trocar de novo" : "Passar plantão"}
                </button>
              ) : p.confirmado_em ? (
                <span className="statusChip present" title={`Confirmado em ${new Date(p.confirmado_em).toLocaleDateString("pt-BR")}`}>
                  CONFIRMADO
                </span>
              ) : podeConfirmar(p, new Date()) ? (
                <button className="outlineClinical plantaoConfirmar" onClick={() => onConfirmar(p)}
                  title="Confirma que você fez este plantão. É o que o fechamento do mês soma.">
                  Confirmar plantão
                </button>
              ) : (
                <span className="statusChip waiting"
                  title="A confirmação era no dia do plantão. Ele continua no fechamento do mês, marcado como não confirmado.">
                  NÃO CONFIRMADO
                </span>
              )}
              {(ehAdmin || p.privado) && (
                <button className="outlineClinical red" onClick={() => onRemover(p.id)}>Remover</button>
              )}
            </span>
          ) : ehAdmin
            ? <button className="outlineClinical red" onClick={() => onRemover(p.id)}>Remover</button>
            : <span className="statusChip paused">de colega</span>}
        </div>
      ))}

      {/* Escolher a pessoa, e só então o turno. A ordem é essa porque é a
          pergunta que se faz montando escala: "quem fica na quinta?" — o
          horário já está decidido antes de abrir o dia.

          Só para quem monta a escala, e só quando há mais de uma pessoa: para
          o anestesista sozinho a fila seria um botão único escrito "Para mim",
          que não escolhe nada. */}
      {ehAdmin && !pessoal && colegas.length > 1 && (
        <div className="plantaoParaQuem">
          <span>Escalar:</span>
          <div className="plantaoFilaNomes" role="group" aria-label="Para quem escalar">
            <button type="button"
              className={`plantaoNomeChip${para === perfilId ? " escolhido" : ""}`}
              aria-pressed={para === perfilId} onClick={() => setPara(perfilId)}>
              Para mim
            </button>
            {colegas.filter((c) => c.id !== perfilId).map((c) => (
              <button type="button" key={c.id}
                className={`plantaoNomeChip med-${corPorMedico.get(c.id) ?? "m8"}`
                  + `${para === c.id ? " escolhido" : ""}${jaNoDia.has(c.id) ? " jaEscalado" : ""}`}
                aria-pressed={para === c.id}
                title={jaNoDia.has(c.id) ? `${c.nome} — já está neste dia` : c.nome}
                onClick={() => setPara(c.id)}>
                {apelidos.get(c.id) ?? c.nome}
                {jaNoDia.has(c.id) && <b aria-hidden="true">✓</b>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="plantaoLancar">
        <span>{escalaOutro
          ? `Turno de ${apelidos.get(destino) ?? "quem você escolheu"}:`
          : "Lançar a partir de um modelo:"}</span>
        {modelos.length === 0
          ? <button className="primaryClinical compact" onClick={() => onLancarAvulso(dia, destino)}>
              + Lançar plantão neste dia
            </button>
          : modelos.map((mo) => (
            <button key={mo.id} className={`plantaoModeloChip cor-${mo.cor}`} onClick={() => onLancar(dia, mo, destino)}>
              <b>{mo.nome}</b>
              {/* O valor do modelo é o SEU. Escalando outra pessoa ele sairia
                  da tela como promessa de pagamento que não foi combinada com
                  ninguém — o plantão dela entra com valor zero, e ela ajusta. */}
              <small>{hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)}{escalaOutro ? "" : ` · ${money(Number(mo.valor))}`}</small>
            </button>
          ))}
        {/* O caminho manual continua inteiro: data, local, horário e para quem,
            tudo à mão. O atalho não substitui o formulário — ele leva a pessoa
            escolhida junto para dentro dele. */}
        {modelos.length > 0 && (
          <button className="outlineClinical" onClick={() => onLancarAvulso(dia, destino)}>
            Outro horário…
          </button>
        )}
      </div>

      {/* O caderninho do dia. Fica aqui, no painel que já abre ao tocar no
          dia, e não numa tela à parte: a anotação é feita no fim do plantão,
          com o jaleco ainda vestido, e cada toque a mais é um paciente que
          deixa de ser anotado.

          Só na escala pessoal. Na do grupo o dia que se abre é o de todo
          mundo, e um caderno de pacientes embaixo dele sugere que se está
          anotando a produção da equipe — quando a lista é, e continua sendo,
          estritamente de quem escreve. */}
      {pessoal && (
        <ProducaoDoDia
          dia={dia} perfilId={perfilId} institutionId={institutionId}
          conveniosConhecidos={conveniosConhecidos}
          plantaoId={meusDoDia.length === 1 ? meusDoDia[0].id : null}
          localId={localUnicoDoDia}
        />
      )}
    </section>
  );
}

function ModelosPainel({
  modelos, locais, perfilId, institutionId, ehAdmin, onMudou,
}: {
  modelos: Modelo[]; locais: LocalDisponivel[]; perfilId: string;
  institutionId: string; ehAdmin: boolean; onMudou: () => void;
}) {
  const vazio = {
    nome: "", local_id: "", hora_inicio: "07:00", hora_fim: "19:00",
    valor: "", cor: "azul", compartilhado: ehAdmin,
  };
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { setErro("Dê um nome ao modelo."); return; }
    setSalvando(true); setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("modelos_plantao").insert({
      institution_id: institutionId,
      owner_id: form.compartilhado && ehAdmin ? null : perfilId,
      nome: form.nome.trim(), local_id: form.local_id || null,
      hora_inicio: form.hora_inicio, hora_fim: form.hora_fim,
      valor: Number(form.valor.replace(/\./g, "").replace(",", ".")) || 0,
      cor: form.cor, created_by: perfilId,
    });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar o modelo."); return; }
    setForm(vazio); onMudou();
  }

  async function apagar(id: string) {
    if (!confirm("Apagar este modelo? Os plantões já lançados continuam.")) return;
    // Modelo da equipe só quem administra apaga, e o RLS recusa o resto. Sem
    // olhar o erro, a recusa voltava calada e o modelo reaparecia na lista sem
    // explicação nenhuma.
    const { error } = await createClient().from("modelos_plantao")
      .update({ ativo: false }).eq("id", id);
    if (error) { setErro(error.message || "Não foi possível apagar o modelo."); return; }
    setErro("");
    onMudou();
  }

  return (
    <section className="clinicalPanel">
      <div className="panelTitle">
        <strong>Modelos de plantão</strong>
        <span>o turno que se repete</span>
      </div>

      {erro && <p className="clinicalError">{erro}</p>}

      <form className="plantaoModeloForm" onSubmit={salvar}>
        <label className="clinicalField wide"><span>Nome *</span>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Pronto-atendimento diurno" /></label>
        <label className="clinicalField"><span>Local</span>
          <select value={form.local_id} onChange={(e) => setForm({ ...form, local_id: e.target.value })}>
            <option value="">Sem local</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
          </select>
          {/* Lista de locais vazia é um beco: a pessoa abre o campo, não acha
              nada e não tem como adivinhar que o cadastro fica em outra tela. */}
          {locais.length === 0 && (
            <small className="campoDica">
              Nenhum local cadastrado ainda. O cadastro fica em{" "}
              <strong>Admin → Organização → Locais de atendimento</strong>.
            </small>
          )}</label>
        <label className="clinicalField"><span>Início</span>
          <input type="time" value={form.hora_inicio}
            onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></label>
        <label className="clinicalField"><span>Fim</span>
          <input type="time" value={form.hora_fim}
            onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></label>
        <label className="clinicalField"><span>Valor</span>
          <input value={form.valor} inputMode="decimal" placeholder="1.100,00"
            onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>

        <div className="plantaoDuracoes">
          <span>Duração rápida:</span>
          {DURACOES.map((h) => (
            <button type="button" key={h} className="outlineClinical"
              onClick={() => setForm({ ...form, hora_fim: somarHoras(form.hora_inicio, h) })}>
              {h}h
            </button>
          ))}
        </div>

        {ehAdmin && (
          <label className="localCompartilhar">
            <input type="checkbox" checked={form.compartilhado}
              onChange={(e) => setForm({ ...form, compartilhado: e.target.checked })} />
            <span><strong>Modelo da equipe</strong>
              <small>Todos poderão usar. Desmarque para deixá-lo só seu.</small></span>
          </label>
        )}

        <button className="primaryClinical compact" disabled={salvando}>
          {salvando ? "Salvando…" : "+ Criar modelo"}
        </button>
      </form>

      {modelos.length === 0
        ? <div className="emptyClinical compactEmpty">Nenhum modelo ainda.</div>
        : modelos.map((mo) => (
          <div className="plantaoLinha" key={mo.id}>
            <span className={`plantaoCor cor-${mo.cor}`} aria-hidden="true" />
            <span className="plantaoOnde">
              <strong>{mo.nome}</strong>
              <small>{hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)}
                {mo.local_id ? ` · ${nomeDoLocal(locais.find((l) => l.id === mo.local_id) ?? { nome: "—" })}` : ""}</small>
            </span>
            <b>{money(Number(mo.valor))}</b>
            {mo.owner_id === null && <span className="statusChip present">da equipe</span>}
            <button className="outlineClinical red" onClick={() => void apagar(mo.id)}>Apagar</button>
          </div>
        ))}
    </section>
  );
}

/**
 * Lançar um plantão sem depender de modelo.
 *
 * O modelo economiza toques em quem já tem rotina; quem está começando não tem
 * nenhum, e sem esta tela o caminho era: adivinhar que existe uma aba Modelos,
 * criar um lá, voltar, clicar no dia. Quatro passos para registrar um turno.
 *
 * Escolher um modelo aqui preenche o resto — continua sendo atalho, e agora
 * também sem ser obrigação.
 */
function LancarPlantao({
  dia, para, locais, modelos, colegas, apelidos, corPorMedico,
  perfilId, ehAdmin, localSugerido, onFechar, onSalvar,
}: {
  dia: string;
  /** Quem já vinha escolhido na fila rápida do painel do dia. */
  para: string;
  locais: LocalDisponivel[];
  /** O hospital da escala aberta. Vazio quando ela mistura lugares. */
  localSugerido: string;
  modelos: Modelo[];
  colegas: Colega[];
  apelidos: Map<string, string>;
  corPorMedico: Map<string, string>;
  perfilId: string;
  ehAdmin: boolean;
  onFechar: () => void;
  onSalvar: (d: {
    data: string; local_id: string; local_texto: string;
    hora_inicio: string; hora_fim: string; valor: number;
    perfil_id: string; privado: boolean;
    /** Devolve o motivo da recusa, ou null quando gravou. */
  }) => Promise<string | null>;
}) {
  // A recusa do banco mostrada AQUI DENTRO. O aviso no topo da página fica
  // atrás do diálogo, e "já tem plantão nesse dia e horário" era escrito num
  // lugar que ninguém via — o botão parecia não fazer nada.
  const [recusa, setRecusa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({
    data: dia,
    // O da escala aberta primeiro; sem ele, o primeiro da lista.
    local_id: localSugerido || locais[0]?.id || "",
    local_texto: "",
    hora_inicio: "07:00", hora_fim: "19:00",
    valor: "", perfil_id: ehAdmin ? para : perfilId, privado: false,
  });
  // Privado é sempre para si: um turno que só a outra pessoa enxerga, lançado
  // por você, é agenda dela. Marcar a chave devolve o destino para você.
  const paraOutro = ehAdmin && !form.privado && form.perfil_id !== perfilId;

  function aplicarModelo(id: string) {
    const mo = modelos.find((x) => x.id === id);
    if (!mo) return;
    setForm({
      ...form, local_id: mo.local_id ?? form.local_id,
      hora_inicio: hhmm(mo.hora_inicio), hora_fim: hhmm(mo.hora_fim),
      valor: String(Number(mo.valor) || ""),
    });
  }

  return (
    <div className="patientModalBackdrop" role="presentation">
      <section className="localModal" role="dialog" aria-modal="true" aria-labelledby="lancar-plantao">
        <div className="patientModalHead">
          <div><h2 id="lancar-plantao">Lançar plantão</h2>
            <p>O valor pode ser ajustado depois, direto na lista.</p></div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          setRecusa(""); setEnviando(true);
          void (async () => {
            const motivo = await onSalvar({
              ...form, valor: Number(form.valor.replace(/\./g, "").replace(",", ".")) || 0,
            });
            setEnviando(false);
            // Quando grava, quem fecha o diálogo é a tela de fora — ela é que
            // sabe se deu certo. Aqui só fica o que impediu.
            if (motivo) setRecusa(motivo);
          })();
        }}>
          {recusa && <p className="clinicalError plantaoRecusa" role="alert">{recusa}</p>}
          {/* Grade única para tudo, inclusive a duração rápida. Antes ela ficava
              fora da grade com grid-column:1/-1 — regra que só vale DENTRO de
              um grid —, e como bloco solto encavalava nos campos de horário. */}
          <div className="plantaoLancarGrade">
            {modelos.length > 0 && (
              <label className="clinicalField span4">
                <span>Usar um modelo (opcional)</span>
                <select defaultValue="" onChange={(e) => aplicarModelo(e.target.value)}>
                  <option value="">Preencher à mão</option>
                  {modelos.map((mo) => (
                    <option key={mo.id} value={mo.id}>
                      {mo.nome} · {hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Para quem vai o plantão — e "só meu" é um destino, não uma
                caixa à parte.

                Antes eram dois controles empilhados: uma caixa de marcar com
                quatro linhas de explicação e, embaixo, a fila de nomes. Duas
                perguntas para uma decisão só, porque plantão privado é sempre
                seu: marcar a caixa e escolher um colega são coisas que não
                podem acontecer juntas. Numa fila só, isso é evidente sem
                nenhum texto — e o que era um bloco de tela virou um toque.

                A fila fica FORA de <label>: dentro dele o clique num chip seria
                repassado ao controle rotulado e mexeria em dois campos. */}
            <div className="plantaoFilaCampo span4">
              <span className="plantaoFilaRotulo" id="para-quem-rapido">Para quem</span>
              <div className="plantaoFilaNomes" role="group" aria-labelledby="para-quem-rapido">
                <button type="button"
                  className={`plantaoNomeChip${!form.privado && form.perfil_id === perfilId ? " escolhido" : ""}`}
                  aria-pressed={!form.privado && form.perfil_id === perfilId}
                  onClick={() => setForm({ ...form, privado: false, perfil_id: perfilId })}>
                  Para mim
                </button>
                {ehAdmin && colegas.filter((c) => c.id !== perfilId).map((c) => (
                  <button type="button" key={c.id} title={c.nome}
                    className={`plantaoNomeChip med-${corPorMedico.get(c.id) ?? "m8"}`
                      + `${!form.privado && form.perfil_id === c.id ? " escolhido" : ""}`}
                    aria-pressed={!form.privado && form.perfil_id === c.id}
                    onClick={() => setForm({ ...form, privado: false, perfil_id: c.id })}>
                    {apelidos.get(c.id) ?? c.nome}
                  </button>
                ))}
                {/* Separado dos colegas por uma barra: não é mais uma pessoa da
                    equipe, é o plantão que não é da equipe. */}
                <span className="plantaoFilaCorte" aria-hidden="true" />
                <button type="button"
                  className={`plantaoNomeChip soMeu${form.privado ? " escolhido" : ""}`}
                  aria-pressed={form.privado}
                  title="Sedação fora, hospital que não é do grupo, cobertura particular. Entra só na sua escala e no seu mês — ninguém do grupo enxerga, nem quem monta a escala."
                  onClick={() => setForm({ ...form, privado: true, perfil_id: perfilId })}>
                  Só meu
                </button>
              </div>
              {/* A lista suspensa só aparece quando a fila vira muro. Com a
                  equipe pequena ela era um segundo campo dizendo o mesmo. */}
              {/* A pergunta de quem monta a escala sozinho pela primeira vez é
                  "onde eu cadastro os médicos?". Uma linha responde; sem ela, a
                  fila com um nome só parece tela quebrada. */}
              {ehAdmin && colegas.length <= 1 && (
                <small className="campoDica">
                  Só você tem CRM cadastrado. Quem você convidar em <strong>Admin →
                  Convidar</strong> aparece aqui assim que o CRM estiver preenchido.
                </small>
              )}
              {ehAdmin && colegas.length > 8 && !form.privado && (
                <label className="clinicalField">
                  <span>Ou pelo nome completo</span>
                  <select value={form.perfil_id}
                    onChange={(e) => setForm({ ...form, privado: false, perfil_id: e.target.value })}>
                    <option value={perfilId}>Para mim</option>
                    {colegas.filter((c) => c.id !== perfilId).map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <label className="clinicalField span2"><span>Data</span>
              <input type="date" value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
            {/* No plantão privado o lugar é escrito à mão, e não escolhido.
                Cadastrar a clínica de endoscopia em "Locais de atendimento"
                resolveria o nome e estragaria o resto: local do cadastro é do
                grupo, vira coluna na escala do grupo e aparece para todo mundo
                — exatamente o oposto de um plantão que só você vê. */}
            {form.privado
              ? <label className="clinicalField span2"><span>Onde</span>
                  <input value={form.local_texto} maxLength={80}
                    placeholder="Clínica de endoscopia, Hospital São José…"
                    onChange={(e) => setForm({ ...form, local_texto: e.target.value })} />
                  <small className="campoDica">Só você vê este nome.</small></label>
              : <>
                  <label className="clinicalField span2"><span>Local</span>
                    <select value={form.local_id} onChange={(e) => setForm({ ...form, local_id: e.target.value })}>
                      {/* "Sem local" era um beco: escolher aquilo produzia um
                          plantão sem lugar nenhum, e a folha impressa dizia
                          "Sem local" num dia em que a pessoa esteve em algum
                          lugar. Agora a mesma opção ABRE um campo para escrever
                          — o hospital que ainda não foi cadastrado, a sedação
                          de sábado, o mutirão. Dizer onde é sempre melhor do
                          que não dizer nada. */}
                      <option value="">Outro lugar — escrever</option>
                      {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
                    </select>
                  </label>
                  {!form.local_id && (
                    <label className="clinicalField span2"><span>Onde, ou o que vai fazer</span>
                      <input value={form.local_texto} maxLength={80} autoFocus
                        placeholder="Hospital São José, mutirão de catarata, sedação…"
                        onChange={(e) => setForm({ ...form, local_texto: e.target.value })} />
                      {/* A lista vazia tinha de dizer onde se cadastra: a
                          pessoa abria o campo, não achava o hospital dela e não
                          tinha como adivinhar que o cadastro era noutra tela.
                          Foi a primeira pergunta de quem usou — e agora ela
                          pode seguir escrevendo, sem parar o lançamento. */}
                      <small className="campoDica">
                        {locais.length === 0
                          ? <>Nenhum local cadastrado ainda. Para o nome virar coluna da escala do grupo,
                              cadastre em <strong>Admin → Organização → Locais de atendimento</strong>.</>
                          : "Aparece na escala e na folha impressa como você escrever."}
                      </small>
                    </label>
                  )}
                </>}
            <label className="clinicalField"><span>Início</span>
              <input type="time" value={form.hora_inicio}
                onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></label>
            <label className="clinicalField"><span>Fim</span>
              <input type="time" value={form.hora_fim}
                onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></label>
            {/* O valor sai da tela quando o plantão é de outra pessoa: quanto
                ela recebe é combinado dela com quem paga, e ela ajusta na
                própria lista. */}
            {!paraOutro && (
              <label className="clinicalField span2"><span>Valor</span>
                <input value={form.valor} inputMode="decimal" placeholder="1.100,00"
                  onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>
            )}

            {/* Sol e lua preenchem os dois horários de uma vez; os números
                mexem só no fim. São coisas diferentes na mesma linha, com uma
                barra entre elas: quase todo plantão é um dos dois turnos
                inteiros, e para esses digitar 07 e depois 19 é trabalho que a
                tela devia poupar. */}
            <div className="plantaoDuracoes">
              <span>Atalhos:</span>
              {TURNOS_RAPIDOS.map((t) => {
                const escolhido = form.hora_inicio === t.inicio && form.hora_fim === t.fim;
                return (
                  <button type="button" key={t.id}
                    className={`outlineClinical${escolhido ? " escolhido" : ""}`}
                    aria-pressed={escolhido}
                    title={`${t.nome} · ${t.inicio}–${t.fim}`}
                    onClick={() => setForm({ ...form, hora_inicio: t.inicio, hora_fim: t.fim })}>
                    {t.icone} {t.nome}
                  </button>
                );
              })}
              <span className="plantaoFilaCorte" aria-hidden="true" />
              {DURACOES.map((h) => (
                <button type="button" key={h} className="outlineClinical"
                  title={`Termina ${h}h depois do início`}
                  onClick={() => setForm({ ...form, hora_fim: somarHoras(form.hora_inicio, h) })}>{h}h</button>
              ))}
            </div>
          </div>

          {paraOutro && (
            <p className="plantaoNota">
              O plantão entra na escala de {colegas.find((c) => c.id === form.perfil_id)?.nome ?? "quem você escolheu"}.
              Ele ajusta o valor e pode pedir troca por lá.
            </p>
          )}

          <div className="modalActions">
            <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
            {/* Desabilitado enquanto grava: dois cliques rápidos mandavam dois
                inserts, e o segundo voltava "já tem plantão nesse dia" — a
                pessoa via um erro causado pelo próprio acerto anterior. */}
            <button type="submit" className="primaryClinical compact"
              disabled={enviando} aria-busy={enviando}>
              {enviando ? "Lançando..." : "Lançar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Pedir troca: para o grupo todo ou para uma pessoa.
 *
 * A diferença não é cosmética. Oferta ao grupo é "alguém cobre?", e o primeiro
 * que aceitar leva. Convite dirigido é "você cobre?", e ninguém além dele pode
 * assumir — é o que faz sentido quando já houve uma combinação por fora e só
 * falta registrar.
 */
function PedirTroca({
  plantao, colegas, localPorId, onFechar, onEnviar,
}: {
  plantao: Plantao;
  colegas: Colega[];
  localPorId: Map<string, string>;
  onFechar: () => void;
  onEnviar: (destinatarioId: string, mensagem: string) => void;
}) {
  const [destino, setDestino] = useState("");
  const [mensagem, setMensagem] = useState("");

  return (
    <div className="patientModalBackdrop" role="presentation">
      <section className="localModal" role="dialog" aria-modal="true" aria-labelledby="pedir-troca">
        <div className="patientModalHead">
          <div>
            <h2 id="pedir-troca">Passar plantão</h2>
            <p>
              {Number(plantao.data.slice(8, 10))}/{plantao.data.slice(5, 7)} ·{" "}
              {hhmm(plantao.hora_inicio)}–{hhmm(plantao.hora_fim)} ·{" "}
              {ondeFica(plantao, localPorId, "sem local")}
            </p>
            {/* Dito antes do envio, e não depois: quem clica aqui está saindo
                de um plantão, e precisa saber que ainda não saiu. */}
            <p className="plantaoNota">
              O plantão continua seu até alguém aceitar. Enquanto ninguém aceitar,
              você segue escalado.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onEnviar(destino, mensagem); }}>
          <fieldset className="plantaoDestino">
            <legend>Para quem?</legend>
            <label className={destino === "" ? "ativo" : ""}>
              <input type="radio" name="destino" checked={destino === ""} onChange={() => setDestino("")} />
              <span>
                <strong>Todo o grupo</strong>
                <small>Qualquer colega pode assumir. O primeiro que aceitar leva.</small>
              </span>
            </label>
            <label className={destino !== "" ? "ativo" : ""}>
              <input type="radio" name="destino" checked={destino !== ""}
                onChange={() => setDestino(colegas[0]?.id ?? "")} />
              <span>
                <strong>Uma pessoa</strong>
                <small>Só ela vê o convite e só ela pode aceitar.</small>
              </span>
            </label>
          </fieldset>

          {destino !== "" && (
            <label className="clinicalField">
              <span>Colega</span>
              <select value={destino} onChange={(e) => setDestino(e.target.value)}>
                {colegas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}

          <label className="clinicalField wide" style={{ marginTop: 14 }}>
            <span>Mensagem (opcional)</span>
            <textarea className="localObs" rows={2} value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Ex.: consigo cobrir o seu do dia 30 em troca" />
          </label>

          <div className="modalActions">
            <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="primaryClinical compact"
              disabled={destino !== "" && colegas.length === 0}>
              Enviar pedido
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * As trocas em aberto, dos dois lados.
 *
 * Separadas como o médico pensa nelas: "o que me pediram" e "o que eu pedi".
 * Juntar as duas numa lista só obrigaria a ler cada linha para descobrir de
 * que lado dela a pessoa está.
 */
function TrocasPainel({
  trocas, plantoes, perfilId, nomePorId, localPorId, onResponder,
}: {
  trocas: Troca[];
  plantoes: Plantao[];
  perfilId: string;
  nomePorId: Map<string, string>;
  localPorId: Map<string, string>;
  onResponder: (id: string, acao: "aceitar_troca" | "recusar_troca" | "cancelar_troca") => void;
}) {
  const plantaoPorId = new Map(plantoes.map((p) => [p.id, p]));
  // Recebidos: o que foi dirigido a mim, mais o que foi aberto ao grupo por
  // outra pessoa. Os meus próprios pedidos nunca entram aqui.
  const recebidos = trocas.filter((t) => t.solicitante_id !== perfilId
    && (t.destinatario_id === null || t.destinatario_id === perfilId));
  const enviados = trocas.filter((t) => t.solicitante_id === perfilId);

  function Linha({ troca, lado }: { troca: Troca; lado: "recebido" | "enviado" }) {
    const p = plantaoPorId.get(troca.plantao_id);
    // SEM O PLANTÃO, A LINHA APARECE ASSIM MESMO.
    //
    // Antes era `return null`: a troca existia, o sino a anunciava, e a seção
    // ficava com o título e um vazio embaixo — nem a linha, nem o "Nenhum
    // pedido no momento", que só aparece quando a lista está de fato vazia. O
    // usuário via um convite no telefone e nenhum lugar para aceitá-lo.
    //
    // Agora isso não deveria acontecer (o plantão da troca é carregado de
    // qualquer mês), e mesmo assim a linha degrada em vez de sumir: some o
    // detalhe, ficam os botões de aceitar e recusar, que são o que a pessoa
    // veio fazer.
    if (!p) {
      return (
        <div className="plantaoLinha">
          <span className="plantaoQuando"><strong>—</strong></span>
          <span className="plantaoOnde">
            <strong>{nomePorId.get(troca.solicitante_id) ?? "Um colega"}</strong>
            <small>Não consegui carregar os dados deste plantão.</small>
          </span>
          {lado === "recebido" ? (
            <>
              <button className="primaryClinical compact"
                onClick={() => onResponder(troca.id, "aceitar_troca")}>Assumir</button>
              <button className="outlineClinical compacto"
                onClick={() => onResponder(troca.id, "recusar_troca")}>Recusar</button>
            </>
          ) : (
            <button className="outlineClinical red"
              onClick={() => onResponder(troca.id, "cancelar_troca")}>Cancelar pedido</button>
          )}
        </div>
      );
    }
    const dirigido = troca.destinatario_id !== null;
    return (
      <div className="plantaoLinha">
        <span className="plantaoQuando">
          <strong>{Number(p.data.slice(8, 10))}/{p.data.slice(5, 7)}</strong>
          <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)} · {p.horas}h</small>
        </span>
        <span className="plantaoOnde">
          <strong>
            {lado === "recebido"
              ? nomePorId.get(troca.solicitante_id) ?? "Colega"
              : dirigido ? `para ${nomePorId.get(troca.destinatario_id!) ?? "colega"}` : "aberto ao grupo"}
          </strong>
          <small>{ondeFica(p, localPorId)}</small>
          {troca.mensagem && <small className="plantaoMensagem">“{troca.mensagem}”</small>}
        </span>
        <span className={`statusChip ${dirigido ? "waiting" : "paused"}`}>
          {dirigido ? "convite" : "aberto ao grupo"}
        </span>
        {lado === "recebido" ? (
          <>
            <button className="primaryClinical compact" onClick={() => onResponder(troca.id, "aceitar_troca")}>
              Assumir
            </button>
            {/* Recusar só existe no convite dirigido: numa oferta aberta, quem
                não quer apenas não assume — e "recusar" apagaria a oferta para
                todos os outros colegas. */}
            {dirigido && (
              <button className="outlineClinical" onClick={() => onResponder(troca.id, "recusar_troca")}>
                Recusar
              </button>
            )}
          </>
        ) : (
          <button className="outlineClinical red" onClick={() => onResponder(troca.id, "cancelar_troca")}>
            Cancelar pedido
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Pedidos recebidos</strong>
        </div>
        {recebidos.length === 0
          ? <div className="emptyClinical compactEmpty">Nenhum pedido no momento.</div>
          : recebidos.map((t) => <Linha key={t.id} troca={t} lado="recebido" />)}
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Trocas que você pediu</strong>
          <span>aguardando alguém assumir</span>
        </div>
        {enviados.length === 0
          ? <div className="emptyClinical compactEmpty">Você não tem pedidos em aberto. Use “Solicitar troca” na Escala.</div>
          : enviados.map((t) => <Linha key={t.id} troca={t} lado="enviado" />)}
      </section>
    </>
  );
}

/**
 * Quem entra na escala.
 *
 * Uma lista de nomes com uma caixa de seleção em cada, e nada mais. Não
 * cadastra e não apaga ninguém: essas duas coisas moram em Admin, e misturá-las
 * aqui daria à janela o poder de excluir alguém sem que a palavra "excluir"
 * apareça na tela.
 *
 * Quem está sem CRM aparece na lista, marcado e desabilitado — e não escondido.
 * Escondido, o coordenador procuraria o colega, não o encontraria e concluiria
 * que o sistema perdeu o cadastro. À vista, ele lê o motivo e sabe onde
 * resolver.
 *
 * A marcação vale na hora, e a página só é recarregada ao fechar: marcar cinco
 * nomes não pode custar cinco recarregamentos.
 */
function QuemEntraNaEscala({
  equipe, onAlternar, onFechar,
}: {
  equipe: { id: string; nome: string; crm: string | null; naEscala: boolean }[];
  onAlternar: (id: string, entra: boolean) => Promise<boolean>;
  onFechar: () => void;
}) {
  const [estado, setEstado] = useState<Record<string, boolean>>(
    () => Object.fromEntries(equipe.map((p) => [p.id, p.naEscala])),
  );
  const [salvando, setSalvando] = useState("");

  async function alternar(id: string, entra: boolean) {
    setSalvando(id);
    const deuCerto = await onAlternar(id, entra);
    setSalvando("");
    if (deuCerto) setEstado((antes) => ({ ...antes, [id]: entra }));
  }

  const dentro = equipe.filter((p) => estado[p.id] && (p.crm ?? "").trim()).length;

  return (
    <div className="patientModalBackdrop" role="presentation">
      <section className="localModal" role="dialog" aria-modal="true" aria-labelledby="quem-escala">
        <div className="patientModalHead">
          <div>
            <h2 id="quem-escala">Quem entra na escala</h2>
            <p>
              Marque quem aparece na fila de nomes quando você monta a escala.
              Desmarcar não apaga o cadastro nem os plantões já lançados.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {equipe.length === 0 ? (
          <p className="plantaoNota">
            Ninguém cadastrado como anestesiologista ainda. O cadastro é em{" "}
            <strong>Admin → Convidar</strong>, com nome, CRM e e-mail.
          </p>
        ) : (
          <ul className="escalaMembros">
            {equipe.map((p) => {
              const semCRM = !(p.crm ?? "").trim();
              return (
                <li key={p.id} className={semCRM ? "semCRM" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(estado[p.id])}
                      disabled={semCRM || salvando === p.id}
                      onChange={(e) => void alternar(p.id, e.target.checked)}
                    />
                    <span>
                      <strong>{p.nome}</strong>
                      <small>
                        {semCRM
                          ? "sem CRM no cadastro — preencha em Admin → Equipe"
                          : `CRM ${p.crm}`}
                      </small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="modalActions">
          <span className="plantaoNota" style={{ marginRight: "auto" }}>
            {plural(dentro, "profissional na escala", "profissionais na escala")}.
          </span>
          <button type="button" className="primaryClinical compact" onClick={onFechar}>
            Pronto
          </button>
        </div>
      </section>
    </div>
  );
}
