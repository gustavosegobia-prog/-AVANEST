"use client";

import { useState } from "react";
import { conferirAlergia, situacaoDaAlergia } from "@/lib/evolucao/alergias";
import { Janela } from "@/components/janela";
import { horaLocal } from "@/lib/data-local";
import { buscarNoCatalogo, type UnidadeDeConcentracao } from "@/lib/evolucao/medicamentos";
import type { Infusao, UnidadeDeVelocidade } from "@/lib/evolucao/infusoes";
import type { AjusteDeGas } from "@/lib/evolucao/sevoflurano";
import { LIQUIDOS_ENTRADA, LIQUIDOS_SAIDA, VOLUMES_RAPIDOS, type CategoriaDeLiquido } from "@/lib/evolucao/liquidos";
import type { Pendencia } from "@/lib/evolucao/folha";
import { momentoDeHora } from "./use-folha";
import { CampoHora, CampoNumero, Escolha, numero } from "./campos";

const VELOCIDADES: UnidadeDeVelocidade[] = ["mL/h", "mcg/kg/min", "mcg/kg/h", "mg/kg/h", "mcg/min", "mg/h", "UI/h", "UI/min"];
const CONCENTRACOES: UnidadeDeConcentracao[] = ["mcg/mL", "mg/mL", "UI/mL", "%"];

function Rodape({ onFechar, form, rotulo, ok, perigo = false }: {
  onFechar: () => void; form: string; rotulo: string; ok: boolean; perigo?: boolean;
}) {
  return <>
    <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
    <button type="submit" form={form} className={`evoBotao${perigo ? " perigo" : ""}`} disabled={!ok}>{rotulo}</button>
  </>;
}

