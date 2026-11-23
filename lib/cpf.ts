/**
 * O CPF de quem cria a conta (23/11/2026): conferido pelos dígitos
 * verificadores, sem consulta externa. Pega o número digitado errado e o
 * inventado ("111.111.111-11", "123.456.789-00"); não diz se o CPF é da
 * pessoa — isso exigiria a consulta paga à Receita. A mesma conta vale no
 * banco, em public.cpf_valido.
 */
export function digitosDoCpf(valor: string | null | undefined): string {
  return String(valor ?? "").replace(/\D/g, "");
}

function digitoVerificador(base: string): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(valor: string | null | undefined): boolean {
  const d = digitosDoCpf(valor);
  if (d.length !== 11 || d === d[0].repeat(11)) return false;
  return digitoVerificador(d.slice(0, 9)) === Number(d[9])
    && digitoVerificador(d.slice(0, 10)) === Number(d[10]);
}

/** "52998224725" → "529.982.247-25"; o que não tem 11 dígitos volta como veio. */
export function cpfFormatado(valor: string | null | undefined): string {
  const d = digitosDoCpf(valor);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : String(valor ?? "");
}

/** A frase da tela: falta número, ou os números não conferem. */
export function avisoDoCpf(valor: string | null | undefined): string | null {
  const d = digitosDoCpf(valor);
  if (d.length !== 11) return "Informe o CPF com os 11 números.";
  if (!cpfValido(d)) return "Esse CPF não confere. Verifique os números.";
  return null;
}
