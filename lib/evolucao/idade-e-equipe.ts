// Dois ajustes do cabeçalho da ficha anestésica (25/11/2026).
//
// 1. A IDADE SE CORRIGE NA PRÓPRIA FICHA. Ela vem do cadastro do paciente, e
//    antes não havia como trocá-la depois de iniciar a ficha: uma idade
//    digitada errado na entrada — ou lida errado da foto da ficha do hospital —
//    ficava na tela, na impressão e nas contas de dose pediátrica. A correção
//    grava no cadastro, que é de onde a tela e a impressão leem.
//
// 2. A EQUIPE CIRÚRGICA: além do cirurgião, o segundo cirurgião e o auxiliar;
//    na cesárea, também o pediatra que recebe o recém-nascido.

export type IdadeDoCadastro = { data_nascimento: string | null; idade_anos: number | null };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Anos completos entre o nascimento e o dia (ambos "AAAA-MM-DD"). */
export function anosCompletos(nascimento: string, dia: string): number {
  const [a1, m1, d1] = nascimento.split("-").map(Number);
  const [a2, m2, d2] = dia.split("-").map(Number);
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}

function dataExiste(iso: string): boolean {
  const m = ISO.exec(iso);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/**
 * O que gravar no cadastro, a partir do que se digitou na janela.
 *
 * Com a data de nascimento, ela manda: a idade em anos sai dela (é o que a
 * dose pediátrica usa, em dias). Só a idade em anos, sem data: a data antiga
 * sai do cadastro — se ela ficasse, a tela continuaria calculando a idade
 * errada por ela.
 */
export function idadeParaGravar(nascimento: string, anos: string, hoje: string):
  { ok: true; valor: IdadeDoCadastro } | { ok: false; erro: string } {
  const data = nascimento.trim();
  if (data) {
    if (!dataExiste(data)) return { ok: false, erro: "Data de nascimento inválida." };
    if (data > hoje) return { ok: false, erro: "A data de nascimento está no futuro." };
    const idade = anosCompletos(data, hoje);
    if (idade > 120) return { ok: false, erro: "Confira o ano de nascimento: dá mais de 120 anos." };
    return { ok: true, valor: { data_nascimento: data, idade_anos: idade } };
  }
  const texto = anos.trim();
  if (!texto) return { ok: false, erro: "Informe a data de nascimento ou a idade em anos." };
  if (!/^\d{1,3}$/.test(texto) || Number(texto) > 120) {
    return { ok: false, erro: "A idade em anos vai de 0 a 120." };
  }
  return { ok: true, valor: { data_nascimento: null, idade_anos: Number(texto) } };
}

/**
 * A cirurgia é cesárea? Pelo texto da cirurgia, sem acento e sem caixa:
 * "Cesárea", "cesariana", "cesareana", "parto cesáreo" e o "cesária" que se
 * escreve na pressa.
 */
export function ehCesarea(procedimento: unknown): boolean {
  const t = String(procedimento ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /cesar(e|i)(a|o|ana)\b/.test(t);
}
