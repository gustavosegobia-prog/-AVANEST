"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao, Dialogo, Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { nomeSimples, problemasDaVersao, type Ajuste, type Porte, type VersaoDeContrato } from "@/lib/honorarios";
import { NOME_DA_SITUACAO_DA_VERSAO } from "@/lib/honorarios-dados";
import { emLotes, rotuloDoPorte } from "@/lib/honorarios-telas";
import { Aviso, Etiqueta, Recusa, Vazio, dataBr, dinheiro, exigir, lerNumero, percentual, useAcao, type Tom } from "./comum";
import type { PedidoDeImportacao } from "./area-importar";
import { criarRascunho } from "./rascunho";
import type { DadosDasTabelas, LinhaContrato, LinhaOperadora, LinhaVersao } from "./tipos";
import estilos from "./honorarios.module.css";

const TOM_DA_VERSAO: Record<LinhaVersao["situacao"], Tom> = { rascunho: "atencao", vigente: "ok", encerrada: "neutra" };
const PORTES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Convênios (operadoras), os contratos de cada um e as versões do contrato.
 * As regras moram na versão: rascunho se edita; publicada não muda — reajuste
 * é versão nova, e a antiga continua explicando o que foi calculado com ela.
 */
export function AreaContratos({
  dados, versoes, focoInicial, onImportar, onAtualizar,
}: {
  dados: DadosDasTabelas;
  versoes: VersaoDeContrato[];
  /** O contrato que a pendência apontou; sem ele, o primeiro da lista. */
  focoInicial?: string;
  onImportar: (p: PedidoDeImportacao) => void;
  onAtualizar: () => void;
}) {
  const [contratoId, setContratoId] = useState<string | null>(
    dados.contratos.find((c) => c.id === focoInicial)?.id ?? dados.contratos[0]?.id ?? null);
  const [novoConvenio, setNovoConvenio] = useState(false);
  const [novoContrato, setNovoContrato] = useState<LinhaOperadora | null>(null);
  const contrato = dados.contratos.find((c) => c.id === contratoId) ?? null;
  const nomeDoLocal = new Map(dados.locais.map((l) => [l.id, l.nome]));
  const detalhe = useRef<HTMLDivElement>(null);

  // No celular a lista fica em cima e o contrato embaixo: escolher (ou chegar
  // por uma pendência) leva a tela até o contrato, senão o toque parece não fazer nada.
  const mostrarDetalhe = () => requestAnimationFrame(() => {
    if (!window.matchMedia("(max-width: 860px)").matches) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detalhe.current?.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
  });
  useEffect(() => { if (focoInicial) mostrarDetalhe(); }, [focoInicial]);

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Planos de saúde"
        descricao="A tabela de cada plano (convênio) e o contrato com ele, versão por versão. Não há fórmula universal: vale o que a versão diz."
        acao={dados.podeEditar ? (
          <div className={estilos.acoesDaLinha}>
            <button type="button" className="outlineClinical" onClick={() => setNovoConvenio(true)}>Novo plano de saúde</button>
            <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={() => onImportar({ tipo: "contrato" })}>
              <Icone nome="enviar" tamanho={16} /> Importar tabela de um plano
            </button>
          </div>
        ) : undefined} />

      {dados.operadoras.length === 0 ? (
        <Vazio titulo="Nenhum plano de saúde cadastrado.">
          Importe a tabela que o plano mandou (código TUSS, porte anestésico e valor) ou cadastre o plano com o mesmo
          nome usado na Produção (ex.: Unimed). O cálculo acha o contrato pelo nome, sem diferenciar maiúsculas e acentos.
        </Vazio>
      ) : (
        <div className={estilos.duasColunas}>
          <nav className={estilos.listaDeConvenios} aria-label="Planos de saúde e contratos">
            {dados.operadoras.map((o) => {
              const contratos = dados.contratos.filter((c) => c.operadora_id === o.id);
              return (
                <div key={o.id} className={estilos.convenio}>
                  <div className={estilos.convenioNome}>
                    <strong>{o.nome}</strong>
                    {o.particular && <Etiqueta tom="info">Particular</Etiqueta>}
                    {!o.ativo && <Etiqueta tom="neutra">Inativo</Etiqueta>}
                  </div>
                  {contratos.map((c) => (
                    <button type="button" key={c.id} className={`${estilos.contratoItem}${c.id === contratoId ? ` ${estilos.contratoAtivo}` : ""}`}
                      aria-current={c.id === contratoId ? "true" : undefined} onClick={() => { setContratoId(c.id); mostrarDetalhe(); }}>
                      <span>{c.identificacao}</span>
                      <small>{c.local_id ? nomeDoLocal.get(c.local_id) ?? "Hospital" : "Todos os hospitais"}{!c.ativo ? " · inativo" : ""}</small>
                    </button>
                  ))}
                  {dados.podeEditar && (
                    <button type="button" className={estilos.novoContrato} onClick={() => setNovoContrato(o)}>
                      <Icone nome="nota" tamanho={14} /> Novo contrato
                    </button>
                  )}
                </div>
              );
            })}
          </nav>
          <div className={estilos.detalhe} ref={detalhe}>
            {contrato ? (
              <Contrato key={contrato.id} dados={dados} contrato={contrato} versoes={versoes}
                onImportar={onImportar} onAtualizar={onAtualizar} />
            ) : (
              <Vazio titulo="Escolha um contrato.">Ou cadastre o primeiro contrato de um convênio.</Vazio>
            )}
          </div>
        </div>
      )}

      {novoConvenio && <NovoConvenio dados={dados} onFechar={() => setNovoConvenio(false)} onCriado={() => { setNovoConvenio(false); onAtualizar(); }} />}
      {novoContrato && <NovoContrato dados={dados} operadora={novoContrato} onFechar={() => setNovoContrato(null)}
        onCriado={(id) => { setNovoContrato(null); setContratoId(id); onAtualizar(); }} />}
    </section>
  );
}

