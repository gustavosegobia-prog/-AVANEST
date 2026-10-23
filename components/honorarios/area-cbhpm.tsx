"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao, Dialogo, Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { NOME_DA_SITUACAO_DA_EDICAO } from "@/lib/honorarios-dados";
import { rotuloDoPorte } from "@/lib/honorarios-telas";
import { Aviso, Etiqueta, Recusa, Vazio, dataBr, dataHoraBr, dinheiro, exigir, lerNumero, useAcao, type Tom } from "./comum";
import type { PedidoDeImportacao } from "./area-importar";
import type { DadosDasTabelas, LinhaEdicaoCompleta } from "./tipos";
import estilos from "./honorarios.module.css";

const TOM_DA_EDICAO: Record<LinhaEdicaoCompleta["situacao"], Tom> = { em_conferencia: "atencao", vigente: "ok", encerrada: "neutra" };
const PORTES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * A CBHPM da clínica: edições, os procedimentos com porte anestésico, os
 * valores de referência dos portes e a correspondência com a TUSS. Nada vem
 * pronto: a CBHPM é publicação da AMB, e entra do arquivo que a clínica
 * licenciou ou por cadastro de quem tem autorização.
 */
export function AreaCbhpm({
  dados, onImportar, onAtualizar,
}: {
  dados: DadosDasTabelas;
  onImportar: (p: PedidoDeImportacao) => void;
  onAtualizar: () => void;
}) {
  const [escolhida, setEscolhida] = useState<string | null>(dados.edicoes[0]?.id ?? null);
  const [nova, setNova] = useState(false);
  const edicao = dados.edicoes.find((e) => e.id === escolhida) ?? null;

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Procedimentos e portes anestésicos (CBHPM)"
        descricao="A tabela dos procedimentos com o porte anestésico de cada um e o valor de referência de cada porte, pela CBHPM da clínica. Vale para o código que a tabela do plano não trouxer."
        acao={dados.podeEditar ? (
          <button type="button" className="primaryClinical compact" onClick={() => setNova(true)}>Nova edição</button>
        ) : undefined} />
      <Aviso>
        A CBHPM é publicação da AMB, com direitos de uso. O AVANEST não traz a tabela pronta: importe o arquivo que a
        clínica licenciou ou cadastre os valores autorizados.
      </Aviso>

      {dados.edicoes.length === 0 ? (
        <Vazio titulo="Nenhuma edição da CBHPM cadastrada.">
          Contratos pela CBHPM ficam pendentes até a edição existir. Contrato com tabela própria não precisa dela.
        </Vazio>
      ) : (
        <div className={estilos.escolhas} role="group" aria-label="Edições da CBHPM">
          {dados.edicoes.map((e) => (
            <button type="button" key={e.id} className={`${estilos.escolha}${e.id === escolhida ? ` ${estilos.escolhaAtiva}` : ""}`}
              aria-pressed={e.id === escolhida} onClick={() => setEscolhida(e.id)}>
              <strong>{e.nome}</strong>
              <span>{e.edicao}{e.ano ? ` · ${e.ano}` : ""}</span>
              <Etiqueta tom={TOM_DA_EDICAO[e.situacao]}>{NOME_DA_SITUACAO_DA_EDICAO[e.situacao]}</Etiqueta>
            </button>
          ))}
        </div>
      )}

      {edicao && <Edicao key={edicao.id} dados={dados} edicao={edicao} onImportar={onImportar} onAtualizar={onAtualizar} />}

      <Correspondencias dados={dados} onImportar={onImportar} onAtualizar={onAtualizar} />

      {nova && <NovaEdicao institutionId={dados.institutionId} onFechar={() => setNova(false)}
        onCriada={(id) => { setNova(false); setEscolhida(id); onAtualizar(); }} />}
    </section>
  );
}

// ── Uma edição ─────────────────────────────────────────────────────────────

