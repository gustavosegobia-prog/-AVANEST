"use client";

import { useState } from "react";
import { Janela } from "@/components/janela";
import { Intercorrencias } from "./intercorrencias";
import type { DadosDoPaciente } from "./paciente";

/**
 * As intercorrências abertas de dentro da ficha: os dados do atendimento já
 * entram preenchidos (idade, peso, altura da avaliação, sexo do cadastro), e
 * continuam editáveis — a tela pede para conferir.
 *
 * Consultar não escreve nada na ficha. A intercorrência entra no prontuário
 * pelo evento "Intercorrência", lançado pelo médico.
 */
export function IntercorrenciasNaFicha({ paciente, superAdmin, onFechar }: {
  paciente: { idadeMeses: number | null; pesoKg: number | null; alturaCm?: number | null; sexo?: string | null };
  superAdmin: boolean;
  onFechar: () => void;
}) {
  const [dados, setDados] = useState<DadosDoPaciente>(() => {
    const m = paciente.idadeMeses;
    const sexo = String(paciente.sexo ?? "").trim().toLowerCase();
    return {
      idade: m !== null ? String(Math.floor(m / 12)) : "",
      // Meses só importam na criança: "40 anos e 3 meses" não muda dose nenhuma.
      idadeMeses: m !== null && m < 144 && m % 12 ? String(m % 12) : "",
      peso: paciente.pesoKg !== null ? String(paciente.pesoKg).replace(".", ",") : "",
      altura: paciente.alturaCm ? String(paciente.alturaCm) : "",
      sexo: sexo.startsWith("f") ? "Feminino" : sexo.startsWith("m") ? "Masculino" : "",
    };
  });
  return (
    <Janela titulo="Intercorrências anestésicas" subtitulo="Consulta: nada aqui é lançado na ficha." largura="larga" onFechar={onFechar}>
      <Intercorrencias dados={dados} set={(c, v) => setDados((d) => ({ ...d, [c]: v }))} daFicha superAdmin={superAdmin} />
    </Janela>
  );
}
