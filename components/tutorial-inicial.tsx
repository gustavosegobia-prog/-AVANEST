"use client";

import { useEffect, useRef, useState } from "react";
import { CHAVE_TUTORIAL, passosDoTutorial, type Papel } from "@/lib/tutorial";
import { Icone } from "@/components/icone";

// O tutorial do primeiro acesso.
//
// HOLOFOTE, COM CHÃO FIRME. Cada etapa procura o elemento de que ela fala,
// recorta a escuridão em volta dele e encosta a janela ao lado: a pessoa lê
// "em Médico você faz a avaliação" olhando para o botão Médico aceso, e não
// para um retângulo no meio da tela falando de um lugar que ela ainda não
// achou.
//
// O risco do holofote é conhecido e é por isso que a versão anterior o evitava:
// ele depende de o botão estar onde o tutorial pensa que está, e um ponto de
// quebra do celular basta para a seta apontar para o vazio. A defesa não é
// desistir dele — é o alvo ser opcional e a falta dele ser um caminho normal:
// não achando o elemento, a janela volta ao centro e a etapa continua valendo,
// porque o texto sozinho já era suficiente antes.
//
// A posição é medida a cada passo, e de novo a cada rolagem e cada mudança de
// tamanho da janela. Medir uma vez e guardar é o que faz o holofote descolar do
// botão quando o teclado do celular sobe.
//
// A ETAPA TROCA DE ÁREA. Ler "em Médico você faz a avaliação" enquanto se olha
// para a tela do Financeiro não ensina nada; a cada passo o painel atrás muda
// para a área de que o texto fala, e a pessoa vê o lugar enquanto lê sobre ele.
//
// Onde fica guardado que já foi visto: no APARELHO, e não no cadastro. É uma
// decisão com custo — quem abrir depois no celular vê de novo — e com um ganho
// que pesa mais: nada de esquema novo no banco para uma janela que a pessoa vai
// ver uma vez. Se um dia isto incomodar, o lugar certo é uma coluna em perfis.

type Recorte = { topo: number; esquerda: number; largura: number; altura: number };

