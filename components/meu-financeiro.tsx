"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { PainelRecolhivel } from "@/components/painel-recolhivel";
import { OlhoValores, useValoresOcultos } from "@/components/olho-valores";
import { dePlantao, deProducao, doMes, somarComAtraso, type Receita } from "@/lib/receitas";
import {
  CATEGORIAS, NOME_DA_CATEGORIA, porCategoria, recorrentesFaltando,
  resultadoDoMes, somarDespesas, type Despesa,
} from "@/lib/despesas";
import { mesEmMaiusculas, plantoesEscrito } from "@/lib/escala";

// A conta de UMA pessoa, mesmo dentro de um grupo.
//
// O Financeiro é do serviço, e quem entra nele é quem administra o caixa
// comum. O anestesiologista do grupo não tem essa permissão — e não deveria
// ter: o caixa do serviço não é assunto dele. Mas a conta DELE é.
//
// Ele já tem tudo aqui do lado: os plantões que fez, as anestesias que anotou.
// Faltava alguém somar, descontar o que ele gasta para trabalhar — anuidade,
// congresso, o carro entre dois hospitais — e dizer quanto sobrou.
//
// TUDO QUE ESTA TELA MOSTRA É DA PRÓPRIA PESSOA, e não por educação: é o que o
// banco devolve. Os plantões são buscados com `perfil_id` igual ao seu; a
// produção tem política `perfil_id = auth.uid()` sem exceção nem para o chefe;
// a despesa pessoal, idem. Não há caminho daqui para o dado de um colega, nem
// por engano de código.
//
// O que NÃO entra: a consulta pré-anestésica. Ela é cobrada pelo serviço, do
// convênio, e aparece no Financeiro do grupo. Somá-la aqui misturaria o que a
// pessoa recebe com o que o serviço fatura — que é a confusão que esta tela
// existe para desfazer.

type PlantaoMeu = {
  id: string; perfil_id: string; data: string; valor: number; horas: number;
  situacao: string; local_id: string | null; local_texto: string | null;
  /** Dia em que a nota saiu. Nulo enquanto ela não sair. */
  faturado_em: string | null;
};

type ProducaoMinha = {
  id: string; perfil_id: string; data: string; paciente: string;
  convenio: string; procedimento: string | null; valor: number; situacao: string;
};

/**
 * As quatro faixas da barra, do topo para o chão.
 *
 * Uma lista só, e não quatro <i> escritos à mão: o gráfico, o balão que aparece
 * ao passar o mouse, o texto que o leitor de tela anuncia e a legenda embaixo
 * têm de dizer a MESMA coisa na MESMA ordem. Escritos separados, um deles fica
 * para trás no dia em que uma faixa mudar — e um balão que anuncia a cor errada
 * é pior do que balão nenhum.
 */
const FAIXAS = [
  /* "Ainda vai acontecer" era MENTIRA em mês que já passou.
     Esta faixa é o plantão em situação "escalado" — na escala, ainda não
     confirmado como feito. Num mês adiante isso de fato ainda vai acontecer;
     num mês passado é um plantão que aconteceu e ninguém confirmou, e a tela
     dizia que estava por vir. Apareceu num julho aberto em setembro: um
     plantão do dia 31/07 anunciado como futuro.
     "Escalado, a confirmar" é verdade nos dois casos — e, no mês passado, diz
     o que falta fazer em vez de esconder. */
  { classe: "mfPrevisto", rotulo: "Escalado, a confirmar",
    valor: (m: { previsto: number }) => m.previsto },
  { classe: "mfAReceber", rotulo: "Feito, a receber",
    valor: (m: { noPrazo: number }) => m.noPrazo },
  /* "+ de 60 dias", e não "Parado há mais de 60 dias": o rótulo longo era a
     linha mais comprida do balão e estourava a caixa pela direita. Curto, ele
     cabe — e o vermelho ao lado já diz que é problema, sem a palavra "parado"
     ter de dizer de novo. */
  { classe: "mfAtrasado", rotulo: "+ de 60 dias",
    valor: (m: { atrasado: number }) => m.atrasado },
  { classe: "mfRecebido", rotulo: "Recebido",
    valor: (m: { recebido: number }) => m.recebido },
] as const;