// ── Um contrato ────────────────────────────────────────────────────────────

function Contrato({
  dados, contrato, versoes, onImportar, onAtualizar,
}: {
  dados: DadosDasTabelas;
  contrato: LinhaContrato;
  versoes: VersaoDeContrato[];
  onImportar: (p: PedidoDeImportacao) => void;
  onAtualizar: () => void;
}) {
  const operadora = dados.operadoras.find((o) => o.id === contrato.operadora_id);
  const doContrato = dados.versoes.filter((v) => v.contrato_id === contrato.id).sort((a, b) => b.versao - a.versao);
  const [versaoId, setVersaoId] = useState<string | null>(doContrato[0]?.id ?? null);
  const acao = useAcao();
  const linha = doContrato.find((v) => v.id === versaoId) ?? null;
  const montada = versoes.find((v) => v.id === versaoId) ?? null;
  const local = contrato.local_id ? dados.locais.find((l) => l.id === contrato.local_id)?.nome ?? "Hospital" : "Todos os hospitais";

  async function novaVersao() {
    await acao.executar(async () => {
      setVersaoId(await criarRascunho(createClient(), dados, contrato.id));
    });
    onAtualizar();
  }

  // Desativar tira o contrato do cálculo: pede confirmação. Reativar, não.
  const [desativando, setDesativando] = useState(false);
  async function alternarAtivo() {
    const ok = await acao.executar(async () => {
      exigir(await createClient().from("contratos").update({ ativo: !contrato.ativo }).eq("id", contrato.id));
    });
    setDesativando(false);
    if (ok) onAtualizar();
  }

  return (
    <article className={estilos.painel}>
      <header className={estilos.painelTopo}>
        <div>
          <h3>{operadora?.nome} · {contrato.identificacao}</h3>
          <p>{local}{contrato.ativo ? "" : " · contrato inativo: o cálculo não usa"}</p>
        </div>
        {dados.podeEditar && (
          <div className={estilos.acoesDaLinha}>
            <button type="button" className="outlineClinical compacto" disabled={acao.ocupado}
              onClick={() => (contrato.ativo ? setDesativando(true) : void alternarAtivo())}>
              {contrato.ativo ? "Desativar contrato" : "Reativar contrato"}
            </button>
            <button type="button" className={`outlineClinical compacto ${estilos.comIcone}`} disabled={acao.ocupado}
              onClick={() => onImportar({ tipo: "contrato", destinoId: contrato.id })}>
              <Icone nome="enviar" tamanho={14} /> Importar tabela do plano
            </button>
            {!doContrato.some((v) => v.situacao === "rascunho") && (
              <button type="button" className="primaryClinical compact" onClick={novaVersao} disabled={acao.ocupado}>
                {doContrato.length ? "Nova versão (reajuste)" : "Criar a primeira versão"}
              </button>
            )}
          </div>
        )}
      </header>
      {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}

      {doContrato.length === 0 ? (
        <Vazio titulo="Este contrato ainda não tem versão.">A versão diz as regras e os valores; sem ela, o convênio fica sem contrato.</Vazio>
      ) : (
        <div className={estilos.escolhas} role="group" aria-label="Versões do contrato">
          {doContrato.map((v) => (
            <button type="button" key={v.id} className={`${estilos.escolha}${v.id === versaoId ? ` ${estilos.escolhaAtiva}` : ""}`}
              aria-pressed={v.id === versaoId} onClick={() => setVersaoId(v.id)}>
              <strong>Versão {v.versao}</strong>
              <span>{dataBr(v.vigencia_inicio)} a {v.vigencia_fim ? dataBr(v.vigencia_fim) : "sem fim"}</span>
              <Etiqueta tom={TOM_DA_VERSAO[v.situacao]}>{NOME_DA_SITUACAO_DA_VERSAO[v.situacao]}</Etiqueta>
            </button>
          ))}
        </div>
      )}

      {linha && montada && (
        linha.situacao === "rascunho" && dados.podeEditar
          ? <Rascunho key={linha.id} dados={dados} linha={linha} montada={montada}
              onAtualizar={onAtualizar} onApagada={() => { setVersaoId(null); onAtualizar(); }} />
          : <VersaoPublicada key={linha.id} dados={dados} linha={linha} montada={montada} onAtualizar={onAtualizar} />
      )}

      {desativando && (
        <Dialogo titulo={`Desativar ${operadora?.nome ?? "o contrato"} · ${contrato.identificacao}?`} confirmar="Desativar" perigo
          ocupado={acao.ocupado} erro={acao.erro} onConfirmar={() => void alternarAtivo()} onCancelar={() => setDesativando(false)}>
          <p>A partir de agora o cálculo não usa este contrato: as anestesias deste plano ficam pendentes até haver outro valendo.</p>
          <p>Os honorários já calculados não mudam, e o contrato pode ser reativado depois.</p>
        </Dialogo>
      )}
    </article>
  );
}

// ── Versão publicada: só se lê e se encerra ────────────────────────────────

