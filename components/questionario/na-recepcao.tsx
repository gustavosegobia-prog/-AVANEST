"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Dialogo } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import {
  linkDoQuestionario, mensagemDoQuestionario, NOME_DA_SITUACAO, whatsappDoPaciente, type Situacao,
} from "@/lib/questionario-pre";

// A parte da recepção no questionário pré-anestésico: manda o link e vê a
// situação. O conteúdo das respostas não passa por aqui, nem pelo que esta
// tela pede ao banco (situacao_dos_questionarios devolve só a situação).

type Linha = { patient_id: string; situacao: Situacao | "cancelado"; enviado_em: string | null; respondido_em: string | null };

export function useQuestionarios(pacientes: string[]) {
  const [mapa, setMapa] = useState<Map<string, Linha>>(new Map());
  const [versao, setVersao] = useState(0);
  const chave = [...new Set(pacientes)].sort().join(",");
  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    void (async () => {
      const { data } = await createClient().rpc("situacao_dos_questionarios", { p_patient_ids: chave.split(",") });
      if (!vivo) return;
      setMapa(new Map(((data ?? []) as Linha[]).map((l) => [l.patient_id, l])));
    })();
    return () => { vivo = false; };
  }, [chave, versao]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { mapa, recarregar };
}

const ICONE: Record<Situacao, Parameters<typeof Icone>[0]["nome"]> = {
  enviado: "enviar", aberto: "olho", respondido: "confirmado", vencido: "relogio",
};

export function SeloDoQuestionario({ linha }: { linha?: Linha }) {
  if (!linha || linha.situacao === "cancelado") return null;
  return (
    <span className={`recQuestionario ${linha.situacao}`}>
      <Icone nome={ICONE[linha.situacao]} tamanho={12} /> {NOME_DA_SITUACAO[linha.situacao]}
    </span>
  );
}

/** O nome no menu da consulta, conforme a situação. */
export function rotuloDoEnvio(linha?: Linha): string {
  if (!linha || linha.situacao === "cancelado") return "Enviar questionário pelo WhatsApp…";
  if (linha.situacao === "respondido") return "Enviar questionário novo…";
  return "Reenviar questionário…";
}

export function EnviarQuestionario({ paciente, agendamentoId, onFechar, onEnviado }: {
  paciente: { id: string; nome: string; telefone: string | null };
  agendamentoId: string | null;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [preparo, setPreparo] = useState<{ id: string; mensagem: string; whatsapp: string } | null>(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data, error } = await createClient().rpc("criar_questionario", {
        p_patient_id: paciente.id, p_agendamento_id: agendamentoId,
      });
      if (!vivo) return;
      const q = Array.isArray(data) ? data[0] : data;
      if (error || !q) { setErro("Não foi possível preparar o link agora. Tente de novo."); return; }
      const mensagem = mensagemDoQuestionario({
        paciente: paciente.nome, organizacao: q.organizacao,
        link: linkDoQuestionario(window.location.origin, q.token), validade: q.expires_at,
      });
      setPreparo({ id: q.id, mensagem, whatsapp: whatsappDoPaciente(paciente.telefone, mensagem) });
    })();
    return () => { vivo = false; };
  }, [paciente.id, paciente.nome, paciente.telefone, agendamentoId]);

  const registrar = async () => {
    if (!preparo) return;
    await createClient().rpc("registrar_envio_do_questionario", { p_id: preparo.id });
    onEnviado();
  };

  const temTelefone = whatsappDoPaciente(paciente.telefone, "").startsWith("https://wa.me/55");

  return (
    <Dialogo
      titulo="Questionário pelo WhatsApp"
      confirmar="Abrir o WhatsApp"
      cancelar="Fechar"
      ocupado={!preparo && !erro}
      confirmando="Preparando o link…"
      erro={erro}
      onCancelar={onFechar}
      onConfirmar={() => {
        if (!preparo) return;
        // Abre no clique, antes de qualquer espera: senão o navegador bloqueia.
        window.open(preparo.whatsapp, "_blank", "noopener");
        void registrar().then(onFechar);
      }}
    >
      <p>
        {temTelefone
          ? <>A mensagem vai para o WhatsApp de <b>{paciente.nome}</b>, no número do cadastro.</>
          : <>O cadastro de <b>{paciente.nome}</b> está sem celular. O WhatsApp vai pedir para escolher o contato.</>}
      </p>
      {preparo && (
        <>
          <pre className="recQuestionarioMensagem">{preparo.mensagem}</pre>
          <button type="button" className="outlineClinical" onClick={() => {
            void navigator.clipboard?.writeText(preparo.mensagem).then(() => { setCopiado(true); void registrar(); });
          }}>
            <Icone nome={copiado ? "confirmado" : "copiar"} tamanho={14} /> {copiado ? "Mensagem copiada" : "Copiar a mensagem"}
          </button>
        </>
      )}
      <p className="recQuestionarioNota">O link vale 7 dias. As respostas chegam para o médico, na avaliação do paciente.</p>
    </Dialogo>
  );
}
