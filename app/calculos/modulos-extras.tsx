"use client";

import { useMemo, useState } from "react";
import estilos from "./calculos.module.css";
import {
  AVISO_CALCIO,
  calcioCorrigido,
  FAIXAS,
  FORMULA_CALCIO,
  FORMULA_SODIO,
  situacao,
  sodioCorrigido,
} from "@/lib/calculos/eletrolitos";
import { calcularOsmolar, type TipoNitrogenio } from "@/lib/calculos/osmolar";
import { calcularFick, FORMULA_FICK } from "@/lib/calculos/fick";

// Nenhuma conta aqui: tudo vem de lib/calculos. Estes componentes só juntam o
// que a pessoa digitou, chamam a função e desenham o que ela devolveu.

/**
 * Dados que valem para mais de uma calculadora. Ficam no componente de cima e
 * descem por props, então o Na digitado na gasometria já aparece no gap
 * osmolar — mas sempre visível e editável, nunca aplicado às escondidas.
 */
export type Compartilhado = Record<string, string>;

export const numero = (texto: string): number | undefined => {
  const limpo = (texto ?? "").replace(",", ".").trim();
  if (!limpo) return undefined;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : undefined;
};

export function Campo({
  chave, rotulo, valor, aoMudar, passo = "1", tipo = "number",
}: {
  chave: string; rotulo: string; valor: string;
  aoMudar: (chave: string, valor: string) => void;
  passo?: string; tipo?: string;
}) {
  return (
    <label className={estilos.campo}>
      <span>{rotulo}</span>
      <input type={tipo} inputMode="decimal" step={passo} value={valor}
        onChange={(e) => aoMudar(chave, e.target.value)} />
    </label>
  );
}