function Edicao({
  dados, edicao, onImportar, onAtualizar,
}: {
  dados: DadosDasTabelas;
  edicao: LinhaEdicaoCompleta;
  onImportar: (p: PedidoDeImportacao) => void;
  onAtualizar: () => void;
}) {
  const editavel = dados.podeEditar && edicao.situacao === "em_conferencia";
  const portes = dados.portes.filter((p) => p.edicao_id === edicao.id);
  const vigencias = [...new Set(portes.map((p) => p.vigencia_inicio))].sort().reverse();
  const [mudanca, setMudanca] = useState<"publicar" | "encerrar" | "excluir" | null>(null);
  const [fimDaVigencia, setFimDaVigencia] = useState(dados.hoje);
  const acao = useAcao();
  const usadaEmContrato = dados.versoes.some((v) => v.cbhpm_edicao_id === edicao.id);

  async function confirmar() {
    const supabase = createClient();
    const ok = await acao.executar(async () => {
      if (mudanca === "publicar") {
        exigir(await supabase.from("cbhpm_edicoes").update({ situacao: "vigente" }).eq("id", edicao.id));
      } else if (mudanca === "encerrar") {
        exigir(await supabase.from("cbhpm_edicoes").update({ situacao: "encerrada", vigencia_fim: fimDaVigencia }).eq("id", edicao.id));
      } else if (mudanca === "excluir") {
        exigir(await supabase.from("tuss_cbhpm_correspondencias").delete().eq("cbhpm_edicao_id", edicao.id).eq("situacao", "proposta"));
        exigir(await supabase.from("cbhpm_procedimentos").delete().eq("edicao_id", edicao.id));
        exigir(await supabase.from("cbhpm_portes").delete().eq("edicao_id", edicao.id));
        exigir(await supabase.from("cbhpm_edicoes").delete().eq("id", edicao.id));
      }
    });
    if (ok) { setMudanca(null); onAtualizar(); }
  }

  return (
    <article className={estilos.painel} aria-label={`Edição ${edicao.edicao}`}>
      <header className={estilos.painelTopo}>
        <div>
          <h3>{edicao.nome} · {edicao.edicao}</h3>
          <p>
            Fonte: {edicao.fonte}{edicao.licenca ? ` · Licença: ${edicao.licenca}` : ""}
            {edicao.vigencia_inicio ? ` · Vigência: ${dataBr(edicao.vigencia_inicio)}${edicao.vigencia_fim ? ` a ${dataBr(edicao.vigencia_fim)}` : ""}` : ""}
          </p>
        </div>
        {dados.podeEditar && (
          <div className={estilos.acoesDaLinha}>
            {edicao.situacao === "em_conferencia" && <>
              <button type="button" className="primaryClinical compact" onClick={() => setMudanca("publicar")}>Publicar edição</button>
              <button type="button" className="outlineClinical compacto" onClick={() => setMudanca("excluir")}>Excluir</button>
            </>}
            {edicao.situacao === "vigente" && (
              <button type="button" className="outlineClinical compacto" onClick={() => setMudanca("encerrar")}>Encerrar edição</button>
            )}
          </div>
        )}
      </header>
      {edicao.situacao !== "em_conferencia" && (
        <p className="admNota"><Icone nome="cadeado" tamanho={14} />Edição publicada não muda. Para valores novos, cadastre outra edição.</p>
      )}

      <PortesDeReferencia dados={dados} edicao={edicao} editavel={editavel} vigencias={vigencias}
        onImportar={onImportar} onAtualizar={onAtualizar} />
      <Procedimentos institutionId={dados.institutionId} edicao={edicao} editavel={editavel} onImportar={onImportar} />

      {mudanca && (
        <Dialogo
          titulo={mudanca === "publicar" ? `Publicar a edição ${edicao.edicao}?` : mudanca === "encerrar" ? `Encerrar a edição ${edicao.edicao}?` : `Excluir a edição ${edicao.edicao}?`}
          confirmar={mudanca === "publicar" ? "Publicar" : mudanca === "encerrar" ? "Encerrar" : "Excluir"}
          perigo={mudanca === "excluir"} ocupado={acao.ocupado} erro={acao.erro}
          onConfirmar={confirmar} onCancelar={() => setMudanca(null)}>
          {mudanca === "publicar" && <p>Os contratos pela CBHPM passam a usar os portes e os valores de referência desta edição. Publicada, ela não muda mais.</p>}
          {mudanca === "encerrar" && <>
            <p>A edição deixa de valer depois da data abaixo. Os honorários já calculados com ela continuam explicados por ela.</p>
            <label className="clinicalField">
              <span>Último dia de vigência</span>
              <input type="date" value={fimDaVigencia} onChange={(e) => setFimDaVigencia(e.target.value)} />
            </label>
          </>}
          {mudanca === "excluir" && <>
            <p>A edição em conferência, os procedimentos, os portes e as correspondências ainda não validadas dela são apagados.</p>
            {usadaEmContrato && <p><strong>Há contrato que aponta para esta edição:</strong> o banco não deixa excluir enquanto ele existir.</p>}
          </>}
        </Dialogo>
      )}
    </article>
  );
}

