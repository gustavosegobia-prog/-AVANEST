"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PDF_MAXIMO, envioAutomatico } from "@/lib/email-prontuario";
import { pdfDaAvaliacao } from "./pdf-da-avaliacao";

// O QUADRO "PRONTUÁRIO DO HOSPITAL" DA TELA DE DOCUMENTOS.
//
// Ao abrir os documentos de uma avaliação recém-concluída, a ficha vai sozinha
// por e-mail para o endereço do prontuário cadastrado no local. Ninguém
// precisa lembrar de mandar — é esse o ponto. Depois disso, o quadro diz para
// onde foi e quando, e deixa reenviar.
//
// Sem e-mail cadastrado no local, o quadro só ensina onde cadastrar.

type Estado = {
  configurado: boolean;
  emailAtivo: boolean;
  destino: string | null;
  concluida: boolean;
  concluidaEm: string | null;
  enviadaEm: string | null;
  enviadaPara: string | null;
};

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

export function EnvioAoProntuario({ avaliacaoId }: { avaliacaoId: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const automatico = useRef(false);

  const enviar = useCallback(async (reenviar: boolean) => {
    setEnviando(true);
    setErro("");
    try {
      const pdf = await pdfDaAvaliacao(PDF_MAXIMO);
      const resposta = await fetch(`/api/avaliacoes/${avaliacaoId}/prontuario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf, reenviar }),
      });
      const r = await resposta.json().catch(() => ({})) as { error?: string; enviadaEm?: string; enviadaPara?: string };
      if (!resposta.ok) { setErro(r.error || "Não foi possível enviar agora."); return; }
      setEstado((e) => e && { ...e, enviadaEm: r.enviadaEm ?? new Date().toISOString(), enviadaPara: r.enviadaPara ?? e.destino });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível montar o PDF.");
    } finally {
      setEnviando(false);
    }
  }, [avaliacaoId]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/avaliacoes/${avaliacaoId}/prontuario`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: Estado | null) => {
        if (!vivo || !dados) return;
        setEstado(dados);
        // Uma vez por abertura da tela, e só se a avaliação acabou de ser
        // concluída e ainda não foi (o servidor confere de novo).
        if (!automatico.current && dados.emailAtivo && envioAutomatico({
          concluidaEm: dados.concluidaEm, enviadaEm: dados.enviadaEm, configurado: dados.configurado,
        })) {
          automatico.current = true;
          // Espera a folha terminar de desenhar (fontes e logo) antes de copiá-la.
          setTimeout(() => { if (vivo) void enviar(false); }, 1200);
        }
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [avaliacaoId, enviar]);

  if (!estado || !estado.concluida) return null;

  if (!estado.configurado) {
    return <section className="envioProntuario">
      <h4>Prontuário do hospital</h4>
      <p>Para a ficha ir sozinha por e-mail ao prontuário do hospital, cadastre o <b>E-mail do prontuário</b> no local de atendimento (Locais).</p>
    </section>;
  }

  if (!estado.emailAtivo) {
    return <section className="envioProntuario">
      <h4>Prontuário do hospital</h4>
      <p>O envio por e-mail ainda não está ativo no servidor. Por enquanto, imprima ou salve o PDF.</p>
    </section>;
  }

  return <section className="envioProntuario" aria-live="polite">
    <h4>Prontuário do hospital</h4>
    {enviando
      ? <p>Enviando a ficha para {estado.destino}…</p>
      : estado.enviadaEm
        ? <p className="envioOk">✓ Ficha enviada para {estado.enviadaPara || estado.destino} em {quando(estado.enviadaEm)}.</p>
        : <p>A ficha vai por e-mail para {estado.destino}, para arquivo no prontuário.</p>}
    {erro && <div className="pendingNotice" role="alert">{erro}</div>}
    {!enviando && <button type="button" className="channelButton" onClick={() => void enviar(Boolean(estado.enviadaEm))}>
      {estado.enviadaEm ? "Reenviar ao prontuário" : erro ? "Tentar novamente" : "Enviar ao prontuário"}
    </button>}
  </section>;
}
