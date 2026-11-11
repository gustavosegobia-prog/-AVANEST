"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { fichasDoLocal } from "@/lib/evolucao/local";
import { casaComONome, type PacienteAchado } from "@/lib/evolucao/entrada";
import type { CasoComCadastro } from "@/lib/evolucao/mapa-do-dia";
import { abrirFicha } from "./abrir-ficha";
import { JanelaFichaDoHospital, type FichaConferida } from "@/components/evolucao/janela-ficha-do-hospital";
import { MapaDoDia } from "./mapa-do-dia";
import { ImportarMapaNaFicha } from "./importar-mapa";
import { horarioDaFicha } from "@/lib/evolucao/folha";
import { dataLocal, horaLocal } from "@/lib/data-local";

type Encontrado = Omit<PacienteAchado, "avaliacao" | "aberta">;

/** A idade de hoje, pelo nascimento da folha ("1960-05-03"). */
function idadeHoje(nascimento: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento);
  if (!m) return null;
  const [ano, mes, dia] = dataLocal().split("-").map(Number);
  const idade = ano - Number(m[1]) - (mes < Number(m[2]) || (mes === Number(m[2]) && dia < Number(m[3])) ? 1 : 0);
  return idade >= 0 && idade <= 120 ? idade : null;
}
export type Achado = PacienteAchado;
type Busca = { termo: string; lista: Achado[]; falhou: boolean };

const DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });
const CAMPOS = "id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento";

function quemE(p: Achado) {
  return [p.idade_anos != null && `${p.idade_anos} anos`, p.sexo && p.sexo !== "Não informado" && p.sexo.toLowerCase(), p.hospital]
    .filter(Boolean).join(" · ");
}