const MES_CURTO = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function MeuFinanceiro({
  perfilId, institutionId, mes, nomeMes, ano, onEscolherMes, nomeDoLocalPeloId,
}: {
  perfilId: string;
  institutionId: string;
  /** AAAA-MM. O mês vem da barra da Escala; não há um seletor a mais aqui. */
  mes: string;
  nomeMes: string;
  ano: number;
  /**
   * Trocar de mês tocando na coluna do gráfico.
   *
   * Quem olha o gráfico e vê a barra alta de março quer ver março — e o
   * caminho de voltar à barra do mês, rolar a tela até o topo e usar as setas
   * é longo o bastante para a pessoa desistir e ficar só com a impressão.
   * Como a busca é do ANO inteiro, trocar de mês aqui não vai ao banco: os
   * doze meses já estão na memória.
   */
  onEscolherMes: (competencia: string) => void;
  nomeDoLocalPeloId: (id: string | null) => string;
}) {
  /**
   * Os dados carregam JUNTO com o ano a que pertencem.
   *
   * Não há um "carregando" à parte, e isso não é economia de estado: enquanto
   * ele existia, trocar de competência deixava por um instante os números de um
   * período embaixo do cabeçalho de outro. Guardando o ano junto, a tela não
   * consegue mostrar um par errado.
   */
  const [dados, setDados] = useState<{
    ano: number; plantoes: PlantaoMeu[]; producao: ProducaoMinha[]; despesas: Despesa[];
  } | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState("");
  const { oculto, alternar, mascara } = useValoresOcultos();

  /**
   * Só BUSCA. Quem grava é quem chamou.
   *
   * A separação existe para o efeito poder decidir se a resposta ainda vale: a
   * consulta de um ano pode voltar depois da do outro se a rede demorar, e
   * gravar aqui dentro sobrescreveria a tela com o período errado.
   *
   * O ANO INTEIRO, e não o mês: o gráfico de doze colunas é o que mostra a
   * sazonalidade do plantonista — o mês de férias, o mês em que cobriu dois
   * hospitais — e é ele que faz o número de agosto querer dizer alguma coisa.
   */
  const buscar = useCallback(async () => {
    const cliente = createClient();
    const de = `${ano}-01-01`;
    const ate = `${ano}-12-31`;
    const [
      { data: plant, error: erroPlant },
      { data: prod, error: erroProd },
      { data: desp, error: erroDesp },
    ] = await Promise.all([
      cliente.from("plantoes")
        .select("id,perfil_id,data,valor,horas,situacao,local_id,local_texto,faturado_em")
        .eq("perfil_id", perfilId).gte("data", de).lte("data", ate).order("data"),
      cliente.from("producao_do_dia")
        .select("id,perfil_id,data,paciente,convenio,procedimento,valor,situacao")
        .gte("data", de).lte("data", ate).order("data"),
      // As despesas vêm de doze meses PARA TRÁS, e não do ano: o lembrete do
      // que se repete precisa enxergar dezembro passado quando se está em
      // janeiro, senão toda conta fixa pareceria nova no começo do ano.
      cliente.from("despesas")
        .select("id,perfil_id,data,descricao,categoria,valor,recorrente")
        .eq("perfil_id", perfilId).gte("data", `${ano - 1}-01-01`)
        .order("data", { ascending: false }),
    ]);
    // 42P01 = a tabela não existe. Sem esta mensagem o erro cru do Postgres
    // mandaria a pessoa procurar defeito na tela, e não a migração que falta.
    if (erroDesp?.code === "42P01") {
      return { falha: "As despesas ainda não existem no banco. Rode a migração 202608270001_despesas.sql." };
    }
    if (erroPlant || erroProd || erroDesp) {
      return { falha: "Não foi possível carregar os seus números." };
    }
    return {
      pronto: {
        ano,
        plantoes: (plant ?? []) as PlantaoMeu[],
        producao: (prod ?? []) as ProducaoMinha[],
        despesas: (desp ?? []) as Despesa[],
      },
    };
  }, [ano, perfilId]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await buscar();
      // Conferido DEPOIS da resposta, que é onde a conferência serve. Checar
      // antes de começar não protegeria de nada: naquele instante nada mudou.
      if (!vivo) return;
      if (r.falha) { setErro(r.falha); return; }
      setErro("");
      if (r.pronto) setDados(r.pronto);
    })();
    return () => { vivo = false; };
  }, [buscar]);

  /** Recarrega depois de lançar ou apagar. Aqui não há corrida a evitar: a
   *  pessoa acabou de agir nesta tela, neste período. */
  async function recarregar() {
    const r = await buscar();
    if (r.falha) { setErro(r.falha); return; }
    setErro("");
    if (r.pronto) setDados(r.pronto);
  }

  /* ── Dar baixa ────────────────────────────────────────────────────────────
     Marcar que o dinheiro caiu é assunto de FINANCEIRO, e não de escala. A
     escala responde "isto aconteceu?"; o financeiro responde "isto entrou?".
     Estavam no mesmo lugar, e o resultado era procurar o pagamento na tela dos
     turnos — que é onde ninguém vai quando quer conferir um depósito.

     A baixa é POR LOCAL e de vários de uma vez porque é assim que o dinheiro
     chega: o hospital deposita o mês inteiro numa transferência só, e marcar
     treze plantões um a um seria treze toques para um evento só. */
  const [baixaDe, setBaixaDe] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [dataDaBaixa, setDataDaBaixa] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvandoBaixa, setSalvandoBaixa] = useState(false);

  function abrirBaixa(nome: string, pendentes: PlantaoMeu[]) {
    if (baixaDe === nome) { setBaixaDe(null); return; }
    setBaixaDe(nome);
    // Tudo marcado ao abrir: o caso comum é "caiu o mês inteiro deste
    // hospital". Quem recebeu só uma parte desmarca o que não veio, que é o
    // caso raro — e é mais rápido tirar duas do que marcar onze.
    setMarcados(new Set(pendentes.map((p) => p.id)));
    setDataDaBaixa(new Date().toISOString().slice(0, 10));
  }

  const alternarMarcado = (id: string) => setMarcados((antes) => {
    const agora = new Set(antes);
    if (agora.has(id)) agora.delete(id); else agora.add(id);
    return agora;
  });

  /**
   * Move os plantões marcados para o passo seguinte.
   *
   * TRÊS PASSOS, e não dois. O plantão pulava de "realizado" direto para
   * "pago", e com isso o sistema não sabia dizer a única coisa que muda o que
   * fazer a seguir: DE QUEM é a demora. Sem nota emitida, quem deve uma ação é
   * você — o hospital não tem o que pagar enquanto o documento não sai. Com a
   * nota emitida, quem deve é o hospital, e o que resta é cobrar.
   *
   * A DATA VAI JUNTO COM A SITUAÇÃO, e não depois: um plantão "pago" sem
   * `pago_em` é um plantão que o fechamento do mês não consegue somar no mês
   * certo, e uma nota sem `faturado_em` é uma bandeira sem idade — não dá para
   * saber se ela saiu ontem, e aí esperar é normal, ou em julho, e aí o
   * telefonema está atrasado. Quem escolhe a data é quem marca: o dinheiro cai
   * num dia e a pessoa marca noutro.
   */
  async function marcarPlantoes(ids: string[], passo: "faturado" | "pago" | "realizado") {
    if (!ids.length) return;
    setSalvandoBaixa(true);
    setErro("");
    const agora = new Date().toISOString();
    const campos = passo === "pago"
      ? { situacao: "pago", pago_em: dataDaBaixa, updated_at: agora }
      : passo === "faturado"
        // `pago_em` continua nulo: emitir a nota não é receber.
        ? { situacao: "faturado", faturado_em: dataDaBaixa, pago_em: null, updated_at: agora }
        // Desfazer volta ao começo da fila, e limpa as duas datas: um plantão
        // "realizado" que guardasse a data da nota antiga voltaria a parecer
        // faturado no primeiro relatório que olhasse só a coluna.
        : { situacao: "realizado", pago_em: null, faturado_em: null, updated_at: agora };
    const { error } = await createClient().from("plantoes")
      .update(campos)
      .in("id", ids);
    setSalvandoBaixa(false);
    // A mensagem do banco vem inteira: as recusas daqui são regras de escala, e
    // traduzi-las para "não foi possível salvar" esconde o que fazer.
    if (error) { setErro(error.message || "Não foi possível salvar."); return; }
    setBaixaDe(null);
    setMarcados(new Set());
    await recarregar();
  }

  const pronto = dados?.ano === ano;
  const plantoes = pronto ? dados.plantoes : [];
  const producao = pronto ? dados.producao : [];
  const despesas = pronto ? dados.despesas : [];

  // ── As contas ─────────────────────────────────────────────────────────────

  const ondeFoi = (p: PlantaoMeu) =>
    nomeDoLocalPeloId(p.local_id) || p.local_texto || "Plantões sem local";

  const receitas: Receita[] = [
    ...plantoes.map((p) => dePlantao({ ...p, local_nome: ondeFoi(p) })),
    ...producao.map(deProducao),
  ].filter((r): r is Receita => r !== null);

  const doMesAtual = doMes(receitas, mes);
  // A régua do atraso é o dia de hoje, e não o mês aberto: olhar março em
  // setembro tem de mostrar o que está parado desde março, e não o que estava
  // no prazo naquela época.
  const hojeISO = new Date().toISOString().slice(0, 10);
  const total = somarComAtraso(doMesAtual, hojeISO);

  /**
   * O que está escalado e ainda não aconteceu.
   *
   * `dePlantao` deixa o "escalado" de fora, e para o Financeiro do serviço isso
   * está certo: não se conta como faturamento o que ainda pode ser cancelado.
   * Aqui a pergunta é outra — quanto EU vou fazer este mês —, e a escala é o
   * compromisso. Lançar a escala e ver zero é a tela dizendo que o mês não
   * existe.
   *
   * Fica em número próprio, e não somado ao faturado: são coisas diferentes, e
   * juntá-las esconderia quanto do mês já é trabalho feito.
   */
  const escalados = plantoes.filter((p) => p.data.slice(0, 7) === mes && p.situacao === "escalado");
  const previsto = escalados.reduce((s, p) => s + Number(p.valor || 0), 0);

  // Doze colunas, sempre — inclusive as vazias. Mês sem barra é informação: é o
  // mês de férias, ou o mês em que faltou lançar. Esconder as vazias faria o
  // gráfico parecer cheio e mentir sobre o ano.
  const porMes = MES_CURTO.map((_, i) => {
    const competencia = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const feito = somarComAtraso(doMes(receitas, competencia), hojeISO);
    const aFazer = plantoes
      .filter((p) => p.data.slice(0, 7) === competencia && p.situacao === "escalado")
      .reduce((s, p) => s + Number(p.valor || 0), 0);
    return { competencia, indice: i, ...feito, previsto: aFazer };
  });
  // O teto considera o previsto: sem isso, o mês que ainda está todo escalado
  // ficaria com a barra estourando fora da caixa.
  const teto = Math.max(...porMes.map((m) => m.valor + m.previsto), 1);

  // Horas e R$/h saem SÓ dos plantões: a anestesia avulsa não tem duração
  // registrada, e dividir o faturamento inteiro pelas horas de plantão inflaria
  // o valor da hora sem que nada tivesse mudado no trabalho.
  // Escalado ENTRA aqui, e é o que faz a soma dos cartões por local fechar com
  // o total do topo. Fora só o cancelado, que não aconteceu nem vai acontecer.
  const plantoesDoMes = plantoes.filter((p) =>
    p.data.slice(0, 7) === mes && p.situacao !== "cancelado");
  const horas = plantoesDoMes.reduce((s, p) => s + Number(p.horas || 0), 0);
  const valorDosPlantoes = plantoesDoMes.reduce((s, p) => s + Number(p.valor || 0), 0);
  const porHora = horas > 0 ? valorDosPlantoes / horas : null;

  const locais = Object.values(
    plantoesDoMes.reduce<Record<string, {
      nome: string; quantos: number; horas: number; valor: number; recebido: number;
      /** Já tem nota emitida e ainda não caiu. É o número que vira telefonema. */
      comNota: number;
      // Os plantões inteiros, e não só os totais: é deles que a baixa precisa —
      // a pessoa escolhe quais entraram, e não só quanto.
      pendentes: PlantaoMeu[]; pagos: PlantaoMeu[];
    }>>((acc, p) => {
      const nome = ondeFoi(p);
      const linha = acc[nome] ?? { nome, quantos: 0, horas: 0, valor: 0, recebido: 0,
                                   comNota: 0, pendentes: [], pagos: [] };
      linha.quantos += 1;
      linha.horas += Number(p.horas || 0);
      linha.valor += Number(p.valor || 0);
      if (p.situacao === "pago") { linha.recebido += Number(p.valor || 0); linha.pagos.push(p); }
      else {
        linha.pendentes.push(p);
        if (p.situacao === "faturado") linha.comNota += Number(p.valor || 0);
      }
      acc[nome] = linha;
      return acc;
    }, {}),
  ).sort((a, b) => b.valor - a.valor);

  const despesasMes = despesas.filter((d) => d.data.slice(0, 7) === mes);
  const gasto = somarDespesas(despesasMes);
  const categorias = porCategoria(despesasMes);
  const resultado = resultadoDoMes(total.valor, gasto);
  const faltando = recorrentesFaltando(despesas, mes);

  const dinheiro = (v: number) =>
    mascara(Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
  const horasBR = (h: number) => `${h.toFixed(h % 1 ? 1 : 0).replace(".", ",")}h`;

  async function lancar(novo: {
    data: string; descricao: string; categoria: string; valor: number; recorrente: boolean;
  }) {
    setSalvando("nova"); setAviso("");
    const { error } = await createClient().from("despesas").insert({
      institution_id: institutionId, perfil_id: perfilId, created_by: perfilId, ...novo,
    });
    setSalvando("");
    if (error) { setErro(`Não foi possível lançar: ${error.message}`); return false; }
    setErro(""); setAviso("Despesa lançada."); await recarregar(); return true;
  }

  async function apagar(id: string) {
    setSalvando(id);
    const { error } = await createClient().from("despesas").delete().eq("id", id);
    setSalvando("");
    if (error) setErro(`Não foi possível apagar: ${error.message}`);
    else { setAviso(""); await recarregar(); }
  }

  if (!pronto && !erro) return <div className="emptyClinical">Carregando os seus números...</div>;

  return (
    <>
      {erro && <p className="clinicalError">{erro}</p>}
      {aviso && <p className="financeSuccess" role="status">{aviso}</p>}

      {/* O cartão do mês e o ano inteiro na mesma caixa: o número de agosto só
          quer dizer alguma coisa ao lado dos outros onze. */}
      <section className="mfResumo">
        <header className="mfResumoTopo">
          <div>
            <strong>{mesEmMaiusculas(nomeMes)} de {ano}</strong>
            <small>seus plantões e suas anestesias</small>
          </div>
          <OlhoValores oculto={oculto} onAlternar={alternar} />
        </header>

        <div className="mfNumeros">
          <div className="mfTotal">
            {/* O total grande é tudo do mês, escalado incluído: é a resposta de
                "quanto vou fazer em agosto". As três parcelas embaixo dizem em
                que pé está cada pedaço. */}
            <b>{dinheiro(total.valor + previsto)}</b>
            <span>Total do mês</span>
          </div>
          <div><b className="mfVerde">{dinheiro(total.recebido)}</b><span>Recebido</span></div>
          <div><b className={total.noPrazo > 0 ? "mfAmbar" : ""}>{dinheiro(total.noPrazo)}</b><span>Feito, a receber</span></div>
          {/* O ATRASO SÓ APARECE QUANDO EXISTE. Um "R$ 0,00 atrasado" fixo na
              tela é um alarme que nunca toca — e alarme que nunca toca é o que
              se aprende a não olhar. */}
          {total.atrasado > 0 && <div>
            <b className="mfVermelho">{dinheiro(total.atrasado)}</b>
            <span>+ de 60 dias</span>
          </div>}
          {previsto > 0 && <div><b className="mfCinza">{dinheiro(previsto)}</b><span>Escalado, a confirmar</span></div>}
        </div>

        {horas > 0 && <p className="mfHora">
          {horasBR(horas)} de plantão · {dinheiro(porHora ?? 0)}/h em média
        </p>}

        {/* Barras empilhadas, e agora em CORES DE SEMÁFORO em vez de tons de
            azul. O azul esmaecido dizia "isto é menos importante", que não é o
            caso: o que falta receber é a parte que exige alguma coisa de
            alguém. Verde é o que caiu, âmbar é o que falta cair, vermelho é o
            que está parado há tempo demais, e cinza é o que ainda nem
            aconteceu — este último de propósito SEM cor de alerta, porque
            plantão de semana que vem não é problema nenhum, e pintá-lo de
            vermelho faria todo mês futuro parecer atrasado.

            A altura conta o mês e a parte verde conta quanto dele já virou
            dinheiro — duas leituras numa figura só.

            Cada coluna é um BOTÃO, e não uma div: um gráfico feito de divs é,
            para o leitor de tela, uma pilha de caixas vazias, e aqui elas ainda
            por cima fazem coisa quando tocadas. Como botão, cada mês anuncia o
            próprio nome e valor, entra na navegação por teclado e diz qual está
            escolhido pelo `aria-pressed`. */}
        <div className="mfGrafico">
          {porMes.map((m) => (
            <button
              type="button"
              key={m.competencia}
              className={m.competencia === mes ? "mfColuna atual" : "mfColuna"}
              aria-pressed={m.competencia === mes}
              aria-label={[
                `${MES_LONGO[m.indice]}: ${m.valor + m.previsto > 0
                  ? dinheiro(m.valor + m.previsto) : "sem lançamento"}`,
                // O leitor de tela recebe a MESMA divisão que o mouse recebe no
                // balão. Sem isto, quem navega por teclado ouvia só o total e
                // as quatro cores não diziam nada — que é justamente a
                // informação que elas existem para dar.
                ...FAIXAS.map((f) => f.valor(m) > 0
                  ? `${f.rotulo}: ${dinheiro(f.valor(m))}` : "").filter(Boolean),
              ].join(", ")}

              onClick={() => onEscolherMes(m.competencia)}
            >
              {/* De cima para baixo: o que ainda vai acontecer, o que falta
                  receber, o que está parado demais, e o que já está na conta.
                  O vermelho fica encostado no verde de propósito — é ali que a
                  comparação "quanto caiu contra quanto empacou" se faz sem o
                  olho ter de pular por cima de outra faixa. */}
              <span className="mfBarra">
                {/* CADA FAIXA DIZ QUANTO ELA VALE ao passar o mouse, e não só a
                    coluna inteira. A cor sozinha responde "tem algo aqui" e
                    obriga a ir procurar o número em outro lugar — que é o
                    contrário do que ela serve.

                    O `title` no <i> vence o do <button>: o navegador mostra o
                    do elemento mais interno sob o ponteiro. Fora da faixa, sobra
                    o do mês inteiro, que continua sendo a resposta certa ali. */}
                {FAIXAS.map((f) => (
                  <i key={f.classe} className={f.classe}
                    style={{ height: `${(f.valor(m) / teto) * 100}%` }} />
                ))}
              </span>
              <span className="mfMes">{MES_CURTO[m.indice]}</span>

              {/* O BALÃO É NOSSO, e não o do navegador.
                  Com o `title` nativo, cada faixa dizia o próprio valor — e
                  numa coluna onde o recebido são seis pixels, acertar o mouse
                  neles é exercício de pontaria. Aqui a coluna INTEIRA é o alvo,
                  e o balão traz as quatro linhas de uma vez, que também é como
                  se lê melhor: o mês é a soma das partes, e vê-las juntas
                  responde "quanto caiu contra quanto empacou" sem passear com
                  o mouse.

                  `aria-hidden` porque o mesmo conteúdo já está no `aria-label`
                  do botão. Sem isto, o leitor de tela anunciaria tudo duas
                  vezes. */}
              <span className="mfBalao" aria-hidden="true">
                <b>{MES_LONGO[m.indice]}</b>
                <strong>{m.valor + m.previsto > 0
                  ? dinheiro(m.valor + m.previsto) : "sem lançamento"}</strong>
                {[...FAIXAS].reverse().filter((f) => f.valor(m) > 0).map((f) => (
                  <span key={f.classe}>
                    <i className={f.classe} />
                    {f.rotulo}
                    <em>{dinheiro(f.valor(m))}</em>
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
        {/* A legenda sai da MESMA lista que desenha as barras, só que de baixo
            para cima — é a ordem em que a coluna se lê. Escrita à mão, ela
            ficaria para trás no dia em que uma faixa mudasse de nome ou de cor,
            e uma legenda que nomeia errado é pior do que legenda nenhuma.

            Cada faixa só entra quando existe no gráfico: explicar uma cor que
            não está desenhada em lugar nenhum é ensinar a procurar o que não
            há. */}
        <div className="mfLegenda">
          {[...FAIXAS].reverse()
            .filter((f) => porMes.some((m) => f.valor(m) > 0))
            .map((f) => (
              <span key={f.classe}>
                <i className={f.classe} aria-hidden="true" /> {f.rotulo}
              </span>
            ))}
        </div>
      </section>

      {locais.length > 0 && (
        <section className="mfLocais">
          <h3>Plantões por local</h3>
          {locais.map((l) => (
            <div className="mfLocal" key={l.nome}>
              <header>
                <span className="mfLocalMarca" aria-hidden="true">{l.nome.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{l.nome}</strong>
                  {/* A contagem sai das HORAS: plantão é 12h, o de 24 conta por
                      dois e dois de 6 contam por um. Mesma regra do fechamento
                      e das folhas de nota — a tela e o papel não podem dizer
                      números diferentes sobre o mesmo mês. */}
                  <small>{plantoesEscrito(l.horas)} · {horasBR(l.horas)}</small>
                </div>
                <b>{dinheiro(l.valor)}</b>
              </header>
              <div className="mfLocalRodape">
                <span>Recebido <em>{dinheiro(l.recebido)}</em></span>
                <span>A receber <em>{dinheiro(Math.max(0, l.valor - l.recebido))}</em></span>
                {/* SÓ QUANDO EXISTE. Um "Com nota R$ 0,00" fixo é um número que
                    nunca muda, e número que nunca muda a pessoa aprende a não
                    ler — inclusive no mês em que ele importar. */}
                {l.comNota > 0 && (
                  <span>Com nota <em className="mfComNota">{dinheiro(l.comNota)}</em></span>
                )}
                {l.horas > 0 && <span>{dinheiro(l.valor / l.horas)}/h</span>}
                {l.pendentes.length > 0 && (
                  <button type="button" className="mfBaixaAbrir"
                    aria-expanded={baixaDe === l.nome}
                    onClick={() => abrirBaixa(l.nome, l.pendentes)}>
                    {baixaDe === l.nome ? "Fechar" : "Dar baixa"}
                  </button>
                )}
              </div>

              {baixaDe === l.nome && (
                <div className="mfBaixa">
                  {/* A data primeiro: ela vale para todos os que forem marcados,
                      e descobrir isso depois de escolher os plantões faria
                      voltar.

                      O rótulo é neutro porque ela agora serve aos dois botões
                      — o dia em que a nota saiu, ou o dia em que o dinheiro
                      caiu. Deixá-lo como "Caiu em" faria quem vem emitir nota
                      preencher a data errada sem perceber. */}
                  <label className="mfBaixaData">
                    <span>Data</span>
                    <input type="date" value={dataDaBaixa}
                      onChange={(e) => setDataDaBaixa(e.target.value)} />
                    <small>o dia da nota, ou o dia em que o dinheiro caiu</small>
                  </label>

                  <ul className="mfBaixaLista">
                    {l.pendentes.map((p) => (
                      <li key={p.id}>
                        <label>
                          <input type="checkbox" checked={marcados.has(p.id)}
                            onChange={() => alternarMarcado(p.id)} />
                          <span>{dataBR(p.data)}</span>
                          <small>{horasBR(Number(p.horas || 0))}</small>
                          {/* O que já tem nota diz desde quando. Sem a data, a
                              marca só responde "já emiti"; com ela responde
                              "emiti e faz dois meses", que é a pergunta cuja
                              resposta gera o telefonema. */}
                          {p.situacao === "faturado" && (
                            <i className="mfNota">
                              nota {p.faturado_em ? `de ${dataBR(p.faturado_em)}` : "emitida"}
                            </i>
                          )}
                          <b>{dinheiro(Number(p.valor || 0))}</b>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <div className="mfBaixaAcoes">
                    <button type="button" className="outlineClinical"
                      onClick={() => setMarcados(marcados.size === l.pendentes.length
                        ? new Set()
                        : new Set(l.pendentes.map((p) => p.id)))}>
                      {marcados.size === l.pendentes.length ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                    {/* DOIS BOTÕES, e a ordem é a da vida: primeiro sai a
                        nota, depois cai o dinheiro. "Emiti a nota" fica em
                        segundo plano de propósito — é o passo do meio, e o
                        botão cheio pertence ao que fecha a conta. */}
                    <button type="button" className="outlineClinical"
                      disabled={salvandoBaixa || marcados.size === 0}
                      onClick={() => void marcarPlantoes([...marcados], "faturado")}>
                      {salvandoBaixa ? "Salvando…" : "Emiti a nota"}
                    </button>
                    <button type="button" className="primaryClinical"
                      disabled={salvandoBaixa || marcados.size === 0}
                      onClick={() => void marcarPlantoes([...marcados], "pago")}>
                      {salvandoBaixa ? "Salvando…" : `Recebi ${dinheiro(
                        l.pendentes.filter((p) => marcados.has(p.id))
                          .reduce((s, p) => s + Number(p.valor || 0), 0))}`}
                    </button>
                  </div>

                  {/* Desfazer fica ao lado do que foi feito, e não escondido:
                      quem marca o mês de enfiada erra uma linha, e a correção
                      não pode exigir procurar onde desmarcar. */}
                  {l.pagos.length > 0 && (
                    <details className="mfBaixaDesfazer">
                      <summary>{l.pagos.length === 1
                        ? "1 plantão já recebido"
                        : `${l.pagos.length} plantões já recebidos`}</summary>
                      <ul className="mfBaixaLista">
                        {l.pagos.map((p) => (
                          <li key={p.id}>
                            <span>{dataBR(p.data)}</span>
                            <small>{horasBR(Number(p.horas || 0))}</small>
                            <b>{dinheiro(Number(p.valor || 0))}</b>
                            <button type="button" className="mfBaixaVolta"
                              disabled={salvandoBaixa}
                              onClick={() => void marcarPlantoes([p.id], "realizado")}>Desfazer</button>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* AQUI HAVIA UM AVISO explicando o que era o "a receber" e onde dar
          baixa. Ele saiu: o gráfico agora diz a mesma coisa em cor — verde é o
          que caiu, âmbar é o que falta cair, vermelho é o que está demorando
          demais —, e a ação está a um palmo dali, no rodapé de cada hospital.
          Uma faixa de texto para explicar o que já se lê de relance é ruído
          entre a pessoa e o que ela veio fazer. */}

      {/* As despesas ficam depois: o plantonista abre esta tela para ver quanto
          fez, e é isso que aparece primeiro. O que ele gasta vem em seguida, e
          o "sobrou" fecha a conta. */}
      <section className="metricGrid financeMetrics mfSaldo">
        <div className="metricCard"><strong className="red">{dinheiro(gasto)}</strong>
          <span>Suas despesas em {nomeMes}</span></div>
        <div className="metricCard">
          <strong className={resultado.resultado < 0 ? "red" : "green"}>{dinheiro(resultado.resultado)}</strong>
          <span>{resultado.margem === null ? "Sobrou" : `Sobrou — ${resultado.margem.toFixed(0)}% do que faturou`}</span>
        </div>
      </section>

      {faltando.length > 0 && <PainelRecolhivel chave="meu-recorrentes" abrePadrao
        titulo="Suas contas que se repetem e ainda não foram lançadas" legenda="o sistema lembra; quem lança é você">
        {faltando.map((d) => <div className="financeSetupRow" key={d.id}>
          <span><strong>{d.descricao}</strong><small>{NOME_DA_CATEGORIA.get(d.categoria as never) ?? "Outra"} · último valor {dinheiro(Number(d.valor))} em {dataBR(d.data)}</small></span>
          <button className="outlineClinical" disabled={salvando === "nova"}
            onClick={() => void lancar({ data: `${mes}-05`, descricao: d.descricao, categoria: d.categoria, valor: Number(d.valor), recorrente: true })}>
            Lançar {dinheiro(Number(d.valor))}
          </button>
        </div>)}
      </PainelRecolhivel>}

      <NovaDespesaPessoal key={mes} mes={mes} ocupado={salvando === "nova"} onLancar={lancar} />

      <PainelRecolhivel chave="meu-despesas" titulo="Suas despesas do mês"
        legenda={`${despesasMes.length} lançamento(s) — só você enxerga`} extra={<b>{dinheiro(gasto)}</b>}>
        {despesasMes.length === 0
          ? <div className="emptyClinical compactEmpty">Nenhuma despesa sua neste mês.</div>
          : despesasMes.map((d) => <div className="financeItemRow despesaLinha" key={d.id}>
              <div><strong>{d.descricao}</strong>
                <small>{dataBR(d.data)} · {NOME_DA_CATEGORIA.get(d.categoria as never) ?? "Outra"}{d.recorrente ? " · repete todo mês" : ""}</small></div>
              <b className="despesaValor">{dinheiro(Number(d.valor))}</b>
              <button className="outlineClinical red" disabled={salvando === d.id}
                onClick={() => void apagar(d.id)}>Apagar</button>
            </div>)}
        {categorias.length > 1 && <div className="financeTabelaRolavel">
          <table className="financeTabela">
            <thead><tr><th>Categoria</th><th className="num">Valor</th><th className="num">Fatia</th></tr></thead>
            <tbody>{categorias.map((c) => <tr key={c.id}>
              <td>{c.nome}</td><td className="num">{dinheiro(c.valor)}</td>
              <td className="num">{c.fatia === null ? "—" : `${c.fatia.toFixed(1).replace(".", ",")}%`}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </PainelRecolhivel>
    </>
  );
}

/**
 * Lançar uma despesa sua.
 *
 * Sem a escolha "minha ou do serviço" que existe no Financeiro do grupo: aqui
 * toda despesa é da pessoa, por definição. Oferecer a opção sugeriria que dá
 * para lançar no caixa comum daqui, e o banco recusaria — um botão que promete
 * o que não cumpre é pior que um botão a menos.
 *
 * `key={mes}` na chamada remonta o formulário quando a competência muda, e com
 * isso a data volta sozinha para o mês que está na tela.
 */
function NovaDespesaPessoal({ mes, ocupado, onLancar }: {
  mes: string; ocupado: boolean;
  onLancar: (d: { data: string; descricao: string; categoria: string; valor: number; recorrente: boolean }) => Promise<boolean>;
}) {
  const [data, setData] = useState(`${mes}-05`);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("formacao");
  const [valor, setValor] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = descricao.trim();
    if (!texto) { setErro("Escreva do que é a despesa."); return; }
    const numero = Number(valor.replace(/\s|R\$/gi, "").replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) { setErro("Informe um valor maior que zero."); return; }
    setErro("");
    if (await onLancar({ data, descricao: texto, categoria, valor: numero, recorrente })) {
      setDescricao(""); setValor(""); setRecorrente(false);
    }
  }

  return <PainelRecolhivel chave="meu-nova-despesa" titulo="Lançar uma despesa sua"
    legenda="anuidade, congresso, combustível entre hospitais — o que você gasta para trabalhar">
    <form className="despesaForm" onSubmit={enviar}>
      <label><span>Data</span>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></label>
      <label className="despesaDescricao"><span>Do que é</span>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="Anuidade do CRM, congresso, combustível..." required /></label>
      <label><span>Categoria</span>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select></label>
      <label><span>Valor</span>
        <input value={valor} onChange={(e) => setValor(e.target.value)}
          placeholder="R$ 0,00" inputMode="decimal" required /></label>
      <label className="despesaCheck">
        <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
        <span>Repete todo mês</span></label>
      <button className="primaryClinical compact" type="submit" disabled={ocupado}>
        {ocupado ? "Lançando..." : "Lançar"}
      </button>
    </form>
    {erro && <p className="clinicalError">{erro}</p>}
    <p className="financeNota">{CATEGORIAS.find((c) => c.id === categoria)?.exemplo}</p>
  </PainelRecolhivel>;
}
