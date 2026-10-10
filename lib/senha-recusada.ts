// A senha que o Supabase recusa, explicada em português.
//
// Com a proteção contra senhas vazadas ligada (painel do Supabase), o cadastro
// e a troca de senha passam a recusar senhas que já apareceram em vazamentos —
// a lista do HaveIBeenPwned. O erro chega em inglês ("Password is known to be
// weak and easy to guess"), e mostrar isso cru, ou trocar por um "não foi
// possível alterar a senha", deixa a pessoa tentando a mesma senha de novo sem
// entender por quê.

type ErroDeSenha = { code?: string; message?: string; reasons?: string[] } | null | undefined;

/** A frase para a pessoa, ou null quando o erro não é de senha fraca. */
export function senhaRecusada(erro: ErroDeSenha): string | null {
  if (!erro) return null;
  const texto = String(erro.message ?? "");
  const motivos = Array.isArray(erro.reasons) ? erro.reasons : [];
  const fraca = erro.code === "weak_password" || motivos.length > 0 || /weak|pwned|leaked/i.test(texto);
  if (!fraca) return null;
  if (motivos.includes("pwned") || /pwned|leaked/i.test(texto)) {
    return "Esta senha já apareceu em vazamentos de dados na internet e pode ser descoberta por quem tem essas listas. Escolha outra — de preferência longa, que você não use em nenhum outro site.";
  }
  if (motivos.includes("length")) return "A senha é curta demais. Use pelo menos oito caracteres.";
  if (motivos.includes("characters")) return "A senha precisa misturar letras maiúsculas, minúsculas, números e símbolos.";
  return "Esta senha é fácil de adivinhar. Escolha outra, mais longa.";
}
