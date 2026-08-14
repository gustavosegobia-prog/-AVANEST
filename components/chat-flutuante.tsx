"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";

/**
 * O balão do canto: a conversa da equipe e o canal de suporte.
 *
 * São duas conversas com regras diferentes, e por isso duas abas:
 *
 *   Equipe   — uma sala por instituição. Recepção, médicos, financeiro e
 *              administração, todos juntos. É o mural do plantão. Quem é de
 *              outra clínica não vê nada; isso é decidido no banco, não aqui.
 *
 *   Suporte  — o caminho até quem cuida do AVANEST. Cada relato é um fio de
 *              conversa: a pessoa escreve, o suporte responde, ela lê a
 *              resposta. Nem o administrador da própria clínica enxerga o
 *              relato de um colega.
 *
 * Quem é do suporte vê a mesma aba do outro lado: a fila de todos os relatos,
 * de todas as clínicas, com o nome de quem escreveu e de onde.
 *
 * Nada aqui decide quem vê o quê. A tela pede, e o banco devolve o que aquela
 * pessoa pode ver — se este arquivo tivesse um erro de lógica, o pior que
 * aconteceria era a tela ficar vazia, nunca mostrar a conversa alheia.
 */

type Perfil = {
  id: string;
  nome: string;
  institution_id: string;
  super_admin?: boolean | null;
};

type MensagemSala = {
  id: string;
  texto: string;
  created_at: string;
  autor_id: string;
  autor_nome: string;
  autor_papel: string;
};

type Chamado = {
  id: string;
  assunto: string;
  status: string;
  created_at: string;
  ultima_em: string;
  autor_nome: string;
  clinica: string;
  sou_o_autor: boolean;
  nao_lidas: number;
};

type MensagemChamado = {
  id: string;
  texto: string;
  created_at: string;
  autor_nome: string;
  do_suporte: boolean;
  sou_eu: boolean;
};

const PAPEIS: Record<string, string> = {
  owner: "Proprietário", admin: "Administração", medico: "Anestesista",
  recepcao: "Recepção", financeiro: "Financeiro",
};

const ESTADOS: Record<string, string> = {
  aberto: "Aguardando resposta",
  respondido: "Respondido",
  resolvido: "Resolvido",
};