function Detalhes({ formula, extra }: { formula: string; extra?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={estilos.verMais} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar detalhes" : "Ver detalhes"}
      </button>
      {aberto && (
        <div className={estilos.completa}>
          <p><b>Fórmula:</b> {formula}</p>
          {extra && <p className={estilos.aviso}>{extra}</p>}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

const CAMPOS_ELETROLITOS: Array<[string, string, string]> = [
  ["sodio", "Sódio (mmol/L)", "1"],
  ["potassio", "Potássio (mmol/L)", "0.1"],
  ["cloro", "Cloro (mmol/L)", "1"],
  ["calcioTotal", "Cálcio total (mg/dL)", "0.1"],
  ["calcioIonizado", "Cálcio iônico (mmol/L)", "0.01"],
  ["magnesio", "Magnésio (mg/dL)", "0.1"],
  ["glicose", "Glicose (mg/dL)", "1"],
  ["hemoglobina", "Hemoglobina (g/dL)", "0.1"],
  ["albumina", "Albumina (g/dL)", "0.1"],
  ["creatinina", "Creatinina (mg/dL)", "0.01"],
  ["ureia", "Ureia (mg/dL)", "1"],
];

export function Eletrolitos({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [calculado, setCalculado] = useState(false);

  const v = (c: string) => numero(dados[c] ?? "");
  const naCorrigido = useMemo(() => {
    const na = v("sodio"), gli = v("glicose");
    return na !== undefined && gli !== undefined ? sodioCorrigido(na, gli) : undefined;
  }, [dados]);
  const caCorrigido = useMemo(() => {
    const ca = v("calcioTotal"), alb = v("albumina");
    return ca !== undefined && alb !== undefined ? calcioCorrigido(ca, alb) : undefined;
  }, [dados]);

  const preenchidos = CAMPOS_ELETROLITOS.filter(([c]) => v(c) !== undefined);

  return (
    <>
      <h1 className={estilos.titulo}>Eletrólitos</h1>
      <p className={estilos.subtitulo}>Eletrólitos, glicose e hemoglobina. Preencha o que tiver.</p>

      <div className={estilos.grade}>
        {CAMPOS_ELETROLITOS.map(([c, rotulo, passo]) => (
          <Campo key={c} chave={c} rotulo={rotulo} passo={passo} valor={dados[c] ?? ""} aoMudar={set} />
        ))}
      </div>

      <div className={estilos.acoes}>
        <button type="button" className={estilos.primario} disabled={!preenchidos.length}
          onClick={() => setCalculado(true)}>Analisar</button>
        {!preenchidos.length && <span className={estilos.dica}>Preencha ao menos um valor.</span>}
      </div>

      {calculado && preenchidos.length > 0 && (
        <section className={estilos.resultado} aria-live="polite">
          <h2 className={estilos.resultadoTitulo}>Resultado</h2>
          <div className={estilos.indicadores}>
            {preenchidos.map(([c]) => {
              const valor = v(c)!;
              const est = situacao(c, valor);
              const classe = est === "normal" || est === undefined ? estilos.normal
                : est === "baixo" ? estilos.alterado : estilos.alerta;
              return (
                <span key={c} className={`${estilos.indicador} ${classe}`}>
                  <small>{FAIXAS[c]?.rotulo ?? c}</small>
                  <b>{valor}{est && est !== "normal" ? est === "baixo" ? " ↓" : " ↑" : ""}</b>
                </span>
              );
            })}
          </div>

          {naCorrigido !== undefined && (
            <div className={estilos.correcao}>
              <strong>Sódio corrigido pela glicose</strong>
              <div className={estilos.linha}>
                <span>Na medido</span><b>{v("sodio")} mmol/L</b>
                <span>Glicose</span><b>{v("glicose")} mg/dL</b>
                <span>Na corrigido</span><b>{naCorrigido} mmol/L</b>
              </div>
              <Detalhes formula={FORMULA_SODIO} />
            </div>
          )}

          {caCorrigido !== undefined && (
            <div className={estilos.correcao}>
              <strong>Cálcio corrigido pela albumina</strong>
              <div className={estilos.linha}>
                <span>Cálcio medido</span><b>{v("calcioTotal")} mg/dL</b>
                <span>Albumina</span><b>{v("albumina")} g/dL</b>
                <span>Cálcio corrigido</span><b>{caCorrigido} mg/dL</b>
              </div>
              <p className={estilos.aviso}>{AVISO_CALCIO}</p>
              <Detalhes formula={FORMULA_CALCIO} />
            </div>
          )}
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function GapOsmolar({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [tipo, setTipo] = useState<TipoNitrogenio>("ureia");
  const [calcular, setCalcular] = useState(false);

  const r = useMemo(() => calcularOsmolar({
    osmolalidadeMedida: numero(dados.osmMedida ?? ""),
    sodio: numero(dados.sodio ?? ""),
    glicoseMgDl: numero(dados.glicose ?? ""),
    nitrogenioMgDl: numero(dados[tipo === "bun" ? "bun" : "ureia"] ?? ""),
    tipo,
    etanolMgDl: numero(dados.etanol ?? ""),
  }), [dados, tipo]);

  return (
    <>
      <h1 className={estilos.titulo}>Gap osmolar</h1>
      <p className={estilos.subtitulo}>
        Ureia e BUN não são o mesmo número — escolha qual você tem em mãos, porque o divisor muda.
      </p>

      <div className={estilos.gradeCurta}>
        <Campo chave="osmMedida" rotulo="Osmolalidade medida (mOsm/kg)" valor={dados.osmMedida ?? ""} aoMudar={set} />
        <Campo chave="sodio" rotulo="Sódio (mmol/L)" valor={dados.sodio ?? ""} aoMudar={set} />
        <Campo chave="glicose" rotulo="Glicose (mg/dL)" valor={dados.glicose ?? ""} aoMudar={set} />
      </div>

      <div className={estilos.acoes}>
        <label className={estilos.campo}>
          <span>O valor que você tem é</span>
          <select className={estilos.seletor} value={tipo} onChange={(e) => setTipo(e.target.value as TipoNitrogenio)}>
            <option value="ureia">Ureia (mg/dL)</option>
            <option value="bun">BUN (mg/dL)</option>
          </select>
        </label>
        <Campo chave={tipo === "bun" ? "bun" : "ureia"}
          rotulo={tipo === "bun" ? "BUN (mg/dL)" : "Ureia (mg/dL)"}
          valor={dados[tipo === "bun" ? "bun" : "ureia"] ?? ""} aoMudar={set} />
        <Campo chave="etanol" rotulo="Etanol (mg/dL) — opcional" valor={dados.etanol ?? ""} aoMudar={set} />
      </div>

      <div className={estilos.acoes}>
        <button type="button" className={estilos.primario} disabled={!r} onClick={() => setCalcular(true)}>Calcular</button>
        {!r && <span className={estilos.dica}>Informe sódio, glicose e {tipo === "bun" ? "BUN" : "ureia"}.</span>}
      </div>

      {calcular && r && (
        <section className={estilos.resultado} aria-live="polite">
          <h2 className={estilos.resultadoTitulo}>Resultado</h2>
          <div className={estilos.linha}>
            {numero(dados.osmMedida ?? "") !== undefined && (<><span>Osmolalidade medida</span><b>{dados.osmMedida} mOsm/kg</b></>)}
            <span>Osmolalidade calculada</span><b>{r.calculada} mOsm/kg</b>
          </div>
          {r.gap !== undefined && <p className={estilos.disturbio}>Gap osmolar: {r.gap} mOsm/kg</p>}
          {r.interpretacao && <p className={estilos.veredito}>{r.interpretacao}</p>}
          {r.faltando.length > 0 && <p className={estilos.dica}>Faltou: {r.faltando.join(", ")}.</p>}
          <Detalhes formula={r.formula}
            extra="O resultado não fecha diagnóstico por si. Gap aumentado pede interpretação no contexto clínico." />
        </section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function Fick({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [calcular, setCalcular] = useState(false);

  const r = useMemo(() => calcularFick({
    hemoglobina: numero(dados.hemoglobina ?? ""),
    sao2: numero(dados.sao2 ?? ""),
    svo2: numero(dados.svo2 ?? ""),
    pao2: numero(dados.pao2 ?? ""),
    pvo2: numero(dados.pvo2 ?? ""),
    pesoKg: numero(dados.peso ?? ""),
    alturaCm: numero(dados.altura ?? ""),
    vo2Informado: numero(dados.vo2 ?? ""),
  }), [dados]);

  return (
    <>
      <h1 className={estilos.titulo}>Débito cardíaco — Fick</h1>
      <p className={estilos.subtitulo}>
        Sem VO2 informado, ele é estimado pela superfície corporal — e o resultado sai marcado como estimativa.
      </p>

      <div className={estilos.grade}>
        <Campo chave="hemoglobina" rotulo="Hemoglobina (g/dL)" passo="0.1" valor={dados.hemoglobina ?? ""} aoMudar={set} />
        <Campo chave="sao2" rotulo="SaO2 (%)" valor={dados.sao2 ?? ""} aoMudar={set} />
        <Campo chave="svo2" rotulo="SvO2 (%)" valor={dados.svo2 ?? ""} aoMudar={set} />
        <Campo chave="pao2" rotulo="PaO2 (mmHg) — opcional" valor={dados.pao2 ?? ""} aoMudar={set} />
        <Campo chave="pvo2" rotulo="PvO2 (mmHg) — opcional" valor={dados.pvo2 ?? ""} aoMudar={set} />
        <Campo chave="vo2" rotulo="VO2 (mL/min) — se medido" valor={dados.vo2 ?? ""} aoMudar={set} />
        <Campo chave="peso" rotulo="Peso (kg)" passo="0.1" valor={dados.peso ?? ""} aoMudar={set} />
        <Campo chave="altura" rotulo="Altura (cm)" valor={dados.altura ?? ""} aoMudar={set} />
      </div>

      <div className={estilos.acoes}>
        <button type="button" className={estilos.primario} disabled={!r} onClick={() => setCalcular(true)}>Calcular</button>
        {!r && <span className={estilos.dica}>Informe hemoglobina, SaO2, SvO2 e o VO2 ou peso e altura.</span>}
      </div>

      {calcular && r && (
        <section className={estilos.resultado} aria-live="polite">
          <h2 className={estilos.resultadoTitulo}>Resultado</h2>
          <p className={estilos.disturbio}>
            {r.debito} L/min
            {r.indice !== undefined && <em className={estilos.selo}>IC {r.indice} L/min/m²</em>}
          </p>
          <div className={estilos.linha}>
            <span>CaO2</span><b>{r.cao2} mL/dL</b>
            <span>CvO2</span><b>{r.cvo2} mL/dL</b>
            <span>Diferença a-v</span><b>{r.diferenca} mL/dL</b>
            <span>VO2 {r.origemVo2}</span><b>{r.vo2} mL/min</b>
            {r.superficie !== undefined && (<><span>Superfície corporal</span><b>{r.superficie} m²</b></>)}
          </div>
          <p className={r.origemVo2 === "estimado" ? estilos.confira : estilos.veredito}>{r.aviso}</p>
          <Detalhes formula={FORMULA_FICK} extra="Superfície corporal por Mosteller." />
        </section>
      )}
    </>
  );
}
