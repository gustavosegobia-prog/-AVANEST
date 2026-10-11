"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { cabecalhoInicial, type PacienteDaFolha } from "@/lib/evolucao/importar";
import { motivoAoAbrirFolha } from "@/lib/evolucao/fila";

type Encontrado = PacienteDaFolha & { id: string };

// Abrir uma folha: achar o paciente, e a folha nasce com a avaliação
// pré-anestésica mais recente dele no topo.
export function NovaFolha({ institutionId }: { institutionId: string }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Encontrado[]>([]);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) return;
    const t = setTimeout(async () => {
      const { data } = await createClient()
        .from("pacientes")
        .select("id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento")
        .ilike("nome", `%${termo.replace(/[%_]/g, "")}%`)
        .order("nome")
        .limit(12);
      setLista((data ?? []) as Encontrado[]);
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  async function abrir(p: Encontrado) {
    setAbrindo(p.id);
    setErro("");
    const supabase = createClient();
    const { data: avaliacao } = await supabase
      .from("avaliacoes")
      .select("id, dados, concluida_at, created_at")
      .eq("patient_id", p.id)
      .eq("versao_vigente", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const dados = cabecalhoInicial(p, avaliacao ? { id: avaliacao.id, dados: avaliacao.dados } : null, new Date());
    const { data, error } = await supabase
      .from("evolucoes_anestesicas")
      .insert({ institution_id: institutionId, patient_id: p.id, avaliacao_id: avaliacao?.id ?? null, dados })
      .select("id")
      .single();
    if (error || !data) {
      setErro(motivoAoAbrirFolha(error));
      setAbrindo(null);
      return;
    }
    router.push(`/evolucao/${data.id}`);
  }

  const termo = busca.trim();
  return (
    <section className="evoNova" aria-labelledby="evo-nova">
      <h2 id="evo-nova">Nova folha</h2>
      <label className="evoBusca">
        <span>Paciente</span>
        <input
          type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome do paciente" autoComplete="off"
        />
      </label>
      {erro && <p className="evoErro" role="alert">{erro}</p>}
      {termo.length >= 2 && (
        <ul className="evoResultados">
          {lista.length ? lista.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => abrir(p)} disabled={abrindo !== null}>
                <strong>{p.nome}</strong>
                <span>{[p.idade_anos != null && `${p.idade_anos} anos`, p.cirurgia || p.procedimento, p.hospital]
                  .filter(Boolean).join(" · ")}</span>
                <em>{abrindo === p.id ? "Abrindo…" : "Abrir folha"}</em>
              </button>
            </li>
          )) : <li className="evoVazio">Nenhum paciente com esse nome. Cadastre pela recepção ou pela área médica.</li>}
        </ul>
      )}
    </section>
  );
}
