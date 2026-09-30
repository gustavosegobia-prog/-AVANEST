"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { Dialogo, Gaveta } from "@/components/admin-ui";
import { PainelRecolhivel } from "@/components/painel-recolhivel";
import { dataLocal, hoje as hojeNoBrasil } from "@/lib/data-local";
import {
  acoesDaConsulta, buscarPacientes, confirmacaoDaConsulta, dataCurtaBr, dataPorExtenso, DESTINO_DA_ACAO,
  ETAPAS_DO_FLUXO, etapaDaConsulta, formatarCPF, formatarTelefone, horaCurta, horaDoInstante, horarioOcupado,
  indicadoresDoDia, medicoDaConsulta, momentoBr, NOME_DA_ACAO, NOME_DA_ETAPA, ordemDaAgenda, proximaDataComConsultas,
  proximoHorarioLivre, somarDiasIso, totaisDoMes, FORA_DO_FLUXO,
  type Acao, type Andamento, type Etapa,
} from "@/lib/recepcao";

// A Recepção: a agenda do dia, a busca de paciente e o balcão.
//
// Tudo aqui é agenda e cadastro. Avaliação, anamnese e dinheiro não passam por
// esta tela — nem pelo que ela pede ao banco: o andamento do atendimento vem
// de andamento_da_agenda, que devolve só a etapa (em atendimento, concluído),
// e as avaliações continuam fechadas para a recepção pelas regras da tabela.

export type PacienteDaRecepcao = {
  id: string; nome: string; cpf: string | null; telefone: string | null;
  hospital?: string | null; cirurgia?: string | null; procedimento?: string | null; convenio?: string | null;
};

export type ConsultaDaRecepcao = {
  id: string; patient_id: string; avaliacao_id: string | null; data: string; horario: string | null;
  status: string; hospital: string | null; procedimento: string | null; convenio: string | null;
  observacoes: string | null; created_at: string;
  medico_id?: string | null; status_at?: string | null; status_by?: string | null; reagendado_de?: string | null;
};

type Evento = { id: string; de: string | null; para: string; por: string | null; em: string; origem: string; detalhe: string | null };
type Medico = { id: string; nome: string };

const NOME_DO_STATUS: Record<string, string> = {
  agendado: "Agendado", confirmado: "Confirmado", presente: "Chegou", faltou: "Faltou",
  cancelado: "Cancelado", reagendado: "Reagendado",
};

const ICONE_DA_ETAPA: Record<Etapa, Parameters<typeof Icone>[0]["nome"]> = {
  agendado: "calendario", aguardando: "ampulheta", em_atendimento: "pessoa", concluido: "confirmado",
  faltou: "alerta", cancelado: "fechar", reagendado: "troca",
};

type FiltroDeEtapa = "todas" | Etapa | "fora";

