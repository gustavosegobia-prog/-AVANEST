// Alergia registrada × medicamento que vai ser dado.
//
// A folha traz da avaliação pré-anestésica o texto das alergias. Ao registrar
// um medicamento (ou iniciar uma infusão), o nome dele — princípio ativo e
// nomes comerciais do catálogo — é comparado com esse texto. Se coincidir, a
// tela avisa e pede justificativa para administrar, e o servidor confere de
// novo antes de gravar, como na conferência de dose.
//
// O QUE ISTO NÃO FAZ: não avalia reação cruzada entre classes (penicilina ×
// cefalosporina, por exemplo). Isso é julgamento clínico, que depende de
// regra validada; aqui só se compara nome. A tela diz isso.

import { CATALOGO, mesmoMedicamento } from "./medicamentos.ts";

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type ConflitoDeAlergia = {
  /** O nome que bateu, como está no catálogo ou no texto da alergia. */
  termo: string;
  /** O texto das alergias da folha naquele momento. */
  alergias: string;
};

/** Os nomes de um medicamento: o princípio ativo e os comerciais, se estiver no catálogo. */
export function nomesDoMedicamento(nome: string): string[] {
  const item = CATALOGO.find((c) => mesmoMedicamento(c.nome, nome) || c.sinonimos.some((s) => mesmoMedicamento(s, nome)));
  return item ? [item.nome, ...item.sinonimos] : [nome];
}

/**
 * Nulo quando não há conflito — inclusive com "nega alergia" ou sem alergia
 * escrita. A comparação ignora acento e maiúscula, aceita a variação de fim de
 * palavra ("fentanil" × "fentanila") e pega o nome dentro do outro
 * ("bupivacaína" na alergia, "levobupivacaína" no medicamento).
 */
export function conferirAlergia(
  dados: { alergias?: unknown; nega_alergia?: unknown }, nomeMedicamento: string,
): ConflitoDeAlergia | null {
  if (dados.nega_alergia === true) return null;
  const texto = typeof dados.alergias === "string" ? dados.alergias.trim() : "";
  if (!texto || !nomeMedicamento.trim()) return null;
  const alergia = normal(texto);
  const palavras = alergia.split(/[^a-z0-9]+/).filter((p) => p.length >= 5);

  for (const nome of nomesDoMedicamento(nomeMedicamento.trim())) {
    const n = normal(nome).trim();
    if (n.length < 4) continue;
    // O nome do medicamento (ou o radical dele) escrito na alergia…
    const radical = n.length > 6 ? n.slice(0, n.length - 2) : n;
    if (alergia.includes(radical)) return { termo: nome, alergias: texto };
    // …ou uma palavra da alergia dentro do nome do medicamento.
    const palavra = palavras.find((p) => n.replace(/[^a-z0-9]/g, "").includes(p));
    if (palavra) return { termo: nome, alergias: texto };
  }
  return null;
}

/** O que a tela mostra sobre alergia em qualquer janela de medicamento. */
export function situacaoDaAlergia(dados: { alergias?: unknown; nega_alergia?: unknown }): string {
  if (dados.nega_alergia === true) return "Nega alergia a medicamentos.";
  const texto = typeof dados.alergias === "string" ? dados.alergias.trim() : "";
  return texto ? `Alergias registradas: ${texto}.` : "Alergias não informadas na folha — confirme com o paciente.";
}
