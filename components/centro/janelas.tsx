"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Janela } from "@/components/janela";
import { horaLocal } from "@/lib/data-local";
import { CONVENIOS } from "@/lib/convenios";
import {
  ALDRETE, ALDRETE_PARA_ALTA, CAMPOS_DO_CASO, NOME_DA_ETAPA, NOME_DO_DESTINO, altaDaRpa, avisoDoAldrete, cancelar,
  conferirHorario, desfazer, entrarEmSala, formDoCaso, formVazio, horaDe, instanteDoPasso, linhaDoForm,
  rotuloDoDesfazer, sairDaSala, somaAldrete,
  type Caso, type Destino, type FormDoCaso, type Mudanca, type Passo, type Sala,
} from "@/lib/centro-cirurgico";
import type { Anestesista } from "./mapa-cirurgico";
import estilos from "./mapa.module.css";

type Gravar = (id: string, mudanca: Mudanca) => Promise<string>;

/** O erro do banco em português. As travas do gatilho já falam português. */
export function mensagemDoBanco(m: string): string {
  if (/row-level security/i.test(m)) return "Você não tem permissão para mexer no mapa.";
  if (/centro_casos_sala_em_ordem/.test(m)) return "A saída da sala não pode ser antes da entrada.";
  if (/centro_casos_rpa_em_ordem/.test(m)) return "A alta da RPA não pode ser antes da saída da sala.";
  if (/centro_salas_nome_unico|duplicate key/i.test(m)) return "Já existe uma sala com esse nome.";
  if (/check constraint/i.test(m)) return "Algum campo está fora do formato. Confira e tente de novo.";
  return m;
}

// ---------------------------------------------------------------------------
// O paciente: marcar no mapa e corrigir
// ---------------------------------------------------------------------------

/**
 * Marcar o paciente no mapa, ou corrigir o que foi marcado.
 *
 * O anestesista vem sugerido pela escala do horário — quem está de plantão às
 * 9h é quem anestesia às 9h —, e continua trocável: a sugestão para de
 * acompanhar o horário no momento em que alguém escolhe outro nome.
 */
