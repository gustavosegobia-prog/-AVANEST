"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { cabecalhoInicial, type PacienteDaFolha } from "@/lib/evolucao/importar";
import { motivoAoAbrirFolha } from "@/lib/evolucao/fila";

type Encontrado = PacienteDaFolha & { id: string };
type Achado = Encontrado & {
  /** A avaliação que vai para o topo da ficha; nula quando não há; ausente quando não deu para saber. */
  avaliacao?: { em: string; rascunho: boolean; cirurgia: string } | null;
  /** A ficha que o paciente já tem aberta, se tiver. */
  aberta: string | null;
};
type Busca = { termo: string; lista: Achado[]; falhou: boolean };

const DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });

function quemE(p: Achado) {
  return [p.idade_anos != null && `${p.idade_anos} anos`, p.sexo && p.sexo !== "Não informado" && p.sexo.toLowerCase(), p.hospital]
    .filter(Boolean).join(" · ");
}

// Abrir uma ficha: achar o paciente, e a ficha nasce com a avaliação
// pré-anestésica mais recente dele no topo. A busca já diz, antes do toque, se
// essa avaliação existe — e se o paciente já tem ficha aberta, leva a ela em
// vez de abrir uma segunda.
export function NovaFolha({ institutionId }: { institutionId: string }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Busca | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) return;
    let vale = true;
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento")
        .ilike("nome", `%${termo.replace(/[%_]/g, "")}%`)
        .order("nome")
        .limit(12);
      if (!vale) return;
      if (error) { setAchados({ termo, lista: [], falhou: true }); return; }
      const pacientes = (data ?? []) as Encontrado[];
      const ids = pacientes.map((p) => p.id);
      const [av, ab] = ids.length
        ? await Promise.all([
          supabase.from("avaliacoes").select("patient_id, created_at, concluida_at, cirurgia:dados->>cirurgia")
            .in("patient_id", ids).eq("versao_vigente", true).order("created_at", { ascending: false }),
          supabase.from("evolucoes_anestesicas").select("id, patient_id").in("patient_id", ids).eq("status", "aberta"),
        ])
        : [null, null];
      if (!vale) return;
      const avaliacoes = (av?.data ?? []) as Array<{ patient_id: string; created_at: string; concluida_at: string | null; cirurgia: string | null }>;
      const abertas = (ab?.data ?? []) as Array<{ id: string; patient_id: string }>;
      setAchados({
        termo,
        falhou: false,
        lista: pacientes.map((p) => {
          // A mais recente primeiro, como o abrir() escolhe.
          const a = avaliacoes.find((x) => x.patient_id === p.id);
          return {
            ...p,
            avaliacao: av?.error ? undefined
              : a ? { em: a.concluida_at ?? a.created_at, rascunho: !a.concluida_at, cirurgia: a.cirurgia?.trim() ?? "" } : null,
            aberta: abertas.find((x) => x.patient_id === p.id)?.id ?? null,
          };
        }),
      });
    }, 250);
    return () => { vale = false; clearTimeout(t); };
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
  const curto = termo.length < 2;
  const buscando = !curto && achados?.termo !== termo;
  const lista = !curto ? achados?.lista ?? [] : [];

  let situacao = "Digite ao menos duas letras do nome.";
  if (!curto) {
    if (buscando) situacao = "Buscando…";
    else if (achados?.falhou) situacao = "A busca não respondeu. Confira a conexão e tente de novo.";
    else if (!lista.length) situacao = `Nenhum paciente com “${termo}”. Cadastre pela recepção ou pela área médica.`;
    else situacao = lista.length === 1 ? "1 paciente" : `${lista.length} pacientes${lista.length === 12 ? " — refine o nome se não estiver aqui" : ""}`;
  }

  return (
    <section className="fcAbrir" aria-labelledby="fc-abrir">
      <h2 id="fc-abrir">Abrir ficha</h2>
      <label className="fcBusca">
        <Icone nome="busca" tamanho={22} />
        <input
          type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome do paciente" aria-label="Nome do paciente"
          autoComplete="off" autoCapitalize="words" spellCheck={false} enterKeyHint="search"
        />
      </label>
      <p className={`fcSituacao${achados?.falhou && !buscando && !curto ? " falhou" : ""}`} aria-live="polite">{situacao}</p>
      {erro && <p className="fcErro" role="alert">{erro}</p>}

      {lista.length > 0 && (
        <ul className={`fcAchados${buscando ? " velho" : ""}`} aria-busy={buscando}>
          {lista.map((p) => {
            const corpo = (
              <>
                <span className="fcQuem">
                  <strong>{p.nome}</strong>
                  {quemE(p) && <span>{quemE(p)}</span>}
                </span>
                {p.avaliacao !== undefined && (
                  <span className={`fcPre${p.avaliacao ? "" : " vazia"}`}>
                    <Icone nome={p.avaliacao ? "confirmado" : "nota"} tamanho={15} />
                    {p.avaliacao
                      ? [`Avaliação pré-anestésica${p.avaliacao.rascunho ? " (rascunho)" : ""} de ${DIA.format(new Date(p.avaliacao.em))}`,
                        p.avaliacao.cirurgia].filter(Boolean).join(" · ")
                      : "Sem avaliação pré-anestésica: a ficha começa em branco"}
                  </span>
                )}
              </>
            );
            return (
              <li key={p.id}>
                {p.aberta ? (
                  <Link href={`/evolucao/${p.aberta}`} className="fcAchado">
                    {corpo}
                    <span className="fcIr"><span className="fcJaAberta">Ficha aberta</span> Continuar <Icone nome="seta" className="fcSetaDireita" /></span>
                  </Link>
                ) : (
                  <button type="button" className="fcAchado" onClick={() => abrir(p)} disabled={abrindo !== null}>
                    {corpo}
                    <span className="fcIr">{abrindo === p.id ? "Abrindo…" : <>Abrir ficha <Icone nome="seta" className="fcSetaDireita" /></>}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
