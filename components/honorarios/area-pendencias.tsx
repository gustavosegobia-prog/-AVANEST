"use client";

import { CabecalhoDeSecao } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { AREAS, type Area, type Gravidade, type PendenciaDaTabela } from "@/lib/honorarios-telas";
import { Vazio } from "./comum";
import type { PedidoDeImportacao } from "./area-importar";
import { seguir } from "./primeiros-passos";
import estilos from "./honorarios.module.css";

const NOME_DA_GRAVIDADE: Record<Gravidade, string> = { alta: "Impede o cálculo", media: "Conferir", baixa: "Em andamento" };

/**
 * O que falta nas tabelas para o cálculo andar sozinho. A gravidade se lê
 * pela palavra, e não só pela cor; cada item leva à área onde se resolve.
 */
export function AreaPendencias({ pendencias, onAbrir, onImportar }: {
  pendencias: PendenciaDaTabela[];
  onAbrir: (a: Area) => void;
  onImportar: (p: PedidoDeImportacao) => void;
}) {
  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Divergências e pendências"
        descricao="Enquanto um item daqui estiver aberto, o honorário que depende dele fica pendente — nenhum valor é presumido." />
      {pendencias.length === 0 ? (
        <Vazio titulo="Nada pendente nas tabelas.">
          A TUSS está publicada, e cada convênio ativo tem contrato valendo hoje.
        </Vazio>
      ) : (
        <ul className={estilos.pendencias}>
          {pendencias.map((p) => (
            <li key={p.chave} className={estilos[`grav_${p.gravidade}`]}>
              <span className={estilos.gravidade}>
                <Icone nome={p.gravidade === "baixa" ? "relogio" : "alerta"} tamanho={15} />
                {NOME_DA_GRAVIDADE[p.gravidade]}
              </span>
              <div>
                <strong>{p.titulo}</strong>
                <p>{p.detalhe}</p>
              </div>
              {(p.acao || p.area !== "pendencias") && (
                <button type="button" className="outlineClinical compacto"
                  onClick={() => seguir(p.acao ?? { rotulo: "", area: p.area }, onAbrir, onImportar, p.area)}>
                  {p.acao?.rotulo ?? AREAS.find((a) => a.id === p.area)?.rotulo}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
