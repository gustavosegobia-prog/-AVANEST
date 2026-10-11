import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { avaliarDose, idadeEmDias, type RegraDeDose } from "@/lib/evolucao/doses";
import { administrados, doseAcumulada, mesmoMedicamento, type UnidadeDeDose } from "@/lib/evolucao/medicamentos";
import { minutosEntre, vigentes, type Registro } from "@/lib/evolucao/registros";
import { classificarErro, motivoLegivel } from "@/lib/evolucao/fila";
import { conferirAlergia } from "@/lib/evolucao/alergias";

// A porta por onde cada registro da folha de anestesia entra no banco.
//
// Ela existe por um motivo só: a conferência de dose tem de ser refeita NO
// SERVIDOR. A tela calcula para mostrar o alerta antes do toque; aqui a conta
// é refeita com as regras aprovadas lidas do banco, o peso da folha e as doses
// já dadas — e é o resultado DAQUI que fica gravado no registro. Alerta
// amarelo ou vermelho sem justificativa não entra; erro técnico (unidade que
// não converte, falta de peso para uma regra por kg) não entra nunca.
//
// A alergia registrada também é conferida aqui: medicamento que coincide com
// ela só entra administrado com justificativa.
//
// O resto da validação (faixas, unidades, coerência dose × volume) está no
// gatilho do banco, que vale para qualquer caminho de escrita. E a gravação
// usa o cliente do próprio usuário: a RLS decide se ele pode escrever nesta
// folha, não esta rota.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIPOS = ["sinal", "medicamento", "infusao", "gas", "liquido", "evento"];

