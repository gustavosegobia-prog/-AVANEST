/**
 * A abertura animada da marca.
 *
 * ===========================================================================
 * POR QUE ELA EXISTE AQUI, E NÃO NA TELA DE ABERTURA DO IPHONE
 * ===========================================================================
 * A tela que o iOS mostra no toque do ícone é uma IMAGEM, e nenhuma plataforma
 * anima aquilo — está escrito em lib/tela-de-abertura.ts, e continua valendo.
 * Animação de marca, portanto, só pode ser a primeira coisa que o SITE pinta.
 *
 * O que torna a emenda invisível é que a imagem do iOS foi regerada para
 * mostrar SÓ O NOME — o primeiro quadro desta animação. A sequência que a
 * pessoa vê é uma só, atravessando dois programas diferentes:
 *
 *     iOS desenha o nome  →  o site assume  →  o Λ se desenha por cima
 *
 * Sem isso, o iOS mostraria a marca inteira e pronta, e o site logo em seguida
 * a desmontaria para remontá-la: leria como falha, e não como abertura.
 *
 * ===========================================================================
 * POR QUE É CSS PURO, E NÃO UM COMPONENTE DE CLIENTE
 * ===========================================================================
 * Um componente de cliente só monta DEPOIS da hidratação. A pessoa veria o
 * painel por um instante e então uma cortina caindo por cima dele — que é o
 * oposto de uma abertura.
 *
 * Aqui a marcação vem no HTML do servidor e a animação é do CSS, então ela já
 * está no primeiro quadro pintado. E some sozinha, sem JavaScript nenhum:
 * `forwards` deixa o último quadro valendo, com `visibility:hidden` e
 * `pointer-events:none`. Se o JavaScript falhar, a abertura ainda termina e
 * ninguém fica preso atrás dela.
 *
 * O ÚNICO JavaScript é o roteiro embutido abaixo, e ele decide uma coisa só:
 * se esta sessão já viu a abertura. Precisa rodar antes da primeira pintura —
 * daí ser embutido e bloqueante —, porque decidir isso depois já seria tarde:
 * a cortina teria piscado.
 */

/**
 * Quem já viu, não vê de novo.
 *
 * `sessionStorage`, e não `localStorage`, e a diferença é o comportamento
 * inteiro: abrir o aplicativo instalado começa uma sessão nova, então a
 * abertura toca a cada abertura de verdade — que é quando ela faz sentido.
 * Navegar entre as telas do site é a mesma sessão, e ali ela não repete. Com
 * `localStorage` ela tocaria uma vez na vida e nunca mais.
 *
 * O try/catch não é decorativo: em navegação privada e com cookies bloqueados,
 * só de LER o `sessionStorage` alguns navegadores lançam. Sem ele, a exceção
 * subiria num roteiro bloqueante do <head> e derrubaria a página inteira antes
 * de qualquer coisa aparecer. Se der erro, a abertura simplesmente toca.
 *
 * NÃO HÁ MAIS DETECÇÃO DE "VEIO PELO ÍCONE" AQUI, e a remoção foi o conserto
 * de um defeito real. Ela existia para não redesenhar o que a imagem do iOS já
 * mostrava — mas o efeito prático era que, no aplicativo instalado, o Λ NUNCA
 * se desenhava: a pessoa via ação só no nome. Como agora a imagem do iOS traz
 * apenas o TRILHO do Λ, e não o traço pintado, não há nada repetido a evitar:
 * uma linha do tempo só, igual para todo mundo.
 */
const ROTEIRO_DA_ABERTURA = `try{
if(sessionStorage.getItem('avanest:abertura')){document.documentElement.className+=' semAbertura'}
else{sessionStorage.setItem('avanest:abertura','1')}
}catch(e){}`;

