"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { money, plural } from "@/lib/escala";
import { AVISO_FICHA, ROTULO_CAMPO, lerFichaDeInternacao } from "@/lib/ficha-internacao";

// Produção do dia: o caderninho do bolso do pijama.
//
// No fim do plantão o anestesista anota nome, convênio e cirurgia de cada
// paciente, e é dessa lista que sai a cobrança do mês. O que a tela precisa
// entregar é velocidade: se anotar oito pacientes custar mais que rabiscar
// num papel, a pessoa rabisca no papel — e aí o dado não existe.
//
// Por isso o formulário é uma linha só, o foco volta para o nome depois de
// salvar, e o único campo obrigatório é o nome. Valor e procedimento entram
// depois, com calma, quando for faturar.

export type Producao = {
  id: string; data: string; paciente: string; convenio: string;
  procedimento: string | null; valor: number; situacao: string;
  observacoes: string | null; plantao_id: string | null;
};

const SITUACOES: Array<[string, string]> = [
  ["a_cobrar", "A cobrar"],
  ["faturado", "Faturado"],
  ["recebido", "Recebido"],
  ["glosado", "Glosado"],
];

const rotuloSituacao = (s: string) =>
  SITUACOES.find(([id]) => id === s)?.[1] ?? s;

/** "1.100,00" ou "1100" -> 1100. Aceita o jeito que a pessoa digitar. */
export function lerValor(bruto: string): number {
  const v = Number(String(bruto ?? "").replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export function ProducaoDoDia({
  dia, perfilId, institutionId, plantaoId, conveniosConhecidos,
}: {
  dia: string;
  perfilId: string;
  institutionId: string;
  /** O plantão do dia, quando há um só. Serve para ligar a anotação ao turno. */
  plantaoId: string | null;
  /** Convênios já usados na organização, para não redigitar "Unimed". */
  conveniosConhecidos: string[];
}) {
  const [itens, setItens] = useState<Producao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const vazio = { paciente: "", convenio: "Particular", procedimento: "", valor: "" };
  const [novo, setNovo] = useState(vazio);
  const [lendoFoto, setLendoFoto] = useState(false);
  const [avisoFoto, setAvisoFoto] = useState("");

  /**
   * Ler a ficha de internação por foto.
   *
   * A imagem é reconhecida no próprio aparelho e descartada ao fim: a ficha
   * traz nome, convênio e diagnóstico de um paciente, e mandar isso para um
   * servidor — ainda que nosso — seria transportar dado de saúde por um
   * caminho que esta funcionalidade não precisa ter.
   *
   * O que é reconhecido cai nos campos do formulário e fica lá para ser
   * conferido: nada é salvo sozinho. O motor entra por import dinâmico, então
   * quem nunca usar a câmera não carrega esses megabytes.
   */
  async function lerFicha(arquivo?: File) {
    if (!arquivo) return;
    setLendoFoto(true); setErro(""); setAvisoFoto("");
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(arquivo, "por");
      const { dados, naoEncontrados } = lerFichaDeInternacao(data.text);

      if (!dados.paciente && !dados.convenio && !dados.procedimento) {
        setErro("Não reconheci nada nesta imagem. Tente uma foto mais próxima, sem reflexo e com a ficha plana — ou digite os campos.");
        return;
      }
      setNovo({
        ...novo,
        paciente: dados.paciente ?? novo.paciente,
        convenio: dados.convenio ?? novo.convenio,
        procedimento: dados.procedimento ?? novo.procedimento,
      });
      setAvisoFoto(naoEncontrados.length
        ? `${AVISO_FICHA} Não achei: ${naoEncontrados.map((c) => ROTULO_CAMPO[c]).join(", ")}.`
        : AVISO_FICHA);
    } catch {
      setErro("Não consegui carregar o leitor de imagem. Digite os campos.");
    } finally {
      setLendoFoto(false);
    }
  }

  const carregar = useCallback(async () => {
    const { data, error } = await createClient()
      .from("producao_do_dia").select("*")
      .eq("data", dia).order("created_at");
    setCarregando(false);
    // A tabela pode não existir ainda se o SQL não tiver sido rodado. A tela
    // avisa o que fazer em vez de mostrar uma lista vazia que mente.
    if (error) {
      setErro(error.code === "42P01"
        ? "A tabela da produção ainda não foi criada no banco. Rode a migração 202608240003_producao_do_dia.sql."
        : "Não foi possível carregar a produção do dia.");
      return;
    }
    setErro("");
    setItens((data ?? []) as Producao[]);
  }, [dia]);

  useEffect(() => { void carregar(); }, [carregar]);

  const total = useMemo(() => itens.reduce((s, i) => s + Number(i.valor), 0), [itens]);
  const aCobrar = useMemo(
    () => itens.filter((i) => i.situacao === "a_cobrar" || i.situacao === "faturado")
      .reduce((s, i) => s + Number(i.valor), 0),
    [itens],
  );

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const paciente = novo.paciente.trim();
    if (!paciente) return;
    setSalvando(true); setErro("");
    const { error } = await createClient().from("producao_do_dia").insert({
      institution_id: institutionId, perfil_id: perfilId, plantao_id: plantaoId,
      data: dia, paciente,
      convenio: novo.convenio.trim() || "Particular",
      procedimento: novo.procedimento.trim() || null,
      valor: lerValor(novo.valor),
    });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar a anotação."); return; }
    // Convênio e procedimento ficam: numa sala de cirurgia o caso seguinte
    // costuma ser do mesmo convênio, e limpar tudo obrigaria a redigitar.
    setNovo({ ...novo, paciente: "", valor: "" });
    setAvisoFoto("");
    void carregar();
    document.getElementById("producao-paciente")?.focus();
  }

  async function mudar(id: string, campos: Partial<Producao>) {
    setErro("");
    const { error } = await createClient()
      .from("producao_do_dia").update(campos).eq("id", id);
    if (error) { setErro("Não foi possível salvar a alteração."); return; }
    void carregar();
  }

  async function remover(id: string, paciente: string) {
    if (!confirm(`Apagar a anotação de ${paciente}?`)) return;
    await createClient().from("producao_do_dia").delete().eq("id", id);
    void carregar();
  }

  return (
    <div className="producaoBloco">
      <div className="producaoCabeca">
        <div>
          <strong>Produção do dia</strong>
          <span>só você vê esta lista</span>
        </div>
        <div className="producaoAcoes">
          {itens.length > 0 && (
            <div className="producaoTotais">
              <span><b>{money(total)}</b> no dia</span>
              {aCobrar > 0 && <span className="aberto"><b>{money(aCobrar)}</b> a receber</span>}
            </div>
          )}
          <label className="producaoFoto">
            {lendoFoto ? "Lendo a ficha…" : "Fotografar ficha"}
            <input type="file" accept="image/*" capture="environment" disabled={lendoFoto}
              aria-label="Fotografar a ficha de internação"
              onChange={(e) => { void lerFicha(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {erro && <p className="clinicalError">{erro}</p>}

      {carregando
        ? <div className="emptyClinical compactEmpty">Carregando…</div>
        : itens.length === 0
          // Lista vazia não precisa de texto: o formulário logo abaixo já é a
          // instrução, e um parágrafo explicando o óbvio só afasta o campo do
          // dedo de quem está com pressa.
          ? null
          : (
            <ul className="producaoLista">
              {itens.map((i) => (
                <li key={i.id} className={`producaoItem sit-${i.situacao}`}>
                  <input
                    className="producaoNome" defaultValue={i.paciente} aria-label="Paciente"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== i.paciente) void mudar(i.id, { paciente: v });
                      else e.target.value = i.paciente;
                    }}
                  />
                  <input
                    className="producaoConvenio" defaultValue={i.convenio} aria-label="Convênio"
                    list="producao-convenios"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || "Particular";
                      if (v !== i.convenio) void mudar(i.id, { convenio: v });
                    }}
                  />
                  <input
                    className="producaoProc" defaultValue={i.procedimento ?? ""}
                    placeholder="Cirurgia" aria-label="Procedimento"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== i.procedimento) void mudar(i.id, { procedimento: v });
                    }}
                  />
                  <input
                    className="producaoValor" defaultValue={Number(i.valor) || ""}
                    placeholder="R$ 0,00" inputMode="decimal" aria-label="Valor"
                    onBlur={(e) => {
                      const v = lerValor(e.target.value);
                      if (v !== Number(i.valor)) void mudar(i.id, { valor: v });
                    }}
                  />
                  <select value={i.situacao} aria-label="Situação"
                    onChange={(e) => void mudar(i.id, { situacao: e.target.value })}>
                    {SITUACOES.map(([id, rot]) => <option key={id} value={id}>{rot}</option>)}
                  </select>
                  <button type="button" className="producaoApagar"
                    onClick={() => void remover(i.id, i.paciente)}
                    aria-label={`Apagar ${i.paciente}`} title="Apagar">×</button>
                </li>
              ))}
            </ul>
          )}

      {/* O datalist deixa "Unimed" vir sozinho depois da primeira vez, sem
          prender a pessoa a uma lista fechada: convênio novo se digita. */}
      <datalist id="producao-convenios">
        {conveniosConhecidos.map((c) => <option key={c} value={c} />)}
      </datalist>

      {avisoFoto && <p className="producaoConfira" role="status">{avisoFoto}</p>}

      <form className="producaoNovo" onSubmit={adicionar}>
        <input
          id="producao-paciente" className="producaoNome" value={novo.paciente}
          placeholder="Nome do paciente" aria-label="Nome do paciente"
          onChange={(e) => setNovo({ ...novo, paciente: e.target.value })}
        />
        <input
          className="producaoConvenio" value={novo.convenio} list="producao-convenios"
          placeholder="Convênio" aria-label="Convênio"
          onChange={(e) => setNovo({ ...novo, convenio: e.target.value })}
        />
        <input
          className="producaoProc" value={novo.procedimento}
          placeholder="Cirurgia" aria-label="Procedimento"
          onChange={(e) => setNovo({ ...novo, procedimento: e.target.value })}
        />
        <input
          className="producaoValor" value={novo.valor} inputMode="decimal"
          placeholder="R$ 0,00" aria-label="Valor"
          onChange={(e) => setNovo({ ...novo, valor: e.target.value })}
        />
        <button className="primaryClinical compact" disabled={salvando || !novo.paciente.trim()}>
          {salvando ? "Salvando…" : "+ Anotar"}
        </button>
      </form>
    </div>
  );
}