function PortesDeReferencia({
  dados, edicao, editavel, vigencias, onImportar, onAtualizar,
}: {
  dados: DadosDasTabelas;
  edicao: LinhaEdicaoCompleta;
  editavel: boolean;
  vigencias: string[];
  onImportar: (p: PedidoDeImportacao) => void;
  onAtualizar: () => void;
}) {
  const [vigencia, setVigencia] = useState(vigencias[0] ?? edicao.vigencia_inicio ?? dados.hoje);
  const daVigencia = (v: string) => dados.portes.filter((p) => p.edicao_id === edicao.id && p.vigencia_inicio === v);
  const [valores, setValores] = useState<Record<number, string>>(() => paraTexto(daVigencia(vigencia)));
  const [fonte, setFonte] = useState(daVigencia(vigencia)[0]?.fonte ?? edicao.fonte);
  const [salvo, setSalvo] = useState(false);
  const acao = useAcao();

  function paraTexto(linhas: typeof dados.portes) {
    const r: Record<number, string> = {};
    for (const p of linhas) r[p.porte] = Number(p.valor_referencia).toFixed(2).replace(".", ",");
    return r;
  }
  function trocarVigencia(v: string) {
    setVigencia(v);
    // Data que já tem valores: mostra os dela. Data nova: o que foi digitado fica.
    const linhas = daVigencia(v);
    if (linhas.length) { setValores(paraTexto(linhas)); setFonte(linhas[0].fonte); }
    setSalvo(false);
  }

  const lidos = PORTES.map((p) => [p, lerNumero(valores[p] ?? "")] as const);
  const invalidos = lidos.filter(([, n]) => n !== null && !(Number(n) >= 0));

  async function salvar() {
    setSalvo(false);
    const ok = await acao.executar(async () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(vigencia)) throw new Recusa("Informe o início da vigência dos valores.");
      if (!fonte.trim()) throw new Recusa("Informe a fonte dos valores (arquivo licenciado, acordo, publicação).");
      if (invalidos.length) throw new Recusa(`Valor inválido em ${invalidos.map(([p]) => rotuloDoPorte(p)).join(", ")}.`);
      const supabase = createClient();
      const preenchidos = lidos.filter(([, n]) => n !== null).map(([porte, n]) => ({
        edicao_id: edicao.id, institution_id: dados.institutionId, porte, valor_referencia: n, unidade: "R$",
        vigencia_inicio: vigencia, fonte: fonte.trim(),
      }));
      const vazios = lidos.filter(([, n]) => n === null).map(([p]) => p);
      if (preenchidos.length) {
        exigir(await supabase.from("cbhpm_portes").upsert(preenchidos, { onConflict: "edicao_id,porte,vigencia_inicio" }));
      }
      if (vazios.length) {
        exigir(await supabase.from("cbhpm_portes").delete().eq("edicao_id", edicao.id).eq("vigencia_inicio", vigencia).in("porte", vazios));
      }
    });
    if (ok) { setSalvo(true); onAtualizar(); }
  }

  return (
    <div className={estilos.bloco}>
      <div className={estilos.blocoTopo}>
        <h4>Valor de referência dos portes</h4>
        {editavel && (
          <button type="button" className="outlineClinical compacto" onClick={() => onImportar({ tipo: "cbhpm_portes", destinoId: edicao.id })}>
            Importar planilha
          </button>
        )}
      </div>
      <p className="admAjuda">Porte sem valor fica vazio — e o contrato que dependa dele fica pendente, sem valor presumido.</p>
      <div className={estilos.camposEmLinha}>
        <label className="clinicalField">
          <span>Valores a partir de</span>
          {vigencias.length > 1 && !editavel ? (
            <select value={vigencia} onChange={(e) => trocarVigencia(e.target.value)}>
              {vigencias.map((v) => <option key={v} value={v}>{dataBr(v)}</option>)}
            </select>
          ) : (
            <input type="date" value={vigencia} disabled={!editavel} onChange={(e) => trocarVigencia(e.target.value)} />
          )}
        </label>
        <label className={`clinicalField ${estilos.campoLargo}`}>
          <span>Fonte dos valores</span>
          <input value={fonte} disabled={!editavel} onChange={(e) => { setFonte(e.target.value); setSalvo(false); }}
            placeholder="Ex.: arquivo licenciado CBHPM (AMB)" />
        </label>
      </div>
      <div className={estilos.gradePortes}>
        {PORTES.map((p) => {
          const n = lerNumero(valores[p] ?? "");
          const erro = n !== null && !(Number(n) >= 0);
          return (
            <label key={p} className={`clinicalField${erro ? " comErro" : ""}`}>
              <span>{rotuloDoPorte(p)}</span>
              {editavel ? (
                <input inputMode="decimal" value={valores[p] ?? ""} placeholder="—" aria-invalid={erro || undefined}
                  onChange={(e) => { setValores({ ...valores, [p]: e.target.value }); setSalvo(false); }} />
              ) : (
                <output className={estilos.valorFixo}>{valores[p] ? dinheiro(lerNumero(valores[p])) : "—"}</output>
              )}
            </label>
          );
        })}
      </div>
      {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
      {editavel && (
        <div className={estilos.rodapeDoBloco}>
          {salvo && <span className={estilos.salvo} role="status"><Icone nome="confirmado" tamanho={15} />Valores salvos</span>}
          <button type="button" className="primaryClinical compact" onClick={salvar} disabled={acao.ocupado}>
            {acao.ocupado ? "Salvando…" : "Salvar valores"}
          </button>
        </div>
      )}
    </div>
  );
}