export function JanelaDoCaso({
  institutionId, dia, caso, salaInicial, salas, anestesistas, dePlantao, onFechar, onSalvo, onApagado, onCancelar, gravar,
}: {
  institutionId: string;
  dia: string;
  caso: Caso | null;
  salaInicial: string;
  salas: Sala[];
  anestesistas: Anestesista[];
  dePlantao: (data: string, horario: string | null) => string[];
  onFechar: () => void;
  onSalvo: (c: Caso) => void;
  onApagado: (id: string) => void;
  onCancelar: (c: Caso) => void;
  gravar: Gravar;
}) {
  const [form, setForm] = useState<FormDoCaso>(() => {
    if (caso) return formDoCaso(caso);
    return { ...formVazio(dia, salaInicial), anestesista_id: dePlantao(dia, null)[0] ?? "" };
  });
  const [escolheuAnestesista, setEscolheu] = useState(Boolean(caso));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmaApagar, setConfirmaApagar] = useState(false);
  const plantao = useMemo(() => dePlantao(form.data, form.horario || null), [dePlantao, form.data, form.horario]);
  const nome = (id: string) => anestesistas.find((a) => a.id === id)?.apelido ?? "";
  const salasDaLista = salas.filter((s) => s.ativa || s.id === form.sala_id);
  const sugestoes = useMemo(() => [...new Set(["SUS", ...CONVENIOS])], []);

  const mudar = (k: keyof FormDoCaso, v: string) => {
    const novo = { ...form, [k]: v };
    // A sugestão do plantão acompanha o horário e o dia até alguém escolher.
    if ((k === "horario" || k === "data") && !escolheuAnestesista) {
      novo.anestesista_id = dePlantao(novo.data, novo.horario || null)[0] ?? "";
    }
    setForm(novo);
  };

  async function salvar() {
    const r = linhaDoForm(form);
    if (!r.ok) { setErro(r.erro); return; }
    setOcupado(true); setErro("");
    const sb = createClient();
    const pedido = caso
      ? sb.from("centro_casos").update(r.linha).eq("id", caso.id)
      : sb.from("centro_casos").insert({ institution_id: institutionId, ...r.linha });
    const { data, error } = await pedido.select(CAMPOS_DO_CASO).maybeSingle();
    setOcupado(false);
    if (error) { setErro(mensagemDoBanco(error.message)); return; }
    if (!data) { setErro("Não foi possível gravar. Recarregue a página e tente de novo."); return; }
    onSalvo(data as unknown as Caso);
  }

  async function apagar() {
    if (!caso) return;
    if (!confirmaApagar) { setConfirmaApagar(true); return; }
    setOcupado(true); setErro("");
    const { error, count } = await createClient().from("centro_casos").delete({ count: "exact" }).eq("id", caso.id);
    setOcupado(false);
    if (error) { setErro(mensagemDoBanco(error.message)); return; }
    if (!count) { setErro("Só se apaga o paciente que ainda não entrou em sala. Depois disso, cancele."); return; }
    onApagado(caso.id);
  }

  async function voltarEtapa() {
    if (!caso) return;
    const m = desfazer(caso);
    if (!m) return;
    setOcupado(true); setErro("");
    const e = await gravar(caso.id, m);
    setOcupado(false);
    if (e) setErro(e); else onFechar();
  }

  const voltar = caso ? rotuloDoDesfazer(caso) : null;
  return (
    <Janela
      titulo={caso ? "Editar paciente do mapa" : "Paciente no mapa"}
      subtitulo={caso ? `${caso.paciente} · ${NOME_DA_ETAPA[caso.etapa]}` : "Só nome, cirurgia e data são obrigatórios."}
      onFechar={onFechar}
      largura="media"
      rodape={
        <>
          <button type="button" className="outlineClinical compact" onClick={onFechar} disabled={ocupado}>Voltar</button>
          <button type="button" className="primaryClinical compact" onClick={() => void salvar()} disabled={ocupado}>
            {ocupado ? "Salvando…" : caso ? "Salvar" : "Pôr no mapa"}
          </button>
        </>
      }
    >
      <div className={estilos.formGrade}>
        <label className={`clinicalField ${estilos.campoLargo}`}><span>Paciente *</span>
          <input value={form.paciente} onChange={(e) => mudar("paciente", e.target.value)} autoComplete="off"
            placeholder="Nome do paciente" data-foco-inicial /></label>
        <label className="clinicalField"><span>Idade</span>
          <input value={form.idade} onChange={(e) => mudar("idade", e.target.value.replace(/\D/g, "").slice(0, 3))}
            inputMode="numeric" placeholder="anos" /></label>
        <label className="clinicalField"><span>Atendimento / prontuário</span>
          <input value={form.prontuario} onChange={(e) => mudar("prontuario", e.target.value)} maxLength={40} /></label>
        <label className={`clinicalField ${estilos.campoLargo}`}><span>Cirurgia *</span>
          <input value={form.procedimento} onChange={(e) => mudar("procedimento", e.target.value)}
            placeholder="Ex.: Colecistectomia videolaparoscópica" /></label>
        <label className="clinicalField"><span>Cirurgião</span>
          <input value={form.cirurgiao} onChange={(e) => mudar("cirurgiao", e.target.value)} /></label>
        <label className="clinicalField"><span>Convênio</span>
          <input value={form.convenio} onChange={(e) => mudar("convenio", e.target.value)} list="mapa-convenios" />
          <datalist id="mapa-convenios">{sugestoes.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="clinicalField"><span>Data *</span>
          <input type="date" value={form.data} onChange={(e) => mudar("data", e.target.value)} /></label>
        <label className="clinicalField"><span>Horário</span>
          <input type="time" value={form.horario} onChange={(e) => mudar("horario", e.target.value)} /></label>
        <label className="clinicalField"><span>Sala</span>
          <select value={form.sala_id} onChange={(e) => mudar("sala_id", e.target.value)}>
            <option value="">Sem sala</option>
            {salasDaLista.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.ativa ? "" : " (desativada)"}</option>)}
          </select></label>
        <label className="clinicalField"><span>Anestesista</span>
          <select value={form.anestesista_id} onChange={(e) => { setEscolheu(true); mudar("anestesista_id", e.target.value); }}>
            <option value="">A definir</option>
            {anestesistas.map((a) => (
              <option key={a.id} value={a.id}>{a.apelido}{plantao.includes(a.id) ? " · de plantão" : ""}</option>
            ))}
          </select>
          <small className={estilos.dica}>
            {plantao.length
              ? `De plantão${form.horario ? ` às ${form.horario}` : " no dia"}: ${plantao.map(nome).filter(Boolean).join(", ")}.`
              : "Ninguém na escala neste horário."}
          </small></label>
        <label className={`clinicalField ${estilos.campoLargo}`}><span>Observações</span>
          <textarea rows={2} value={form.observacoes} onChange={(e) => mudar("observacoes", e.target.value)} maxLength={500}
            placeholder="Ex.: alergia a látex, precisa de vaga de UTI" /></label>
      </div>

      {caso && (
        <section className={estilos.secaoEtapa} aria-label="Etapa">
          <p>
            <b>{NOME_DA_ETAPA[caso.etapa]}</b>
            {[caso.entrada_sala_em && `entrou ${horaDe(caso.entrada_sala_em)}`,
              caso.saida_sala_em && `saiu ${horaDe(caso.saida_sala_em)}`,
              caso.alta_rpa_em && `alta ${horaDe(caso.alta_rpa_em)}`].filter(Boolean).map((t) => ` · ${t}`)}
          </p>
          <div className={estilos.botoesEtapa}>
            {voltar && (
              <button type="button" className="outlineClinical compact" onClick={() => void voltarEtapa()} disabled={ocupado}>
                {voltar}
              </button>
            )}
            {caso.etapa !== "cancelado" && caso.etapa !== "concluido" && (
              <button type="button" className={`outlineClinical compact ${estilos.perigoTexto}`} onClick={() => onCancelar(caso)} disabled={ocupado}>
                Cancelar cirurgia
              </button>
            )}
            {caso.etapa === "agendado" && (
              <button type="button" className={confirmaApagar ? "primaryClinical compact admPerigo" : `outlineClinical compact ${estilos.perigoTexto}`}
                onClick={() => void apagar()} disabled={ocupado}>
                {confirmaApagar ? "Apagar de vez" : "Apagar (lançado por engano)"}
              </button>
            )}
          </div>
        </section>
      )}
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Janela>
  );
}

