"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { gradeDoCsv } from "@/lib/centro-importar";
import {
  compararVersoes, impressaoDigital, lerCbhpm, lerCorrespondencias, lerDasAbas, lerPortesDeReferencia, lerTabelaTuss,
  lerTabelaDoPlano, situacaoDoCodigo, type ComparacaoDeVersoes, type ItemDaTabelaDoPlano, type Leitura,
} from "@/lib/importar-tabelas";
import { nomeSimples } from "@/lib/honorarios";
import { emLotes, lerEmPaginas, rotuloDoPorte, versaoDoNome, type Area } from "@/lib/honorarios-telas";
import { abasDoXlsx } from "@/lib/xlsx-leitura";
import { Aviso, Recusa, Vazio, dataBr, dataHoraBr, dinheiro, exigir, mensagemDoBanco } from "./comum";
import { criarRascunho, rascunhoDoContrato } from "./rascunho";
import type { DadosDasTabelas } from "./tipos";
import estilos from "./honorarios.module.css";

export type TipoDeImportacao = "tuss" | "cbhpm" | "cbhpm_portes" | "contrato" | "correspondencia";
/** Na tabela do plano, o destino é o contrato (ou "novo"); nas da CBHPM, a edição. */
export type PedidoDeImportacao = { tipo: TipoDeImportacao; destinoId?: string };

const TIPOS: Array<{ id: TipoDeImportacao; rotulo: string; ajuda: string; colunas: string }> = [
  { id: "tuss", rotulo: "TUSS — Tabela 22 da ANS", ajuda: "O arquivo oficial da ANS. Entra como versão em conferência; o cálculo só usa depois de publicada.",
    colunas: "Código do Termo, Termo, Data de início de vigência, Data de fim de vigência, Data de fim de implantação" },
  { id: "contrato", rotulo: "Tabela de um plano de saúde", ajuda: "A tabela que o plano manda: o código TUSS com o porte anestésico do plano e/ou o valor, e o valor de cada porte. Entra num rascunho do contrato, para conferir antes de publicar.",
    colunas: "Código TUSS, Descrição, Porte anestésico e Valor — o código com o porte e/ou o valor; ou só o porte (AN0 a AN8) com o valor dele" },
  { id: "cbhpm", rotulo: "CBHPM — procedimentos e porte anestésico", ajuda: "Do arquivo que a clínica licenciou, para uma edição em conferência.",
    colunas: "Código, Procedimento (descrição), Porte anestésico (AN0 a AN8; vazio quando não tem)" },
  { id: "cbhpm_portes", rotulo: "CBHPM — valor de referência dos portes", ajuda: "O valor de cada porte AN0 a AN8, para uma edição em conferência.",
    colunas: "Porte, Valor" },
  { id: "correspondencia", rotulo: "Correspondência TUSS ↔ CBHPM", ajuda: "Entram como propostas: só valem no cálculo depois de validadas uma a uma.",
    colunas: "Código TUSS, Código CBHPM" },
];

const TIPO_NO_BANCO: Record<TipoDeImportacao, "tuss" | "cbhpm" | "contrato" | "correspondencia"> = {
  tuss: "tuss", cbhpm: "cbhpm", cbhpm_portes: "cbhpm", contrato: "contrato", correspondencia: "correspondencia",
};

type Previa = {
  arquivo: File; aba: string; hash: string; leitura: Leitura<unknown>;
  jaImportado: { em: string } | null; comparacao: ComparacaoDeVersoes | null;
};

/**
 * Importar um arquivo: escolher o que é e para onde vai, ler no próprio
 * aparelho, conferir a prévia linha a linha e só então gravar. O arquivo
 * fica guardado (bucket privado) com a impressão digital, e a importação
 * fica no histórico — com as linhas que deram erro e o porquê.
 */