/** Hora curta para mensagem de hoje; data junto quando for de outro dia. */
function quando(iso: string) {
  const data = new Date(iso);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date();
  const mesmoDia =
    data.getDate() === hoje.getDate() &&
    data.getMonth() === hoje.getMonth() &&
    data.getFullYear() === hoje.getFullYear();
  return mesmoDia ? hora : `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

export function ChatFlutuante({ perfil }: { perfil: Perfil }) {
  const supabase = createClient();
  const suporte = perfil.super_admin === true;

  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"equipe" | "suporte">("equipe");

  const [mensagens, setMensagens] = useState<MensagemSala[]>([]);
  const [naoLidasSala, setNaoLidasSala] = useState(0);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [chamadoAberto, setChamadoAberto] = useState<string | null>(null);
  const [conversa, setConversa] = useState<MensagemChamado[]>([]);
  const [novoRelato, setNovoRelato] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const fimDaSala = useRef<HTMLDivElement | null>(null);
  const fimDaConversa = useRef<HTMLDivElement | null>(null);

  // ---------------------------------------------------------------------------
  // Leituras
  // ---------------------------------------------------------------------------
  const carregarSala = useCallback(async () => {
    const { data, error } = await supabase.rpc("sala_conversa", { p_limite: 80 });
    if (error) { setErro("Não consegui carregar a conversa."); return; }
    // O banco devolve da mais nova para a mais velha, porque é assim que o
    // índice responde rápido. Na tela a leitura é de cima para baixo.
    setMensagens(((data ?? []) as MensagemSala[]).slice().reverse());
    setErro("");
  }, [supabase]);

  const carregarNaoLidas = useCallback(async () => {
    const { data } = await supabase.rpc("sala_nao_lidas");
    setNaoLidasSala(typeof data === "number" ? data : 0);
  }, [supabase]);

  const carregarChamados = useCallback(async () => {
    const { data, error } = await supabase.rpc("chamados_visiveis");
    if (error) { setErro("Não consegui carregar os relatos."); return; }
    setChamados((data ?? []) as Chamado[]);
    setErro("");
  }, [supabase]);

  const carregarConversa = useCallback(async (chamadoId: string) => {
    const { data, error } = await supabase.rpc("chamado_conversa", { p_chamado_id: chamadoId });
    if (error) { setErro("Não consegui abrir este relato."); return; }
    setConversa((data ?? []) as MensagemChamado[]);
    setErro("");
  }, [supabase]);

  // ---------------------------------------------------------------------------
  // Tempo real
  //
  // Uma inscrição só, sempre ligada, inclusive com o balão fechado: é ela que
  // acende o contador. Ao receber um aviso a tela vai buscar de novo em vez de
  // aproveitar a linha que veio pelo socket — a linha crua não traz o nome de
  // quem escreveu, e uma busca de oitenta mensagens curtas custa pouco perto
  // de manter dois caminhos diferentes de montar a mesma lista.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canal = supabase
      .channel("avanest-conversas")
      .on("postgres_changes", { event: "*", schema: "public", table: "sala_mensagens" }, () => {
        void carregarSala();
        void carregarNaoLidas();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chamado_mensagens" }, () => {
        void carregarChamados();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chamados" }, () => {
        void carregarChamados();
      })
      .subscribe();

    return () => { void supabase.removeChannel(canal); };
  }, [supabase, carregarSala, carregarNaoLidas, carregarChamados]);

  // Um efeito só decide o que buscar e quando: agora, e de meio em meio
  // minuto enquanto a tela estiver aberta. Ele roda de novo a cada troca de
  // aba, o que já serve de primeira carga daquela aba — separar "carga
  // inicial" de "recarga periódica" em dois efeitos fazia as duas dispararem
  // juntas ao abrir o balão, buscando a mesma lista duas vezes.
  //
  // O relógio não substitui o tempo real, faz o contrário: é a rede que cai,
  // o aparelho que dorme, o socket que morre sem avisar. Sem esta rede de
  // segurança, alguém fica olhando para uma conversa parada achando que
  // ninguém respondeu.
  //
  // A lista de relatos é buscada sempre, mesmo com o balão fechado: é dela
  // que sai o aviso de "chegou um relato" no balão. Buscá-la só ao abrir
  // significava que quem cuida do AVANEST nunca ficava sabendo de um relato
  // sem antes ir procurar — que é exatamente o contrário de um aviso. São
  // poucas linhas, e o custo disso é menor que o de um problema não visto.
  //
  // A conversa da equipe, essa sim, espera o balão abrir: são oitenta
  // mensagens, e o contador já vem pronto do banco em um número só.
  useEffect(() => {
    const atualizar = () => {
      void carregarNaoLidas();
      void carregarChamados();
      if (aberto && aba === "equipe") void carregarSala();
    };
    atualizar();
    const relogio = window.setInterval(atualizar, 30000);
    return () => window.clearInterval(relogio);
  }, [aberto, aba, carregarNaoLidas, carregarSala, carregarChamados]);

  // Abrir a aba da equipe é ler a sala: marca a leitura e apaga o contador.
  useEffect(() => {
    if (!aberto || aba !== "equipe") return;
    const marcar = async () => {
      await supabase
        .from("sala_leitura")
        .upsert({ perfil_id: perfil.id, lido_em: new Date().toISOString() });
      setNaoLidasSala(0);
    };
    void marcar();
  }, [aberto, aba, mensagens.length, supabase, perfil.id]);

  useEffect(() => {
    if (aberto && aba === "equipe") fimDaSala.current?.scrollIntoView({ block: "end" });
  }, [aberto, aba, mensagens.length]);

  useEffect(() => {
    if (chamadoAberto) fimDaConversa.current?.scrollIntoView({ block: "end" });
  }, [chamadoAberto, conversa.length]);

  // ---------------------------------------------------------------------------
  // Escritas
  // ---------------------------------------------------------------------------
  async function enviarNaSala(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const campo = evento.currentTarget.elements.namedItem("texto") as HTMLTextAreaElement;
    const texto = campo.value.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    const { error } = await supabase.from("sala_mensagens").insert({
      institution_id: perfil.institution_id,
      autor_id: perfil.id,
      texto,
    });
    setEnviando(false);
    if (error) { setErro("A mensagem não foi enviada. Tente de novo."); return; }
    campo.value = "";
    setErro("");
    await carregarSala();
  }

  async function apagarDaSala(id: string) {
    const { error } = await supabase.from("sala_mensagens").delete().eq("id", id);
    if (error) { setErro("Não consegui apagar a mensagem."); return; }
    await carregarSala();
  }

  async function abrirRelato(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const assunto = (form.elements.namedItem("assunto") as HTMLInputElement).value.trim();
    const texto = (form.elements.namedItem("relato") as HTMLTextAreaElement).value.trim();
    if (enviando) return;
    setEnviando(true);
    const { error } = await supabase.rpc("abrir_chamado", { p_assunto: assunto, p_texto: texto });
    setEnviando(false);
    if (error) { setErro(error.message || "Não consegui enviar o relato."); return; }
    form.reset();
    setNovoRelato(false);
    setErro("");
    await carregarChamados();
  }

  async function responderChamado(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!chamadoAberto || enviando) return;
    const campo = evento.currentTarget.elements.namedItem("resposta") as HTMLTextAreaElement;
    const texto = campo.value.trim();
    if (!texto) return;
    setEnviando(true);
    const { error } = await supabase.from("chamado_mensagens").insert({
      chamado_id: chamadoAberto,
      autor_id: perfil.id,
      texto,
    });
    setEnviando(false);
    if (error) { setErro("A resposta não foi enviada. Tente de novo."); return; }
    campo.value = "";
    setErro("");
    await carregarConversa(chamadoAberto);
    await carregarChamados();
  }

  async function abrirChamado(id: string) {
    setChamadoAberto(id);
    setNovoRelato(false);
    await carregarConversa(id);
    await supabase.rpc("marcar_chamado_visto", { p_chamado_id: id });
    await carregarChamados();
  }

  async function marcarResolvido(id: string) {
    const { error } = await supabase.from("chamados").update({ status: "resolvido" }).eq("id", id);
    if (error) { setErro("Não consegui marcar como resolvido."); return; }
    await carregarChamados();
  }

  const naoLidasSuporte = chamados.reduce((soma, item) => soma + (item.nao_lidas || 0), 0);
  const total = naoLidasSala + naoLidasSuporte;
  const chamado = chamados.find((item) => item.id === chamadoAberto) ?? null;

  return (
    <>
      <button
        type="button"
        className={`chatBolha${total > 0 ? " temNovidade" : ""}`}
        onClick={() => setAberto((estava) => !estava)}
        aria-expanded={aberto}
        aria-label={total > 0 ? `Conversas — ${total} não lida(s)` : "Conversas"}
      >
        <Icone nome={aberto ? "fechar" : "conversa"} tamanho={22} />
        {total > 0 && !aberto && <span className="chatContador">{total > 99 ? "99+" : total}</span>}
      </button>

      {aberto && (
        <section className="chatPainel" aria-label="Conversas">
          <header className="chatAbas">
            <button
              type="button"
              className={aba === "equipe" ? "ativa" : ""}
              onClick={() => { setAba("equipe"); setChamadoAberto(null); }}
            >
              Equipe
              {naoLidasSala > 0 && aba !== "equipe" && <b>{naoLidasSala}</b>}
            </button>
            <button
              type="button"
              className={aba === "suporte" ? "ativa" : ""}
              onClick={() => setAba("suporte")}
            >
              {suporte ? "Relatos recebidos" : "Falar com o suporte"}
              {naoLidasSuporte > 0 && aba !== "suporte" && <b>{naoLidasSuporte}</b>}
            </button>
          </header>

          {erro && <p className="chatErro" role="alert">{erro}</p>}

          {aba === "equipe" ? (
            <>
              <div className="chatCorpo">
                {mensagens.length === 0 && (
                  <p className="chatVazio">
                    Nada por aqui ainda. Esta conversa é da sua equipe — quem é de fora não vê.
                  </p>
                )}
                {mensagens.map((item) => {
                  const minha = item.autor_id === perfil.id;
                  return (
                    <div className={`chatLinha${minha ? " minha" : ""}`} key={item.id}>
                      {!minha && (
                        <span className="chatAutor">
                          {item.autor_nome}
                          {item.autor_papel && <small>{PAPEIS[item.autor_papel] ?? item.autor_papel}</small>}
                        </span>
                      )}
                      <p className="chatBalao">{item.texto}</p>
                      <span className="chatHora">
                        {quando(item.created_at)}
                        {minha && (
                          <button type="button" onClick={() => apagarDaSala(item.id)} title="Apagar">
                            apagar
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
                <div ref={fimDaSala} />
              </div>
              <form className="chatEnviar" onSubmit={enviarNaSala}>
                <textarea
                  name="texto"
                  rows={1}
                  maxLength={2000}
                  placeholder="Escreva para a equipe..."
                  onKeyDown={(evento) => {
                    // Enter envia, Shift+Enter pula linha: é o que a mão já
                    // espera de uma caixa de conversa.
                    if (evento.key === "Enter" && !evento.shiftKey) {
                      evento.preventDefault();
                      evento.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button type="submit" disabled={enviando} aria-label="Enviar">
                  <Icone nome="enviar" tamanho={18} />
                </button>
              </form>
            </>
          ) : chamadoAberto && chamado ? (
            <>
              <div className="chatCabecaRelato">
                <button type="button" className="chatVoltar" onClick={() => setChamadoAberto(null)}>
                  <Icone nome="voltar" tamanho={14} /> Voltar
                </button>
                <strong>{chamado.assunto}</strong>
                <small>
                  {ESTADOS[chamado.status] ?? chamado.status}
                  {suporte && ` · ${chamado.autor_nome} · ${chamado.clinica}`}
                </small>
                {suporte && chamado.status !== "resolvido" && (
                  <button type="button" className="chatResolver" onClick={() => marcarResolvido(chamado.id)}>
                    Marcar resolvido
                  </button>
                )}
              </div>
              <div className="chatCorpo">
                {conversa.map((item) => (
                  <div className={`chatLinha${item.sou_eu ? " minha" : ""}`} key={item.id}>
                    {!item.sou_eu && <span className="chatAutor">{item.autor_nome}</span>}
                    <p className={`chatBalao${item.do_suporte ? " doSuporte" : ""}`}>{item.texto}</p>
                    <span className="chatHora">{quando(item.created_at)}</span>
                  </div>
                ))}
                <div ref={fimDaConversa} />
              </div>
              <form className="chatEnviar" onSubmit={responderChamado}>
                <textarea
                  name="resposta"
                  rows={1}
                  maxLength={4000}
                  placeholder="Responder..."
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter" && !evento.shiftKey) {
                      evento.preventDefault();
                      evento.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button type="submit" disabled={enviando} aria-label="Enviar">
                  <Icone nome="enviar" tamanho={18} />
                </button>
              </form>
            </>
          ) : novoRelato ? (
            <form className="chatRelato" onSubmit={abrirRelato}>
              <label>
                <span>Assunto</span>
                <input name="assunto" maxLength={120} required placeholder="Ex.: a ficha sai em branco" />
              </label>
              <label>
                <span>O que aconteceu</span>
                <textarea
                  name="relato"
                  rows={6}
                  maxLength={4000}
                  required
                  placeholder="Conte com as suas palavras. Em que tela estava, o que fez, o que apareceu."
                />
              </label>
              <div className="chatRelatoAcoes">
                <button type="button" onClick={() => setNovoRelato(false)}>Cancelar</button>
                <button type="submit" className="principal" disabled={enviando}>
                  {enviando ? "Enviando..." : "Enviar relato"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="chatCorpo">
                {chamados.length === 0 && (
                  <p className="chatVazio">
                    {suporte
                      ? "Nenhum relato recebido até agora."
                      : "Achou algo errado, ou tem uma ideia? Escreva aqui — vai direto para quem cuida do AVANEST, e ninguém da sua clínica lê."}
                  </p>
                )}
                {chamados.map((item) => (
                  <button
                    type="button"
                    className={`chatRelatoItem estado-${item.status}`}
                    key={item.id}
                    onClick={() => abrirChamado(item.id)}
                  >
                    <strong>{item.assunto}</strong>
                    <small>
                      {ESTADOS[item.status] ?? item.status} · {quando(item.ultima_em)}
                      {suporte && ` · ${item.autor_nome} · ${item.clinica}`}
                    </small>
                    {item.nao_lidas > 0 && <b>{item.nao_lidas}</b>}
                  </button>
                ))}
              </div>
              {!suporte && (
                <div className="chatRodape">
                  <button type="button" className="principal" onClick={() => setNovoRelato(true)}>
                    Relatar um problema
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
