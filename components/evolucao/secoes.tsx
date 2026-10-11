"use client";

import { useState } from "react";
import { imcDaFolha } from "@/lib/evolucao/folha";
import { Escolha } from "./campos";

// A pré-anestésica da folha: a grade de conferência e o formulário de edição.
// Técnica, cirurgia, alta e equipe ficam no rodapé (rodape-da-folha.tsx).
// Tudo grava no cabeçalho, com histórico na auditoria.

type Dados = Record<string, unknown>;
type Mudar = (m: Dados) => void;
const t = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

function Texto({ rotulo, valor, onMudar, linhas = 1, largo = false, disabled }: {
  rotulo: string; valor: string; onMudar: (v: string) => void; linhas?: number; largo?: boolean; disabled: boolean;
}) {
  return (
    <label className={`evoCampo${largo ? " largo" : ""}`}>
      <span>{rotulo}</span>
      {linhas > 1
        ? <textarea rows={linhas} value={valor} disabled={disabled} onChange={(e) => onMudar(e.target.value)} />
        : <input value={valor} disabled={disabled} onChange={(e) => onMudar(e.target.value)} />}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Pré-anestésica: a grade do papel, só leitura
// ---------------------------------------------------------------------------
/**
 * O bloco da avaliação como sai na folha impressa: seis colunas, rótulo em
 * cima, valor embaixo. É para CONFERIR de relance; editar é no formulário que
 * abre por baixo ("Editar").
 */
export function PreAnestesicaResumo({ dados, sexo }: { dados: Dados; sexo: string | null }) {
  const asa = t(dados.asa);
  const imc = imcDaFolha(dados);
  const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "");
  const alergiaTexto = dados.nega_alergia === true ? "Nega alergia a medicamentos" : t(dados.alergias) || "Não informado";
  const temAlergia = dados.nega_alergia !== true && Boolean(t(dados.alergias));
  const campo = (rotulo: string, valor: string, classe = "") => (
    <div className={`evoPreCampo ${classe}`}><small>{rotulo}</small><span>{valor || "—"}</span></div>
  );
  return (
    <div className="evoPreGradeResumo">
      {campo("Convênio", t(dados.convenio))}
      {campo("Sexo", t(sexo))}
      {campo("Peso", num(dados.peso_kg) && `${num(dados.peso_kg)} kg`)}
      {campo("Altura", num(dados.altura_cm) && `${num(dados.altura_cm)} cm`)}
      {campo("IMC", imc !== null ? `${num(imc)} kg/m²` : "")}
      {campo("ASA", asa ? `${asa}${dados.asa_emergencia === true ? " E (emergência)" : ""}` : "")}
      {campo("Alergias", alergiaTexto, `dobro${temAlergia ? " alerta" : ""}`)}
      {campo("Sinais na avaliação", t(dados.sinais_pre), "dobro")}
      {campo("Jejum", t(dados.jejum), "dobro")}
      {campo("Via aérea", t(dados.via_aerea), "metade")}
      {campo("Medicação em uso", t(dados.medicacao_uso), "metade")}
      {campo("Antecedentes", t(dados.antecedentes), "metade")}
      {campo("Exames", t(dados.exames), "metade")}
      {campo("Anestesia anterior", t(dados.anestesia_anterior), "metade")}
      {campo("Diagnóstico pré-operatório", t(dados.diagnostico), "metade")}
      {t(dados.observacoes_pre) && campo("Observações", t(dados.observacoes_pre), "todo")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pré-anestésica conferida
// ---------------------------------------------------------------------------
export function SecaoPreAnestesica({ dados, onMudar, leitura, idadeAnos }: {
  dados: Dados; onMudar: Mudar; leitura: boolean; idadeAnos: number | null;
}) {
  const imc = imcDaFolha(dados);
  const crianca = idadeAnos !== null && idadeAnos < 18;
  const origem = dados.preanestesica_origem as { importado_em?: string } | null | undefined;
  const peso = typeof dados.peso_kg === "number" ? String(dados.peso_kg).replace(".", ",") : "";
  const [pesoTexto, setPesoTexto] = useState(peso);
  function mudarPeso(v: string) {
    setPesoTexto(v);
    const n = Number(v.replace(",", "."));
    onMudar({ peso_kg: v.trim() === "" ? null : Number.isFinite(n) && n > 0 && n <= 400 ? n : dados.peso_kg ?? null });
  }
  return (
    <div className="evoSecaoCorpo">
      <p className="evoNota">
        {origem?.importado_em
          ? `Trazido da avaliação pré-anestésica em ${new Date(origem.importado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. O que mudar aqui não altera a avaliação original e fica no histórico da folha.`
          : "Sem avaliação pré-anestésica no sistema para este paciente: preencha o que tiver."}
      </p>
      <div className="evoGradePre">
        <label className="evoCampo"><span>Peso (kg)</span>
          <input inputMode="decimal" value={pesoTexto} disabled={leitura} onChange={(e) => mudarPeso(e.target.value)} />
        </label>
        <Texto rotulo="Altura (cm)" valor={t(dados.altura_cm)} disabled={leitura}
          onMudar={(v) => onMudar({ altura_cm: v.trim() ? Number(v.replace(",", ".")) || null : null })} />
        <div className="evoCampo evoCalculado">
          <span>IMC</span>
          <output>{imc !== null ? imc.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</output>
          <small>{imc === null ? "precisa de peso e altura" : crianca ? "em criança, ler por percentil" : "kg/m², do peso e altura acima"}</small>
        </div>
        <Escolha rotulo="ASA" valor={t(dados.asa) as "I"}
          opcoes={["I", "II", "III", "IV", "V", "VI"].map((v) => ({ valor: v as "I", rotulo: v }))}
          onMudar={(v) => !leitura && onMudar({ asa: v })} />
        <label className="evoMarca">
          <input type="checkbox" checked={dados.asa_emergencia === true} disabled={leitura}
            onChange={(e) => onMudar({ asa_emergencia: e.target.checked })} />
          <span>Cirurgia de emergência (E)</span>
        </label>
        <Texto rotulo="Diagnóstico pré-operatório" valor={t(dados.diagnostico)} onMudar={(v) => onMudar({ diagnostico: v })} largo disabled={leitura} />
        <Texto rotulo="Hospital" valor={t(dados.hospital)} onMudar={(v) => onMudar({ hospital: v })} disabled={leitura} />
        <Texto rotulo="Sala" valor={t(dados.sala)} onMudar={(v) => onMudar({ sala: v })} disabled={leitura} />
        <Texto rotulo="Convênio" valor={t(dados.convenio)} onMudar={(v) => onMudar({ convenio: v })} disabled={leitura} />
        <Texto rotulo="Alergias" valor={t(dados.alergias)} onMudar={(v) => onMudar({ alergias: v, nega_alergia: false })} largo disabled={leitura} />
        <label className="evoMarca">
          <input type="checkbox" checked={dados.nega_alergia === true} disabled={leitura}
            onChange={(e) => onMudar({ nega_alergia: e.target.checked, ...(e.target.checked ? { alergias: "" } : {}) })} />
          <span>Nega alergia a medicamentos</span>
        </label>
        <Texto rotulo="Medicação em uso" valor={t(dados.medicacao_uso)} onMudar={(v) => onMudar({ medicacao_uso: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Antecedentes e comorbidades" valor={t(dados.antecedentes)} onMudar={(v) => onMudar({ antecedentes: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Via aérea" valor={t(dados.via_aerea)} onMudar={(v) => onMudar({ via_aerea: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Exames" valor={t(dados.exames)} onMudar={(v) => onMudar({ exames: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Jejum" valor={t(dados.jejum)} onMudar={(v) => onMudar({ jejum: v })} disabled={leitura} />
        <Texto rotulo="Sinais na avaliação" valor={t(dados.sinais_pre)} onMudar={(v) => onMudar({ sinais_pre: v })} disabled={leitura} />
        <Texto rotulo="Anestesia anterior" valor={t(dados.anestesia_anterior)} onMudar={(v) => onMudar({ anestesia_anterior: v })} largo disabled={leitura} />
        <Texto rotulo="Observações" valor={t(dados.observacoes_pre)} onMudar={(v) => onMudar({ observacoes_pre: v })} linhas={2} largo disabled={leitura} />
      </div>
    </div>
  );
}
