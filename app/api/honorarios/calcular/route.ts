import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { calcularHonorario, type JaLancado } from "@/lib/honorarios";
import {
  edicaoCbhpm, tabelasDoCalculo, versoesPublicadas,
  type LinhaContrato, type LinhaOperadora, type LinhaValorPorte, type LinhaValorProcedimento, type LinhaVersao,
} from "@/lib/honorarios-dados";
import { faltaInstalar } from "@/lib/honorarios-telas";

// O honorário previsto de UMA anestesia da Produção.
//
// A linha é lida com a sessão do médico — a Produção é pessoal, e o RLS só
// entrega a dele. As tabelas da clínica (contrato, CBHPM, correspondências)
// são lidas com a chave de serviço: o médico não abre a tabela de preços do
// convênio, só recebe o resultado da conta. E o resultado é gravado com a
// chave de serviço porque é o único caminho que o banco aceita para o
// honorário (gatilho protege_honorario_da_producao): na tela, ninguém o
// escreve à mão.
//
// Enquanto o módulo é conferido, só o super-admin calcula.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const erro = (mensagem: string, status: number) => NextResponse.json({ error: mensagem }, { status });

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erro("Entre de novo para calcular.", 401);
  const excedeu = enforceRateLimit(`honorario:${user.id}`, { limit: 240, windowMs: 3_600_000 });
  if (excedeu) return excedeu;

  const { data: perfil } = await supabase
    .from("perfis").select("institution_id, status, super_admin").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !perfil.institution_id) return erro("Conta sem organização ativa.", 403);
  if (perfil.super_admin !== true) return erro("O cálculo do honorário ainda está em conferência.", 403);

  const corpo = await request.json().catch(() => null) as { producaoId?: unknown; urgencia?: unknown } | null;
  const producaoId = typeof corpo?.producaoId === "string" && UUID.test(corpo.producaoId) ? corpo.producaoId : null;
  if (!producaoId) return erro("Anestesia não informada.", 400);

  // 1. A anestesia, pela sessão do médico.
  const lida = await supabase.from("producao_do_dia")
    .select("id, perfil_id, institution_id, data, convenio, local_id, paciente, valor, urgencia")
    .eq("id", producaoId).maybeSingle();
  if (lida.error) {
    return faltaInstalar(lida.error) ? erro("O módulo de honorários ainda não foi instalado no banco.", 503)
      : erro("Não foi possível ler a anestesia.", 500);
  }
  const prod = lida.data as {
    id: string; perfil_id: string; institution_id: string; data: string; convenio: string;
    local_id: string | null; paciente: string; valor: number | string; urgencia: boolean;
  } | null;
  if (!prod || prod.perfil_id !== user.id) return erro("Anestesia não encontrada na sua produção.", 404);

  // A urgência é do médico: muda pela sessão dele, e o gatilho desfaz o
  // cálculo anterior.
  if (typeof corpo?.urgencia === "boolean" && corpo.urgencia !== prod.urgencia) {
    const { error } = await supabase.from("producao_do_dia").update({ urgencia: corpo.urgencia }).eq("id", prod.id);
    if (error) return erro("Não foi possível marcar a urgência.", 500);
    prod.urgencia = corpo.urgencia;
  }

  const { data: procs } = await supabase.from("producao_procedimentos")
    .select("ordem, tuss_codigo").eq("producao_id", prod.id).order("ordem");
  const codigos = ((procs ?? []) as Array<{ tuss_codigo: string | null }>).map((p) => p.tuss_codigo ?? "").filter(Boolean);

  // O mesmo procedimento já lançado para o paciente no dia: as outras
  // anotações do médico naquele dia, com os códigos delas.
  const { data: doDia } = await supabase.from("producao_do_dia")
    .select("id, data, paciente").eq("perfil_id", user.id).eq("data", prod.data).neq("id", prod.id);
  const outrosDoDia = (doDia ?? []) as Array<{ id: string; data: string; paciente: string }>;
  const outros: JaLancado[] = [];
  if (outrosDoDia.length) {
    const { data: deles } = await supabase.from("producao_procedimentos")
      .select("producao_id, tuss_codigo").in("producao_id", outrosDoDia.map((o) => o.id));
    for (const o of outrosDoDia) {
      outros.push({
        data: o.data, paciente: o.paciente,
        codigos: ((deles ?? []) as Array<{ producao_id: string; tuss_codigo: string | null }>)
          .filter((d) => d.producao_id === o.id && d.tuss_codigo).map((d) => d.tuss_codigo as string),
      });
    }
  }

  // 2. As tabelas da clínica, pela chave de serviço.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return erro("O cálculo ainda não foi habilitado no servidor.", 503);
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } });
  const inst = prod.institution_id;

  const [tuss, edicoes, operadoras, contratos, versoes] = await Promise.all([
    admin.from("tuss_versoes").select("id, versao").eq("tabela", "22").eq("situacao", "vigente").maybeSingle(),
    admin.from("cbhpm_edicoes").select("id, edicao").eq("institution_id", inst).neq("situacao", "em_conferencia"),
    admin.from("operadoras").select("id, nome, particular, ativo").eq("institution_id", inst),
    admin.from("contratos").select("id, operadora_id, identificacao, local_id, ativo").eq("institution_id", inst),
    admin.from("contrato_versoes")
      .select("id, contrato_id, versao, vigencia_inicio, vigencia_fim, referencia, cbhpm_edicao_id, reajuste_percentual, urgencia_percentual, multiplos_percentuais, ajustes, ajustes_cumulativos, situacao")
      .eq("institution_id", inst).neq("situacao", "rascunho"),
  ]);
  const falhou = [tuss, edicoes, operadoras, contratos, versoes].find((r) => r.error);
  if (falhou?.error) {
    return faltaInstalar(falhou.error) ? erro("O módulo de honorários ainda não foi instalado no banco.", 503)
      : erro("Não foi possível ler as tabelas da clínica.", 500);
  }
  const listaDeEdicoes = (edicoes.data ?? []) as Array<{ id: string; edicao: string }>;
  const listaDeVersoes = (versoes.data ?? []) as LinhaVersao[];
  const idsDasVersoes = listaDeVersoes.map((v) => v.id);
  const idsDasEdicoes = listaDeEdicoes.map((e) => e.id);
  const vazio = { data: [] as unknown[], error: null };

  const [tussCodigos, correspondencias, porPorte, porProcedimento, portes] = await Promise.all([
    tuss.data && codigos.length
      ? admin.from("tuss_codigos").select("codigo, descricao, situacao, substituido_por, inicio_vigencia, fim_vigencia")
        .eq("versao_id", (tuss.data as { id: string }).id).in("codigo", codigos)
      : vazio,
    codigos.length
      ? admin.from("tuss_cbhpm_correspondencias").select("tuss_codigo, cbhpm_edicao_id, cbhpm_codigo, situacao")
        .eq("institution_id", inst).eq("situacao", "validada").in("tuss_codigo", codigos)
      : vazio,
    idsDasVersoes.length ? admin.from("contrato_valores_porte").select("versao_id, porte, valor").in("versao_id", idsDasVersoes) : vazio,
    // Da tabela do plano, só os códigos desta anestesia: o resto não entra na conta.
    idsDasVersoes.length && codigos.length
      ? admin.from("contrato_valores_procedimento").select("versao_id, tuss_codigo, valor, porte_anestesico")
        .in("versao_id", idsDasVersoes).in("tuss_codigo", codigos)
      : vazio,
    idsDasEdicoes.length
      ? admin.from("cbhpm_portes").select("edicao_id, porte, valor_referencia, vigencia_inicio").in("edicao_id", idsDasEdicoes)
      : vazio,
  ]);
  const cors = (correspondencias.data ?? []) as Array<{ tuss_codigo: string; cbhpm_edicao_id: string; cbhpm_codigo: string; situacao: string }>;
  const codigosCbhpm = [...new Set(cors.map((c) => c.cbhpm_codigo))];
  const procsCbhpm = idsDasEdicoes.length && codigosCbhpm.length
    ? await admin.from("cbhpm_procedimentos").select("edicao_id, codigo, porte_anestesico")
      .in("edicao_id", idsDasEdicoes).in("codigo", codigosCbhpm)
    : vazio;
  const procedimentosCbhpm = (procsCbhpm.data ?? []) as Array<{ edicao_id: string; codigo: string; porte_anestesico: number | null }>;
  const listaDePortes = (portes.data ?? []) as Array<{ edicao_id: string; porte: number; valor_referencia: number | string; vigencia_inicio: string }>;

  const tabelas = tabelasDoCalculo({
    tussVersao: (tuss.data as { id: string; versao: string } | null) ?? null,
    tussCodigos: (tussCodigos.data ?? []) as Parameters<typeof tabelasDoCalculo>[0]["tussCodigos"],
    correspondencias: cors,
    edicoes: listaDeEdicoes.map((e) => edicaoCbhpm(e,
      procedimentosCbhpm.filter((p) => p.edicao_id === e.id), listaDePortes.filter((p) => p.edicao_id === e.id))),
    contratos: versoesPublicadas(listaDeVersoes, (contratos.data ?? []) as LinhaContrato[], (operadoras.data ?? []) as LinhaOperadora[],
      (porPorte.data ?? []) as LinhaValorPorte[], (porProcedimento.data ?? []) as LinhaValorProcedimento[]),
  });

  const valor = Number(prod.valor);
  const r = calcularHonorario({
    data: prod.data, convenio: prod.convenio, localId: prod.local_id, urgencia: prod.urgencia,
    procedimentos: codigos, valorInformado: valor > 0 ? valor : null, paciente: prod.paciente,
  }, tabelas, outros);

  // 3. O resultado, gravado na linha — com a memória do cálculo, que não muda
  // quando a tabela for atualizada depois.
  const { error: gravar } = await admin.from("producao_do_dia").update({
    honorario_situacao: r.situacao,
    honorario_valor_previsto: r.valorPrevisto,
    honorario_pendencias: r.pendencias,
    honorario_calculo: { ...r.memoria, mensagem: r.mensagem, calculado_por: user.id },
    honorario_calculado_em: new Date().toISOString(),
    contrato_versao_id: r.memoria.contratoVersaoId,
  }).eq("id", prod.id).eq("perfil_id", user.id);
  if (gravar) return erro("O cálculo foi feito, mas não foi possível gravar. Tente de novo.", 500);

  return NextResponse.json({
    situacao: r.situacao, valorPrevisto: r.valorPrevisto, mensagem: r.mensagem,
    pendencias: r.pendencias, memoria: r.memoria,
  });
}
