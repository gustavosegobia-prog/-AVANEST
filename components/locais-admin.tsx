"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { Dialogo } from "@/components/admin-ui";
import { TIPOS_DE_LOCAL, nomeDoLocal, rotuloDoTipo } from "@/lib/local-ativo";

// Cadastro e gerenciamento dos locais de atendimento.
//
// Mora no Admin, junto das outras coisas da organização. O cadastro rápido da
// tela de escolha pede cinco campos para a pessoa começar a atender; aqui está
// o resto — endereço, CNPJ, contato e as duas marcas.
//
// O que NÃO tem aqui: exclusão silenciosa. Local com avaliação vinculada é
// arquivado, nunca apagado, e quem decide isso é o banco (excluir_local), não
// esta tela — regra de histórico clínico não pode depender de qual botão a
// pessoa clicou.

type Local = {
  id: string; institution_id: string; owner_id: string | null;
  nome: string; nome_fantasia: string | null; cnpj: string | null; tipo: string;
  endereco: string | null; numero: string | null; bairro: string | null;
  cidade: string | null; estado: string | null; cep: string | null;
  telefone: string | null; email: string | null;
  logo_url: string | null; grupo_anestesia: string | null; logo_grupo_url: string | null;
  observacoes: string | null; ativo: boolean; oculto?: boolean; oculto_por?: string | null;
};

const VAZIO = {
  nome: "", nome_fantasia: "", cnpj: "", tipo: "hospital",
  endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
  telefone: "", email: "", grupo_anestesia: "", observacoes: "",
  logo_url: "", logo_grupo_url: "",
};

type Confirmacao =
  | { tipo: "visibilidade"; local: Local }
  | { tipo: "arquivo"; local: Local }
  | { tipo: "excluir"; local: Local };