// ---------------------------------------------------------------------------
// Infusão contínua
// ---------------------------------------------------------------------------
export function JanelaInfusao({ infusao, acao, alergias, onConfirmar, onFechar }: {
  infusao: Infusao | null;
  acao: "iniciar" | "ajustar" | "encerrar";
  /** O cabeçalho da folha: alergias e "nega alergia". */
  alergias: { alergias?: unknown; nega_alergia?: unknown };
  onConfirmar: (momento: string, dados: Record<string, unknown>) => void;
  onFechar: () => void;
}) {
  const ultimo = infusao?.passos[infusao.passos.length - 1];
  const [hora, setHora] = useState(horaLocal());
  const [nome, setNome] = useState(infusao?.nome ?? "");
  const [diluicao, setDiluicao] = useState("");
  const [conc, setConc] = useState("");
  const [uConc, setUConc] = useState<UnidadeDeConcentracao>("mcg/mL");
  const [vel, setVel] = useState(ultimo ? String(ultimo.valor).replace(".", ",") : "");
  const [uVel, setUVel] = useState<UnidadeDeVelocidade>(ultimo?.unidade ?? "mL/h");
  const momento = momentoDeHora(hora);
  const velN = numero(vel);
  const sugestoes = acao === "iniciar" && nome.trim().length >= 2 && !buscarNoCatalogo(nome).some((i) => i.nome === nome)
    ? buscarNoCatalogo(nome).slice(0, 5) : [];
  const [justificaAlergia, setJustificaAlergia] = useState("");
  const alergia = acao === "iniciar" && nome.trim() ? conferirAlergia(alergias, nome.trim()) : null;
  const ok = Boolean(momento) && (acao === "encerrar" || (velN !== null && velN >= 0))
    && (acao !== "iniciar" || nome.trim().length > 0)
    && (!alergia || justificaAlergia.trim().length >= 5);

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !momento) return;
    if (acao === "iniciar") {
      const c = numero(conc);
      onConfirmar(momento, {
        acao, nome: nome.trim(), velocidade: { valor: velN, unidade: uVel },
        ...(diluicao.trim() ? { diluicao: diluicao.trim() } : {}),
        ...(c && c > 0 ? { concentracao: { valor: c, unidade: uConc } } : {}),
        ...(alergia ? { alerta_alergia: { ...alergia, justificativa: justificaAlergia.trim() } } : {}),
      });
    } else if (acao === "ajustar") {
      onConfirmar(momento, { acao, infusao_id: infusao!.id, velocidade: { valor: velN, unidade: uVel } });
    } else {
      onConfirmar(momento, { acao, infusao_id: infusao!.id });
    }
  }

  const titulo = acao === "iniciar" ? "Iniciar infusão" : acao === "ajustar" ? `Ajustar ${infusao?.nome}` : `Encerrar ${infusao?.nome}`;
  return (
    <Janela titulo={titulo} largura="media" onFechar={onFechar}
      rodape={<Rodape onFechar={onFechar} form="evoFormInf" ok={ok}
        rotulo={acao === "iniciar" ? "Iniciar" : acao === "ajustar" ? "Registrar ajuste" : "Encerrar infusão"} />}>
      <form id="evoFormInf" className="evoForm" onSubmit={confirmar}>
        {acao === "iniciar" && <>
          <label className="evoCampo"><span>Medicamento</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: noradrenalina, remifentanil" />
          </label>
          {sugestoes.length > 0 && (
            <div className="evoOpcoesMotivo">
              {sugestoes.map((s) => <button type="button" key={s.id} onClick={() => setNome(s.nome)}>{s.nome}</button>)}
            </div>
          )}
          {alergia ? (
            <section className="evoAlergia" role="alert">
              <b>Possível alergia</b>
              <p>
                O paciente tem alergia registrada a “{alergia.alergias}”, e {nome.trim()} coincide com “{alergia.termo}”.
                A conferência compara nomes; não avalia reação cruzada entre classes.
              </p>
              <label className="evoCampo"><span>Justificativa para iniciar mesmo assim (fica registrada)</span>
                <textarea value={justificaAlergia} onChange={(e) => setJustificaAlergia(e.target.value)} rows={2} maxLength={500} />
              </label>
            </section>
          ) : <p className="evoAlergiaSituacao">{situacaoDaAlergia(alergias)}</p>}
          <label className="evoCampo"><span>Diluição</span>
            <input value={diluicao} onChange={(e) => setDiluicao(e.target.value)} placeholder="Ex.: 4 mg em 250 mL de SG 5%" />
          </label>
          <div className="evoLinhaCampos">
            <CampoNumero rotulo="Concentração final" valor={conc} onMudar={setConc} />
            <label className="evoCampo evoUnidade"><span>Unidade</span>
              <select value={uConc} onChange={(e) => setUConc(e.target.value as UnidadeDeConcentracao)}>
                {CONCENTRACOES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
          </div>
        </>}
        <div className="evoLinhaCampos">
          <CampoHora valor={hora} onMudar={setHora} />
          {acao !== "encerrar" && <>
            <CampoNumero rotulo="Velocidade" valor={vel} onMudar={setVel} autoFocus={acao === "ajustar"} />
            <label className="evoCampo evoUnidade"><span>Unidade</span>
              <select value={uVel} onChange={(e) => setUVel(e.target.value as UnidadeDeVelocidade)}>
                {VELOCIDADES.map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
          </>}
        </div>
        {acao === "iniciar" && (
          <p className="evoNota">Sem a concentração, a folha soma o volume (em mL/h) mas não a dose total.</p>
        )}
      </form>
    </Janela>
  );
}

// ---------------------------------------------------------------------------
// Gases
// ---------------------------------------------------------------------------
export function JanelaGas({ atual, onConfirmar, onFechar }: {
  atual: AjusteDeGas | null;
  onConfirmar: (momento: string, dados: Record<string, unknown>) => void;
  onFechar: () => void;
}) {
  const ini = (v: number | undefined) => (v ? String(v).replace(".", ",") : "");
  const [hora, setHora] = useState(horaLocal());
  const [o2, setO2] = useState(ini(atual?.o2));
  const [ar, setAr] = useState(ini(atual?.ar));
  const [n2o, setN2o] = useState(ini(atual?.n2o));
  const [sevo, setSevo] = useState(ini(atual?.sevoPct));
  const momento = momentoDeHora(hora);
  const campos = { o2: numero(o2), ar: numero(ar), n2o: numero(n2o) };
  const foraDeFaixa = Object.values(campos).some((v) => v !== null && (v < 0 || v > 15));
  const sevoN = numero(sevo);
  const sevoRuim = sevoN !== null && (sevoN < 0 || sevoN > 8);
  const ok = Boolean(momento) && !foraDeFaixa && !sevoRuim;

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !momento) return;
    onConfirmar(momento, {
      o2: campos.o2 ?? 0, ar: campos.ar ?? 0, n2o: campos.n2o ?? 0, sevo_pct: sevoN ?? 0,
    });
  }

  return (
    <Janela titulo="Gases" subtitulo="Cada ajuste abre um novo intervalo no cálculo do sevoflurano." largura="media" onFechar={onFechar}
      rodape={<Rodape onFechar={onFechar} form="evoFormGas" ok={ok} rotulo="Registrar ajuste" />}>
      <form id="evoFormGas" className="evoForm" onSubmit={confirmar}>
        <CampoHora valor={hora} onMudar={setHora} />
        <div className="evoLinhaCampos">
          <CampoNumero rotulo="O₂" valor={o2} onMudar={setO2} unidade="L/min" autoFocus
            aviso={campos.o2 !== null && (campos.o2 < 0 || campos.o2 > 15) ? "0 a 15 L/min." : null} />
          <CampoNumero rotulo="Ar comprimido" valor={ar} onMudar={setAr} unidade="L/min"
            aviso={campos.ar !== null && (campos.ar < 0 || campos.ar > 15) ? "0 a 15 L/min." : null} />
          <CampoNumero rotulo="N₂O" valor={n2o} onMudar={setN2o} unidade="L/min"
            aviso={campos.n2o !== null && (campos.n2o < 0 || campos.n2o > 15) ? "0 a 15 L/min." : null} />
        </div>
        <CampoNumero rotulo="Sevoflurano ajustado no vaporizador" valor={sevo} onMudar={setSevo} unidade="%"
          aviso={sevoRuim ? "0 a 8%." : null} />
        <p className="evoNota">
          É a concentração do vaporizador, não a inspirada nem a expirada do monitor. Para desligar o
          sevoflurano, registre 0.
        </p>
      </form>
    </Janela>
  );
}

