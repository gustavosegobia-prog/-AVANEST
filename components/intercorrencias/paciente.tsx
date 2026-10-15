"use client";

import { useState } from "react";
import estilos from "./intercorrencias.module.css";
import { numero, populacaoDe, ROTULO_POPULACAO, type PacienteDaConsulta } from "@/lib/intercorrencias/calculo";
import type { Categoria } from "@/lib/intercorrencias/tipos";

/**
 * Os dados do paciente que entram na conta: idade, peso, altura, sexo e
 * gestante. São texto, como digitados, e o mesmo objeto da calculadora de
 * doses (idade, idadeMeses, peso, altura, sexo): o que se digitou numa
 * aparece na outra. Na ficha, chegam do atendimento e continuam editáveis —
 * conferir é parte do uso.
 */
export type DadosDoPaciente = Record<string, string>;

/** Cor de cada categoria. Nunca sozinha: a letra (A–F) e o nome vão junto. */
export const COR_DA_CATEGORIA: Record<Categoria, string> = {
  cardiovascular: "#b42318",
  respiratorio: "#1b6ca8",
  medicamentos: "#6941c6",
  obstetricia: "#c11574",
  pediatria: "#0e7c66",
  outras: "#b54708",
  apoio: "#475467",
};

export function pacienteDe(d: DadosDoPaciente): PacienteDaConsulta {
  const num = (t?: string) => {
    const s = String(t ?? "").replace(",", ".").trim();
    const v = Number(s);
    return s && Number.isFinite(v) ? v : null;
  };
  const anos = num(d.idade), meses = num(d.idadeMeses);
  return {
    idadeAnos: anos === null && meses === null ? null : (anos ?? 0) + (meses ?? 0) / 12,
    pesoKg: num(d.peso), alturaCm: num(d.altura), sexo: d.sexo || null, gestante: d.gestante === "sim",
  };
}

/** "Criança · 4 anos · 16 kg"; "Recém-nascido · 3,2 kg". */
export function resumoDoPaciente(p: PacienteDaConsulta): string {
  const pop = populacaoDe(p);
  const idade = p.idadeAnos === null ? null
    : p.idadeAnos < 1 / 12 ? null
      : p.idadeAnos < 1 ? `${Math.round(p.idadeAnos * 12)} ${Math.round(p.idadeAnos * 12) === 1 ? "mês" : "meses"}`
        : `${Math.floor(p.idadeAnos)} anos`;
  return [pop ? ROTULO_POPULACAO[pop] : "Idade não informada", idade, p.pesoKg ? `${numero(p.pesoKg, 1)} kg` : "sem peso"]
    .filter(Boolean).join(" · ");
}

function Campo({ chave, rotulo, valor, set, modo = "decimal" }: {
  chave: string; rotulo: string; valor: string; set: (c: string, v: string) => void; modo?: "decimal" | "numeric";
}) {
  return (
    <label className={estilos.campo}>
      <span>{rotulo}</span>
      <input inputMode={modo} value={valor} autoComplete="off"
        onChange={(e) => set(chave, e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))} />
    </label>
  );
}

export function CamposDoPaciente({ dados, set, daFicha, compacto = false }: {
  dados: DadosDoPaciente; set: (c: string, v: string) => void; daFicha: boolean; compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(!compacto);
  const paciente = pacienteDe(dados);
  return (
    <section className={estilos.paciente} aria-label="Dados do paciente">
      <div className={estilos.pacienteTopo}>
        <strong>Paciente</strong>
        <span>{resumoDoPaciente(paciente)}{paciente.gestante ? " · gestante" : ""}</span>
        {compacto && (
          <button type="button" className={estilos.botao} aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
            {aberto ? "Fechar" : "Alterar"}
          </button>
        )}
      </div>
      {daFicha && <p className={estilos.origem}>Dados do atendimento aberto. Confira antes de usar as doses.</p>}
      {aberto && (
        <>
          <div className={estilos.campos}>
            <Campo chave="idade" rotulo="Idade (anos)" valor={dados.idade ?? ""} set={set} modo="numeric" />
            <Campo chave="idadeMeses" rotulo="Meses" valor={dados.idadeMeses ?? ""} set={set} modo="numeric" />
            <Campo chave="peso" rotulo="Peso (kg)" valor={dados.peso ?? ""} set={set} />
            <Campo chave="altura" rotulo="Altura (cm)" valor={dados.altura ?? ""} set={set} modo="numeric" />
            <label className={estilos.campo}>
              <span>Sexo</span>
              <select value={dados.sexo ?? ""} onChange={(e) => set("sexo", e.target.value)}>
                <option value="">—</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </label>
          </div>
          <div>
            <button type="button" className={estilos.chip} aria-pressed={dados.gestante === "sim"}
              onClick={() => set("gestante", dados.gestante === "sim" ? "" : "sim")}>
              {dados.gestante === "sim" ? "✓ Gestante" : "Gestante"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
