// "Pular para o conteúdo" (23/11/2026, auditoria de qualidade): o primeiro
// Tab das páginas públicas. Quem navega pelo teclado passava por todo o menu
// do topo — seis paradas na página da ficha anestésica — antes de chegar ao
// texto. Fica escondido até receber o foco. O destino é o primeiro bloco
// depois do topo, marcado com id="conteudo".
export function PularParaOConteudo() {
  return <a className="pularConteudo" href="#conteudo">Pular para o conteúdo</a>;
}
