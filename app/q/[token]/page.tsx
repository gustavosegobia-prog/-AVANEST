import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { Questionario } from "./questionario";
import estilo from "./questionario.module.css";

// A página que o paciente abre pelo link do WhatsApp (migração 202611100001).
//
// Sem login. O título é genérico de propósito: é ele que aparece na prévia do
// link no WhatsApp, e a prévia não deve dizer o nome de ninguém. Fora da busca
// aqui e em app/robots.ts.
export const metadata: Metadata = {
  title: "Questionário pré-anestésico",
  description: "Perguntas da equipe de anestesia antes da sua consulta.",
  robots: { index: false, follow: false },
};

type Publico = { situacao: string; primeiro_nome: string; organizacao: string; sexo: string | null; expires_at: string };

export default async function QuestionarioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valido = /^[0-9a-f]{64}$/.test(token);
  let q: Publico | null = null;
  if (valido) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("questionario_publico", { p_token: token });
    q = ((Array.isArray(data) ? data[0] : data) as Publico | undefined) ?? null;
  }

  if (!q || q.situacao === "cancelado") {
    return <Aviso titulo="Link não encontrado">Confira se o link veio inteiro na mensagem. Se não der certo, peça um novo à recepção.</Aviso>;
  }
  if (q.situacao === "respondido") {
    return <Aviso titulo="Respostas recebidas">Este questionário já foi respondido. Se quiser mudar alguma resposta, conte ao anestesiologista na consulta.</Aviso>;
  }
  if (q.situacao === "vencido") {
    return <Aviso titulo="Este link venceu">Os links valem 7 dias. Peça um novo à recepção pelo WhatsApp.</Aviso>;
  }
  return <Questionario token={token} nome={q.primeiro_nome} organizacao={q.organizacao} sexo={q.sexo} validade={q.expires_at} />;
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className={estilo.pagina}>
      <section className={estilo.aviso}>
        <h1>{titulo}</h1>
        <p>{children}</p>
      </section>
    </main>
  );
}
