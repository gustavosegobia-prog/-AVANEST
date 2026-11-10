"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  BLOCOS, detalheAberto, faltandoNoBloco, limparRespostas, MAX_FOTOS, NAO, NAO_SEI, perguntasDoBloco, SIM,
  type Contexto, type Pergunta, type Respostas,
} from "@/lib/questionario-pre";
import estilo from "./questionario.module.css";

// O questionário no celular do paciente. Um bloco por tela, letra e botão
// grandes, e o que já foi respondido fica guardado neste aparelho até o envio:
// quem para no meio para procurar a receita volta e continua de onde estava.

type Foto = { caminho: string; previa?: string };
type Guardado = { respostas: Respostas; passo: number; consentimento: boolean; fotos: string[] };

const chave = (token: string) => `questionario-pre:${token}`;

function lerGuardado(token: string): Guardado | null {
  try {
    const bruto = window.localStorage.getItem(chave(token));
    return bruto ? (JSON.parse(bruto) as Guardado) : null;
  } catch { return null; }
}

/** A foto reduzida a no máximo 1600 px, em JPEG: chega rápido mesmo no 4G. */
async function reduzirFoto(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("imagem"));
      i.src = url;
    });
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, falha) =>
      canvas.toBlob((b) => (b ? ok(b) : falha(new Error("jpeg"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Questionario({ token, nome, organizacao, sexo, validade }: {
  token: string; nome: string; organizacao: string; sexo: string | null; validade: string;
}) {
  const ctx: Contexto = { sexo };
  const [respostas, setRespostas] = useState<Respostas>({});
  const [passo, setPasso] = useState(-1); // -1: a abertura
  const [consentimento, setConsentimento] = useState(false);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [faltando, setFaltando] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mandandoFoto, setMandandoFoto] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const topo = useRef<HTMLDivElement>(null);

  // O que ficou guardado neste aparelho, e o aviso de que a página abriu
  // (é a página que marca, não a leitura do link: a prévia do WhatsApp lê).
  useEffect(() => {
    const g = lerGuardado(token);
    if (g) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- o guardado é do aparelho, só existe depois de montar
      setRespostas(g.respostas ?? {});
      setPasso(typeof g.passo === "number" ? Math.min(g.passo, BLOCOS.length - 1) : -1);
      setConsentimento(Boolean(g.consentimento));
      setFotos((g.fotos ?? []).map((caminho) => ({ caminho })));
    }
    setCarregado(true);
    // O pedido ao banco só sai com o .then(): sem ele, nada é enviado.
    void createClient().rpc("marcar_questionario_aberto", { p_token: token }).then(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!carregado || pronto) return;
    try {
      const g: Guardado = { respostas, passo, consentimento, fotos: fotos.map((f) => f.caminho) };
      window.localStorage.setItem(chave(token), JSON.stringify(g));
    } catch { /* sem armazenamento (aba anônima): segue sem guardar */ }
  }, [respostas, passo, consentimento, fotos, carregado, pronto, token]);

  const definir = (id: string, valor: string | string[]) => {
    setRespostas((r) => ({ ...r, [id]: valor }));
    setFaltando((f) => f.filter((x) => x !== id.split(".")[0]));
  };
  const alternar = (id: string, opcao: string) => {
    const atual = Array.isArray(respostas[`${id}.marcas`]) ? (respostas[`${id}.marcas`] as string[]) : [];
    definir(`${id}.marcas`, atual.includes(opcao) ? atual.filter((x) => x !== opcao) : [...atual, opcao]);
  };

  const irPara = (n: number) => {
    setPasso(n);
    setFaltando([]);
    setErro("");
    requestAnimationFrame(() => topo.current?.scrollIntoView({ block: "start" }));
  };

  function continuar() {
    const bloco = BLOCOS[passo];
    const falta = faltandoNoBloco(bloco, respostas, ctx);
    if (falta.length) {
      setFaltando(falta);
      requestAnimationFrame(() => document.getElementById(`p-${falta[0]}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    if (passo < BLOCOS.length - 1) irPara(passo + 1);
    else void enviar();
  }

  async function enviar() {
    setEnviando(true);
    setErro("");
    const { error } = await createClient().rpc("responder_questionario", {
      p_token: token, p_respostas: limparRespostas(respostas, ctx), p_consentimento: consentimento,
    });
    setEnviando(false);
    if (error) {
      setErro(/venceu|respondido|consentimento/i.test(error.message)
        ? error.message
        : "Não foi possível enviar agora. Confira a internet e toque em Enviar de novo. Suas respostas continuam aqui.");
      return;
    }
    try { window.localStorage.removeItem(chave(token)); } catch { /* nada a limpar */ }
    setPronto(true);
    requestAnimationFrame(() => topo.current?.scrollIntoView({ block: "start" }));
  }

  async function mandarFotos(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    setMandandoFoto(true);
    let restam = MAX_FOTOS - fotos.length;
    for (const arquivo of Array.from(arquivos)) {
      if (restam <= 0) { setErro(`Dá para mandar até ${MAX_FOTOS} fotos.`); break; }
      try {
        const corpo = await reduzirFoto(arquivo);
        const resp = await fetch(`/api/questionario/${token}/foto`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: corpo });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) { setErro(json.error ?? "Não foi possível mandar a foto."); break; }
        setFotos((f) => [...f, { caminho: json.caminho, previa: URL.createObjectURL(corpo) }]);
        restam--;
      } catch {
        setErro("Não consegui ler esta foto. Tente tirar outra.");
        break;
      }
    }
    setMandandoFoto(false);
  }

  async function tirarFoto(foto: Foto) {
    const resp = await fetch(`/api/questionario/${token}/foto?caminho=${encodeURIComponent(foto.caminho)}`, { method: "DELETE" });
    if (resp.ok || resp.status === 404) setFotos((f) => f.filter((x) => x.caminho !== foto.caminho));
    else setErro("Não foi possível tirar a foto agora.");
  }

  const total = BLOCOS.length;
  const ate = new Date(validade).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <main className={estilo.pagina}>
      <div ref={topo} className={estilo.cabeca}>
        <small>{organizacao}</small>
        <strong>Questionário pré-anestésico</strong>
        {passo >= 0 && !pronto && (
          <div className={estilo.progresso} aria-label={`Parte ${passo + 1} de ${total}`}>
            <span style={{ width: `${((passo + 1) / total) * 100}%` }} />
          </div>
        )}
      </div>

      {pronto ? (
        <section className={estilo.fim}>
          <h1>Pronto{nome ? `, ${nome}` : ""}.</h1>
          <p>Suas respostas chegaram à equipe de anestesia.</p>
          <p>No dia da consulta, leve seus exames, as receitas e os remédios que você toma (ou a lista deles).</p>
        </section>
      ) : passo < 0 ? (
        <section className={estilo.abertura}>
          <h1>Olá{nome ? `, ${nome}` : ""}.</h1>
          <p>Estas perguntas são da equipe de anestesia que vai cuidar de você. Com elas, o anestesiologista chega à sua consulta já sabendo o principal da sua saúde.</p>
          <ul>
            <li>Leva menos de 10 minutos.</li>
            <li>Se não souber alguma resposta, marque <b>Não sei</b>. O médico pergunta na consulta.</li>
            <li>Pode parar e continuar depois, neste mesmo celular. O link vale até {ate}.</li>
          </ul>
          <label className={estilo.consentimento}>
            <input type="checkbox" checked={consentimento} onChange={(e) => { setConsentimento(e.target.checked); setErro(""); }} />
            <span>
              Concordo que a equipe de anestesia use estas respostas na minha avaliação. São dados de saúde: ficam só com a equipe que vai me atender.{" "}
              <a href="/privacidade" target="_blank" rel="noreferrer">Política de privacidade</a>
            </span>
          </label>
          {erro && <p className={estilo.erro} role="alert">{erro}</p>}
          <div className={estilo.acoes}>
            <button type="button" className={estilo.principal}
              onClick={() => (consentimento ? irPara(0) : setErro("Para continuar, marque que concorda."))}>
              Começar
            </button>
          </div>
        </section>
      ) : (
        <section className={estilo.bloco}>
          <p className={estilo.parte}>Parte {passo + 1} de {total}</p>
          <h1>{BLOCOS[passo].titulo}</h1>
          {perguntasDoBloco(BLOCOS[passo], respostas, ctx).map((p) => (
            <div key={p.id}>
              <Campo pergunta={p} respostas={respostas} falta={faltando.includes(p.id)} definir={definir} alternar={alternar} />
              {p.id === "remedios" && (
                <div className={estilo.fotos}>
                  <strong>Foto da receita ou das caixas dos remédios</strong>
                  <small>Opcional. Até {MAX_FOTOS} fotos. Só a equipe de anestesia vê.</small>
                  {fotos.length > 0 && (
                    <ul>
                      {fotos.map((f, i) => (
                        <li key={f.caminho}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), sem otimizar */}
                          {f.previa ? <img src={f.previa} alt={`Foto ${i + 1}`} /> : <span className={estilo.semPrevia}>Foto {i + 1} enviada</span>}
                          <button type="button" onClick={() => void tirarFoto(f)} aria-label={`Tirar a foto ${i + 1}`}>Tirar</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {fotos.length < MAX_FOTOS && (
                    <label className={estilo.botaoFoto} aria-busy={mandandoFoto}>
                      <input type="file" accept="image/*" multiple disabled={mandandoFoto}
                        onChange={(e) => { void mandarFotos(e.target.files); e.target.value = ""; }} />
                      {mandandoFoto ? "Mandando a foto…" : fotos.length ? "Mandar outra foto" : "Tirar ou escolher foto"}
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}
          {/* O aviso do que falta some sozinho quando a última pergunta é respondida. */}
          {(faltando.length > 0 || erro) && (
            <p className={estilo.erro} role="alert">
              {faltando.length > 1 ? `Faltam ${faltando.length} perguntas.` : faltando.length ? "Falta responder uma pergunta." : erro}
            </p>
          )}
          <div className={estilo.acoes}>
            <button type="button" className={estilo.voltar} onClick={() => irPara(passo - 1)} disabled={enviando}>Voltar</button>
            <button type="button" className={estilo.principal} onClick={continuar} disabled={enviando || mandandoFoto} aria-busy={enviando}>
              {passo === total - 1 ? (enviando ? "Enviando…" : "Enviar respostas") : "Continuar"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

const ROTULO: [string, string][] = [[SIM, "Sim"], [NAO, "Não"], [NAO_SEI, "Não sei"]];

function Campo({ pergunta: p, respostas: r, falta, definir, alternar }: {
  pergunta: Pergunta; respostas: Respostas; falta: boolean;
  definir: (id: string, v: string | string[]) => void; alternar: (id: string, opcao: string) => void;
}) {
  const valor = typeof r[p.id] === "string" ? (r[p.id] as string) : "";
  const marcas = Array.isArray(r[`${p.id}.marcas`]) ? (r[`${p.id}.marcas`] as string[]) : [];
  const detalhe = typeof r[`${p.id}.texto`] === "string" ? (r[`${p.id}.texto`] as string) : "";
  const abre = detalheAberto(p, r);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <fieldset id={`p-${p.id}`} className={`${estilo.pergunta} ${falta ? estilo.falta : ""}`}>
      <legend>{p.texto}</legend>
      {p.ajuda && <p className={estilo.ajuda}>{p.ajuda}</p>}

      {p.tipo === "simnao" && (
        <div className={estilo.simnao}>
          {ROTULO.map(([id, rotulo]) => (
            <label key={id} className={valor === id ? estilo.marcado : ""}>
              <input type="radio" name={p.id} value={id} checked={valor === id} onChange={() => definir(p.id, id)} />
              {rotulo}
            </label>
          ))}
        </div>
      )}

      {p.tipo === "escolha" && (
        <div className={estilo.escolha}>
          {(p.opcoes ?? []).map((o) => (
            <label key={o.id} className={valor === o.id ? estilo.marcado : ""}>
              <input type="radio" name={p.id} value={o.id} checked={valor === o.id} onChange={() => definir(p.id, o.id)} />
              {o.texto}
            </label>
          ))}
        </div>
      )}

      {(p.tipo === "marcar" || (abre && p.tipo === "simnao" && (p.opcoes ?? []).length > 0)) && (
        <div className={estilo.marcas}>
          {p.tipo === "simnao" && <p className={estilo.ajuda}>Marque o que tiver:</p>}
          {(p.opcoes ?? []).map((o) => (
            <label key={o.id} className={marcas.includes(o.id) ? estilo.marcado : ""}>
              <input type="checkbox" checked={marcas.includes(o.id)} onChange={() => alternar(p.id, o.id)} />
              {o.texto}
            </label>
          ))}
        </div>
      )}

      {abre && p.detalhe && (
        <label className={estilo.detalhe}>
          <span>{p.detalhe}{p.detalheObrigatorio ? "" : " (opcional)"}</span>
          {p.id === "quem"
            ? <input value={detalhe} onChange={(e) => definir(`${p.id}.texto`, e.target.value)} autoComplete="name" />
            : <textarea rows={2} value={detalhe} onChange={(e) => definir(`${p.id}.texto`, e.target.value)} />}
        </label>
      )}

      {p.tipo === "numero" && (
        <div className={estilo.numero}>
          <input inputMode="decimal" value={valor} onChange={(e) => definir(p.id, e.target.value)} aria-label={p.texto} />
          <span>{p.unidade}</span>
        </div>
      )}
      {p.tipo === "texto" && (
        <textarea className={estilo.texto} rows={p.id === "mais" ? 4 : 2} value={valor} onChange={(e) => definir(p.id, e.target.value)} aria-label={p.texto} />
      )}
      {p.tipo === "data" && (
        <input className={estilo.data} type="date" max={hoje} value={valor} onChange={(e) => definir(p.id, e.target.value)} aria-label={p.texto} />
      )}
      {falta && <p className={estilo.faltaAviso}>{abre ? "Escreva o nome." : "Responda esta pergunta."}</p>}
    </fieldset>
  );
}