/**
 * A folha de estilo da abertura, EMBUTIDA no HTML — e é aqui que ela precisa
 * estar, não no globals.css.
 *
 * O motivo é medido: o CSS do site tem 217 KB. Ele é uma folha externa, e
 * folha externa BLOQUEIA A PRIMEIRA PINTURA — o navegador não desenha nada
 * enquanto ela não chega inteira. Com a abertura lá dentro, ela só começava
 * depois desses 217 KB: no aplicativo instalado, isso é a imagem do iOS
 * parada na tela por um tempo que numa rede de hospital não é pouco.
 *
 * Embutida, ela é lida no mesmo instante em que o HTML chega — 30 KB, uma
 * conexão só, sem ida e volta nenhuma. A animação começa no primeiro quadro
 * pintado, que é o que ela existe para fazer.
 *
 * Os comentários ficaram no globals.css? Não: ficaram no arquivo de onde este
 * texto saiu. Aqui vai a versão sem comentários, porque este trecho viaja em
 * TODA resposta HTML do site, e explicação em bytes que atravessam a rede
 * trinta vezes por dia é explicação no lugar errado. O porquê de cada regra
 * está no comentário do componente, logo acima.
 *
 * A FONTE É DECLARADA AQUI, com pilha de reserva. Sem isso a marca herdaria a
 * fonte do body — que vem do globals.css, o arquivo que ainda não chegou.
 */
const ESTILO_DA_ABERTURA = `.abertura{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;
  background:#fff;
  animation:aberturaSai .34s ease-in 1.60s forwards}
.semAbertura .abertura{display:none}
@keyframes aberturaSai{
  from{opacity:1;visibility:visible}
  99%{opacity:0;visibility:visible}
  to{opacity:0;visibility:hidden;pointer-events:none}
}
.marcaAvanest{font-family:Outfit,ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;display:grid;justify-items:center;gap:0;
  padding:0 var(--esp-5);max-width:420px;width:100%;
  transform:translateY(-1.7vh)}
.marcaSimbolo{width:min(25.9vw,108px);height:auto;display:block}
.marcaNome{display:flex;justify-content:center;margin:0.35px 0 0;
  font-size:clamp(23px,7.551vw,32px);font-weight:800;letter-spacing:.1012em;
  line-height:1;
  text-indent:.1012em}
.marcaNome span:nth-child(-n+4){color:#0879c9}
.marcaNome span:nth-child(n+5){color:#2bc5a8}
.marcaSlogan{margin:8.4px 0 0;font-size:clamp(7.5px,2.28vw,9.5px);font-weight:600;
  line-height:1;letter-spacing:.317em;text-transform:uppercase;color:#7c95a8;
  text-indent:.317em}
.marcaAvanest.animada .marcaNome span{opacity:0;transform:translateY(10px);
  animation:aberturaLetra .36s cubic-bezier(.2,.7,.3,1) forwards}
.marcaAvanest.animada .marcaNome span:nth-child(1){animation-delay:.54s}
.marcaAvanest.animada .marcaNome span:nth-child(2){animation-delay:.59s}
.marcaAvanest.animada .marcaNome span:nth-child(3){animation-delay:.64s}
.marcaAvanest.animada .marcaNome span:nth-child(4){animation-delay:.69s}
.marcaAvanest.animada .marcaNome span:nth-child(5){animation-delay:.74s}
.marcaAvanest.animada .marcaNome span:nth-child(6){animation-delay:.79s}
.marcaAvanest.animada .marcaNome span:nth-child(7){animation-delay:.84s}
@keyframes aberturaLetra{to{opacity:1;transform:translateY(0)}}
.marcaAvanest.animada .marcaSlogan{opacity:0;
  animation:aberturaSlogan .36s ease-out 1.14s forwards}
@keyframes aberturaSlogan{from{opacity:0;letter-spacing:.45em}
  to{opacity:1;letter-spacing:.317em}}
.marcaTrilho{stroke:url(#marcaAvn);opacity:.22}
.marcaAvanest.animada .marcaSimbolo path:not(.marcaTrilho){stroke-dasharray:226;stroke-dashoffset:226;
  animation:aberturaTraco .64s cubic-bezier(.4,0,.25,1) 0s forwards}
@keyframes aberturaTraco{to{stroke-dashoffset:0}}
@media(prefers-reduced-motion:reduce){
  .abertura{animation:aberturaSai .3s ease-in .25s forwards}
  .marcaAvanest.animada .marcaNome span,
  .marcaAvanest.animada .marcaSlogan{opacity:1;transform:none;animation:none}
  .marcaAvanest.animada .marcaSimbolo path:not(.marcaTrilho){stroke-dashoffset:0;animation:none}
}`;

