"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";

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

const money = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hhmm = (t: string) => (t || "").slice(0, 5);

/** Soma horas a um "HH:MM", virando o dia quando passa da meia-noite. */
function somarHoras(inicio: string, horas: number): string {
  const [h, m] = hhmm(inicio).split(":").map(Number);
  const total = (h * 60 + m + horas * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function Plantoes({
  perfilId, institutionId, locais, ehAdmin, colegas,
}: {
  perfilId: string;
  institutionId: string;
  locais: LocalDisponivel[];
  ehAdmin: boolean;
  colegas: Colega[];
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [aba, setAba] = useState<"escala" | "modelos" | "trocas">("escala");
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [trocas, setTrocas] = useState<Troca[]>([]);
  // Escala do grupo ou só a minha. Duas leituras da mesma tela: "onde eu
  // trabalho este mês" e "quem está de plantão no dia 12".
  const [escopo, setEscopo] = useState<"minha" | "grupo">("minha");
  const [pedindoTroca, setPedindoTroca] = useState<Plantao | null>(null);
  // Lançar sem modelo. O modelo é atalho, não pré-requisito: exigir que a
  // pessoa crie um modelo antes de registrar o primeiro plantão é uma parede
  // logo na entrada, e foi exatamente onde a tela travou no primeiro uso.
  const [lancando, setLancando] = useState<string | null>(null);

  const nomePorId = useMemo(() => new Map(colegas.map((c) => [c.id, c.nome])), [colegas]);
  const localPorId = useMemo(() => new Map(locais.map((l) => [l.id, nomeDoLocal(l)])), [locais]);
  // O calendário precisa dizer QUAL plantão é, não só que existe um. Cor e
  // nome vêm do modelo; sem modelo, o rótulo cai no horário, que ainda
  // distingue diurno de noturno.
  const modeloPorId = useMemo(() => new Map(modelos.map((mo) => [mo.id, mo])), [modelos]);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [ano, m] = mes.split("-").map(Number);
    const primeiro = `${mes}-01`;
    const ultimo = new Date(ano, m, 0).toISOString().slice(0, 10);
    const [{ data: mods }, { data: plans, error }, { data: trs }] = await Promise.all([
      supabase.from("modelos_plantao").select("*").eq("ativo", true).order("nome"),
      supabase.from("plantoes").select("*").gte("data", primeiro).lte("data", ultimo).order("data"),
      supabase.from("trocas_plantao").select("*").eq("status", "pendente").order("created_at", { ascending: false }),
    ]);
    setCarregando(false);
    if (error) { setErro("Não foi possível carregar os plantões."); return; }
    setModelos((mods ?? []) as Modelo[]);
    setPlantoes((plans ?? []) as Plantao[]);
    setTrocas((trs ?? []) as Troca[]);
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
    const [ano, m] = mes.split("-").map(Number);
    const d = new Date(ano, m - 1 + passo, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function lancar(dia: string, modelo: Modelo) {
    setErro(""); setAviso("");
    const supabase = createClient();
    const { error } = await supabase.from("plantoes").insert({
      institution_id: institutionId, perfil_id: perfilId,
      local_id: modelo.local_id, modelo_id: modelo.id,
      data: dia, hora_inicio: modelo.hora_inicio, hora_fim: modelo.hora_fim,
      valor: modelo.valor, created_by: perfilId,
    });
    if (error) {
      setErro(error.code === "23505"
        ? "Você já tem um plantão nesse dia e horário."
        : "Não foi possível lançar o plantão.");
      return;
    }
    setDiaAberto(null);
    void carregar();
  }

  async function lancarAvulso(dados: {
    data: string; local_id: string; hora_inicio: string; hora_fim: string; valor: number;
  }) {
    setErro(""); setAviso("");
    const { error } = await createClient().from("plantoes").insert({
      institution_id: institutionId, perfil_id: perfilId,
      local_id: dados.local_id || null, data: dados.data,
      hora_inicio: dados.hora_inicio, hora_fim: dados.hora_fim,
      valor: dados.valor, created_by: perfilId,
    });
    if (error) {
      setErro(error.code === "23505"
        ? "Você já tem um plantão nesse dia e horário."
        : "Não foi possível lançar o plantão.");
      return;
    }
    setLancando(null);
    void carregar();
  }

  async function atualizar(id: string, campos: Partial<Plantao>) {
    setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("plantoes")
      .update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setErro("Não foi possível salvar a alteração."); return; }
    void carregar();
  }

  async function pedirTroca(plantao: Plantao, destinatarioId: string, mensagem: string) {
    setErro(""); setAviso("");
    const supabase = createClient();
    const { error } = await supabase.from("trocas_plantao").insert({
      institution_id: institutionId, plantao_id: plantao.id,
      solicitante_id: perfilId,
      // String vazia significa "todo o grupo"; o banco guarda null, que é o
      // que aceitar_troca lê para saber que qualquer um pode assumir.
      destinatario_id: destinatarioId || null,
      mensagem: mensagem.trim() || null,
    });
    if (error) { setErro("Não foi possível registrar o pedido de troca."); return; }
    await supabase.from("plantoes").update({ aberto_para_troca: true }).eq("id", plantao.id);
    setPedindoTroca(null);
    setAviso(destinatarioId
      ? "Convite enviado. Ele aparece na aba Trocas do colega."
      : "Plantão oferecido ao grupo. Qualquer colega pode assumir.");
    void carregar();
  }

  async function responderTroca(trocaId: string, acao: "aceitar_troca" | "recusar_troca" | "cancelar_troca") {
    setErro(""); setAviso("");
    const { error } = await createClient().rpc(acao, { p_troca_id: trocaId });
    if (error) { setErro(error.message); return; }
    setAviso(acao === "aceitar_troca"
      ? "Plantão assumido. A escala foi atualizada e a troca ficou registrada na auditoria."
      : acao === "recusar_troca" ? "Convite recusado." : "Pedido cancelado.");
    void carregar();
  }

  async function remover(id: string) {
    if (!confirm("Remover este plantão da escala?")) return;
    const supabase = createClient();
    await supabase.from("plantoes").delete().eq("id", id);
    void carregar();
  }

  const hojeISO = new Date().toISOString().slice(0, 10);
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const primeiroDiaSemana = new Date(ano, m - 1, 1).getDay();

  if (carregando) return <div className="emptyClinical">Carregando plantões…</div>;

  return (
    <div className="clinicalMain plantaoMain">
      <section className="clinicalWelcome">
        <div>
          <h1>Escala</h1>
          <p>Seus plantões, o valor de cada turno e as trocas com a equipe.</p>
        </div>
        <div className="plantaoAcoesTopo">
          <button className="primaryClinical compact" onClick={() => setLancando(hojeISO.startsWith(mes) ? hojeISO : `${mes}-01`)}>
            + Lançar plantão
          </button>
        </div>
        <div className="plantaoMesNav">
          <button className="outlineClinical" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
          <strong>{MESES[m - 1]} {ano}</strong>
          <button className="outlineClinical" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
          {/* Depois de folhear três meses para trás, voltar é um toque. */}
          {mes !== `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}` && (
            <button className="outlineClinical" onClick={() =>
              setMes(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`)}>Hoje</button>
          )}
        </div>
      </section>

      {erro && <p className="clinicalError">{erro}</p>}
      {aviso && <p className="financeSuccess" role="status">{aviso}</p>}

      <section className="metricGrid plantaoMetrics">
        <div className="metricCard"><strong>{resumo.turnos}</strong><span>Plantões no mês</span></div>
        <div className="metricCard"><strong>{resumo.horas.toLocaleString("pt-BR")}h</strong><span>Horas</span></div>
        <div className="metricCard"><strong className="blue">{money(resumo.total)}</strong><span>Total do mês</span></div>
        <div className="metricCard"><strong className="green">{money(resumo.pago)}</strong><span>Recebido</span></div>
        <div className="metricCard"><strong className="amber">{money(resumo.aberto)}</strong><span>A receber</span></div>
      </section>

      <div className="financeChips plantaoAbas" role="group" aria-label="Seções dos plantões">
        {([["escala", "Escala"], ["modelos", "Modelos"], ["trocas", "Trocas"]] as const).map(([id, rot]) => (
          <button key={id} type="button" className={aba === id ? "active" : ""} onClick={() => setAba(id)}>{rot}</button>
        ))}
      </div>

      {aba === "escala" && (
        <>
          <div className="plantaoEscopo" role="group" aria-label="De quem é a escala">
            {([["minha", "Minha escala"], ["grupo", "Escala do grupo"]] as const).map(([id, rot]) => (
              <button key={id} type="button" className={escopo === id ? "active" : ""}
                onClick={() => setEscopo(id)}>{rot}</button>
            ))}
            <small>
              {escopo === "minha"
                ? "Só os seus turnos."
                : "Todos os turnos da equipe. Você edita apenas os seus."}
            </small>
          </div>
          <section className="clinicalPanel">
            <div className="plantaoCalendario">
              <div className="plantaoSemana">{DIAS.map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="plantaoGrade">
                {Array.from({ length: primeiroDiaSemana }).map((_, i) => <span key={`v${i}`} />)}
                {Array.from({ length: diasNoMes }, (_, i) => {
                  const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
                  const doDia = plantoes.filter((p) => p.data === dia && p.situacao !== "cancelado"
                    && (escopo === "grupo" || p.perfil_id === perfilId));
                  const meusDoDia = doDia.filter((p) => p.perfil_id === perfilId);
                  const fimDeSemana = new Date(`${dia}T12:00:00`).getDay() % 6 === 0;
                  return (
                    <button
                      type="button" key={dia}
                      className={`plantaoDia${dia === hojeISO ? " hoje" : ""}${fimDeSemana ? " fds" : ""}${diaAberto === dia ? " aberto" : ""}`}
                      onClick={() => setDiaAberto(diaAberto === dia ? null : dia)}
                      aria-label={`${i + 1} — ${doDia.length ? `${doDia.length} plantão(ões)` : "sem plantão"}`}
                    >
                      <b>{i + 1}</b>
                      {/* Duas etiquetas no máximo. A terceira vira "+1": três
                          nomes espremidos num quadrado de 90px não se leem, e
                          o dia inteiro está a um toque de distância. */}
                      <span className="plantaoEtiquetas">
                        {doDia.slice(0, 2).map((p) => {
                          const mo = p.modelo_id ? modeloPorId.get(p.modelo_id) : undefined;
                          const meu = p.perfil_id === perfilId;
                          return (
                            <i key={p.id}
                              className={`plantaoEtiqueta etq-${mo?.cor ?? "cinza"}${meu ? "" : " deOutro"}`}
                              // Na escala do grupo o que distingue é o hospital:
                              // um grupo cobre várias instituições ao mesmo
                              // tempo, e saber que há "um diurno" no dia 12 não
                              // diz se é no Mamborê ou no ambulatório. Na escala
                              // pessoal isso já é sabido, e o nome do modelo
                              // informa mais — diurno ou noturno.
                              title={`${mo?.nome ?? "Plantão"} · ${hhmm(p.hora_inicio)}–${hhmm(p.hora_fim)}${p.local_id ? ` · ${localPorId.get(p.local_id) ?? ""}` : ""}`}>
                              {escopo === "grupo"
                                ? (p.local_id ? localPorId.get(p.local_id) ?? "Sem local" : "Sem local")
                                : (mo?.nome ?? hhmm(p.hora_inicio))}
                            </i>
                          );
                        })}
                        {doDia.length > 2 && <i className="plantaoMais">+{doDia.length - 2}</i>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {diaAberto && (
            <DiaDetalhe
              dia={diaAberto} plantoes={plantoes.filter((p) => p.data === diaAberto)}
              modelos={modelos} perfilId={perfilId} nomePorId={nomePorId} localPorId={localPorId}
              onLancar={lancar} onLancarAvulso={(d) => setLancando(d)}
              onAtualizar={atualizar} onRemover={remover}
              onFechar={() => setDiaAberto(null)}
            />
          )}

          <section className="clinicalPanel">
            <div className="panelTitle">
              <strong>{escopo === "grupo" ? `Escala da equipe em ${MESES[m - 1]}` : `Meus plantões em ${MESES[m - 1]}`}</strong>
              <span>o valor é editável no seu próprio plantão: o combinado muda de um turno para outro</span>
            </div>
            {(escopo === "grupo" ? plantoes.filter((p) => p.situacao !== "cancelado") : meus).length === 0
              ? <div className="emptyClinical compactEmpty">Nenhum plantão lançado neste mês. Toque num dia do calendário para lançar.</div>
              : (escopo === "grupo" ? plantoes.filter((p) => p.situacao !== "cancelado") : meus).map((p) => {
                const meu = p.perfil_id === perfilId;
                return (
                <div className="plantaoLinha" key={p.id}>
                  <span className="plantaoQuando">
                    <strong>{Number(p.data.slice(8, 10))}/{p.data.slice(5, 7)}</strong>
                    <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)} · {p.horas}h</small>
                  </span>
                  <span className="plantaoOnde">
                    <strong>{escopo === "grupo" ? nomePorId.get(p.perfil_id) ?? "Profissional" : (p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local")}</strong>
                    <small>{escopo === "grupo" ? (p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local") : null}</small>
                    {p.aberto_para_troca && <small className="plantaoTrocaAviso">oferecido para troca</small>}
                  </span>
                  {/* O valor do colega não é editável nem visível: quanto cada
                      um recebe é assunto dele com quem paga, e a escala não
                      precisa expor isso para funcionar. O RLS recusaria a
                      escrita de qualquer forma; esconder evita a tentativa. */}
                  {meu ? (
                    <label className="inlineMoney">
                      <span>Valor</span>
                      <input
                        defaultValue={Number(p.valor) || ""} placeholder="R$ 0,00" inputMode="decimal"
                        onBlur={(e) => {
                          const v = Number(e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
                          if (Number.isFinite(v) && v !== Number(p.valor)) void atualizar(p.id, { valor: v });
                        }}
                      />
                    </label>
                  ) : <span className="plantaoDeColega">de colega</span>}
                  {meu && (
                    <select value={p.situacao} onChange={(e) => void atualizar(p.id, { situacao: e.target.value })}>
                      <option value="escalado">Escalado</option>
                      <option value="realizado">Realizado</option>
                      <option value="pago">Pago</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  )}
                  {meu && (
                    <button className="outlineClinical" onClick={() => setPedindoTroca(p)}>
                      {p.aberto_para_troca ? "Trocar de novo" : "Solicitar troca"}
                    </button>
                  )}
                </div>
                );
              })}
          </section>
        </>
      )}

      {lancando && (
        <LancarPlantao
          dia={lancando} locais={locais} modelos={modelos}
          onFechar={() => setLancando(null)} onSalvar={lancarAvulso}
        />
      )}

      {pedindoTroca && (
        <PedirTroca
          plantao={pedindoTroca} colegas={colegas.filter((c) => c.id !== perfilId)}
          localPorId={localPorId}
          onFechar={() => setPedindoTroca(null)}
          onEnviar={(destino, msg) => void pedirTroca(pedindoTroca, destino, msg)}
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
          trocas={trocas} plantoes={plantoes} perfilId={perfilId}
          nomePorId={nomePorId} localPorId={localPorId} onResponder={responderTroca}
        />
      )}
    </div>
  );
}

function DiaDetalhe({
  dia, plantoes, modelos, perfilId, nomePorId, localPorId,
  onLancar, onLancarAvulso, onAtualizar, onRemover, onFechar,
}: {
  dia: string; plantoes: Plantao[]; modelos: Modelo[]; perfilId: string;
  nomePorId: Map<string, string>; localPorId: Map<string, string>;
  onLancar: (dia: string, modelo: Modelo) => void;
  onLancarAvulso: (dia: string) => void;
  onAtualizar: (id: string, campos: Partial<Plantao>) => void;
  onRemover: (id: string) => void;
  onFechar: () => void;
}) {
  const [d, mm, aa] = [dia.slice(8, 10), dia.slice(5, 7), dia.slice(0, 4)];
  return (
    <section className="clinicalPanel plantaoDetalhe">
      <div className="panelTitle">
        <strong>{d}/{mm}/{aa}</strong>
        <span>{plantoes.length ? `${plantoes.length} plantão(ões) na escala` : "nenhum plantão neste dia"}</span>
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
            <small>{p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local"}</small>
          </span>
          {p.perfil_id === perfilId
            ? <button className="outlineClinical red" onClick={() => onRemover(p.id)}>Remover</button>
            : <span className="statusChip paused">de colega</span>}
        </div>
      ))}

      <div className="plantaoLancar">
        <span>Lançar a partir de um modelo:</span>
        {modelos.length === 0
          ? <button className="primaryClinical compact" onClick={() => onLancarAvulso(dia)}>
              + Lançar plantão neste dia
            </button>
          : modelos.map((mo) => (
            <button key={mo.id} className={`plantaoModeloChip cor-${mo.cor}`} onClick={() => onLancar(dia, mo)}>
              <b>{mo.nome}</b>
              <small>{hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)} · {money(Number(mo.valor))}</small>
            </button>
          ))}
        {modelos.length > 0 && (
          <button className="outlineClinical" onClick={() => onLancarAvulso(dia)}>
            Outro horário…
          </button>
        )}
      </div>
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
    await createClient().from("modelos_plantao").update({ ativo: false }).eq("id", id);
    onMudou();
  }

  return (
    <section className="clinicalPanel">
      <div className="panelTitle">
        <strong>Modelos de plantão</strong>
        <span>o turno que se repete, salvo uma vez: lançar o mês vira um toque por dia</span>
      </div>

      {erro && <p className="clinicalError">{erro}</p>}

      <form className="plantaoModeloForm" onSubmit={salvar}>
        <label className="clinicalField wide"><span>Nome *</span>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Mamborê diurno" /></label>
        <label className="clinicalField"><span>Local</span>
          <select value={form.local_id} onChange={(e) => setForm({ ...form, local_id: e.target.value })}>
            <option value="">Sem local</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
          </select></label>
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
  dia, locais, modelos, onFechar, onSalvar,
}: {
  dia: string;
  locais: LocalDisponivel[];
  modelos: Modelo[];
  onFechar: () => void;
  onSalvar: (d: { data: string; local_id: string; hora_inicio: string; hora_fim: string; valor: number }) => void;
}) {
  const [form, setForm] = useState({
    data: dia, local_id: locais[0]?.id ?? "", hora_inicio: "07:00", hora_fim: "19:00", valor: "",
  });

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
          onSalvar({ ...form, valor: Number(form.valor.replace(/\./g, "").replace(",", ".")) || 0 });
        }}>
          {modelos.length > 0 && (
            <label className="clinicalField wide">
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

          <div className="localFormGrade" style={{ marginTop: 14 }}>
            <label className="clinicalField span2"><span>Data</span>
              <input type="date" value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
            <label className="clinicalField span2"><span>Local</span>
              <select value={form.local_id} onChange={(e) => setForm({ ...form, local_id: e.target.value })}>
                <option value="">Sem local</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
              </select></label>
            <label className="clinicalField"><span>Início</span>
              <input type="time" value={form.hora_inicio}
                onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></label>
            <label className="clinicalField"><span>Fim</span>
              <input type="time" value={form.hora_fim}
                onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></label>
            <label className="clinicalField span2"><span>Valor</span>
              <input value={form.valor} inputMode="decimal" placeholder="1.100,00"
                onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>
          </div>

          <div className="plantaoDuracoes">
            <span>Duração rápida:</span>
            {DURACOES.map((h) => (
              <button type="button" key={h} className="outlineClinical"
                onClick={() => setForm({ ...form, hora_fim: somarHoras(form.hora_inicio, h) })}>{h}h</button>
            ))}
          </div>

          <div className="modalActions">
            <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="primaryClinical compact">Lançar</button>
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
            <h2 id="pedir-troca">Solicitar troca</h2>
            <p>
              {Number(plantao.data.slice(8, 10))}/{plantao.data.slice(5, 7)} ·{" "}
              {hhmm(plantao.hora_inicio)}–{hhmm(plantao.hora_fim)} ·{" "}
              {plantao.local_id ? localPorId.get(plantao.local_id) ?? "sem local" : "sem local"}
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
    if (!p) return null;
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
          <small>{p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local"}</small>
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
          <span>convites para você e plantões oferecidos ao grupo</span>
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
