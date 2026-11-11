"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import {
  alertasDoQuestionario, BLOCOS, limparRespostas, partesQueFaltam, quemRespondeu, respostasParaAvaliacao,
  resumoDasRespostas, type Respostas,
} from "@/lib/questionario-pre";

// O questionário que o paciente respondeu pelo celular, dentro da avaliação.
//
// Nada entra na ficha sozinho. O médico lê os alertas, abre as respostas se
// quiser, e decide trazer: aí só o campo vazio é preenchido, e a pergunta da
// anamnese mostra que a resposta veio do paciente.

export type QuestionarioRespondido = {
  id: string;
  respostas: Respostas;
  fotos: string[];
  respondido_em: string | null;
  /** Quando o paciente salvou a última parte (questionário incompleto). */
  salvo_em: string | null;
  usado_em: string | null;
  /** Falso quando o paciente parou no meio e não enviou. */
  completo: boolean;
  /** Quantas partes ele concluiu. */
  parte: number | null;
  expires_at: string;
};

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
}).replace(",", " às");

export function QuestionarioNaAvaliacao({ questionario: q, draft, sexo, avaliacaoId, aplicar }: {
  questionario: QuestionarioRespondido;
  draft: Record<string, unknown>;
  sexo: string | null;
  avaliacaoId: string;
  aplicar: (campos: Record<string, string | boolean>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  // A hora de abrir a tela basta para dizer se o link ainda vale.
  const [agora] = useState(() => Date.now());
  const [trazidos, setTrazidos] = useState<number | null>(null);
  const [fotos, setFotos] = useState<{ caminho: string; url: string }[] | null>(null);
  const [erroFotos, setErroFotos] = useState("");

  // As partes salvas se somam no banco; o que ficou sem sentido (uma
  // resposta trocada depois) sai aqui, antes de qualquer leitura.
  const r = useMemo(() => limparRespostas(q.respostas, { sexo }), [q.respostas, sexo]);
  const alertas = useMemo(() => alertasDoQuestionario(r), [r]);
  const { campos } = useMemo(() => respostasParaAvaliacao(r, draft), [r, draft]);
  const aTrazer = Object.keys(campos).length;
  const quem = quemRespondeu(r);
  const momento = q.completo ? q.respondido_em : q.salvo_em ?? q.respondido_em;
  const faltam = q.completo ? [] : partesQueFaltam(q.parte);
  const linkValendo = new Date(q.expires_at).getTime() > agora;
  const titulo = q.completo
    ? "Questionário respondido pelo paciente"
    : `Questionário incompleto: o paciente respondeu ${Math.min(q.parte ?? 0, BLOCOS.length)} de ${BLOCOS.length} partes`;

  function trazer() {
    const anteriores = String(draft.questionario_pre_campos ?? "").split(",").filter(Boolean);
    aplicar({
      ...campos,
      questionario_pre_id: q.id,
      questionario_pre_campos: [...new Set([...anteriores, ...Object.keys(campos)])].join(","),
    });
    setTrazidos(aTrazer);
    // O pedido ao banco só sai com o .then(): sem ele, nada é enviado.
    void createClient().rpc("marcar_questionario_usado", { p_id: q.id, p_avaliacao_id: avaliacaoId }).then(() => undefined);
  }

  async function abrir() {
    setAberto(true);
    if (fotos || !q.fotos.length) return;
    const { data, error } = await createClient().storage.from("questionarios").createSignedUrls(q.fotos, 3600);
    if (error || !data) { setErroFotos("Não foi possível abrir as fotos agora."); return; }
    setFotos(data.flatMap((f) => (f.signedUrl ? [{ caminho: f.path ?? "", url: f.signedUrl }] : [])));
  }

  return (
    <section className={`evalQuestionario${q.completo ? "" : " incompleto"}`} aria-label={titulo}>
      <div className="evalQuestionarioTopo">
        <div>
          <strong><Icone nome="nota" tamanho={16} /> {titulo}</strong>
          <small>
            {momento ? (q.completo ? quando(momento) : `salvo em ${quando(momento)}`) : ""}{quem ? ` · ${quem}` : ""}
            {q.fotos.length ? ` · ${q.fotos.length} foto${q.fotos.length > 1 ? "s" : ""} da receita` : ""}
          </small>
        </div>
        <div className="evalQuestionarioAcoes">
          {trazidos === null && aTrazer > 0 && (
            <button type="button" className="primaryClinical compact" onClick={trazer}>
              Trazer as respostas ({aTrazer})
            </button>
          )}
          <button type="button" className="outlineClinical" onClick={() => void abrir()}>Ver respostas</button>
        </div>
      </div>

      {trazidos !== null && (
        <p className="evalQuestionarioFeito" role="status">
          <Icone nome="confirmado" tamanho={14} /> {trazidos} resposta{trazidos > 1 ? "s" : ""} trazida{trazidos > 1 ? "s" : ""}, só nos campos que estavam vazios. Confira com o paciente: nas perguntas da anamnese, aparece “informado pelo paciente”.
        </p>
      )}
      {trazidos === null && aTrazer === 0 && (
        <p className="evalQuestionarioFeito">As respostas já estão na ficha, ou os campos já foram preenchidos.</p>
      )}

      {faltam.length > 0 && (
        <p className="evalQuestionarioFalta">
          <b>Faltou responder:</b> {faltam.join(", ")}. Pergunte na consulta.
          {linkValendo ? ` O link vale até ${new Date(q.expires_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}: o paciente ainda pode terminar.` : " O link já venceu."}
        </p>
      )}
      {alertas.length > 0 && (
        <ul className="evalQuestionarioAlertas">
          {alertas.map((a) => (
            <li key={a.texto} className={a.grave ? "grave" : ""}><Icone nome="alerta" tamanho={14} /> {a.texto}</li>
          ))}
        </ul>
      )}
      <p className="evalQuestionarioRemedios">
        Os remédios não entram sozinhos na lista: confira o que o paciente escreveu{q.fotos.length ? " e as fotos" : ""} em Ver respostas.
      </p>

      {aberto && (
        <Gaveta titulo={q.completo ? "Respostas do paciente" : "Respostas do paciente (incompleto)"}
          subtitulo={`${q.completo ? "Respondido" : "Salvo"} em ${momento ? quando(momento) : "—"}${quem ? ` · ${quem}` : ""}`}
          onPedirFechar={() => setAberto(false)} largura="larga">
          {q.fotos.length > 0 && (
            <div className="evalQuestionarioFotos">
              <h3>Fotos da receita</h3>
              {erroFotos && <p className="clinicalError">{erroFotos}</p>}
              {!fotos && !erroFotos && <p>Abrindo as fotos…</p>}
              {fotos && (
                <ul>
                  {fotos.map((f, i) => (
                    <li key={f.caminho}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- link assinado e privado, que vence em 1 hora */}
                      <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={`Foto ${i + 1} enviada pelo paciente`} /></a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {resumoDasRespostas(r, { sexo }).map((b) => (
            <div key={b.titulo} className="evalQuestionarioBloco">
              <h3>{b.titulo}</h3>
              <dl>
                {b.itens.map((i) => (
                  <div key={i.pergunta}><dt>{i.pergunta}</dt><dd>{i.resposta}</dd></div>
                ))}
              </dl>
            </div>
          ))}
        </Gaveta>
      )}
    </section>
  );
}
