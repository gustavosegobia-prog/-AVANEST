// O que a folha sabe de si: eventos, técnica, equipe, saída da sala, e a
// conferência antes de encerrar.

import { num, type Registro } from "./registros.ts";
import { montarInfusoes } from "./infusoes.ts";
import { periodosSemMonitorizacao, lacunaPadrao } from "./sinais.ts";
import { conferirAlergia } from "./alergias.ts";
import { antropometriaPlausivel } from "../numero-clinico.ts";

/**
 * IMC do peso e da altura da folha, com uma casa. Nulo sem os dois ou com
 * valor fora do plausível — a mesma régua da avaliação, que já pegou "1,72"
 * no campo de centímetros virando IMC de seis dígitos. Em criança o número
 * sai igual, mas a leitura é por percentil, não pelos cortes do adulto.
 */
export function imcDaFolha(dados: Record<string, unknown>): number | null {
  const peso = num(dados.peso_kg), altura = num(dados.altura_cm);
  if (!antropometriaPlausivel(peso, altura)) return null;
  return Math.round((peso! / (altura! / 100) ** 2) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Eventos rápidos
// ---------------------------------------------------------------------------
export const EVENTOS: Array<{ codigo: string; rotulo: string; marco?: boolean }> = [
  { codigo: "inicio_monitorizacao", rotulo: "Início da monitorização" },
  { codigo: "inicio_anestesia", rotulo: "Início da anestesia", marco: true },
  { codigo: "inducao", rotulo: "Indução" },
  { codigo: "intubacao", rotulo: "Intubação" },
  { codigo: "inicio_vm", rotulo: "Início da ventilação mecânica" },
  { codigo: "bloqueio", rotulo: "Bloqueio realizado" },
  { codigo: "inicio_cirurgia", rotulo: "Início da cirurgia", marco: true },
  { codigo: "mudanca_decubito", rotulo: "Mudança de decúbito" },
  { codigo: "intercorrencia", rotulo: "Intercorrência" },
  { codigo: "fim_cirurgia", rotulo: "Fim da cirurgia", marco: true },
  { codigo: "extubacao", rotulo: "Extubação" },
  { codigo: "fim_anestesia", rotulo: "Fim da anestesia", marco: true },
  { codigo: "transferencia_rpa", rotulo: "Transferência à RPA" },
  { codigo: "transferencia_uti", rotulo: "Transferência à UTI" },
];

export const rotuloDoEvento = (codigo: string, descricao?: string) =>
  EVENTOS.find((e) => e.codigo === codigo)?.rotulo ?? (descricao || codigo);

/** O horário de um marco (o primeiro "início", o último "fim"). */
export function horarioDoMarco(vigentes: readonly Registro[], codigo: string): string | null {
  const lista = vigentes.filter((r) => r.tipo === "evento" && r.dados.codigo === codigo).map((r) => r.momento)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  if (!lista.length) return null;
  return codigo.startsWith("fim") ? lista[lista.length - 1] : lista[0];
}

// ---------------------------------------------------------------------------
// Técnica, posição e saída — as opções da folha de papel
// ---------------------------------------------------------------------------
export const POSICOES = ["DDH", "Litotomia", "DLE", "DLD", "Decúbito ventral", "Sentado", "Trendelenburg", "Proclive"];
export const PROTECOES = ["Proteção ocular", "Coxim — cabeça", "Coxim — face", "Coxim — braços", "Coxim — pernas", "Colchão inflável", "Manta térmica"];

export const TECNICAS: Array<{ codigo: string; rotulo: string }> = [
  { codigo: "geral_balanceada", rotulo: "Geral balanceada" },
  { codigo: "geral_inalatoria", rotulo: "Geral inalatória" },
  { codigo: "geral_venosa_total", rotulo: "Geral venosa total" },
  { codigo: "raquianestesia", rotulo: "Raquianestesia" },
  { codigo: "peridural", rotulo: "Peridural" },
  { codigo: "combinada", rotulo: "Raqui-peridural combinada" },
  { codigo: "sedacao", rotulo: "Sedação" },
  { codigo: "bloqueio_periferico", rotulo: "Bloqueio periférico" },
  { codigo: "local_assistida", rotulo: "Local assistida" },
];

export const BLOQUEIOS = ["Interescalênico", "Supraclavicular", "Infraclavicular", "Axilar", "ESP (eretor da espinha)",
  "TAP", "Femoral", "Fáscia ilíaca", "Poplíteo", "Safeno", "PENG", "Quadrado lombar", "Outro"];

export type Profissional = {
  /** Id do perfil, quando é alguém do sistema; nulo para quem vem de fora. */
  perfil_id: string | null;
  nome: string;
  crm: string;
  uf: string;
  funcao: "responsavel" | "residente" | "preceptor" | "outro";
  ano_residencia?: "R1" | "R2" | "R3" | null;
};

export const FUNCOES: Record<Profissional["funcao"], string> = {
  responsavel: "Anestesiologista responsável",
  residente: "Médico residente",
  preceptor: "Preceptor",
  outro: "Médico participante",
};

/**
 * A equipe que vai para o papel: só quem foi vinculado. Sem residente e sem
 * preceptor, sai só o responsável — sem linhas vazias "Residente: ____".
 */
export function equipeParaImpressao(equipe: readonly Profissional[]): Profissional[] {
  const ordem: Profissional["funcao"][] = ["responsavel", "preceptor", "residente", "outro"];
  return equipe.filter((p) => p.nome.trim()).sort((a, b) => ordem.indexOf(a.funcao) - ordem.indexOf(b.funcao));
}

// ---------------------------------------------------------------------------
// Conferência antes de encerrar
// ---------------------------------------------------------------------------
export type Pendencia = { tipo: "falta" | "inconsistencia" | "aviso"; texto: string };

export function conferirEncerramento(
  dados: Record<string, unknown>, vigentes: readonly Registro[], intervaloMin: number,
): Pendencia[] {
  const p: Pendencia[] = [];
  const equipe = (dados.equipe as Profissional[] | undefined) ?? [];
  if (!equipe.some((e) => e.funcao === "responsavel" && e.nome.trim())) {
    p.push({ tipo: "falta", texto: "Anestesiologista responsável." });
  }
  if (!String(dados.procedimento ?? "").trim()) p.push({ tipo: "falta", texto: "Procedimento cirúrgico." });
  if (!Array.isArray(dados.tecnicas) || !(dados.tecnicas as unknown[]).length) {
    p.push({ tipo: "falta", texto: "Técnica anestésica." });
  }
  const inicio = horarioDoMarco(vigentes, "inicio_anestesia");
  const fim = horarioDoMarco(vigentes, "fim_anestesia");
  if (!inicio) p.push({ tipo: "falta", texto: "Horário de início da anestesia." });
  if (!fim) p.push({ tipo: "falta", texto: "Horário de fim da anestesia." });
  if (inicio && fim && Date.parse(fim) <= Date.parse(inicio)) {
    p.push({ tipo: "inconsistencia", texto: "O fim da anestesia está antes do início." });
  }
  const ic = horarioDoMarco(vigentes, "inicio_cirurgia"), fc = horarioDoMarco(vigentes, "fim_cirurgia");
  if (ic && fc && Date.parse(fc) <= Date.parse(ic)) {
    p.push({ tipo: "inconsistencia", texto: "O fim da cirurgia está antes do início." });
  }
  if (!String((dados.saida as Record<string, unknown> | undefined)?.destino ?? "").trim()) {
    p.push({ tipo: "falta", texto: "Destino ao sair da sala (RPA, UTI ou outro)." });
  }
  for (const inf of montarInfusoes(vigentes)) {
    if (!inf.fim) p.push({ tipo: "inconsistencia", texto: `Infusão de ${inf.nome} sem horário de término.` });
  }
  // Dado que coincide com a alergia sem justificativa gravada — típico da
  // alergia escrita DEPOIS da administração: a conferência final aponta.
  for (const r of vigentes) {
    const dado = r.tipo === "medicamento" && r.dados.status === "administrado"
      || r.tipo === "infusao" && r.dados.acao === "iniciar";
    const justificada = Boolean((r.dados.alerta_alergia as { justificativa?: unknown } | undefined)?.justificativa);
    if (!dado || justificada) continue;
    const c = conferirAlergia(dados, String(r.dados.nome ?? ""));
    if (c) p.push({ tipo: "aviso", texto: `${String(r.dados.nome)} coincide com a alergia registrada (${c.alergias}).` });
  }
  const pendentes = vigentes.filter((r) => r.tipo === "medicamento"
    && (r.dados.status === "planejado" || r.dados.status === "preparado"));
  for (const r of pendentes) {
    p.push({ tipo: "aviso", texto: `${String(r.dados.nome)} está como ${String(r.dados.status)} — administrado ou cancelado?` });
  }
  if (num(dados.peso_kg) === null) p.push({ tipo: "aviso", texto: "Peso não registrado: as doses ficam sem conta por kg." });
  if (inicio && fim) {
    for (const g of periodosSemMonitorizacao(vigentes, inicio, fim, lacunaPadrao(intervaloMin))) {
      const h = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      p.push({ tipo: "aviso", texto: `Sem registro de PA ou FC entre ${h(g.de)} e ${h(g.ate)}.` });
    }
  }
  return p;
}
