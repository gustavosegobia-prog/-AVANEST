"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import { dataLocal } from "@/lib/data-local";
import {
  andamentoPelasAvaliacoes, avaliacaoNoEscopo, consultaNoEscopo, cpfMascarado, etapaMedica, semMedico,
  INFORMACOES_INDISPONIVEIS, intervaloDoPeriodo, LEMBRETES_GERAIS, ORIGEM_DOS_LEMBRETES, paraRetomar,
  pendenciasVerificadas, proximoAtendimento, resumoDoDia, TIPOS_DE_DOCUMENTO,
  type AvaliacaoResumo, type Escopo, type Periodo, type Pendencia, type TipoDeDocumento,
} from "@/lib/area-medica";
import { dataPorExtenso, horaCurta, momentoBr, NOME_DA_ETAPA, proximaDataComConsultas, FORA_DO_FLUXO, type Etapa } from "@/lib/recepcao";

// A área médica: o dia, as avaliações, as pendências e os documentos.
//
// Quem abre precisa saber, sem procurar: quem é o próximo, quem está
// esperando, o que ficou pela metade e o que exige revisão. Por isso "Meu dia"
// abre com o próximo atendimento, os números do dia e as avaliações para
// retomar — e a agenda vem depois. Uma agenda vazia não esconde uma avaliação
// aberta: as duas coisas aparecem juntas.

export type PacienteDaAreaMedica = {
  id: string; nome: string; cpf: string | null; data_nascimento: string | null;
  procedimento?: string | null; cirurgia?: string | null; hospital?: string | null;
};
export type AvaliacaoDaAreaMedica = AvaliacaoResumo & { dados?: Record<string, unknown> | null };
export type ConsultaDaAreaMedica = {
  id: string; patient_id: string; avaliacao_id: string | null; data: string; horario: string | null; status: string;
  hospital: string | null; procedimento: string | null;
  medico_id?: string | null; status_at?: string | null; status_by?: string | null;
};

type Secao = "agenda" | "avaliacoes" | "pendencias" | "documentos";
type FiltroDoDia = "todas" | Etapa;

const ICONE_DA_ETAPA: Partial<Record<Etapa, Parameters<typeof Icone>[0]["nome"]>> = {
  agendado: "calendario", aguardando: "ampulheta", em_atendimento: "pessoa", concluido: "confirmado",
  faltou: "alerta", cancelado: "fechar", reagendado: "troca",
};

