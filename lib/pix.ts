// O Pix da consulta: o "copia e cola" e o QR Code no padrão do Banco Central
// (BR Code, EMV QRCPS-MPM), gerados aqui mesmo com a chave Pix do grupo.
//
// POR QUE ASSIM. Funciona com qualquer banco, sem conta nova, sem taxa e sem
// integração: o código leva a chave, o nome e a cidade de quem recebe e o
// valor da consulta. A confirmação é da recepção, que vê o Pix cair no banco
// e toca em "Recebido" (o recebimento entra no Financeiro). Confirmar sozinho
// pede a API Pix do banco do grupo, que é outro passo.
//
// Referência: "Manual de Padrões para Iniciação do Pix", Banco Central do
// Brasil. O exemplo oficial do manual está nos testes (lib/pix.test.ts).

export type TipoDeChave = "cpf" | "cnpj" | "celular" | "email" | "aleatoria";

export const NOME_DO_TIPO: Record<TipoDeChave, string> = {
  cpf: "CPF", cnpj: "CNPJ", celular: "Celular", email: "E-mail", aleatoria: "Chave aleatória",
};

export type PixDaOrganizacao = { tipo: TipoDeChave; chave: string; nome: string; cidade: string };

/** A chave como o Pix espera: CPF e CNPJ só números, celular com +55, e-mail e aleatória em minúsculas. */
export function normalizarChave(tipo: TipoDeChave, chave: string): { ok: true; chave: string } | { ok: false; erro: string } {
  const bruto = String(chave ?? "").trim();
  const digitos = bruto.replace(/\D/g, "");
  if (tipo === "cpf") return digitos.length === 11 ? { ok: true, chave: digitos } : { ok: false, erro: "O CPF tem 11 números." };
  if (tipo === "cnpj") return digitos.length === 14 ? { ok: true, chave: digitos } : { ok: false, erro: "O CNPJ tem 14 números." };
  if (tipo === "celular") {
    const sem55 = digitos.length === 13 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
    return sem55.length === 11 ? { ok: true, chave: `+55${sem55}` } : { ok: false, erro: "Celular com DDD: 11 números, ex.: (44) 99999-0000." };
  }
  if (tipo === "email") {
    const e = bruto.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 77 ? { ok: true, chave: e } : { ok: false, erro: "E-mail inválido." };
  }
  const a = bruto.toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(a)
    ? { ok: true, chave: a }
    : { ok: false, erro: "A chave aleatória tem 32 letras e números, no formato 1234abcd-…" };
}

/** Sem acento e só o que o padrão aceita, no tamanho máximo do campo. */
export function textoDoPix(texto: string, max: number): string {
  return String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,\-/]/g, " ").replace(/\s+/g, " ").trim()
    .slice(0, max).trim();
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como pede o BR Code. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Identificador do pagamento: só letras e números, até 25. "***" quando não há. */
export function txidDaConsulta(agendamentoId: string): string {
  const limpo = String(agendamentoId ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return limpo ? `CONSULTA${limpo}`.slice(0, 25) : "***";
}

/** O "copia e cola" do Pix. O mesmo texto vira o QR Code. */
export function codigoPix({ chave, nome, cidade, valor, txid = "***" }: {
  chave: string; nome: string; cidade: string; valor?: number | null; txid?: string;
}): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave);
  const corpo = [
    campo("00", "01"),
    campo("26", conta),
    campo("52", "0000"),
    campo("53", "986"),
    valor && valor > 0 ? campo("54", valor.toFixed(2)) : "",
    campo("58", "BR"),
    campo("59", textoDoPix(nome, 25) || "RECEBEDOR"),
    campo("60", textoDoPix(cidade, 15) || "BRASIL"),
    campo("62", campo("05", (txid.replace(/[^A-Za-z0-9*]/g, "") || "***").slice(0, 25))),
    "6304",
  ].join("");
  return corpo + crc16(corpo);
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A primeira mensagem do WhatsApp: valor e como pagar. O código vai na seguinte, sozinho, para copiar inteiro. */
export function mensagemDoPix({ paciente, organizacao, valor }: { paciente: string; organizacao: string; valor: number }): string {
  const nome = String(paciente ?? "").trim().split(/\s+/)[0] ?? "";
  const primeiro = nome ? nome[0].toUpperCase() + nome.slice(1).toLowerCase() : "";
  return [
    `Olá${primeiro ? `, ${primeiro}` : ""}! Segue o Pix da sua consulta pré-anestésica${organizacao ? ` com a *${organizacao}*` : ""}.`,
    "",
    `Valor: *${reais(valor)}*`,
    "",
    "Na próxima mensagem vai o código Pix. Copie e cole no app do seu banco, em *Pix › Copia e Cola*.",
    "",
    "Depois de pagar, se puder, mande o comprovante por aqui. Obrigado!",
  ].join("\n");
}

/** O que o banco de quem paga mostra, para a recepção conferir antes de mandar. */
export function resumoDoPix(pix: PixDaOrganizacao, valor: number): string {
  return `${reais(valor)} para ${textoDoPix(pix.nome, 25)} (${NOME_DO_TIPO[pix.tipo]} ${pix.chave})`;
}

// ── O pagamento registrado na consulta ─────────────────────────────────────
// A forma que a recepção escolhe e o que vai para o Financeiro. O banco aceita
// PIX, Cartão, Dinheiro, Transferência e Outro: crédito e débito vão como
// "Cartão", com a modalidade na referência.

export type FormaDePagamento = { id: string; rotulo: string; metodo: string; referencia?: string };

export const FORMAS_DE_PAGAMENTO: FormaDePagamento[] = [
  { id: "pix", rotulo: "Pix", metodo: "PIX" },
  { id: "credito", rotulo: "Cartão de crédito", metodo: "Cartão", referencia: "Crédito" },
  { id: "debito", rotulo: "Cartão de débito", metodo: "Cartão", referencia: "Débito" },
  { id: "dinheiro", rotulo: "Dinheiro", metodo: "Dinheiro" },
  { id: "transferencia", rotulo: "Transferência", metodo: "Transferência" },
];

/** "Pago · Pix · R$ 250,00", para a agenda. */
export function rotuloDoPagamento(metodo: string | null | undefined, referencia: string | null | undefined, valor: number | null | undefined): string {
  const forma = metodo === "Cartão"
    ? (referencia === "Crédito" || referencia === "Débito" ? referencia : "Cartão")
    : metodo === "PIX" ? "Pix" : metodo || "";
  return ["Pago", forma, valor ? reais(Number(valor)) : ""].filter(Boolean).join(" · ");
}
