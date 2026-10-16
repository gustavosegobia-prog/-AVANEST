"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Icone } from "@/components/icone";
import { Janela } from "@/components/janela";
import { Intercorrencias } from "@/components/intercorrencias/intercorrencias";
import type { DadosDoPaciente } from "@/components/intercorrencias/paciente";

/**
 * A calculadora de doses abre por cima do protocolo, com o mesmo paciente:
 * idade, peso, altura e sexo já preenchidos, e o que mudar lá muda aqui. Antes
 * o botão levava para outra página, e quem voltava achava o protocolo fechado
 * e o paciente em branco — no meio de uma crise.
 * Carregada só quando abre: a lista de medicamentos não pesa na tela da crise.
 */
const Doses = dynamic(() => import("@/app/calculos/modulo-doses").then((m) => m.Doses), {
  loading: () => <p>Carregando a calculadora…</p>,
});

/** A página do menu: os dados do paciente são digitados aqui e não vão a lugar nenhum. */
export function CrisesClient({ superAdmin }: { superAdmin: boolean }) {
  const [dados, setDados] = useState<DadosDoPaciente>({});
  const [calculadora, setCalculadora] = useState(false);
  const set = (c: string, v: string) => setDados((d) => ({ ...d, [c]: v }));
  return (
    <div className="evoInicio fcFundo temaApp">
      <main className="fcPagina crisesPagina">
        <header className="fcTopo">
          <Link href="/dashboard?area=medico" className="fcVoltar">
            <Icone nome="voltar" tamanho={18} /> Área médica
          </Link>
        </header>
        <Intercorrencias
          titulo="Manejo de crises em anestesia"
          dados={dados} set={set}
          aoAbrirCalculadora={superAdmin ? () => setCalculadora(true) : undefined}
          previa={superAdmin}
        />
      </main>
      {calculadora && (
        <Janela titulo="Calculadora de doses" subtitulo="Com os dados do paciente desta crise." largura="larga"
          onFechar={() => setCalculadora(false)}>
          <Doses dados={dados} set={set} embutida />
        </Janela>
      )}
    </div>
  );
}