function VersaoPublicada({
  dados, linha, montada, onAtualizar,
}: {
  dados: DadosDasTabelas;
  linha: LinhaVersao;
  montada: VersaoDeContrato;
  onAtualizar: () => void;
}) {
  const [encerrar, setEncerrar] = useState(false);
  const [fim, setFim] = useState(linha.vigencia_fim ?? dados.hoje);
  const acao = useAcao();
  const edicao = dados.edicoes.find((e) => e.id === linha.cbhpm_edicao_id);
  const [filtro, setFiltro] = useState("");
  const tabela = tabelaDoPlano(dados, linha.id, montada);
  const visiveis = filtrar(tabela, filtro);

  async function confirmar() {
    const ok = await acao.executar(async () => {
      exigir(await createClient().from("contrato_versoes").update({ situacao: "encerrada", vigencia_fim: fim }).eq("id", linha.id));
    });
    if (ok) { setEncerrar(false); onAtualizar(); }
  }

  return (
    <div className={estilos.bloco}>
      <p className="admNota"><Icone nome="cadeado" tamanho={14} />
        Versão {linha.situacao === "vigente" ? "publicada" : "encerrada"}{linha.publicada_em ? ` em ${dataBr(linha.publicada_em)}` : ""}: não muda. Para reajustar, crie uma versão nova.
      </p>
      <dl className={estilos.regras}>
        <div><dt>Vigência</dt><dd>{dataBr(linha.vigencia_inicio)} a {linha.vigencia_fim ? dataBr(linha.vigencia_fim) : "sem fim"}</dd></div>
        <div><dt>Referência</dt><dd>{linha.referencia === "cbhpm" ? `CBHPM ${edicao?.edicao ?? ""}` : "Tabela própria"}</dd></div>
        {linha.referencia === "cbhpm" && <div><dt>Reajuste sobre a CBHPM</dt><dd>{percentual(montada.reajustePercentual)}</dd></div>}
        <div><dt>Urgência</dt><dd>{montada.urgenciaPercentual == null ? "Não prevê" : `+${percentual(montada.urgenciaPercentual)}`}</dd></div>
        <div><dt>Procedimentos múltiplos</dt><dd>{montada.multiplosPercentuais ? montada.multiplosPercentuais.map((p) => percentual(p)).join(", ") : "Não prevê"}</dd></div>
        <div><dt>Adicionais e redutores</dt><dd>{montada.ajustes.length
          ? montada.ajustes.map((a) => `${a.nome} ${a.tipo === "percentual" ? percentual(a.valor) : dinheiro(a.valor)}${a.quando === "urgencia" ? " (urgência)" : ""}`).join(" · ")
          : "Nenhum"}{montada.ajustes.length > 1 ? (montada.ajustesCumulativos ? " — um sobre o outro" : " — somados") : ""}</dd></div>
      </dl>
      <h4 className={estilos.subtitulo}>Valores por porte (R$)</h4>
      <div className={estilos.gradePortes}>
        {PORTES.map((p) => (
          <div key={p} className={estilos.porteLido}>
            <span>{rotuloDoPorte(p)}</span>
            <strong>{montada.valoresPorPorte[p] != null
              ? (montada.valoresPorPorte[p] as number).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : linha.referencia === "cbhpm" ? "CBHPM" : "—"}</strong>
          </div>
        ))}
      </div>
      <h4 className={estilos.subtitulo}>Tabela de procedimentos {tabela.length > 0 && <span className="admContagem">{tabela.length.toLocaleString("pt-BR")}</span>}</h4>
      {tabela.length === 0 ? <p className="admTextoFraco">Nenhum procedimento na tabela desta versão: o porte vem da CBHPM.</p> : (
        <>
          <BuscaNaTabela filtro={filtro} onFiltro={setFiltro} />
          <div className={`${estilos.tabelaRolagem} ${estilos.tabelaLonga}`}>
            <table className="admTabela">
              <thead><tr><th>Código TUSS</th><th>Descrição (como veio na tabela)</th><th>Porte anestésico</th><th>Valor fixo</th></tr></thead>
              <tbody>{visiveis.slice(0, LIMITE_DA_TABELA).map(({ x }) => (
                <tr key={x.codigo}>
                  <td data-rotulo="Código TUSS" className={estilos.codigo}>{x.codigo}</td>
                  <td data-rotulo="Descrição" data-largo>{x.descricao || "—"}</td>
                  <td data-rotulo="Porte">{x.porte === "" ? "—" : rotuloDoPorte(Number(x.porte))}</td>
                  <td data-rotulo="Valor fixo" className={estilos.numero}>{x.valor === "" ? "—" : dinheiro(lerNumero(x.valor))}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <Mostrando visiveis={visiveis.length} total={tabela.length} />
        </>
      )}
      {linha.observacoes && <p className="admAjuda">Observações: {linha.observacoes}</p>}
      {dados.podeEditar && linha.situacao === "vigente" && (
        <div className={estilos.rodapeDoBloco}>
          <button type="button" className="outlineClinical compacto" onClick={() => setEncerrar(true)}>Encerrar versão</button>
        </div>
      )}
      {encerrar && (
        <Dialogo titulo={`Encerrar a versão ${linha.versao}?`} confirmar="Encerrar" ocupado={acao.ocupado} erro={acao.erro}
          onConfirmar={confirmar} onCancelar={() => setEncerrar(false)}>
          <p>Depois do último dia, as anestesias deste convênio ficam sem esta versão. O que já foi calculado com ela continua como está.</p>
          <label className="clinicalField"><span>Último dia de vigência</span>
            <input type="date" value={fim} min={linha.vigencia_inicio} onChange={(e) => setFim(e.target.value)} /></label>
        </Dialogo>
      )}
    </div>
  );
}

// ── Rascunho: as regras, os valores e o publicar ──────────────────────────

type Formulario = {
  inicio: string; fim: string; referencia: "cbhpm" | "propria"; edicao: string; reajuste: string;
  urgencia: string; multiplos: string; ajustes: Array<{ nome: string; tipo: Ajuste["tipo"]; valor: string; quando: Ajuste["quando"] }>;
  cumulativos: boolean; observacoes: string; portes: Record<number, string>; procedimentos: LinhaDaTabela[];
};

/** Uma linha da tabela do plano no formulário: o código, o porte que o plano dá e/ou um valor fixo. */
type LinhaDaTabela = { codigo: string; descricao: string; porte: string; valor: string };

const LIMITE_DA_TABELA = 100;

/** A tabela do plano desta versão, em ordem de código, com a descrição que veio no arquivo. */
function tabelaDoPlano(dados: DadosDasTabelas, versaoId: string, v: VersaoDeContrato): LinhaDaTabela[] {
  const descricao = new Map(dados.valoresPorProcedimento.filter((x) => x.versao_id === versaoId).map((x) => [x.tuss_codigo, x.descricao ?? ""]));
  const codigos = [...new Set([...Object.keys(v.valoresPorProcedimento), ...Object.keys(v.portesPorProcedimento)])].sort();
  return codigos.map((codigo) => ({
    codigo, descricao: descricao.get(codigo) ?? "",
    porte: v.portesPorProcedimento[codigo] != null ? String(v.portesPorProcedimento[codigo]) : "",
    valor: texto(v.valoresPorProcedimento[codigo]),
  }));
}

/** As linhas que a busca mostra, com a posição de cada uma. Linha nova (sem código) aparece sempre. */
function filtrar(linhas: LinhaDaTabela[], filtro: string) {
  const termo = nomeSimples(filtro);
  const digitos = filtro.replace(/\D/g, "");
  return linhas.map((x, i) => ({ x, i })).filter(({ x }) => !x.codigo || !termo
    || (digitos && x.codigo.includes(digitos)) || nomeSimples(x.descricao).includes(termo));
}

function BuscaNaTabela({ filtro, onFiltro }: { filtro: string; onFiltro: (f: string) => void }) {
  return (
    <label className="admBusca">
      <span className="sr-only">Buscar na tabela</span>
      <Icone nome="busca" tamanho={16} />
      <input type="search" value={filtro} onChange={(e) => onFiltro(e.target.value)} placeholder="Código ou parte da descrição" />
    </label>
  );
}

function Mostrando({ visiveis, total }: { visiveis: number; total: number }) {
  if (visiveis <= LIMITE_DA_TABELA && visiveis === total) return null;
  return (
    <p className="admTextoFraco">
      {visiveis > LIMITE_DA_TABELA ? `Mostrando ${LIMITE_DA_TABELA} de ${visiveis.toLocaleString("pt-BR")}. Busque para achar os demais.`
        : `${visiveis.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} na busca.`}
    </p>
  );
}

const texto = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

function formularioDe(dados: DadosDasTabelas, linha: LinhaVersao, v: VersaoDeContrato): Formulario {
  return {
    inicio: linha.vigencia_inicio, fim: linha.vigencia_fim ?? "", referencia: linha.referencia, edicao: linha.cbhpm_edicao_id ?? "",
    reajuste: texto(v.reajustePercentual), urgencia: texto(v.urgenciaPercentual),
    multiplos: v.multiplosPercentuais ? v.multiplosPercentuais.map(texto).join("; ") : "",
    ajustes: v.ajustes.map((a) => ({ nome: a.nome, tipo: a.tipo, valor: texto(a.valor), quando: a.quando })),
    cumulativos: v.ajustesCumulativos, observacoes: linha.observacoes ?? "",
    portes: Object.fromEntries(Object.entries(v.valoresPorPorte).map(([p, n]) => [Number(p), texto(n)])),
    procedimentos: tabelaDoPlano(dados, linha.id, v),
  };
}

/** O formulário lido como a versão que o cálculo usaria — para conferir antes de publicar. */
function versaoDoFormulario(f: Formulario, base: VersaoDeContrato): { versao: VersaoDeContrato; erros: string[] } {
  const erros: string[] = [];
  const num = (s: string, rotulo: string) => {
    const n = lerNumero(s);
    if (n !== null && !Number.isFinite(n)) erros.push(`${rotulo}: “${s}” não é número.`);
    return n !== null && Number.isFinite(n) ? n : null;
  };
  const multiplos = f.multiplos.trim() ? f.multiplos.split(/[;\s]+/).filter(Boolean).map((s) => num(s, "Procedimentos múltiplos") ?? NaN) : null;
  const portes: Partial<Record<number, number>> = {};
  for (const p of PORTES) { const n = num(f.portes[p] ?? "", rotuloDoPorte(p)); if (n !== null) portes[p] = n; }
  const procedimentos: Record<string, number> = {};
  const portesDoPlano: Record<string, Porte> = {};
  const vistos = new Set<string>();
  for (const x of f.procedimentos) {
    const codigo = x.codigo.replace(/\D/g, "");
    if (!codigo && !x.valor.trim() && !x.porte) continue;
    if (!codigo) { erros.push("Há linha da tabela sem código TUSS."); continue; }
    if (vistos.has(codigo)) erros.push(`Código ${codigo} repetido na tabela.`);
    vistos.add(codigo);
    const n = num(x.valor, `Procedimento ${codigo}`);
    if (n === null && !x.porte) { erros.push(`Código ${codigo} sem porte e sem valor.`); continue; }
    if (n !== null) procedimentos[codigo] = n;
    if (x.porte) portesDoPlano[codigo] = Number(x.porte) as Porte;
  }
  const versao: VersaoDeContrato = {
    ...base, vigenciaInicio: f.inicio, vigenciaFim: f.fim || null, referencia: f.referencia,
    cbhpmEdicaoId: f.referencia === "cbhpm" ? f.edicao || null : null,
    reajustePercentual: num(f.reajuste, "Reajuste") ?? 0, urgenciaPercentual: num(f.urgencia, "Urgência"),
    multiplosPercentuais: multiplos && multiplos.every(Number.isFinite) ? multiplos : multiplos ? [NaN] : null,
    ajustes: f.ajustes.map((a) => ({ nome: a.nome.trim(), tipo: a.tipo, valor: lerNumero(a.valor) ?? NaN, quando: a.quando })),
    ajustesCumulativos: f.cumulativos, valoresPorPorte: portes, valoresPorProcedimento: procedimentos,
    portesPorProcedimento: portesDoPlano,
  };
  return { versao, erros };
}

const chaveDaVersao = (v: VersaoDeContrato, observacoes: string) => JSON.stringify([
  v.vigenciaInicio, v.vigenciaFim, v.referencia, v.referencia === "cbhpm" ? v.cbhpmEdicaoId : null, v.reajustePercentual,
  v.urgenciaPercentual, v.multiplosPercentuais, v.ajustes.map((a) => [a.nome, a.tipo, a.valor, a.quando]), v.ajustesCumulativos,
  Object.entries(v.valoresPorPorte).sort(), Object.entries(v.valoresPorProcedimento).sort(),
  Object.entries(v.portesPorProcedimento).sort(), observacoes.trim(),
]);

function Rascunho({
  dados, linha, montada, onAtualizar, onApagada,
}: {
  dados: DadosDasTabelas;
  linha: LinhaVersao;
  montada: VersaoDeContrato;
  onAtualizar: () => void;
  onApagada: () => void;
}) {
  const [f, setF] = useState<Formulario>(() => formularioDe(dados, linha, montada));
  const [filtro, setFiltro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [confirmar, setConfirmar] = useState<"publicar" | "apagar" | null>(null);
  const [descricoes, setDescricoes] = useState<Map<string, string | null>>(new Map());
  const acao = useAcao();
  const { versao, erros } = versaoDoFormulario(f, montada);
  // Alterado é o que mudaria no banco, e não o texto: "600,00" e "600" são o mesmo valor.
  const alterado = erros.length > 0 || chaveDaVersao(versao, f.observacoes) !== chaveDaVersao(montada, linha.observacoes ?? "");
  const problemas = [...erros, ...problemasDaVersao(versao)];
  const vigenteTuss = dados.tuss.find((t) => t.situacao === "vigente");
  const mudar = (x: Partial<Formulario>) => { setF({ ...f, ...x }); setSalvo(false); };

  // A descrição oficial de cada código, e o aviso do que não está na TUSS em
  // uso. Cada código se pergunta uma vez só: a tabela de um plano passa de mil.
  const codigos = f.procedimentos.map((p) => p.codigo.replace(/\D/g, "")).filter(Boolean).join(",");
  const perguntados = useRef(new Set<string>());
  useEffect(() => {
    if (!vigenteTuss) return;
    const faltam = [...new Set(codigos.split(",").filter(Boolean))].filter((c) => !perguntados.current.has(c));
    if (!faltam.length) return;
    let valendo = true;
    const espera = setTimeout(async () => {
      for (const c of faltam) perguntados.current.add(c);
      const achados = new Map<string, string | null>(faltam.map((c) => [c, null]));
      for (const lote of emLotes(faltam, 200)) {
        const { data } = await createClient().from("tuss_codigos").select("codigo, descricao").eq("versao_id", vigenteTuss.id).in("codigo", lote);
        for (const c of (data ?? []) as Array<{ codigo: string; descricao: string }>) achados.set(c.codigo, c.descricao);
      }
      if (valendo) setDescricoes((antes) => new Map([...antes, ...achados]));
      else for (const c of faltam) perguntados.current.delete(c);
    }, 400);
    return () => { valendo = false; clearTimeout(espera); };
  }, [codigos, vigenteTuss]);

  async function salvar() {
    setSalvo(false);
    const ok = await acao.executar(async () => {
      if (erros.length) throw new Recusa(erros[0]);
      const supabase = createClient();
      exigir(await supabase.from("contrato_versoes").update({
        vigencia_inicio: versao.vigenciaInicio, vigencia_fim: versao.vigenciaFim, referencia: versao.referencia,
        cbhpm_edicao_id: versao.cbhpmEdicaoId, reajuste_percentual: versao.reajustePercentual,
        urgencia_percentual: versao.urgenciaPercentual, multiplos_percentuais: versao.multiplosPercentuais,
        ajustes: versao.ajustes, ajustes_cumulativos: versao.ajustesCumulativos, observacoes: f.observacoes.trim() || null,
      }).eq("id", linha.id));
      // Valores: o que saiu se apaga, o resto se grava por cima.
      const portes = Object.entries(versao.valoresPorPorte).map(([p, valor]) => ({ versao_id: linha.id, institution_id: dados.institutionId, porte: Number(p), valor }));
      const semPorte = PORTES.filter((p) => versao.valoresPorPorte[p] == null);
      if (portes.length) exigir(await supabase.from("contrato_valores_porte").upsert(portes, { onConflict: "versao_id,porte" }));
      if (semPorte.length) exigir(await supabase.from("contrato_valores_porte").delete().eq("versao_id", linha.id).in("porte", semPorte));
      const descricaoDe = new Map(f.procedimentos.map((x) => [x.codigo.replace(/\D/g, ""), x.descricao.trim() || null]));
      const naTabela = [...new Set([...Object.keys(versao.valoresPorProcedimento), ...Object.keys(versao.portesPorProcedimento)])];
      const novos = naTabela.map((tuss_codigo) => ({
        versao_id: linha.id, institution_id: dados.institutionId, tuss_codigo, descricao: descricaoDe.get(tuss_codigo) ?? null,
        porte_anestesico: versao.portesPorProcedimento[tuss_codigo] ?? null, valor: versao.valoresPorProcedimento[tuss_codigo] ?? null,
      }));
      const antes = [...new Set([...Object.keys(montada.valoresPorProcedimento), ...Object.keys(montada.portesPorProcedimento)])];
      const sairam = antes.filter((c) => !naTabela.includes(c));
      for (const lote of emLotes(sairam, 200)) exigir(await supabase.from("contrato_valores_procedimento").delete().eq("versao_id", linha.id).in("tuss_codigo", lote));
      for (const lote of emLotes(novos, 500)) exigir(await supabase.from("contrato_valores_procedimento").upsert(lote, { onConflict: "versao_id,tuss_codigo" }));
    });
    if (ok) { setSalvo(true); onAtualizar(); }
  }

  async function concluir() {
    const ok = await acao.executar(async () => {
      const supabase = createClient();
      if (confirmar === "publicar") {
        exigir(await supabase.from("contrato_versoes").update({ situacao: "vigente" }).eq("id", linha.id));
      } else {
        exigir(await supabase.from("contrato_valores_porte").delete().eq("versao_id", linha.id));
        exigir(await supabase.from("contrato_valores_procedimento").delete().eq("versao_id", linha.id));
        exigir(await supabase.from("contrato_versoes").delete().eq("id", linha.id));
      }
    });
    if (!ok) return;
    const era = confirmar;
    setConfirmar(null);
    if (era === "apagar") onApagada(); else onAtualizar();
  }

  const fora = vigenteTuss ? f.procedimentos.map((p) => p.codigo.replace(/\D/g, "")).filter((c) => c && descricoes.get(c) === null) : [];
  const visiveis = filtrar(f.procedimentos, filtro);

  return (
    <div className={estilos.bloco}>
      <fieldset className="admCampos">
        <legend className={estilos.legenda}>Vigência e referência</legend>
        <div className={estilos.camposEmLinha}>
          <label className="clinicalField obrigatorio"><span>Início da vigência</span>
            <input type="date" value={f.inicio} onChange={(e) => mudar({ inicio: e.target.value })} /></label>
          <label className="clinicalField"><span>Fim da vigência</span>
            <input type="date" value={f.fim} min={f.inicio} onChange={(e) => mudar({ fim: e.target.value })} /></label>
          <label className="clinicalField"><span>Os portes valem pela</span>
            <select value={f.referencia} onChange={(e) => mudar({ referencia: e.target.value as Formulario["referencia"] })}>
              <option value="cbhpm">CBHPM + reajuste</option>
              <option value="propria">Tabela própria</option>
            </select></label>
          {f.referencia === "cbhpm" && <>
            <label className="clinicalField obrigatorio"><span>Edição da CBHPM</span>
              <select value={f.edicao} onChange={(e) => mudar({ edicao: e.target.value })}>
                <option value="">Escolha</option>
                {dados.edicoes.map((e) => <option key={e.id} value={e.id}>{e.edicao}{e.situacao === "em_conferencia" ? " (em conferência)" : ""}</option>)}
              </select></label>
            <label className="clinicalField"><span>Reajuste sobre a CBHPM (%)</span>
              <input inputMode="decimal" value={f.reajuste} onChange={(e) => mudar({ reajuste: e.target.value })} placeholder="0" /></label>
          </>}
        </div>
        <p className="admAjuda">
          {f.referencia === "cbhpm"
            ? "Porte sem valor negociado abaixo usa o valor de referência da edição, com o reajuste."
            : "Só vale o que esta versão lista: porte ou procedimento fora da lista fica pendente."}
        </p>
      </fieldset>

      <fieldset className="admCampos">
        <legend className={estilos.legenda}>Urgência e procedimentos múltiplos</legend>
        <div className={estilos.camposEmLinha}>
          <label className="clinicalField"><span>Acréscimo de urgência (%)</span>
            <input inputMode="decimal" value={f.urgencia} onChange={(e) => mudar({ urgencia: e.target.value })} placeholder="Não prevê" /></label>
          <label className={`clinicalField ${estilos.campoLargo}`}><span>Múltiplos: % de cada procedimento, do maior para o menor</span>
            <input value={f.multiplos} onChange={(e) => mudar({ multiplos: e.target.value })} placeholder="Ex.: 100; 50 — vazio: não prevê" /></label>
        </div>
        <p className="admAjuda">Campo vazio quer dizer que o contrato não prevê: a anestesia de urgência, ou com mais de um procedimento, fica pendente em vez de ganhar um percentual suposto.</p>
      </fieldset>

      <fieldset className="admCampos">
        <legend className={estilos.legenda}>Adicionais e redutores</legend>
        {f.ajustes.length === 0 && <p className="admTextoFraco">Nenhum adicional ou redutor.</p>}
        {f.ajustes.map((a, i) => (
          <div key={i} className={estilos.camposEmLinha}>
            <label className={`clinicalField ${estilos.campoLargo}`}><span>Nome</span>
              <input value={a.nome} onChange={(e) => mudar({ ajustes: f.ajustes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x) })} placeholder="Ex.: Acréscimo noturno" /></label>
            <label className="clinicalField"><span>Tipo</span>
              <select value={a.tipo} onChange={(e) => mudar({ ajustes: f.ajustes.map((x, j) => j === i ? { ...x, tipo: e.target.value as Ajuste["tipo"] } : x) })}>
                <option value="percentual">Percentual (%)</option><option value="fixo">Valor fixo (R$)</option>
              </select></label>
            <label className="clinicalField"><span>{a.tipo === "percentual" ? "Percentual (− reduz)" : "Valor (− reduz)"}</span>
              <input inputMode="decimal" value={a.valor} onChange={(e) => mudar({ ajustes: f.ajustes.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) })} /></label>
            <label className="clinicalField"><span>Quando</span>
              <select value={a.quando} onChange={(e) => mudar({ ajustes: f.ajustes.map((x, j) => j === i ? { ...x, quando: e.target.value as Ajuste["quando"] } : x) })}>
                <option value="sempre">Sempre</option><option value="urgencia">Só na urgência</option>
              </select></label>
            <button type="button" className="outlineClinical compacto" onClick={() => mudar({ ajustes: f.ajustes.filter((_, j) => j !== i) })}>Remover</button>
          </div>
        ))}
        <div className={estilos.camposEmLinha}>
          <button type="button" className="outlineClinical compacto" onClick={() => mudar({ ajustes: [...f.ajustes, { nome: "", tipo: "percentual", valor: "", quando: "sempre" }] })}>
            Adicionar adicional ou redutor
          </button>
          {f.ajustes.length > 1 && (
            <label className="admFiltroMarca"><input type="checkbox" checked={f.cumulativos} onChange={(e) => mudar({ cumulativos: e.target.checked })} />
              <span>Um percentual sobre o outro (cumulativos)</span></label>
          )}
        </div>
      </fieldset>

      <fieldset className="admCampos">
        <legend className={estilos.legenda}>Valores por porte (R$)</legend>
        <div className={estilos.gradePortes}>
          {PORTES.map((p) => (
            <label key={p} className="clinicalField">
              <span>{rotuloDoPorte(p)}</span>
              <input inputMode="decimal" value={f.portes[p] ?? ""} placeholder="—"
                onChange={(e) => mudar({ portes: { ...f.portes, [p]: e.target.value } })} />
            </label>
          ))}
        </div>
        <p className="admAjuda">{f.referencia === "cbhpm"
          ? "Porte vazio usa o valor de referência da CBHPM, com o reajuste."
          : "Porte vazio fica sem valor: a anestesia com esse porte fica pendente."}</p>
      </fieldset>

      <fieldset className="admCampos">
        <legend className={estilos.legenda}>Tabela de procedimentos do plano {f.procedimentos.length > 0 && <span className="admContagem">{f.procedimentos.length.toLocaleString("pt-BR")}</span>}</legend>
        <p className="admAjuda">
          O porte anestésico que o plano dá a cada código vale antes da CBHPM. O valor fixo, quando houver, vence o valor do porte.
        </p>
        {f.procedimentos.length > 0 && <BuscaNaTabela filtro={filtro} onFiltro={setFiltro} />}
        {f.procedimentos.length > 0 && (
          <div className={`${estilos.tabelaRolagem} ${estilos.tabelaLonga}`}>
            <table className="admTabela">
              <thead><tr><th>Código TUSS</th><th>Descrição</th><th>Porte anestésico</th><th>Valor fixo (R$)</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {visiveis.slice(0, LIMITE_DA_TABELA).map(({ x, i }) => {
                  const codigo = x.codigo.replace(/\D/g, "");
                  const oficial = descricoes.get(codigo);
                  const trocar = (y: Partial<LinhaDaTabela>) => mudar({ procedimentos: f.procedimentos.map((z, j) => j === i ? { ...z, ...y } : z) });
                  return (
                    <tr key={i}>
                      <td data-rotulo="Código TUSS"><input className={estilos.celulaCampo} inputMode="numeric" aria-label="Código TUSS" value={x.codigo}
                        onChange={(e) => trocar({ codigo: e.target.value })} /></td>
                      <td data-rotulo="Descrição" data-largo>
                        {!codigo ? "—" : oficial === null ? <Etiqueta tom="perigo">Não está na TUSS em uso</Etiqueta> : oficial ?? (x.descricao || "…")}
                        {oficial && x.descricao && nomeSimples(x.descricao) !== nomeSimples(oficial) && (
                          <small className={estilos.linhaFraca}>Na tabela do plano: {x.descricao}</small>
                        )}
                      </td>
                      <td data-rotulo="Porte anestésico">
                        <select className={estilos.celulaCampo} aria-label={`Porte anestésico do ${codigo || "procedimento"}`} value={x.porte}
                          onChange={(e) => trocar({ porte: e.target.value })}>
                          <option value="">—</option>
                          {PORTES.map((p) => <option key={p} value={p}>{rotuloDoPorte(p)}</option>)}
                        </select>
                      </td>
                      <td data-rotulo="Valor fixo (R$)"><input className={estilos.celulaCampo} inputMode="decimal" aria-label={`Valor fixo do ${codigo || "procedimento"}`} value={x.valor}
                        placeholder="—" onChange={(e) => trocar({ valor: e.target.value })} /></td>
                      <td data-rotulo="Ações" className={estilos.acoesDaLinha}><button type="button" className="outlineClinical compacto"
                        onClick={() => mudar({ procedimentos: f.procedimentos.filter((_, j) => j !== i) })}>Remover</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Mostrando visiveis={visiveis.length} total={f.procedimentos.length} />
        <div className={estilos.camposEmLinha}>
          <button type="button" className="outlineClinical compacto"
            onClick={() => mudar({ procedimentos: [{ codigo: "", descricao: "", porte: "", valor: "" }, ...f.procedimentos] })}>
            Adicionar procedimento
          </button>
        </div>
        {fora.length > 0 && <Aviso tom="atencao">{fora.length === 1 ? `O código ${fora[0]} não está` : `${fora.length.toLocaleString("pt-BR")} códigos não estão`} na TUSS em uso: o cálculo deixa pendente.</Aviso>}
      </fieldset>

      <label className="clinicalField"><span>Observações</span>
        <input value={f.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} placeholder="Número do aditivo, quem negociou, etc." /></label>

      {/* Verde só quando não sobra nada: alteração sem salvar ou código fora
          da TUSS ainda são avisos, mesmo que não impeçam publicar. */}
      <div className={problemas.length || alterado || fora.length ? estilos.conferencia : `${estilos.conferencia} ${estilos.conferenciaOk}`} aria-live="polite">
        <Icone nome={problemas.length || fora.length ? "alerta" : alterado ? "relogio" : "confirmado"} tamanho={16} />
        {problemas.length ? (
          <div><strong>Antes de publicar</strong><ul>{problemas.map((p) => <li key={p}>{p}</li>)}</ul></div>
        ) : alterado ? (
          <strong>Há alterações sem salvar: salve o rascunho para publicar.</strong>
        ) : fora.length ? (
          <div>
            <strong>Pode publicar, com ressalva.</strong>
            <p>{fora.length === 1 ? "1 código não está" : `${fora.length.toLocaleString("pt-BR")} códigos não estão`} na TUSS em uso: as anestesias com {fora.length === 1 ? "ele ficam" : "eles ficam"} pendentes.</p>
          </div>
        ) : <strong>Pronta para publicar.</strong>}
      </div>

      {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
      <div className={estilos.rodapeDoBloco}>
        <button type="button" className="outlineClinical compacto" onClick={() => setConfirmar("apagar")} disabled={acao.ocupado}>Apagar rascunho</button>
        {salvo && !alterado && <span className={estilos.salvo} role="status"><Icone nome="confirmado" tamanho={15} />Rascunho salvo</span>}
        <button type="button" className="outlineClinical" onClick={salvar} disabled={acao.ocupado || !alterado}>
          {acao.ocupado ? "Salvando…" : "Salvar rascunho"}
        </button>
        <button type="button" className="primaryClinical compact" onClick={() => setConfirmar("publicar")}
          disabled={acao.ocupado || alterado || problemas.length > 0}
          title={alterado ? "Salve o rascunho antes de publicar" : problemas.length ? "Resolva o que falta antes de publicar" : undefined}>
          Publicar versão
        </button>
      </div>

      {confirmar && (
        <Dialogo titulo={confirmar === "publicar" ? `Publicar a versão ${linha.versao}?` : `Apagar o rascunho da versão ${linha.versao}?`}
          confirmar={confirmar === "publicar" ? "Publicar" : "Apagar"} perigo={confirmar === "apagar"}
          ocupado={acao.ocupado} erro={acao.erro} onConfirmar={concluir} onCancelar={() => setConfirmar(null)}>
          {confirmar === "publicar" ? <>
            <p>A partir de {dataBr(f.inicio)}, os cálculos deste convênio usam estas regras e estes valores.</p>
            <p>Publicada, a versão não muda: o reajuste seguinte é outra versão. Se houver outra versão publicada no mesmo período, o banco recusa.</p>
          </> : <p>O rascunho e os valores dele são apagados. Versões publicadas não mudam.</p>}
        </Dialogo>
      )}
    </div>
  );
}

// ── Cadastros ─────────────────────────────────────────────────────────────

function NovoConvenio({ dados, onFechar, onCriado }: { dados: DadosDasTabelas; onFechar: () => void; onCriado: () => void }) {
  const [nome, setNome] = useState("");
  const [particular, setParticular] = useState(false);
  const acao = useAcao();
  async function criar() {
    const ok = await acao.executar(async () => {
      if (!nome.trim()) throw new Recusa("Informe o nome do convênio.");
      exigir(await createClient().from("operadoras").insert({ institution_id: dados.institutionId, nome: nome.trim(), particular }));
    });
    if (ok) onCriado();
  }
  return (
    <Gaveta titulo="Novo plano de saúde" onPedirFechar={onFechar}
      rodape={<>
        <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
        <button type="button" className="primaryClinical compact" onClick={criar} disabled={acao.ocupado}>{acao.ocupado ? "Salvando…" : "Cadastrar"}</button>
      </>}>
      <div className="admCampos">
        <label className="clinicalField obrigatorio"><span>Nome do convênio</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como aparece na Produção" /></label>
        <p className="admAjuda">O cálculo acha o contrato pelo nome do convênio da Produção, sem diferenciar maiúsculas e acentos.</p>
        <label className="admFiltroMarca"><input type="checkbox" checked={particular} onChange={(e) => setParticular(e.target.checked)} />
          <span>Particular (sem operadora)</span></label>
        {acao.erro && <p className="clinicalError" role="alert">{acao.erro === "Já existe um cadastro igual a este." ? "Já existe um convênio com este nome." : acao.erro}</p>}
      </div>
    </Gaveta>
  );
}

function NovoContrato({
  dados, operadora, onFechar, onCriado,
}: { dados: DadosDasTabelas; operadora: LinhaOperadora; onFechar: () => void; onCriado: (id: string) => void }) {
  const [identificacao, setIdentificacao] = useState("Contrato geral");
  const [local, setLocal] = useState("");
  const acao = useAcao();
  async function criar() {
    await acao.executar(async () => {
      if (!identificacao.trim()) throw new Recusa("Dê um nome ao contrato (ex.: Contrato geral, Aditivo 2026).");
      const r = exigir(await createClient().from("contratos").insert({
        institution_id: dados.institutionId, operadora_id: operadora.id, identificacao: identificacao.trim(), local_id: local || null,
      }).select("id").single()) as { id: string };
      onCriado(r.id);
    });
  }
  return (
    <Gaveta titulo={`Novo contrato · ${operadora.nome}`} subtitulo="As regras e os valores entram na versão do contrato, depois." onPedirFechar={onFechar}
      rodape={<>
        <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
        <button type="button" className="primaryClinical compact" onClick={criar} disabled={acao.ocupado}>{acao.ocupado ? "Salvando…" : "Cadastrar"}</button>
      </>}>
      <div className="admCampos">
        <label className="clinicalField obrigatorio"><span>Identificação</span>
          <input value={identificacao} onChange={(e) => setIdentificacao(e.target.value)} /></label>
        <label className="clinicalField"><span>Hospital</span>
          <select value={local} onChange={(e) => setLocal(e.target.value)}>
            <option value="">Todos os hospitais</option>
            {dados.locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select></label>
        <p className="admAjuda">Contrato de um hospital vence o contrato geral do mesmo convênio nas anestesias daquele hospital.</p>
        {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
      </div>
    </Gaveta>
  );
}
