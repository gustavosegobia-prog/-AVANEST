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

  const nomePorId = useMemo(() => new Map(colegas.map((c) => [c.id, c.nome])), [colegas]);
  const localPorId = useMemo(() => new Map(locais.map((l) => [l.id, nomeDoLocal(l)])), [locais]);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [ano, m] = mes.split("-").map(Number);
    const primeiro = `${mes}-01`;
    const ultimo = new Date(ano, m, 0).toISOString().slice(0, 10);
    const [{ data: mods }, { data: plans, error }] = await Promise.all([
      supabase.from("modelos_plantao").select("*").eq("ativo", true).order("nome"),
      supabase.from("plantoes").select("*").gte("data", primeiro).lte("data", ultimo).order("data"),
    ]);
    setCarregando(false);
    if (error) { setErro("Não foi possível carregar os plantões."); return; }
    setModelos((mods ?? []) as Modelo[]);
    setPlantoes((plans ?? []) as Plantao[]);
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

  async function atualizar(id: string, campos: Partial<Plantao>) {
    setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("plantoes")
      .update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setErro("Não foi possível salvar a alteração."); return; }
    void carregar();
  }

  async function remover(id: string) {
    if (!confirm("Remover este plantão da escala?")) return;
    const supabase = createClient();
    await supabase.from("plantoes").delete().eq("id", id);
    void carregar();
  }

  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const primeiroDiaSemana = new Date(ano, m - 1, 1).getDay();
  const hojeISO = new Date().toISOString().slice(0, 10);

  if (carregando) return <div className="emptyClinical">Carregando plantões…</div>;

  return (
    <div className="clinicalMain plantaoMain">
      <section className="clinicalWelcome">
        <div>
          <h1>Plantões</h1>
          <p>Sua escala, o valor de cada turno e as trocas com a equipe.</p>
        </div>
        <div className="plantaoMesNav">
          <button className="outlineClinical" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
          <strong>{MESES[m - 1]} {ano}</strong>
          <button className="outlineClinical" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
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
          <section className="clinicalPanel">
            <div className="plantaoCalendario">
              <div className="plantaoSemana">{DIAS.map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="plantaoGrade">
                {Array.from({ length: primeiroDiaSemana }).map((_, i) => <span key={`v${i}`} />)}
                {Array.from({ length: diasNoMes }, (_, i) => {
                  const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
                  const doDia = plantoes.filter((p) => p.data === dia && p.situacao !== "cancelado");
                  const meusDoDia = doDia.filter((p) => p.perfil_id === perfilId);
                  return (
                    <button
                      type="button" key={dia}
                      className={`plantaoDia${dia === hojeISO ? " hoje" : ""}${meusDoDia.length ? " meu" : ""}`}
                      onClick={() => setDiaAberto(diaAberto === dia ? null : dia)}
                    >
                      <b>{i + 1}</b>
                      {/* Ponto cheio é turno seu; vazado é de um colega. Ver a
                          escala do grupo é o motivo de a escala existir. */}
                      <span className="plantaoPontos">
                        {meusDoDia.slice(0, 3).map((p) => <i key={p.id} className="cheio" />)}
                        {doDia.length > meusDoDia.length && <i className="vazado" />}
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
              onLancar={lancar} onAtualizar={atualizar} onRemover={remover}
              onFechar={() => setDiaAberto(null)}
            />
          )}

          <section className="clinicalPanel">
            <div className="panelTitle"><strong>Meus plantões em {MESES[m - 1]}</strong><span>o valor é editável: o combinado muda de um plantão para outro</span></div>
            {meus.length === 0
              ? <div className="emptyClinical compactEmpty">Nenhum plantão lançado neste mês. Toque num dia do calendário para lançar.</div>
              : meus.map((p) => (
                <div className="plantaoLinha" key={p.id}>
                  <span className="plantaoQuando">
                    <strong>{Number(p.data.slice(8, 10))}/{p.data.slice(5, 7)}</strong>
                    <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)} · {p.horas}h</small>
                  </span>
                  <span className="plantaoOnde">
                    <strong>{p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local"}</strong>
                    {p.aberto_para_troca && <small className="plantaoTrocaAviso">oferecido para troca</small>}
                  </span>
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
                  <select value={p.situacao} onChange={(e) => void atualizar(p.id, { situacao: e.target.value })}>
                    <option value="escalado">Escalado</option>
                    <option value="realizado">Realizado</option>
                    <option value="pago">Pago</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  <button
                    className="outlineClinical"
                    onClick={() => void atualizar(p.id, { aberto_para_troca: !p.aberto_para_troca })}
                  >
                    {p.aberto_para_troca ? "Cancelar oferta" : "Oferecer troca"}
                  </button>
                </div>
              ))}
          </section>
        </>
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
          plantoes={plantoes} perfilId={perfilId} nomePorId={nomePorId} localPorId={localPorId}
          onMudou={(texto) => { setAviso(texto); void carregar(); }}
          onErro={setErro}
        />
      )}
    </div>
  );
}