export function AreaImportar({
  dados, pedido, onAtualizar, onAbrir,
}: {
  dados: DadosDasTabelas;
  pedido: PedidoDeImportacao | null;
  onAtualizar: () => void;
  onAbrir: (a: Area) => void;
}) {
  const tipos = TIPOS.filter((t) => t.id !== "tuss" || dados.superAdmin);
  const [tipo, setTipo] = useState<TipoDeImportacao>(pedido?.tipo ?? "contrato");
  const [destino, setDestino] = useState(pedido?.destinoId ?? "");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState<{ feitos: number; total: number } | null>(null);
  const [pronto, setPronto] = useState<{ texto: string; area: Area } | null>(null);
  // Só da TUSS: a versão, a data da ANS e a origem.
  const [tussVersao, setTussVersao] = useState("");
  const [tussData, setTussData] = useState("");
  const [tussOrigem, setTussOrigem] = useState("ANS — Padrão TISS, Representação de Conceitos em Saúde (Tabela 22)");
  // Só dos portes de referência: a partir de quando e de onde.
  const [portesInicio, setPortesInicio] = useState("");
  const [portesFonte, setPortesFonte] = useState("");
  // Só da tabela do plano: o nome do plano novo e se a tabela substitui a do rascunho.
  const [novoPlano, setNovoPlano] = useState("");
  const [substituir, setSubstituir] = useState(true);

  const destinos = destinosDo(tipo, dados);
  const destinoValido = tipo === "tuss" || (destinos.some((d) => d.id === destino) && (destino !== "novo" || novoPlano.trim().length > 1));

  function trocarTipo(t: TipoDeImportacao) {
    setTipo(t);
    setDestino(destinosDo(t, dados)[0]?.id ?? "");
    setPrevia(null);
    setErro("");
    setPronto(null);
  }

  async function ler(arquivo: File) {
    setLendo(true);
    setErro("");
    setPrevia(null);
    setPronto(null);
    try {
      const bytes = await arquivo.arrayBuffer();
      const ext = arquivo.name.toLowerCase().split(".").pop();
      let abas: Array<{ nome: string; grade: string[][] }>;
      if (ext === "xlsx") abas = await abasDoXlsx(bytes);
      else if (ext === "csv" || arquivo.type === "text/csv") abas = [{ nome: "", grade: gradeDoCsv(textoDoCsv(bytes)) }];
      else if (ext === "xls") throw new Recusa("Esta é a planilha antiga (.xls). No Excel, use “Salvar como” .xlsx e envie de novo.");
      else throw new Recusa("Envie a planilha (.xlsx) ou o arquivo .csv.");
      const leitor = LEITOR[tipo];
      const leitura = lerDasAbas(abas, leitor);
      const hash = await impressaoDigital(bytes);
      const supabase = createClient();
      let jaQuery = supabase.from("importacoes_tabelas").select("created_at")
        .eq("tipo", TIPO_NO_BANCO[tipo]).eq("arquivo_sha256", hash).eq("situacao", "aplicada");
      jaQuery = tipo === "tuss" ? jaQuery.is("institution_id", null) : jaQuery.eq("institution_id", dados.institutionId);
      const { data: ja } = await jaQuery.limit(1);
      let comparacao: ComparacaoDeVersoes | null = null;
      if (tipo === "tuss" && leitura.itens.length) {
        const vigente = dados.tuss.find((t) => t.situacao === "vigente");
        const anterior = new Map<string, { descricao: string; fimVigencia: string | null }>();
        if (vigente) {
          const { linhas, erro: e } = await lerEmPaginas<{ codigo: string; descricao: string; fim_vigencia: string | null }>((de, ate) =>
            supabase.from("tuss_codigos").select("codigo, descricao, fim_vigencia").eq("versao_id", vigente.id).order("codigo").range(de, ate));
          if (e) throw e;
          for (const l of linhas) anterior.set(l.codigo, { descricao: l.descricao, fimVigencia: l.fim_vigencia });
        }
        comparacao = compararVersoes(anterior, leitura.itens as Parameters<typeof compararVersoes>[1]);
        setTussVersao(versaoDoNome(arquivo.name, leitura.aba) ?? "");
      }
      if (tipo === "cbhpm_portes") {
        const ed = dados.edicoes.find((e) => e.id === destino);
        setPortesInicio(ed?.vigencia_inicio ?? dados.hoje);
        setPortesFonte(ed?.fonte ?? "");
      }
      setPrevia({
        arquivo, aba: leitura.aba, hash, leitura,
        jaImportado: ja && ja[0] ? { em: (ja[0] as { created_at: string }).created_at } : null, comparacao,
      });
    } catch (e) {
      setErro(e instanceof Recusa || e instanceof Error ? e.message : mensagemDoBanco(e, "Não foi possível ler o arquivo."));
    } finally {
      setLendo(false);
    }
  }

  async function gravar() {
    if (!previa) return;
    setErro("");
    const supabase = createClient();
    const itens = previa.leitura.itens;
    let importacaoId: string | null = null;
    try {
      if (tipo === "tuss") {
        if (!/^\S.{0,30}$/.test(tussVersao.trim())) throw new Recusa("Informe a versão da TUSS (ex.: 202609).");
        if (dados.tuss.some((t) => t.versao === tussVersao.trim())) throw new Recusa(`A versão ${tussVersao.trim()} já foi importada.`);
        if (!tussOrigem.trim()) throw new Recusa("Informe a origem do arquivo.");
      }
      if (tipo === "contrato" && destino === "novo" && dados.operadoras.some((o) => nomeSimples(o.nome) === nomeSimples(novoPlano))) {
        throw new Recusa(`Já existe o plano “${novoPlano.trim()}”: escolha-o na lista.`);
      }
      if (tipo === "cbhpm_portes" && (!/^\d{4}-\d{2}-\d{2}$/.test(portesInicio) || !portesFonte.trim())) {
        throw new Recusa("Informe a partir de quando valem os valores e de onde eles vêm.");
      }
      setGravando({ feitos: 0, total: itens.length });
      const { data: { user } } = await supabase.auth.getUser();

      // 1. O arquivo, guardado como veio. O mesmo arquivo já guardado não é erro.
      const nomeLimpo = previa.arquivo.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
      const caminho = `${tipo === "tuss" ? "tuss" : `${dados.institutionId}/${tipo}`}/${previa.hash.slice(0, 16)}-${nomeLimpo}`;
      const envio = await supabase.storage.from("tabelas-honorarios").upload(caminho, previa.arquivo, { upsert: false });
      if (envio.error && !/exists|duplicate/i.test(envio.error.message)) throw envio.error;

      // 2. O registro da importação, com os erros da prévia.
      const registro = exigir(await supabase.from("importacoes_tabelas").insert({
        institution_id: tipo === "tuss" ? null : dados.institutionId, tipo: TIPO_NO_BANCO[tipo],
        arquivo_nome: previa.arquivo.name, arquivo_sha256: previa.hash, arquivo_caminho: caminho,
        origem: tipo === "tuss" ? tussOrigem.trim() : tipo === "cbhpm_portes" ? `portes de referência · ${portesFonte.trim()}` : previa.aba || null,
        linhas_total: previa.leitura.total, linhas_validas: itens.length, erros: previa.leitura.erros.slice(0, 500), situacao: "previa",
      }).select("id").single()) as { id: string };
      importacaoId = registro.id;

      // 3. As linhas, em lotes.
      let destinoId = destino;
      const avancar = (n: number) => setGravando((g) => g && { ...g, feitos: Math.min(g.total, g.feitos + n) });
      if (tipo === "tuss") {
        const versao = exigir(await supabase.from("tuss_versoes").insert({
          tabela: "22", versao: tussVersao.trim(), publicada_em: tussData || null, origem: tussOrigem.trim(),
          arquivo_nome: previa.arquivo.name, arquivo_sha256: previa.hash, arquivo_caminho: caminho,
          total_codigos: itens.length, importada_por: user?.id ?? null,
        }).select("id").single()) as { id: string };
        destinoId = versao.id;
        const linhas = (itens as Array<Parameters<typeof situacaoDoCodigo>[0] & { codigo: string; descricao: string; inicioVigencia: string | null; fimImplantacao: string | null }>)
          .map((c) => ({
            versao_id: versao.id, codigo: c.codigo, descricao: c.descricao, inicio_vigencia: c.inicioVigencia,
            fim_vigencia: c.fimVigencia, fim_implantacao: c.fimImplantacao, situacao: situacaoDoCodigo(c, dados.hoje),
          }));
        for (const lote of emLotes(linhas, 1000)) { exigir(await supabase.from("tuss_codigos").insert(lote)); avancar(lote.length); }
      } else if (tipo === "cbhpm") {
        const linhas = (itens as Array<{ codigo: string; descricao: string; porte: number | null }>).map((p) => ({
          edicao_id: destino, institution_id: dados.institutionId, codigo: p.codigo, descricao: p.descricao, porte_anestesico: p.porte,
        }));
        for (const lote of emLotes(linhas, 1000)) {
          exigir(await supabase.from("cbhpm_procedimentos").upsert(lote, { onConflict: "edicao_id,codigo" }));
          avancar(lote.length);
        }
        exigir(await supabase.from("cbhpm_edicoes").update({ arquivo_nome: previa.arquivo.name, arquivo_sha256: previa.hash, arquivo_caminho: caminho }).eq("id", destino));
      } else if (tipo === "cbhpm_portes") {
        const linhas = (itens as Array<{ porte: number; valor: number }>).map((p) => ({
          edicao_id: destino, institution_id: dados.institutionId, porte: p.porte, valor_referencia: p.valor, unidade: "R$",
          vigencia_inicio: portesInicio, fonte: portesFonte.trim(),
        }));
        exigir(await supabase.from("cbhpm_portes").upsert(linhas, { onConflict: "edicao_id,porte,vigencia_inicio" }));
        avancar(linhas.length);
      } else if (tipo === "contrato") {
        const lidos = itens as ItemDaTabelaDoPlano[];
        // Plano novo: o plano e o contrato geral dele. Depois, sempre um
        // rascunho — o que já existe, ou o próximo, copiado da última versão.
        let contratoId = destino;
        if (destino === "novo") {
          const op = exigir(await supabase.from("operadoras").insert({ institution_id: dados.institutionId, nome: novoPlano.trim() })
            .select("id").single()) as { id: string };
          const ct = exigir(await supabase.from("contratos").insert({ institution_id: dados.institutionId, operadora_id: op.id, identificacao: "Contrato geral" })
            .select("id").single()) as { id: string };
          contratoId = ct.id;
        }
        const temValores = lidos.some((x) => x.tipo === "porte" || x.valor != null);
        const versaoId = rascunhoDoContrato(dados, contratoId)?.id
          ?? await criarRascunho(supabase, dados, contratoId, temValores ? "propria" : undefined);
        destinoId = versaoId;
        const porte = lidos.flatMap((x) => x.tipo === "porte" ? [{ versao_id: versaoId, institution_id: dados.institutionId, porte: x.porte, valor: x.valor }] : []);
        const proc = lidos.flatMap((x) => x.tipo === "procedimento" ? [{
          versao_id: versaoId, institution_id: dados.institutionId, tuss_codigo: x.tussCodigo,
          descricao: x.descricao, porte_anestesico: x.porte, valor: x.valor,
        }] : []);
        if (porte.length) { exigir(await supabase.from("contrato_valores_porte").upsert(porte, { onConflict: "versao_id,porte" })); avancar(porte.length); }
        // A tabela nova do plano substitui a do rascunho: o código que o plano
        // tirou não fica para trás, copiado da versão anterior.
        if (substituir && proc.length) exigir(await supabase.from("contrato_valores_procedimento").delete().eq("versao_id", versaoId));
        for (const lote of emLotes(proc, 500)) {
          exigir(await supabase.from("contrato_valores_procedimento").upsert(lote, { onConflict: "versao_id,tuss_codigo" }));
          avancar(lote.length);
        }
      } else if (tipo === "correspondencia") {
        // O par que já existe (proposto ou validado) não entra de novo.
        const { linhas: existentes } = await lerEmPaginas<{ tuss_codigo: string; cbhpm_codigo: string }>((de, ate) =>
          supabase.from("tuss_cbhpm_correspondencias").select("tuss_codigo, cbhpm_codigo").eq("cbhpm_edicao_id", destino)
            .neq("situacao", "revogada").order("id").range(de, ate));
        const ja = new Set(existentes.map((e) => `${e.tuss_codigo}|${e.cbhpm_codigo}`));
        const vigenteTuss = dados.tuss.find((t) => t.situacao === "vigente");
        const linhas = (itens as Array<{ tussCodigo: string; cbhpmCodigo: string }>)
          .filter((c) => !ja.has(`${c.tussCodigo}|${c.cbhpmCodigo}`))
          .map((c) => ({
            institution_id: dados.institutionId, tuss_codigo: c.tussCodigo, tuss_versao_id: vigenteTuss?.id ?? null,
            cbhpm_edicao_id: destino, cbhpm_codigo: c.cbhpmCodigo, situacao: "proposta", origem: `arquivo ${previa.arquivo.name}`.slice(0, 200),
          }));
        avancar(itens.length - linhas.length);
        for (const lote of emLotes(linhas, 500)) { exigir(await supabase.from("tuss_cbhpm_correspondencias").insert(lote)); avancar(lote.length); }
      }

      // 4. Aplicada.
      exigir(await supabase.from("importacoes_tabelas").update({ situacao: "aplicada", destino_id: destinoId || null, aplicada_em: new Date().toISOString() })
        .eq("id", registro.id));
      setPronto(mensagemDePronto(tipo, itens.length, tussVersao.trim()));
      setPrevia(null);
      onAtualizar();
    } catch (e) {
      setErro(e instanceof Recusa ? e.message : `${mensagemDoBanco(e, "A importação não terminou.")} Nada foi dado como aplicado.${
        tipo === "tuss" && importacaoId ? " Se a versão chegou a ser criada, descarte-a na Consulta TUSS e importe de novo." : ""}`);
      if (importacaoId) await supabase.from("importacoes_tabelas").update({ situacao: "descartada" }).eq("id", importacaoId);
    } finally {
      setGravando(null);
    }
  }

  const info = TIPOS.find((t) => t.id === tipo)!;
  const podeGravar = previa && !previa.jaImportado && previa.leitura.itens.length > 0 && destinoValido && !gravando;

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Importar arquivo"
        descricao="O arquivo é lido no seu aparelho. Nada é gravado antes de você conferir a prévia." />

      {!dados.podeEditar && !dados.superAdmin ? (
        <Vazio titulo="Sem permissão para importar.">Quem importa é quem tem o Financeiro da organização.</Vazio>
      ) : (
        <>
          <fieldset className={estilos.tipos}>
            <legend className={estilos.legenda}>O que você vai importar</legend>
            <div className={estilos.tiposGrade}>
            {tipos.map((t) => (
              <label key={t.id} className={`${estilos.tipo}${tipo === t.id ? ` ${estilos.tipoAtivo}` : ""}`}>
                <input type="radio" name="tipo-importacao" checked={tipo === t.id} onChange={() => trocarTipo(t.id)} disabled={!!gravando} />
                <span><strong>{t.rotulo}</strong><small>{t.ajuda}</small></span>
              </label>
            ))}
            </div>
          </fieldset>

          {tipo !== "tuss" && (
            destinos.length === 0 ? (
              <Aviso tom="atencao">{SEM_DESTINO[tipo]}</Aviso>
            ) : (
              <label className={`clinicalField ${estilos.campoMedio}`}>
                <span>{tipo === "contrato" ? "Plano de saúde" : "Edição da CBHPM"}</span>
                <select value={destino} onChange={(e) => { setDestino(e.target.value); setPrevia(null); }} disabled={!!gravando}>
                  <option value="">Escolha</option>
                  {destinos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </label>
            )
          )}
          {tipo === "contrato" && destino === "novo" && (
            <label className={`clinicalField obrigatorio ${estilos.campoMedio}`}>
              <span>Nome do plano</span>
              <input value={novoPlano} onChange={(e) => setNovoPlano(e.target.value)} placeholder="Como aparece na Produção (ex.: Unimed)" disabled={!!gravando} />
            </label>
          )}
          {tipo === "contrato" && destino && destino !== "novo" && (
            <label className="admFiltroMarca">
              <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} disabled={!!gravando} />
              <span>Substituir a tabela de procedimentos do rascunho pela do arquivo (o código que não vier no arquivo sai do rascunho)</span>
            </label>
          )}

          <div className={estilos.arquivo}>
            <p className="admAjuda">Colunas que o arquivo precisa ter, em qualquer ordem: <strong>{info.colunas}</strong>.</p>
            <label className={`outlineClinical ${estilos.botaoArquivo}${!destinoValido || gravando ? ` ${estilos.desligado}` : ""}`}>
              <Icone nome="enviar" tamanho={16} />
              {lendo ? "Lendo o arquivo…" : previa ? "Escolher outro arquivo" : "Escolher arquivo (.xlsx ou .csv)"}
              <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" disabled={!destinoValido || lendo || !!gravando}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void ler(f); }} />
            </label>
          </div>

          {erro && <p className="clinicalError" role="alert">{erro}</p>}

          {pronto && (
            <div className={`${estilos.conferencia} ${estilos.conferenciaOk}`} role="status">
              <Icone nome="confirmado" tamanho={16} />
              <div>
                <strong>{pronto.texto}</strong>
                <div className={estilos.acoesDaLinha}>
                  <button type="button" className="outlineClinical compacto" onClick={() => onAbrir(pronto.area)}>Abrir</button>
                </div>
              </div>
            </div>
          )}

          {previa && (
            <PreviaDaImportacao previa={previa} tipo={tipo}>
              {tipo === "tuss" && (
                <div className={estilos.camposEmLinha}>
                  <label className="clinicalField obrigatorio"><span>Versão</span>
                    <input value={tussVersao} onChange={(e) => setTussVersao(e.target.value)} placeholder="Ex.: 202609" /></label>
                  <label className="clinicalField"><span>Publicada pela ANS em</span>
                    <input type="date" value={tussData} onChange={(e) => setTussData(e.target.value)} /></label>
                  <label className={`clinicalField ${estilos.campoLargo}`}><span>Origem</span>
                    <input value={tussOrigem} onChange={(e) => setTussOrigem(e.target.value)} /></label>
                </div>
              )}
              {tipo === "cbhpm_portes" && (
                <div className={estilos.camposEmLinha}>
                  <label className="clinicalField obrigatorio"><span>Valores a partir de</span>
                    <input type="date" value={portesInicio} onChange={(e) => setPortesInicio(e.target.value)} /></label>
                  <label className={`clinicalField obrigatorio ${estilos.campoLargo}`}><span>Fonte dos valores</span>
                    <input value={portesFonte} onChange={(e) => setPortesFonte(e.target.value)} /></label>
                </div>
              )}
              {gravando && (
                <div className={estilos.progresso} role="status">
                  <span>Gravando {gravando.feitos.toLocaleString("pt-BR")} de {gravando.total.toLocaleString("pt-BR")}…</span>
                  <progress value={gravando.feitos} max={Math.max(1, gravando.total)} />
                </div>
              )}
              <div className={estilos.rodapeDoBloco}>
                <button type="button" className="outlineClinical" onClick={() => setPrevia(null)} disabled={!!gravando}>Descartar prévia</button>
                <button type="button" className="primaryClinical compact" onClick={gravar} disabled={!podeGravar}>
                  {gravando ? "Gravando…" : `Importar ${previa.leitura.itens.length.toLocaleString("pt-BR")} ${previa.leitura.itens.length === 1 ? "linha" : "linhas"}`}
                </button>
              </div>
            </PreviaDaImportacao>
          )}
        </>
      )}
    </section>
  );
}

