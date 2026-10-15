"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { RegistroDeRevisao } from "@/lib/intercorrencias/situacao";
import type { Protocolo, Situacao } from "@/lib/intercorrencias/tipos";

/**
 * O histórico de revisão e o papel de quem usa — do banco, com cópia no
 * aparelho.
 *
 * A cópia é o que deixa consultar sem rede: o centro cirúrgico perde o sinal
 * justo na hora errada. Ela guarda o histórico (com os instantâneos
 * aprovados), não dado de paciente; o papel NÃO é guardado — sem rede, a
 * pessoa vê como médico, e o botão de aprovar não aparece.
 */

export type Papel = { papel: "editor" | "revisor" | null; admin: boolean; nome: string | null; crm: string | null };

type Estado = {
  registros: RegistroDeRevisao[];
  papel: Papel | null;
  /** De onde veio o histórico: do banco agora, da cópia do aparelho, ou de lugar nenhum. */
  fonte: "banco" | "copia" | "nenhuma";
  /** As tabelas do módulo ainda não existem no banco (migração não aplicada). */
  semBanco: boolean;
  salvoEm: string | null;
  carregando: boolean;
};

const CHAVE = "avanest:intercorrencias:revisoes:v1";

function lerCopia(): Estado {
  const vazio: Estado = { registros: [], papel: null, fonte: "nenhuma", semBanco: false, salvoEm: null, carregando: true };
  if (typeof window === "undefined") return vazio;
  try {
    const salvo = window.localStorage.getItem(CHAVE);
    if (!salvo) return vazio;
    const { registros, salvoEm } = JSON.parse(salvo) as { registros: RegistroDeRevisao[]; salvoEm: string };
    return Array.isArray(registros) ? { ...vazio, registros, salvoEm, fonte: "copia" } : vazio;
  } catch {
    return vazio; // navegador sem storage: segue sem cópia
  }
}

type Linha = {
  id: string; protocolo: string; versao: number; assinatura: string; situacao: Situacao; conteudo: unknown;
  observacao: string | null; autor_nome: string; autor_crm: string | null; autor_papel: RegistroDeRevisao["autorPapel"]; criado_em: string;
};
const doBanco = (l: Linha): RegistroDeRevisao => ({
  id: l.id, protocolo: l.protocolo, versao: l.versao, assinatura: l.assinatura, situacao: l.situacao, conteudo: l.conteudo,
  observacao: l.observacao, autorNome: l.autor_nome, autorCrm: l.autor_crm, autorPapel: l.autor_papel, criadoEm: l.criado_em,
});

/** Tabela ou função que não existe: a migração do módulo ainda não foi aplicada. */
const faltaNoBanco = (e: { code?: string } | null) => Boolean(e && ["42P01", "42883", "PGRST202", "PGRST205"].includes(e.code ?? ""));

export const MENSAGEM_DO_BANCO: Record<string, string> = {
  SEM_PERMISSAO: "Seu papel não permite esta decisão.",
  REVISOR_SEM_CRM: "Para aprovar, o CRM precisa estar no seu perfil.",
  MOTIVO_OBRIGATORIO: "Escreva o motivo (pelo menos 5 letras).",
  CONTEUDO_INVALIDO: "O conteúdo enviado não confere com o protocolo.",
  SITUACAO_INVALIDA: "Situação inválida.",
  PESSOA_NAO_ENCONTRADA: "Nenhum usuário ativo com este e-mail.",
  PAPEL_INVALIDO: "Papel inválido.",
};
export const traduzirErro = (mensagem: string) =>
  Object.entries(MENSAGEM_DO_BANCO).find(([codigo]) => mensagem.includes(codigo))?.[1] ?? "Não foi possível salvar. Tente de novo.";

/** Uma ida ao banco: o histórico e o papel. Devolve o que mudar no estado. */
async function buscar(): Promise<(e: Estado) => Estado> {
  const supabase = createClient();
  const [hist, papel] = await Promise.all([
    supabase.from("intercorrencias_revisoes")
      .select("id, protocolo, versao, assinatura, situacao, conteudo, observacao, autor_nome, autor_crm, autor_papel, criado_em")
      .order("criado_em", { ascending: true }).limit(2000),
    supabase.rpc("intercorrencias_meu_papel"),
  ]);
  if (faltaNoBanco(hist.error) || faltaNoBanco(papel.error)) return (e) => ({ ...e, semBanco: true, carregando: false });
  // Sem rede ou banco fora: fica a cópia do aparelho, se houver.
  if (hist.error) return (e) => ({ ...e, carregando: false });
  const registros = ((hist.data ?? []) as Linha[]).map(doBanco);
  const linha = (papel.data as Array<{ papel: string | null; admin: boolean; nome: string | null; crm: string | null }> | null)?.[0];
  const salvoEm = new Date().toISOString();
  try { window.localStorage.setItem(CHAVE, JSON.stringify({ registros, salvoEm })); } catch { /* sem storage */ }
  return () => ({
    registros, salvoEm, fonte: "banco", semBanco: false, carregando: false,
    papel: linha ? { papel: (linha.papel as Papel["papel"]) ?? null, admin: linha.admin === true, nome: linha.nome, crm: linha.crm } : null,
  });
}

export function useRevisoes() {
  const [estado, setEstado] = useState<Estado>(lerCopia);
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    let vale = true;
    void buscar().then((aplicar) => { if (vale) setEstado(aplicar); });
    return () => { vale = false; };
  }, [rodada]);

  const recarregar = useCallback(() => setRodada((r) => r + 1), []);

  /** Grava uma decisão e relê o histórico. Devolve a mensagem de erro, ou nulo quando deu certo. */
  const registrar = useCallback(async (p: Protocolo, assinatura: string, situacao: Situacao, observacao: string): Promise<string | null> => {
    const supabase = createClient();
    const { error } = await supabase.rpc("intercorrencias_registrar", {
      p_protocolo: p.id, p_versao: p.versao, p_assinatura: assinatura, p_situacao: situacao,
      p_conteudo: p, p_observacao: observacao.trim() || null,
    });
    if (error) return traduzirErro(error.message);
    recarregar();
    return null;
  }, [recarregar]);

  return { ...estado, recarregar, registrar };
}

export type Revisoes = ReturnType<typeof useRevisoes>;
