"use client";

import { useState } from "react";
import Link from "next/link";
import { Icone } from "@/components/icone";
import { Intercorrencias } from "@/components/intercorrencias/intercorrencias";
import type { DadosDoPaciente } from "@/components/intercorrencias/paciente";

/**
 * A página do menu: os dados do paciente são digitados aqui e não vão a lugar nenhum.
 * As doses do protocolo já saem calculadas com eles; a calculadora de doses
 * avulsa continua no menu da área médica.
 */
export function CrisesClient({ superAdmin }: { superAdmin: boolean }) {
  const [dados, setDados] = useState<DadosDoPaciente>({});
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
          previa={superAdmin}
        />
      </main>
    </div>
  );
}
