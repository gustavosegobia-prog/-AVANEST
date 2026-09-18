// Quem precisa ver o convite para instalar o AVANEST na tela de início.
//
// POR QUE ISSO EXISTE. De dezenove pessoas cadastradas, quatro têm aparelho
// registrado para notificação. Os três cadastros da campanha têm zero — o que
// mais lança plantão entre eles fez R$ 6.498 pelo navegador, sem o aplicativo
// na tela. E no iPhone isso não é preferência: o Safari SÓ entrega notificação
// para site adicionado à tela de início. Quem está numa aba não recebe aviso de
// plantão nenhum, e não tem como saber disso.
//
// O CASO QUE DECIDE ESTE ARQUIVO é o navegador embutido. O link da campanha vai
// por direct do Instagram, e quem toca nele não abre o Safari: abre o navegador
// DE DENTRO do Instagram. Ali "Adicionar à Tela de Início" não existe — o menu
// é outro. Ensinar o passo do Safari para quem está no Instagram é mandar a
// pessoa procurar um botão que não está na tela dela, e ela conclui, com razão,
// que o sistema é confuso. Esse caso precisa de outra instrução: sair para o
// Safari primeiro.
//
// A decisão é pura de propósito, para caber em teste: quem lê `navigator` é o
// componente, que passa os dados para cá.

export type CasoDaInstalacao =
  /** Safari de verdade no iPhone/iPad: dá para instalar, e o passo a passo serve. */
  | "safari"
  /** Navegador embutido de outro aplicativo: não dá. Primeiro sair para o Safari. */
  | "embutido"
  /** Chrome, Firefox ou Edge no iPhone: o caminho muda de lugar a cada versão. */
  | "outro-navegador";

export type Leitura = {
  ua: string;
  /** `display-mode: standalone` ou `navigator.standalone`. */
  naTelaDeInicio: boolean;
  /** iPad moderno se diz Mac; é o toque que o entrega. */
  plataforma?: string;
  pontosDeToque?: number;
};

export type Convite =
  | { mostrar: false }
  | { mostrar: true; caso: CasoDaInstalacao; app: string | null };

// Os navegadores embutidos que importam aqui. O do Instagram é o primeiro da
// lista porque é por onde a campanha chega; os outros vêm junto porque o mesmo
// link é reencaminhado por WhatsApp entre colegas o dia inteiro.
const EMBUTIDOS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
  [/Messenger/i, "Messenger"],
  [/WhatsApp/i, "WhatsApp"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Threads/i, "Threads"],
  [/TikTok|BytedanceWebview/i, "TikTok"],
  [/Telegram/i, "Telegram"],
  [/Snapchat/i, "Snapchat"],
  [/MicroMessenger/i, "WeChat"],
  [/\bLine\//i, "Line"],
  [/Twitter/i, "X"],
];

// CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge, OPiOS/OPT = Opera. No iPhone
// todos rodam sobre o mesmo motor do Safari, mas o menu de instalar fica em
// lugar diferente em cada um — e muda de versão para versão.
const OUTROS_NAVEGADORES = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//;

export function ehIOS({ ua, plataforma, pontosDeToque = 0 }: Leitura): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ manda user agent de Mac. Mac não tem tela de toque; iPad tem.
  return plataforma === "MacIntel" && pontosDeToque > 1;
}

export function appEmbutido(ua: string): string | null {
  for (const [padrao, nome] of EMBUTIDOS) if (padrao.test(ua)) return nome;
  return null;
}

export function conviteDeInstalacao(leitura: Leitura): Convite {
  // Já instalado: não há o que oferecer, e uma faixa aqui seria ruído diário.
  if (leitura.naTelaDeInicio) return { mostrar: false };

  // Fora do iPhone o assunto é outro. No Android a notificação funciona na aba
  // comum, então não há urgência nenhuma em instalar, e no computador não
  // existe "tela de início". Repetir o convite ali só ensinaria a ignorá-lo.
  if (!ehIOS(leitura)) return { mostrar: false };

  const app = appEmbutido(leitura.ua);
  if (app) return { mostrar: true, caso: "embutido", app };

  if (OUTROS_NAVEGADORES.test(leitura.ua)) {
    return { mostrar: true, caso: "outro-navegador", app: null };
  }

  return { mostrar: true, caso: "safari", app: null };
}

// ---------------------------------------------------------------------------
// Os textos
// ---------------------------------------------------------------------------
// Ficam aqui, e não no componente, porque são o que o teste precisa travar: é
// fácil trocar uma palavra e transformar a instrução certa numa instrução que
// não corresponde a nenhum botão da tela da pessoa.

export function tituloDoConvite(caso: CasoDaInstalacao): string {
  return caso === "safari"
    ? "Instale o AVANEST na tela de início"
    : "Abra no Safari para instalar";
}

export function explicacaoDoConvite(caso: CasoDaInstalacao, app: string | null): string {
  if (caso === "embutido") {
    return `Você está no navegador do ${app}, e por aqui não dá para instalar. `
      + "Toque nos três pontos e escolha “Abrir no Safari” — lá o passo a passo aparece.";
  }
  if (caso === "outro-navegador") {
    return "Neste navegador o caminho muda de lugar a cada versão. "
      + "Copie o endereço, abra no Safari e o passo a passo aparece aqui.";
  }
  return "No iPhone, o aviso de plantão só chega com o AVANEST na tela de início. "
    + "São três toques:";
}

/**
 * Os três toques do Safari.
 *
 * O ÍCONE VEM ANTES DO TEXTO, e não depois. Depois, ele caía sozinho numa
 * segunda linha sempre que a frase enchia a largura do telefone — e um glifo
 * órfão embaixo da frase não ilustra nada, parece defeito. Na frente, ele é o
 * primeiro item da linha: a pessoa vê o desenho do botão que vai procurar antes
 * de ler o que fazer com ele.
 */
export const PASSOS_DO_SAFARI = [
  { texto: "Toque em Compartilhar, na barra de baixo", icone: "compartilhar" },
  { texto: "Role e toque em “Adicionar à Tela de Início”", icone: "adicionar" },
  { texto: "Toque em “Adicionar”, no canto superior direito", icone: null },
] as const;
