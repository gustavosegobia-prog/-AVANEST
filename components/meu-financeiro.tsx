"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { PainelRecolhivel } from "@/components/painel-recolhivel";
import { OlhoValores, useValoresOcultos } from "@/components/olho-valores";
import { dePlantao, deProducao, doMes, somar, type Receita } from "@/lib/receitas";
import {
  CATEGORIAS, NOME_DA_CATEGORIA, porCategoria, recorrentesFaltando,
  resultadoDoMes, somarDespesas, type Despesa,
} from "@/lib/despesas";

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
};

type ProducaoMinha = {
  id: string; perfil_id: string; data: string; paciente: string;
  convenio: string; procedimento: string | null; valor: number; situacao: string;
};

const MES_CURTO = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MES_LONGO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function MeuFinanceiro({
  perfilId, institutionId, mes, nomeMes, ano, nomeDoLocalPeloId,
}: {
  perfilId: string;
  institutionId: string;
  /** AAAA-MM. O mês vem da barra da Escala; não há um seletor a mais aqui. */
  mes: string;
  nomeMes: string;
  ano: number;
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
        .select("id,perfil_id,data,valor,horas,situacao,local_id,local_texto")
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
  const total = somar(doMesAtual);

  // Doze colunas, sempre — inclusive as vazias. Mês sem barra é informação: é o
  // mês de férias, ou o mês em que faltou lançar. Esconder as vazias faria o
  // gráfico parecer cheio e mentir sobre o ano.
  const porMes = MES_CURTO.map((_, i) => {
    const competencia = `${ano}-${String(i + 1).padStart(2, "0")}`;
    return { competencia, indice: i, ...somar(doMes(receitas, competencia)) };
  });
  const teto = Math.max(...porMes.map((m) => m.valor), 1);

  // Horas e R$/h saem SÓ dos plantões: a anestesia avulsa não tem duração
  // registrada, e dividir o faturamento inteiro pelas horas de plantão inflaria
  // o valor da hora sem que nada tivesse mudado no trabalho.
  const plantoesDoMes = plantoes.filter((p) =>
    p.data.slice(0, 7) === mes && p.situacao !== "cancelado" && p.situacao !== "escalado");
  const horas = plantoesDoMes.reduce((s, p) => s + Number(p.horas || 0), 0);
  const valorDosPlantoes = plantoesDoMes.reduce((s, p) => s + Number(p.valor || 0), 0);
  const porHora = horas > 0 ? valorDosPlantoes / horas : null;

  const locais = Object.values(
    plantoesDoMes.reduce<Record<string, {
      nome: string; quantos: number; horas: number; valor: number; recebido: number;
    }>>((acc, p) => {
      const nome = ondeFoi(p);
      const linha = acc[nome] ?? { nome, quantos: 0, horas: 0, valor: 0, recebido: 0 };
      linha.quantos += 1;
      linha.horas += Number(p.horas || 0);
      linha.valor += Number(p.valor || 0);
      if (p.situacao === "pago") linha.recebido += Number(p.valor || 0);
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
            <strong>{nomeMes} de {ano}</strong>
            <small>seus plantões e suas anestesias</small>
          </div>
          <OlhoValores oculto={oculto} onAlternar={alternar} />
        </header>

        <div className="mfNumeros">
          <div className="mfTotal">
            <b>{dinheiro(total.valor)}</b>
            <span>Total</span>
          </div>
          <div><b className="mfVerde">{dinheiro(total.recebido)}</b><span>Recebido</span></div>
          <div><b className={total.aReceber > 0 ? "mfAmbar" : ""}>{dinheiro(total.aReceber)}</b><span>A receber</span></div>
        </div>

        {horas > 0 && <p className="mfHora">
          {horasBR(horas)} de plantão · {dinheiro(porHora ?? 0)}/h em média
        </p>}

        {/* Barras empilhadas: o recebido embaixo, em cor cheia, e o que falta
            receber em cima, apagado. A altura conta o mês e a parte cheia conta
            quanto dele já virou dinheiro — duas leituras numa figura só.

            `role="img"` com a descrição inteira porque um gráfico feito de divs
            é, para o leitor de tela, uma pilha de caixas vazias: sem o rótulo
            ele anuncia nada. */}
        <div className="mfGrafico" role="img"
          aria-label={`Faturamento mês a mês em ${ano}: ${porMes
            .filter((m) => m.valor > 0)
            .map((m) => `${MES_LONGO[m.indice]}, ${dinheiro(m.valor)}`)
            .join("; ") || "nenhum mês com lançamento"}`}>
          {porMes.map((m) => (
            <div className={m.competencia === mes ? "mfColuna atual" : "mfColuna"} key={m.competencia}>
              <div className="mfBarra" title={`${MES_LONGO[m.indice]}: ${dinheiro(m.valor)}`}>
                <i className="mfAReceber" style={{ height: `${(m.aReceber / teto) * 100}%` }} />
                <i className="mfRecebido" style={{ height: `${(m.recebido / teto) * 100}%` }} />
              </div>
              <span>{MES_CURTO[m.indice]}</span>
            </div>
          ))}
        </div>
        <div className="mfLegenda">
          <span><i className="mfRecebido" aria-hidden="true" /> Recebido</span>
          <span><i className="mfAReceber" aria-hidden="true" /> A receber</span>
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
                  <small>{l.quantos} plantã{l.quantos === 1 ? "o" : "es"} · {horasBR(l.horas)}</small>
                </div>
                <b>{dinheiro(l.valor)}</b>
              </header>
              <div className="mfLocalRodape">
                <span>Recebido <em>{dinheiro(l.recebido)}</em></span>
                <span>A receber <em>{dinheiro(Math.max(0, l.valor - l.recebido))}</em></span>
                {l.horas > 0 && <span>{dinheiro(l.valor / l.horas)}/h</span>}
              </div>
            </div>
          ))}
        </section>
      )}

      {total.aReceber > 0 && <p className="financeNota alerta">
        <Icone nome="alerta" tamanho={15} /> {dinheiro(total.aReceber)} de trabalho já feito e ainda não pago. Plantão vira &quot;pago&quot; na Minha escala; anestesia vira &quot;recebido&quot; na Produção.
      </p>}

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