type Procedimento = { id: string; codigo: string; descricao: string; porte_anestesico: number | null };

function Procedimentos({
  institutionId, edicao, editavel, onImportar,
}: {
  institutionId: string;
  edicao: LinhaEdicaoCompleta;
  editavel: boolean;
  onImportar: (p: PedidoDeImportacao) => void;
}) {
  const [total, setTotal] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Procedimento[]>([]);
  const [recarregar, setRecarregar] = useState(0);
  const [novo, setNovo] = useState({ codigo: "", descricao: "", porte: "" });
  const acao = useAcao();

  useEffect(() => {
    let valendo = true;
    const espera = setTimeout(async () => {
      const supabase = createClient();
      const termo = busca.trim();
      let q = supabase.from("cbhpm_procedimentos").select("id, codigo, descricao, porte_anestesico", { count: "exact" })
        .eq("edicao_id", edicao.id);
      if (termo) q = /\d/.test(termo) && !/\s/.test(termo) ? q.ilike("codigo", `${termo}%`) : q.ilike("descricao", `%${termo.replace(/[%_]/g, "")}%`);
      const { data, count } = await q.order("codigo").limit(50);
      if (!valendo) return;
      setLista((data ?? []) as Procedimento[]);
      if (!termo) setTotal(count ?? 0);
    }, busca ? 250 : 0);
    return () => { valendo = false; clearTimeout(espera); };
  }, [busca, edicao.id, recarregar]);

  async function adicionar() {
    const ok = await acao.executar(async () => {
      if (!novo.codigo.trim() || !novo.descricao.trim()) throw new Recusa("Informe o código e a descrição do procedimento.");
      exigir(await createClient().from("cbhpm_procedimentos").insert({
        edicao_id: edicao.id, institution_id: institutionId, codigo: novo.codigo.trim(), descricao: novo.descricao.trim(),
        porte_anestesico: novo.porte === "" ? null : Number(novo.porte),
      }));
    });
    if (ok) { setNovo({ codigo: "", descricao: "", porte: "" }); setRecarregar((n) => n + 1); }
  }
  async function remover(id: string) {
    const ok = await acao.executar(async () => {
      exigir(await createClient().from("cbhpm_procedimentos").delete().eq("id", id));
    });
    if (ok) setRecarregar((n) => n + 1);
  }

  return (
    <div className={estilos.bloco}>
      <div className={estilos.blocoTopo}>
        <h4>Procedimentos e porte anestésico {total != null && <span className="admContagem">{total.toLocaleString("pt-BR")}</span>}</h4>
        {editavel && (
          <button type="button" className="outlineClinical compacto" onClick={() => onImportar({ tipo: "cbhpm", destinoId: edicao.id })}>
            Importar planilha
          </button>
        )}
      </div>
      <label className="admBusca">
        <span className="sr-only">Buscar procedimento</span>
        <Icone nome="busca" tamanho={16} />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou parte da descrição" />
      </label>
      {lista.length === 0 ? (
        <p className="admTextoFraco">{busca ? "Nenhum procedimento encontrado." : "Nenhum procedimento nesta edição ainda."}</p>
      ) : (
        <div className={estilos.tabelaRolagem}>
          <table className="admTabela">
            <thead><tr><th>Código</th><th>Procedimento</th><th>Porte</th>{editavel && <th><span className="sr-only">Ações</span></th>}</tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td data-rotulo="Código" className={estilos.codigo}>{p.codigo}</td>
                  <td data-rotulo="Procedimento" data-largo>{p.descricao}</td>
                  <td data-rotulo="Porte">{p.porte_anestesico == null ? <Etiqueta tom="neutra">Sem porte</Etiqueta> : rotuloDoPorte(p.porte_anestesico)}</td>
                  {editavel && <td data-rotulo="Ações" className={estilos.acoesDaLinha}>
                    <button type="button" className="outlineClinical compacto" onClick={() => remover(p.id)} disabled={acao.ocupado}>Remover</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
          {total != null && total > lista.length && !busca && <p className="admTextoFraco">Mostrando {lista.length} de {total.toLocaleString("pt-BR")}. Busque para achar os demais.</p>}
        </div>
      )}
      {editavel && (
        <fieldset className={`admCampos ${estilos.novoItem}`}>
          <legend>Cadastrar procedimento</legend>
          <div className={estilos.camposEmLinha}>
            <label className="clinicalField"><span>Código</span>
              <input value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} /></label>
            <label className={`clinicalField ${estilos.campoLargo}`}><span>Descrição</span>
              <input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} /></label>
            <label className="clinicalField"><span>Porte anestésico</span>
              <select value={novo.porte} onChange={(e) => setNovo({ ...novo, porte: e.target.value })}>
                <option value="">Sem porte</option>
                {PORTES.map((p) => <option key={p} value={p}>{rotuloDoPorte(p)}</option>)}
              </select></label>
            <button type="button" className="outlineClinical" onClick={adicionar} disabled={acao.ocupado}>Adicionar</button>
          </div>
        </fieldset>
      )}
      {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
    </div>
  );
}

