"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Icone, type NomeDoIcone } from "@/components/icone";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import { dataLocal } from "@/lib/data-local";
import {
  andamentoPelasAvaliacoes, avaliacaoNoEscopo, consultaNoEscopo, cpfMascarado, destaqueDoDia, etapaMedica, semMedico,
  INFORMACOES_INDISPONIVEIS, intervaloDoPeriodo, LEMBRETES_GERAIS, momentoRelativo, ORIGEM_DOS_LEMBRETES, paraRetomar,
  pendenciasVerificadas, resumoDoDia, TIPOS_DE_DOCUMENTO,
  type AvaliacaoResumo, type Escopo, type Periodo, type Pendencia,
} from "@/lib/area-medica";
import { dataPorExtenso, horaCurta, NOME_DA_ETAPA, proximaDataComConsultas, FORA_DO_FLUXO, type Etapa } from "@/lib/recepcao";
import { AvisoFlutuante } from "@/components/aviso-flutuante";

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
  // Abre sempre nos seus pacientes; "Equipe" fica a um toque, para quem quer
  // ver o dia do grupo. Quem não atende vê só a equipe, e não há o que trocar.
  const [pessoa, setPessoa] = useState<Escopo["pessoa"]>(perfilEhMedico ? "meus" : "equipe");
  const escopo: Escopo = { pessoa, local: "todos" };
  const [verSemMedico, setVerSemMedico] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: "hoje" });
  const [filtroDoDia, setFiltroDoDia] = useState<FiltroDoDia>("todas");
  const [busca, setBusca] = useState("");
  const retomarRef = useRef<HTMLElement>(null);
  const agendaRef = useRef<HTMLElement>(null);
  // Qual botão foi tocado: só ele diz "Abrindo…". Antes, ao abrir uma
  // avaliação, TODOS os botões da tela trocavam de texto ao mesmo tempo.
  const [tocado, setTocado] = useState<string | null>(null);
  const abrir = (chave: string, patientId: string, appointmentId?: string, assessmentId?: string | null) => {
    setTocado(chave); onAbrirAvaliacao(patientId, appointmentId, assessmentId);
  };
  // O erro vem do painel; o X o esconde aqui até chegar um erro diferente.
  const [erroFechado, setErroFechado] = useState("");
  // "Avaliações em aberto" leva à aba Avaliações já filtrada; a chave remonta
  // a lista para o filtro valer.
  const [situacaoInicial, setSituacaoInicial] = useState<{ v: string; n: number }>({ v: "todas", n: 0 });
  const nomeDoEscopo = pessoa === "meus" ? "nos seus pacientes" : "na equipe";

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
  const quando = (iso: string) => momentoRelativo(iso, hoje);

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
  const destaque = destaqueDoDia(doDiaDeHoje, andamento);
  const proximo = destaque?.consulta ?? null;
  // "Para retomar" lista só o que NÃO está na agenda de hoje: a avaliação de
  // um paciente de hoje já tem o botão na linha dele (e no cartão do topo).
  // Antes a mesma avaliação aparecia três vezes, com três botões.
  const pacientesDeHoje = new Set(doDiaDeHoje.filter((c) => !FORA_DO_FLUXO(c.status)).map((c) => c.patient_id));
  const outrasAbertas = retomar.filter((a) => !pacientesDeHoje.has(a.patient_id));
  const pendencias = pendenciasVerificadas(avaliacoesNoEscopo, consultasNoEscopo, hoje);

  const intervalo = intervaloDoPeriodo(periodo, hoje);
  const termo = busca.trim().toLowerCase();
  const doPeriodo = consultasNoEscopo
    .filter((c) => c.data >= intervalo.de && c.data <= intervalo.ate)
    .filter((c) => {
      if (!termo) return true;
      const p = pacientePorId.get(c.patient_id);
      const digitos = termo.replace(/\D/g, "");
      return `${p?.nome ?? ""} ${c.procedimento ?? ""} ${p?.procedimento ?? ""} ${p?.cirurgia ?? ""}`.toLowerCase().includes(termo)
        || (digitos.length >= 3 && String(p?.cpf ?? "").includes(digitos));
    })
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horario ?? "99").localeCompare(b.horario ?? "99"));
  const daAgenda = doPeriodo.filter((c) => filtroDoDia === "todas" || etapaMedica(c, andamento.get(c.id)) === filtroDoDia);
  // As etapas com a contagem do período na tela — no celular são elas que
  // ficam no lugar dos cartões de número.
  const contagemDaEtapa = (e: Etapa) => doPeriodo.filter((c) => etapaMedica(c, andamento.get(c.id)) === e).length;
  const proximaData = proximaDataComConsultas(consultasNoEscopo, intervalo.ate);

  function irParaAgenda(filtro: FiltroDoDia) {
    setSecao("agenda"); setPeriodo({ tipo: "hoje" }); setFiltroDoDia(filtro);
    requestAnimationFrame(() => agendaRef.current?.scrollIntoView({ block: "start" }));
  }
  function irParaRetomar() {
    // Com outras avaliações abertas (de outros dias), elas estão logo abaixo.
    // Se todas são de pacientes de hoje, a lista certa é a aba Avaliações.
    if (outrasAbertas.length === 0) {
      setSituacaoInicial((x) => ({ v: "rascunho", n: x.n + 1 })); setSecao("avaliacoes"); return;
    }
    setSecao("agenda");
    requestAnimationFrame(() => retomarRef.current?.scrollIntoView({ block: "start" }));
  }

  function abrirPendencia(p: Pendencia) {
    if (p.acao === "continuar" && p.avaliacaoId) abrir(p.id, p.patientId, undefined, p.avaliacaoId);
    else if (p.acao === "iniciar") abrir(p.id, p.patientId, p.agendamentoId);
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
  const [anuncio, setAnuncio] = useState("");
  const irParaSecao = (id: Secao, rotulo: string) => { setSecao(id); setAnuncio(`Seção ${rotulo}`); };
  // O mesmo desenho dos menus do Financeiro, da Escala e da Administração.
  const ICONE_DA_SECAO: Record<Secao, NomeDoIcone> = {
    agenda: "calendario", avaliacoes: "nota", pendencias: "alerta", documentos: "imprimir",
  };
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
          <div className="medOnde">
            <span><Icone nome="calendario" tamanho={14} /> {dataPorExtenso(hoje).replace(/^./, (x) => x.toUpperCase())}</span>
            {perfilEhMedico && (
              <span className="medQuemVer" role="group" aria-label="De quem ver">
                <button type="button" aria-pressed={pessoa === "meus"} className={pessoa === "meus" ? "ativo" : ""} onClick={() => setPessoa("meus")}>Meus pacientes</button>
                <button type="button" aria-pressed={pessoa === "equipe"} className={pessoa === "equipe" ? "ativo" : ""} onClick={() => setPessoa("equipe")}>Equipe</button>
              </span>
            )}
          </div>
        </div>
        {/* Em contorno, e não cheio: o médico quase sempre abre a próxima
            consulta já marcada, e o botão mais forte do topo competia com ela.
            Continua aqui para quem atende sem passar pela recepção. */}
        <button type="button" className="outlineClinical medNova" data-acao="novo-paciente" onClick={onNovaAvaliacao}>+ Nova avaliação</button>
      </section>

      {erro && erro !== erroFechado && <AvisoFlutuante tipo="erro" texto={erro} onFechar={() => setErroFechado(erro)} />}
      {falhasDeCarga.length > 0 && (
        <p className="clinicalError" role="alert">
          Não foi possível carregar {falhasDeCarga.join(" e ")} agora — o que aparece abaixo pode estar incompleto.{" "}
          <button type="button" className="outlineClinical" onClick={onRecarregar}>Tentar de novo</button>
        </p>
      )}

      <div className="financeLayout">
        <nav className="financeTarefas menuLateral medAbas" aria-label="Seções da área médica">
          {secoes.map(([id, rotulo, n]) => (
            <button type="button" key={id} data-secao={id} className={`finMenuDireto${secao === id ? " active" : ""}`}
              aria-current={secao === id ? "true" : undefined} onClick={() => irParaSecao(id, rotulo)}>
              <Icone nome={ICONE_DA_SECAO[id]} tamanho={18} />
              <span>{rotulo}</span>
              {/* Âmbar só em Pendências, que é o que pede ação. Nas outras o
                  número só conta — e o leitor de tela ouve "Meu dia, 3". */}
              {n ? <b className={`financeTarefaContador${id === "pendencias" ? "" : " neutro"}`}><span className="sr-only">, </span>{n}</b> : null}
            </button>
          ))}
        </nav>
        <p className="sr-only" aria-live="polite">{anuncio}</p>

        <div className="financeConteudo">
          {secao === "agenda" && (
            <>
              {destaque && proximo ? (
                <section className="clinicalPanel medProximo" aria-label={destaque.rotulo}>
                  <span className="medProximoRotulo">{destaque.rotulo}</span>
                  <time dateTime={proximo.horario ? `${proximo.data}T${proximo.horario.slice(0, 5)}` : proximo.data}>
                    {proximo.horario ? horaCurta(proximo.horario) : "Sem horário"}
                  </time>
                  <span className="medProximoQuem">
                    <strong>{pacientePorId.get(proximo.patient_id)?.nome ?? "Paciente"}</strong>
                    <small>{proximo.procedimento || pacientePorId.get(proximo.patient_id)?.procedimento || "Procedimento não informado"} · {NOME_DA_ETAPA[etapaMedica(proximo, andamento.get(proximo.id))]}</small>
                  </span>
                  <AcaoDaConsulta c={proximo} nome={pacientePorId.get(proximo.patient_id)?.nome ?? "paciente"}
                    av={proximo.avaliacao_id ? avaliacaoPorId.get(proximo.avaliacao_id) : undefined}
                    aberta={abertaDoPaciente.get(proximo.patient_id)} quem={quem} ocupado={ocupado}
                    abrindo={ocupado && tocado === `destaque-${proximo.id}`} destacar
                    onAbrir={(...a) => abrir(`destaque-${proximo.id}`, ...a)} />
                  {destaque.depois && (
                    <small className="medDepois">
                      Depois: {destaque.depois.horario ? horaCurta(destaque.depois.horario) : "sem horário"} ·{" "}
                      {pacientePorId.get(destaque.depois.patient_id)?.nome ?? "Paciente"} · {NOME_DA_ETAPA[etapaMedica(destaque.depois, andamento.get(destaque.depois.id))]}
                    </small>
                  )}
                </section>
              ) : null}

              {/* No computador, os números do dia em cartões que filtram a
                  agenda. No celular eles somem (globals.css) e a mesma coisa
                  vira a faixa de etapas no alto da agenda. */}
              <section className="metricGrid medResumo" aria-label="Hoje">
                {([
                  ["A chegar hoje", resumo.agendados, "blue", "calendario", "agendado"],
                  ["Aguardando atendimento", resumo.aguardando, "amber", "ampulheta", "aguardando"],
                  ["Em atendimento", resumo.emAtendimento, "blue", "pessoa", "em_atendimento"],
                  ["Avaliações em aberto", resumo.emAndamento, "amber", "nota", "retomar"],
                ] as [string, number, string, Parameters<typeof Icone>[0]["nome"], FiltroDoDia | "retomar"][]).map(([rotulo, valor, tom, icone, destino]) => (
                  <button type="button" className="metricCard medCartao" key={rotulo} disabled={valor === 0}
                    onClick={() => (destino === "retomar" ? irParaRetomar() : irParaAgenda(destino))}
                    aria-label={`${valor} ${rotulo.toLowerCase()}${valor ? (destino === "retomar" ? ". Mostrar as avaliações" : ". Mostrar na agenda") : ""}`}
                    title={destino === "em_atendimento" ? "Paciente que chegou e já tem avaliação aberta nesta consulta"
                      : destino === "retomar" ? "Toda avaliação iniciada e não concluída, de qualquer dia"
                      : destino === "agendado" ? "Consultas de hoje sem chegada registrada" : rotulo}>
                    <strong className={valor ? tom : ""}>{valor}</strong>
                    <span><Icone nome={icone} tamanho={13} /> {rotulo}</span>
                  </button>
                ))}
              </section>
              {semMedicoHoje > 0 && (
                <p className="medSemMedico">
                  {semMedicoHoje === 1 ? "1 consulta de hoje está" : `${semMedicoHoje} consultas de hoje estão`} sem médico definido — a recepção indica o médico ao agendar.{" "}
                  <button type="button" className="linkLimpo medLinkToque" onClick={() => setVerSemMedico(!verSemMedico)}>
                    {verSemMedico ? "Ocultar da agenda" : "Mostrar na agenda"}
                  </button>
                </p>
              )}

              {outrasAbertas.length > 0 && (
                <section className="clinicalPanel medRetomar" ref={retomarRef} aria-label="Outras avaliações em aberto">
                  <div className="panelTitle"><strong>Outras avaliações em aberto</strong><span>de outros dias ou sem consulta hoje</span></div>
                  <ol className="medLista">
                    {outrasAbertas.map((a) => {
                      const outroLocal = a.local_atendimento_id && localAtivoId && a.local_atendimento_id !== localAtivoId;
                      const nome = pacientePorId.get(a.patient_id)?.nome ?? "Paciente não localizado";
                      return (
                        <li key={a.id} className="medLinha">
                          <span className="medQuem">
                            <strong>{nome}</strong>
                            <small>{identificacao(a.patient_id)}</small>
                            <small>
                              Iniciada {quando(a.created_at)} · última alteração {quando(a.updated_at)}
                              {escopo.pessoa === "equipe" && quem(a.created_by) ? ` · por ${quem(a.created_by)}` : ""}
                            </small>
                          </span>
                          <span className={`medLocal${outroLocal ? " outro" : ""}`}>
                            {outroLocal && <Icone nome="alerta" tamanho={12} />}
                            {a.local_atendimento_id ? `${outroLocal ? "Outro local: " : ""}${localPorId.get(a.local_atendimento_id) ?? "Local"}` : "Local não registrado"}
                          </span>
                          <button type="button" className="outlineClinical medAcao" disabled={ocupado}
                            onClick={() => abrir(`retomar-${a.id}`, a.patient_id, undefined, a.id)}
                            aria-label={`Continuar a avaliação de ${nome}${outroLocal ? `, feita em ${localPorId.get(a.local_atendimento_id!) ?? "outro local"}` : ""}`}>
                            {ocupado && tocado === `retomar-${a.id}` ? "Abrindo…" : "Continuar avaliação"}
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
                  {/* A data mostra sempre o dia que está na tela — também em
                      Hoje e Amanhã. Vazia, ela parecia dizer outra coisa. */}
                  <label className="medCampo"><span>Data</span>
                    <input type="date" value={periodo.tipo === "dia" ? periodo.dia : intervalo.de} onChange={(e) => e.target.value && setPeriodo({ tipo: "dia", dia: e.target.value })} />
                  </label>
                  <label className="medCampo medBusca"><span>Buscar</span>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, procedimento ou CPF" />
                  </label>
                </div>
                <div className="medEtapasCurtas" role="group" aria-label="Filtrar por etapa">
                  <button type="button" aria-pressed={filtroDoDia === "todas"} onClick={() => setFiltroDoDia("todas")}>Todas <b>{doPeriodo.length}</b></button>
                  {(["agendado", "aguardando", "em_atendimento", "concluido"] as Etapa[]).map((e) => (
                    <button type="button" key={e} aria-pressed={filtroDoDia === e} onClick={() => setFiltroDoDia(e)}>
                      <Icone nome={ICONE_DA_ETAPA[e] ?? "calendario"} tamanho={13} /> {NOME_DA_ETAPA[e]} <b>{contagemDaEtapa(e)}</b>
                    </button>
                  ))}
                </div>
                <p className="medPeriodo" aria-live="polite">
                  <b>{intervalo.rotulo}</b>
                  {perfilEhMedico && <> · {pessoa === "meus" ? "Meus pacientes" : "Equipe"}</>}
                  {filtroDoDia !== "todas" && <> · só “{NOME_DA_ETAPA[filtroDoDia]}” <button type="button" className="linkLimpo" onClick={() => setFiltroDoDia("todas")}>mostrar todos</button></>}
                  {" · "}{daAgenda.length === 1 ? "1 consulta" : `${daAgenda.length} consultas`}
                </p>
                {daAgenda.length === 0 ? (
                  <div className="emptyClinical medVazio">
                    <p>{termo || filtroDoDia !== "todas" ? "Nenhuma consulta com estes filtros neste período." : `Nenhuma consulta agendada — ${intervalo.rotulo.toLowerCase()}.`}</p>
                    <div>
                      {(termo || filtroDoDia !== "todas") && (
                        <button type="button" className="outlineClinical" onClick={() => { setFiltroDoDia("todas"); setBusca(""); }}>
                          Limpar busca e filtros
                        </button>
                      )}
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
                    {daAgenda.map((c, i) => {
                      const p = pacientePorId.get(c.patient_id);
                      const and = andamento.get(c.id);
                      const etapa = etapaMedica(c, and);
                      const av = c.avaliacao_id ? avaliacaoPorId.get(c.avaliacao_id) : undefined;
                      const medicoId = c.medico_id ?? and?.medico_id ?? null;
                      // Em "Meus pacientes" todas são suas: dizer "Responsável:
                      // você" em cada linha era ruído. A linha só aparece quando
                      // informa — outro médico, ou nenhum.
                      const medico = medicoId === perfilId && pessoa === "meus" ? null : quem(medicoId);
                      const novoDia = intervalo.de !== intervalo.ate && (i === 0 || daAgenda[i - 1].data !== c.data);
                      return (
                        <Fragment key={c.id}>
                          {novoDia && <li className="medDiaSeparador">{dataPorExtenso(c.data).replace(/^./, (x) => x.toUpperCase())}</li>}
                          <li className={`medLinha medConsulta etapa-${etapa}${FORA_DO_FLUXO(c.status) || c.status === "faltou" ? " fora" : ""}`}>
                            <time dateTime={c.horario ? `${c.data}T${c.horario.slice(0, 5)}` : c.data}>
                              {c.horario ? horaCurta(c.horario) : <em>Sem horário</em>}
                            </time>
                            <span className="medQuem">
                              <strong>{p?.nome ?? "Paciente não localizado"}</strong>
                              <small>{identificacao(c.patient_id)}</small>
                              <small>{c.procedimento || p?.procedimento || p?.cirurgia || "Procedimento não informado"} · {c.hospital || p?.hospital || "Local não informado"}</small>
                              {medicoId ? (medico && <small>Responsável: {medico}</small>) : <small>Sem médico definido</small>}
                            </span>
                            <span className={`recEtapa etapa-${etapa}`}>
                              <Icone nome={ICONE_DA_ETAPA[etapa] ?? "calendario"} tamanho={13} /> {NOME_DA_ETAPA[etapa]}
                            </span>
                            <AcaoDaConsulta c={c} nome={p?.nome ?? "paciente"} av={av} aberta={abertaDoPaciente.get(c.patient_id)}
                              quem={quem} ocupado={ocupado} abrindo={ocupado && tocado === `agenda-${c.id}`}
                              onAbrir={(...a) => abrir(`agenda-${c.id}`, ...a)} />
                          </li>
                        </Fragment>
                      );
                    })}
                  </ol>
                )}
              </section>

              {pendencias.length > 0 && (
                <p className="medAvisoPendencias">
                  <Icone nome="alerta" tamanho={14} /> {pendencias.length === 1 ? "1 pendência verificada" : `${pendencias.length} pendências verificadas`} {nomeDoEscopo}.{" "}
                  <button type="button" className="linkLimpo medLinkToque" onClick={() => irParaSecao("pendencias", "Pendências")}>Ver pendências</button>
                </p>
              )}
            </>
          )}

          {secao === "avaliacoes" && (
            <Avaliacoes key={situacaoInicial.n} situacaoInicial={situacaoInicial.v} avaliacoes={avaliacoesNoEscopo} total={avaliacoes.length} pacientePorId={pacientePorId}
              identificacao={identificacao} locais={locais} localPorId={localPorId} quem={quem} quando={quando}
              ocupado={ocupado} tocado={tocado} nomeDoEscopo={perfilEhMedico ? (pessoa === "meus" ? "Meus pacientes" : "Equipe") : null}
              onAbrir={(chave, ...a) => abrir(chave, ...a)} onNova={onNovaAvaliacao} />
          )}

          {secao === "pendencias" && (
            <>
              <section className="clinicalPanel medPendencias" aria-label="Pendências verificadas">
                <div className="panelTitle"><strong>Pendências verificadas</strong><span>encontradas nos registros {nomeDoEscopo === "na equipe" ? "da equipe" : "dos seus pacientes"}</span></div>
                {pendencias.length === 0 ? (
                  <p className="medTranquilo"><Icone nome="confirmado" tamanho={16} /> Nenhuma pendência nos registros {nomeDoEscopo === "na equipe" ? "da equipe" : "dos seus pacientes"}.</p>
                ) : (
                  <ol className="medLista">
                    {pendencias.map((p) => {
                      const nome = pacientePorId.get(p.patientId)?.nome ?? "Paciente não localizado";
                      const rotulo = p.acao === "continuar" ? "Continuar avaliação" : p.acao === "iniciar" ? "Iniciar avaliação" : "Ver na agenda";
                      return (
                        <li key={p.id} className="medLinha">
                          <span className="medQuem">
                            <strong>{nome}</strong>
                            <small>{p.motivo}</small>
                            <small>
                              {p.rotuloDaData}: {p.data.length > 10 ? quando(p.data) : p.data.split("-").reverse().join("/")}
                              {quem(p.responsavel) ? ` · ${p.tipo === "chegou_sem_avaliacao" ? "registrada por" : "responsável:"} ${quem(p.responsavel)}` : ""}
                              {p.localId ? ` · ${localPorId.get(p.localId) ?? "Local"}` : ""}
                            </small>
                          </span>
                          <button type="button" className="outlineClinical medAcao" disabled={ocupado && p.acao !== "ver_na_agenda"}
                            aria-label={`${rotulo} de ${nome}`} onClick={() => abrirPendencia(p)}>
                            {ocupado && tocado === p.id ? "Abrindo…" : rotulo}
                          </button>
                        </li>
                      );
                    })}
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
              localPorId={localPorId} quem={quem} quando={quando} haAlguma={avaliacoes.length > 0} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "Iniciar avaliação" / "Continuar avaliação" / "Ver documentos" — pelo registro que existe.
 *
 * Cheio só quando é a hora de agir (o paciente chegou, ou está em atendimento,
 * ou é o cartão do topo); quem ainda não chegou fica em contorno. Antes eram
 * seis botões azuis cheios na mesma tela, e nenhum se destacava.
 */
function AcaoDaConsulta({ c, nome, av, aberta, quem, ocupado, abrindo, destacar, onAbrir }: {
  c: ConsultaDaAreaMedica; nome: string; av?: AvaliacaoResumo; aberta?: AvaliacaoResumo; ocupado: boolean; abrindo: boolean;
  destacar?: boolean;
  quem: (id: string | null | undefined) => string | null;
  onAbrir: (patientId: string, appointmentId?: string, assessmentId?: string | null) => void;
}) {
  if (FORA_DO_FLUXO(c.status)) return <span className="medSemAcao">{c.status === "cancelado" ? "Consulta desmarcada" : "Remarcada em outra data"}</span>;
  if (c.status === "faltou") return <span className="medSemAcao">Falta registrada</span>;
  if (av?.status === "concluida") return <Link className="outlineClinical medAcao" href={`/avaliacoes/${av.id}/documentos`} aria-label={`Ver documentos de ${nome}`}>Ver documentos</Link>;
  // Sem avaliação ligada, mas com uma aberta para o paciente: abrir continua
  // aquela (não nasce uma segunda), e o botão diz de quem ela é.
  const continua = av?.status === "rascunho" ? av : !av ? aberta : undefined;
  const de = continua && continua !== av && quem(continua.created_by) !== "você" ? quem(continua.created_by) : null;
  const rotulo = continua ? "Continuar avaliação" : "Iniciar avaliação";
  const cheio = destacar || c.status === "presente";
  return (
    <span className="medAcaoCaixa">
      <button type="button" className={`${cheio ? "primaryClinical compact" : "outlineClinical"} medAcao`} disabled={ocupado} aria-busy={abrindo}
        aria-label={`${rotulo} de ${nome}`} onClick={() => onAbrir(c.patient_id, c.id, continua?.id ?? c.avaliacao_id)}>
        {abrindo ? "Abrindo…" : rotulo}
      </button>
      {de && <small>aberta por {de}</small>}
    </span>
  );
}

// ── Avaliações ─────────────────────────────────────────────────────────────

function Avaliacoes({
  avaliacoes, total, pacientePorId, identificacao, locais, localPorId, quem, quando, ocupado, tocado, nomeDoEscopo,
  situacaoInicial, onAbrir, onNova,
}: {
  avaliacoes: AvaliacaoDaAreaMedica[]; total: number; pacientePorId: Map<string, PacienteDaAreaMedica>;
  identificacao: (id: string) => string; locais: LocalDisponivel[]; localPorId: Map<string, string>;
  quem: (id: string | null | undefined) => string | null; quando: (iso: string) => string;
  ocupado: boolean; tocado: string | null; nomeDoEscopo: string | null; situacaoInicial: string;
  onAbrir: (chave: string, patientId: string, appointmentId?: string, assessmentId?: string | null) => void; onNova: () => void;
}) {
  const [q, setQ] = useState("");
  const [situacao, setSituacao] = useState(situacaoInicial);
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
  const emAndamento = lista.filter((a) => a.status === "rascunho").length;
  const canceladas = lista.filter((a) => a.status === "cancelada").length;
  const asa = concluidas.filter((a) => ["ASA III", "ASA IV", "ASA V", "ASA VI"].includes(String(a.dados?.asa ?? ""))).length;

  return (
    <section className="clinicalPanel historyPanel">
      <div className="panelTitle"><strong>Avaliações</strong><span>todas as situações, com busca e filtros</span></div>
      {/* Os números descrevem A LISTA ABAIXO — o mesmo recorte, dito em cima. */}
      <p className="medRecorte">
        <b>{lista.length}</b> {lista.length === 1 ? "avaliação" : "avaliações"} com estes filtros ·{" "}
        <b>{concluidas.length}</b> concluída{concluidas.length === 1 ? "" : "s"} ·{" "}
        <b>{emAndamento}</b> em andamento ·{" "}
        {canceladas > 0 && <><b>{canceladas}</b> cancelada{canceladas === 1 ? "" : "s"} ·{" "}</>}
        <b>{asa}</b> ASA III ou mais entre as concluídas
      </p>
      <div className="historyFilters">
        <label className="historyBusca">Buscar
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paciente, hospital, médico ou CPF" />
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
                {feita && a.concluida_at ? `Concluída ${quando(a.concluida_at)}` : `Iniciada ${quando(a.created_at)} · última alteração ${quando(a.updated_at)}`}
                {a.local_atendimento_id ? ` · ${localPorId.get(a.local_atendimento_id) ?? "Local"}` : " · Local não registrado"}
                {quem(a.created_by) ? ` · ${quem(a.created_by)}` : ""}
              </small>
            </span>
            <span className={`statusChip ${feita ? "present" : a.status === "cancelada" ? "danger" : "waiting"}`}>
              {feita ? "Concluída" : a.status === "rascunho" ? "Em andamento" : a.status === "cancelada" ? "Cancelada" : a.status}
            </span>
            {feita
              ? <Link className="outlineClinical medAcao" href={`/avaliacoes/${a.id}/documentos`} aria-label={`Ver documentos de ${p?.nome ?? "paciente"}`}>Ver documentos</Link>
              : a.status === "rascunho"
                ? <button type="button" className="outlineClinical medAcao" disabled={ocupado} aria-label={`Continuar a avaliação de ${p?.nome ?? "paciente"}`}
                    onClick={() => onAbrir(`lista-${a.id}`, a.patient_id, undefined, a.id)}>
                    {ocupado && tocado === `lista-${a.id}` ? "Abrindo…" : "Continuar avaliação"}
                  </button>
                : <span className="medSemAcao">Sem ação</span>}
          </div>
        );
      })}
      {lista.length === 0 && (total === 0
        ? <div className="emptyClinical compactEmpty"><strong>Ainda não há avaliação nenhuma.</strong> A primeira nasce em <button type="button" className="linkLimpo" onClick={onNova}>Nova avaliação</button>.</div>
        : (
          <div className="emptyClinical compactEmpty medVazioFiltro">
            <span>Nenhuma avaliação combina com estes filtros{nomeDoEscopo ? ` em “${nomeDoEscopo}”` : ""}.</span>
            {(q || situacao !== "todas" || local !== "todos" || de || ate) && (
              <button type="button" className="outlineClinical" onClick={() => { setQ(""); setSituacao("todas"); setLocal("todos"); setDe(""); setAte(""); }}>Limpar filtros</button>
            )}
          </div>
        ))}
      {lista.length > 50 && <div className="historyLimit">Mostrando as 50 mais recentes de {lista.length}. Refine os filtros para ver uma lista menor.</div>}
    </section>
  );
}

// ── Documentos ─────────────────────────────────────────────────────────────

function Documentos({
  avaliacoes, pacientePorId, identificacao, localPorId, quem, quando, haAlguma,
}: {
  avaliacoes: AvaliacaoDaAreaMedica[]; pacientePorId: Map<string, PacienteDaAreaMedica>; identificacao: (id: string) => string;
  localPorId: Map<string, string>; quem: (id: string | null | undefined) => string | null; quando: (iso: string) => string;
  haAlguma: boolean;
}) {
  const [q, setQ] = useState("");
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
  // Os três documentos saem juntos da conclusão, e a página deles troca entre
  // um e outro. Escolher o tipo ANTES, num filtro solto no alto da lista, era
  // uma coisa a mais para lembrar — e o selo "Gerado" em toda linha não
  // diferenciava nada.
  const osTres = TIPOS_DE_DOCUMENTO.map(([, r]) => r).join(", ").replace(/, ([^,]*)$/, " e $1");

  return (
    <section className="clinicalPanel medDocumentos">
      <div className="panelTitle"><strong>Documentos</strong><span>gerados a partir de avaliações concluídas</span></div>
      <p className="medRecorte">
        Os documentos existem a partir da conclusão da avaliação e são impressos a partir dela. O sistema registra que foram
        <b> gerados</b>; envio, leitura e assinatura não são registrados.
        {rascunhos > 0 && ` ${rascunhos === 1 ? "1 avaliação em andamento ainda não gerou" : `${rascunhos} avaliações em andamento ainda não geraram`} documentos.`}
      </p>
      <div className="historyFilters medDocFiltros">
        <label className="historyBusca">Paciente<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou CPF" /></label>
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
      </div>
      {lista.slice(0, 50).map((a) => (
        <div className="medLinha medHistorico" key={a.id}>
          <span className="medQuem">
            <strong>{pacientePorId.get(a.patient_id)?.nome ?? "Paciente não localizado"}</strong>
            <small>{identificacao(a.patient_id)}</small>
            <small>
              {osTres} · concluída {quando(a.concluida_at || a.updated_at)}
              {a.local_atendimento_id ? ` · ${localPorId.get(a.local_atendimento_id) ?? "Local"}` : ""}
              {quem(a.created_by) ? ` · ${quem(a.created_by)}` : ""}
            </small>
          </span>
          <Link className="outlineClinical medAcao" href={`/avaliacoes/${a.id}/documentos`}
            aria-label={`Abrir os documentos de ${pacientePorId.get(a.patient_id)?.nome ?? "paciente"}`}>Abrir documentos</Link>
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