// Abrir uma ficha: uma caixa só, para todo mundo (06/11/2026: "tem que ficar
// bom pra todo mundo. Fácil").
//   - Sem nada escrito, a lista do dia: o mapa cirúrgico do hospital, quando
//     há, e os avaliados hoje que ainda não têm ficha (o ambulatório, sem mapa).
//     Um toque na linha abre a ficha.
//   - Com o nome, a mesma caixa filtra o mapa na hora e busca no cadastro.
// A ficha nasce com a avaliação pré-anestésica mais recente do paciente no
// topo; a linha já diz, antes do toque, se essa avaliação existe — e, se o
// paciente já tem ficha aberta, leva a ela em vez de abrir uma segunda.
export function NovaFolha({ institutionId, local = null, mapa = [], avaliadosHoje = [], podeImportarMapa = false, podeVerMapa = false }: {
  institutionId: string;
  /** O hospital da sessão: a ficha nova nasce nele (e só aparece na lista dele). */
  local?: { id: string; nome: string } | null;
  /** O mapa cirúrgico de hoje, com o cadastro de cada paciente já procurado. */
  mapa?: CasoComCadastro[];
  /** Os avaliados hoje, sem ficha ainda (lib/evolucao/entrada.ts). */
  avaliadosHoje?: Achado[];
  /** Quem monta o mapa (pode_montar_centro) importa daqui mesmo. */
  podeImportarMapa?: boolean;
  /** Quem vê o mapa (pode_ver_centro) tem o atalho para a tela inteira dele. */
  podeVerMapa?: boolean;
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
  // Agora (o padrão) ou outro dia e horário, para passar a limpo uma anestesia
  // que já aconteceu (lib/evolucao/folha.ts, horarioDaFicha).
  const [quando, setQuando] = useState<{ data: string; inicio: string; fim: string } | null>(null);
  const [avisoDoMapa, setAvisoDoMapa] = useState("");
  // A ficha pré-anestésica do hospital, pela foto: acha (ou cadastra) o paciente e abre a ficha preenchida.
  const [pelaFoto, setPelaFoto] = useState(false);
  const [abrindoPelaFoto, setAbrindoPelaFoto] = useState(false);
  const [erroDaFoto, setErroDaFoto] = useState("");

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) return;
    let vale = true;
    const t = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pacientes")
        .select(CAMPOS)
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

  /** "Agora" (nulo) ou o outro dia e horário, conferido na hora do toque. */
  const lerHorario = () => (quando ? horarioDaFicha(quando) : null);

  async function cadastrarEAbrir() {
    if (!novo || !novo.nome.trim()) return;
    const horario = lerHorario();
    if (horario && !horario.ok) { setErro(horario.erro); return; }
    setCadastrando(true); setErro("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const idade = Number(novo.idade);
    const { data, error } = await supabase.from("pacientes").insert({
      institution_id: institutionId, created_by: user?.id ?? null, nome: novo.nome.trim(),
      idade_anos: Number.isInteger(idade) && idade >= 0 && idade <= 120 && novo.idade.trim() ? idade : null,
      sexo: novo.sexo || null, convenio: novo.convenio.trim() || null, cirurgia: novo.cirurgia.trim() || null,
    }).select(CAMPOS).single();
    setCadastrando(false);
    if (error || !data) { setErro("Não foi possível cadastrar o paciente. Confira a conexão e tente de novo."); return; }
    await abrir(data as Encontrado);
  }

  /**
   * Da foto da ficha do hospital: o paciente pelo nome e nascimento; se ele já
   * tem ficha aberta neste hospital, vai para ela (lá dentro dá para trazer a
   * foto); se não está no sistema, um cadastro com o que a folha diz.
   */
  async function abrirPelaFoto({ ficha, campos, paciente }: FichaConferida) {
    const horario = lerHorario();
    if (horario && !horario.ok) { setErroDaFoto(horario.erro); return; }
    setAbrindoPelaFoto(true); setErroDaFoto("");
    const supabase = createClient();
    const nome = paciente.nome.trim().replace(/\s+/g, " ");
    const { data: mesmos, error } = await supabase.from("pacientes").select(CAMPOS).ilike("nome", nome.replace(/[%_]/g, "")).limit(5);
    if (error) { setAbrindoPelaFoto(false); setErroDaFoto("A busca no cadastro não respondeu. Confira a conexão e tente de novo."); return; }
    const candidatos = (mesmos ?? []) as Encontrado[];
    let p = paciente.nascimento
      ? candidatos.find((c) => c.data_nascimento === paciente.nascimento)
      : candidatos.length === 1 ? candidatos[0] : undefined;
    if (p) {
      const { data: aberta } = await (local
        ? supabase.from("evolucoes_anestesicas").select("id").or(fichasDoLocal(local.id))
        : supabase.from("evolucoes_anestesicas").select("id"))
        .eq("patient_id", p.id).eq("status", "aberta").limit(1).maybeSingle();
      if (aberta) { router.push(`/evolucao/${aberta.id}`); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const cirurgia = campos.find((c) => c.chave === "procedimento")?.valor.trim() || null;
      const { data, error: erroNovo } = await supabase.from("pacientes").insert({
        institution_id: institutionId, created_by: user?.id ?? null, nome,
        data_nascimento: paciente.nascimento || null, idade_anos: idadeHoje(paciente.nascimento),
        sexo: paciente.sexo || null, convenio: paciente.convenio.trim() || null, cirurgia,
      }).select(CAMPOS).single();
      if (erroNovo || !data) { setAbrindoPelaFoto(false); setErroDaFoto("Não foi possível cadastrar o paciente. Confira a conexão e tente de novo."); return; }
      p = data as Encontrado;
    }
    const r = await abrirFicha({ institutionId, local, paciente: p, horario: horario?.ok ? horario : null, daFoto: { ficha, campos } });
    if ("erro" in r) { setAbrindoPelaFoto(false); setErroDaFoto(r.erro); return; }
    router.push(`/evolucao/${r.id}`);
  }

  async function abrir(p: Encontrado) {
    const horario = lerHorario();
    if (horario && !horario.ok) { setErro(horario.erro); return; }
    setAbrindo(p.id);
    setErro("");
    const r = await abrirFicha({ institutionId, local, paciente: p, horario: horario?.ok ? horario : null });
    if ("erro" in r) {
      setErro(r.erro);
      setAbrindo(null);
      return;
    }
    router.push(`/evolucao/${r.id}`);
  }

  const termo = busca.trim();
  const curto = termo.length < 2;
  const buscando = !curto && achados?.termo !== termo;
  // O mapa filtra na hora, sem esperar o banco; já com uma letra.
  const doMapa = termo ? mapa.filter((c) => casaComONome(c.paciente, termo) || (c.principal ? casaComONome(c.principal.nome, termo) : false)) : mapa;
  // Quem o mapa já mostra (com o cadastro certo) não se repete na busca.
  const jaNoMapa = new Set(doMapa.flatMap((c) => [c.patientId, c.principal?.id]).filter(Boolean));
  const lista = !curto ? (achados?.lista ?? []).filter((p) => !jaNoMapa.has(p.id)) : [];
  const avaliados = termo ? avaliadosHoje.filter((p) => casaComONome(p.nome, termo)) : avaliadosHoje;
  // Com o nome escrito, os avaliados de hoje vêm na busca do cadastro.
  const mostrarAvaliados = curto && avaliados.length > 0;
  const nada = !curto && !buscando && !achados?.falhou && !lista.length && !doMapa.length;

  let situacao = "";
  if (curto) {
    if (!mapa.length && !avaliadosHoje.length) situacao = "Digite ao menos duas letras do nome.";
  } else if (buscando) situacao = "Buscando no cadastro…";
  else if (achados?.falhou) situacao = "A busca no cadastro não respondeu. Confira a conexão e tente de novo.";
  else if (nada) situacao = `Nenhum paciente com “${termo}”${mapa.length ? " no mapa nem" : ""} no cadastro.`;

  // Uma linha do cadastro: o paciente, a avaliação que vai para o topo da
  // ficha e o toque — abrir, ou continuar a que ele já tem aberta.
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
            <span className="fcIr forte">{abrindo === p.id ? "Abrindo…" : <>Abrir ficha <Icone nome="seta" className="fcSetaDireita" /></>}</span>
          </button>
        )}
      </li>
    );
  };

  const abrirSemCadastro = () => {
    setNovo({ nome: curto ? "" : termo, idade: "", sexo: "", convenio: "", cirurgia: "" });
    setErro("");
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

      {/* O que é raro fica numa linha discreta, fora do caminho do toque. */}
      <div className="fcAtalhos">
        {!novo && (
          <button type="button" className="fcAtalho" onClick={abrirSemCadastro}>
            <Icone nome="pessoa" tamanho={16} /> Paciente sem cadastro
          </button>
        )}
        <button type="button" className="fcAtalho" onClick={() => { setPelaFoto(true); setErroDaFoto(""); }}>
          <Icone nome="nota" tamanho={16} /> Ficha do hospital (foto)
        </button>
        <button type="button" className={`fcAtalho${quando ? " ativo" : ""}`} aria-pressed={Boolean(quando)}
          onClick={() => { setQuando((q) => (q ? null : { data: dataLocal(), inicio: horaLocal(), fim: "" })); setErro(""); }}>
          <Icone nome="relogio" tamanho={16} /> {quando ? "Voltar para agora" : "Outro dia ou horário"}
        </button>
        {/* O mapa cirúrgico de dentro da ficha (07/11/2026): importar sem sair
            daqui, e o atalho para a tela inteira do mapa (salas, TV, relatório). */}
        {podeImportarMapa && (
          <ImportarMapaNaFicha institutionId={institutionId} localId={local?.id ?? null}
            aoImportar={(data, quantos) => {
              const n = `${quantos} ${quantos === 1 ? "paciente importado" : "pacientes importados"}`;
              setAvisoDoMapa(data === dataLocal()
                ? `${n}. Estão em “Mapa de hoje”, logo abaixo.`
                : `${n} para ${data.split("-").reverse().join("/")}: aparecem aqui nesse dia.`);
              router.refresh();
            }} />
        )}
        {podeVerMapa && (
          <Link href="/centro-cirurgico" prefetch={false} className="fcAtalho">
            <Icone nome="painel" tamanho={16} /> Mapa cirúrgico
          </Link>
        )}
      </div>
      {avisoDoMapa && <p className="fcAvisoMapa" role="status">{avisoDoMapa}</p>}
      {pelaFoto && (
        <JanelaFichaDoHospital comPaciente confirmar="Abrir a ficha anestésica" ocupado={abrindoPelaFoto} erroDeFora={erroDaFoto}
          onFechar={() => { setPelaFoto(false); setAbrindoPelaFoto(false); }} onConfirmar={(r) => void abrirPelaFoto(r)} />
      )}

      {quando && (
        <div className="fcQuandoCampos">
          <p className="fcQuandoDica topo">Passando a limpo: a ficha que você abrir agora nasce com esta data e estes horários.</p>
          <label><span>Data</span>
            <input type="date" value={quando.data} max={dataLocal()} required
              onChange={(e) => { setQuando({ ...quando, data: e.target.value }); setErro(""); }} />
          </label>
          <label><span>Início da anestesia</span>
            <input type="time" value={quando.inicio} required
              onChange={(e) => { setQuando({ ...quando, inicio: e.target.value }); setErro(""); }} />
          </label>
          <label><span>Fim da anestesia</span>
            <input type="time" value={quando.fim}
              onChange={(e) => { setQuando({ ...quando, fim: e.target.value }); setErro(""); }} />
          </label>
          <p className="fcQuandoDica">
            {quando.data === dataLocal() && !quando.fim
              ? "Hoje, o fim pode ficar para depois."
              : "A ficha abre com o início e o fim marcados; o que você lançar depois pede o horário."}
          </p>
        </div>
      )}

      {novo && (
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
              {([["Feminino", "FEM"], ["Masculino", "MASC"]] as const).map(([x, curtoDoSexo]) => (
                <button type="button" key={x} aria-pressed={novo.sexo === x} aria-label={x} className={novo.sexo === x ? "ativo" : undefined}
                  onClick={() => setNovo({ ...novo, sexo: novo.sexo === x ? "" : x })}>{curtoDoSexo}</button>
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

      <p className={`fcSituacao${achados?.falhou && !buscando && !curto ? " falhou" : ""}`} aria-live="polite">{situacao}</p>
      {erro && <p className="fcErro" role="alert">{erro}</p>}
      {nada && !novo && (
        <button type="button" className="evoBotao fcIniciarPara" onClick={abrirSemCadastro}>
          Cadastrar “{termo}” e abrir ficha
        </button>
      )}

      {(doMapa.length > 0 || lista.length > 0 || mostrarAvaliados) && (
        <div className="fcResultados">
          <MapaDoDia
            institutionId={institutionId} local={local} casos={doMapa} filtrado={Boolean(termo)}
            lerHorario={lerHorario} abrindo={abrindo} setAbrindo={setAbrindo}
          />
          {lista.length > 0 && (
            <div className="fcGrupo" role="group" aria-labelledby="fc-cadastro">
              <h3 id="fc-cadastro" className="fcGrupoTitulo">
                {doMapa.length ? "No cadastro" : "Pacientes"} <span className="fcConta">{lista.length}</span>
              </h3>
              {lista.length === 12 && <p className="fcSubgrupo">Os 12 primeiros: escreva mais do nome se não estiver aqui.</p>}
              <ul className={`fcAchados${buscando ? " velho" : ""}`} aria-busy={buscando}>
                {lista.map((p) => linha(p))}
              </ul>
            </div>
          )}
          {mostrarAvaliados && (
            <div className="fcGrupo" role="group" aria-labelledby="fc-avaliados">
              <h3 id="fc-avaliados" className="fcGrupoTitulo">
                Avaliados hoje <span className="fcConta">{avaliados.length}</span>
              </h3>
              <p className="fcSubgrupo">Com avaliação pré-anestésica de hoje e ainda sem ficha.</p>
              <ul className="fcAchados">
                {avaliados.map((p) => linha(p))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
