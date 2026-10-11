"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { horaLocal } from "@/lib/data-local";
import { Janela } from "@/components/janela";
import { janelaVisivel } from "@/lib/evolucao/grafico";
import { pamEstimadaCabe, PARAMETROS, type Parametro } from "@/lib/evolucao/sinais";
import { historicoDe, minutosEntre, type Registro } from "@/lib/evolucao/registros";
import {
  administrados, agruparPorMedicamento, exposicaoAnestesicoLocal, type Administracao,
} from "@/lib/evolucao/medicamentos";
import { consumoSevoflurano, formatarMl, lerAjuste, type AjusteDeGas } from "@/lib/evolucao/sevoflurano";
import { montarInfusoes, totalDaInfusao, type Infusao } from "@/lib/evolucao/infusoes";
import { LIQUIDOS_RAPIDOS, VOLUMES_RAPIDOS, balancoHidrico } from "@/lib/evolucao/liquidos";
import { EVENTOS, conferirEncerramento, horarioDoMarco, imcDaFolha, rotuloDoEvento, type Profissional } from "@/lib/evolucao/folha";
import { conferirAlergia } from "@/lib/evolucao/alergias";
import { marcasDeEvento } from "@/lib/evolucao/impressao";
import { idadeEmDias, type RegraDeDose } from "@/lib/evolucao/doses";
import type { PacienteDaFolha } from "@/lib/evolucao/importar";
import { useFolha, type Folha } from "./use-folha";
import { GraficoSinais, type AlvoDaFaixa, type Toque } from "./grafico-sinais";
import { JanelaLancar, JanelaMover, JanelaPonto, JanelaSinal, MODOS, Historico, type ModoDoGrafico, type NovoSinal } from "./janelas-sinais";
import { JanelaMedicamento } from "./janela-medicamento";
import { JanelaEncerrar, JanelaEvento, JanelaGas, JanelaInfusao, JanelaLiquido, JanelaReabrir } from "./janelas-folha";
import { PreAnestesicaResumo, SecaoCirurgia, SecaoEquipe, SecaoPreAnestesica, SecaoSaida, SecaoTecnica } from "./secoes";

// A folha de anestesia digital.
//
// A distribuição é a da folha impressa: a pré-anestésica em grade no alto; o
// registro anestésico com gases, infusões e líquidos em faixas no MESMO eixo
// de tempo do gráfico, como no papel; a medicação à direita; posição,
// técnica, cirurgia, saída e equipe embaixo. Desenhada primeiro para o tablet
// deitado preso ao aparelho de anestesia; no celular as colunas empilham.

type Medico = { id: string; nome: string; crm: string };
type Abrir =
  | { tipo: "sinal"; modo: ModoDoGrafico; ms: number; valor: number | null }
  | { tipo: "ponto"; registro: Registro }
  | { tipo: "mover"; registro: Registro; t: Toque }
  | { tipo: "lancar" }
  | { tipo: "medicamento"; planejado?: Registro }
  | { tipo: "infusao"; acao: "iniciar" | "ajustar" | "encerrar"; infusao: Infusao | null; ms?: number }
  | { tipo: "infusaoAcoes"; infusao: Infusao; ms: number }
  | { tipo: "gas"; ms?: number }
  | { tipo: "liquido"; sentido: "entrada" | "saida"; ms?: number; inicial?: { nome: string; categoria: string } }
  | { tipo: "evento" }
  | { tipo: "registro"; registro: Registro }
  | { tipo: "encerrar" }
  | { tipo: "reabrir" };

const ZOOMS = [60, 120, 240];
const chaveFavoritos = (id: string) => `avanest:evo-favoritos:${id}`;
const CHAVE_PRE = "avanest:evo-pre";
const hora = (iso: string) => horaLocal(new Date(iso));
/** O minuto cheio de agora — evento rápido não registra segundos. */
const minutoAtual = () => new Date(Math.round(Date.now() / 60000) * 60000).toISOString();
const agoraMs = () => Date.now();
const fmt = (v: number, casas = 2) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });

