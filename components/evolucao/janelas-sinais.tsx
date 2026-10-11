"use client";

import { useState } from "react";
import { Janela } from "@/components/janela";
import { horaLocal } from "@/lib/data-local";
import { PARAMETROS, pamEstimada, valorPlausivel, type Parametro } from "@/lib/evolucao/sinais";
import { historicoDe, type Registro } from "@/lib/evolucao/registros";
import { momentoDeHora } from "./use-folha";
import { CampoHora, CampoNumero, numero } from "./campos";

export type ModoDoGrafico = "pa" | Parametro;

export const MODOS: Array<{ modo: ModoDoGrafico; rotulo: string; simbolo: string }> = [
  { modo: "pa", rotulo: "PA", simbolo: "V Λ" },
  { modo: "pas", rotulo: "PAS", simbolo: "V" },
  { modo: "pad", rotulo: "PAD", simbolo: "Λ" },
  { modo: "pam", rotulo: "PAM", simbolo: "X" },
  { modo: "fc", rotulo: "FC", simbolo: "•" },
  { modo: "spo2", rotulo: "SpO₂", simbolo: "" },
  { modo: "etco2", rotulo: "EtCO₂", simbolo: "" },
  { modo: "temp", rotulo: "Temp.", simbolo: "" },
];

export type NovoSinal = { parametro: Parametro; valor: number; origem: "manual" | "estimado" };

const aviso = (p: Parametro, t: string) => {
  if (!t.trim()) return null;
  const v = numero(t);
  return valorPlausivel(p, v) ? null : `Entre ${PARAMETROS[p].min} e ${PARAMETROS[p].max} ${PARAMETROS[p].unidade}.`;
};

/**
 * A confirmação depois do toque. No modo PA, a sistólica vem do toque e a
 * diastólica é digitada em seguida — os dois numa janela só. A PAM estimada
 * aparece calculada e só é gravada se o médico marcar, e nunca onde já há uma
 * PAM medida no mesmo minuto.
 */
export function JanelaSinal({ modo, ms, valor, temPamMedida, onConfirmar, onFechar }: {
  modo: ModoDoGrafico; ms: number; valor: number | null;
  temPamMedida: (iso: string) => boolean;
  onConfirmar: (itens: NovoSinal[], momento: string) => void;
  onFechar: () => void;
}) {
  const [hora, setHora] = useState(horaLocal(new Date(ms)));
  const [v1, setV1] = useState(valor !== null ? String(valor) : "");
  const [v2, setV2] = useState("");
  const [comPam, setComPam] = useState(false);
  const momento = momentoDeHora(hora, new Date(ms));
  const ehPa = modo === "pa";
  const p1: Parametro = ehPa ? "pas" : modo;
  const n1 = numero(v1), n2 = numero(v2);
  const pam = ehPa && n1 !== null && n2 !== null ? pamEstimada(n1, n2) : null;
  const pamBloqueada = momento ? temPamMedida(momento) : false;
  const ok = Boolean(momento) && valorPlausivel(p1, n1) && (!ehPa || (valorPlausivel("pad", n2) && n2! < n1!));

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !momento) return;
    const itens: NovoSinal[] = [{ parametro: p1, valor: n1!, origem: "manual" }];
    if (ehPa) {
      itens.push({ parametro: "pad", valor: n2!, origem: "manual" });
      if (comPam && pam !== null && !pamBloqueada) itens.push({ parametro: "pam", valor: pam, origem: "estimado" });
    }
    onConfirmar(itens, momento);
  }

  return (
    <Janela titulo={ehPa ? "Pressão arterial" : PARAMETROS[p1].nome} largura="estreita" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="submit" form="evoFormSinal" className="evoBotao" disabled={!ok}>Registrar</button>
      </>}>
      <form id="evoFormSinal" className="evoForm" onSubmit={confirmar}>
        <CampoHora valor={hora} onMudar={setHora} />
        <div className="evoLinhaCampos">
          <CampoNumero rotulo={ehPa ? "Sistólica" : PARAMETROS[p1].curto} valor={v1} onMudar={setV1}
            unidade={PARAMETROS[p1].unidade} aviso={aviso(p1, v1)} autoFocus={!ehPa || valor === null} />
          {ehPa && (
            <CampoNumero rotulo="Diastólica" valor={v2} onMudar={setV2} unidade="mmHg"
              aviso={aviso("pad", v2) ?? (n1 !== null && n2 !== null && n2 >= n1 ? "A diastólica tem de ser menor que a sistólica." : null)}
              autoFocus={valor !== null} />
          )}
        </div>
        {ehPa && pam !== null && (
          <label className={`evoMarca${pamBloqueada ? " desligada" : ""}`}>
            <input type="checkbox" checked={comPam && !pamBloqueada} disabled={pamBloqueada}
              onChange={(e) => setComPam(e.target.checked)} />
            <span>
              Registrar também a PAM estimada: <b>{pam} mmHg</b>
              <small>{pamBloqueada ? "Já há PAM medida neste minuto — a medida prevalece."
                : "(PAS + 2 × PAD) / 3. Aparece marcada como estimada, separada da PAM do monitor."}</small>
            </span>
          </label>
        )}
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

/** Entrada numérica: vários parâmetros no mesmo horário, sem tocar no gráfico. */
export function JanelaLancar({ temPamMedida, onConfirmar, onFechar }: {
  temPamMedida: (iso: string) => boolean;
  onConfirmar: (itens: NovoSinal[], momento: string) => void;
  onFechar: () => void;
}) {
  const [hora, setHora] = useState(horaLocal());
  const [v, setV] = useState<Record<Parametro, string>>({ pas: "", pad: "", pam: "", fc: "", spo2: "", etco2: "", temp: "" });
  const momento = momentoDeHora(hora);
  const preenchidos = (Object.keys(v) as Parametro[]).filter((p) => v[p].trim());
  const invalidos = preenchidos.filter((p) => !valorPlausivel(p, numero(v[p])));
  const pasN = numero(v.pas), padN = numero(v.pad);
  const estimada = !v.pam.trim() && pasN !== null && padN !== null ? pamEstimada(pasN, padN) : null;
  const ok = Boolean(momento) && preenchidos.length > 0 && invalidos.length === 0;

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !momento) return;
    const itens: NovoSinal[] = preenchidos.map((p) => ({ parametro: p, valor: numero(v[p])!, origem: "manual" }));
    onConfirmar(itens, momento);
  }

  return (
    <Janela titulo="Lançar valores" subtitulo="Os que ficarem em branco não são registrados." largura="media" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="submit" form="evoFormLancar" className="evoBotao" disabled={!ok}>Registrar {preenchidos.length || ""}</button>
      </>}>
      <form id="evoFormLancar" className="evoForm" onSubmit={confirmar}>
        <CampoHora valor={hora} onMudar={setHora} />
        <div className="evoGradeCampos">
          {(Object.keys(PARAMETROS) as Parametro[]).map((p, i) => (
            <CampoNumero key={p} rotulo={PARAMETROS[p].curto} valor={v[p]} unidade={PARAMETROS[p].unidade}
              onMudar={(t) => setV((x) => ({ ...x, [p]: t }))} aviso={aviso(p, v[p])} autoFocus={i === 0} />
          ))}
        </div>
        {estimada !== null && (
          <p className="evoNota">
            PAM estimada pela PAS e PAD: {estimada} mmHg{momento && temPamMedida(momento) ? " (já há PAM medida neste minuto)" : ""}.
            Para registrá-la, digite no campo PAM — ela entra como medida.
          </p>
        )}
      </form>
    </Janela>
  );
}