export function RoteiroDaAbertura() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ESTILO_DA_ABERTURA }} />
      <script dangerouslySetInnerHTML={{ __html: ROTEIRO_DA_ABERTURA }} />
    </>
  );
}

/**
 * O Λ da marca — o mesmo traçado da assinatura das folhas impressas.
 *
 * Um traço só, e é isso que permite desenhá-lo: `stroke-dasharray` transforma
 * um caminho aberto num risco que corre do começo ao fim. Duas formas fechadas
 * não teriam como se desenhar assim, só aparecer.
 */
const CAMINHO_DO_LAMBDA = "M15 110 51 25c3-8 8-13 14-13s11 5 15 14l32 84";

export function MarcaAvanest({ animada = true }: { animada?: boolean }) {
  return (
    <div className={`marcaAvanest${animada ? " animada" : ""}`}>
      <svg className="marcaSimbolo" viewBox="0 0 128 128" aria-hidden="true">
        <defs>
          <linearGradient id="marcaAvn" x1="18" y1="16" x2="104" y2="112"
            gradientUnits="userSpaceOnUse">
            <stop stopColor="#0879c9" />
            <stop offset=".55" stopColor="#0d8ce1" />
            <stop offset="1" stopColor="#2bc5a8" />
          </linearGradient>
        </defs>
        {/* O TRILHO — o mesmo caminho, na cor da marca e mais claro, por baixo.
            Ele existe para que a imagem do iOS não precise ficar em branco nem
            mostrar o Λ já pintado. Mostrando o trilho, o aparelho tem o que
            desenhar no toque do ícone, e o site continua exatamente dali:
            o traço colorido corre POR CIMA do trilho.
            Sem ele, das duas uma — ou a imagem era branca, e o aplicativo
            parecia travado, ou trazia o Λ pronto, e aí não havia o que
            desenhar depois.

            Colorido, e não cinza: é a primeira coisa que se vê ao tocar no
            ícone, e um Λ cinza ali parece logo que não carregou. */}
        <path className="marcaTrilho" d={CAMINHO_DO_LAMBDA} fill="none"
          strokeLinecap="round" strokeLinejoin="round" strokeWidth={14} />
        <path d={CAMINHO_DO_LAMBDA} fill="none" stroke="url(#marcaAvn)"
          strokeLinecap="round" strokeLinejoin="round" strokeWidth={14} />
      </svg>
      {/* Letra a letra porque elas entram escalonadas. O nome inteiro fica no
          aria-label: um leitor de tela lendo "A V A N E S T" soletraria a
          marca, e ninguém chama a empresa assim. */}
      <p className="marcaNome" aria-label="AVANEST">
        {[..."AVANEST"].map((letra, i) => (
          <span key={`${letra}${i}`} aria-hidden="true">{letra}</span>
        ))}
      </p>
      <p className="marcaSlogan">Gestão em anestesiologia</p>
    </div>
  );
}

/**
 * A cortina.
 *
 * `aria-hidden` e sem foco nenhum: para quem usa leitor de tela isto não é
 * conteúdo, é uma transição. O nome da empresa ele já leu no cabeçalho da
 * página que está atrás.
 */
export function AberturaAnimada() {
  return (
    <div className="abertura" aria-hidden="true">
      <MarcaAvanest />
    </div>
  );
}
