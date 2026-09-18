"use client";

import { useEffect, useState } from "react";
import {
  conviteDeInstalacao, explicacaoDoConvite, PASSOS_DO_SAFARI, tituloDoConvite,
  type CasoDaInstalacao,
} from "@/lib/instalacao";

// A faixa que ensina a pôr o AVANEST na tela de início do iPhone.
//
// Quem decide SE aparece é lib/instalacao.ts, com teste. Aqui só se lê o
// navegador e se desenha.
//
// OS ÍCONES SÃO DESENHADOS, e não fotografados. A instrução escrita — "toque em
// Compartilhar" — depende de a pessoa saber qual é o botão de compartilhar, e
// no iPhone ele é um quadrado com uma seta que ninguém chama por esse nome. Uma
// captura de tela resolveria, mas envelhece a cada versão do iOS e pesa: o site
// inteiro não tem uma imagem sequer, e o primeiro arquivo a entrar seria
// justamente numa faixa que aparece antes de a pessoa estar logada no celular
// dela, no 4G do hospital. Desenhado em SVG, o ícone acompanha o tema, não
// borra em tela retina e não custa uma requisição.

/** O quadrado com a seta para cima, da barra de baixo do Safari. */
function IconeCompartilhar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11M12 3l-3.2 3.2M12 3l3.2 3.2" />
      <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v7A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18.5 10H17" />
    </svg>
  );
}

/** O quadrado com o "+", do item "Adicionar à Tela de Início". */
function IconeAdicionar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

/** Os três pontos do menu dos navegadores embutidos. */
function IconeMais() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * O convite já foi dispensado neste aparelho, e até quando fica calado?
 *
 * Mesma regra do convite de push, e pelo mesmo motivo: "Depois" ADIA, não
 * cancela. Quem tocar de passagem num dia corrido continuaria sem receber aviso
 * de plantão sem nunca ter decidido isso — e no iPhone, sem instalar, não
 * existe outro caminho para o aviso chegar.
 *
 * Sete dias, e não catorze como no push: ali o recurso continua disponível pelo
 * menu do perfil, aqui não há menu nenhum que resolva — a instalação só
 * acontece pela mão da pessoa, no Safari. O custo de perguntar de novo é uma
 * faixa; o de não perguntar é o aviso de plantão que nunca chega.
 *
 * localStorage porque a decisão é DESTE aparelho: dispensar no iPad não pode
 * calar o convite no iPhone, que é onde a escala é consultada. O try/catch
 * existe porque em janela anônima o acessor LANÇA, em vez de devolver vazio.
 */
const CHAVE = "avanest-instalar-convite";
const DIAS_CALADO = 7;

const jaDispensou = () => {
  try {
    const ate = Number(localStorage.getItem(CHAVE));
    return Number.isFinite(ate) && ate > Date.now();
  } catch { return false; }
};

const dispensarPorUmaSemana = () => {
  try {
    localStorage.setItem(CHAVE, String(Date.now() + DIAS_CALADO * 864e5));
  } catch { /* janela anônima */ }
};

export function InstalarNaTela() {
  // Um estado só, e não um para o caso e outro para o aplicativo: os dois
  // nascem da mesma leitura e mudam juntos. Separados, seriam duas escritas
  // seguidas dentro do efeito e dois renders onde um basta.
  const [convite, setConvite] = useState<{ caso: CasoDaInstalacao; app: string | null } | null>(null);

  // A leitura mora DENTRO de um efeito, e não num inicializador de useState: o
  // servidor não tem `navigator` nem `localStorage`, e renderizar no servidor
  // uma faixa que o navegador esconde quebra a hidratação. É o mesmo cuidado do
  // convite de push, e pela mesma razão.
  useEffect(() => {
    if (jaDispensou()) return;
    const lido = conviteDeInstalacao({
      ua: navigator.userAgent,
      naTelaDeInicio:
        window.matchMedia("(display-mode: standalone)").matches
        || (window.navigator as { standalone?: boolean }).standalone === true,
      plataforma: navigator.platform,
      pontosDeToque: navigator.maxTouchPoints,
    });
    if (!lido.mostrar) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ver acima: a leitura depende de navigator e localStorage, que não existem no servidor
    setConvite({ caso: lido.caso, app: lido.app });
  }, []);

  if (!convite) return null;

  const { caso, app } = convite;
  const naoDaAqui = caso !== "safari";

  return (
    <section className="instalarFaixa" role="region" aria-label="Instalar o AVANEST">
      <span className="instalarSelo" aria-hidden="true">
        {naoDaAqui ? <IconeMais /> : <IconeCompartilhar />}
      </span>

      <div className="instalarTexto">
        <strong>{tituloDoConvite(caso)}</strong>
        <p>{explicacaoDoConvite(caso, app)}</p>

        {/* OS PASSOS FICAM ABERTOS, sem botão para revelar. São três linhas, e
            esconder atrás de um "ver como fazer" cobra um toque a mais de quem
            já está no caminho errado — a pessoa que não recebe aviso de plantão
            e não sabe por quê. O custo de mostrar é três linhas; o de esconder
            é ela não clicar.

            E só aparecem onde eles de fato existem: no navegador do Instagram
            esta lista seria a instrução de uma tela que a pessoa não está
            vendo. */}
        {!naoDaAqui && (
          <ol className="instalarPassos">
            {PASSOS_DO_SAFARI.map((passo, i) => (
              <li key={passo.texto}>
                <span className="instalarNumero" aria-hidden="true">{i + 1}</span>
                {/* A casa do ícone existe mesmo vazia, no terceiro passo, para
                    os três textos começarem na mesma coluna. Sem ela, a última
                    linha avança sozinha e a lista perde o prumo. */}
                <span className="instalarGlifo" aria-hidden="true">
                  {passo.icone === "compartilhar" && <IconeCompartilhar />}
                  {passo.icone === "adicionar" && <IconeAdicionar />}
                </span>
                <span className="instalarPasso">{passo.texto}</span>
              </li>
            ))}
          </ol>
        )}

        {!naoDaAqui && (
          <p className="instalarPremio">
            Depois disso o aviso do seu plantão chega sozinho, com o aplicativo fechado.
          </p>
        )}
      </div>

      <div className="instalarBotoes">
        {/* NÃO EXISTE BOTÃO QUE INSTALE: o iOS não tem `beforeinstallprompt`.
            Um "Instalar" aqui abriria uma caixa que nunca vem, e a pessoa
            ficaria esperando por ela. O único botão honesto é o de dispensar. */}
        <button type="button" className="pushDepois"
          onClick={() => { dispensarPorUmaSemana(); setConvite(null); }}>
          Agora não
        </button>
      </div>
    </section>
  );
}