// ── Nova edição ───────────────────────────────────────────────────────────

function NovaEdicao({ institutionId, onFechar, onCriada }: { institutionId: string; onFechar: () => void; onCriada: (id: string) => void }) {
  const [f, setF] = useState({ nome: "CBHPM", edicao: "", ano: "", fonte: "", licenca: "", inicio: "", fim: "" });
  const acao = useAcao();
  async function criar() {
    await acao.executar(async () => {
      if (!f.edicao.trim()) throw new Recusa("Informe a edição (ex.: 2022 5ª edição).");
      if (!f.fonte.trim()) throw new Recusa("Informe de onde vêm os dados: arquivo licenciado, cadastro manual autorizado…");
      const ano = f.ano ? Number(f.ano) : null;
      if (ano != null && !(ano >= 1990 && ano <= 2100)) throw new Recusa("Ano inválido.");
      const r = exigir(await createClient().from("cbhpm_edicoes").insert({
        institution_id: institutionId, nome: f.nome.trim() || "CBHPM", edicao: f.edicao.trim(), ano,
        fonte: f.fonte.trim(), licenca: f.licenca.trim() || null, vigencia_inicio: f.inicio || null, vigencia_fim: f.fim || null,
      }).select("id").single());
      onCriada((r as { id: string }).id);
    });
  }
  const campo = (k: keyof typeof f, rotulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="clinicalField"><span>{rotulo}</span>
      <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></label>
  );
  return (
    <Gaveta titulo="Nova edição da CBHPM" subtitulo="Começa em conferência: só depois de publicada entra no cálculo." onPedirFechar={onFechar}
      rodape={<>
        <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
        <button type="button" className="primaryClinical compact" onClick={criar} disabled={acao.ocupado}>{acao.ocupado ? "Salvando…" : "Criar edição"}</button>
      </>}>
      <div className="admCampos">
        {campo("nome", "Nome")}
        <div className="admLinhaDupla">{campo("edicao", "Edição", { placeholder: "Ex.: 5ª edição" })}{campo("ano", "Ano", { inputMode: "numeric" })}</div>
        {campo("fonte", "Fonte", { placeholder: "Ex.: arquivo licenciado pela AMB" })}
        {campo("licenca", "Licença ou autorização", { placeholder: "Número, contrato ou termo de uso" })}
        <div className="admLinhaDupla">{campo("inicio", "Início da vigência", { type: "date" })}{campo("fim", "Fim da vigência", { type: "date" })}</div>
        {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
      </div>
    </Gaveta>
  );
}

// ── Correspondência TUSS ↔ CBHPM ──────────────────────────────────────────

type Correspondencia = {
  id: string; tuss_codigo: string; cbhpm_edicao_id: string; cbhpm_codigo: string;
  situacao: "proposta" | "validada" | "revogada"; origem: string; validada_em: string | null; created_at: string;
};
const TOM_DA_CORRESPONDENCIA: Record<Correspondencia["situacao"], [string, Tom]> = {
  proposta: ["Aguardando validação", "atencao"], validada: ["Validada", "ok"], revogada: ["Revogada", "neutra"],
};

function Correspondencias({
  dados, onImportar, onAtualizar,
}: {
  dados: DadosDasTabelas;
  onImportar: (p: PedidoDeImportacao) => void;
  onAtualizar: () => void;
}) {
  const [situacao, setSituacao] = useState<"" | Correspondencia["situacao"]>(dados.correspondenciasPropostas ? "proposta" : "");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Correspondencia[] | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const [novo, setNovo] = useState({ tuss: "", cbhpm: "", edicao: dados.edicoes[0]?.id ?? "" });
  const acao = useAcao();
  const nomeDaEdicao = new Map(dados.edicoes.map((e) => [e.id, e.edicao]));
  const vigenteTuss = dados.tuss.find((t) => t.situacao === "vigente");

  useEffect(() => {
    let valendo = true;
    const espera = setTimeout(async () => {
      let q = createClient().from("tuss_cbhpm_correspondencias")
        .select("id, tuss_codigo, cbhpm_edicao_id, cbhpm_codigo, situacao, origem, validada_em, created_at")
        .eq("institution_id", dados.institutionId);
      if (situacao) q = q.eq("situacao", situacao);
      const termo = busca.replace(/\s/g, "");
      if (termo) q = q.or(`tuss_codigo.like.${termo.replace(/\D/g, "")}%,cbhpm_codigo.ilike.${termo.replace(/[,()%]/g, "")}%`);
      const { data } = await q.order("tuss_codigo").limit(100);
      if (valendo) setLista((data ?? []) as Correspondencia[]);
    }, busca ? 250 : 0);
    return () => { valendo = false; clearTimeout(espera); };
  }, [situacao, busca, recarregar, dados.institutionId]);

  async function mudar(c: Correspondencia, para: "validada" | "revogada" | "apagar") {
    const ok = await acao.executar(async () => {
      const t = createClient().from("tuss_cbhpm_correspondencias");
      exigir(para === "apagar" ? await t.delete().eq("id", c.id) : await t.update({ situacao: para }).eq("id", c.id));
    });
    if (ok) { setRecarregar((n) => n + 1); onAtualizar(); }
  }
  async function adicionar() {
    const ok = await acao.executar(async () => {
      const tuss = novo.tuss.replace(/\D/g, "");
      if (!tuss || !novo.cbhpm.trim() || !novo.edicao) throw new Recusa("Informe o código TUSS, o código CBHPM e a edição.");
      exigir(await createClient().from("tuss_cbhpm_correspondencias").insert({
        institution_id: dados.institutionId, tuss_codigo: tuss, tuss_versao_id: vigenteTuss?.id ?? null,
        cbhpm_edicao_id: novo.edicao, cbhpm_codigo: novo.cbhpm.trim(), situacao: "proposta", origem: "cadastro manual",
      }));
    });
    if (ok) { setNovo({ ...novo, tuss: "", cbhpm: "" }); setRecarregar((n) => n + 1); onAtualizar(); }
  }

  return (
    <div className={estilos.painel}>
      <header className={estilos.painelTopo}>
        <div>
          <h3>Correspondência TUSS ↔ CBHPM</h3>
          <p>Os dois códigos nem sempre coincidem. Só a correspondência validada por alguém entra no cálculo.</p>
        </div>
        {dados.podeEditar && dados.edicoes.length > 0 && (
          <button type="button" className="outlineClinical compacto" onClick={() => onImportar({ tipo: "correspondencia", destinoId: novo.edicao || undefined })}>
            Importar planilha
          </button>
        )}
      </header>
      <div className="admFiltros">
        <label className="admBusca">
          <span className="sr-only">Buscar código</span>
          <Icone nome="busca" tamanho={16} />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código TUSS ou CBHPM" />
        </label>
        <label><span>Situação</span>
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as typeof situacao)}>
            <option value="">Todas</option>
            <option value="proposta">Aguardando validação</option>
            <option value="validada">Validadas</option>
            <option value="revogada">Revogadas</option>
          </select>
        </label>
      </div>
      {lista === null ? <p className="admTextoFraco" role="status">Carregando…</p> : lista.length === 0 ? (
        <p className="admTextoFraco">Nenhuma correspondência {situacao ? "nesta situação" : "cadastrada"}.</p>
      ) : (
        <div className={estilos.tabelaRolagem}>
          <table className="admTabela">
            <thead><tr><th>TUSS</th><th>CBHPM</th><th>Edição</th><th>Situação</th><th>Origem</th>{dados.podeEditar && <th><span className="sr-only">Ações</span></th>}</tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td data-rotulo="TUSS" className={estilos.codigo}>{c.tuss_codigo}</td>
                  <td data-rotulo="CBHPM" className={estilos.codigo}>{c.cbhpm_codigo}</td>
                  <td data-rotulo="Edição">{nomeDaEdicao.get(c.cbhpm_edicao_id) ?? "—"}</td>
                  <td data-rotulo="Situação">
                    <Etiqueta tom={TOM_DA_CORRESPONDENCIA[c.situacao][1]}>{TOM_DA_CORRESPONDENCIA[c.situacao][0]}</Etiqueta>
                    {c.validada_em && c.situacao === "validada" && <small className={estilos.linhaFraca}>{dataHoraBr(c.validada_em)}</small>}
                  </td>
                  <td data-rotulo="Origem" data-largo>{c.origem}</td>
                  {dados.podeEditar && (
                    <td data-rotulo="Ações" className={estilos.acoesDaLinha}>
                      {c.situacao === "proposta" && <>
                        <button type="button" className="primaryClinical compact" onClick={() => mudar(c, "validada")} disabled={acao.ocupado}>Validar</button>
                        <button type="button" className="outlineClinical compacto" onClick={() => mudar(c, "apagar")} disabled={acao.ocupado}>Apagar</button>
                      </>}
                      {c.situacao === "validada" && (
                        <button type="button" className="outlineClinical compacto" onClick={() => mudar(c, "revogada")} disabled={acao.ocupado}>Revogar</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 100 && <p className="admTextoFraco">Mostrando 100. Busque pelo código para achar os demais.</p>}
        </div>
      )}
      {dados.podeEditar && dados.edicoes.length > 0 && (
        <fieldset className={`admCampos ${estilos.novoItem}`}>
          <legend>Propor correspondência</legend>
          <div className={estilos.camposEmLinha}>
            <label className="clinicalField"><span>Código TUSS</span>
              <input inputMode="numeric" value={novo.tuss} onChange={(e) => setNovo({ ...novo, tuss: e.target.value })} /></label>
            <label className="clinicalField"><span>Código CBHPM</span>
              <input value={novo.cbhpm} onChange={(e) => setNovo({ ...novo, cbhpm: e.target.value })} /></label>
            <label className="clinicalField"><span>Edição</span>
              <select value={novo.edicao} onChange={(e) => setNovo({ ...novo, edicao: e.target.value })}>
                {dados.edicoes.map((e) => <option key={e.id} value={e.id}>{e.edicao}</option>)}
              </select></label>
            <button type="button" className="outlineClinical" onClick={adicionar} disabled={acao.ocupado}>Propor</button>
          </div>
          <p className="admAjuda">A proposta não entra no cálculo até ser validada. Validar carimba quem validou e quando.</p>
        </fieldset>
      )}
      {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
    </div>
  );
}
