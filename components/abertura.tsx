import { BrandMark } from "@/components/brand-mark";

// ===========================================================================
// A abertura do aplicativo
// ===========================================================================
// O que o sistema operacional mostra ao tocar no ícone — a tela com o logo
// parado, antes de o site carregar — é uma IMAGEM, e imagem não anima. No
// Android ela é montada pelo próprio Chrome a partir do manifesto; no iPhone e
// no iPad vem de um PNG declarado em apple-touch-startup-image. Não há como
// animar nenhuma das duas: não é limitação do nosso código, é como as duas
// plataformas funcionam.
//
// O que dá para animar é o instante SEGUINTE: a primeira coisa que o site
// desenha. Se ela tiver exatamente o mesmo fundo branco da tela do sistema, a
// emenda não aparece — o logo parado do sistema vira o logo que se desenha, e
// a impressão é de uma abertura só.
//
// SEM JAVASCRIPT DEPOIS DO PRIMEIRO INSTANTE. A cortina some por animação de
// CSS, com fill-mode forwards: se o JavaScript demorar, falhar ou estiver
// desligado, ela some do mesmo jeito. Uma cortina que depende de código para
// sair é uma cortina que um dia fica presa na frente do login — e ninguém
// entra no sistema.
//
// QUEM VÊ: só quem instalou o aplicativo na tela de início, e só uma vez por
// abertura. No navegador, aberto numa aba entre outras vinte, uma cortina de
// marca a cada visita é propaganda no meio do trabalho. Quem decide isso é o
// script de app/layout.tsx, que roda antes da primeira pintura.
// ===========================================================================

export function Abertura() {
  return (
    <div className="abertura" aria-hidden="true">
      <div className="aberturaMarca">
        {/* Gradiente com id próprio: esta marca convive na mesma página com a
            do cabeçalho, e id repetido faz a segunda apontar para dentro de um
            bloco escondido — o traço some. */}
        <BrandMark className="aberturaSimbolo" gradiente="-abertura" />
        <strong className="aberturaNome">
          <span className="brandBlue">AV</span>
          <span className="brandMidA">A</span>
          <span className="brandTeal">NEST</span>
        </strong>
        <small>GESTÃO EM ANESTESIOLOGIA</small>
      </div>
    </div>
  );
}

/**
 * O script que decide se a abertura aparece. Roda antes da primeira pintura.
 *
 * Precisa ser assim, e não um efeito de React: um componente só decide depois
 * de montar, e até lá a tela de login já apareceu. A cortina entraria DEPOIS
 * do conteúdo — que é o contrário de uma abertura.
 *
 * Por isso a marcação fica no <html>, escrita por este script, e o CSS mostra
 * a cortina só quando ela está lá. O React não gerencia esse atributo, então
 * não há divergência entre o HTML do servidor e o do navegador.
 */
export const SCRIPT_DA_ABERTURA = `try{
  var app = window.matchMedia('(display-mode: standalone)').matches
         || window.matchMedia('(display-mode: fullscreen)').matches
         || window.navigator.standalone === true;
  var jaViu = sessionStorage.getItem('avanest_abertura') === '1';
  if (app && !jaViu) {
    document.documentElement.setAttribute('data-abrindo','1');
    sessionStorage.setItem('avanest_abertura','1');
  }
}catch(e){}`;
