"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icone } from "@/components/icone";
import { Intercorrencias } from "@/components/intercorrencias/intercorrencias";
import type { DadosDoPaciente } from "@/components/intercorrencias/paciente";

/** A página do menu: os dados do paciente são digitados aqui e não vão a lugar nenhum. */
export function CrisesClient({ superAdmin }: { superAdmin: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosDoPaciente>({});
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
          dados={dados} set={(c, v) => setDados((d) => ({ ...d, [c]: v }))}
          aoAbrirCalculadora={superAdmin ? () => router.push("/calculos") : undefined}
        />
      </main>
    </div>
  );
}
