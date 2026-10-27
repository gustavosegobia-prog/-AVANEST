"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao, Dialogo, Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import {
  entradaDaLista, faltaInstalar, filtrarDaLista, lerEmPaginas, problemaDaMarca,
  type MarcaDaClinica, type ProcedimentoDaClinica,
} from "@/lib/honorarios-telas";
import { Aviso, Etiqueta, Recusa, Vazio, dataBr, exigir, useAcao } from "./comum";
import { BuscaNaTuss, CodigosEscolhidos } from "./escolha-de-codigos";
import type { Codigo } from "./calculo-da-anestesia";
import type { DadosDasTabelas } from "./tipos";
import estilos from "./honorarios.module.css";

// Os códigos que o Financeiro dá à produção enviada (migração 202610270001):
// as marcas, que o médico marca na Produção e puxam um código a mais, e a
// lista de procedimentos — o nome como o médico escreve → os códigos TUSS.
// A lista também cresce sozinha: cada conferência na Produção da equipe
// ensina o nome que ainda não estava nela.

type Procedimento = ProcedimentoDaClinica & { id: string; updated_at: string };
type MarcaEmEdicao = { id?: string; nome: string; codigo: Codigo | null };

/** Linhas que a tabela mostra de uma vez; a busca acha o resto. */
const NA_TELA = 200;

export function AreaCodigos({ dados }: { dados: DadosDasTabelas }) {
  const tussId = dados.tuss.find((t) => t.situacao === "vigente")?.id ?? null;
  const [marcas, setMarcas] = useState<MarcaDaClinica[] | null>(null);
  const [procedimentos, setProcedimentos] = useState<Procedimento[] | null>(null);
  const [semTabela, setSemTabela] = useState(false);
  // Gravou: relê as duas listas (são pequenas) em vez de remendar a tela.
  const [leitura, setLeitura] = useState(0);
  const reler = () => setLeitura((n) => n + 1);

  useEffect(() => {
    let valendo = true;
    (async () => {
      const supabase = createClient();
      const [m, p] = await Promise.all([
        supabase.from("marcas_da_clinica").select("id, nome, tuss_codigo, descricao, ativo, ordem")
          .eq("institution_id", dados.institutionId).order("ordem").order("nome"),
        lerEmPaginas<Procedimento>((de, ate) => supabase.from("procedimentos_da_clinica")
          .select("id, chave, nome, codigos, updated_at").eq("institution_id", dados.institutionId)
          .order("chave").range(de, ate) as unknown as PromiseLike<{ data: Procedimento[] | null; error: unknown }>),
      ]);
      if (!valendo) return;
      setSemTabela(faltaInstalar(m.error) || faltaInstalar(p.erro as { code?: string; message?: string } | null));
      setMarcas((m.data ?? []) as MarcaDaClinica[]);
      setProcedimentos(p.linhas);
    })();
    return () => { valendo = false; };
  }, [dados.institutionId, leitura]);

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Códigos e marcas"
        descricao="O Financeiro dá o código da produção que a equipe envia: pelo nome do procedimento, mais um código para cada marca. A urgência vem da regra do contrato." />
      {semTabela ? (
        <Aviso tom="atencao">
          A lista de procedimentos e as marcas entram com a migração <code>202610270001_honorario_pelo_financeiro</code>,
          que ainda não foi aplicada.
        </Aviso>
      ) : marcas === null || procedimentos === null ? (
        <p className="admTextoFraco" role="status">Carregando…</p>
      ) : (<>
        {!tussId && (
          <Aviso tom="atencao">Sem a TUSS publicada, não há onde buscar os códigos: a lista abre só para leitura.</Aviso>
        )}
        <Marcas dados={dados} tussId={tussId} marcas={marcas} onGravou={reler} />
        <Procedimentos dados={dados} tussId={tussId} lista={procedimentos} onGravou={reler} />
      </>)}
    </section>
  );
}

