"use client";

import { useState } from "react";
import { imcDaFolha } from "@/lib/evolucao/folha";
import { camposDoPapel, chaveDoCampo, type CampoDoPapel } from "@/lib/evolucao/pre-papel";

// A pré-anestésica da folha, no desenho da ficha de papel. Técnica, cirurgia,
// alta e equipe ficam no rodapé (rodape-da-folha.tsx). Tudo grava no
// cabeçalho, com histórico na auditoria.

type Dados = Record<string, unknown>;
type Mudar = (m: Dados) => void;
const t = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

// ---------------------------------------------------------------------------
// A pré-anestésica no desenho exato da ficha de papel, editável na célula
// ---------------------------------------------------------------------------
const ASA_ROMANO = ["I", "II", "III", "IV", "V", "VI"];

/**
 * A grade da avaliação como está no papel: cinco colunas à esquerda e os
 * aparelhos à direita. Cada célula é o próprio campo — tocar e escrever; grava
 * sozinho, com histórico. Peso, altura, ASA e alergias são os mesmos dados
 * que as contas de dose e o alerta de alergia usam.
 */
export function PreAnestesicaPapel({ dados, sexo, onMudar, leitura, idadeAnos }: {
  dados: Dados; sexo: string | null; onMudar: Mudar; leitura: boolean; idadeAnos: number | null;
}) {
  const c = camposDoPapel(dados);
  const imc = imcDaFolha(dados);
  const numTexto = (v: unknown) => (typeof v === "number" ? String(v).replace(".", ",") : "");
  const [peso, setPeso] = useState(numTexto(dados.peso_kg));
  const [altura, setAltura] = useState(numTexto(dados.altura_cm));
  function mudarNumero(campo: "peso_kg" | "altura_cm", texto: string, max: number) {
    (campo === "peso_kg" ? setPeso : setAltura)(texto);
    const n = Number(texto.replace(",", "."));
    if (texto.trim() === "") onMudar({ [campo]: null });
    else if (Number.isFinite(n) && n > 0 && n <= max) onMudar({ [campo]: n });
  }
  const cel = (rotulo: string, campo: CampoDoPapel, classe = "", longo = false) => (
    <label className={`evoCel ${classe}`}>
      <small>{rotulo}</small>
      {longo
        ? <textarea rows={1} value={c[campo]} disabled={leitura} onChange={(e) => onMudar({ [chaveDoCampo(campo)]: e.target.value })} />
        : <input value={c[campo]} disabled={leitura} onChange={(e) => onMudar({ [chaveDoCampo(campo)]: e.target.value })} />}
    </label>
  );
  const asa = t(dados.asa);
  const origem = dados.preanestesica_origem as { importado_em?: string } | null | undefined;
  return (
    <div className="evoPrePapel">
      <div className="evoPreTiraV" aria-hidden="true">Avaliação pré-anestésica</div>
      <div className="evoPreGradePapel">
        {cel("Convênio", "convenio")}
        <div className="evoCel"><small>Sexo</small><span>{sexo || "—"}</span></div>
        {cel("Cor", "cor")}
        <label className="evoCel"><small>Peso (kg)</small>
          <input inputMode="decimal" value={peso} disabled={leitura} onChange={(e) => mudarNumero("peso_kg", e.target.value, 400)} />
        </label>
        <label className="evoCel"><small>Altura (cm){imc !== null && <b> · IMC {imc.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}{idadeAnos !== null && idadeAnos < 18 ? " (percentil)" : ""}</b>}</small>
          <input inputMode="decimal" value={altura} disabled={leitura} onChange={(e) => mudarNumero("altura_cm", e.target.value, 250)} />
        </label>
        {cel("Ap. respiratório", "ap_respiratorio", "direita", true)}

        {cel("Pressão arterial", "pa")}
        {cel("Pulso", "pulso")}
        {cel("Respiração", "respiracao")}
        {cel("Temperatura", "temperatura")}
        {cel("Tipo sanguíneo", "tipo_sanguineo")}
        {cel("Ap. digestivo", "ap_digestivo", "direita", true)}

        {cel("TAP / INR", "tap_inr")}
        {cel("Plaquetas", "plaquetas")}
        {cel("Hemoglobina", "hemoglobina")}
        {cel("Hematócrito", "hematocrito")}
        {cel("Glicemia", "glicemia")}
        {cel("Ap. circulatório", "ap_circulatorio", "direita", true)}

        {cel("Creatinina", "creatinina")}
        {cel("Outros", "exames_outros")}
        <div className="evoCel tres evoCelAsa" role="group" aria-label="ASA">
          <small>ASA</small>
          <div>
            {ASA_ROMANO.map((r, i) => (
              <button type="button" key={r} className={`evoOpNum${asa === r ? " marcado" : ""}`} aria-pressed={asa === r}
                disabled={leitura} onClick={() => onMudar({ asa: asa === r ? "" : r })}>{i + 1}</button>
            ))}
            <button type="button" className={`evoOp${dados.asa_emergencia === true ? " marcado" : ""}`}
              aria-pressed={dados.asa_emergencia === true} disabled={leitura}
              onClick={() => onMudar({ asa_emergencia: dados.asa_emergencia !== true })}>
              <i aria-hidden="true">{dados.asa_emergencia === true ? "◉" : "○"}</i>Cirurgia de emergência
            </button>
          </div>
        </div>
        {cel("Ap. endócrino", "ap_endocrino", "direita", true)}

        {cel("Medicação em uso", "medicacao_uso", "cinco", true)}
        {cel("Estado mental", "estado_mental", "direita", true)}
        {cel("Obs.", "observacoes_pre", "cinco", true)}
        {cel("Anestesia anterior", "anestesia_anterior", "direita", true)}
        {cel("Diagnóstico pré-operatório", "diagnostico", "cinco", true)}
        <div className={`evoCel direita${dados.nega_alergia !== true && t(dados.alergias) ? " alerta" : ""}`}>
          <small>Alergias</small>
          <textarea rows={1} value={t(dados.alergias)} disabled={leitura || dados.nega_alergia === true} aria-label="Alergias"
            onChange={(e) => onMudar({ alergias: e.target.value, nega_alergia: false })} />
          <button type="button" className={`evoOp${dados.nega_alergia === true ? " marcado" : ""}`}
            aria-pressed={dados.nega_alergia === true} disabled={leitura}
            onClick={() => onMudar({ nega_alergia: dados.nega_alergia !== true, ...(dados.nega_alergia !== true ? { alergias: "" } : {}) })}>
            <i aria-hidden="true">{dados.nega_alergia === true ? "◉" : "○"}</i>nega alergia a medicamentos
          </button>
        </div>
      </div>
      <p className="evoPreOrigem">
        {origem?.importado_em
          ? `Trazido da avaliação pré-anestésica em ${new Date(origem.importado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. Mudar aqui não altera a avaliação; fica no histórico da folha.`
          : "Sem avaliação pré-anestésica no sistema para este paciente: preencha o que tiver."}
      </p>
    </div>
  );
}