/** Uma folga em volta do elemento: o holofote colado na borda parece erro. */
const FOLGA = 8;

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
  /** Onde está o elemento da etapa, em coordenadas da tela. Nulo = sem alvo. */
  const [foco, setFoco] = useState<Recorte | null>(null);

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

  /**
   * Achar o elemento da etapa e medir onde ele está.
   *
   * Roda a cada passo e continua rodando: rolagem e mudança de tamanho movem o
   * botão, e um holofote medido uma vez só descola dele.
   *
   * O atraso do primeiro cálculo não é superstição. A etapa troca de área, e a
   * área nova monta no quadro seguinte — medir antes disso encontra o botão da
   * área velha, ou não encontra nada.
   */
  // O seletor, e não a etapa inteira: `passosDoTutorial` devolve um array novo
  // a cada render, e um efeito que dependesse dele remediria a tela sem parar.
  const alvoDaEtapa = etapas[passo]?.alvo;

  useEffect(() => {
    if (!aberto) return;
    const alvo = alvoDaEtapa;
    // Medir a tela é ler de fora do React e trazer para dentro: a posição de um
    // botão não existe até o navegador desenhar. É o caso legítimo da regra.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- posição medida do DOM
    if (!alvo) { setFoco(null); return; }

    let vivo = true;
    const medir = () => {
      if (!vivo) return;
      const el = document.querySelector(alvo);
      if (!el) { setFoco(null); return; }
      const r = el.getBoundingClientRect();
      // Elemento de tamanho zero é elemento que existe no HTML e não está na
      // tela — menu fechado, aba escondida. Recortar ali abriria um buraco de
      // nada no canto superior esquerdo.
      if (r.width === 0 || r.height === 0) { setFoco(null); return; }
      setFoco({
        topo: r.top - FOLGA, esquerda: r.left - FOLGA,
        largura: r.width + FOLGA * 2, altura: r.height + FOLGA * 2,
      });
    };

    /**
     * Esperar o elemento existir, em vez de apostar num atraso.
     *
     * A etapa troca de área, e a área nova monta em outro quadro — com
     * `useTransition` no meio, isso pode levar bem mais que os 60ms que este
     * código apostava antes. Quem apostava perdia calado: não achava o botão,
     * não acendia nada, e a etapa virava um texto solto.
     *
     * Aqui ele procura de novo a cada 120ms por um segundo e meio. Achando,
     * faz o trabalho e para. Não achando, desiste — e a janela ao centro
     * continua sendo uma etapa válida.
     */
    let tentativas = 0;
    let jaAbriu = false;
    // Declarado antes de `procurar` porque ela o reagenda: deixá-lo depois
    // funciona por sorte de tempo, e sorte de tempo é o que se paga depois.
    let relogio: ReturnType<typeof setTimeout>;

    const procurar = () => {
      if (!vivo) return;
      const el = document.querySelector(alvo);
      if (!el) {
        if (++tentativas < 12) { relogio = setTimeout(procurar, 120); }
        else setFoco(null);
        return;
      }

      /**
       * ABRE O QUE ESTÁ APONTANDO.
       *
       * Acender o item "Cobranças em atraso" na coluna com o painel de
       * Lançamentos atrás ensina metade: a pessoa vê onde clicar e não vê o
       * que aparece depois do clique. O tutorial dá o clique por ela, que é
       * exatamente o que ela faria.
       *
       * Só em `data-secao`, e a regra sai do próprio seletor em vez de uma
       * marca à parte: essa marca existe só nos botões da coluna da esquerda,
       * cujo trabalho é trocar de seção. Um `data-acao` — como o + Novo
       * paciente — abriria um diálogo por cima do tutorial e o esconderia
       * atrás do que ele estava explicando.
       */
      if (!jaAbriu && el instanceof HTMLElement && alvo.startsWith("[data-secao=")) {
        jaAbriu = true;
        el.click();
      }

      // Traz o elemento para a tela antes de medir: numa lista longa ele pode
      // estar abaixo da dobra, e o holofote ficaria fora do campo de visão.
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      medir();
      // Segunda medição depois de a rolagem suave terminar e o painel novo
      // acabar de desenhar.
      relogio = setTimeout(medir, 350);
    };

    relogio = setTimeout(procurar, 60);

    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      vivo = false;
      clearTimeout(relogio);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto, alvoDaEtapa]);

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

  /**
   * Onde a janela senta.
   *
   * Abaixo do elemento quando cabe; acima quando não cabe. Sem alvo, no centro
   * — que é exatamente o comportamento antigo, e por isso a falta de alvo não
   * é um caso de erro.
   *
   * A largura é limitada e a posição, presa às bordas: a janela encostada num
   * botão do canto direito sairia da tela, e a pessoa leria meia frase.
   */
  const posicao = (() => {
    if (!foco) return undefined;
    const LARGURA = 340, MARGEM = 12;
    const alturaTela = typeof window === "undefined" ? 800 : window.innerHeight;
    const larguraTela = typeof window === "undefined" ? 1200 : window.innerWidth;
    // Em tela estreita a janela ocupa a largura toda e vai para baixo: ao lado
    // de um botão num celular sobram quarenta pixels de texto.
    if (larguraTela < 560) return undefined;

    const abaixo = foco.topo + foco.altura + MARGEM;
    const cabeAbaixo = abaixo + 240 < alturaTela;
    const esquerda = Math.min(
      Math.max(MARGEM, foco.esquerda),
      larguraTela - LARGURA - MARGEM,
    );
    return cabeAbaixo
      ? { top: abaixo, left: esquerda, width: LARGURA }
      : { bottom: alturaTela - foco.topo + MARGEM, left: esquerda, width: LARGURA };
  })();

  return (
    <div className={`tutorialFundo${foco ? " comFoco" : ""}`} role="presentation">
      {/* O recorte. A escuridão é a sombra DESTE elemento, espalhada para fora
          por um raio maior que a tela: assim o buraco acompanha o botão sem
          precisar de quatro retângulos calculados em volta dele. */}
      {foco && (
        <span
          className="tutorialFoco" aria-hidden="true"
          style={{
            top: foco.topo, left: foco.esquerda,
            width: foco.largura, height: foco.altura,
          }}
        />
      )}
      <div
        className={`tutorialJanela${posicao ? " ancorada" : ""}`}
        style={posicao} role="dialog" aria-modal="true"
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
