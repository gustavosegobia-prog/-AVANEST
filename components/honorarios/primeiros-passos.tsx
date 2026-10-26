"use client";

import { Icone } from "@/components/icone";
import type { AcaoDaTela, Area, PassoInicial } from "@/lib/honorarios-telas";
import type { PedidoDeImportacao } from "./area-importar";
import estilos from "./honorarios.module.css";

/**
 * Os três passos até o primeiro honorário calculado, no alto da página.
 * O passo da vez tem o botão principal; o feito ganha o ✓. Some quando os
 * três estão feitos — daí em diante, quem avisa são as pendências.
 */
export function PrimeirosPassos({ passos, onAbrir, onImportar }: {
  passos: PassoInicial[];
  onAbrir: (a: Area, foco?: string) => void;
  onImportar: (p: PedidoDeImportacao) => void;
}) {
  if (passos.every((p) => p.feito)) return null;
  const daVez = passos.find((p) => !p.feito)?.chave;
  return (
    <section className={estilos.primeirosPassos} aria-labelledby="primeiros-passos">
      <h2 id="primeiros-passos">Primeiros passos</h2>
      <ol>
        {passos.map((p, i) => (
          <li key={p.chave} className={p.feito ? estilos.passoFeito : p.chave === daVez ? estilos.passoAtual : undefined}>
            <span className={estilos.passoNumero} aria-hidden="true">
              {p.feito ? <Icone nome="confirmado" tamanho={16} /> : i + 1}
            </span>
            <div>
              <strong>{p.titulo}</strong>
              <p>{p.detalhe}</p>
              {p.feito ? (
                <span className={estilos.passoOk}>Feito</span>
              ) : (
                <button type="button" className={p.chave === daVez ? "primaryClinical compact" : "outlineClinical compacto"}
                  onClick={() => seguir(p.acao, onAbrir, onImportar)}>
                  {p.acao.rotulo}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Leva aonde o botão diz: a outra tela do painel, a importação com o tipo
 * escolhido, ou a área — já no item que a pendência apontou (`foco`).
 */
export function seguir(
  acao: AcaoDaTela, onAbrir: (a: Area, foco?: string) => void, onImportar: (p: PedidoDeImportacao) => void, area?: Area,
) {
  if (acao.href) window.location.assign(acao.href);
  else if (acao.importar) onImportar({ tipo: acao.importar });
  else onAbrir(acao.area ?? area ?? "pendencias", acao.foco);
}
