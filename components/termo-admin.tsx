"use client";

import { type TextareaHTMLAttributes, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { EtiquetaDeEscopo, Gaveta } from "@/components/admin-ui";
import {
  MARCACOES, aplicarDados, copiaDoPadrao, ehOPadrao, limpar, problemasDoTermo,
  type TermoDeConsentimento, type VersaoDoTermo,
} from "@/lib/termo-consentimento";

// A edição do termo de consentimento anestésico.
//
// O termo é documento jurídico DA ORGANIZAÇÃO, não da plataforma. Cada serviço
// tem o seu, revisado pelo advogado dele, e até aqui não havia como trocar uma
// palavra sem mexer no sistema.
//
// DUAS COISAS QUE ESTA TELA PRECISA DEIXAR CLARAS, porque errar qualquer uma
// delas é errar um documento assinado:
//
//   1. O que já vem do cadastro NÃO se digita aqui. Nome e logo do local,
//      cidade, nome do paciente — tudo isso o sistema monta sozinho, na ficha e
//      no termo, com o que foi cadastrado uma vez. Quem quiser citar esses
//      dados DENTRO do texto usa as marcações de {{chave}}.
//
//   2. Editar não reescreve o passado. Cada gravação é uma versão nova, e as
//      avaliações já concluídas continuam imprimindo o texto que foi assinado.
//
// Salvar INSERE; nunca atualiza nem apaga. O banco também não deixaria — ver
// supabase/migrations/202609140001_termo_editavel.sql.

type Registro = VersaoDoTermo & { criado_por: string | null };

/**
 * Campo de texto que cresce com o conteúdo.
 *
 * Um `rows={3}` fixo cortava o parágrafo no meio — e não um parágrafo
 * qualquer: são as frases jurídicas mais longas do sistema, de trinta a
 * cinquenta palavras. Revisar um termo espiando três linhas por vez, com
 * barra de rolagem dentro de cada caixa, é o tipo de tela que faz a pessoa
 * desistir de conferir — que é justamente o que ela veio fazer aqui.
 *
 * Feito na mão e não com `field-sizing:content`, que resolveria em uma linha
 * de CSS mas ainda não existe no Safari — e metade dos anestesiologistas
 * abre isto no iPad.
 */
function CampoQueCresce(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ajustar = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    // O "auto" antes é obrigatório: sem ele a caixa só sabe crescer, e apagar
    // texto deixaria o espaço vazio de antes.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  return <textarea {...props} ref={ajustar}
    onInput={(e) => ajustar(e.currentTarget)}/>;
}

/** Rótulo do número que este item vai receber no papel impresso. */
const numeroDoItem = (indice: number, total: number) =>
  indice < 2 ? indice + 2 : Math.min(total, 2) + 3 + (indice - 2);

export function TermoAdmin({
  institutionId, perfilId, podeEditar, nomesDosPerfis,
}: {
  institutionId: string;
  perfilId: string;
  /**
   * Só proprietário e administrador de verdade — pelo `role`, e não pelas
   * permissões extras. É a MESMA regra que a política do banco aplica, e é de
   * propósito que a tela não seja mais generosa: um botão que sempre devolve
   * erro de permissão é pior do que um botão que não existe.
   */
  podeEditar: boolean;
  nomesDosPerfis: Map<string, string>;
}) {
  const [versoes, setVersoes] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rascunho, setRascunho] = useState<TermoDeConsentimento>(() => copiaDoPadrao());
  const [gravado, setGravado] = useState<TermoDeConsentimento>(() => copiaDoPadrao());
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [previa, setPrevia] = useState<"rascunho" | "vigente" | null>(null);

  const carregar = useMemo(() => async () => {
    const { data, error } = await createClient()
      .from("termos_consentimento")
      .select("itens,riscos,autorizacao,criado_em,criado_por")
      .eq("institution_id", institutionId)
      .order("criado_em", { ascending: false });
    setCarregando(false);
    if (error) { setErro("Não foi possível carregar o termo desta organização."); return; }
    const lista = (data ?? []) as Registro[];
    setVersoes(lista);
    // Em vigor é a mais recente; sem nenhuma, o texto de fábrica. A tela abre
    // sempre no que está valendo, e não numa folha em branco: editar um termo é
    // quase sempre mexer numa frase, não escrever tudo de novo.
    const atual: TermoDeConsentimento = lista.length
      ? { itens: [...lista[0].itens], riscos: [...lista[0].riscos], autorizacao: lista[0].autorizacao }
      : copiaDoPadrao();
    setGravado(atual);
    setRascunho({ itens: [...atual.itens], riscos: [...atual.riscos], autorizacao: atual.autorizacao });
  }, [institutionId]);

  // Carga inicial. O estado só muda depois da volta do banco, e não em cascata
  // de renderização — que é o que a regra abaixo existe para pegar.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- ver acima
  useEffect(() => { void carregar(); }, [carregar]);

  const mudou = JSON.stringify(limpar(rascunho)) !== JSON.stringify(limpar(gravado));
  const problemas = problemasDoTermo(rascunho);

  function mexerNaLista(campo: "itens" | "riscos", como: (lista: string[]) => string[]) {
    setRascunho((r) => ({ ...r, [campo]: como([...r[campo]]) }));
    setMensagem(""); setErro("");
  }

  async function salvar(): Promise<boolean> {
    const limpo = limpar(rascunho);
    if (problemasDoTermo(limpo).length) return false;
    setSalvando(true); setMensagem(""); setErro("");
    const { error } = await createClient().from("termos_consentimento").insert({
      institution_id: institutionId,
      itens: limpo.itens, riscos: limpo.riscos, autorizacao: limpo.autorizacao,
      criado_por: perfilId,
    });
    setSalvando(false);
    if (error) { setErro(`Não foi possível publicar o termo: ${error.message}`); return false; }
    setMensagem("Termo salvo. Vale para as avaliações concluídas de agora em diante; "
      + "as já concluídas continuam imprimindo o texto que foi assinado.");
    await carregar();
    return true;
  }

  if (carregando) return <section className="clinicalPanel"><div className="emptyClinical compactEmpty">Carregando o termo...</div></section>;

  const desativado = !podeEditar;

  return <section className="clinicalPanel termoAdmin">
    <div className="panelTitle">
      <strong>Termo de consentimento anestésico</strong>
      <span>{versoes.length
        ? `versão ${versoes.length} em vigor desde ${new Date(versoes[0].criado_em).toLocaleDateString("pt-BR")}`
        : "texto padrão do AVANEST (nenhuma versão própria)"}</span>
    </div>
    <div className="termoEscopo">
      <EtiquetaDeEscopo escopo="organizacao" />
      <button type="button" className="outlineClinical compact" onClick={() => setPrevia("vigente")}>Visualizar o termo em vigor</button>
    </div>

    {/* A resposta à pergunta que a pessoa faz antes de digitar qualquer coisa:
        "e o nome da minha clínica, eu escrevo onde?". Em lugar nenhum — ele já
        sai. Dito aqui, antes dos campos, evita o termo com o nome digitado à
        mão que passa a mentir no dia em que o cadastro mudar. */}
    <div className="termoAviso">
      <p><b>O cadastro já preenche sozinho.</b> Nome e logo do local, cidade, nome do paciente e a
        data saem no cabeçalho e na abertura do termo a partir do que está em <i>Locais de
        atendimento</i> e no cadastro do paciente — não precisa (nem deve) digitar aqui.
        Para citar algum deles dentro do texto, escreva a marcação:</p>
      <ul className="termoMarcacoes">
        {MARCACOES.map((m) => <li key={m.chave}><code>{`{{${m.chave}}}`}</code> {m.descricao}</li>)}
      </ul>
    </div>

    <div className="termoAviso cuidado">
      <p><b>Editar não muda o que já foi assinado.</b> Cada gravação cria uma versão nova. Uma
        avaliação concluída em março reimprime o termo de março, sempre — é o texto que aquele
        paciente assinou. O que você escrever aqui vale para as próximas.</p>
    </div>

    {mensagem && <p className="financeSuccess">{mensagem}</p>}
    {erro && <p className="clinicalError">{erro}</p>}
    {desativado && <p className="pendingNotice">Só o proprietário ou um administrador da
      organização pode alterar o termo. Você pode ler o texto em vigor abaixo.</p>}

    <h4 className="termoSecao">Itens numerados</h4>
    <p className="termoAjuda">O item 1 é a abertura, montada com o nome do paciente e do local.
      Estes vêm depois dele; a lista de riscos entra no meio, logo após os dois primeiros.</p>
    <ol className="termoLista">
      {rascunho.itens.map((texto, i) => <li key={i}>
        <span className="termoNumero">{numeroDoItem(i, rascunho.itens.length)}</span>
        <CampoQueCresce value={texto} disabled={desativado} rows={2}
          aria-label={`Item ${numeroDoItem(i, rascunho.itens.length)} do termo`}
          onChange={(e) => mexerNaLista("itens", (l) => { l[i] = e.target.value; return l; })}/>
        <span className="termoBotoes">
          <button type="button" disabled={desativado || i === 0} title="Subir"
            onClick={() => mexerNaLista("itens", (l) => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; return l; })}>↑</button>
          <button type="button" disabled={desativado || i === rascunho.itens.length - 1} title="Descer"
            onClick={() => mexerNaLista("itens", (l) => { [l[i + 1], l[i]] = [l[i], l[i + 1]]; return l; })}>↓</button>
          <button type="button" className="termoRemover" disabled={desativado} title="Remover item"
            onClick={() => mexerNaLista("itens", (l) => l.filter((_, k) => k !== i))}>×</button>
        </span>
      </li>)}
    </ol>
    <button type="button" className="outlineClinical compact" disabled={desativado}
      onClick={() => mexerNaLista("itens", (l) => [...l, ""])}>+ Acrescentar item</button>

    <h4 className="termoSecao">Riscos esclarecidos</h4>
    <p className="termoAjuda">Saem como o item {Math.min(rascunho.itens.length, 2) + 2}, em lista.</p>
    <ol className="termoLista">
      {rascunho.riscos.map((texto, i) => <li key={i}>
        <span className="termoNumero">•</span>
        <CampoQueCresce value={texto} disabled={desativado} rows={2}
          aria-label={`Risco ${i + 1} do termo`}
          onChange={(e) => mexerNaLista("riscos", (l) => { l[i] = e.target.value; return l; })}/>
        <span className="termoBotoes">
          <button type="button" disabled={desativado || i === 0} title="Subir"
            onClick={() => mexerNaLista("riscos", (l) => { [l[i - 1], l[i]] = [l[i], l[i - 1]]; return l; })}>↑</button>
          <button type="button" disabled={desativado || i === rascunho.riscos.length - 1} title="Descer"
            onClick={() => mexerNaLista("riscos", (l) => { [l[i + 1], l[i]] = [l[i], l[i + 1]]; return l; })}>↓</button>
          <button type="button" className="termoRemover" disabled={desativado} title="Remover risco"
            onClick={() => mexerNaLista("riscos", (l) => l.filter((_, k) => k !== i))}>×</button>
        </span>
      </li>)}
    </ol>
    <button type="button" className="outlineClinical compact" disabled={desativado}
      onClick={() => mexerNaLista("riscos", (l) => [...l, ""])}>+ Acrescentar risco</button>

    <h4 className="termoSecao">Autorização</h4>
    <p className="termoAjuda">O parágrafo final, logo acima das linhas de assinatura.</p>
    <CampoQueCresce className="termoAutorizacao" rows={3} value={rascunho.autorizacao} disabled={desativado}
      aria-label="Parágrafo de autorização do termo"
      onChange={(e) => { setRascunho((r) => ({ ...r, autorizacao: e.target.value })); setMensagem(""); }}/>

    {problemas.length > 0 && <div className="pendingNotice">{problemas.join(" ")}</div>}

    <div className="termoAcoes">
      <div>
        <button type="button" className="outlineClinical compact" disabled={desativado || ehOPadrao(rascunho)}
          onClick={() => {
            if (!window.confirm("Substituir o texto em edição pelo termo padrão do AVANEST? "
              + "Nada é gravado agora — você ainda precisa salvar.")) return;
            setRascunho(copiaDoPadrao()); setMensagem(""); setErro("");
          }}>
          Usar o texto padrão
        </button>
        <button type="button" className="outlineClinical compact" disabled={desativado || !mudou}
          onClick={() => setRascunho({ itens: [...gravado.itens], riscos: [...gravado.riscos], autorizacao: gravado.autorizacao })}>
          Descartar alterações
        </button>
      </div>
      {/* Publicar passa pela prévia: é o texto que o paciente vai assinar. */}
      <button type="button" className="primaryClinical compact"
        disabled={desativado || !mudou || salvando || problemas.length > 0}
        onClick={() => setPrevia("rascunho")}>
        {salvando ? "Salvando..." : `Revisar e publicar a versão ${versoes.length + 1}`}
      </button>
    </div>

    {versoes.length > 0 && <div className="termoHistorico">
      <h4 className="termoSecao">Versões</h4>
      {/* Nenhuma delas abre para edição, e é de propósito: uma versão antiga é
          o texto de documentos assinados, e "restaurar" seria gravar uma versão
          nova igual a ela — que é justamente o que o botão de cima faz com o
          padrão. O histórico aqui serve para saber quem mudou o quê e quando. */}
      {versoes.map((v, i) => <div className="auditRow termoVersao" key={v.criado_em}>
        <time>{new Date(v.criado_em).toLocaleString("pt-BR")}</time>
        <span><strong>Versão {versoes.length - i} <span className={`statusChip ${i === 0 ? "present" : "paused"}`}>
          {i === 0 ? "Em vigor" : `Substituída em ${new Date(versoes[i - 1].criado_em).toLocaleDateString("pt-BR")}`}</span></strong>
          <small>{v.itens.length} itens · {v.riscos.length} riscos · por {(v.criado_por && nomesDosPerfis.get(v.criado_por)) || "—"}</small></span>
      </div>)}
      <p className="termoAjuda"><Icone nome="cadeado" tamanho={14}/> Versões antigas não são
        alteradas nem apagadas: são o texto dos termos já assinados.</p>
    </div>}

    {previa && <Gaveta largura="larga"
      titulo={previa === "rascunho" ? `Prévia da versão ${versoes.length + 1}` : "Termo em vigor"}
      subtitulo="Dados de exemplo no lugar do paciente e do local. No papel, saem os do atendimento."
      onPedirFechar={() => setPrevia(null)}
      rodape={previa === "rascunho" ? <>
        <button type="button" className="outlineClinical" onClick={() => setPrevia(null)} disabled={salvando}>Voltar a editar</button>
        <button type="button" className="primaryClinical compact" disabled={salvando}
          onClick={async () => { if (await salvar()) setPrevia(null); }}>
          {salvando ? "Publicando…" : `Publicar a versão ${versoes.length + 1}`}</button>
      </> : <button type="button" className="outlineClinical" onClick={() => setPrevia(null)}>Fechar</button>}>
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
      <PreviaDoTermo termo={previa === "rascunho" ? limpar(rascunho) : gravado} />
      {previa === "rascunho" && <p className="termoAjuda">Ao publicar, esta versão vale para as avaliações concluídas daqui em diante.
        As já concluídas continuam imprimindo o texto que foi assinado.</p>}
    </Gaveta>}
  </section>;
}

