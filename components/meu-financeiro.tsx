"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { PainelRecolhivel } from "@/components/painel-recolhivel";
import { OlhoValores, useValoresOcultos } from "@/components/olho-valores";
import {
  dePlantao, deProducao, doMes, porOrigem, somar,
  type PlantaoBruto, type Receita,
} from "@/lib/receitas";
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
// banco devolve. Os plantões vêm filtrados por `perfil_id` pela tela que chama;
// a produção tem política `perfil_id = auth.uid()` sem exceção nem para o
// chefe; a despesa pessoal, idem. Não há caminho daqui para o dado de um
// colega, nem por engano de código.
//
// O que NÃO entra: a consulta pré-anestésica. Ela é cobrada pelo serviço, do
// convênio, e aparece no Financeiro do grupo. Somá-la aqui misturaria o que a
// pessoa recebe com o que o serviço fatura — que é a confusão que esta tela
// existe para desfazer.

type ProducaoMinha = {
  id: string; perfil_id: string; data: string; paciente: string;
  convenio: string; procedimento: string | null; valor: number; situacao: string;
};

export function MeuFinanceiro({
  perfilId, institutionId, mes, nomeMes, ano, meusPlantoes, nomeDoLocalPeloId,
}: {
  perfilId: string;
  institutionId: string;
  /** AAAA-MM. */
  mes: string;
  nomeMes: string;
  ano: number;
  /** Já filtrados pela pessoa e sem os cancelados, pela tela que chama. */
  meusPlantoes: PlantaoBruto[];
  nomeDoLocalPeloId: (id: string | null) => string;
}) {
  /**
   * Os dados carregam JUNTO com o mês a que pertencem.
   *
   * Não há um "carregando" à parte, e isso não é economia de estado: enquanto
   * ele existia, trocar de competência deixava por um instante os números de
   * julho embaixo do cabeçalho de agosto. Guardando o mês junto, a tela não
   * consegue mostrar um par errado — ou os dados são deste mês, ou ela ainda
   * está carregando.
   */
  const [dados, setDados] = useState<{
    mes: string; producao: ProducaoMinha[]; despesas: Despesa[];
  } | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState("");
  const { oculto, alternar, mascara } = useValoresOcultos();

  /**
   * Só BUSCA. Quem grava é quem chamou.
   *
   * A separação existe para o efeito poder decidir se a resposta ainda vale: a
   * consulta de julho pode voltar depois da de agosto se a rede demorar, e
   * gravar ali dentro sobrescreveria a tela com o mês errado. De quebra, a
   * função fica sem estado e o efeito fica com uma responsabilidade só.
   */
  const buscar = useCallback(async () => {
    const cliente = createClient();
    // Doze meses de despesa porque o lembrete do que se repete olha o
    // histórico; a produção só precisa do mês que está na tela.
    const doze = new Date();
    doze.setMonth(doze.getMonth() - 12);
    const desde = doze.toISOString().slice(0, 10);
    const [{ data: prod, error: erroProd }, { data: desp, error: erroDesp }] = await Promise.all([
      cliente.from("producao_do_dia")
        .select("id,perfil_id,data,paciente,convenio,procedimento,valor,situacao")
        .gte("data", `${mes}-01`).lte("data", `${mes}-31`).order("data"),
      cliente.from("despesas")
        .select("id,perfil_id,data,descricao,categoria,valor,recorrente")
        .eq("perfil_id", perfilId).gte("data", desde).order("data", { ascending: false }),
    ]);
    // 42P01 = a tabela não existe. Sem esta mensagem o erro cru do Postgres
    // mandaria a pessoa procurar defeito na tela, e não a migração que falta.
    if (erroDesp?.code === "42P01") {
      return { falha: "As despesas ainda não existem no banco. Rode a migração 202608270001_despesas.sql." };
    }
    if (erroProd || erroDesp) return { falha: "Não foi possível carregar os seus números." };
    return {
      pronto: {
        mes,
        producao: (prod ?? []) as ProducaoMinha[],
        despesas: (desp ?? []) as Despesa[],
      },
    };
  }, [mes, perfilId]);

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
   *  pessoa acabou de agir nesta tela, neste mês. */
  async function recarregar() {
    const r = await buscar();
    if (r.falha) { setErro(r.falha); return; }
    setErro("");
    if (r.pronto) setDados(r.pronto);
  }

  const pronto = dados?.mes === mes;
  const producao = pronto ? dados.producao : [];
  const despesas = pronto ? dados.despesas : [];

  // ── As contas ─────────────────────────────────────────────────────────────

  const receitas: Receita[] = [
    ...meusPlantoes.map((p) => dePlantao({ ...p, local_nome: nomeDoLocalPeloId(p.local_id ?? null) })),
    ...producao.map(deProducao),
  ].filter((r): r is Receita => r !== null);

  const doMesAtual = doMes(receitas, mes);
  const total = somar(doMesAtual);
  const origens = porOrigem(doMesAtual).filter((o) => o.origem !== "consulta");

  const despesasMes = despesas.filter((d) => d.data.slice(0, 7) === mes);
  const gasto = somarDespesas(despesasMes);
  const categorias = porCategoria(despesasMes);
  const resultado = resultadoDoMes(total.valor, gasto);
  const faltando = recorrentesFaltando(despesas, mes);

  const dinheiro = (v: number) =>
    mascara(Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

  async function lancar(dados: {
    data: string; descricao: string; categoria: string; valor: number; recorrente: boolean;
  }) {
    setSalvando("nova"); setAviso("");
    const { error } = await createClient().from("despesas").insert({
      institution_id: institutionId, perfil_id: perfilId, created_by: perfilId, ...dados,
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

      <section className="metricGrid financeMetrics">
        <MoedaCartao valor={total.valor} rotulo={`Seu faturamento em ${nomeMes} de ${ano}`} tom="blue" formatar={dinheiro} />
        <MoedaCartao valor={total.recebido} rotulo="Já recebeu" tom="green" formatar={dinheiro} />
        <MoedaCartao valor={total.aReceber} rotulo="Ainda a receber" tom={total.aReceber > 0 ? "amber" : "green"} formatar={dinheiro} />
        <MoedaCartao valor={gasto} rotulo="Suas despesas" tom="red" formatar={dinheiro} />
        <MoedaCartao valor={resultado.resultado} rotulo={resultado.margem === null
          ? "Sobrou" : `Sobrou — ${resultado.margem.toFixed(0)}% do que faturou`}
          tom={resultado.resultado < 0 ? "red" : "green"} formatar={dinheiro}
          extra={<OlhoValores oculto={oculto} onAlternar={alternar} />} />
      </section>

      <PainelRecolhivel chave="meu-origem" titulo="De onde veio" abrePadrao
        legenda="plantões e anestesias do mês — a consulta pré-anestésica é cobrada pelo serviço e aparece no Financeiro">
        <div className="financeTabelaRolavel">
          <table className="financeTabela">
            <thead><tr><th>Origem</th><th className="num">Lançamentos</th><th className="num">Faturado</th><th className="num">Recebido</th><th className="num">A receber</th></tr></thead>
            <tbody>{origens.map((o) => <tr key={o.origem}>
              <td>{o.rotulo}</td>
              <td className="num">{o.linhas}</td>
              <td className="num">{dinheiro(o.valor)}</td>
              <td className="num">{dinheiro(o.recebido)}</td>
              <td className={o.aReceber > 0 ? "num alerta" : "num"}>{dinheiro(o.aReceber)}</td>
            </tr>)}</tbody>
            <tfoot><tr>
              <td>Total</td><td className="num">{total.linhas}</td>
              <td className="num">{dinheiro(total.valor)}</td>
              <td className="num">{dinheiro(total.recebido)}</td>
              <td className="num">{dinheiro(total.aReceber)}</td>
            </tr></tfoot>
          </table>
        </div>
        {total.aReceber > 0 && <p className="financeNota">
          <Icone nome="alerta" tamanho={15} /> {dinheiro(total.aReceber)} de trabalho já feito e ainda não pago. Plantão vira &quot;pago&quot; na Minha escala; anestesia vira &quot;recebido&quot; na Produção.
        </p>}
      </PainelRecolhivel>

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

      <PainelRecolhivel chave="meu-despesas" titulo="Suas despesas do mês" abrePadrao
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

function MoedaCartao({ valor, rotulo, tom, formatar, extra }: {
  valor: number; rotulo: string; tom: string;
  formatar: (v: number) => string; extra?: React.ReactNode;
}) {
  return <div className="metricCard"><strong className={tom}>{formatar(valor)}</strong><span>{rotulo}</span>{extra}</div>;
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
