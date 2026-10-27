"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icone, type NomeDoIcone } from "@/components/icone";
import { versaoDeContrato } from "@/lib/honorarios-dados";
import { AREAS, pendenciasDasTabelas, primeirosPassos, type Area, type EstadoDasTabelas } from "@/lib/honorarios-telas";
import type { DadosDasTabelas } from "./tipos";
import { AreaPendencias } from "./area-pendencias";
import { AreaTuss } from "./area-tuss";
import { AreaCbhpm } from "./area-cbhpm";
import { AreaContratos } from "./area-contratos";
import { AreaImportar, type PedidoDeImportacao } from "./area-importar";
import { AreaRegras } from "./area-regras";
import { AreaHistorico } from "./area-historico";
import { PrimeirosPassos } from "./primeiros-passos";
import { dinheiro } from "./comum";
import estilos from "./honorarios.module.css";

// A casca de "Tabelas e honorários": o título, o menu das sete áreas e a área
// aberta. Os dados pequenos chegam do servidor (app/financeiro/honorarios);
// depois de gravar, `atualizar()` relê a página sem perder a área aberta.

const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

const ICONE_DA_AREA: Record<Area, NomeDoIcone> = {
  pendencias: "alerta", tuss: "busca", cbhpm: "nota", contratos: "assinatura",
  importar: "enviar", regras: "calculadora", historico: "relogio",
};

