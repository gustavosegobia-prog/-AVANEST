import Link from "next/link";
import { Icone } from "@/components/icone";
import { Decorrido } from "./decorrido";
import { NovaFolha } from "./nova-folha";

export type FolhaResumo = {
  id: string;
  versao: number;
  inicio_em: string;
  encerrada_em: string | null;
  paciente: string;
  procedimento: string;
  sala: string;
};

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const hora = (iso: string) => HORA.format(new Date(iso));
const dia = (iso: string) => DIA.format(new Date(iso));

// A entrada da ficha anestésica. No tablet da sala ela tem três trabalhos, na
// ordem em que aparecem: abrir a ficha do paciente que vai entrar, voltar à
// que está em andamento, e achar a que já foi encerrada para conferir ou
// imprimir.
export function InicioDasFolhas({
  institutionId, abertas, encerradas, semBanco, agora,
}: {
  institutionId: string;
  abertas: FolhaResumo[];
  encerradas: FolhaResumo[];
  semBanco: boolean;
  agora: number;
}) {
  return (
    <div className="evoInicio fcFundo">
      <main className="fcPagina">
        <header className="fcTopo">
          <Link href="/dashboard?area=medico" className="fcVoltar">
            <Icone nome="voltar" tamanho={18} /> Área médica
          </Link>
        </header>

        <div className="fcTitulo">
          <h1>Ficha anestésica</h1>
          <p>Busque o paciente: a ficha abre com a avaliação pré-anestésica dele já no topo, para conferir.</p>
        </div>

        {semBanco ? (
          <p className="evoFaixa atencao">
            O banco da ficha anestésica ainda não está instalado. Rode a migração
            <code> 202610100004_evolucao_anestesica.sql</code> no Supabase.
          </p>
        ) : (
          <>
            <NovaFolha institutionId={institutionId} />

            <section className="fcSecao" aria-labelledby="fc-andamento">
              <h2 id="fc-andamento">
                Em andamento {abertas.length > 0 && <span className="fcConta">{abertas.length}</span>}
              </h2>
              {abertas.length ? (
                <ul className="fcLista">
                  {abertas.map((f) => (
                    <li key={f.id}>
                      <Link href={`/evolucao/${f.id}`} className="fcLinha aberta">
                        <span className="fcQuem">
                          <strong>{f.paciente}</strong>
                          <span>{[f.procedimento || "Procedimento não informado", f.sala && `Sala ${f.sala}`, `aberta às ${hora(f.inicio_em)}`]
                            .filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="fcTempo">
                          <Decorrido desde={f.inicio_em} agoraDoServidor={agora} />
                        </span>
                        <span className="fcIr">Continuar <Icone nome="seta" className="fcSetaDireita" /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fcVazio">Nenhuma ficha aberta agora.</p>
              )}
            </section>

            {encerradas.length > 0 && (
              <section className="fcSecao" aria-labelledby="fc-encerradas">
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
                      <Link href={`/evolucao/${f.id}/imprimir`} className="fcImprimir" aria-label={`Imprimir a ficha de ${f.paciente}`}>
                        <Icone nome="imprimir" tamanho={18} /> <span>Imprimir</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