export async function POST(request: NextRequest) {
  const invalida = validateMutationRequest(request);
  if (invalida) return invalida;

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido ilegível." }, { status: 400 });
  }
  const id = String(corpo.id ?? "");
  const evolucaoId = String(corpo.evolucao_id ?? "");
  const tipo = String(corpo.tipo ?? "");
  const substitui = corpo.substitui_id ? String(corpo.substitui_id) : null;
  if (!UUID.test(id) || !UUID.test(evolucaoId) || (substitui && !UUID.test(substitui)) || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Registro malformado." }, { status: 400 });
  }
  const momento = String(corpo.momento ?? "");
  if (Number.isNaN(Date.parse(momento))) {
    return NextResponse.json({ error: "Horário inválido." }, { status: 400 });
  }
  const anulado = corpo.anulado === true;
  const dados = (typeof corpo.dados === "object" && corpo.dados !== null ? corpo.dados : {}) as Record<string, unknown>;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  const limitado = enforceRateLimit(`evolucao-registro:${user.id}`, { limit: 600, windowMs: 60_000 });
  if (limitado) return limitado;

  // ---- Alergia registrada × medicamento, conferida aqui ----------------
  // O texto das alergias vem do cabeçalho da folha NO BANCO, não do aparelho.
  // Coincidiu: administrar (ou iniciar infusão) só com justificativa, e o
  // que fica gravado é o que o servidor achou. Não coincidiu: nenhum
  // "alerta_alergia" vindo da tela entra.
  const dado = !anulado && ((tipo === "medicamento" && dados.status === "administrado")
    || (tipo === "infusao" && dados.acao === "iniciar"));
  if (!anulado && (tipo === "medicamento" || (tipo === "infusao" && dados.acao === "iniciar"))) {
    const { data: folhaAlergia } = await supabase
      .from("evolucoes_anestesicas").select("dados").eq("id", evolucaoId).maybeSingle();
    const conflito = folhaAlergia ? conferirAlergia(folhaAlergia.dados ?? {}, String(dados.nome ?? "")) : null;
    const enviada = (dados.alerta_alergia ?? {}) as Record<string, unknown>;
    const justificativa = String(enviada.justificativa ?? "").trim().slice(0, 500);
    // Corrigir o horário de algo JÁ dado não é dar de novo: não trava a
    // correção. Administrar o que estava planejado, sim, é dar.
    let jaDado = false;
    if (conflito && dado && substitui) {
      const { data: antigo } = await supabase.from("evolucao_registros").select("dados").eq("id", substitui).maybeSingle();
      const d0 = (antigo?.dados ?? {}) as Record<string, unknown>;
      jaDado = d0.status === "administrado" || d0.acao === "iniciar";
    }
    if (conflito && dado && !jaDado && justificativa.length < 5) {
      return NextResponse.json({
        error: `${String(dados.nome)} coincide com a alergia registrada (${conflito.alergias}). Registre a justificativa para seguir.`,
        alergia: conflito,
      }, { status: 422 });
    }
    if (conflito) dados.alerta_alergia = { ...conflito, justificativa: dado && justificativa ? justificativa : null };
    else delete dados.alerta_alergia;
  }

  // ---- Conferência de dose, refeita aqui -------------------------------
  if (tipo === "medicamento" && !anulado && dados.status === "administrado") {
    const { data: folha } = await supabase
      .from("evolucoes_anestesicas").select("id,dados,patient_id").eq("id", evolucaoId).maybeSingle();
    if (!folha) return NextResponse.json({ error: "Folha não encontrada." }, { status: 404 });
    const [{ data: paciente }, { data: regras }, { data: linhas }] = await Promise.all([
      supabase.from("pacientes").select("data_nascimento").eq("id", folha.patient_id).maybeSingle(),
      supabase.from("regras_de_dose").select("*").eq("aprovada", true),
      supabase.from("evolucao_registros").select("*").eq("evolucao_id", evolucaoId).eq("tipo", "medicamento"),
    ]);
    const peso = typeof folha.dados?.peso_kg === "number" ? folha.dados.peso_kg : null;
    const nome = String(dados.nome ?? "");
    const unidade = String(dados.unidade ?? "") as UnidadeDeDose;
    // As doses já dadas, sem a que esta linha está corrigindo.
    const dadas = administrados(vigentes((linhas ?? []) as Registro[]).filter((r) => r.id !== substitui))
      .filter((a) => mesmoMedicamento(a.nome, nome) && Date.parse(a.momento) <= Date.parse(momento));
    const ultima = dadas.map((a) => a.momento).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    const avaliacao = avaliarDose((regras ?? []) as RegraDeDose[], {
      medicamento: nome,
      via: String(dados.via ?? ""),
      indicacao: String(dados.indicacao ?? ""),
      dose: typeof dados.dose === "number" ? dados.dose : NaN,
      unidade,
      pesoKg: peso,
      idadeDias: idadeEmDias(paciente?.data_nascimento ?? null, new Date(momento)),
      acumuladoAntes: doseAcumulada(dadas, nome, unidade) ?? 0,
      minutosDesdeUltima: ultima ? minutosEntre(ultima, momento) : null,
    });
    if (avaliacao.nivel === "erro") {
      return NextResponse.json({ error: avaliacao.motivos.join(" "), alerta: avaliacao }, { status: 422 });
    }
    const enviada = (dados.alerta ?? {}) as Record<string, unknown>;
    const justificativa = String(enviada.justificativa ?? "").trim().slice(0, 500);
    if (avaliacao.exigeJustificativa && !justificativa) {
      return NextResponse.json({ error: "Dose com alerta: registre a justificativa clínica para seguir.", alerta: avaliacao },
        { status: 422 });
    }
    dados.alerta = {
      nivel: avaliacao.nivel,
      motivos: avaliacao.motivos,
      por_kg: avaliacao.porKg,
      unidade_por_kg: avaliacao.unidadePorKg,
      regra_id: avaliacao.regra?.id ?? null,
      regra_versao: avaliacao.regra?.versao ?? null,
      justificativa: justificativa || null,
    };
  }

  const linha = {
    id, evolucao_id: evolucaoId, tipo, momento, dados,
    origem: ["manual", "estimado", "importado"].includes(String(corpo.origem)) ? corpo.origem : "manual",
    substitui_id: substitui, anulado,
    motivo: corpo.motivo ? String(corpo.motivo).slice(0, 300) : null,
    // institution_id, autor e horário de gravação vêm do gatilho do banco,
    // a partir da folha — nunca do aparelho.
  };
  const { data, error } = await supabase.from("evolucao_registros").insert(linha).select("*").single();
  if (!error) return NextResponse.json({ registro: data });

  const resultado = classificarErro(error);
  if (resultado === "salvo") {
    // Reenvio de algo que já tinha entrado: devolve a linha gravada.
    const { data: existente } = await supabase.from("evolucao_registros").select("*").eq("id", id).maybeSingle();
    if (existente) return NextResponse.json({ registro: existente });
  }
  if (resultado === "conflito") {
    return NextResponse.json({ error: "Outra pessoa corrigiu este registro antes. A folha foi atualizada.", conflito: true },
      { status: 409 });
  }
  if (resultado === "recusado") {
    return NextResponse.json({ error: motivoLegivel(error.message ?? "") }, { status: 422 });
  }
  return NextResponse.json({ error: "Não foi possível salvar agora. Tentando de novo." }, { status: 503 });
}