export function AreaMedica({
  perfilId, perfilEhMedico, pacientes, avaliacoes, agendamentos, locais, localAtivo, ocupado, erro, falhasDeCarga,
  onNovaAvaliacao, onAbrirAvaliacao, onRecarregar,
}: {
  perfilId: string;
  perfilEhMedico: boolean;
  pacientes: PacienteDaAreaMedica[];
  avaliacoes: AvaliacaoDaAreaMedica[];
  agendamentos: ConsultaDaAreaMedica[];
  locais: LocalDisponivel[];
  localAtivo: LocalDisponivel | null;
  ocupado: boolean;
  erro: string;
  falhasDeCarga: string[];
  onNovaAvaliacao: () => void;
  onAbrirAvaliacao: (patientId: string, appointmentId?: string, assessmentId?: string | null) => void;
  onRecarregar: () => void;
}) {
  const hoje = dataLocal();
  const [secao, setSecao] = useState<Secao>("agenda");
  // Cada médico entra no que é dele: os pacientes que a recepção lançou para
  // ele. Não há o que escolher — quem indica o médico é a recepção, ao
  // agendar. Quem não atende (administração) vê a equipe.
  const escopo: Escopo = { pessoa: perfilEhMedico ? "meus" : "equipe", local: "todos" };
  const [verSemMedico, setVerSemMedico] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: "hoje" });
  const [filtroDoDia, setFiltroDoDia] = useState<FiltroDoDia>("todas");
  const [busca, setBusca] = useState("");
  const retomarRef = useRef<HTMLElement>(null);
  const agendaRef = useRef<HTMLElement>(null);

  // Nomes de quem atende e de quem registrou — só id e nome.
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data } = await createClient().from("perfis").select("id,nome");
      if (vivo) setNomes(new Map(((data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome])));
    })();
    return () => { vivo = false; };
  }, []);
  const quem = (id: string | null | undefined) => (!id ? null : id === perfilId ? "você" : nomes.get(id) ?? "outro profissional");

  const pacientePorId = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes]);
  const avaliacaoPorId = useMemo(() => new Map(avaliacoes.map((a) => [a.id, a])), [avaliacoes]);
  // A avaliação ABERTA de cada paciente — a mais recente, se estiver em
  // rascunho. É a mesma regra de quem abre a avaliação: com uma aberta, abrir
  // de novo continua aquela, e não cria outra. O botão diz isso.
  const abertaDoPaciente = useMemo(() => {
    const m = new Map<string, AvaliacaoResumo>();
    for (const a of [...avaliacoes].sort((x, y) => y.updated_at.localeCompare(x.updated_at)))
      if (!m.has(a.patient_id)) m.set(a.patient_id, a);
    for (const [k, a] of m) if (a.status !== "rascunho") m.delete(k);
    return m;
  }, [avaliacoes]);
  const localPorId = useMemo(() => new Map(locais.map((l) => [l.id, nomeDoLocal(l)])), [locais]);
  const localAtivoId = localAtivo?.id ?? null;

  const avaliacoesNoEscopo = avaliacoes.filter((a) => avaliacaoNoEscopo(a, escopo, perfilId, localAtivoId));
  const andamento = useMemo(() => andamentoPelasAvaliacoes(agendamentos, avaliacaoPorId), [agendamentos, avaliacaoPorId]);
  const consultasNoEscopo = agendamentos.filter((c) =>
    consultaNoEscopo(c, andamento.get(c.id), escopo, perfilId) || (verSemMedico && semMedico(c, andamento.get(c.id))));
  // Consultas de hoje ainda sem médico: não são de ninguém até a recepção
  // indicar. Um aviso de uma linha, e não uma lista a mais.
  const semMedicoHoje = escopo.pessoa === "meus"
    ? agendamentos.filter((c) => c.data === hoje && !FORA_DO_FLUXO(c.status) && semMedico(c, andamento.get(c.id))).length
    : 0;
  const retomar = paraRetomar(avaliacoesNoEscopo);
  const doDiaDeHoje = consultasNoEscopo.filter((c) => c.data === hoje);
  const resumo = resumoDoDia(doDiaDeHoje, andamento, retomar);
  const proximo = proximoAtendimento(doDiaDeHoje, andamento);
  const pendencias = pendenciasVerificadas(avaliacoesNoEscopo, consultasNoEscopo, hoje);

  const intervalo = intervaloDoPeriodo(periodo, hoje);
  const termo = busca.trim().toLowerCase();
  const daAgenda = consultasNoEscopo
    .filter((c) => c.data >= intervalo.de && c.data <= intervalo.ate)
    .filter((c) => filtroDoDia === "todas" || etapaMedica(c, andamento.get(c.id)) === filtroDoDia)
    .filter((c) => {
      if (!termo) return true;
      const p = pacientePorId.get(c.patient_id);
      const digitos = termo.replace(/\D/g, "");
      return `${p?.nome ?? ""} ${c.procedimento ?? ""} ${p?.procedimento ?? ""} ${p?.cirurgia ?? ""}`.toLowerCase().includes(termo)
        || (digitos.length >= 3 && String(p?.cpf ?? "").includes(digitos));
    })
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horario ?? "99").localeCompare(b.horario ?? "99"));
  const proximaData = proximaDataComConsultas(consultasNoEscopo, intervalo.ate);

  function irParaAgenda(filtro: FiltroDoDia) {
    setSecao("agenda"); setPeriodo({ tipo: "hoje" }); setFiltroDoDia(filtro);
    requestAnimationFrame(() => agendaRef.current?.scrollIntoView({ block: "start" }));
  }
  function irParaRetomar() {
    setSecao("agenda");
    requestAnimationFrame(() => retomarRef.current?.scrollIntoView({ block: "start" }));
  }

  function abrirPendencia(p: Pendencia) {
    if (p.acao === "continuar" && p.avaliacaoId) onAbrirAvaliacao(p.patientId, undefined, p.avaliacaoId);
    else if (p.acao === "iniciar") onAbrirAvaliacao(p.patientId, p.agendamentoId);
    else if (p.acao === "ver_na_agenda") {
      const c = agendamentos.find((x) => x.id === p.agendamentoId);
      if (c) { setSecao("agenda"); setFiltroDoDia("todas"); setPeriodo({ tipo: "dia", dia: c.data }); }
    }
  }

  const identificacao = (patientId: string) => {
    const p = pacientePorId.get(patientId);
    const cpf = cpfMascarado(p?.cpf);
    const nasc = p?.data_nascimento ? `nasc. ${p.data_nascimento.split("-").reverse().join("/")}` : null;
    return [cpf ? `CPF ${cpf}` : null, nasc].filter(Boolean).join(" · ") || "Sem CPF ou nascimento no cadastro";
  };

  // O id vira data-secao — é por ele que o tutorial acha cada item.
  const secoes: [Secao, string, number | null][] = [
    ["agenda", "Meu dia", resumo.agendados + resumo.aguardando + resumo.emAtendimento || null],
    ["avaliacoes", "Avaliações", retomar.length || null],
    ["pendencias", "Pendências", pendencias.length || null],
    ["documentos", "Documentos", null],
  ];

  return (
    <div className="clinicalMain medMain">
      <section className="clinicalWelcome medTopo">
        <div>
          <h1>Área médica</h1>
          {/* Só a data: o local já está na barra do topo, ao lado da marca. */}
          <p className="medOnde">
            <span><Icone nome="calendario" tamanho={14} /> {dataPorExtenso(hoje).replace(/^./, (x) => x.toUpperCase())}</span>
          </p>
        </div>
        <button type="button" className="primaryClinical" data-acao="novo-paciente" onClick={onNovaAvaliacao}>+ Nova avaliação</button>
      </section>

      {erro && <p className="clinicalError" role="alert">{erro}</p>}
      {falhasDeCarga.length > 0 && (
        <p className="clinicalError" role="alert">
          Não foi possível carregar {falhasDeCarga.join(" e ")} agora — o que aparece abaixo pode estar incompleto.{" "}
          <button type="button" className="outlineClinical" onClick={onRecarregar}>Tentar de novo</button>
        </p>
      )}

      <div className="financeLayout">
        <nav className="financeTarefas" aria-label="Seções da área médica">
          {secoes.map(([id, rotulo, n]) => (
            <button type="button" key={id} data-secao={id} className={secao === id ? "active" : ""}
              aria-current={secao === id ? "true" : undefined} onClick={() => setSecao(id)}>
              <span>{rotulo}</span>
              {n ? <b className="financeTarefaContador">{n}</b> : null}
            </button>
          ))}
        </nav>

        <div className="financeConteudo">
          {secao === "agenda" && (
            <>
              {proximo ? (
                <section className="clinicalPanel medProximo" aria-label="Próximo atendimento">
                  <span className="medProximoRotulo">Próximo atendimento</span>
                  <time>{proximo.horario ? horaCurta(proximo.horario) : "Sem horário"}</time>
                  <span className="medProximoQuem">
                    <strong>{pacientePorId.get(proximo.patient_id)?.nome ?? "Paciente"}</strong>
                    <small>{proximo.procedimento || pacientePorId.get(proximo.patient_id)?.procedimento || "Procedimento não informado"} · {NOME_DA_ETAPA[etapaMedica(proximo, andamento.get(proximo.id))]}</small>
                  </span>
                  <AcaoDaConsulta c={proximo} av={proximo.avaliacao_id ? avaliacaoPorId.get(proximo.avaliacao_id) : undefined}
                    aberta={abertaDoPaciente.get(proximo.patient_id)} quem={quem} ocupado={ocupado} onAbrir={onAbrirAvaliacao} />
                </section>
              ) : null}

              <section className="metricGrid medResumo" aria-label="Hoje">
                {([
                  ["Agendados hoje", resumo.agendados, "blue", "calendario", "agendado"],
                  ["Aguardando atendimento", resumo.aguardando, "amber", "ampulheta", "aguardando"],
                  ["Em atendimento", resumo.emAtendimento, "blue", "pessoa", "em_atendimento"],
                  ["Avaliações em andamento", resumo.emAndamento, "amber", "nota", "retomar"],
                ] as [string, number, string, Parameters<typeof Icone>[0]["nome"], FiltroDoDia | "retomar"][]).map(([rotulo, valor, tom, icone, destino]) => (
                  <button type="button" className="metricCard medCartao" key={rotulo} disabled={valor === 0}
                    onClick={() => (destino === "retomar" ? irParaRetomar() : irParaAgenda(destino))}
                    title={destino === "em_atendimento" ? "Paciente que chegou e já tem avaliação aberta nesta consulta"
                      : destino === "retomar" ? "Toda avaliação iniciada e não concluída, de qualquer dia" : rotulo}>
                    <strong className={valor ? tom : ""}>{valor}</strong>
                    <span><Icone nome={icone} tamanho={13} /> {rotulo}</span>
                  </button>
                ))}
              </section>
              {semMedicoHoje > 0 && (
                <p className="medSemMedico">
                  {semMedicoHoje === 1 ? "1 consulta de hoje está" : `${semMedicoHoje} consultas de hoje estão`} sem médico definido — a recepção indica o médico ao agendar.{" "}
                  <button type="button" className="linkLimpo" aria-pressed={verSemMedico} onClick={() => setVerSemMedico(!verSemMedico)}>
                    {verSemMedico ? "Ocultar" : "Ver na agenda"}
                  </button>
                </p>
              )}

              {retomar.length > 0 && (
                <section className="clinicalPanel medRetomar" ref={retomarRef} aria-label="Avaliações para retomar">
                  <div className="panelTitle"><strong>Avaliações para retomar</strong><span>{retomar.length === 1 ? "1 avaliação" : `${retomar.length} avaliações`}</span></div>
                  <ol className="medLista">
                    {retomar.map((a) => {
                      const outroLocal = a.local_atendimento_id && localAtivoId && a.local_atendimento_id !== localAtivoId;
                      return (
                        <li key={a.id} className="medLinha">
                          <span className="medQuem">
                            <strong>{pacientePorId.get(a.patient_id)?.nome ?? "Paciente não localizado"}</strong>
                            <small>{identificacao(a.patient_id)}</small>
                            <small>
                              Iniciada em {momentoBr(a.created_at)} · última alteração {momentoBr(a.updated_at)}
                              {escopo.pessoa === "equipe" && quem(a.created_by) ? ` · por ${quem(a.created_by)}` : ""}
                            </small>
                          </span>
                          <span className={`medLocal${outroLocal ? " outro" : ""}`}>
                            {outroLocal && <Icone nome="alerta" tamanho={12} />}
                            {a.local_atendimento_id ? `${outroLocal ? "Outro local: " : ""}${localPorId.get(a.local_atendimento_id) ?? "Local"}` : "Sem local registrado"}
                          </span>
                          <button type="button" className="primaryClinical compact" disabled={ocupado}
                            onClick={() => onAbrirAvaliacao(a.patient_id, undefined, a.id)}
                            aria-label={`Continuar a avaliação de ${pacientePorId.get(a.patient_id)?.nome ?? "paciente"}${outroLocal ? `, feita em ${localPorId.get(a.local_atendimento_id!) ?? "outro local"}` : ""}`}>
                            Continuar
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              <section className="clinicalPanel medAgenda" ref={agendaRef} aria-label="Agenda">
                <div className="medAgendaBarra">
                  <div className="escalaVisoes" role="group" aria-label="Período">
                    {([["hoje", "Hoje"], ["amanha", "Amanhã"], ["semana", "Semana"]] as [Periodo["tipo"], string][]).map(([t, r]) => (
                      <button type="button" key={t} aria-pressed={periodo.tipo === t} className={periodo.tipo === t ? "ativo" : ""}
                        onClick={() => setPeriodo({ tipo: t })}>{r}</button>
                    ))}
                  </div>
                  <label className="medCampo"><span>Data</span>
                    <input type="date" value={periodo.tipo === "dia" ? periodo.dia : ""} onChange={(e) => e.target.value && setPeriodo({ tipo: "dia", dia: e.target.value })} />
                  </label>
                  <label className="medCampo medBusca"><span>Buscar</span>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Paciente, procedimento ou 3+ números do CPF" />
                  </label>
                </div>
                <p className="medPeriodo" aria-live="polite">
                  <b>{intervalo.rotulo}</b>
                  {filtroDoDia !== "todas" && <> · só “{NOME_DA_ETAPA[filtroDoDia]}” <button type="button" className="linkLimpo" onClick={() => setFiltroDoDia("todas")}>mostrar todos</button></>}
                  {" · "}{daAgenda.length === 1 ? "1 consulta" : `${daAgenda.length} consultas`}
                </p>
                {daAgenda.length === 0 ? (
                  <div className="emptyClinical medVazio">
                    <p>{termo || filtroDoDia !== "todas" ? "Nenhuma consulta com estes filtros neste período." : `Nenhuma consulta agendada — ${intervalo.rotulo.toLowerCase()}.`}</p>
                    <div>
                      {proximaData && (
                        <button type="button" className="outlineClinical" onClick={() => { setFiltroDoDia("todas"); setBusca(""); setPeriodo({ tipo: "dia", dia: proximaData }); }}>
                          Ver próximos agendamentos ({proximaData.slice(8, 10)}/{proximaData.slice(5, 7)})
                        </button>
                      )}
                      {/* Retomar e Nova avaliação não se repetem aqui: a lista para
                          retomar fica logo acima, e Nova avaliação no topo. */}
                    </div>
                  </div>
                ) : (
                  <ol className="medLista">
                    {daAgenda.map((c) => {
                      const p = pacientePorId.get(c.patient_id);
                      const and = andamento.get(c.id);
                      const etapa = etapaMedica(c, and);
                      const av = c.avaliacao_id ? avaliacaoPorId.get(c.avaliacao_id) : undefined;
                      const medico = quem(c.medico_id ?? and?.medico_id);
                      return (
                        <li key={c.id} className={`medLinha medConsulta etapa-${etapa}${FORA_DO_FLUXO(c.status) ? " fora" : ""}`}>
                          <time>
                            {intervalo.de !== intervalo.ate && <small>{c.data.slice(8, 10)}/{c.data.slice(5, 7)}</small>}
                            {c.horario ? horaCurta(c.horario) : <em>Sem horário</em>}
                          </time>
                          <span className="medQuem">
                            <strong>{p?.nome ?? "Paciente não localizado"}</strong>
                            <small>{identificacao(c.patient_id)}</small>
                            <small>{c.procedimento || p?.procedimento || p?.cirurgia || "Procedimento não informado"} · {c.hospital || p?.hospital || "Local não informado"}</small>
                            <small>{medico ? `Responsável: ${medico}` : "Sem médico definido"}</small>
                          </span>
                          <span className={`recEtapa etapa-${etapa}`}>
                            <Icone nome={ICONE_DA_ETAPA[etapa] ?? "calendario"} tamanho={13} /> {NOME_DA_ETAPA[etapa]}
                          </span>
                          <AcaoDaConsulta c={c} av={av} aberta={abertaDoPaciente.get(c.patient_id)} quem={quem} ocupado={ocupado} onAbrir={onAbrirAvaliacao} />
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {pendencias.length > 0 && (
                <p className="medAvisoPendencias">
                  <Icone nome="alerta" tamanho={14} /> {pendencias.length === 1 ? "1 pendência verificada" : `${pendencias.length} pendências verificadas`} neste escopo.{" "}
                  <button type="button" className="linkLimpo" onClick={() => setSecao("pendencias")}>Ver pendências</button>
                </p>
              )}
            </>
          )}

          {secao === "avaliacoes" && (
            <Avaliacoes avaliacoes={avaliacoesNoEscopo} total={avaliacoes.length} pacientePorId={pacientePorId}
              identificacao={identificacao} locais={locais} localPorId={localPorId} quem={quem} ocupado={ocupado}
              onAbrir={onAbrirAvaliacao} onNova={onNovaAvaliacao} />
          )}

          {secao === "pendencias" && (
            <>
              <section className="clinicalPanel medPendencias" aria-label="Pendências verificadas">
                <div className="panelTitle"><strong>Pendências verificadas</strong><span>encontradas nos registros deste escopo</span></div>
                {pendencias.length === 0 ? (
                  <p className="medTranquilo"><Icone nome="confirmado" tamanho={16} /> Nenhuma pendência nos registros deste escopo.</p>
                ) : (
                  <ol className="medLista">
                    {pendencias.map((p) => (
                      <li key={p.id} className="medLinha">
                        <span className="medQuem">
                          <strong>{pacientePorId.get(p.patientId)?.nome ?? "Paciente não localizado"}</strong>
                          <small>{p.motivo}</small>
                          <small>
                            {p.rotuloDaData}: {p.data.length > 10 ? momentoBr(p.data) : p.data.split("-").reverse().join("/")}
                            {quem(p.responsavel) ? ` · ${p.tipo === "chegou_sem_avaliacao" ? "registrada por" : "responsável:"} ${quem(p.responsavel)}` : ""}
                            {p.localId ? ` · ${localPorId.get(p.localId) ?? "Local"}` : ""}
                          </small>
                        </span>
                        <button type="button" className="outlineClinical" disabled={ocupado && p.acao !== "ver_na_agenda"} onClick={() => abrirPendencia(p)}>
                          {p.acao === "continuar" ? "Continuar avaliação" : p.acao === "iniciar" ? "Iniciar avaliação" : "Ver na agenda"}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section className="clinicalPanel medLembretes" aria-label="Lembretes gerais">
                <div className="panelTitle"><strong>Lembretes gerais</strong><span>não se referem a um paciente</span></div>
                <ul>
                  {LEMBRETES_GERAIS.map((l) => <li key={l.titulo}><strong>{l.titulo}</strong><span>{l.texto}</span></li>)}
                </ul>
                <p className="campoDica">{ORIGEM_DOS_LEMBRETES}</p>
              </section>
              <section className="clinicalPanel medLembretes" aria-label="Informações indisponíveis">
                <div className="panelTitle"><strong>Informações indisponíveis</strong><span>o sistema não registra — por isso não viram pendência nem contagem</span></div>
                <ul>
                  {INFORMACOES_INDISPONIVEIS.map((l) => <li key={l.titulo}><strong>{l.titulo}</strong><span>{l.texto}</span></li>)}
                </ul>
              </section>
            </>
          )}

          {secao === "documentos" && (
            <Documentos avaliacoes={avaliacoesNoEscopo} pacientePorId={pacientePorId} identificacao={identificacao}
              localPorId={localPorId} quem={quem} haAlguma={avaliacoes.length > 0} />
          )}
        </div>
      </div>
    </div>
  );
}

/** "Iniciar avaliação" / "Continuar avaliação" / "Ver documentos" — pelo registro que existe. */
function AcaoDaConsulta({ c, av, aberta, quem, ocupado, onAbrir }: {
  c: ConsultaDaAreaMedica; av?: AvaliacaoResumo; aberta?: AvaliacaoResumo; ocupado: boolean;
  quem: (id: string | null | undefined) => string | null;
  onAbrir: (patientId: string, appointmentId?: string, assessmentId?: string | null) => void;
}) {
  if (FORA_DO_FLUXO(c.status)) return <span className="medSemAcao">{c.status === "cancelado" ? "Consulta desmarcada" : "Remarcada em outra data"}</span>;
  if (c.status === "faltou") return <span className="medSemAcao">Falta registrada</span>;
  if (av?.status === "concluida") return <Link className="outlineClinical medAcao" href={`/avaliacoes/${av.id}/documentos`}>Ver documentos</Link>;
  // Sem avaliação ligada, mas com uma aberta para o paciente: abrir continua
  // aquela (não nasce uma segunda), e o botão diz de quem ela é.
  const continua = av?.status === "rascunho" ? av : !av ? aberta : undefined;
  const de = continua && continua !== av && quem(continua.created_by) !== "você" ? quem(continua.created_by) : null;
  return (
    <span className="medAcaoCaixa">
      <button type="button" className="primaryClinical compact medAcao" disabled={ocupado} aria-busy={ocupado}
        onClick={() => onAbrir(c.patient_id, c.id, continua?.id ?? c.avaliacao_id)}>
        {ocupado ? "Abrindo…" : continua ? "Continuar avaliação" : "Iniciar avaliação"}
      </button>
      {de && <small>aberta por {de}</small>}
    </span>
  );
}

// ── Avaliações ─────────────────────────────────────────────────────────────

function Avaliacoes({
  avaliacoes, total, pacientePorId, identificacao, locais, localPorId, quem, ocupado, onAbrir, onNova,
}: {
  avaliacoes: AvaliacaoDaAreaMedica[]; total: number; pacientePorId: Map<string, PacienteDaAreaMedica>;
  identificacao: (id: string) => string; locais: LocalDisponivel[]; localPorId: Map<string, string>;
  quem: (id: string | null | undefined) => string | null; ocupado: boolean;
  onAbrir: (patientId: string, appointmentId?: string, assessmentId?: string | null) => void; onNova: () => void;
}) {
  const [q, setQ] = useState("");
  const [situacao, setSituacao] = useState("todas");
  const [local, setLocal] = useState("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const termo = q.trim().toLowerCase();
  const lista = avaliacoes.filter((a) => {
    const p = pacientePorId.get(a.patient_id);
    const ref = dataLocal(new Date(a.concluida_at || a.updated_at || a.created_at));
    const texto = `${p?.nome ?? ""} ${p?.procedimento ?? ""} ${p?.cirurgia ?? ""} ${p?.hospital ?? ""} ${quem(a.created_by) ?? ""}`.toLowerCase();
    const digitos = termo.replace(/\D/g, "");
    return (situacao === "todas" || a.status === situacao)
      && (local === "todos" || (local === "sem" ? !a.local_atendimento_id : a.local_atendimento_id === local))
      && (!termo || texto.includes(termo) || (digitos.length >= 3 && String(p?.cpf ?? "").includes(digitos)))
      && (!de || ref >= de) && (!ate || ref <= ate);
  }).sort((a, b) => (b.concluida_at || b.updated_at).localeCompare(a.concluida_at || a.updated_at));
  const concluidas = lista.filter((a) => a.status === "concluida");
  const asa = concluidas.filter((a) => ["ASA III", "ASA IV", "ASA V", "ASA VI"].includes(String(a.dados?.asa ?? ""))).length;

  return (
    <section className="clinicalPanel historyPanel">
      <div className="panelTitle"><strong>Avaliações</strong><span>todas as situações, com busca e filtros</span></div>
      {/* Os números descrevem A LISTA ABAIXO — o mesmo recorte, dito em cima. */}
      <p className="medRecorte">
        <b>{lista.length}</b> {lista.length === 1 ? "avaliação" : "avaliações"} com estes filtros ·{" "}
        <b>{concluidas.length}</b> concluída{concluidas.length === 1 ? "" : "s"} ·{" "}
        <b>{lista.length - concluidas.length}</b> em andamento ou canceladas ·{" "}
        <b>{asa}</b> ASA III ou mais entre as concluídas
      </p>
      <div className="historyFilters">
        <label className="historyBusca">Buscar
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, procedimento, hospital, profissional ou 3+ números do CPF" />
        </label>
        <label>Situação
          <select value={situacao} onChange={(e) => setSituacao(e.target.value)}>
            <option value="todas">Todas as situações</option><option value="rascunho">Em andamento</option>
            <option value="concluida">Concluída</option><option value="cancelada">Cancelada</option>
          </select>
        </label>
        {locais.length > 1 && (
          <label>Local
            <select value={local} onChange={(e) => setLocal(e.target.value)}>
              <option value="todos">Todos os locais</option>
              {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
              <option value="sem">Sem local registrado</option>
            </select>
          </label>
        )}
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
      </div>
      {lista.slice(0, 50).map((a) => {
        const p = pacientePorId.get(a.patient_id);
        const feita = a.status === "concluida";
        return (
          <div className="medLinha medHistorico" key={a.id}>
            <span className="medQuem">
              <strong>{p?.nome ?? "Paciente não localizado"}</strong>
              <small>{identificacao(a.patient_id)}</small>
              <small>
                {feita && a.concluida_at ? `Concluída em ${momentoBr(a.concluida_at)}` : `Iniciada em ${momentoBr(a.created_at)} · última alteração ${momentoBr(a.updated_at)}`}
                {a.local_atendimento_id ? ` · ${localPorId.get(a.local_atendimento_id) ?? "Local"}` : " · Sem local registrado"}
                {quem(a.created_by) ? ` · ${quem(a.created_by)}` : ""}
              </small>
            </span>
            <span className={`statusChip ${feita ? "present" : a.status === "cancelada" ? "danger" : "waiting"}`}>
              {feita ? "Concluída" : a.status === "rascunho" ? "Em andamento" : a.status === "cancelada" ? "Cancelada" : a.status}
            </span>
            {feita
              ? <Link className="outlineClinical medAcao" href={`/avaliacoes/${a.id}/documentos`}>Ver documentos</Link>
              : a.status === "rascunho"
                ? <button type="button" className="primaryClinical compact medAcao" disabled={ocupado} onClick={() => onAbrir(a.patient_id, undefined, a.id)}>Continuar</button>
                : <span className="medSemAcao">Sem ação</span>}
          </div>
        );
      })}
      {lista.length === 0 && (total === 0
        ? <div className="emptyClinical compactEmpty"><strong>Ainda não há avaliação nenhuma.</strong> A primeira nasce em <button type="button" className="linkLimpo" onClick={onNova}>Nova avaliação</button>.</div>
        : <div className="emptyClinical compactEmpty">Nenhuma avaliação combina com estes filtros e com o escopo escolhido no alto da tela.</div>)}
      {lista.length > 50 && <div className="historyLimit">Mostrando as 50 mais recentes de {lista.length}. Refine os filtros para ver uma lista menor.</div>}
    </section>
  );
}

// ── Documentos ─────────────────────────────────────────────────────────────

function Documentos({
  avaliacoes, pacientePorId, identificacao, localPorId, quem, haAlguma,
}: {
  avaliacoes: AvaliacaoDaAreaMedica[]; pacientePorId: Map<string, PacienteDaAreaMedica>; identificacao: (id: string) => string;
  localPorId: Map<string, string>; quem: (id: string | null | undefined) => string | null; haAlguma: boolean;
}) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<TipoDeDocumento>("assessment");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const termo = q.trim().toLowerCase();
  const concluidas = avaliacoes.filter((a) => a.status === "concluida");
  const rascunhos = avaliacoes.filter((a) => a.status === "rascunho").length;
  const lista = concluidas.filter((a) => {
    const p = pacientePorId.get(a.patient_id);
    const dia = dataLocal(new Date(a.concluida_at || a.updated_at));
    const digitos = termo.replace(/\D/g, "");
    return (!termo || (p?.nome ?? "").toLowerCase().includes(termo) || (digitos.length >= 3 && String(p?.cpf ?? "").includes(digitos)))
      && (!de || dia >= de) && (!ate || dia <= ate);
  }).sort((a, b) => (b.concluida_at || b.updated_at).localeCompare(a.concluida_at || a.updated_at));
  const nomeDoTipo = TIPOS_DE_DOCUMENTO.find(([t]) => t === tipo)![1];

  return (
    <section className="clinicalPanel medDocumentos">
      <div className="panelTitle"><strong>Documentos</strong><span>gerados a partir de avaliações concluídas</span></div>
      <p className="medRecorte">
        Os documentos existem a partir da conclusão da avaliação e são impressos a partir dela. O sistema registra que foram
        <b> gerados</b>; envio, leitura e assinatura não são registrados.
        {rascunhos > 0 && ` ${rascunhos === 1 ? "1 avaliação em andamento ainda não gerou" : `${rascunhos} avaliações em andamento ainda não geraram`} documentos.`}
      </p>
      <div className="historyFilters medDocFiltros">
        <label className="historyBusca">Paciente<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou 3+ números do CPF" /></label>
        <label>Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeDocumento)}>
            {TIPOS_DE_DOCUMENTO.map(([t, r]) => <option key={t} value={t}>{r}</option>)}
          </select>
        </label>
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
      </div>
      {lista.slice(0, 50).map((a) => (
        <div className="medLinha medHistorico" key={a.id}>
          <span className="medQuem">
            <strong>{pacientePorId.get(a.patient_id)?.nome ?? "Paciente não localizado"}</strong>
            <small>{identificacao(a.patient_id)}</small>
            <small>
              {nomeDoTipo} · gerado na conclusão, em {momentoBr(a.concluida_at || a.updated_at)}
              {a.local_atendimento_id ? ` · ${localPorId.get(a.local_atendimento_id) ?? "Local"}` : ""}
              {quem(a.created_by) ? ` · ${quem(a.created_by)}` : ""}
            </small>
          </span>
          <span className="statusChip present">Gerado</span>
          <Link className="outlineClinical medAcao" href={`/avaliacoes/${a.id}/documentos?doc=${tipo}`}>Abrir</Link>
        </div>
      ))}
      {lista.length === 0 && (
        <div className="emptyClinical compactEmpty">
          {concluidas.length === 0
            ? (haAlguma
                ? "Nenhuma avaliação concluída neste escopo — os documentos aparecem aqui quando uma avaliação é concluída."
                : "Ainda não há documentos: eles são gerados quando a primeira avaliação é concluída.")
            : "Nenhum documento com estes filtros."}
        </div>
      )}
      {lista.length > 50 && <div className="historyLimit">Mostrando os 50 mais recentes de {lista.length}.</div>}
    </section>
  );
}