function Marcas({ dados, tussId, marcas, onGravou }: {
  dados: DadosDasTabelas; tussId: string | null; marcas: MarcaDaClinica[]; onGravou: () => void;
}) {
  const [editando, setEditando] = useState<MarcaEmEdicao | null>(null);
  const [busca, setBusca] = useState("");
  const acao = useAcao();
  const pode = dados.podeEditar && Boolean(tussId);

  function abrir(m: MarcaEmEdicao) {
    setEditando(m);
    setBusca("");
    acao.setErro("");
  }

  async function salvar() {
    if (!editando) return;
    const ok = await acao.executar(async () => {
      const problema = problemaDaMarca({ id: editando.id, nome: editando.nome, tuss_codigo: editando.codigo?.codigo ?? "" }, marcas);
      if (problema || !editando.codigo) throw new Recusa(problema ?? "Escolha o código TUSS que a marca puxa.");
      const campos = { nome: editando.nome.trim(), tuss_codigo: editando.codigo.codigo, descricao: editando.codigo.descricao || null };
      const supabase = createClient();
      if (editando.id) {
        exigir(await supabase.from("marcas_da_clinica").update(campos).eq("id", editando.id));
      } else {
        const ordem = marcas.reduce((n, m) => Math.max(n, m.ordem ?? 0), 0) + 1;
        exigir(await supabase.from("marcas_da_clinica").insert({ ...campos, institution_id: dados.institutionId, ordem }));
      }
    });
    if (ok) {
      setEditando(null);
      onGravou();
    }
  }

  async function alternar(m: MarcaDaClinica) {
    const ok = await acao.executar(async () => {
      exigir(await createClient().from("marcas_da_clinica").update({ ativo: m.ativo === false }).eq("id", m.id));
    });
    if (ok) onGravou();
  }

  return (
    <article className={estilos.painel} aria-labelledby="marcas-da-clinica">
      <header className={estilos.painelTopo}>
        <div>
          <h3 id="marcas-da-clinica" className={estilos.comIcone}><Icone nome="etiqueta" tamanho={18} /> Marcas</h3>
          <p>
            Caixinhas que o médico marca ao anotar a anestesia na Produção. Cada marca puxa um código TUSS a mais no
            cálculo: um bloqueio, um cateter peridural, uma analgesia de parto.
          </p>
        </div>
        {pode && !editando && (
          <button type="button" className="outlineClinical" onClick={() => abrir({ nome: "", codigo: null })}>Nova marca</button>
        )}
      </header>

      {editando && (
        <div className={estilos.bloco} role="group" aria-label={editando.id ? "Editar marca" : "Nova marca"}>
          <label className={`clinicalField ${estilos.campoMedio}`}>
            <span>Nome, como o médico vai ver</span>
            <input value={editando.nome} maxLength={60} autoFocus placeholder="Ex.: Bloqueio de plexo braquial"
              onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
          </label>
          <div className={estilos.bloco}>
            <span className={estilos.legenda}>Código que a marca puxa</span>
            {editando.codigo ? (
              <ol className={estilos.codigosEscolhidos}>
                <li>
                  <span className={estilos.codigo}>{editando.codigo.codigo}</span>
                  <span>{editando.codigo.descricao || "—"}</span>
                  <span className={estilos.acoesDoCodigo}>
                    <button type="button" className="outlineClinical compacto" onClick={() => setEditando({ ...editando, codigo: null })}>Trocar</button>
                  </span>
                </li>
              </ol>
            ) : (
              <BuscaNaTuss tussId={tussId} busca={busca} onBusca={setBusca} rotulo="Buscar o código TUSS da marca"
                onEscolher={(c) => setEditando({ ...editando, codigo: c })} />
            )}
          </div>
          {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
          <div className={estilos.rodapeDoBloco}>
            <button type="button" className="outlineClinical" onClick={() => { setEditando(null); acao.setErro(""); }} disabled={acao.ocupado}>Cancelar</button>
            <button type="button" className="primaryClinical compact" onClick={() => void salvar()} disabled={acao.ocupado}>
              {acao.ocupado ? "Salvando…" : editando.id ? "Salvar marca" : "Criar marca"}
            </button>
          </div>
        </div>
      )}

      {marcas.length === 0 ? (
        !editando && (
          <Vazio titulo="Nenhuma marca ainda.">
            Sem marcas, o médico marca só a urgência, e o código sai só pelo nome do procedimento.
          </Vazio>
        )
      ) : (
        <div className={estilos.tabelaRolagem}>
          <table className="admTabela">
            <thead><tr><th>Marca</th><th>Código que puxa</th><th>Na Produção</th>{pode && <th><span className="sr-only">Ações</span></th>}</tr></thead>
            <tbody>
              {marcas.map((m) => (
                <tr key={m.id}>
                  <td data-rotulo="Marca"><strong>{m.nome}</strong></td>
                  <td data-rotulo="Código que puxa" data-largo>
                    <span className={estilos.codigo}>{m.tuss_codigo}</span>
                    {m.descricao && <small className={estilos.linhaFraca}>{m.descricao}</small>}
                  </td>
                  <td data-rotulo="Na Produção">
                    <Etiqueta tom={m.ativo === false ? "neutra" : "ok"}>{m.ativo === false ? "Desativada" : "Aparece"}</Etiqueta>
                  </td>
                  {pode && (
                    <td className={estilos.acoesDaLinha}>
                      <button type="button" className="outlineClinical compacto" aria-label={`Editar ${m.nome}`}
                        onClick={() => abrir({ id: m.id, nome: m.nome, codigo: { codigo: m.tuss_codigo, descricao: m.descricao ?? "" } })}>Editar</button>
                      <button type="button" className="outlineClinical compacto" disabled={acao.ocupado}
                        aria-label={`${m.ativo === false ? "Ativar" : "Desativar"} ${m.nome}`} onClick={() => void alternar(m)}>
                        {m.ativo === false ? "Ativar" : "Desativar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!editando && acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
      {marcas.some((m) => m.ativo === false) && (
        <p className="admAjuda">Desativada, a marca some da Produção; quem já a tinha marcado continua com o código dela.</p>
      )}
    </article>
  );
}

function Procedimentos({ dados, tussId, lista, onGravou }: {
  dados: DadosDasTabelas; tussId: string | null; lista: Procedimento[]; onGravou: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const [editando, setEditando] = useState<{ id?: string; nome: string } | null>(null);
  const [tirando, setTirando] = useState<Procedimento | null>(null);
  const acao = useAcao();
  const pode = dados.podeEditar && Boolean(tussId);
  const achados = useMemo(() => filtrarDaLista(lista, filtro), [lista, filtro]);

  async function tirar() {
    if (!tirando) return;
    const ok = await acao.executar(async () => {
      exigir(await createClient().from("procedimentos_da_clinica").delete().eq("id", tirando.id));
    });
    if (ok) {
      setTirando(null);
      onGravou();
    }
  }

  return (
    <article className={estilos.painel} aria-labelledby="procedimentos-da-clinica">
      <header className={estilos.painelTopo}>
        <div>
          <h3 id="procedimentos-da-clinica">Procedimentos</h3>
          <p>
            O nome como o médico escreve na Produção e os códigos que ele puxa, o principal primeiro. Maiúscula, acento
            e espaço a mais não contam. A lista cresce sozinha: cada conferência na Produção da equipe ensina o nome novo.
          </p>
        </div>
        {pode && (
          <button type="button" className="outlineClinical" onClick={() => setEditando({ nome: "" })}>Novo procedimento</button>
        )}
      </header>

      {lista.length === 0 ? (
        <Vazio titulo="Nenhum procedimento na lista ainda.">
          Ela se forma quando o Financeiro confere os códigos em Financeiro → Produção da equipe. Também dá para
          cadastrar aqui o nome como a equipe escreve e os códigos dele.
        </Vazio>
      ) : (<>
        <label className="admBusca">
          <span className="sr-only">Buscar na lista de procedimentos</span>
          <Icone nome="busca" tamanho={16} />
          <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nome do procedimento ou código" />
        </label>
        {achados.length === 0 ? (
          <p className="admTextoFraco" role="status">Nada na lista com “{filtro.trim()}”.</p>
        ) : (
          <div className={estilos.tabelaRolagem}>
            <table className="admTabela">
              <thead><tr><th>Como o médico escreve</th><th>Códigos</th><th>Atualizado</th>{pode && <th><span className="sr-only">Ações</span></th>}</tr></thead>
              <tbody>
                {achados.slice(0, NA_TELA).map((p) => (
                  <tr key={p.id}>
                    <td data-rotulo="Como o médico escreve"><strong>{p.nome}</strong></td>
                    <td data-rotulo="Códigos" data-largo>
                      {p.codigos.map((c, i) => (
                        <span key={c.codigo} className={estilos.codigoDaLista}>
                          <span className={estilos.codigo}>{i + 1}. {c.codigo}</span>
                          {c.descricao && <small className={estilos.linhaFraca}>{c.descricao}</small>}
                        </span>
                      ))}
                    </td>
                    <td data-rotulo="Atualizado" className={estilos.semQuebra}>{dataBr(p.updated_at)}</td>
                    {pode && (
                      <td className={estilos.acoesDaLinha}>
                        <button type="button" className="outlineClinical compacto" aria-label={`Editar ${p.nome}`}
                          onClick={() => setEditando({ id: p.id, nome: p.nome })}>Editar</button>
                        <button type="button" className="outlineClinical compacto" aria-label={`Tirar ${p.nome} da lista`}
                          onClick={() => { acao.setErro(""); setTirando(p); }}>Tirar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="admAjuda" role="status">
          {achados.length > NA_TELA
            ? `Mostrando ${NA_TELA} de ${achados.length.toLocaleString("pt-BR")}: busque pelo nome para achar o resto.`
            : `${achados.length.toLocaleString("pt-BR")} ${achados.length === 1 ? "procedimento" : "procedimentos"}${filtro.trim() ? ` com “${filtro.trim()}”` : " na lista"}.`}
        </p>
      </>)}

      {editando && (
        <EditarProcedimento key={editando.id ?? "novo"} dados={dados} tussId={tussId}
          procedimento={lista.find((p) => p.id === editando.id) ?? null} nomeInicial={editando.nome}
          onFechar={() => setEditando(null)} onGravou={() => { setEditando(null); onGravou(); }} />
      )}
      {tirando && (
        <Dialogo titulo={`Tirar “${tirando.nome}” da lista?`} confirmar="Tirar da lista" perigo ocupado={acao.ocupado} erro={acao.erro}
          onConfirmar={() => void tirar()} onCancelar={() => setTirando(null)}>
          A próxima anestesia com este nome chega ao Financeiro sem código sugerido. O que já foi calculado não muda.
        </Dialogo>
      )}
    </article>
  );
}

function EditarProcedimento({ dados, tussId, procedimento, nomeInicial, onFechar, onGravou }: {
  dados: DadosDasTabelas; tussId: string | null; procedimento: Procedimento | null; nomeInicial: string;
  onFechar: () => void; onGravou: () => void;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [codigos, setCodigos] = useState<Codigo[]>(procedimento?.codigos ?? []);
  // Procedimento novo: a busca na TUSS começa pelo nome escrito.
  const [busca, setBusca] = useState("");
  const acao = useAcao();

  async function salvar() {
    const ok = await acao.executar(async () => {
      if (!nome.trim()) throw new Recusa("Escreva o nome do procedimento como o médico escreve na Produção.");
      if (!codigos.length) throw new Recusa("Escolha ao menos o código TUSS do procedimento principal.");
      const entrada = entradaDaLista(nome, codigos);
      if (!entrada) throw new Recusa("Escolha ao menos o código TUSS do procedimento principal.");
      const supabase = createClient();
      exigir(procedimento
        ? await supabase.from("procedimentos_da_clinica").update(entrada).eq("id", procedimento.id)
        : await supabase.from("procedimentos_da_clinica").insert({ ...entrada, institution_id: dados.institutionId }));
    });
    if (ok) onGravou();
  }

  return (
    <Gaveta titulo={procedimento ? "Editar procedimento" : "Novo procedimento"} onPedirFechar={onFechar}
      subtitulo="O nome como o médico escreve na Produção, e os códigos que ele puxa."
      rodape={<>
        <button type="button" className="outlineClinical" onClick={onFechar} disabled={acao.ocupado}>Cancelar</button>
        <button type="button" className="primaryClinical compact" onClick={() => void salvar()} disabled={acao.ocupado || !codigos.length}>
          {acao.ocupado ? "Salvando…" : "Salvar na lista"}
        </button>
      </>}>
      <div className="admCampos">
        <label className="clinicalField">
          <span>Como o médico escreve</span>
          <input value={nome} maxLength={200} placeholder="Ex.: Colecistectomia videolaparoscópica"
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => { if (!procedimento && !codigos.length && !busca && nome.trim().length >= 4) setBusca(nome.trim()); }} />
        </label>
        <div className={estilos.bloco}>
          <h3>Códigos (TUSS)</h3>
          <p className="admAjuda">O principal primeiro. Com mais de um, o contrato diz quanto vale cada um.</p>
          {codigos.length === 0
            ? <p className="admTextoFraco">Nenhum código escolhido ainda.</p>
            : <CodigosEscolhidos codigos={codigos} onMudar={setCodigos} />}
          <BuscaNaTuss tussId={tussId} busca={busca} onBusca={setBusca}
            onEscolher={(c) => { if (!codigos.some((x) => x.codigo === c.codigo)) setCodigos([...codigos, c]); }} />
        </div>
        {procedimento && (
          <p className="admAjuda">Vale para as próximas conferências. O que já foi calculado não muda.</p>
        )}
        {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
      </div>
    </Gaveta>
  );
}