export function FolhaAnestesica({ folhaInicial, paciente, registrosIniciais, regras, medicos, eu }: {
  folhaInicial: Folha;
  paciente: PacienteDaFolha & { id: string };
  registrosIniciais: Registro[];
  regras: RegraDeDose[];
  medicos: Medico[];
  eu: Medico;
}) {
  const f = useFolha(folhaInicial, registrosIniciais);
  const { folha, atuais, todos } = f;
  const aberta = folha.status === "aberta";
  const dados = folha.dados;
  const pesoKg = typeof dados.peso_kg === "number" ? dados.peso_kg : null;
  const imc = imcDaFolha(dados);

  const [montado, setMontado] = useState(false);
  const [agora, setAgora] = useState(0);
  const [modo, setModo] = useState<ModoDoGrafico>("pa");
  const [zoom, setZoom] = useState(120);
  const [desloc, setDesloc] = useState<number | null>(null);
  const [abrir, setAbrir] = useState<Abrir | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; desfazer: boolean } | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [preAberta, setPreAberta] = useState(true);
  const [editandoPre, setEditandoPre] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- relógio e aparelho só existem depois de montar
    setMontado(true);
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 30000);
    try {
      if (localStorage.getItem(CHAVE_PRE) === "recolhida") setPreAberta(false);
    } catch { /* sem armazenamento */ }
    try {
      const contagem = JSON.parse(localStorage.getItem(chaveFavoritos(eu.id)) ?? "{}") as Record<string, number>;
      setFavoritos(Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n]) => n));
    } catch { /* sem favoritos */ }
    return () => clearInterval(t);
  }, [eu.id]);

  // A folha nasce com o médico que a abriu como responsável.
  const { mudarCabecalho } = f;
  useEffect(() => {
    if (aberta && !Array.isArray(dados.equipe)) {
      mudarCabecalho({ equipe: [{ perfil_id: eu.id, nome: eu.nome, crm: eu.crm.replace(/\D/g, "") || eu.crm, uf: "PR", funcao: "responsavel" }] satisfies Profissional[] });
    }
  }, [aberta, dados.equipe, eu, mudarCabecalho]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  const nomes = useMemo(() => new Map(medicos.map((m) => [m.id, m.nome])), [medicos]);
  const idadeDias = idadeEmDias(paciente.data_nascimento);
  const fimAnestesia = horarioDoMarco(atuais, "fim_anestesia");
  const fimMs = !aberta ? Date.parse(fimAnestesia ?? folha.encerrada_em ?? folha.created_at) : fimAnestesia ? Date.parse(fimAnestesia) : null;
  const primeiro = atuais[0]?.momento;
  const inicioMs = Math.min(Date.parse(folha.inicio_em), primeiro ? Date.parse(primeiro) : Infinity);
  const ultimoMs = Math.max(agora || inicioMs, ...atuais.map((r) => Date.parse(r.momento)));
  const janela = janelaVisivel(inicioMs, aberta ? ultimoMs : (fimMs ?? ultimoMs), zoom, desloc);

  // ---- Derivados ---------------------------------------------------------
  const dadas = useMemo(() => administrados(atuais), [atuais]);
  const grupos = useMemo(() => agruparPorMedicamento(dadas), [dadas]);
  const planejados = atuais.filter((r) => r.tipo === "medicamento" && (r.dados.status === "planejado" || r.dados.status === "preparado"));
  const ajustes = atuais.map(lerAjuste).filter((a): a is AjusteDeGas => a !== null);
  const gasAtual = ajustes[ajustes.length - 1] ?? null;
  const sevo = consumoSevoflurano(ajustes, new Date(fimMs ?? ultimoMs).toISOString());
  const infusoes = montarInfusoes(atuais);
  const balanco = balancoHidrico(atuais, pesoKg);
  const exposicao = exposicaoAnestesicoLocal(dadas, pesoKg);
  const eventos = atuais.filter((r) => r.tipo === "evento");

  const temPamMedida = useCallback((iso: string) => !pamEstimadaCabe(atuais, iso), [atuais]);

  // ---- Ações -------------------------------------------------------------
  function registrarSinais(itens: NovoSinal[], momento: string) {
    for (const i of itens) {
      f.registrar({ tipo: "sinal", momento, dados: { parametro: i.parametro, valor: i.valor }, origem: i.origem });
    }
    setAbrir(null);
    setAviso({ texto: `${itens.map((i) => `${PARAMETROS[i.parametro].curto} ${fmt(i.valor, 1)}`).join(" · ")} às ${hora(momento)}`, desfazer: false });
  }

  function evento(codigo: string) {
    const recente = eventos.find((r) => r.dados.codigo === codigo && Math.abs(minutosEntre(r.momento, new Date())) < 1);
    if (recente) {
      setAviso({ texto: `${rotuloDoEvento(codigo)} já foi registrado às ${hora(recente.momento)}.`, desfazer: false });
      return;
    }
    const momento = minutoAtual();
    f.registrar({ tipo: "evento", momento, dados: { codigo } });
    setAviso({ texto: `${rotuloDoEvento(codigo)} às ${hora(momento)}`, desfazer: true });
  }

  // Um toque, uma bolsa. A trava de 2 s é contra o toque duplo sem querer —
  // duas bolsas de verdade seguidas continuam possíveis.
  const ultimoRapido = useRef<{ chave: string; em: number } | null>(null);
  function liquidoRapido(nome: string, volume: number) {
    const chave = `${nome}|${volume}`;
    const agora = agoraMs();
    if (ultimoRapido.current?.chave === chave && agora - ultimoRapido.current.em < 2000) return;
    ultimoRapido.current = { chave, em: agora };
    const momento = minutoAtual();
    f.registrar({ tipo: "liquido", momento, dados: { sentido: "entrada", categoria: "cristaloide", nome, volume_ml: volume } });
    setAviso({ texto: `${nome} ${volume} mL às ${hora(momento)}`, desfazer: true });
  }

  function mudarPreAberta(v: boolean) {
    setPreAberta(v);
    try { localStorage.setItem(CHAVE_PRE, v ? "aberta" : "recolhida"); } catch { /* sem armazenamento */ }
  }

  // Tocar numa faixa do registro: a janela certa, já no horário tocado.
  function tocarFaixa(a: AlvoDaFaixa) {
    if (a.tipo === "gas") setAbrir({ tipo: "gas", ms: a.ms });
    else if (a.tipo === "infusao") {
      setAbrir(a.infusao ? { tipo: "infusaoAcoes", infusao: a.infusao, ms: a.ms } : { tipo: "infusao", acao: "iniciar", infusao: null, ms: a.ms });
    } else setAbrir({ tipo: "liquido", sentido: a.sentido, ms: a.ms, inicial: { nome: a.nome, categoria: a.categoria } });
  }

  function contarFavorito(nome: string) {
    try {
      const c = JSON.parse(localStorage.getItem(chaveFavoritos(eu.id)) ?? "{}") as Record<string, number>;
      c[nome] = (c[nome] ?? 0) + 1;
      localStorage.setItem(chaveFavoritos(eu.id), JSON.stringify(c));
    } catch { /* sem armazenamento */ }
  }

  async function mudarIntervalo(min: number) {
    const { error } = await createClient().rpc("definir_intervalo_evolucao", { p_id: folha.id, p_minutos: min });
    if (!error) f.setFolha((x) => ({ ...x, intervalo_minutos: min }));
  }

  async function encerrar() {
    if (f.pendentes.some((p) => !p.recusado)) {
      setErroAcao("Ainda há registros sendo salvos. Aguarde o indicador mostrar “Salvo”.");
      return;
    }
    setEncerrando(true);
    setErroAcao(null);
    const { error } = await createClient().rpc("encerrar_evolucao", { p_id: folha.id });
    setEncerrando(false);
    if (error) { setErroAcao("Não foi possível encerrar agora. Confira a conexão."); return; }
    setAbrir(null);
    await f.recarregarTudo();
  }

  async function reabrir(motivo: string) {
    setEncerrando(true);
    setErroAcao(null);
    const { error } = await createClient().rpc("reabrir_evolucao", { p_id: folha.id, p_motivo: motivo });
    setEncerrando(false);
    if (error) { setErroAcao("Não foi possível reabrir agora."); return; }
    setAbrir(null);
    await f.recarregarTudo();
  }

  const pendenciasEncerrar = abrir?.tipo === "encerrar" ? conferirEncerramento(dados, atuais, folha.intervalo_minutos) : [];
  const idade = paciente.idade_anos ?? (idadeDias !== null ? Math.floor(idadeDias / 365.25) : null);
  const temAlergia = Boolean(dados.alergias) && dados.nega_alergia !== true;

  return (
    <main className="evoFolha">
      <header className="evoTopo">
        <Link href="/evolucao" className="evoVoltar" aria-label="Voltar às folhas">←</Link>
        <div className="evoPaciente">
          <h1>{paciente.nome}</h1>
          <p>
            {[idade !== null && `${idade} anos`, paciente.sexo, pesoKg !== null && `${fmt(pesoKg, 1)} kg`,
              imc !== null && `IMC ${fmt(imc, 1)}`,
              dados.asa && `ASA ${dados.asa}${dados.asa_emergencia ? " E" : ""}`, String(dados.procedimento ?? "")]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`evoSituacao ${folha.status}`}>{aberta ? "Aberta" : `Encerrada · v${folha.versao}`}</span>
        <Sincronia estado={f.sincronia} pendentes={f.pendentes.filter((p) => !p.recusado).length} cabecalho={f.cabecalhoSalvo} />
        <div className="evoTopoAcoes">
          {aberta && <>
            <button type="button" className="evoBotao icone" onClick={f.desfazerUltimo} disabled={!f.podeDesfazer} title="Desfazer">↶</button>
            <button type="button" className="evoBotao icone" onClick={f.refazerUltimo} disabled={!f.podeRefazer} title="Refazer">↷</button>
          </>}
          <a className="evoBotao secundario" href={`/evolucao/${folha.id}/imprimir`} target="_blank" rel="noreferrer">Imprimir</a>
          {aberta
            ? <button type="button" className="evoBotao" onClick={() => { setErroAcao(null); setAbrir({ tipo: "encerrar" }); }}>Encerrar</button>
            : <button type="button" className="evoBotao secundario" onClick={() => { setErroAcao(null); setAbrir({ tipo: "reabrir" }); }}>Reabrir</button>}
        </div>
      </header>

      {f.recusa && (
        <div className="evoFaixa perigo" role="alert">
          <span>{f.recusa}</span>
          {f.pendentes.some((p) => p.recusado) && (
            <button type="button" className="evoBotao fantasma" onClick={f.descartarRecusados}>Descartar o recusado</button>
          )}
          <button type="button" className="evoBotao fantasma" onClick={() => f.setRecusa(null)}>Fechar</button>
        </div>
      )}
      {f.cabecalhoSalvo === "conflito" && (
        <div className="evoFaixa atencao" role="alert">
          <span>Outra pessoa alterou o cabeçalho desta folha. Recarregue para ver a versão atual antes de continuar.</span>
          <button type="button" className="evoBotao fantasma" onClick={() => void f.recarregarTudo()}>Recarregar</button>
        </div>
      )}

      <section className="evoPre" aria-labelledby="evo-pre-titulo">
        <header className="evoPreTopo">
          <h2 id="evo-pre-titulo">Avaliação pré-anestésica</h2>
          {!preAberta && (
            <p className="evoPreLinha">
              {temAlergia
                ? <span className="evoPreAlergia">Alergias: {String(dados.alergias)}</span>
                : <span>{dados.nega_alergia ? "Nega alergias" : "Alergias não informadas"}</span>}
              <span>{[imc !== null && `IMC ${fmt(imc, 1)}`, dados.via_aerea && `Via aérea: ${String(dados.via_aerea).slice(0, 60)}`,
                dados.jejum && `Jejum: ${dados.jejum}`].filter(Boolean).join(" · ")}</span>
            </p>
          )}
          <div className="evoAcoesLinha">
            {aberta && (
              <button type="button" className="evoBotao pequeno secundario" aria-expanded={editandoPre}
                onClick={() => { setEditandoPre((v) => !v); if (!preAberta) mudarPreAberta(true); }}>
                {editandoPre ? "Concluir edição" : "Editar"}
              </button>
            )}
            <button type="button" className="evoBotao pequeno fantasma" aria-expanded={preAberta}
              onClick={() => mudarPreAberta(!preAberta)}>{preAberta ? "Recolher" : "Mostrar"}</button>
          </div>
        </header>
        {preAberta && <PreAnestesicaResumo dados={dados} sexo={paciente.sexo} />}
        {editandoPre && aberta && (
          <SecaoPreAnestesica dados={dados} onMudar={f.mudarCabecalho} leitura={!aberta} idadeAnos={idade} />
        )}
      </section>

      <div className="evoCorpo">
        <section className="evoCentro" aria-label="Registro anestésico">
          <div className="evoFerramentas">
            {aberta && (
              <div className="evoModos" role="radiogroup" aria-label="O que o toque no gráfico registra">
                {MODOS.map((m) => (
                  <button type="button" key={m.modo} role="radio" aria-checked={modo === m.modo}
                    className={`evoModo ${m.modo}${modo === m.modo ? " ativo" : ""}`} onClick={() => setModo(m.modo)}>
                    {m.simbolo && <i aria-hidden="true">{m.simbolo}</i>}{m.rotulo}
                  </button>
                ))}
              </div>
            )}
            <div className="evoNavegar">
              <label className="evoSelecao"><span>Intervalo</span>
                <select value={folha.intervalo_minutos} disabled={!aberta}
                  onChange={(e) => void mudarIntervalo(Number(e.target.value))}>
                  <option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option>
                </select>
              </label>
              <div className="evoSegmento" role="group" aria-label="Janela de tempo">
                {ZOOMS.map((z) => (
                  <button type="button" key={z} className={zoom === z ? "ativo" : ""} onClick={() => setZoom(z)}>{z / 60} h</button>
                ))}
              </div>
              <div className="evoSegmento" role="group" aria-label="Navegar no tempo">
                <button type="button" onClick={() => setDesloc(Math.max(0, janela.desloc - zoom / 2))} disabled={janela.desloc <= 0}>◀</button>
                <button type="button" onClick={() => setDesloc(null)} className={desloc === null ? "ativo" : ""}>Agora</button>
                <button type="button" onClick={() => {
                  const d = janela.desloc + zoom / 2;
                  setDesloc(d >= janela.maxDesloc ? null : d);
                }} disabled={desloc === null}>▶</button>
              </div>
              {aberta && <button type="button" className="evoBotao pequeno secundario" onClick={() => setAbrir({ tipo: "lancar" })}>Lançar valores</button>}
            </div>
          </div>

          {montado ? (
            <GraficoSinais
              atuais={atuais} idsPendentes={f.idsPendentes} cabecalho={dados} fimMs={fimMs} agoraMs={agora}
              aberta={aberta} intervalo={folha.intervalo_minutos} janelaInicio={janela.inicio} janelaMinutos={zoom}
              alturaGrade={300} somenteLeitura={!aberta}
              onTocar={(t) => {
                if (["spo2", "etco2", "temp"].includes(modo)) {
                  setAbrir({ tipo: "sinal", modo, ms: t.ms, valor: null });
                } else setAbrir({ tipo: "sinal", modo, ms: Math.min(t.ms, Date.now()), valor: t.valor });
              }}
              onTocarLinha={(p, ms) => setAbrir({ tipo: "sinal", modo: p, ms, valor: null })}
              onTocarFaixa={tocarFaixa}
              onAbrirPonto={(r) => setAbrir({ tipo: "ponto", registro: r })}
              onAbrirRegistro={(r) => setAbrir({ tipo: "registro", registro: r })}
              onMover={(r, t) => setAbrir({ tipo: "mover", registro: r, t })}
            />
          ) : <div className="evoGraficoCarregando" aria-hidden="true" />}

          {/* O que o papel escreve embaixo do gráfico: sevoflurano, infusões, balanço */}
          <div className="evoResumo">
            {ajustes.length > 0 && (
              <p>
                <b>Sevoflurano:</b> {formatarMl(sevo.totalMl)}
                <small> estimativa pelo vaporizador{fimMs ? "" : ", até agora"}</small>
              </p>
            )}
            {infusoes.map((inf) => {
              const passo = inf.passos[inf.passos.length - 1];
              const total = totalDaInfusao(inf, pesoKg);
              return (
                <p key={inf.id}>
                  <b>{inf.nome}:</b>{" "}
                  {inf.fim ? `${hora(inf.inicio)}–${hora(inf.fim)}` : `${fmt(passo.valor)} ${passo.unidade} desde ${hora(passo.momento)}`}
                  {" · "}
                  {[total.volumeMl !== null && `${fmt(total.volumeMl, 1)} mL`, total.quantidade !== null && `${fmt(total.quantidade)} ${total.unidadeQuantidade}`]
                    .filter(Boolean).join(" · ") || "total depende da concentração"}
                  {total.incompleto && <small> até o último registro</small>}
                  {conferirAlergia(dados, inf.nome) && <em className="evoAlergiaTag">Alergia registrada</em>}
                </p>
              );
            })}
            <p>
              <b>Balanço:</b> entradas {fmt(balanco.entradas, 0)} mL · saídas {fmt(balanco.saidas, 0)} mL ·
              saldo {balanco.saldo > 0 ? "+" : ""}{fmt(balanco.saldo, 0)} mL
              {balanco.avisos.length > 0 && <small> {balanco.avisos.join(" ")}</small>}
            </p>
          </div>

          {aberta && (
            <div className="evoAcoesRegistro" aria-label="Registrar">
              <div className="evoAcoesLinha">
                <button type="button" className="evoBotao pequeno secundario" onClick={() => setAbrir({ tipo: "gas" })}>Ajustar gases</button>
                <button type="button" className="evoBotao pequeno secundario" onClick={() => setAbrir({ tipo: "infusao", acao: "iniciar", infusao: null })}>+ Infusão</button>
                <button type="button" className="evoBotao pequeno secundario" onClick={() => setAbrir({ tipo: "liquido", sentido: "entrada" })}>+ Entrada</button>
                <button type="button" className="evoBotao pequeno secundario" onClick={() => setAbrir({ tipo: "liquido", sentido: "saida" })}>+ Saída</button>
              </div>
              <div className="evoLiquidosRapidos">
                {LIQUIDOS_RAPIDOS.map((l) => (
                  <div key={l.nome} role="group" aria-label={`${l.nome}: registrar uma bolsa agora`}>
                    <span>{l.curto}</span>
                    {VOLUMES_RAPIDOS.map((ml) => (
                      <button type="button" key={ml} onClick={() => liquidoRapido(l.nome, ml)}
                        aria-label={`${l.nome} ${ml} mL agora`}>{ml}</button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {aberta && (
            <div className="evoEventos" aria-label="Eventos">
              {EVENTOS.map((ev) => {
                const feito = horarioDoMarco(atuais, ev.codigo);
                return (
                  <button type="button" key={ev.codigo} className={`evoEventoBotao${feito ? " feito" : ""}${ev.marco ? " marco" : ""}`}
                    onClick={() => evento(ev.codigo)}>
                    {ev.rotulo}{feito && <small>{hora(feito)}</small>}
                  </button>
                );
              })}
              <button type="button" className="evoEventoBotao" onClick={() => setAbrir({ tipo: "evento" })}>Outro…</button>
            </div>
          )}
          {eventos.length > 0 && (
            <ol className="evoLinhaDoTempo">
              {marcasDeEvento(atuais).map((m) => {
                const r = atuais.find((x) => x.id === m.id)!;
                return (
                  <li key={m.id}><button type="button" onClick={() => setAbrir({ tipo: "registro", registro: r })}>
                    <i className={m.simbolo === "X" || m.simbolo === "O" ? "marco" : ""}>{m.simbolo}</i>
                    <span>{hora(m.momento)}</span>{m.rotulo}
                    {f.idsPendentes.has(m.id) && <em>enviando</em>}
                  </button></li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="evoDireita" aria-label="Medicação">
          <section className="evoPainel">
            <header><h2>Medicação</h2>
              {aberta && <button type="button" className="evoBotao" onClick={() => setAbrir({ tipo: "medicamento" })}>+ Medicamento</button>}
            </header>
            {planejados.length > 0 && (
              <div className="evoPlanejados">
                <h3>Planejados e preparados</h3>
                <ul className="evoLista">
                  {planejados.map((r) => (
                    <li key={r.id}>
                      <b>{String(r.dados.nome)}</b>
                      <span>{r.dados.dose ? `${fmt(Number(r.dados.dose))} ${r.dados.unidade} · ` : ""}{String(r.dados.status)}</span>
                      {aberta && <div className="evoAcoesLinha">
                        <button type="button" className="evoBotao pequeno" onClick={() => setAbrir({ tipo: "medicamento", planejado: r })}>Administrar</button>
                        <button type="button" className="evoBotao pequeno secundario" onClick={() => {
                          f.corrigir(r, { momento: r.momento, dados: { ...r.dados, status: "cancelado" }, motivo: "Cancelado" });
                        }}>Cancelar</button>
                      </div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {grupos.length ? (
              <ul className="evoMedicamentos">
                {grupos.map((g) => (
                  <li key={g.nome}>
                    <header><b>{g.nome}</b>{g.total !== null && g.vezes.length > 1 && <span>Total {fmt(g.total)} {g.unidade}</span>}</header>
                    {g.vezes.map((a) => <LinhaDose key={a.id} a={a} registro={atuais.find((r) => r.id === a.id)!} cabecalho={dados}
                      pendente={f.idsPendentes.has(a.id)} onAbrir={(r) => setAbrir({ tipo: "registro", registro: r })} />)}
                  </li>
                ))}
              </ul>
            ) : <p className="evoVazio">Só aparece aqui o que for administrado.</p>}
            {exposicao.length > 0 && (
              <p className="evoNota">
                Anestésico local: {exposicao.map((e) => `${e.nome} ${e.mg !== null ? `${fmt(e.mg)} mg` : "—"}${e.mgPorKg !== null ? ` (${fmt(e.mgPorKg)} mg/kg)` : ""}`).join(" · ")}.
                Soma por agente; o julgamento da exposição combinada depende de regra validada.
              </p>
            )}
          </section>
        </aside>
      </div>

      {/* Embaixo, na ordem do papel: posição e técnica, cirurgia, saída, equipe */}
      <div className="evoBase">
        <section className="evoPainel largo">
          <header><h2>Posição e técnica</h2></header>
          <SecaoTecnica dados={dados} onMudar={f.mudarCabecalho} leitura={!aberta} />
        </section>
        <section className="evoPainel">
          <header><h2>Cirurgia</h2></header>
          <SecaoCirurgia dados={dados} onMudar={f.mudarCabecalho} leitura={!aberta} marcos={{
            inicioAnestesia: horarioDoMarco(atuais, "inicio_anestesia"), fimAnestesia: fimAnestesia,
            inicioCirurgia: horarioDoMarco(atuais, "inicio_cirurgia"), fimCirurgia: horarioDoMarco(atuais, "fim_cirurgia"),
          }} />
        </section>
        <section className="evoPainel">
          <header><h2>Saída da sala</h2></header>
          <SecaoSaida dados={dados} onMudar={f.mudarCabecalho} leitura={!aberta} />
        </section>
        <section className="evoPainel largo">
          <header><h2>Equipe</h2></header>
          <SecaoEquipe dados={dados} onMudar={f.mudarCabecalho} leitura={!aberta} medicos={medicos} />
        </section>
      </div>

      {aviso && (
        <div className="evoAviso" role="status">
          <span>{aviso.texto}</span>
          {aviso.desfazer && f.podeDesfazer && (
            <button type="button" onClick={() => { f.desfazerUltimo(); setAviso(null); }}>Desfazer</button>
          )}
        </div>
      )}

      {abrir?.tipo === "sinal" && (
        <JanelaSinal modo={abrir.modo} ms={abrir.ms} valor={abrir.valor} temPamMedida={temPamMedida}
          onConfirmar={registrarSinais} onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "lancar" && (
        <JanelaLancar temPamMedida={temPamMedida} onConfirmar={registrarSinais} onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "ponto" && (
        <JanelaPonto registro={abrir.registro} todos={todos} nomes={nomes} somenteLeitura={!aberta}
          onCorrigir={(momento, valor) => {
            f.corrigir(abrir.registro, { momento, dados: { ...abrir.registro.dados, valor }, origem: "manual" });
            setAbrir(null);
          }}
          onExcluir={(motivo) => { f.excluir(abrir.registro, motivo); setAbrir(null); }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "mover" && (
        <JanelaMover registro={abrir.registro} momento={new Date(abrir.t.ms).toISOString()} valor={abrir.t.valor}
          onConfirmar={() => {
            f.corrigir(abrir.registro, {
              momento: new Date(abrir.t.ms).toISOString(),
              dados: { ...abrir.registro.dados, valor: abrir.t.valor }, origem: "manual",
            });
            setAbrir(null);
          }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "medicamento" && (
        <JanelaMedicamento pesoKg={pesoKg} idadeDias={idadeDias} regras={regras} dadas={dadas}
          favoritos={favoritos} inicial={abrir.planejado?.dados ?? null} alergias={dados}
          onConfirmar={({ momento, dados: d }) => {
            if (abrir.planejado) f.corrigir(abrir.planejado, { momento, dados: d });
            else f.registrar({ tipo: "medicamento", momento, dados: d });
            if (d.status === "administrado") contarFavorito(String(d.nome));
            setAbrir(null);
            setAviso({ texto: `${String(d.nome)} ${d.dose ? `${fmt(Number(d.dose))} ${d.unidade}` : ""} · ${String(d.status)} às ${hora(momento)}`, desfazer: !abrir.planejado });
          }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "infusao" && (
        <JanelaInfusao acao={abrir.acao} infusao={abrir.infusao} alergias={dados} ms={abrir.ms}
          onConfirmar={(momento, d) => { f.registrar({ tipo: "infusao", momento, dados: d }); setAbrir(null); }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "infusaoAcoes" && (
        <JanelaInfusaoAcoes infusao={abrir.infusao} pesoKg={pesoKg}
          onAcao={(acao) => setAbrir({ tipo: "infusao", acao, infusao: abrir.infusao, ms: abrir.ms })}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "gas" && (
        <JanelaGas atual={gasAtual} ms={abrir.ms}
          onConfirmar={(momento, d) => { f.registrar({ tipo: "gas", momento, dados: d }); setAbrir(null); }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "liquido" && (
        <JanelaLiquido sentido={abrir.sentido} ms={abrir.ms} inicial={abrir.inicial}
          onConfirmar={(momento, d) => { f.registrar({ tipo: "liquido", momento, dados: d }); setAbrir(null); }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "evento" && (
        <JanelaEvento onConfirmar={(momento, d) => { f.registrar({ tipo: "evento", momento, dados: d }); setAbrir(null); }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "registro" && (
        <JanelaRegistro registro={abrir.registro} todos={todos} nomes={nomes} leitura={!aberta}
          onMudarHora={(momento) => { f.corrigir(abrir.registro, { momento, dados: abrir.registro.dados, origem: abrir.registro.origem }); setAbrir(null); }}
          onExcluir={(motivo) => { f.excluir(abrir.registro, motivo); setAbrir(null); }}
          onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "encerrar" && (
        <JanelaEncerrar pendencias={pendenciasEncerrar} encerrando={encerrando} erro={erroAcao}
          onEncerrar={() => void encerrar()} onFechar={() => setAbrir(null)} />
      )}
      {abrir?.tipo === "reabrir" && (
        <JanelaReabrir versao={folha.versao} reabrindo={encerrando} erro={erroAcao}
          onReabrir={(m) => void reabrir(m)} onFechar={() => setAbrir(null)} />
      )}
    </main>
  );
}

/** Tocou numa infusão em curso: ajustar a velocidade ou encerrar. */
function JanelaInfusaoAcoes({ infusao, pesoKg, onAcao, onFechar }: {
  infusao: Infusao; pesoKg: number | null; onAcao: (acao: "ajustar" | "encerrar") => void; onFechar: () => void;
}) {
  const passo = infusao.passos[infusao.passos.length - 1];
  const total = totalDaInfusao(infusao, pesoKg);
  return (
    <Janela titulo={infusao.nome} subtitulo={infusao.diluicao || undefined} largura="estreita" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={() => onAcao("encerrar")}>Encerrar infusão</button>
        <button type="button" className="evoBotao" onClick={() => onAcao("ajustar")}>Ajustar velocidade</button>
      </>}>
      <div className="evoForm">
        <p>{fmt(passo.valor)} {passo.unidade} desde {hora(passo.momento)} · iniciada às {hora(infusao.inicio)}</p>
        <p className="evoNota">
          {[total.volumeMl !== null && `${fmt(total.volumeMl, 1)} mL`, total.quantidade !== null && `${fmt(total.quantidade)} ${total.unidadeQuantidade}`]
            .filter(Boolean).join(" · ") || "O total depende da concentração."} até o último registro.
        </p>
      </div>
    </Janela>
  );
}

function Sincronia({ estado, pendentes, cabecalho }: { estado: string; pendentes: number; cabecalho: string }) {
  const texto = estado === "sem_conexao" ? `Sem conexão · ${pendentes} aguardando`
    : estado === "erro" ? "Registro recusado"
    : pendentes > 0 || estado === "salvando" || cabecalho === "salvando" ? "Salvando…"
    : cabecalho === "erro" ? "Cabeçalho aguardando conexão"
    : "Salvo";
  const classe = estado === "sem_conexao" || cabecalho === "erro" ? "atencao" : estado === "erro" ? "perigo" : texto === "Salvo" ? "ok" : "";
  return <span className={`evoSincronia ${classe}`} role="status" aria-live="polite">{texto}</span>;
}

function LinhaDose({ a, registro, cabecalho, pendente, onAbrir }: {
  a: Administracao; registro: Registro; cabecalho: Record<string, unknown>; pendente: boolean; onAbrir: (r: Registro) => void;
}) {
  const alerta = (registro?.dados.alerta ?? null) as { nivel?: string } | null;
  // Gravada com justificativa, ou alergia escrita depois de dar: as duas aparecem.
  const alergia = Boolean(registro?.dados.alerta_alergia) || conferirAlergia(cabecalho, a.nome) !== null;
  return (
    <button type="button" className={`evoDose${pendente ? " pendente" : ""}`} onClick={() => onAbrir(registro)}>
      <span>{hora(a.momento)}</span>
      <b>{fmt(a.dose)} {a.unidade}</b>
      <span>{a.via}</span>
      {alerta?.nivel && ["amarelo", "vermelho"].includes(alerta.nivel) && (
        <i className={`evoAlertaPonto ${alerta.nivel}`} title="Dose registrada com alerta e justificativa" />
      )}
      {alergia && <em className="evoAlergiaTag" title="Coincide com alergia registrada na folha">Alergia</em>}
    </button>
  );
}

function descrever(r: Registro): string {
  const d = r.dados;
  if (r.anulado) return "excluído";
  switch (r.tipo) {
    case "medicamento": return `${d.nome} ${d.dose ?? ""} ${d.unidade ?? ""} ${d.via ?? ""} · ${d.status} às ${hora(r.momento)}`;
    case "liquido": return `${d.nome} ${d.volume_ml} mL às ${hora(r.momento)}`;
    case "evento": return `${rotuloDoEvento(String(d.codigo), String(d.descricao ?? ""))} às ${hora(r.momento)}`;
    case "gas": return `O₂ ${d.o2} · Ar ${d.ar} · Sevo ${d.sevo_pct}% às ${hora(r.momento)}`;
    case "infusao": return `${d.acao} ${d.nome ?? ""} às ${hora(r.momento)}`;
    default: return `${PARAMETROS[d.parametro as Parametro]?.curto ?? ""} ${d.valor} às ${hora(r.momento)}`;
  }
}

/** Qualquer registro que não seja ponto do gráfico: ver, mudar o horário, excluir. */
function JanelaRegistro({ registro, todos, nomes, leitura, onMudarHora, onExcluir, onFechar }: {
  registro: Registro; todos: Registro[]; nomes: Map<string, string>; leitura: boolean;
  onMudarHora: (momento: string) => void; onExcluir: (motivo: string) => void; onFechar: () => void;
}) {
  const [horaTxt, setHoraTxt] = useState(hora(registro.momento));
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const alerta = registro.dados.alerta as { nivel?: string; motivos?: string[]; justificativa?: string } | undefined;
  const alergia = registro.dados.alerta_alergia as { termo?: string; alergias?: string; justificativa?: string | null } | undefined;
  // O novo horário no mesmo dia do registro (ou no vizinho, se cruzar a meia-noite).
  const novo = (() => {
    const [h, m] = horaTxt.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const [h0, m0] = hora(registro.momento).split(":").map(Number);
    let diff = (h * 60 + m) - (h0 * 60 + m0);
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    return new Date(Date.parse(registro.momento) + diff * 60000).toISOString();
  })();
  return (
    <Janela titulo={descrever(registro)} largura="estreita" onFechar={onFechar}
      rodape={leitura ? <button type="button" className="evoBotao secundario" onClick={onFechar}>Fechar</button>
        : excluindo ? <>
          <button type="button" className="evoBotao secundario" onClick={() => setExcluindo(false)}>Voltar</button>
          <button type="button" className="evoBotao perigo" disabled={motivo.trim().length < 3} onClick={() => onExcluir(motivo.trim())}>Excluir</button>
        </> : <>
          <button type="button" className="evoBotao secundario" onClick={() => setExcluindo(true)}>Excluir…</button>
          <button type="button" className="evoBotao" disabled={!novo || novo === registro.momento}
            onClick={() => novo && onMudarHora(novo)}>Corrigir horário</button>
        </>}>
      <div className="evoForm">
        {excluindo ? (
          <label className="evoCampo"><span>Motivo da exclusão (fica no histórico)</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} autoFocus />
          </label>
        ) : !leitura && (
          <label className="evoCampo"><span>Horário</span>
            <input type="time" value={horaTxt} onChange={(e) => setHoraTxt(e.target.value)} />
          </label>
        )}
        {alergia && (
          <section className="evoAlergia">
            <b>Alergia registrada: {alergia.alergias}</b>
            <p>Coincide com “{alergia.termo}”.{alergia.justificativa ? ` Justificativa: ${alergia.justificativa}` : ""}</p>
          </section>
        )}
        {alerta?.nivel && alerta.nivel !== "verde" && (
          <section className={`evoConferencia ${alerta.nivel}`}>
            {alerta.motivos?.map((m) => <p key={m}>{m}</p>)}
            {alerta.justificativa && <p><b>Justificativa:</b> {alerta.justificativa}</p>}
          </section>
        )}
        <Historico cadeia={historicoDe(registro.id, todos)} nomes={nomes} formatar={descrever} />
      </div>
    </Janela>
  );
}
