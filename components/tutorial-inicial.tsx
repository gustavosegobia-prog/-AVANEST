"use client";

import { useEffect, useRef, useState } from "react";
import { CHAVE_TUTORIAL, passosDoTutorial, type Papel } from "@/lib/tutorial";
import { Icone } from "@/components/icone";

// O tutorial do primeiro acesso.
//
// É um passo a passo em janela, e não um holofote apontando para os botões da
// tela. A escolha é deliberada: o holofote depende de cada botão estar onde o
// tutorial pensa que ele está, e basta um ponto de quebra do celular mover a
// barra para a seta apontar para o vazio. Um texto que diz "em Médico você
// cadastra o paciente" continua certo em qualquer largura de tela — e este
// sistema é aberto tanto no computador da recepção quanto no telefone, entre
// uma cirurgia e outra.
//
// A ETAPA TROCA DE ÁREA. Ler "em Médico você faz a avaliação" enquanto se olha
// para a tela do Financeiro não ensina nada; a cada passo o painel atrás muda
// para a área de que o texto fala, e a pessoa vê o lugar enquanto lê sobre ele.
//
// Onde fica guardado que já foi visto: no APARELHO, e não no cadastro. É uma
// decisão com custo — quem abrir depois no celular vê de novo — e com um ganho
// que pesa mais: nada de esquema novo no banco para uma janela que a pessoa vai
// ver uma vez. Se um dia isto incomodar, o lugar certo é uma coluna em perfis.

export function TutorialInicial({
  papel, onIrPara,
}: {
  papel: Papel;
  /** Leva o painel para a área da etapa, para o texto e a tela combinarem. */
  onIrPara: (area: string) => void;
}) {
  const etapas = passosDoTutorial(papel);
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const janela = useRef<HTMLDivElement | null>(null);

  // Lido depois de montar, e não no useState inicial: esta tela é renderizada
  // no servidor, onde localStorage não existe, e inicializar por ele faria o
  // HTML do servidor discordar do primeiro render do navegador.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado do aparelho, só existe depois de montar
    try { setAberto(localStorage.getItem(CHAVE_TUTORIAL) !== "1"); } catch { /* sem tutorial */ }
  }, []);

  // O foco entra na janela ao abrir e a cada passo. Sem isso, quem navega por
  // teclado continua no painel atrás e não alcança o botão "Próximo".
  useEffect(() => {
    if (aberto) janela.current?.focus();
  }, [aberto, passo]);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });

  function fechar() {
    setAberto(false);
    try { localStorage.setItem(CHAVE_TUTORIAL, "1"); } catch { /* volta no próximo acesso */ }
  }

  function avancar() {
    const proximo = passo + 1;
    if (proximo >= etapas.length) { fechar(); return; }
    setPasso(proximo);
    const area = etapas[proximo].area;
    if (area) onIrPara(area);
  }

  if (!aberto || etapas.length === 0) return null;

  const etapa = etapas[passo];
  const ultimo = passo === etapas.length - 1;

  return (
    <div className="tutorialFundo" role="presentation">
      <div
        className="tutorialJanela" role="dialog" aria-modal="true"
        aria-labelledby="tutorialTitulo" tabIndex={-1} ref={janela}
      >
        <div className="tutorialTopo">
          {/* A contagem fica à vista o tempo todo. Sem saber quantas faltam, a
              pessoa não decide se vale continuar — e no meio da dúvida fecha. */}
          <span className="tutorialConta">{passo + 1} de {etapas.length}</span>
          <button type="button" className="tutorialFechar" onClick={fechar}
            aria-label="Fechar o tutorial">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </div>

        <h2 id="tutorialTitulo">{etapa.titulo}</h2>
        <p>{etapa.texto}</p>

        <div className="tutorialPassos" aria-hidden="true">
          {etapas.map((_, i) => (
            <b key={i} className={i === passo ? "atual" : i < passo ? "feito" : ""} />
          ))}
        </div>

        <div className="tutorialBotoes">
          {/* "Pular" só até a penúltima: na última ele faria a mesma coisa que
              "Pronto", com outro nome — e dois botões que fazem o mesmo fazem a
              pessoa procurar a diferença. */}
          {!ultimo && (
            <button type="button" className="outlineClinical" onClick={fechar}>
              Pular
            </button>
          )}
          {passo > 0 && (
            <button type="button" className="outlineClinical" onClick={() => setPasso(passo - 1)}>
              Voltar
            </button>
          )}
          <button type="button" className="primaryClinical compact" onClick={avancar}>
            {ultimo ? "Pronto" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Reabre o tutorial: apaga a marca do aparelho e recarrega a tela. */
export function reabrirTutorial() {
  try { localStorage.removeItem(CHAVE_TUTORIAL); } catch { /* nada a fazer */ }
  window.location.reload();
}
