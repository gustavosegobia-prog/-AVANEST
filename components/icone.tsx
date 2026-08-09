// Conjunto de ícones do AVANEST.
//
// Desenhados aqui em SVG em vez de vir de uma biblioteca: são poucos, e uma
// dependência inteira para quinze traços pesaria mais do que resolve. Todos
// partilham o mesmo traço de 1.7 e o mesmo quadro de 24, então mudam de
// tamanho e de cor junto com o texto ao lado.
//
// Por padrão são decorativos (aria-hidden). Quando o ícone for a única coisa
// dentro do botão, passe `rotulo` para o leitor de tela ter o que anunciar.

type Props = {
  nome: keyof typeof TRACOS;
  tamanho?: number;
  rotulo?: string;
  className?: string;
};

const TRACOS = {
  tema: <><circle cx="12" cy="12" r="8"/><path d="M12 4v16a8 8 0 0 0 0-16Z" fill="currentColor" stroke="none"/></>,
  assinatura: <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></>,
  estrela: <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z"/>,
  cadeado: <><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></>,
  fechar: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  envelope: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  confirmado: <path d="m4.5 12.5 5 5 10-11"/>,
  imprimir: <><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="7" rx="2"/><path d="M7 14h10v6.5H7z"/></>,
  alerta: <><path d="M12 3.8 21 19.5H3z"/><path d="M12 9.5v4.5"/><path d="M12 17.2v.1"/></>,
  pausa: <><path d="M9.5 5v14"/><path d="M14.5 5v14"/></>,
  voltar: <><path d="M9.5 5.5 3.5 12l6 6.5"/><path d="M3.5 12h11a6 6 0 0 1 0 12h-1"/></>,
  copiar: <><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/></>,
  whatsapp: <><path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-4A8 8 0 1 1 20 12Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.4-2-1-.9.9a4.6 4.6 0 0 1-2.1-2.1l.9-.9-1-2z" fill="currentColor" stroke="none"/></>,
  busca: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  pessoa: <><circle cx="12" cy="8" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></>,
  calculadora: <><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7.5h7"/><path d="M9 12v.1"/><path d="M12 12v.1"/><path d="M15 12v.1"/><path d="M9 16.5v.1"/><path d="M12 16.5v.1"/><path d="M15 16.5v.1"/></>,
} as const;

export function Icone({ nome, tamanho = 16, rotulo, className }: Props) {
  return (
    <svg
      width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={rotulo ? undefined : true}
      role={rotulo ? "img" : undefined} focusable="false"
    >
      {rotulo && <title>{rotulo}</title>}
      {TRACOS[nome]}
    </svg>
  );
}