export function LocaisAdmin({
  institutionId, perfilId, podeCompartilhar, nomesDosPerfis, abrirNovo,
}: {
  institutionId: string;
  perfilId: string;
  podeCompartilhar: boolean;
  /** Para dizer DE QUEM é um local particular ou quem o escondeu. */
  nomesDosPerfis?: Map<string, string>;
  /** Muda quando alguém de fora pede o formulário de local novo (ação rápida). */
  abrirNovo?: number;
}) {
  const [locais, setLocais] = useState<Local[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Local | "novo" | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [menu, setMenu] = useState("");
  const [confirmando, setConfirmando] = useState<Confirmacao | null>(null);
  const [erroDaConfirmacao, setErroDaConfirmacao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [abrirNovoVisto, setAbrirNovoVisto] = useState(abrirNovo);
  if (abrirNovo !== abrirNovoVisto) { setAbrirNovoVisto(abrirNovo); if (abrirNovo) setEditando("novo"); }

  const carregar = useMemo(() => async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("locais_atendimento").select("*")
      .eq("institution_id", institutionId)
      .order("ativo", { ascending: false }).order("nome");
    setCarregando(false);
    if (error) { setErro("Não foi possível carregar os locais. Recarregue a página para tentar de novo."); return; }
    setLocais((data ?? []) as Local[]);
  }, [institutionId]);

  useEffect(() => { void carregar(); }, [carregar]);

  // O menu "Mais ações" fecha com Esc e com clique fora.
  useEffect(() => {
    if (!menu) return;
    const fechar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest?.(".locaisMenu")) setMenu("");
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", fechar);
    return () => { document.removeEventListener("mousedown", fechar); document.removeEventListener("keydown", fechar); };
  }, [menu]);

  const nome = (id: string | null | undefined) => (id && nomesDosPerfis?.get(id)) || "outra pessoa";

  /** Quem enxerga o local — dito com as palavras de quem administra. */
  function visibilidade(local: Local): { rotulo: string; explicacao: string } {
    if (local.owner_id) {
      return local.owner_id === perfilId
        ? { rotulo: "Só para mim", explicacao: "Local particular seu: só você o escolhe." }
        : { rotulo: `Particular de ${nome(local.owner_id)}`, explicacao: "Local particular: só quem o cadastrou o escolhe." };
    }
    if (local.oculto) {
      return local.oculto_por === perfilId
        ? { rotulo: "Só para mim", explicacao: "Escondido da equipe por você. Você e o proprietário continuam vendo." }
        : { rotulo: "Oculto da equipe", explicacao: `Escondido por ${nome(local.oculto_por)}. Só essa pessoa e o proprietário veem.` };
    }
    return { rotulo: "Compartilhado com a equipe", explicacao: "Toda a equipe pode escolher este local." };
  }

  async function confirmar() {
    if (!confirmando) return;
    const { tipo, local } = confirmando;
    setOcupado(true); setErroDaConfirmacao(""); setErro(""); setMensagem("");
    const supabase = createClient();
    if (tipo === "excluir") {
      const { data, error } = await supabase.rpc("excluir_local", { p_local_id: local.id });
      setOcupado(false);
      if (error) { setErroDaConfirmacao(error.message); return; }
      const resposta = String(data ?? "");
      setMensagem(resposta.startsWith("arquivado")
        ? `"${nomeDoLocal(local)}" foi arquivado, não excluído: existem ${resposta.split(":")[1]} avaliação(ões) vinculadas a ele. Os documentos antigos continuam corretos.`
        : `"${nomeDoLocal(local)}" foi excluído.`);
    } else if (tipo === "visibilidade") {
      // Quem escondeu vai junto: é dele — e do dono da organização — que o
      // local continua visível. A regra de verdade está no banco, em
      // meus_locais() e na política de leitura; aqui é só o gesto.
      const { error } = await supabase.from("locais_atendimento")
        .update({ oculto: !local.oculto, oculto_por: local.oculto ? null : perfilId, updated_at: new Date().toISOString() })
        .eq("id", local.id);
      setOcupado(false);
      if (error) { setErroDaConfirmacao("Não foi possível alterar a visibilidade deste local."); return; }
      setMensagem(local.oculto
        ? `"${nomeDoLocal(local)}" agora aparece para a equipe.`
        : `"${nomeDoLocal(local)}" ficou só para você. Os plantões já lançados continuam lá.`);
    } else {
      const { error } = await supabase.from("locais_atendimento")
        .update({ ativo: !local.ativo, updated_at: new Date().toISOString() })
        .eq("id", local.id);
      setOcupado(false);
      if (error) { setErroDaConfirmacao("Não foi possível alterar a situação deste local."); return; }
      setMensagem(local.ativo
        ? `"${nomeDoLocal(local)}" arquivado. Não aceita avaliação nova; as antigas continuam abrindo.`
        : `"${nomeDoLocal(local)}" reativado.`);
    }
    setConfirmando(null);
    void carregar();
  }

  if (carregando) return <div className="emptyClinical compactEmpty" aria-live="polite">Carregando locais…</div>;

  const podeMudarVisibilidade = (local: Local) => !local.owner_id;

  return (
    <div className="locaisAdmin">
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
      {mensagem && <p className="financeSuccess" role="status">{mensagem}</p>}

      <div className="locaisAdminTopo">
        <p>
          Os locais aparecem na escolha de onde trabalhar, na coluna da Escala e no cabeçalho das
          fichas, termos e orientações. A lista e cada local valem para a organização inteira.
        </p>
        <button className="primaryClinical compact" onClick={() => setEditando("novo")}>+ Novo local</button>
      </div>

      {locais.length === 0 ? (
        <div className="emptyClinical">
          <strong>Nenhum local cadastrado ainda.</strong>
          Cadastre o hospital ou a clínica onde a equipe atende: é o que aparece na escolha de local e no cabeçalho dos documentos.
        </div>
      ) : (
        <ul className="locaisLista">
          {locais.map((local) => {
            const vis = visibilidade(local);
            return (
              <li className={`locaisLinha${local.ativo ? "" : " arquivado"}`} key={local.id}>
                <span className="localMarca" aria-hidden="true">
                  {local.logo_url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={local.logo_url} alt="" />
                    : <b>{nomeDoLocal(local).slice(0, 2).toUpperCase()}</b>}
                </span>
                <span className="localTexto">
                  <strong>{nomeDoLocal(local)}</strong>
                  <small>{local.cidade ? `${local.cidade}${local.estado ? `/${local.estado}` : ""}` : "Cidade não informada"}</small>
                </span>
                <dl className="localCampos">
                  <div><dt>Tipo</dt><dd>{rotuloDoTipo(local.tipo)}</dd></div>
                  <div><dt>Organização vinculada</dt><dd>{local.grupo_anestesia || "—"}</dd></div>
                  <div><dt>Visibilidade</dt><dd title={vis.explicacao}>{vis.rotulo}</dd></div>
                  <div><dt>Situação</dt><dd><span className={`statusChip ${local.ativo ? "present" : "waiting"}`}>{local.ativo ? "Ativo" : "Arquivado"}</span></dd></div>
                </dl>
                <div className="locaisAcoes">
                  <button className="outlineClinical" onClick={() => setEditando(local)}>Editar</button>
                  <span className="locaisMenu">
                    <button type="button" className="outlineClinical" aria-haspopup="menu" aria-expanded={menu === local.id}
                      aria-label={`Mais ações para ${nomeDoLocal(local)}`}
                      onClick={() => setMenu(menu === local.id ? "" : local.id)}>Mais ações ▾</button>
                    {menu === local.id && (
                      <span className="locaisMenuLista" role="menu">
                        {podeMudarVisibilidade(local) && (
                          <button type="button" role="menuitem" autoFocus
                            onClick={() => { setMenu(""); setErroDaConfirmacao(""); setConfirmando({ tipo: "visibilidade", local }); }}>
                            {local.oculto ? "Compartilhar com a equipe" : "Deixar só para mim"}
                          </button>
                        )}
                        <button type="button" role="menuitem" autoFocus={!podeMudarVisibilidade(local)}
                          onClick={() => { setMenu(""); setErroDaConfirmacao(""); setConfirmando({ tipo: "arquivo", local }); }}>
                          {local.ativo ? "Arquivar" : "Reativar"}
                        </button>
                        <button type="button" role="menuitem" className="perigo"
                          onClick={() => { setMenu(""); setErroDaConfirmacao(""); setConfirmando({ tipo: "excluir", local }); }}>
                          Excluir…
                        </button>
                      </span>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmando && (
        <Dialogo
          titulo={confirmando.tipo === "visibilidade"
            ? (confirmando.local.oculto ? `Compartilhar "${nomeDoLocal(confirmando.local)}" com a equipe?` : `Deixar "${nomeDoLocal(confirmando.local)}" só para você?`)
            : confirmando.tipo === "arquivo"
              ? (confirmando.local.ativo ? `Arquivar "${nomeDoLocal(confirmando.local)}"?` : `Reativar "${nomeDoLocal(confirmando.local)}"?`)
              : `Excluir "${nomeDoLocal(confirmando.local)}"?`}
          confirmar={confirmando.tipo === "excluir" ? "Excluir" : confirmando.tipo === "arquivo" ? (confirmando.local.ativo ? "Arquivar" : "Reativar") : "Confirmar"}
          perigo={confirmando.tipo === "excluir"}
          ocupado={ocupado} erro={erroDaConfirmacao}
          onConfirmar={() => void confirmar()} onCancelar={() => setConfirmando(null)}>
          <ul className="admEfeitos">
            {confirmando.tipo === "visibilidade" && (confirmando.local.oculto ? <>
              <li><b>Equipe:</b> todos passam a ver este local.</li>
              <li><b>Escolha de local:</b> volta a aparecer para todos na entrada.</li>
              <li><b>Escala:</b> a coluna deste local volta a aparecer para a equipe.</li>
            </> : <>
              <li><b>Equipe:</b> só você e o proprietário continuam vendo — inclusive outros administradores deixam de ver.</li>
              <li><b>Escolha de local:</b> some da escolha de onde trabalhar para os outros.</li>
              <li><b>Escala:</b> a coluna some para os outros; os plantões já lançados continuam registrados.</li>
            </>)}
            {confirmando.tipo === "arquivo" && (confirmando.local.ativo ? <>
              <li><b>Equipe:</b> ninguém escolhe mais este local para atender.</li>
              <li><b>Escolha de local:</b> sai da lista de onde trabalhar.</li>
              <li><b>Histórico:</b> avaliações, fichas e plantões antigos continuam abrindo com este local.</li>
            </> : <>
              <li><b>Equipe:</b> volta a poder escolher este local, conforme a visibilidade dele.</li>
              <li><b>Escolha de local:</b> volta à lista de onde trabalhar.</li>
            </>)}
            {confirmando.tipo === "excluir" && <>
              <li><b>Sem avaliações vinculadas:</b> o local é apagado.</li>
              <li><b>Com avaliações:</b> ele é arquivado em vez de apagado, para os documentos antigos continuarem apontando para um local que existe.</li>
              <li><b>Escala e escolha de local:</b> ele sai das duas.</li>
            </>}
          </ul>
          <p className="admEscopoTexto">Aplica-se a este local, para toda a organização.</p>
        </Dialogo>
      )}

      {editando && (
        <FormularioCompleto
          local={editando === "novo" ? null : editando}
          institutionId={institutionId}
          perfilId={perfilId}
          podeCompartilhar={podeCompartilhar}
          onFechar={() => setEditando(null)}
          onSalvo={(texto) => { setEditando(null); setMensagem(texto); void carregar(); }}
        />
      )}
    </div>
  );
}

function FormularioCompleto({
  local, institutionId, perfilId, podeCompartilhar, onFechar, onSalvo,
}: {
  local: Local | null;
  institutionId: string;
  perfilId: string;
  podeCompartilhar: boolean;
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
}) {
  const [form, setForm] = useState(() => local
    ? Object.fromEntries(Object.keys(VAZIO).map((k) => [k, (local as unknown as Record<string, string | null>)[k] ?? ""])) as typeof VAZIO
    : { ...VAZIO });
  const [compartilhado, setCompartilhado] = useState(local ? local.owner_id === null : podeCompartilhar);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const campo = (k: keyof typeof VAZIO) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value }),
  });

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form.nome.trim()) { setErro("Informe o nome do local."); return; }
    setSalvando(true); setErro("");

    const supabase = createClient();
    const dados = {
      nome: form.nome.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cnpj: form.cnpj.trim() || null,
      tipo: form.tipo,
      endereco: form.endereco.trim() || null,
      numero: form.numero.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim().toUpperCase() || null,
      cep: form.cep.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      grupo_anestesia: form.grupo_anestesia.trim() || null,
      observacoes: form.observacoes.trim() || null,
      logo_url: form.logo_url || null,
      logo_grupo_url: form.logo_grupo_url || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = local
      ? await supabase.from("locais_atendimento").update(dados).eq("id", local.id)
      : await supabase.from("locais_atendimento").insert({
          ...dados, institution_id: institutionId,
          owner_id: compartilhado && podeCompartilhar ? null : perfilId,
          created_by: perfilId,
        });

    setSalvando(false);
    if (error) {
      setErro(error.code === "23505"
        ? "Já existe um local com esse nome nesta organização."
        : "Não foi possível salvar. Confira os campos e tente de novo.");
      return;
    }
    onSalvo(local ? "Local atualizado." : "Local cadastrado.");
  }

  return (
    <div className="patientModalBackdrop" role="presentation">
      <section className="localModal largo" role="dialog" aria-modal="true" aria-labelledby="local-form">
        <div className="patientModalHead">
          <div>
            <h2 id="local-form">{local ? "Editar local" : "Novo local de atendimento"}</h2>
            <p>O que estiver em branco simplesmente não aparece nos documentos. <span className="admEscopo local">Aplica-se a este local</span></p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {erro && <p className="clinicalError">{erro}</p>}

        <form onSubmit={salvar}>
          <h3 className="localFormTitulo">Identificação</h3>
          <div className="localFormGrade">
            <label className="clinicalField wide"><span>Nome / razão social *</span><input {...campo("nome")} autoFocus /></label>
            <label className="clinicalField wide"><span>Nome fantasia</span><input {...campo("nome_fantasia")} placeholder="É este que aparece no cabeçalho, quando preenchido" /></label>
            <label className="clinicalField span2"><span>CNPJ</span><input {...campo("cnpj")} /></label>
            <label className="clinicalField span2">
              <span>Tipo</span>
              <select {...campo("tipo")}>
                {TIPOS_DE_LOCAL.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
          </div>

          <h3 className="localFormTitulo">Endereço</h3>
          <div className="localFormGrade">
            <label className="clinicalField wide"><span>Logradouro</span><input {...campo("endereco")} /></label>
            <label className="clinicalField"><span>Número</span><input {...campo("numero")} /></label>
            <label className="clinicalField"><span>Bairro</span><input {...campo("bairro")} /></label>
            <label className="clinicalField span2"><span>Cidade</span><input {...campo("cidade")} /></label>
            <label className="clinicalField"><span>UF</span><input {...campo("estado")} maxLength={2} /></label>
            <label className="clinicalField"><span>CEP</span><input {...campo("cep")} /></label>
          </div>

          <h3 className="localFormTitulo">Contato</h3>
          <div className="localFormGrade">
            <label className="clinicalField span2"><span>Telefone</span><input {...campo("telefone")} /></label>
            <label className="clinicalField span2"><span>E-mail</span><input {...campo("email")} type="email" /></label>
          </div>

          <h3 className="localFormTitulo">Grupo de anestesia e marcas</h3>
          <div className="localFormGrade">
            <label className="clinicalField wide"><span>Nome do grupo de anestesia</span><input {...campo("grupo_anestesia")} /></label>
          </div>
          <div className="localMarcas">
            <EnvioDeMarca
              rotulo="Logo da instituição" institutionId={institutionId}
              valor={form.logo_url} onMudar={(url) => setForm({ ...form, logo_url: url })}
            />
            <EnvioDeMarca
              rotulo="Logo do grupo" institutionId={institutionId}
              valor={form.logo_grupo_url} onMudar={(url) => setForm({ ...form, logo_grupo_url: url })}
            />
          </div>

          <h3 className="localFormTitulo">Observações</h3>
          <label className="clinicalField wide">
            <span className="visuallyHidden">Observações</span>
            <textarea className="localObs" rows={3} {...campo("observacoes")} />
          </label>

          {podeCompartilhar && !local && (
            <label className="localCompartilhar">
              <input type="checkbox" checked={compartilhado} onChange={(e) => setCompartilhado(e.target.checked)} />
              <span>
                <strong>Compartilhar com a equipe</strong>
                <small>Todos da organização poderão escolher este local. Desmarque para deixá-lo só seu.</small>
              </span>
            </label>
          )}

          <div className="modalActions">
            <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="primaryClinical compact" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Envio de uma marca.
 *
 * O arquivo vai para marcas/<organização>/..., e é a primeira pasta que a
 * política do Storage confere — por isso o caminho não é montado com o nome do
 * arquivo escolhido pela pessoa, que poderia conter barras e sair da pasta.
 */
function EnvioDeMarca({
  rotulo, institutionId, valor, onMudar,
}: {
  rotulo: string;
  institutionId: string;
  valor: string;
  onMudar: (url: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(arquivo: File) {
    setErro("");
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro("A imagem precisa ter no máximo 2 MB.");
      return;
    }
    setEnviando(true);
    const supabase = createClient();
    const extensao = (arquivo.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const caminho = `${institutionId}/${crypto.randomUUID()}.${extensao}`;
    const { error } = await supabase.storage.from("marcas")
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    setEnviando(false);
    if (error) { setErro("Não foi possível enviar a imagem."); return; }
    const { data } = supabase.storage.from("marcas").getPublicUrl(caminho);
    onMudar(data.publicUrl);
  }

  return (
    <div className="localMarcaCampo">
      <span className="localMarcaRotulo">{rotulo}</span>
      <div className="localMarcaCaixa">
        {valor
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={valor} alt={`${rotulo} enviada`} />
          : <span className="localMarcaPlaceholder"><Icone nome="imprimir" tamanho={20} /></span>}
      </div>
      <div className="localMarcaAcoes">
        <button type="button" className="outlineClinical" disabled={enviando}
          onClick={() => entrada.current?.click()}>
          {enviando ? "Enviando…" : valor ? "Trocar" : "Enviar"}
        </button>
        {valor && (
          <button type="button" className="outlineClinical red" onClick={() => onMudar("")}>
            Remover
          </button>
        )}
      </div>
      <input
        ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="visuallyHidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void enviar(f); e.target.value = ""; }}
      />
      {erro && <small className="localMarcaErro">{erro}</small>}
      <small className="localMarcaDica">PNG ou JPG, até 2 MB. Fundo transparente imprime melhor.</small>
    </div>
  );
}
