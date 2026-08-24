"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
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
  observacoes: string | null; ativo: boolean; oculto?: boolean;
};

const VAZIO = {
  nome: "", nome_fantasia: "", cnpj: "", tipo: "hospital",
  endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "",
  telefone: "", email: "", grupo_anestesia: "", observacoes: "",
  logo_url: "", logo_grupo_url: "",
};

export function LocaisAdmin({
  institutionId, perfilId, podeCompartilhar,
}: {
  institutionId: string;
  perfilId: string;
  podeCompartilhar: boolean;
}) {
  const [locais, setLocais] = useState<Local[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Local | "novo" | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useMemo(() => async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("locais_atendimento").select("*")
      .eq("institution_id", institutionId)
      .order("ativo", { ascending: false }).order("nome");
    setCarregando(false);
    if (error) { setErro("Não foi possível carregar os locais."); return; }
    setLocais((data ?? []) as Local[]);
  }, [institutionId]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function excluir(local: Local) {
    if (!confirm(`Excluir "${nomeDoLocal(local)}"?\n\nSe já houver avaliações neste local, ele será arquivado em vez de excluído — o histórico precisa continuar apontando para um local que existe.`)) return;
    setErro(""); setMensagem("");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("excluir_local", { p_local_id: local.id });
    if (error) { setErro(error.message); return; }
    const resposta = String(data ?? "");
    setMensagem(resposta.startsWith("arquivado")
      ? `"${nomeDoLocal(local)}" foi arquivado: existem ${resposta.split(":")[1]} avaliação(ões) vinculadas a ele. Ele some da escolha, e os documentos antigos continuam corretos.`
      : `"${nomeDoLocal(local)}" foi excluído.`);
    void carregar();
  }

  /**
   * Mostrar ou esconder da equipe.
   *
   * Diferente de arquivar, e por isso é outro botão. Arquivar é "não usamos
   * mais aqui" e esconde de todos, inclusive de quem administra — o local sai
   * da coluna da Escala e não há onde montar a escala dele. Em preparação é
   * "ainda não contamos para ninguém": quem administra continua vendo e
   * montando; para a equipe o hospital ainda não existe.
   *
   * A regra de verdade está no banco, em meus_locais() e na policy de leitura.
   * Aqui é só o gesto.
   */
  async function alternarOculto(local: Local) {
    const supabase = createClient();
    const { error } = await supabase.from("locais_atendimento")
      .update({ oculto: !local.oculto, updated_at: new Date().toISOString() })
      .eq("id", local.id);
    if (error) { setErro("Não foi possível alterar a visibilidade deste local."); return; }
    setMensagem(local.oculto
      ? `"${nomeDoLocal(local)}" agora aparece para a equipe.`
      : `"${nomeDoLocal(local)}" ficou só para quem administra. Ele some da escolha de local e da coluna da Escala para os demais; os plantões já lançados continuam lá.`);
    void carregar();
  }

  async function alternarArquivo(local: Local) {
    const supabase = createClient();
    const { error } = await supabase.from("locais_atendimento")
      .update({ ativo: !local.ativo, updated_at: new Date().toISOString() })
      .eq("id", local.id);
    if (error) { setErro("Não foi possível alterar a situação deste local."); return; }
    setMensagem(local.ativo
      ? `"${nomeDoLocal(local)}" arquivado. Não aceita avaliação nova; as antigas continuam abrindo.`
      : `"${nomeDoLocal(local)}" reativado.`);
    void carregar();
  }

  if (carregando) return <div className="emptyClinical compactEmpty">Carregando locais…</div>;

  return (
    <div className="locaisAdmin">
      {erro && <p className="clinicalError">{erro}</p>}
      {mensagem && <p className="financeSuccess" role="status">{mensagem}</p>}

      <div className="locaisAdminTopo">
        <p>
          Os locais aparecem na tela de escolha depois do login e saem automaticamente
          nas fichas, nos termos e nas orientações.
        </p>
        <button className="primaryClinical compact" onClick={() => setEditando("novo")}>
          + Novo local
        </button>
      </div>

      {locais.length === 0 ? (
        <div className="emptyClinical">Nenhum local cadastrado ainda.</div>
      ) : locais.map((local) => (
        <div className={`locaisLinha${local.ativo ? "" : " arquivado"}`} key={local.id}>
          <span className="localMarca" aria-hidden="true">
            {local.logo_url
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={local.logo_url} alt="" />
              : <b>{nomeDoLocal(local).slice(0, 2).toUpperCase()}</b>}
          </span>
          <span className="localTexto">
            <strong>{nomeDoLocal(local)}</strong>
            <small>
              {rotuloDoTipo(local.tipo)}
              {local.cidade ? ` · ${local.cidade}${local.estado ? `/${local.estado}` : ""}` : ""}
              {local.grupo_anestesia ? ` · ${local.grupo_anestesia}` : ""}
            </small>
          </span>
          {local.owner_id && <span className="statusChip paused">Particular</span>}
          {!local.ativo && <span className="statusChip waiting">Arquivado</span>}
          {local.oculto && <span className="statusChip waiting"
            title="Só quem administra a organização enxerga este local. Ele não aparece na escolha de onde trabalhar nem na coluna da Escala para os demais.">
            Em preparação</span>}
          <div className="locaisAcoes">
            <button className="outlineClinical" onClick={() => setEditando(local)}>Editar</button>
            <button className="outlineClinical" onClick={() => void alternarOculto(local)}
              title={local.oculto
                ? "Passa a aparecer para toda a equipe"
                : "Fica só para quem administra, enquanto o local está sendo preparado"}>
              {local.oculto ? "Mostrar à equipe" : "Ocultar da equipe"}
            </button>
            <button className="outlineClinical" onClick={() => void alternarArquivo(local)}>
              {local.ativo ? "Arquivar" : "Reativar"}
            </button>
            <button className="outlineClinical red" onClick={() => void excluir(local)}>Excluir</button>
          </div>
        </div>
      ))}

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
            <p>O que estiver em branco simplesmente não aparece nos documentos.</p>
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