const LEITOR: Record<TipoDeImportacao, (g: string[][]) => Leitura<unknown>> = {
  tuss: lerTabelaTuss, cbhpm: lerCbhpm, cbhpm_portes: lerPortesDeReferencia, contrato: lerTabelaDoPlano, correspondencia: lerCorrespondencias,
};

const SEM_DESTINO: Record<Exclude<TipoDeImportacao, "tuss">, string> = {
  cbhpm: "Crie uma edição da CBHPM (área CBHPM e portes): os procedimentos entram numa edição em conferência.",
  cbhpm_portes: "Crie uma edição da CBHPM (área CBHPM e portes): os valores entram numa edição em conferência.",
  contrato: "Escolha o plano de saúde, ou “Novo plano de saúde”.",
  correspondencia: "Crie uma edição da CBHPM antes: cada correspondência liga um código TUSS a um código de uma edição.",
};

function destinosDo(tipo: TipoDeImportacao, dados: DadosDasTabelas): Array<{ id: string; nome: string }> {
  if (tipo === "cbhpm" || tipo === "cbhpm_portes") {
    return dados.edicoes.filter((e) => e.situacao === "em_conferencia").map((e) => ({ id: e.id, nome: `${e.nome} ${e.edicao}` }));
  }
  if (tipo === "correspondencia") return dados.edicoes.map((e) => ({ id: e.id, nome: `${e.nome} ${e.edicao}` }));
  if (tipo === "contrato") {
    const operadora = new Map(dados.operadoras.map((o) => [o.id, o.nome]));
    const local = new Map(dados.locais.map((l) => [l.id, l.nome]));
    const planos = dados.contratos.filter((c) => c.ativo).map((c) => {
      const rascunho = rascunhoDoContrato(dados, c.id);
      const versoes = dados.versoes.filter((v) => v.contrato_id === c.id).length;
      return {
        id: c.id,
        nome: `${operadora.get(c.operadora_id) ?? ""} · ${c.identificacao}${c.local_id ? ` (${local.get(c.local_id) ?? "hospital"})` : ""} — ${
          rascunho ? `no rascunho da versão ${rascunho.versao}` : `cria a versão ${versoes + 1} em rascunho`}`,
      };
    }).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
    return [...planos, { id: "novo", nome: "Novo plano de saúde…" }];
  }
  return [];
}