function DiaDetalhe({
  dia, plantoes, modelos, perfilId, nomePorId, localPorId,
  onLancar, onAtualizar, onRemover, onFechar,
}: {
  dia: string; plantoes: Plantao[]; modelos: Modelo[]; perfilId: string;
  nomePorId: Map<string, string>; localPorId: Map<string, string>;
  onLancar: (dia: string, modelo: Modelo) => void;
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
          ? <small>Nenhum modelo criado ainda — crie um na aba Modelos.</small>
          : modelos.map((mo) => (
            <button key={mo.id} className={`plantaoModeloChip cor-${mo.cor}`} onClick={() => onLancar(dia, mo)}>
              <b>{mo.nome}</b>
              <small>{hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)} · {money(Number(mo.valor))}</small>
            </button>
          ))}
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

function TrocasPainel({
  plantoes, perfilId, nomePorId, localPorId, onMudou, onErro,
}: {
  plantoes: Plantao[]; perfilId: string;
  nomePorId: Map<string, string>; localPorId: Map<string, string>;
  onMudou: (texto: string) => void; onErro: (texto: string) => void;
}) {
  const [ocupado, setOcupado] = useState("");
  const oferecidos = plantoes.filter((p) => p.aberto_para_troca && p.situacao !== "cancelado");
  const deColegas = oferecidos.filter((p) => p.perfil_id !== perfilId);
  const meus = oferecidos.filter((p) => p.perfil_id === perfilId);

  async function assumir(p: Plantao) {
    if (!confirm(`Assumir o plantão de ${nomePorId.get(p.perfil_id) ?? "seu colega"} em ${p.data.slice(8,10)}/${p.data.slice(5,7)}?`)) return;
    setOcupado(p.id);
    const supabase = createClient();
    // O pedido é criado e aceito na mesma ação: aqui a oferta já é pública, e
    // exigir que o dono confirme de novo faria o colega esperar por uma
    // resposta que ele já deu ao oferecer.
    const { data: troca, error } = await supabase.from("trocas_plantao")
      .insert({ institution_id: (p as unknown as { institution_id: string }).institution_id,
                plantao_id: p.id, solicitante_id: p.perfil_id })
      .select("id").single();
    if (error || !troca) { setOcupado(""); onErro("Não foi possível registrar a troca."); return; }
    const { error: erroAceite } = await supabase.rpc("aceitar_troca", { p_troca_id: troca.id });
    setOcupado("");
    if (erroAceite) { onErro(erroAceite.message); return; }
    onMudou("Plantão assumido. A escala foi atualizada e a troca ficou registrada na auditoria.");
  }

  return (
    <section className="clinicalPanel">
      <div className="panelTitle">
        <strong>Trocas</strong>
        <span>plantões oferecidos pela equipe neste mês</span>
      </div>

      {deColegas.length === 0 && meus.length === 0 && (
        <div className="emptyClinical compactEmpty">
          Nenhum plantão oferecido. Para oferecer um seu, use “Oferecer troca” na lista da Escala.
        </div>
      )}

      {deColegas.map((p) => (
        <div className="plantaoLinha" key={p.id}>
          <span className="plantaoQuando">
            <strong>{p.data.slice(8, 10)}/{p.data.slice(5, 7)}</strong>
            <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)} · {p.horas}h</small>
          </span>
          <span className="plantaoOnde">
            <strong>{nomePorId.get(p.perfil_id) ?? "Colega"}</strong>
            <small>{p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local"}</small>
          </span>
          <b>{money(Number(p.valor))}</b>
          <button className="primaryClinical compact" disabled={ocupado === p.id}
            onClick={() => void assumir(p)}>
            {ocupado === p.id ? "Assumindo…" : "Assumir"}
          </button>
        </div>
      ))}

      {meus.length > 0 && (
        <>
          <div className="panelTitle"><strong>Oferecidos por você</strong><span>aguardando alguém assumir</span></div>
          {meus.map((p) => (
            <div className="plantaoLinha" key={p.id}>
              <span className="plantaoQuando">
                <strong>{p.data.slice(8, 10)}/{p.data.slice(5, 7)}</strong>
                <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)}</small>
              </span>
              <span className="plantaoOnde">
                <strong>{p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local"}</strong>
              </span>
              <span className="statusChip waiting">aguardando</span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
