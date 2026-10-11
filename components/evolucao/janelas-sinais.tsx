"use client";

import { useState } from "react";
import { Janela } from "@/components/janela";
import { horaLocal } from "@/lib/data-local";
import { PARAMETROS, pamEstimada, valorPlausivel, type Parametro } from "@/lib/evolucao/sinais";
import { historicoDe, type Registro } from "@/lib/evolucao/registros";
import { momentoDeHora } from "./use-folha";
import { CampoHora, CampoNumero, numero } from "./campos";

export type NovoSinal = { parametro: Parametro; valor: number; origem: "manual" | "estimado" };

const aviso = (p: Parametro, t: string) => {
  if (!t.trim()) return null;
  const v = numero(t);
  return valorPlausivel(p, v) ? null : `Entre ${PARAMETROS[p].min} e ${PARAMETROS[p].max} ${PARAMETROS[p].unidade}.`;
};

const PRESSAO: Parametro[] = ["pas", "pad", "pam"];
const DEMAIS: Parametro[] = ["fc", "spo2", "etco2", "temp"];
const VAZIO: Record<Parametro, string> = { pas: "", pad: "", pam: "", fc: "", spo2: "", etco2: "", temp: "" };

/**
 * Os sinais vitais de um horário, numa janela só: o toque no gráfico (ou o
 * "Lançar valores") abre com o horário do toque, e o médico preenche o que
 * quiser — o que ficar em branco não é registrado. Nada vem preenchido: o
 * toque escolhe o horário, não o valor.
 *
 * PA vai em par (sistólica e diastólica, a diastólica menor). A PAM digitada
 * é a do monitor; sem ela, a estimada aparece calculada e só é gravada se o
 * médico marcar, e nunca onde já há uma PAM medida no mesmo minuto.
 */
export function JanelaSinais({ ms, foco = "pas", temPamMedida, onConfirmar, onFechar }: {
  /** O horário do toque; sem ele, agora. */
  ms?: number;
  /** O campo que recebe o cursor — a linha tocada no gráfico. */
  foco?: Parametro;
  temPamMedida: (iso: string) => boolean;
  onConfirmar: (itens: NovoSinal[], momento: string) => void;
  onFechar: () => void;
}) {
  const base = ms !== undefined ? new Date(ms) : undefined;
  const [hora, setHora] = useState(horaLocal(base));
  const [v, setV] = useState<Record<Parametro, string>>(VAZIO);
  const [comPam, setComPam] = useState(false);
  const momento = momentoDeHora(hora, base);
  const preenchidos = (Object.keys(v) as Parametro[]).filter((p) => v[p].trim());
  const pas = numero(v.pas), pad = numero(v.pad);
  const comPa = Boolean(v.pas.trim() || v.pad.trim());
  const paIncompleta = comPa && (!v.pas.trim() || !v.pad.trim());
  const paInvertida = pas !== null && pad !== null && pad >= pas;
  const estimada = !v.pam.trim() && pas !== null && pad !== null ? pamEstimada(pas, pad) : null;
  const pamBloqueada = momento ? temPamMedida(momento) : false;
  const ok = Boolean(momento) && preenchidos.length > 0 && !paIncompleta && !paInvertida
    && preenchidos.every((p) => valorPlausivel(p, numero(v[p])));

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !momento) return;
    const itens: NovoSinal[] = preenchidos.map((p) => ({ parametro: p, valor: numero(v[p])!, origem: "manual" }));
    if (comPam && estimada !== null && !pamBloqueada) itens.push({ parametro: "pam", valor: estimada, origem: "estimado" });
    onConfirmar(itens, momento);
  }

  const campo = (p: Parametro, rotulo: string, extra: string | null = null) => (
    <CampoNumero key={p} rotulo={rotulo} valor={v[p]} unidade={PARAMETROS[p].unidade} autoFocus={p === foco}
      onMudar={(t) => setV((x) => ({ ...x, [p]: t }))} aviso={aviso(p, v[p]) ?? extra} />
  );

  return (
    <Janela titulo="Sinais vitais" subtitulo="Preencha só o que quiser registrar." largura="media" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="submit" form="evoFormSinais" className="evoBotao" disabled={!ok}>
          Registrar{preenchidos.length > 1 ? ` ${preenchidos.length}` : ""}
        </button>
      </>}>
      <form id="evoFormSinais" className="evoForm" onSubmit={confirmar}>
        <CampoHora valor={hora} onMudar={setHora} />
        <div className="evoGradeCampos evoSinaisPa">
          {PRESSAO.map((p) => campo(p, p === "pas" ? "PA sistólica" : p === "pad" ? "PA diastólica" : "PAM (monitor)",
            p === "pad" && paInvertida ? "A diastólica tem de ser menor que a sistólica."
              : p === "pad" && paIncompleta && v.pas.trim() ? "Falta a diastólica."
                : p === "pas" && paIncompleta && v.pad.trim() ? "Falta a sistólica." : null))}
        </div>
        {estimada !== null && (
          <label className={`evoMarca${pamBloqueada ? " desligada" : ""}`}>
            <input type="checkbox" checked={comPam && !pamBloqueada} disabled={pamBloqueada}
              onChange={(e) => setComPam(e.target.checked)} />
            <span>
              Registrar também a PAM estimada: <b>{estimada} mmHg</b>
              <small>{pamBloqueada ? "Já há PAM medida neste minuto — a medida prevalece."
                : "(PAS + 2 × PAD) / 3. Aparece marcada como estimada, separada da PAM do monitor."}</small>
            </span>
          </label>
        )}
        <div className="evoGradeCampos evoSinaisJuntos">
          {DEMAIS.map((p) => campo(p, PARAMETROS[p].curto))}
        </div>
      </form>
    </Janela>
  );
}