/**
 * A produção do mês, para faturar.
 *
 * A anotação do dia serve para não esquecer; esta tela serve para cobrar.
 * São dois momentos diferentes — um no fim do plantão, com pressa, outro no
 * fim do mês, sentado — e por isso são duas telas e não uma.
 */
export function ProducaoDoMes({
  mes, nomeMes, ano, onImprimir,
}: {
  mes: string; nomeMes: string; ano: number;
  onImprimir: (itens: Producao[]) => void;
}) {
  const [itens, setItens] = useState<Producao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const [a, m] = mes.split("-").map(Number);
      const ultimo = new Date(a, m, 0).toISOString().slice(0, 10);
      const { data, error } = await createClient()
        .from("producao_do_dia").select("*")
        .gte("data", `${mes}-01`).lte("data", ultimo)
        .order("data").order("created_at");
      if (!vivo) return;
      setCarregando(false);
      if (error) {
        setErro(error.code === "42P01"
          ? "A tabela da produção ainda não foi criada no banco. Rode a migração 202608240003_producao_do_dia.sql."
          : "Não foi possível carregar a produção do mês.");
        return;
      }
      setErro("");
      setItens((data ?? []) as Producao[]);
    })();
    return () => { vivo = false; };
  }, [mes]);

  // Por convênio é como se fatura: cada operadora recebe a sua remessa, e o
  // particular é cobrado paciente a paciente.
  const porConvenio = useMemo(() => {
    const m = new Map<string, { n: number; total: number; aberto: number }>();
    for (const i of itens) {
      const k = i.convenio || "Particular";
      const t = m.get(k) ?? { n: 0, total: 0, aberto: 0 };
      t.n += 1; t.total += Number(i.valor);
      if (i.situacao !== "recebido" && i.situacao !== "glosado") t.aberto += Number(i.valor);
      m.set(k, t);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [itens]);

  const total = itens.reduce((s, i) => s + Number(i.valor), 0);
  const recebido = itens.filter((i) => i.situacao === "recebido")
    .reduce((s, i) => s + Number(i.valor), 0);

  if (carregando) return <div className="emptyClinical">Carregando produção…</div>;

  return (
    <>
      {erro && <p className="clinicalError">{erro}</p>}

      <section className="metricGrid plantaoMetrics">
        <div className="metricCard"><strong>{itens.length}</strong><span>Pacientes no mês</span></div>
        <div className="metricCard"><strong className="blue">{money(total)}</strong><span>Total anotado</span></div>
        <div className="metricCard"><strong className="green">{money(recebido)}</strong><span>Recebido</span></div>
        <div className="metricCard"><strong className="amber">{money(total - recebido)}</strong><span>A receber</span></div>
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Por convênio em {nomeMes} de {ano}</strong>
          <span>é assim que se fatura: uma remessa por operadora</span>
          <button className="outlineClinical" style={{ marginLeft: "auto" }}
            disabled={itens.length === 0} onClick={() => onImprimir(itens)}>
            Imprimir
          </button>
        </div>
        {porConvenio.length === 0
          ? <div className="emptyClinical compactEmpty">
              Nada anotado neste mês. A anotação é feita no dia: toque num dia da
              sua escala e use “Produção do dia”.
            </div>
          : porConvenio.map(([convenio, t]) => (
            <div className="plantaoLinha" key={convenio}>
              <span className="plantaoOnde">
                <strong>{convenio}</strong>
                <small>{plural(t.n, "paciente", "pacientes")}</small>
              </span>
              <b>{money(t.total)}</b>
              {t.aberto > 0 && <span className="statusChip waiting">{money(t.aberto)} em aberto</span>}
            </div>
          ))}
      </section>

      {itens.length > 0 && (
        <section className="clinicalPanel">
          <div className="panelTitle">
            <strong>Todos os pacientes do mês</strong>
            <span>edite pela escala, no dia de cada um</span>
          </div>
          {itens.map((i) => (
            <div className="plantaoLinha" key={i.id}>
              <span className="plantaoQuando">
                <strong>{Number(i.data.slice(8, 10))}/{i.data.slice(5, 7)}</strong>
              </span>
              <span className="plantaoOnde">
                <strong>{i.paciente}</strong>
                <small>{i.convenio}{i.procedimento ? ` · ${i.procedimento}` : ""}</small>
              </span>
              <b>{money(Number(i.valor))}</b>
              <span className={`statusChip ${i.situacao === "recebido" ? "present"
                : i.situacao === "glosado" ? "paused" : "waiting"}`}>
                {rotuloSituacao(i.situacao)}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
