/**
 * A versão do site que este código carrega: o commit que a Vercel publicou.
 *
 * Vem de next.config.ts (`env`), que a escreve no código do navegador e no do
 * servidor no mesmo build. Uma página aberta há dias carrega a versão daquele
 * dia; /api/versao responde a de agora. É assim que a TV do centro cirúrgico
 * percebe que saiu versão nova.
 */
export const VERSAO_DO_SITE = process.env.VERSAO_DO_SITE ?? "local";

/**
 * Se a página deve recarregar para pegar a versão publicada.
 *
 * Só quando o servidor responde uma versão, ela é outra, e ainda não se
 * recarregou por ela: se depois de recarregar a página continuar na versão
 * antiga (um cache no caminho), recarregar de novo não resolve — e uma TV
 * piscando a cada cinco minutos é pior que uma TV desatualizada.
 */
export function deveRecarregar(minha: string, doServidor: string | null | undefined, jaTentada: string | null): boolean {
  if (!doServidor || doServidor === minha) return false;
  return doServidor !== jaTentada;
}