// ---------------------------------------------------------------------------
// Líquidos
// ---------------------------------------------------------------------------
export function JanelaLiquido({ sentido, onConfirmar, onFechar }: {
  sentido: "entrada" | "saida";
  onConfirmar: (momento: string, dados: Record<string, unknown>) => void;
  onFechar: () => void;
}) {
  const opcoes = sentido === "entrada" ? LIQUIDOS_ENTRADA : LIQUIDOS_SAIDA;
  const [hora, setHora] = useState(horaLocal());
  const [categoria, setCategoria] = useState<CategoriaDeLiquido>(opcoes[0].categoria);
  const [nome, setNome] = useState(sentido === "saida" ? opcoes[0].rotulo : "");
  const [volume, setVolume] = useState("");
  const momento = momentoDeHora(hora);
  const v = numero(volume);
  const ok = Boolean(momento) && v !== null && v > 0 && v <= 20000 && nome.trim().length > 0;
  const exemplos = sentido === "entrada" ? LIQUIDOS_ENTRADA.find((o) => o.categoria === categoria)?.exemplos ?? [] : [];

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !momento) return;
    onConfirmar(momento, { sentido, categoria, nome: nome.trim(), volume_ml: v });
  }

  return (
    <Janela titulo={sentido === "entrada" ? "Entrada de líquido" : "Saída / perda"} largura="media" onFechar={onFechar}
      rodape={<Rodape onFechar={onFechar} form="evoFormLiq" ok={ok} rotulo="Registrar" />}>
      <form id="evoFormLiq" className="evoForm" onSubmit={confirmar}>
        <Escolha rotulo="Tipo" valor={categoria} onMudar={(c) => {
          setCategoria(c);
          if (sentido === "saida") setNome(LIQUIDOS_SAIDA.find((o) => o.categoria === c)?.rotulo ?? "");
        }} opcoes={opcoes.map((o) => ({ valor: o.categoria, rotulo: o.rotulo }))} />
        {sentido === "entrada" && <>
          <label className="evoCampo"><span>Solução</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da solução ou hemoderivado" />
          </label>
          {exemplos.length > 0 && (
            <div className="evoOpcoesMotivo">
              {exemplos.map((x) => <button type="button" key={x} className={nome === x ? "ativo" : ""} onClick={() => setNome(x)}>{x}</button>)}
            </div>
          )}
        </>}
        <div className="evoLinhaCampos">
          <CampoHora valor={hora} onMudar={setHora} />
          <CampoNumero rotulo="Volume" valor={volume} onMudar={setVolume} unidade="mL" autoFocus={sentido === "saida"} />
        </div>
        {sentido === "entrada" && (categoria === "cristaloide" || categoria === "coloide") && (
          <div className="evoOpcoesMotivo" aria-label="Volume da bolsa">
            {VOLUMES_RAPIDOS.map((ml) => (
              <button type="button" key={ml} className={v === ml ? "ativo" : ""} onClick={() => setVolume(String(ml))}>{ml} mL</button>
            ))}
          </div>
        )}
      </form>
    </Janela>
  );
}