// ---------------------------------------------------------------------------
// Os passos: entrou em sala, saiu da sala, alta da RPA
// ---------------------------------------------------------------------------

const TITULO_DO_PASSO: Record<Passo["acao"], string> = {
  entrar: "Entrada em sala",
  sair: "Saída da sala",
  alta: "Alta da RPA",
};

/**
 * O registro de um passo. A hora sugerida é agora, e é editável: a
 * enfermagem marca depois do fato com frequência, e a hora certa é a do
 * fato, não a do toque.
 */
export function JanelaDoPasso({ caso, acao, gravar, onFechar, onFeito }: {
  caso: Caso; acao: Passo["acao"]; gravar: Gravar; onFechar: () => void; onFeito: () => void;
}) {
  const [hora, setHora] = useState(() => horaLocal());
  const [para, setPara] = useState<"rpa" | "uti">("rpa");
  const [pontos, setPontos] = useState<Record<string, number>>({});
  const [destino, setDestino] = useState<Destino>("quarto");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const total = somaAldrete(pontos);
  const aviso = avisoDoAldrete(total);

  async function confirmar() {
    if (!/^\d{2}:\d{2}$/.test(hora)) { setErro("Informe o horário."); return; }
    const agora = Date.now();
    const ms = instanteDoPasso(caso, acao, hora, agora);
    const problema = conferirHorario(caso, acao, ms, agora);
    if (problema) { setErro(problema); return; }
    if (acao === "alta" && total == null) { setErro("Marque os cinco itens do Aldrete."); return; }
    const quando = new Date(ms).toISOString();
    const mudanca = acao === "entrar" ? entrarEmSala(quando)
      : acao === "sair" ? sairDaSala(quando, para)
        : altaDaRpa(quando, total, destino);
    setOcupado(true); setErro("");
    const e = await gravar(caso.id, mudanca);
    setOcupado(false);
    if (e) setErro(e); else onFeito();
  }

  const confirmarRotulo = acao === "entrar" ? "Registrar entrada"
    : acao === "sair" ? (para === "uti" ? "Saiu para a UTI" : "Foi para a RPA") : "Dar alta da RPA";
  return (
    <Janela
      titulo={TITULO_DO_PASSO[acao]}
      subtitulo={`${caso.paciente} · ${caso.procedimento}`}
      onFechar={onFechar}
      largura={acao === "alta" ? "media" : "estreita"}
      rodape={
        <>
          <button type="button" className="outlineClinical compact" onClick={onFechar} disabled={ocupado}>Voltar</button>
          <button type="button" className="primaryClinical compact" onClick={() => void confirmar()} disabled={ocupado}>
            {ocupado ? "Salvando…" : confirmarRotulo}
          </button>
        </>
      }
    >
      {acao === "sair" && (
        <fieldset className={estilos.escolhas}>
          <legend>Para onde</legend>
          {([["rpa", "RPA", "Recuperação pós-anestésica"], ["uti", "UTI", "Direto da sala, sem passar pela RPA"]] as const).map(([v, t, d]) => (
            <label key={v} className={estilos.escolha}>
              <input type="radio" name="para" checked={para === v} onChange={() => setPara(v)} />
              <span><b>{t}</b><small>{d}</small></span>
            </label>
          ))}
        </fieldset>
      )}

      <div className={estilos.linhaDaHora}>
        <label className="clinicalField"><span>Horário</span>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} data-foco-inicial /></label>
        <button type="button" className="outlineClinical compact" onClick={() => setHora(horaLocal())}>Agora</button>
      </div>
      {acao === "sair" && caso.entrada_sala_em && <p className={estilos.dica}>Entrou em sala às {horaDe(caso.entrada_sala_em)}.</p>}
      {acao === "alta" && caso.saida_sala_em && <p className={estilos.dica}>Chegou à RPA às {horaDe(caso.saida_sala_em)}.</p>}

      {acao === "alta" && (
        <>
          <fieldset className={estilos.aldrete}>
            <legend>Aldrete e Kroulik</legend>
            {ALDRETE.map((c) => (
              <div key={c.chave} className={estilos.criterio} role="radiogroup" aria-label={c.nome}>
                <span className={estilos.nomeDoCriterio}>{c.nome}</span>
                <div className={estilos.opcoes}>
                  {c.opcoes.map((texto, valor) => (
                    <button key={valor} type="button" role="radio" aria-checked={pontos[c.chave] === valor}
                      className={pontos[c.chave] === valor ? estilos.opcaoMarcada : estilos.opcao}
                      onClick={() => setPontos({ ...pontos, [c.chave]: valor })}>
                      <b>{valor}</b> {texto}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className={estilos.total} aria-live="polite">
              {total == null ? "Marque os cinco itens." : <>Total <b>{total}</b> de 10{total >= ALDRETE_PARA_ALTA && " · critério de alta"}</>}
            </p>
            {aviso && <p className={estilos.aviso} role="status">{aviso}</p>}
          </fieldset>
          <fieldset className={estilos.escolhas}>
            <legend>Destino</legend>
            {(["quarto", "casa", "uti", "outro"] as Destino[]).map((d) => (
              <label key={d} className={estilos.escolha}>
                <input type="radio" name="destino" checked={destino === d} onChange={() => setDestino(d)} />
                <span><b>{NOME_DO_DESTINO[d]}</b></span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Janela>
  );
}

// ---------------------------------------------------------------------------
// Cancelar
// ---------------------------------------------------------------------------

const MOTIVOS = [
  "Paciente sem jejum", "Condição clínica do paciente", "Falta de material ou equipamento",
  "Cirurgião ausente ou atrasado", "Sem vaga de UTI", "Paciente desistiu", "Remarcada",
];

export function JanelaDeCancelar({ caso, gravar, onFechar, onFeito }: {
  caso: Caso; gravar: Gravar; onFechar: () => void; onFeito: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  async function confirmar() {
    if (!motivo.trim()) { setErro("Diga o motivo do cancelamento."); return; }
    setOcupado(true); setErro("");
    const e = await gravar(caso.id, cancelar(motivo));
    setOcupado(false);
    if (e) setErro(e); else onFeito();
  }
  return (
    <Janela
      titulo="Cancelar cirurgia"
      subtitulo={`${caso.paciente} · ${caso.procedimento}`}
      onFechar={onFechar}
      largura="estreita"
      rodape={
        <>
          <button type="button" className="outlineClinical compact" onClick={onFechar} disabled={ocupado}>Voltar</button>
          <button type="button" className="primaryClinical compact admPerigo" onClick={() => void confirmar()} disabled={ocupado}>
            {ocupado ? "Salvando…" : "Cancelar cirurgia"}
          </button>
        </>
      }
    >
      <p className={estilos.dica}>O paciente fica no mapa riscado, com o motivo. Dá para desfazer em “Editar”.</p>
      <div className={estilos.motivos}>
        {MOTIVOS.map((m) => (
          <button key={m} type="button" aria-pressed={motivo === m} onClick={() => setMotivo(m)}>{m}</button>
        ))}
      </div>
      <label className="clinicalField"><span>Motivo *</span>
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} data-foco-inicial /></label>
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Janela>
  );
}

// ---------------------------------------------------------------------------
// As salas
// ---------------------------------------------------------------------------

/**
 * As salas do centro cirúrgico: cada uma é uma coluna do mapa. Não se apaga
 * sala — desativa —, para os mapas antigos continuarem dizendo onde foi.
 */
export function JanelaDasSalas({ institutionId, salas, onMudou, onFechar }: {
  institutionId: string; salas: Sala[]; onMudou: (s: Sala[]) => void; onFechar: () => void;
}) {
  const [lista, setLista] = useState(() => [...salas].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")));
  const [nova, setNova] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const publicar = (s: Sala[]) => { setLista(s); onMudou(s); };

  async function criar(nomes: string[]) {
    const limpos = nomes.map((n) => n.trim()).filter(Boolean);
    if (!limpos.length) return;
    setOcupado(true); setErro("");
    const base = lista.reduce((m, s) => Math.max(m, s.ordem), 0);
    const { data, error } = await createClient().from("centro_salas")
      .insert(limpos.map((nome, i) => ({ institution_id: institutionId, nome, ordem: base + i + 1 })))
      .select("id, nome, ordem, ativa");
    setOcupado(false);
    if (error) { setErro(mensagemDoBanco(error.message)); return; }
    publicar([...lista, ...((data ?? []) as Sala[])]);
    setNova("");
  }

  async function alterar(s: Sala, mudanca: Partial<Sala>) {
    setOcupado(true); setErro("");
    const { data, error } = await createClient().from("centro_salas").update(mudanca).eq("id", s.id)
      .select("id, nome, ordem, ativa").maybeSingle();
    setOcupado(false);
    if (error) { setErro(mensagemDoBanco(error.message)); return false; }
    if (data) publicar(lista.map((x) => (x.id === s.id ? (data as Sala) : x)));
    return true;
  }

  async function mover(i: number, para: number) {
    if (para < 0 || para >= lista.length) return;
    const nova = [...lista];
    [nova[i], nova[para]] = [nova[para], nova[i]];
    setOcupado(true); setErro("");
    const sb = createClient();
    // Renumera tudo de 1 em diante: com ordens repetidas, trocar duas não mudaria nada.
    const mudancas = nova.map((s, j) => ({ s, ordem: j + 1 })).filter(({ s, ordem }) => s.ordem !== ordem);
    for (const { s, ordem } of mudancas) {
      const { error } = await sb.from("centro_salas").update({ ordem }).eq("id", s.id);
      if (error) { setOcupado(false); setErro(mensagemDoBanco(error.message)); return; }
    }
    setOcupado(false);
    publicar(nova.map((s, j) => ({ ...s, ordem: j + 1 })));
  }

  return (
    <Janela titulo="Salas do centro cirúrgico" subtitulo="Cada sala ativa é uma coluna do mapa." onFechar={onFechar} largura="estreita"
      rodape={<button type="button" className="primaryClinical compact" onClick={onFechar} disabled={ocupado}>Pronto</button>}>
      {lista.length === 0 && (
        <div className={estilos.salasVazias}>
          <p>Nenhuma sala ainda.</p>
          <button type="button" className="primaryClinical compact" disabled={ocupado}
            onClick={() => void criar(["Sala 1", "Sala 2", "Sala 3", "Sala 4"])}>Criar Sala 1 a Sala 4</button>
        </div>
      )}
      {lista.length > 0 && (
        <ol className={estilos.salasLista}>
          {lista.map((s, i) => (
            <li key={s.id} className={s.ativa ? estilos.salaLinha : `${estilos.salaLinha} ${estilos.salaInativa}`}>
              <input aria-label={`Nome da ${s.nome}`} defaultValue={s.nome} maxLength={40} disabled={ocupado}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.nome) void alterar(s, { nome: v }); else e.target.value = s.nome; }} />
              <button type="button" className={estilos.mover} onClick={() => void mover(i, i - 1)} disabled={ocupado || i === 0}
                aria-label={`Subir ${s.nome}`}>↑</button>
              <button type="button" className={estilos.mover} onClick={() => void mover(i, i + 1)} disabled={ocupado || i === lista.length - 1}
                aria-label={`Descer ${s.nome}`}>↓</button>
              <button type="button" className="outlineClinical compact" onClick={() => void alterar(s, { ativa: !s.ativa })} disabled={ocupado}>
                {s.ativa ? "Desativar" : "Reativar"}
              </button>
            </li>
          ))}
        </ol>
      )}
      <form className={estilos.novaSala} onSubmit={(e) => { e.preventDefault(); void criar([nova]); }}>
        <label className="clinicalField"><span>Nova sala</span>
          <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Ex.: Sala 5, Sala de parto" maxLength={40} /></label>
        <button type="submit" className="outlineClinical compact" disabled={ocupado || !nova.trim()}>Adicionar</button>
      </form>
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Janela>
  );
}
