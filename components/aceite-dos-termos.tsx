"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Dialogo } from "@/components/admin-ui";
import {
  CANCELAR_SEM_MULTA, CONSEQUENCIA_DA_COPIA, TERMOS_VALEM_PARA_QUEM_JA_USAVA, VERSAO_DOS_TERMOS, dataPorExtenso, precisaAceitar,
} from "@/lib/termos";

// O pedido de aceite de um texto novo dos Termos, no painel.
//
// Aparece para quem ainda não aceitou a versão atual (VERSAO_DOS_TERMOS) e
// nunca trava o trabalho: "Ler depois" fecha até a próxima sessão, e o texto
// novo vale de qualquer jeito 30 dias depois do aviso (item "Alterações" dos
// Termos). Fica só no painel, e não nas telas clínicas nem na TV do centro.

const ADIADO = "avanest:termos-adiados";

export function AceiteDosTermos() {
  const [mostrar, setMostrar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let valendo = true;
    try {
      if (sessionStorage.getItem(ADIADO) === VERSAO_DOS_TERMOS) return;
    } catch { /* sem armazenamento: pergunta de novo, o que é o seguro */ }
    void (async () => {
      const { data, error } = await createClient().from("aceites_de_termos")
        .select("versao").eq("versao", VERSAO_DOS_TERMOS).limit(1);
      // Sem a tabela (banco antes da migração) ou sem rede, não pergunta nada.
      if (!valendo || error) return;
      if (precisaAceitar(((data ?? []) as Array<{ versao: string }>).map((d) => d.versao))) setMostrar(true);
    })();
    return () => { valendo = false; };
  }, []);

  async function aceitar() {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await fetch("/api/termos/aceite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versao: VERSAO_DOS_TERMOS }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({})) as { error?: string };
        setErro(corpo.error || "Não foi possível registrar o aceite agora. Tente de novo.");
        return;
      }
      setMostrar(false);
    } catch {
      setErro("Sem conexão. Tente de novo em instantes.");
    } finally {
      setOcupado(false);
    }
  }

  function depois() {
    try { sessionStorage.setItem(ADIADO, VERSAO_DOS_TERMOS); } catch { /* fecha só agora */ }
    setMostrar(false);
  }

  if (!mostrar) return null;
  return (
    <Dialogo titulo="Os Termos de Uso mudaram" confirmar="Li e aceito" cancelar="Ler depois"
      ocupado={ocupado} erro={erro} onConfirmar={aceitar} onCancelar={depois}>
      <p>
        Entrou o item 12, <b>Propriedade intelectual e confidencialidade</b>. O AVANEST e o que há
        nele — telas, textos, protocolos e modelos — não podem ser copiados para distribuir ou
        vender, nem usados para criar um produto concorrente, no período grátis ou na assinatura.
      </p>
      <p className="aceiteResumo"><b>{CONSEQUENCIA_DA_COPIA}</b> {CANCELAR_SEM_MULTA}</p>
      <p>
        Imprimir os documentos e os protocolos para a equipe continua normal, e os seus dados
        continuam seus.
      </p>
      <p>
        Para quem já usava o AVANEST, a mudança vale a partir do aceite ou de{" "}
        {dataPorExtenso(TERMOS_VALEM_PARA_QUEM_JA_USAVA)}.
      </p>
      <p><a href="/termos" target="_blank" rel="noopener">Ler os Termos de Uso completos</a></p>
    </Dialogo>
  );
}
