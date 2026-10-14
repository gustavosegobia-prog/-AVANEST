// A tela que aparece NA HORA em que se toca num link do sistema.
//
// As páginas do sistema são montadas no servidor, com a sessão e os dados de
// quem pediu. Sem esta tela, o toque não mudava nada até a página nova chegar
// inteira — e o aplicativo parecia travado. O Next pré-carrega esta tela junto
// com o link (loading.tsx de cada área), então ela aparece sem esperar a rede.
//
// Só forma, sem texto inventado: um esboço da página que vem, e a frase para
// leitor de tela. Respeita o tema escuro (temaApp) e quem pede menos movimento.

export function TelaCarregando({ oQue }: { oQue: string }) {
  return (
    <main className="telaCarregando temaApp" aria-busy="true">
      <div className="barraCarregando" aria-hidden="true" />
      <div className="telaCarregandoTopo" aria-hidden="true"><span /><span /></div>
      <div className="telaCarregandoCorpo" aria-hidden="true">
        <span className="t" />
        <span className="l" />
        <span className="c" />
        <span className="c" />
      </div>
      <p className="sr-only" role="status">Carregando {oQue}…</p>
    </main>
  );
}