/**
 * O termo na ordem do papel impresso (print-documents): item 1 de abertura,
 * os dois primeiros itens, a lista de riscos, o resto dos itens e a
 * autorização. Com dados de exemplo, marcados como tais.
 */
function PreviaDoTermo({ termo }: { termo: TermoDeConsentimento }) {
  const dados = { clinica: "Hospital Exemplo", cidade: "Sua cidade", paciente: "Nome do paciente" };
  const t = (x: string) => aplicarDados(x, dados);
  const n = Math.min(termo.itens.length, 2);
  return <article className="termoPrevia">
    <h3>Termo de consentimento anestésico</h3>
    <p><b>1.</b> Por determinação explícita de minha vontade e em consideração ao meu interesse pessoal, eu: <b>{dados.paciente}</b></p>
    <p>Por este termo autorizo <b>{dados.clinica}</b> e os médicos anestesiologistas de sua equipe a realizar os procedimentos anestésicos necessários…</p>
    <ol start={2}>{termo.itens.slice(0, 2).map((x, i) => <li key={i}>{t(x)}</li>)}</ol>
    <p><b>{n + 2}. Os seguintes pontos me foram esclarecidos:</b></p>
    <ul>{termo.riscos.map((x, i) => <li key={i}>{t(x)}</li>)}</ul>
    <ol start={n + 3}>{termo.itens.slice(2).map((x, i) => <li key={i}>{t(x)}</li>)}</ol>
    <h4>Autorização</h4>
    <p>{t(termo.autorizacao)}</p>
  </article>;
}