function mensagemDePronto(tipo: TipoDeImportacao, n: number, versao: string): { texto: string; area: Area } {
  const q = n.toLocaleString("pt-BR");
  if (tipo === "tuss") return { texto: `TUSS ${versao} importada com ${q} códigos, em conferência. Confira e publique na Consulta TUSS.`, area: "tuss" };
  if (tipo === "cbhpm") return { texto: `${q} procedimentos gravados na edição.`, area: "cbhpm" };
  if (tipo === "cbhpm_portes") return { texto: `${q} valores de porte gravados na edição.`, area: "cbhpm" };
  if (tipo === "contrato") return { texto: `${q} linhas da tabela do plano gravadas no rascunho do contrato. Confira e publique em Planos de saúde.`, area: "contratos" };
  return { texto: `${q} linhas lidas; as novas entraram como propostas, para validar uma a uma.`, area: "cbhpm" };
}

/** CSV do Excel no Windows vem em Latin-1: sem isso, "Código" vira "CÃ³digo". */
function textoDoCsv(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8.replace(/^﻿/, "");
}

function PreviaDaImportacao({ previa, tipo, children }: { previa: Previa; tipo: TipoDeImportacao; children: React.ReactNode }) {
  const { leitura } = previa;
  const amostra = leitura.itens.slice(0, 8);
  return (
    <article className={estilos.painel} aria-label="Prévia da importação">
      <header className={estilos.painelTopo}>
        <div>
          <h3>Prévia · {previa.arquivo.name}</h3>
          <p>
            {previa.aba ? `Aba “${previa.aba}” · ` : ""}Título na linha {leitura.linhaDoTitulo || "—"} ·
            impressão digital <span className={estilos.codigo} title={previa.hash}>{previa.hash.slice(0, 12)}</span>
          </p>
        </div>
      </header>
      {previa.jaImportado && (
        <p className="clinicalError" role="alert">
          Este mesmo arquivo já foi importado em {dataHoraBr(previa.jaImportado.em)}. Ele não se aplica duas vezes.
        </p>
      )}
      <dl className={estilos.numeros}>
        <div><dt>Linhas lidas</dt><dd>{leitura.total.toLocaleString("pt-BR")}</dd></div>
        <div><dt>Prontas para entrar</dt><dd className={estilos.numeroOk}>{leitura.itens.length.toLocaleString("pt-BR")}</dd></div>
        <div><dt>Com erro (não entram)</dt><dd className={leitura.erros.length ? estilos.numeroErro : undefined}>{leitura.erros.length.toLocaleString("pt-BR")}</dd></div>
      </dl>

      {previa.comparacao && <Comparacao c={previa.comparacao} />}

      {leitura.erros.length > 0 && (
        <details className={estilos.detalhes} open={leitura.itens.length === 0}>
          <summary>Linhas com erro ({leitura.erros.length.toLocaleString("pt-BR")})</summary>
          <div className={estilos.tabelaRolagem}>
            <table className="admTabela">
              <thead><tr><th>Linha</th><th>Motivo</th></tr></thead>
              <tbody>{leitura.erros.slice(0, 200).map((e, i) => (
                <tr key={i}><td data-rotulo="Linha" className={estilos.numero}>{e.linha || "—"}</td><td data-rotulo="Motivo" data-largo>{e.mensagem}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {leitura.erros.length > 200 && <p className="admTextoFraco">E mais {(leitura.erros.length - 200).toLocaleString("pt-BR")} linhas com erro.</p>}
        </details>
      )}

      {amostra.length > 0 && (
        <details className={estilos.detalhes}>
          <summary>Primeiras linhas que vão entrar</summary>
          <div className={estilos.tabelaRolagem}>
            <table className="admTabela">
              <tbody>{amostra.map((x, i) => <tr key={i}>{celulasDaAmostra(tipo, x)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
      {children}
    </article>
  );
}

function celulasDaAmostra(tipo: TipoDeImportacao, x: unknown) {
  const o = x as Record<string, string | number | null>;
  if (tipo === "tuss") return <><td data-rotulo="Código" className={estilos.codigo}>{o.codigo}</td><td data-rotulo="Descrição" data-largo>{o.descricao}</td><td data-rotulo="Início" className={estilos.semQuebra}>{dataBr(o.inicioVigencia as string)}</td></>;
  if (tipo === "cbhpm") return <><td data-rotulo="Código" className={estilos.codigo}>{o.codigo}</td><td data-rotulo="Procedimento" data-largo>{o.descricao}</td><td data-rotulo="Porte">{o.porte == null ? "Sem porte" : rotuloDoPorte(o.porte as number)}</td></>;
  if (tipo === "cbhpm_portes") return <><td data-rotulo="Porte">{rotuloDoPorte(o.porte as number)}</td><td data-rotulo="Valor" className={estilos.numero}>{dinheiro(o.valor)}</td></>;
  if (tipo === "contrato") return <>
    <td data-rotulo="Código TUSS" className={estilos.codigo}>{o.tipo === "porte" ? "—" : o.tussCodigo}</td>
    <td data-rotulo="Descrição" data-largo>{o.tipo === "porte" ? "Valor do porte" : o.descricao ?? "—"}</td>
    <td data-rotulo="Porte">{o.porte == null ? "—" : rotuloDoPorte(o.porte as number)}</td>
    <td data-rotulo="Valor" className={estilos.numero}>{dinheiro(o.valor)}</td>
  </>;
  return <><td data-rotulo="TUSS" className={estilos.codigo}>{o.tussCodigo}</td><td data-rotulo="CBHPM" className={estilos.codigo}>{o.cbhpmCodigo}</td></>;
}

function Comparacao({ c }: { c: ComparacaoDeVersoes }) {
  const lista = (codigos: string[]) => codigos.slice(0, 60).join(", ") + (codigos.length > 60 ? ` e mais ${codigos.length - 60}` : "");
  return (
    <div className={estilos.bloco}>
      <h4>Comparação com a TUSS em uso</h4>
      <dl className={estilos.numeros}>
        <div><dt>Códigos novos</dt><dd>{c.novos.length.toLocaleString("pt-BR")}</dd></div>
        <div><dt>Descrição alterada</dt><dd>{c.descricaoAlterada.length.toLocaleString("pt-BR")}</dd></div>
        <div><dt>Passaram a ter fim de vigência</dt><dd>{c.encerrados.length.toLocaleString("pt-BR")}</dd></div>
        <div><dt>Não vieram no arquivo</dt><dd className={c.naoEncontrados.length ? estilos.numeroErro : undefined}>{c.naoEncontrados.length.toLocaleString("pt-BR")}</dd></div>
        <div><dt>Iguais</dt><dd>{c.iguais.toLocaleString("pt-BR")}</dd></div>
      </dl>
      {c.naoEncontrados.length > 0 && (
        <Aviso tom="atencao">Códigos da versão em uso que não vieram no arquivo: {lista(c.naoEncontrados)}. Confira se o arquivo está completo antes de publicar.</Aviso>
      )}
      {c.descricaoAlterada.length > 0 && (
        <details className={estilos.detalhes}>
          <summary>Descrições alteradas ({c.descricaoAlterada.length.toLocaleString("pt-BR")})</summary>
          <div className={estilos.tabelaRolagem}>
            <table className="admTabela">
              <thead><tr><th>Código</th><th>Antes</th><th>Agora</th></tr></thead>
              <tbody>{c.descricaoAlterada.slice(0, 100).map((d) => (
                <tr key={d.codigo}><td data-rotulo="Código" className={estilos.codigo}>{d.codigo}</td><td data-rotulo="Antes" data-largo>{d.antes}</td><td data-rotulo="Agora" data-largo>{d.depois}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      )}
      {c.novos.length > 0 && c.novos.length < 2000 && (
        <details className={estilos.detalhes}><summary>Códigos novos</summary><p className={estilos.listaDeCodigos}>{lista(c.novos)}</p></details>
      )}
      {c.encerrados.length > 0 && (
        <details className={estilos.detalhes}><summary>Passaram a ter fim de vigência</summary><p className={estilos.listaDeCodigos}>{lista(c.encerrados)}</p></details>
      )}
    </div>
  );
}
