"use client";

import { useEffect, useState } from "react";
import { Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { dataBr, dinheiro, mensagemDoBanco } from "./comum";
import {
  calcularNoServidor, codigosSalvos, gravarCodigos, sugestoesDeCodigos, tussEmUso, type Codigo,
} from "./calculo-da-anestesia";
import type { AnestesiaDaProducao, CamposDoHonorario } from "./honorario-da-anestesia";
import estilos from "./honorarios.module.css";

// Calcular o mês inteiro sem abrir uma gaveta por anestesia: a lista do que
// falta, cada uma com os códigos já gravados ou sugeridos pelo que o médico
// usou antes para o mesmo procedimento. Ele confere, desmarca o que não está
// certo e calcula todas, uma depois da outra. Sem código, a linha leva à
// gaveta de uma anestesia para escolher.

type Desfecho =
  | { tipo: "calculado"; valor: number; aviso: string | null }
  | { tipo: "pendente"; texto: string }
  | { tipo: "erro"; texto: string };

type Linha = {
  anestesia: AnestesiaDaProducao;
  codigos: Codigo[];
  /** De quando é a sugestão; nulo quando os códigos já estavam gravados. */
  sugeridoDe: string | null;
  marcada: boolean;
  desfecho?: Desfecho;
};

export function CalcularOMes({ anestesias, rotuloDoMes, mascarar, onFechar, onCalculado, onEscolherCodigo }: {
  /** As anestesias do mês sem cálculo ou pendentes, na ordem da Produção. */
  anestesias: AnestesiaDaProducao[];
  rotuloDoMes: string;
  mascarar: (s: string) => string;
  onFechar: () => void;
  onCalculado: (id: string, campos: CamposDoHonorario) => void;
  onEscolherCodigo: (a: AnestesiaDaProducao) => void;
}) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [tussId, setTussId] = useState<string | null | undefined>(undefined);
  const [andamento, setAndamento] = useState<{ feitas: number; de: number } | null>(null);
  const [terminou, setTerminou] = useState(false);

  // Uma leitura só para a lista inteira: os códigos gravados e, para as que
  // não têm, a sugestão pela última anotação com o mesmo procedimento.
  useEffect(() => {
    let valendo = true;
    void (async () => {
      const [salvos, tuss] = await Promise.all([codigosSalvos(anestesias.map((a) => a.id)), tussEmUso()]);
      const semCodigo = anestesias.filter((a) => !salvos.get(a.id)?.length);
      const sugestoes = await sugestoesDeCodigos(semCodigo);
      if (!valendo) return;
      setTussId(tuss);
      setLinhas(anestesias.map((a) => {
        const deles = salvos.get(a.id);
        const s = sugestoes.get(a.id);
        const codigos = deles?.length ? deles : s?.codigos ?? [];
        return { anestesia: a, codigos, sugeridoDe: deles?.length ? null : s?.data ?? null, marcada: codigos.length > 0 };
      }));
    })();
    return () => { valendo = false; };
  }, [anestesias]);

  const marcadas = linhas?.filter((l) => l.marcada && l.codigos.length && l.desfecho?.tipo !== "calculado") ?? [];
  const calculando = andamento !== null && !terminou;

  function alternar(id: string) {
    setLinhas((ls) => ls?.map((l) => (l.anestesia.id === id ? { ...l, marcada: !l.marcada } : l)) ?? null);
  }

  async function calcularMarcadas() {
    const fila = marcadas;
    setTerminou(false);
    setAndamento({ feitas: 0, de: fila.length });
    for (const [n, l] of fila.entries()) {
      let desfecho: Desfecho;
      try {
        // Os sugeridos ainda não estão gravados: gravam-se agora, na ordem da lista.
        if (l.sugeridoDe) await gravarCodigos(l.anestesia.id, l.codigos, tussId ?? null);
        const urgencia = Boolean(l.anestesia.urgencia);
        const r = await calcularNoServidor(l.anestesia.id, urgencia);
        desfecho = r.situacao === "calculado" && r.valorPrevisto != null
          ? { tipo: "calculado", valor: r.valorPrevisto, aviso: r.mensagem }
          : { tipo: "pendente", texto: r.mensagem || r.pendencias[0]?.texto || "Pendente de conferência" };
        onCalculado(l.anestesia.id, { honorario_situacao: r.situacao, honorario_valor_previsto: r.valorPrevisto, urgencia });
      } catch (e) {
        desfecho = { tipo: "erro", texto: mensagemDoBanco(e, "Não foi possível calcular agora.") };
      }
      // O que não calculou sai da marcação: o motivo fica na linha, e marcar
      // de novo é tentar de novo.
      setLinhas((ls) => ls?.map((x) => (x.anestesia.id === l.anestesia.id
        ? { ...x, desfecho, marcada: false, sugeridoDe: desfecho.tipo === "erro" ? x.sugeridoDe : null } : x)) ?? null);
      setAndamento({ feitas: n + 1, de: fila.length });
    }
    setTerminou(true);
  }

  const feitas = linhas?.filter((l) => l.desfecho) ?? [];
  const somaCalculada = feitas.reduce((s, l) => s + (l.desfecho?.tipo === "calculado" ? l.desfecho.valor : 0), 0);
  const nCalculadas = feitas.filter((l) => l.desfecho?.tipo === "calculado").length;
  const nProblemas = feitas.length - nCalculadas;
  const semCodigo = linhas?.filter((l) => !l.codigos.length).length ?? 0;

  return (
    <Gaveta titulo="Calcular o mês" largura="larga" onPedirFechar={onFechar}
      subtitulo={<>{rotuloDoMes} · {anestesias.length} {anestesias.length === 1 ? "anestesia sem honorário calculado" : "anestesias sem honorário calculado"}</>}
      rodape={terminou && !marcadas.length ? (
        <button type="button" className="primaryClinical compact" onClick={onFechar}>Pronto</button>
      ) : <>
        <button type="button" className="outlineClinical" onClick={onFechar} disabled={calculando}>Fechar</button>
        <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={() => void calcularMarcadas()}
          disabled={calculando || !marcadas.length}>
          <Icone nome="calculadora" tamanho={16} />
          {andamento && !terminou ? `Calculando ${Math.min(andamento.feitas + 1, andamento.de)} de ${andamento.de}…`
            : marcadas.length ? `Calcular ${marcadas.length === 1 ? "1 anestesia" : `${marcadas.length} anestesias`}` : "Nada marcado"}
        </button>
      </>}>
      <div className="admCampos">
        {tussId === null && (
          <p className="clinicalError">A TUSS ainda não foi publicada: sem ela, o código do procedimento não é conferido.</p>
        )}
        <p className="admAjuda">
          Os códigos <b>sugeridos</b> vêm do que você usou antes para o mesmo procedimento. Desmarque o que não estiver certo;
          o que ficar marcado é gravado e calculado, uma anestesia depois da outra.
        </p>

        {andamento && (
          <div className={estilos.progresso} role="status">
            {!terminou && <progress max={andamento.de} value={andamento.feitas} aria-label="Andamento do cálculo" />}
            {terminou ? (
              <span>
                {nCalculadas > 0 && <>{nCalculadas === 1 ? "1 calculada" : `${nCalculadas} calculadas`}, {mascarar(dinheiro(somaCalculada))}</>}
                {nCalculadas > 0 && nProblemas > 0 && " · "}
                {nProblemas > 0 && <b className={estilos.textoAtencao}>{nProblemas === 1 ? "1 ficou pendente" : `${nProblemas} ficaram pendentes`}: veja o motivo na linha</b>}
              </span>
            ) : <span>Calculando {andamento.feitas} de {andamento.de}…</span>}
          </div>
        )}

        {linhas === null ? <p className="admTextoFraco" role="status">Procurando os códigos de cada anestesia…</p> : (
          <ul className={estilos.lote}>
            {linhas.map((l) => {
              const a = l.anestesia;
              const d = l.desfecho;
              return (
                <li key={a.id} className={d?.tipo === "calculado" ? estilos.loteFeita : undefined}>
                  {l.codigos.length && d?.tipo !== "calculado" ? (
                    <input type="checkbox" checked={l.marcada} disabled={calculando} onChange={() => alternar(a.id)}
                      aria-label={`Calcular ${a.paciente}, ${dataBr(a.data)}`} />
                  ) : <span aria-hidden="true" />}
                  <div className={estilos.loteQuem}>
                    <strong>{a.paciente}</strong>
                    <span className={estilos.linhaFraca}>
                      {dataBr(a.data).slice(0, 5)} · {a.convenio}{a.procedimento ? ` · ${a.procedimento}` : ""}{a.urgencia ? " · urgência" : ""}
                    </span>
                    {l.codigos.length > 0 && (
                      <span className={estilos.loteCodigos}>
                        {l.codigos.map((c, i) => (
                          <span key={c.codigo} title={c.descricao || undefined}>
                            <b className={estilos.codigo}>{c.codigo}</b>{i === 0 && l.codigos.length > 1 ? " (principal)" : ""}
                          </span>
                        ))}
                        {l.sugeridoDe && <em>sugerido pelo de {dataBr(l.sugeridoDe).slice(0, 5)}</em>}
                      </span>
                    )}
                  </div>
                  <div className={estilos.loteDesfecho}>
                    {d?.tipo === "calculado" ? (
                      <>
                        <strong className={estilos.textoOk}><Icone nome="confirmado" tamanho={14} /> {mascarar(dinheiro(d.valor))}</strong>
                        {d.aviso && <span className={estilos.linhaFraca}>{d.aviso}</span>}
                      </>
                    ) : d ? (
                      <span className={estilos.textoAtencao}><Icone nome="alerta" tamanho={14} /> {d.texto}</span>
                    ) : !l.codigos.length ? (
                      <button type="button" className="outlineClinical compacto" disabled={calculando} onClick={() => onEscolherCodigo(a)}>
                        Escolher código
                      </button>
                    ) : a.honorario_situacao === "pendente" ? (
                      <span className={estilos.linhaFraca}>Estava pendente</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {linhas && semCodigo > 0 && (
          <p className="admAjuda">
            {semCodigo === 1 ? "1 anestesia não tem" : `${semCodigo} anestesias não têm`} código ainda: “Escolher código” abre a anestesia para buscar na TUSS.
          </p>
        )}
      </div>
    </Gaveta>
  );
}