const MOTIVOS = ["Registro feito por engano", "Valor errado", "Horário errado", "Outro paciente"];

/** Um ponto já registrado: o histórico dele, a correção e a exclusão. */
export function JanelaPonto({ registro, todos, nomes, onCorrigir, onExcluir, onFechar, somenteLeitura }: {
  registro: Registro; todos: Registro[]; nomes: Map<string, string>;
  onCorrigir: (momento: string, valor: number) => void;
  onExcluir: (motivo: string) => void;
  onFechar: () => void;
  somenteLeitura: boolean;
}) {
  const p = registro.dados.parametro as Parametro;
  const [hora, setHora] = useState(horaLocal(new Date(registro.momento)));
  const [valor, setValor] = useState(String(registro.dados.valor ?? ""));
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const momento = momentoDeHora(hora, new Date(registro.momento));
  const n = numero(valor);
  const mudou = momento !== null && (momento !== registro.momento || n !== registro.dados.valor);
  const historico = historicoDe(registro.id, todos);

  return (
    <Janela titulo={`${PARAMETROS[p].nome}${registro.origem === "estimado" ? " (estimada)" : ""}`}
      subtitulo={`${registro.dados.valor} ${PARAMETROS[p].unidade} às ${horaLocal(new Date(registro.momento))}`}
      largura="estreita" onFechar={onFechar}
      rodape={somenteLeitura ? <button type="button" className="evoBotao secundario" onClick={onFechar}>Fechar</button>
        : excluindo ? <>
          <button type="button" className="evoBotao secundario" onClick={() => setExcluindo(false)}>Voltar</button>
          <button type="button" className="evoBotao perigo" disabled={!motivo.trim()} onClick={() => onExcluir(motivo.trim())}>
            Excluir ponto
          </button>
        </> : <>
          <button type="button" className="evoBotao secundario" onClick={() => setExcluindo(true)}>Excluir…</button>
          <button type="button" className="evoBotao" disabled={!mudou || !valorPlausivel(p, n)}
            onClick={() => momento && n !== null && onCorrigir(momento, n)}>Salvar correção</button>
        </>}>
      {excluindo ? (
        <div className="evoForm">
          <p className="evoNota">O ponto sai do gráfico e da impressão, mas continua no histórico, com o motivo.</p>
          <div className="evoOpcoesMotivo">
            {MOTIVOS.map((m) => (
              <button type="button" key={m} className={motivo === m ? "ativo" : ""} onClick={() => setMotivo(m)}>{m}</button>
            ))}
          </div>
          <label className="evoCampo"><span>Ou escreva o motivo</span>
            <input value={MOTIVOS.includes(motivo) ? "" : motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
          </label>
        </div>
      ) : (
        <div className="evoForm">
          {!somenteLeitura && (
            <div className="evoLinhaCampos">
              <CampoHora valor={hora} onMudar={setHora} />
              <CampoNumero rotulo="Valor" valor={valor} onMudar={setValor} unidade={PARAMETROS[p].unidade}
                aviso={aviso(p, valor)} />
            </div>
          )}
          <Historico cadeia={historico} nomes={nomes} formatar={(r) => r.anulado ? "excluído"
            : `${r.dados.valor} ${PARAMETROS[p].unidade} às ${horaLocal(new Date(r.momento))}`} />
        </div>
      )}
    </Janela>
  );
}

export function Historico({ cadeia, nomes, formatar }: {
  cadeia: Registro[]; nomes: Map<string, string>; formatar: (r: Registro) => string;
}) {
  if (cadeia.length < 2) return <p className="evoNota">Sem alterações desde o registro.</p>;
  return (
    <ol className="evoHistorico" aria-label="Histórico do registro">
      {cadeia.map((r, i) => (
        <li key={r.id}>
          <b>{i === 0 ? "Registrado" : r.anulado ? "Excluído" : "Corrigido"}</b>
          <span>{formatar(r)}</span>
          <small>
            {r.created_by ? nomes.get(r.created_by) ?? "Equipe" : "Este aparelho (enviando)"}
            {r.created_at && ` · ${new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
            {r.motivo && ` · ${r.motivo}`}
          </small>
        </li>
      ))}
    </ol>
  );
}

/** Confirmação do arraste: mover é corrigir, e corrigir pede um "sim". */
export function JanelaMover({ registro, momento, valor, onConfirmar, onFechar }: {
  registro: Registro; momento: string; valor: number;
  onConfirmar: () => void; onFechar: () => void;
}) {
  const p = registro.dados.parametro as Parametro;
  const valido = valorPlausivel(p, valor);
  return (
    <Janela titulo={`Mover ${PARAMETROS[p].curto}?`} largura="estreita" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="button" className="evoBotao" disabled={!valido} onClick={onConfirmar}>Mover</button>
      </>}>
      <div className="evoForm">
        <p className="evoMover">
          <span>{String(registro.dados.valor)} às {horaLocal(new Date(registro.momento))}</span>
          <b aria-hidden="true">→</b>
          <span>{valor} às {horaLocal(new Date(momento))}</span>
        </p>
        {!valido && <p className="evoErro">{valor} está fora da faixa possível para {PARAMETROS[p].curto}.</p>}
        <p className="evoNota">O valor anterior continua no histórico do ponto.</p>
      </div>
    </Janela>
  );
}