export function TabelasEHonorarios({
  naoInstalado, dados, areaInicial,
}: {
  naoInstalado: boolean;
  dados: DadosDasTabelas | null;
  areaInicial: Area;
}) {
  const router = useRouter();
  const [area, setArea] = useState<Area>(areaInicial);
  // O item que a pendência apontou (a edição da CBHPM, o contrato). Entra na
  // chave da área: chegar por outra pendência abre a área de novo, no item novo.
  const [foco, setFoco] = useState<string | undefined>(undefined);
  // Quem pede uma importação de outra área (o botão "Importar procedimentos"
  // da CBHPM, por exemplo) já chega com o tipo e o destino escolhidos.
  const [pedido, setPedido] = useState<PedidoDeImportacao | null>(null);

  function abrir(a: Area, item?: string) {
    setArea(a);
    setFoco(item);
    // A área fica no endereço: recarregar ou mandar o link abre no mesmo lugar.
    try { window.history.replaceState(null, "", `?area=${a}`); } catch { /* segue sem o endereço */ }
    window.scrollTo({ top: 0 });
  }
  function importar(p: PedidoDeImportacao) {
    setPedido(p);
    abrir("importar");
  }

  const versoes = useMemo(() => {
    if (!dados) return [];
    const contratoPorId = new Map(dados.contratos.map((c) => [c.id, c]));
    const operadoraPorId = new Map(dados.operadoras.map((o) => [o.id, o]));
    return dados.versoes.flatMap((v) => {
      const c = contratoPorId.get(v.contrato_id);
      const o = c ? operadoraPorId.get(c.operadora_id) : undefined;
      return c && o ? [versaoDeContrato(v, c, o, dados.valoresPorPorte, dados.valoresPorProcedimento)] : [];
    });
  }, [dados]);

  const pendencias = useMemo(() => {
    if (!dados) return [];
    const estado: EstadoDasTabelas = {
      hoje: dados.hoje,
      tuss: dados.tuss,
      edicoes: dados.edicoes.map((e) => ({
        id: e.id, edicao: e.edicao, situacao: e.situacao,
        portes: new Set(dados.portes.filter((p) => p.edicao_id === e.id).map((p) => p.porte)).size,
      })),
      operadoras: dados.operadoras,
      contratos: dados.contratos,
      versoes,
      correspondenciasPropostas: dados.correspondenciasPropostas,
      producaoPendente: dados.producaoPendente,
      mantemATuss: dados.superAdmin,
    };
    return pendenciasDasTabelas(estado);
  }, [dados, versoes]);

  const passos = useMemo(() => dados
    ? primeirosPassos({ tuss: dados.tuss, versoes: dados.versoes, honorariosCalculados: dados.honorariosCalculados, mantemATuss: dados.superAdmin })
    : [], [dados]);

  const vigente = dados?.tuss.find((t) => t.situacao === "vigente");
  const atualizar = () => router.refresh();

  return (
    <div className={`fcFundo temaApp ${estilos.fundo}`}>
      <main className={`fcPagina ${estilos.pagina}`}>
        <header className="fcTopo">
          <Link href="/dashboard" className="fcVoltar"><Icone nome="voltar" tamanho={18} /> Painel</Link>
        </header>

        <header className={estilos.cabecalho}>
          <div>
            <h1>Tabelas e honorários</h1>
            <p>TUSS, CBHPM e o contrato de cada convênio: de onde sai o valor previsto do honorário anestésico.</p>
          </div>
          {dados && (
            <dl className={estilos.resumo}>
              <div><dt>TUSS publicada</dt><dd>{vigente ? vigente.versao : "nenhuma"}</dd></div>
              <div><dt>Planos de saúde</dt><dd>{dados.operadoras.filter((o) => o.ativo).length}</dd></div>
              {/* O que o módulo entrega: o previsto do mês na sua Produção, com a
                  cobertura — o número sozinho pareceria o total do mês. */}
              <div className={estilos.resumoPrevisto}>
                <dt>Previsto em {MES.format(new Date(`${dados.hoje}T12:00:00`))}</dt>
                <dd>{dinheiro(dados.previstoDoMes.previsto)}</dd>
                <dd className={estilos.resumoNota}>
                  {dados.previstoDoMes.total === 0 ? "nenhuma anestesia anotada"
                    : `em ${dados.previstoDoMes.calculadas} de ${dados.previstoDoMes.total} anestesias`}
                </dd>
              </div>
            </dl>
          )}
        </header>
        {/* Liberado para todos ainda em desenvolvimento: o aviso fica no alto,
            à vista, e não escondido num rodapé. */}
        <p className={estilos.emDesenvolvimento} role="note">
          <Icone nome="ampulheta" tamanho={16} />
          <span>
            <b>Em desenvolvimento.</b> O cálculo do honorário ainda está sendo ajustado: use o valor como previsão e
            confira com o contrato do plano antes de cobrar. Achou algo errado? Conte pelo balão de conversa.
          </span>
        </p>

        {naoInstalado || !dados ? <NaoInstalado /> : (<>
          <PrimeirosPassos passos={passos} onAbrir={abrir} onImportar={importar} />
          <div className="financeLayout">
            <nav className="financeTarefas menuLateral" aria-label="Áreas de Tabelas e honorários">
              {AREAS.map((a) => {
                const n = a.id === "pendencias" ? pendencias.length : 0;
                return (
                  <button type="button" key={a.id} className={`finMenuDireto${area === a.id ? " active" : ""}`}
                    aria-current={area === a.id ? "true" : undefined} onClick={() => abrir(a.id)}>
                    <Icone nome={ICONE_DA_AREA[a.id]} tamanho={18} />
                    <span>{a.rotulo}</span>
                    {n > 0 && <b className="financeTarefaContador">{n}</b>}
                  </button>
                );
              })}
            </nav>
            <div className={estilos.conteudo}>
              {!dados.podeEditar && (
                <p className="clinicalError">
                  Sua conta não tem o Financeiro desta organização: as tabelas da clínica não abrem nem se gravam por aqui.
                </p>
              )}
              {area === "pendencias" && <AreaPendencias pendencias={pendencias} onAbrir={abrir} onImportar={importar} />}
              {area === "tuss" && <AreaTuss dados={dados} onImportar={importar} onAtualizar={atualizar} />}
              {area === "cbhpm" && <AreaCbhpm key={foco ?? "cbhpm"} dados={dados} focoInicial={foco} onImportar={importar} onAtualizar={atualizar} />}
              {area === "contratos" && (
                <AreaContratos key={foco ?? "contratos"} dados={dados} versoes={versoes} focoInicial={foco} onImportar={importar} onAtualizar={atualizar} />
              )}
              {area === "importar" && (
                <AreaImportar key={pedido ? `${pedido.tipo}-${pedido.destinoId ?? ""}` : "novo"} dados={dados}
                  pedido={pedido} onAtualizar={atualizar} onAbrir={abrir} />
              )}
              {area === "regras" && <AreaRegras dados={dados} versoes={versoes} />}
              {area === "historico" && <AreaHistorico dados={dados} />}
            </div>
          </div>
        </>)}
      </main>
    </div>
  );
}

function NaoInstalado() {
  return (
    <section className={estilos.naoInstalado}>
      <Icone nome="ampulheta" tamanho={22} />
      <div>
        <h2>Módulo ainda não instalado no banco</h2>
        <p>
          As tabelas de TUSS, CBHPM e contratos entram com a migração <code>202610230011_tabelas_e_honorarios</code>,
          que ainda não foi aplicada. Nada do que já existe muda até lá.
        </p>
      </div>
    </section>
  );
}
