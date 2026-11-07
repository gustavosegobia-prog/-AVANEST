import Link from "next/link";
import { Icone } from "@/components/icone";
import { Decorrido } from "./decorrido";
import { ExcluirFolha } from "./excluir-folha";
import { ImprimirFicha } from "@/components/evolucao/imprimir-ficha";
import { NovaFolha } from "./nova-folha";
import type { CasoComCadastro } from "@/lib/evolucao/mapa-do-dia";
import type { PacienteAchado } from "@/lib/evolucao/entrada";

export type FolhaResumo = {
  id: string;
  versao: number;
  inicio_em: string;
  encerrada_em: string | null;
  paciente: string;
  procedimento: string;
  sala: string;
  /** Fim da anestesia ou saída da sala, já registrados: o relógio para aqui. */
  fim?: string | null;
};

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const hora = (iso: string) => HORA.format(new Date(iso));
const dia = (iso: string) => DIA.format(new Date(iso));

// A entrada da ficha anestésica. Três trabalhos, na ordem da pressa
// (06/11/2026: "para não ter que ficar abrindo um monte de coisa para fazer uma
// função só"):
//   1. voltar à ficha em andamento — no topo, no tablet e no celular;
//   2. abrir a do próximo paciente — a caixa com a lista do dia (o mapa
//      cirúrgico, quando há; os avaliados hoje, no ambulatório) e a busca;
//   3. achar a encerrada, para conferir ou imprimir.
// No computador, a caixa de abrir fica à esquerda e as listas à direita.
export function InicioDasFolhas({
  institutionId, abertas, encerradas, semBanco, agora, local = null, mapa = [], avaliadosHoje = [],
  podeImportarMapa = false, podeVerMapa = false,
}: {
  /** Quem monta o mapa importa de dentro da ficha; quem vê tem o atalho para ele. */
  podeImportarMapa?: boolean;
  podeVerMapa?: boolean;
  /** O mapa cirúrgico de hoje, do hospital da sessão, com o cadastro de cada paciente já procurado. */
  mapa?: CasoComCadastro[];
  /** Os avaliados hoje que ainda não têm ficha: a lista do dia de quem não tem mapa. */
  avaliadosHoje?: PacienteAchado[];
  institutionId: string;
  /** O hospital da sessão: a lista é só dele, e a ficha nova nasce nele. */
  local?: { id: string; nome: string } | null;
  abertas: FolhaResumo[];
  encerradas: FolhaResumo[];
  semBanco: boolean;
  agora: number;
}) {
  return (
    <div className="evoInicio fcFundo temaApp">
      <main className="fcPagina">
        <header className="fcTopo">
          <Link href="/dashboard?area=medico" className="fcVoltar">
            <Icone nome="voltar" tamanho={18} /> Área médica
          </Link>
        </header>

        <div className="fcTitulo">
          <h1>Ficha anestésica</h1>
          {local && <p className="fcLocal"><Icone nome="predio" tamanho={16} /> {local.nome}</p>}
        </div>

        {semBanco ? (
          <p className="evoFaixa atencao">
            O banco da ficha anestésica ainda não está instalado. Rode a migração
            <code> 202610100004_evolucao_anestesica.sql</code> no Supabase.
          </p>
        ) : (
          // Em andamento, abrir, encerradas: a ordem da pressa, também a do
          // teclado. No computador, abrir à esquerda e as duas listas à
          // direita (grid-template-areas em globals.css).
          <div className="fcColunas">
            {abertas.length > 0 && (
              <section className="fcSecao fcAndamento" aria-labelledby="fc-andamento">
                <h2 id="fc-andamento">Em andamento <span className="fcConta">{abertas.length}</span></h2>
                <ul className="fcLista">
                  {abertas.map((f) => (
                    <li key={f.id} className="fcAberta">
                      <Link href={`/evolucao/${f.id}`} className="fcLinha aberta">
                        <span className="fcQuem">
                          <strong>{f.paciente}</strong>
                          <span>{[f.procedimento || "Procedimento não informado", f.sala && `Sala ${f.sala}`, `aberta às ${hora(f.inicio_em)}`]
                            .filter(Boolean).join(" · ")}</span>
                        </span>
                        {f.fim ? (
                          // Terminou: o tempo para no fim, e o que falta é encerrar.
                          <span className="fcTempo parado">Terminou às {hora(f.fim)}</span>
                        ) : (
                          <span className="fcTempo">
                            <Decorrido desde={f.inicio_em} agoraDoServidor={agora} />
                          </span>
                        )}
                        <span className="fcIr">{f.fim ? "Encerrar ficha" : "Continuar"} <Icone nome="seta" className="fcSetaDireita" /></span>
                      </Link>
                      <ExcluirFolha id={f.id} paciente={f.paciente} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="fcPrincipal">
              <NovaFolha institutionId={institutionId} local={local} mapa={mapa} avaliadosHoje={avaliadosHoje}
                podeImportarMapa={podeImportarMapa} podeVerMapa={podeVerMapa} />
            </div>

            {encerradas.length > 0 && (
              <section className="fcSecao fcEncerradas" aria-labelledby="fc-encerradas">
                <h2 id="fc-encerradas">Encerradas recentes</h2>
                <ul className="fcLista">
                  {encerradas.map((f) => (
                    <li key={f.id} className="fcEncerrada">
                      <Link href={`/evolucao/${f.id}`} className="fcLinha">
                        <span className="fcQuem">
                          <strong>{f.paciente}</strong>
                          <span>{[f.procedimento || "Procedimento não informado", f.versao > 1 && `versão ${f.versao}`]
                            .filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="fcQuando">
                          {dia(f.inicio_em)} · {hora(f.inicio_em)}{f.encerrada_em && `–${hora(f.encerrada_em)}`}
                        </span>
                      </Link>
                      <ImprimirFicha id={f.id} className="fcImprimir" rotulo={`Imprimir a ficha de ${f.paciente}`}>
                        <Icone nome="imprimir" tamanho={18} /> <span>Imprimir</span>
                      </ImprimirFicha>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