// ---------------------------------------------------------------------------
// Evento personalizado
// ---------------------------------------------------------------------------
export function JanelaEvento({ onConfirmar, onFechar }: {
  onConfirmar: (momento: string, dados: Record<string, unknown>) => void;
  onFechar: () => void;
}) {
  const [hora, setHora] = useState(horaLocal());
  const [descricao, setDescricao] = useState("");
  const momento = momentoDeHora(hora);
  const ok = Boolean(momento) && descricao.trim().length > 1;
  return (
    <Janela titulo="Outro evento" largura="estreita" onFechar={onFechar}
      rodape={<Rodape onFechar={onFechar} form="evoFormEv" ok={ok} rotulo="Registrar" />}>
      <form id="evoFormEv" className="evoForm" onSubmit={(e) => {
        e.preventDefault();
        if (ok && momento) onConfirmar(momento, { codigo: "personalizado", descricao: descricao.trim() });
      }}>
        <label className="evoCampo"><span>O que aconteceu</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} autoFocus
            placeholder="Ex.: broncoespasmo, tratado com…" />
        </label>
        <CampoHora valor={hora} onMudar={setHora} />
      </form>
    </Janela>
  );
}

// ---------------------------------------------------------------------------
// Encerrar e reabrir
// ---------------------------------------------------------------------------
export function JanelaEncerrar({ pendencias, encerrando, erro, onEncerrar, onFechar }: {
  pendencias: Pendencia[]; encerrando: boolean; erro: string | null;
  onEncerrar: () => void; onFechar: () => void;
}) {
  const bloqueiam = pendencias.filter((p) => p.tipo !== "aviso");
  const avisos = pendencias.filter((p) => p.tipo === "aviso");
  return (
    <Janela titulo="Conferência antes de encerrar" largura="media" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Voltar para a folha</button>
        <button type="button" className="evoBotao" disabled={bloqueiam.length > 0 || encerrando} onClick={onEncerrar}>
          {encerrando ? "Encerrando…" : "Encerrar folha"}
        </button>
      </>}>
      <div className="evoForm">
        {bloqueiam.length > 0 && (
          <section className="evoConferencia vermelho">
            <header><b>Antes de encerrar, falta</b></header>
            <ul>{bloqueiam.map((p) => <li key={p.texto}>{p.texto}</li>)}</ul>
          </section>
        )}
        {avisos.length > 0 && (
          <section className="evoConferencia amarelo">
            <header><b>Confira</b></header>
            <ul>{avisos.map((p) => <li key={p.texto}>{p.texto}</li>)}</ul>
          </section>
        )}
        {!pendencias.length && <p className="evoNota">Tudo conferido. Ao encerrar, a folha fica guardada como versão para impressão.</p>}
        {bloqueiam.length === 0 && avisos.length > 0 && (
          <p className="evoNota">Os avisos não impedem o encerramento. Nada é preenchido por suposição.</p>
        )}
        {erro && <p className="evoErro" role="alert">{erro}</p>}
      </div>
    </Janela>
  );
}

export function JanelaReabrir({ versao, reabrindo, erro, onReabrir, onFechar }: {
  versao: number; reabrindo: boolean; erro: string | null;
  onReabrir: (motivo: string) => void; onFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <Janela titulo="Reabrir para correção" subtitulo={`A versão ${versao} fica guardada como foi impressa.`}
      largura="estreita" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="button" className="evoBotao" disabled={motivo.trim().length < 5 || reabrindo}
          onClick={() => onReabrir(motivo.trim())}>{reabrindo ? "Reabrindo…" : `Abrir versão ${versao + 1}`}</button>
      </>}>
      <div className="evoForm">
        <label className="evoCampo"><span>Motivo da correção</span>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={300} autoFocus />
        </label>
        {erro && <p className="evoErro" role="alert">{erro}</p>}
      </div>
    </Janela>
  );
}
