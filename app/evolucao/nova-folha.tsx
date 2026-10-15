"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { cabecalhoInicial, type PacienteDaFolha } from "@/lib/evolucao/importar";
import { motivoAoAbrirFolha } from "@/lib/evolucao/fila";
import { fichasDoLocal } from "@/lib/evolucao/local";

type Encontrado = PacienteDaFolha & { id: string };
export type Achado = Encontrado & {
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
export function NovaFolha({ institutionId, local = null }: {
  institutionId: string;
  /** O hospital da sessão: a ficha nova nasce nele (e só aparece na lista dele). */
  local?: { id: string; nome: string } | null;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Busca | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  // Paciente que não está no sistema (sem cadastro, logo sem avaliação): um
  // cadastro mínimo aqui mesmo, e a ficha nasce em branco para preencher.
  const [novo, setNovo] = useState<{ nome: string; idade: string; sexo: string; convenio: string; cirurgia: string } | null>(null);
  const [cadastrando, setCadastrando] = useState(false);

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
          // "Continuar" só para a ficha aberta NESTE hospital.
          (local
            ? supabase.from("evolucoes_anestesicas").select("id, patient_id").or(fichasDoLocal(local.id))
            : supabase.from("evolucoes_anestesicas").select("id, patient_id"))
            .in("patient_id", ids).eq("status", "aberta"),
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
  }, [busca, local]);

  async function cadastrarEAbrir() {
    if (!novo || !novo.nome.trim()) return;
    setCadastrando(true); setErro("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const idade = Number(novo.idade);
    const { data, error } = await supabase.from("pacientes").insert({
      institution_id: institutionId, created_by: user?.id ?? null, nome: novo.nome.trim(),
      idade_anos: Number.isInteger(idade) && idade >= 0 && idade <= 120 && novo.idade.trim() ? idade : null,
      sexo: novo.sexo || null, convenio: novo.convenio.trim() || null, cirurgia: novo.cirurgia.trim() || null,
    }).select("id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento").single();
    setCadastrando(false);
    if (error || !data) { setErro("Não foi possível cadastrar o paciente. Confira a conexão e tente de novo."); return; }
    await abrir(data as Encontrado);
  }

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
    const dados = {
      ...cabecalhoInicial(p, avaliacao ? { id: avaliacao.id, dados: avaliacao.dados } : null, new Date()),
      ...(local ? { local_atendimento_id: local.id, local_atendimento: local.nome } : {}),
    };
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
    else if (!lista.length) situacao = `Nenhum paciente com “${termo}” no sistema.`;
    else situacao = lista.length === 1 ? "1 paciente" : `${lista.length} pacientes${lista.length === 12 ? " — refine o nome se não estiver aqui" : ""}`;
  }

  // Uma linha da lista: o paciente, a avaliação que vai para o topo da ficha e
  // o toque — abrir, ou continuar a que ele já tem aberta.
  const linha = (p: Achado) => {
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
  };

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

      {/* Sem cadastro e sem avaliação: a ficha começa em branco. Quem está
          cadastrado mas não foi avaliado aparece na busca, com o aviso. */}
      {!novo ? (
        <button type="button" className="fcSemCadastro"
          onClick={() => setNovo({ nome: curto ? "" : termo, idade: "", sexo: "", convenio: "", cirurgia: "" })}>
          + {!curto && !buscando && !lista.length ? `Iniciar ficha para “${termo}”` : "Paciente sem cadastro"} — ficha em branco
        </button>
      ) : (
        <form className="fcNovoPaciente" onSubmit={(e) => { e.preventDefault(); void cadastrarEAbrir(); }}>
          <p className="fcNovoTitulo">Paciente sem cadastro: um cadastro mínimo, e a ficha abre em branco para preencher.</p>
          <label className="fcNovoCampo nome"><span>Nome do paciente</span>
            <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required autoFocus autoComplete="off" />
          </label>
          <label className="fcNovoCampo"><span>Idade (anos)</span>
            <input value={novo.idade} onChange={(e) => setNovo({ ...novo, idade: e.target.value.replace(/\D/g, "").slice(0, 3) })} inputMode="numeric" />
          </label>
          <div className="fcNovoCampo sexo" role="group" aria-label="Sexo"><span>Sexo</span>
            <div className="fcNovoSexo">
              {([["Feminino", "FEM"], ["Masculino", "MASC"]] as const).map(([x, curto]) => (
                <button type="button" key={x} aria-pressed={novo.sexo === x} aria-label={x} className={novo.sexo === x ? "ativo" : undefined}
                  onClick={() => setNovo({ ...novo, sexo: novo.sexo === x ? "" : x })}>{curto}</button>
              ))}
            </div>
          </div>
          <label className="fcNovoCampo"><span>Convênio</span>
            <input value={novo.convenio} onChange={(e) => setNovo({ ...novo, convenio: e.target.value })} placeholder="Particular" />
          </label>
          <label className="fcNovoCampo largo"><span>Cirurgia</span>
            <input value={novo.cirurgia} onChange={(e) => setNovo({ ...novo, cirurgia: e.target.value })} />
          </label>
          <div className="fcNovoAcoes">
            <button type="button" className="evoBotao secundario" onClick={() => setNovo(null)}>Cancelar</button>
            <button type="submit" className="evoBotao" disabled={!novo.nome.trim() || cadastrando || abrindo !== null}>
              {cadastrando || abrindo ? "Abrindo…" : "Cadastrar e abrir ficha"}
            </button>
          </div>
        </form>
      )}

      {lista.length > 0 && (
        <ul className={`fcAchados${buscando ? " velho" : ""}`} aria-busy={buscando}>
          {lista.map((p) => linha(p))}
        </ul>
      )}
    </section>
  );
}