export function RecepcaoView({
  perfilId, institutionId, pacientes, agendamentos, onNovoPaciente, onAtualizar,
}: {
  perfilId: string;
  institutionId: string;
  pacientes: PacienteDaRecepcao[];
  agendamentos: ConsultaDaRecepcao[];
  onNovoPaciente: () => void;
  onAtualizar: () => void;
}) {
  const hoje = hojeNoBrasil();
  const [dia, setDia] = useState(hoje);
  const [medicoFiltro, setMedicoFiltro] = useState("todos");
  const [etapaFiltro, setEtapaFiltro] = useState<FiltroDeEtapa>("todas");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [menu, setMenu] = useState("");
  const [agendando, setAgendando] = useState<{ paciente: PacienteDaRecepcao | null } | null>(null);
  const [reagendando, setReagendando] = useState<ConsultaDaRecepcao | null>(null);
  const [confirmando, setConfirmando] = useState<{ consulta: ConsultaDaRecepcao; acao: "cancelar" | "falta" } | null>(null);
  const [historicoDe, setHistoricoDe] = useState<ConsultaDaRecepcao | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  // A mudança aparece na hora, e é desfeita se o banco recusar. Some quando a
  // lista nova chega do servidor — `base` é o jeito de o React saber disso sem
  // efeito nenhum.
  const [ajustes, setAjustes] = useState<Record<string, Partial<ConsultaDaRecepcao>>>({});
  const [base, setBase] = useState(agendamentos);
  if (base !== agendamentos) { setBase(agendamentos); setAjustes({}); }
  const consultas = useMemo(
    () => agendamentos.map((c) => (ajustes[c.id] ? { ...c, ...ajustes[c.id] } : c)),
    [agendamentos, ajustes],
  );

  const pacientePorId = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes]);

  // ── O que vem do banco além das props ──────────────────────────────────
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [andamento, setAndamento] = useState<Map<string, Andamento>>(new Map());
  const [andamentoFalhou, setAndamentoFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const supabase = createClient();
      const [{ data: meds }, { data: pessoas }] = await Promise.all([
        supabase.rpc("medicos_da_organizacao"),
        supabase.from("perfis").select("id,nome"),
      ]);
      if (!vivo) return;
      setMedicos((meds ?? []) as Medico[]);
      setNomes(new Map(((pessoas ?? []) as Medico[]).map((p) => [p.id, p.nome])));
    })();
    return () => { vivo = false; };
  }, []);
  const mesDoDia = dia.slice(0, 7);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const de = `${mesDoDia}-01`;
      const ate = somarDiasIso(somarDiasIso(`${mesDoDia}-28`, 4).slice(0, 7) + "-01", -1);
      const { data, error } = await createClient().rpc("andamento_da_agenda", { p_de: de, p_ate: ate });
      if (!vivo) return;
      setAndamentoFalhou(Boolean(error));
      setAndamento(new Map(((data ?? []) as { agendamento_id: string; etapa: Andamento["etapa"]; medico_id: string | null }[])
        .map((r) => [r.agendamento_id, { etapa: r.etapa, medico_id: r.medico_id }])));
    })();
    return () => { vivo = false; };
    // `agendamentos` entra para o andamento acompanhar cada atualização da agenda.
  }, [mesDoDia, agendamentos]);

  const nomeDoMedico = (id: string | null) => (id ? medicos.find((m) => m.id === id)?.nome ?? nomes.get(id) ?? "Médico" : null);

  // ── O dia ──────────────────────────────────────────────────────────────
  const doDia = consultas.filter((c) => c.data === dia).sort(ordemDaAgenda);
  const doDiaDoMedico = doDia.filter((c) => {
    if (medicoFiltro === "todos") return true;
    const m = medicoDaConsulta(c, andamento.get(c.id));
    return medicoFiltro === "sem" ? !m : m === medicoFiltro;
  });
  const indicadores = indicadoresDoDia(doDiaDoMedico, andamento);
  const visiveis = doDiaDoMedico.filter((c) => {
    if (etapaFiltro === "todas") return true;
    const e = etapaDaConsulta(c, andamento.get(c.id));
    return etapaFiltro === "fora" ? ["faltou", "cancelado", "reagendado"].includes(e) : e === etapaFiltro;
  });
  const proxima = proximaDataComConsultas(consultas, dia);
  const totais = totaisDoMes(consultas, mesDoDia);
  const resultados = buscarPacientes(pacientes, busca);

  function irPara(novo: string) {
    setDia(novo); setMenu(""); setAviso(""); setErro("");
  }

  // ── Ações ──────────────────────────────────────────────────────────────
  async function executar(c: ConsultaDaRecepcao, acao: Acao) {
    setMenu("");
    if (acao === "reagendar") { setReagendando(c); return; }
    if ((acao === "cancelar" || acao === "falta") && !confirmando) { setConfirmando({ consulta: c, acao }); return; }
    const destino = DESTINO_DA_ACAO[acao];
    const anterior = { status: c.status, status_at: c.status_at, status_by: c.status_by };
    setOcupado(c.id); setErro(""); setAviso(""); setMenu("");
    setAjustes((a) => ({ ...a, [c.id]: { status: destino, status_at: new Date().toISOString(), status_by: perfilId } }));
    const { error } = await createClient().rpc("registrar_presenca", { p_agendamento_id: c.id, p_status: destino });
    setOcupado("");
    setConfirmando(null);
    const nome = pacientePorId.get(c.patient_id)?.nome ?? "Paciente";
    if (error) {
      setAjustes((a) => ({ ...a, [c.id]: anterior }));
      // A mensagem do banco diz o porquê ("Chegada e falta só podem ser
      // registradas no dia da consulta ou depois") — traduzir apagaria isso.
      setErro(`${NOME_DA_ACAO[acao]}: ${error.message}`);
      return;
    }
    setAviso(({
      confirmar: `Consulta de ${nome} confirmada.`,
      desfazer_confirmacao: `Confirmação de ${nome} desfeita.`,
      chegada: `Chegada de ${nome} registrada às ${horaDoInstante(new Date().toISOString())}.`,
      desfazer_chegada: `Chegada de ${nome} desfeita.`,
      falta: `Falta de ${nome} registrada.`,
      cancelar: `Consulta de ${nome} cancelada.`,
      reativar: `Consulta de ${nome} reativada.`,
      reagendar: "",
    } as Record<Acao, string>)[acao]);
    onAtualizar();
  }

  /** "Chegou às 09:12 · por Ana" — só quando o banco guardou quem e quando. */
  function carimbo(c: ConsultaDaRecepcao): string | null {
    if (!c.status_at || c.status === "agendado") return null;
    const quem = c.status_by ? (c.status_by === perfilId ? "você" : nomes.get(c.status_by) ?? null) : null;
    const diaDoCarimbo = dataLocal(new Date(c.status_at));
    const quando = diaDoCarimbo === hoje
      ? `às ${horaDoInstante(c.status_at)}`
      : `em ${dataCurtaBr(diaDoCarimbo)} às ${horaDoInstante(c.status_at)}`;
    const oque = ({ confirmado: "Confirmada", presente: "Chegou", faltou: "Falta registrada", cancelado: "Cancelada", reagendado: "Reagendada" } as Record<string, string>)[c.status];
    return oque ? `${oque} ${quando}${quem ? ` · por ${quem}` : ""}` : null;
  }

  const rotuloDoDia = dia === hoje ? "hoje" : dia === somarDiasIso(hoje, 1) ? "amanhã" : dataCurtaBr(dia);

  return (
    <div className="clinicalMain receptionMain">
      <section className="clinicalWelcome recTopo">
        <div>
          <h1>Recepção</h1>
          <p>Agenda, chegada e cadastro — sem acesso a dados clínicos ou financeiros.</p>
        </div>
        {/* UMA AÇÃO SÓ NO TOPO. Todo paciente que passa pela recepção sai com
            consulta, e o cadastro já marca a primeira. Para quem já é
            cadastrado (outra cirurgia), "Agendar consulta" fica no resultado
            da busca, ao lado do nome. */}
        <div className="recTopoAcoes">
          <button type="button" className="primaryClinical recAgendar" data-acao="novo-paciente" onClick={onNovoPaciente}>
            + Novo paciente
          </button>
        </div>
      </section>

      {/* BUSCA NA ENTRADA. Nome, CPF ou telefone; do resultado sai a ação. Não
          achou? O cadastro novo confere o CPF antes de salvar — é o que evita
          o paciente em dobro. */}
      <section className="clinicalPanel recBusca" role="search">
        <label htmlFor="rec-busca" className="recBuscaCampo">
          <Icone nome="busca" tamanho={18} />
          <input id="rec-busca" ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar paciente por nome, CPF ou telefone" autoComplete="off"
            aria-describedby="rec-busca-dica" />
          {busca && <button type="button" className="recLimpar" onClick={() => { setBusca(""); buscaRef.current?.focus(); }} aria-label="Limpar busca"><Icone nome="fechar" tamanho={14} /></button>}
        </label>
        <small id="rec-busca-dica">Digite ao menos 2 letras, ou 3 números do CPF ou do telefone.</small>
        {busca.trim().length >= 2 && (
          <div className="recResultados" aria-live="polite">
            {resultados.length === 0 ? (
              <div className="recSemResultado">
                <span>Nenhum paciente encontrado para “{busca.trim()}”.</span>
                <button type="button" className="outlineClinical" onClick={onNovoPaciente}>Cadastrar novo paciente</button>
              </div>
            ) : (
              <ul>
                {resultados.map((p) => {
                  const futuras = consultas.filter((c) => c.patient_id === p.id && c.data >= hoje && !FORA_DO_FLUXO(c.status)).sort((a, b) => a.data.localeCompare(b.data));
                  return (
                    <li key={p.id} className="recResultado">
                      <span>
                        <strong>{p.nome}</strong>
                        <small>{formatarCPF(p.cpf)} · {formatarTelefone(p.telefone)}</small>
                        <small>{futuras.length
                          ? `Próxima consulta: ${dataCurtaBr(futuras[0].data)}${futuras[0].horario ? ` às ${horaCurta(futuras[0].horario)}` : ""}`
                          : "Sem consulta marcada"}</small>
                      </span>
                      <span className="recResultadoAcoes">
                        {futuras[0] && <button type="button" className="outlineClinical" onClick={() => { irPara(futuras[0].data); setBusca(""); }}>Ver na agenda</button>}
                        <button type="button" className="primaryClinical compact" onClick={() => setAgendando({ paciente: p })}>Agendar consulta</button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {erro && <p className="clinicalError" role="alert">{erro}</p>}
      {aviso && <p className="financeSuccess" role="status">{aviso}</p>}

      {/* OS NÚMEROS DO DIA ESCOLHIDO — e do médico escolhido, se houver. Os do
          mês ficam embaixo, recolhidos: no balcão a pergunta é "quem falta
          chegar agora", não "quantos no mês". */}
      <section className="metricGrid recIndicadores" aria-label={`Indicadores de ${rotuloDoDia}`}>
        {([
          ["Previstas", indicadores.previstas, "blue", "calendario"],
          ["Confirmações pendentes", indicadores.confirmacoesPendentes, "amber", "alerta"],
          ["Aguardando", indicadores.aguardando, "amber", "ampulheta"],
          ["Em atendimento", indicadores.emAtendimento, "blue", "pessoa"],
          ["Concluídas", indicadores.concluidas, "green", "confirmado"],
        ] as [string, number, string, Parameters<typeof Icone>[0]["nome"]][]).map(([rotulo, valor, tom, icone]) => (
          <div className="metricCard" key={rotulo}>
            <strong className={tom}>{valor}</strong>
            <span><Icone nome={icone} tamanho={13} /> {rotulo} {rotuloDoDia === "hoje" ? "hoje" : `em ${rotuloDoDia}`}</span>
          </div>
        ))}
      </section>
      {andamentoFalhou && (
        <p className="plantaoNota" role="status">
          Não foi possível ler o andamento dos atendimentos agora. Chegada e confirmação continuam valendo;
          “Em atendimento” e “Concluídas” podem estar desatualizados.
        </p>
      )}

      <section className="clinicalPanel recAgenda" data-secao="hoje">
        <div className="recBarra">
          <div className="plantaoMesNav recNavDia">
            <button type="button" className="outlineClinical" onClick={() => irPara(somarDiasIso(dia, -1))} aria-label="Dia anterior">‹</button>
            <label className="recData">
              <span className="sr-only">Data da agenda</span>
              <input type="date" value={dia} onChange={(e) => e.target.value && irPara(e.target.value)} />
            </label>
            <button type="button" className="outlineClinical" onClick={() => irPara(somarDiasIso(dia, 1))} aria-label="Próximo dia">›</button>
            <button type="button" className="outlineClinical" disabled={dia === hoje} onClick={() => irPara(hoje)}>Hoje</button>
          </div>
          <label className="recFiltro">
            <span>Médico</span>
            <select value={medicoFiltro} onChange={(e) => setMedicoFiltro(e.target.value)}>
              <option value="todos">Todos</option>
              {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              <option value="sem">Sem médico definido</option>
            </select>
          </label>
        </div>
        <h2 className="recDiaTitulo">
          {dataPorExtenso(dia).replace(/^./, (c) => c.toUpperCase())}
          {dia === hoje && <em> · hoje</em>}
        </h2>

        {/* AS ETAPAS, com a contagem de cada uma. Tocar filtra a lista. */}
        <div className="recEtapas" role="group" aria-label="Filtrar por etapa do atendimento">
          <button type="button" aria-pressed={etapaFiltro === "todas"} onClick={() => setEtapaFiltro("todas")}>
            Todas <b>{doDiaDoMedico.length}</b>
          </button>
          {ETAPAS_DO_FLUXO.map(([e, nome]) => {
            const n = doDiaDoMedico.filter((c) => etapaDaConsulta(c, andamento.get(c.id)) === e).length;
            return (
              <button type="button" key={e} className={`etapa-${e}`} aria-pressed={etapaFiltro === e} onClick={() => setEtapaFiltro(e)}>
                <Icone nome={ICONE_DA_ETAPA[e]} tamanho={13} /> {nome} <b>{n}</b>
              </button>
            );
          })}
          <button type="button" aria-pressed={etapaFiltro === "fora"} onClick={() => setEtapaFiltro("fora")}>
            <Icone nome="alerta" tamanho={13} /> Faltas e desmarcadas <b>{indicadores.faltas + indicadores.canceladas + doDiaDoMedico.filter((c) => c.status === "reagendado").length}</b>
          </button>
        </div>

        {visiveis.length === 0 ? (
          <div className="emptyClinical recVazio">
            <p>
              {doDia.length === 0
                ? `Nenhuma consulta marcada para ${rotuloDoDia === "hoje" ? "hoje" : dataCurtaBr(dia)}.`
                : "Nenhuma consulta com este filtro."}
            </p>
            <div>
              {doDia.length > 0 && (
                <button type="button" className="outlineClinical" onClick={() => { setEtapaFiltro("todas"); setMedicoFiltro("todos"); }}>Limpar filtros</button>
              )}
              {proxima && (
                <button type="button" className="outlineClinical" onClick={() => irPara(proxima)}>
                  Ver próxima data com consultas ({dataCurtaBr(proxima)})
                </button>
              )}
            </div>
          </div>
        ) : (
          <ol className="recAgendaLista">
            {visiveis.map((c) => {
              const p = pacientePorId.get(c.patient_id);
              const and = andamento.get(c.id);
              const etapa = etapaDaConsulta(c, and);
              const conf = confirmacaoDaConsulta(c);
              const acoes = acoesDaConsulta(c, hoje);
              const [principal, ...outras] = acoes;
              const medico = nomeDoMedico(medicoDaConsulta(c, and));
              const marca = carimbo(c);
              const trabalhando = ocupado === c.id;
              return (
                <li key={c.id} className={`recLinha etapa-${etapa}`}>
                  <time className={c.horario ? "" : "semHora"}>{c.horario ? horaCurta(c.horario) : "Sem horário"}</time>
                  <div className="recQuem">
                    <strong>{p?.nome ?? "Paciente"}</strong>
                    <small>
                      {[c.procedimento || p?.cirurgia || p?.procedimento, c.hospital || p?.hospital, c.convenio || p?.convenio || "Particular"]
                        .filter(Boolean).join(" · ")}
                    </small>
                    <small className={medico ? "" : "recSemMedico"}>{medico ? `Médico: ${medico}` : "Médico não definido"}</small>
                  </div>
                  <div className="recSituacao">
                    <span className={`recEtapa etapa-${etapa}`}>
                      <Icone nome={ICONE_DA_ETAPA[etapa]} tamanho={13} /> {NOME_DA_ETAPA[etapa]}
                    </span>
                    {conf && etapa === "agendado" && (
                      <span className={`recConfirmacao ${conf}`}>
                        <Icone nome={conf === "confirmada" ? "confirmado" : "alerta"} tamanho={12} />
                        {conf === "confirmada" ? "Confirmada" : "Confirmação pendente"}
                      </span>
                    )}
                    {marca && <small className="recCarimbo">{marca}</small>}
                  </div>
                  <div className="recAcoes">
                    {principal && (
                      <button type="button" className={principal === "chegada" ? "primaryClinical compact" : "outlineClinical"}
                        disabled={trabalhando} aria-busy={trabalhando} onClick={() => void executar(c, principal)}>
                        {trabalhando ? "Salvando…" : NOME_DA_ACAO[principal]}
                      </button>
                    )}
                    <span className="locaisMenu">
                      <button type="button" className="outlineClinical" aria-haspopup="menu" aria-expanded={menu === c.id}
                        aria-label={`Mais ações para ${p?.nome ?? "a consulta"}`} disabled={trabalhando}
                        onClick={() => setMenu(menu === c.id ? "" : c.id)}>Mais ▾</button>
                      {menu === c.id && (
                        <span className="locaisMenuLista" role="menu" onKeyDown={(e) => { if (e.key === "Escape") setMenu(""); }}>
                          {outras.map((a, i) => (
                            <button type="button" role="menuitem" key={a} autoFocus={i === 0}
                              className={a === "cancelar" || a === "falta" ? "perigo" : ""}
                              onClick={() => void executar(c, a)}>
                              {NOME_DA_ACAO[a]}{a === "cancelar" || a === "falta" || a === "reagendar" ? "…" : ""}
                            </button>
                          ))}
                          <button type="button" role="menuitem" autoFocus={outras.length === 0}
                            onClick={() => { setMenu(""); setHistoricoDe(c); }}>
                            Ver histórico
                          </button>
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* OS TOTAIS DO MÊS, recolhidos por padrão: servem para conferir, não
          para trabalhar no balcão. */}
      <PainelRecolhivel chave="recepcao-totais-mes" abrePadrao={false}
        titulo={`Totais de ${new Date(`${mesDoDia}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
        legenda="todas as consultas do mês, de todos os médicos">
        <div className="metricGrid recTotais">
          {([
            ["Marcadas", totais.marcadas], ["Compareceram", totais.compareceram], ["Faltas", totais.faltas],
            ["Canceladas", totais.canceladas], ["Reagendadas", totais.reagendadas],
          ] as [string, number][]).map(([r, v]) => (
            <div className="metricCard" key={r}><strong>{v}</strong><span>{r}</span></div>
          ))}
        </div>
      </PainelRecolhivel>

      {agendando && (
        <AgendarConsulta
          pacienteInicial={agendando.paciente} pacientes={pacientes} consultas={consultas} medicos={medicos}
          diaSugerido={dia >= hoje ? dia : hoje} hoje={hoje} institutionId={institutionId} perfilId={perfilId}
          onNovoPaciente={() => { setAgendando(null); onNovoPaciente(); }}
          onFechar={() => setAgendando(null)}
          onAgendou={(data, nome, horario) => {
            setAgendando(null); setBusca(""); irPara(data);
            setAviso(`Consulta de ${nome} agendada para ${dataCurtaBr(data)} às ${horaCurta(horario)}.`);
            onAtualizar();
          }}
        />
      )}

      {reagendando && (
        <Reagendar consulta={reagendando} nome={pacientePorId.get(reagendando.patient_id)?.nome ?? "Paciente"}
          consultas={consultas} medicos={medicos} hoje={hoje}
          onFechar={() => setReagendando(null)}
          onReagendou={(data, horario) => {
            const nome = pacientePorId.get(reagendando.patient_id)?.nome ?? "Paciente";
            setReagendando(null); irPara(data);
            setAviso(`Consulta de ${nome} reagendada para ${dataCurtaBr(data)} às ${horaCurta(horario)}. A marcação anterior ficou registrada como reagendada.`);
            onAtualizar();
          }}
        />
      )}

      {confirmando && (
        <Dialogo
          titulo={confirmando.acao === "cancelar" ? "Cancelar a consulta?" : "Registrar falta?"}
          confirmar={confirmando.acao === "cancelar" ? "Cancelar consulta" : "Registrar falta"}
          cancelar="Voltar" perigo ocupado={ocupado === confirmando.consulta.id}
          onCancelar={() => setConfirmando(null)}
          onConfirmar={() => void executar(confirmando.consulta, confirmando.acao)}>
          <p>
            <strong>{pacientePorId.get(confirmando.consulta.patient_id)?.nome}</strong> —{" "}
            {dataCurtaBr(confirmando.consulta.data)}{confirmando.consulta.horario ? ` às ${horaCurta(confirmando.consulta.horario)}` : ""}.
          </p>
          <p>
            {confirmando.acao === "cancelar"
              ? "A consulta sai da agenda e dos contadores, e um lançamento financeiro ainda vazio dela é removido. Dá para reativar depois."
              : "A consulta fica registrada como falta, fora da fila do dia. Dá para reagendar ou reativar depois."}
          </p>
        </Dialogo>
      )}

      {historicoDe && (
        <Historico consulta={historicoDe} nome={pacientePorId.get(historicoDe.patient_id)?.nome ?? "Paciente"}
          nomes={nomes} perfilId={perfilId} onFechar={() => setHistoricoDe(null)} />
      )}
    </div>
  );
}

// ── Agendar consulta ───────────────────────────────────────────────────────

function AgendarConsulta({
  pacienteInicial, pacientes, consultas, medicos, diaSugerido, hoje, institutionId, perfilId,
  onNovoPaciente, onFechar, onAgendou,
}: {
  pacienteInicial: PacienteDaRecepcao | null; pacientes: PacienteDaRecepcao[]; consultas: ConsultaDaRecepcao[];
  medicos: Medico[]; diaSugerido: string; hoje: string; institutionId: string; perfilId: string;
  onNovoPaciente: () => void; onFechar: () => void; onAgendou: (data: string, nome: string, horario: string) => void;
}) {
  const [paciente, setPaciente] = useState(pacienteInicial);
  const [termo, setTermo] = useState("");
  const [f, setF] = useState({
    data: diaSugerido, horario: "", medico: "",
    procedimento: pacienteInicial?.cirurgia || pacienteInicial?.procedimento || "",
    hospital: pacienteInicial?.hospital || "", convenio: pacienteInicial?.convenio || "", observacoes: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const enviando = useRef(false);
  const achados = buscarPacientes(pacientes, termo);

  function escolher(p: PacienteDaRecepcao) {
    setPaciente(p);
    setF((x) => ({ ...x, procedimento: p.cirurgia || p.procedimento || "", hospital: p.hospital || "", convenio: p.convenio || "" }));
  }

  async function salvar() {
    if (enviando.current || !paciente) return;
    setErro("");
    if (!f.data || f.data < hoje) { setErro("Escolha uma data de hoje em diante."); return; }
    if (f.horario && horarioOcupado(consultas, f.data, f.horario)) {
      setErro(`Já existe uma consulta às ${f.horario} nesta data. Escolha outro horário ou deixe em branco para o próximo livre.`);
      return;
    }
    enviando.current = true; setSalvando(true);
    const supabase = createClient();
    // O horário livre é calculado com a agenda do BANCO, não só com a da
    // tela: outra recepção pode ter marcado alguém há um minuto.
    const { data: doDia } = await supabase.from("agendamentos").select("id,data,horario,status").eq("data", f.data);
    const horario = f.horario ? `${f.horario}:00`.slice(0, 8) : proximoHorarioLivre(f.data, doDia ?? []);
    if (f.horario && horarioOcupado(doDia ?? [], f.data, f.horario)) {
      enviando.current = false; setSalvando(false);
      setErro(`Já existe uma consulta às ${f.horario} nesta data.`);
      return;
    }
    const { error } = await supabase.from("agendamentos").insert({
      institution_id: institutionId, patient_id: paciente.id, data: f.data, horario,
      procedimento: f.procedimento.trim() || null, hospital: f.hospital.trim() || null,
      convenio: f.convenio.trim() || null, observacoes: f.observacoes.trim() || null,
      medico_id: f.medico || null, created_by: perfilId,
    });
    enviando.current = false; setSalvando(false);
    if (error) { setErro(`Não foi possível agendar: ${error.message}`); return; }
    onAgendou(f.data, paciente.nome, horario);
  }

  return (
    <Gaveta titulo="Agendar consulta" subtitulo={paciente ? paciente.nome : "Escolha o paciente"} onPedirFechar={onFechar}
      rodape={<>
        <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
        <button type="button" className="primaryClinical compact" disabled={!paciente || salvando} onClick={() => void salvar()}>
          {salvando ? "Agendando…" : "Agendar consulta"}
        </button>
      </>}>
      {!paciente ? (
        <div className="recEscolher">
          <label className="clinicalField"><span>Paciente — nome, CPF ou telefone</span>
            <input value={termo} onChange={(e) => setTermo(e.target.value)} autoFocus data-foco-inicial placeholder="Comece a digitar…" />
          </label>
          {termo.trim().length >= 2 && (achados.length ? (
            <ul className="recEscolhaLista">
              {achados.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => escolher(p)}>
                    <strong>{p.nome}</strong><small>{formatarCPF(p.cpf)} · {formatarTelefone(p.telefone)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="recSemResultado">
              Nenhum paciente com este nome, CPF ou telefone.{" "}
              <button type="button" className="outlineClinical" onClick={onNovoPaciente}>Cadastrar novo paciente</button>
            </p>
          ))}
          <p className="campoDica">Paciente novo? O cadastro já marca a primeira consulta, e confere o CPF antes de salvar.</p>
        </div>
      ) : (
        <div className="recForm">
          <p className="recPacienteEscolhido">
            <span><strong>{paciente.nome}</strong><small>{formatarCPF(paciente.cpf)} · {formatarTelefone(paciente.telefone)}</small></span>
            {!pacienteInicial && <button type="button" className="outlineClinical" onClick={() => setPaciente(null)}>Trocar</button>}
          </p>
          <div className="recCampos">
            <label className="clinicalField"><span>Data *</span>
              <input type="date" min={hoje} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} required data-foco-inicial /></label>
            <label className="clinicalField"><span>Horário</span>
              <input type="time" value={f.horario} step={300} onChange={(e) => setF({ ...f, horario: e.target.value })} />
              <small className="campoDica">Em branco: o próximo horário livre.</small></label>
            <label className="clinicalField wide"><span>Médico</span>
              <select value={f.medico} onChange={(e) => setF({ ...f, medico: e.target.value })}>
                <option value="">Não definido</option>
                {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select></label>
            <label className="clinicalField wide"><span>Procedimento / cirurgia</span>
              <input value={f.procedimento} onChange={(e) => setF({ ...f, procedimento: e.target.value })} /></label>
            <label className="clinicalField"><span>Hospital</span>
              <input value={f.hospital} onChange={(e) => setF({ ...f, hospital: e.target.value })} /></label>
            <label className="clinicalField"><span>Convênio</span>
              <input value={f.convenio} onChange={(e) => setF({ ...f, convenio: e.target.value })} placeholder="Particular" /></label>
            <label className="clinicalField wide"><span>Observações</span>
              <textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></label>
          </div>
        </div>
      )}
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Gaveta>
  );
}

// ── Reagendar ──────────────────────────────────────────────────────────────

function Reagendar({
  consulta, nome, consultas, medicos, hoje, onFechar, onReagendou,
}: {
  consulta: ConsultaDaRecepcao; nome: string; consultas: ConsultaDaRecepcao[]; medicos: Medico[]; hoje: string;
  onFechar: () => void; onReagendou: (data: string, horario: string) => void;
}) {
  const [data, setData] = useState(consulta.data >= hoje ? consulta.data : hoje);
  const [horario, setHorario] = useState("");
  const [medico, setMedico] = useState(consulta.medico_id ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro("");
    if (!data || data < hoje) { setErro("Escolha uma data de hoje em diante."); return; }
    if (horario && horarioOcupado(consultas, data, horario, consulta.id)) { setErro(`Já existe uma consulta às ${horario} nesta data.`); return; }
    setSalvando(true);
    const supabase = createClient();
    const { data: doDia } = await supabase.from("agendamentos").select("id,data,horario,status").eq("data", data).neq("id", consulta.id);
    const final = horario ? `${horario}:00`.slice(0, 8) : proximoHorarioLivre(data, doDia ?? []);
    const { error } = await supabase.rpc("reagendar_consulta", {
      p_agendamento_id: consulta.id, p_data: data, p_horario: final, p_medico_id: medico || null,
    });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onReagendou(data, final);
  }

  return (
    <Dialogo titulo={`Reagendar ${nome}`} confirmar="Reagendar" cancelar="Voltar" ocupado={salvando} erro={erro}
      onCancelar={onFechar} onConfirmar={() => void salvar()}>
      <p>
        Hoje marcada para {dataCurtaBr(consulta.data)}{consulta.horario ? ` às ${horaCurta(consulta.horario)}` : ""}.
        A marcação atual fica no histórico como reagendada, e uma nova é criada.
      </p>
      <div className="recCampos">
        <label className="clinicalField"><span>Nova data *</span>
          <input type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label className="clinicalField"><span>Horário</span>
          <input type="time" step={300} value={horario} onChange={(e) => setHorario(e.target.value)} />
          <small className="campoDica">Em branco: o próximo livre.</small></label>
        <label className="clinicalField wide"><span>Médico</span>
          <select value={medico} onChange={(e) => setMedico(e.target.value)}>
            <option value="">Não definido</option>
            {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select></label>
      </div>
    </Dialogo>
  );
}

// ── Histórico ──────────────────────────────────────────────────────────────

function Historico({
  consulta, nome, nomes, perfilId, onFechar,
}: {
  consulta: ConsultaDaRecepcao; nome: string; nomes: Map<string, string>; perfilId: string; onFechar: () => void;
}) {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data, error } = await createClient().from("agendamento_eventos")
        .select("id,de,para,por,em,origem,detalhe").eq("agendamento_id", consulta.id).order("em");
      if (!vivo) return;
      setFalhou(Boolean(error));
      setEventos((data ?? []) as Evento[]);
    })();
    return () => { vivo = false; };
  }, [consulta.id]);

  const quem = (id: string | null) => (id ? (id === perfilId ? "você" : nomes.get(id) ?? "alguém da equipe") : "não registrado");
  const antigos = eventos?.some((e) => e.origem === "auditoria" || e.origem === "ultima_mudanca");

  return (
    <Gaveta titulo="Histórico da consulta" onPedirFechar={onFechar}
      subtitulo={`${nome} · ${dataCurtaBr(consulta.data)}${consulta.horario ? ` às ${horaCurta(consulta.horario)}` : ""}`}>
      {eventos === null ? <p className="emptyClinical compactEmpty">Carregando…</p>
        : falhou ? <p className="clinicalError" role="alert">Não foi possível carregar o histórico.</p>
        : eventos.length === 0 ? <p className="emptyClinical compactEmpty">Nenhum registro para esta consulta.</p>
        : (
          <ol className="recHistorico">
            {eventos.map((e) => (
              <li key={e.id}>
                <time>{momentoBr(e.em)}</time>
                <span>
                  <strong>
                    {e.origem === "criacao"
                      ? (e.detalhe === "reagendamento" ? "Marcada (reagendamento)" : "Marcada")
                      : `${e.de ? `${NOME_DO_STATUS[e.de] ?? e.de} → ` : ""}${NOME_DO_STATUS[e.para] ?? e.para}`}
                  </strong>
                  <small>por {quem(e.por)}</small>
                </span>
              </li>
            ))}
          </ol>
        )}
      {antigos && (
        <p className="campoDica">
          Os registros mais antigos mostram só o que foi gravado na época — a situação nova, quem e quando —,
          sem a situação anterior. Nada foi completado depois.
        </p>
      )}
      {consulta.reagendado_de && <p className="campoDica">Esta consulta nasceu de um reagendamento.</p>}
    </Gaveta>
  );
}
