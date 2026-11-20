/**
 * O celular do cadastro: só os dígitos, com DDD (10 a 13 dígitos, para caber
 * também o código do país). A mesma regra vale no banco, em
 * public.definir_meu_celular.
 */
export function digitosDoCelular(valor: string): string {
  return (valor || "").replace(/\D/g, "");
}

export function celularValido(valor: string): boolean {
  const n = digitosDoCelular(valor).length;
  return n >= 10 && n <= 13;
}

export const AVISO_CELULAR = "Informe o celular com DDD, por exemplo (41) 99999-9999.";
