"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { Janela } from "@/components/janela";

// O recado certo para cada recusa do banco (excluir_evolucao).
function motivoDaRecusa(erro: { message?: string; code?: string } | null): string {
  const m = erro?.message ?? "";
  if (/SEM_PERMISSAO_EXCLUIR/.test(m)) return "Só quem abriu a ficha, o administrador ou o proprietário pode excluí-la.";
  if (/FOLHA_JA_ENCERRADA/.test(m)) return "Ficha que já foi encerrada é documento e não se exclui. Para corrigir, reabra.";
  if (/EXCLUSAO_SEM_MOTIVO/.test(m)) return "Escreva o motivo, com pelo menos 5 letras.";
  if (/excluir_evolucao/.test(m) || erro?.code === "PGRST202") {
    return "A exclusão ainda não foi instalada no banco. Rode a migração 202610110003_excluir_ficha.sql no Supabase.";
  }
  return "Não foi possível excluir agora. Confira a conexão e tente de novo.";
}

// Excluir ficha aberta por engano — paciente errado, teste, cirurgia que não
// aconteceu. A regra de verdade está no banco: só ficha nunca encerrada, só
// quem a abriu, o administrador ou o proprietário, e sempre com motivo, que
// fica na auditoria junto do cabeçalho inteiro.
export function ExcluirFolha({ id, paciente }: { id: string; paciente: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  async function excluir() {
    setExcluindo(true); setErro("");
    const { error } = await createClient().rpc("excluir_evolucao", { p_id: id, p_motivo: motivo.trim() });
    setExcluindo(false);
    if (error) { setErro(motivoDaRecusa(error)); return; }
    setAberta(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="fcExcluir" onClick={() => { setAberta(true); setErro(""); setMotivo(""); }}
        aria-label={`Excluir a ficha de ${paciente}`}>
        <Icone nome="fechar" tamanho={16} /> <span>Excluir</span>
      </button>
      {aberta && (
        <Janela titulo="Excluir ficha" subtitulo={paciente} largura="estreita" onFechar={() => setAberta(false)}
          rodape={<>
            <button type="button" className="evoBotao secundario" onClick={() => setAberta(false)}>Cancelar</button>
            <button type="button" className="evoBotao perigo" disabled={motivo.trim().length < 5 || excluindo} onClick={() => void excluir()}>
              {excluindo ? "Excluindo…" : "Excluir ficha"}
            </button>
          </>}>
          <div className="evoForm">
            <p className="evoNota">
              Apaga a ficha e todos os lançamentos dela. É para ficha aberta por engano ou de teste — ficha encerrada não
              se exclui. Fica registrado quem excluiu, quando e o motivo.
            </p>
            <label className="evoCampo"><span>Motivo</span>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={300} autoFocus
                placeholder="Ex.: ficha de teste; paciente errado" />
            </label>
            {erro && <p className="evoErro" role="alert">{erro}</p>}
          </div>
        </Janela>
      )}
    </>
  );
}
