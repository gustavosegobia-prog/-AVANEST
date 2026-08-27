"use client";

import { useState } from "react";
import {
  APFEL_CRITERIOS, RCRI_CRITERIOS, STOP_BANG_CRITERIOS,
  lerApfel, lerLee, lerStopBang, type Criterio,
} from "@/lib/escores";

// A calculadora das páginas públicas de escore.
//
// Uma só para os três, e não três parecidas: o que muda entre eles é a lista de
// critérios e a frase do resultado. O resto — marcar, contar, mostrar — é
// idêntico, e três cópias disso seriam três lugares para corrigir o dia em que
// o desenho mudar.
//
// Nada daqui sai do navegador. Não há requisição, não há gravação, não há
// identificação de paciente: quem entra pelo Google não está logado, e uma
// calculadora pública que mandasse dado clínico para um servidor seria um
// problema de privacidade criado sem necessidade — a conta é uma soma.

type Qual = "stop-bang" | "apfel" | "lee";

const ESCORES: Record<Qual, {
  criterios: Criterio[];
  total: number;
  ler: (pontos: number) => string;
  alerta: (pontos: number) => boolean;
}> = {
  "stop-bang": {
    criterios: STOP_BANG_CRITERIOS,
    total: STOP_BANG_CRITERIOS.length,
    ler: (p) => `STOP-Bang ${p}/8 — ${lerStopBang(p)}`,
    alerta: (p) => p >= 5,
  },
  apfel: {
    criterios: APFEL_CRITERIOS,
    total: APFEL_CRITERIOS.length,
    ler: (p) => `Apfel ${p}/4 — risco de NVPO ${lerApfel(p)}`,
    alerta: (p) => p >= 3,
  },
  lee: {
    criterios: RCRI_CRITERIOS,
    total: RCRI_CRITERIOS.length,
    ler: (p) => {
      const { classe, risco } = lerLee(p);
      return `Lee ${p} ponto(s) · Classe ${classe} · evento cardíaco maior ≈ ${risco}`;
    },
    alerta: (p) => p >= 2,
  },
};

export function CalculadoraDeEscore({ qual }: { qual: Qual }) {
  const escore = ESCORES[qual];
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  function alternar(chave: string) {
    setMarcados((antes) => {
      const agora = new Set(antes);
      if (agora.has(chave)) agora.delete(chave); else agora.add(chave);
      return agora;
    });
  }

  const pontos = escore.criterios.filter(([chave]) => marcados.has(chave)).length;

  return (
    <div className="escCalc">
      <div className="escCriterios">
        {escore.criterios.map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            className={marcados.has(chave) ? "escCriterio marcado" : "escCriterio"}
            // A tecla e o leitor de tela precisam saber que isto liga e desliga;
            // sem aria-pressed um botão marcado soa igual a um desmarcado.
            aria-pressed={marcados.has(chave)}
            onClick={() => alternar(chave)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {/* aria-live para quem usa leitor de tela ouvir o total mudar sem ter de
          sair procurando o que aconteceu depois de cada clique. */}
      <p className={escore.alerta(pontos) ? "escResultado alerta" : "escResultado"} aria-live="polite">
        {escore.ler(pontos)}
      </p>

      {marcados.size > 0 && (
        <button type="button" className="escLimpar" onClick={() => setMarcados(new Set())}>
          Limpar
        </button>
      )}
    </div>
  );
}
