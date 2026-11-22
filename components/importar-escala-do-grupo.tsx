"use client";

import { useEffect, useMemo, useState } from "react";
import { Janela } from "@/components/janela";
import { createClient } from "@/utils/supabase/client";
import { colegaDaPessoa, plantoesDaPessoa, type EscalaLida, type Horario } from "@/lib/escala-importar";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import estilos from "@/components/centro/mapa.module.css";
import proprios from "./importar-escala.module.css";
import { ArquivoDaEscala, HorariosDosTurnos, PADRAO, lerArquivoDaEscala, localDoArquivo, plural } from "./importar-escala";

// IMPORTAR A ESCALA DO GRUPO (22/11/2026): quem monta a escala sobe a planilha,
// o PDF ou o print do mês, e cada nome da escala vira os plantões do colega
// certo. É o passo que faltava para a confirmação no lançamento: a escala entra
// de uma vez, e cada um só confirma os seus — ou passa para um colega.
//
// A leitura é a mesma da escala pessoal (lib/escala-importar.ts). O que a
// pessoa decide aqui: qual colega é cada nome (sugerido pelo cadastro e pelo
// nome na escala), o hospital, o mês e o horário de cada sigla. O plantão que o
// colega já tem no mesmo dia e horário não entra de novo.

export type ColegaDaEscala = { id: string; nome: string; apelido?: string | null };

const NINGUEM = "";

export function ImportarEscalaDoGrupo({
  perfilId, institutionId, colegas, locais, localSugerido, mesAberto, valorDoColega, onFechar, onImportado,
}: {
  /** Quem está importando (quem monta a escala): é o `created_by`. */
  perfilId: string;
  institutionId: string;
  /** Quem pode entrar na escala: médico ativo com CRM. */
  colegas: ColegaDaEscala[];
  locais: LocalDisponivel[];
  /** O hospital da escala aberta, quando é um só. */
  localSugerido: string;
  mesAberto: string;
  /** O último valor que aquele hospital pagou ao colega, como no lançamento à mão. */
  valorDoColega?: (dono: string, alvo: { local_id: string | null; local_texto: string | null }) => Promise<number>;
  onFechar: () => void;
  onImportado: (quantos: number, primeiraData: string) => void;
}) {
  const [lendo, setLendo] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [escala, setEscala] = useState<EscalaLida | null>(null);
  const [mes, setMes] = useState(mesAberto);
  const [localId, setLocalId] = useState(localSugerido);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [horarios, setHorarios] = useState<Record<string, Horario>>({});
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(""); setEscala(null); setLendo(0);
    try {
      const { escala: lida, linhas } = await lerArquivoDaEscala(arquivo, (f) => setLendo(f));
      setEscala(lida);
      setMes(lida.mes ?? mesAberto);
      setHorarios({});
      setMapa(Object.fromEntries(lida.pessoas.map((p) => [p, colegaDaPessoa(p, colegas) ?? NINGUEM])));
      const local = localDoArquivo(linhas, locais);
      if (local) setLocalId(local);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLendo(null);
    }
  }

  // Cada nome da escala, com os plantões dele no mês escolhido. Nome sem
  // plantão nenhum (uma linha de título que pareceu nome) não aparece.
  const porPessoa = useMemo(() => (escala
    ? escala.pessoas.map((pessoa) => ({ pessoa, plantoes: plantoesDaPessoa(escala, pessoa, mes) })).filter((x) => x.plantoes.length)
    : []), [escala, mes]);
  const ligados = porPessoa.filter((x) => mapa[x.pessoa]);
  const siglas = useMemo(() => {
    const m = new Map<string, Horario | null>();
    for (const x of ligados) for (const p of x.plantoes) if (!m.has(p.codigo)) m.set(p.codigo, p.horario);
    return [...m];
  }, [ligados]);
  const horarioDe = (p: { codigo: string; horario: Horario | null }) => horarios[p.codigo] ?? p.horario ?? PADRAO;

  // O que cada colega já tem nesses dias: o banco não aceita o mesmo começo no
  // mesmo dia, e subir o mesmo arquivo duas vezes não pode dobrar a escala.
  const datas = ligados.flatMap((x) => x.plantoes.map((p) => p.data)).sort();
  const ids = [...new Set(ligados.map((x) => mapa[x.pessoa]))].sort();
  const consulta = datas.length ? `${datas[0]}|${datas[datas.length - 1]}|${ids.join(",")}` : "";
  useEffect(() => {
    if (!consulta) return;
    const [de, ate, lista] = consulta.split("|");
    let vivo = true;
    void createClient().from("plantoes").select("perfil_id,data,hora_inicio")
      .in("perfil_id", lista.split(",")).neq("situacao", "cancelado").gte("data", de).lte("data", ate)
      .then(({ data }) => {
        if (vivo) setExistentes(new Set((data ?? []).map((r) => `${r.perfil_id}|${r.data}|${String(r.hora_inicio).slice(0, 5)}`)));
      });
    return () => { vivo = false; };
  }, [consulta]);

  const novos = (x: (typeof porPessoa)[number]) =>
    x.plantoes.filter((p) => !existentes.has(`${mapa[x.pessoa]}|${p.data}|${horarioDe(p).inicio}`));
  const total = ligados.reduce((s, x) => s + novos(x).length, 0);
  const semColega = porPessoa.filter((x) => !mapa[x.pessoa]);
  const local = locais.find((l) => l.id === localId);

  async function gravar() {
    if (!total) return;
    setOcupado(true); setErro("");
    try {
      const lugar = { local_id: localId || null, local_texto: null };
      const linhas = [];
      for (const x of ligados) {
        const dono = mapa[x.pessoa];
        const valor = valorDoColega ? await valorDoColega(dono, lugar).catch(() => 0) : 0;
        for (const p of novos(x)) {
          linhas.push({
            institution_id: institutionId, perfil_id: dono, ...lugar, privado: false,
            data: p.data, hora_inicio: horarioDe(p).inicio, hora_fim: horarioDe(p).fim,
            valor, created_by: perfilId,
          });
        }
      }
      const supabase = createClient();
      let entraram = 0;
      const { error } = await supabase.from("plantoes").insert(linhas);
      if (!error) entraram = linhas.length;
      else if (error.code === "23505") {
        // Algum já estava (o plantão só do colega não aparece para quem monta
        // a escala, mas o banco o conhece): grava um a um e pula o repetido.
        for (const l of linhas) {
          const { error: e } = await supabase.from("plantoes").insert(l);
          if (!e) entraram++;
          else if (e.code !== "23505") throw e;
        }
      } else throw error;
      if (!entraram) { setErro("Todos esses plantões já estavam na escala."); return; }
      onImportado(entraram, linhas.map((l) => l.data).sort()[0]);
    } catch {
      setErro("Não foi possível gravar a escala. Confira a conexão e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Janela titulo="Importar escala do grupo" largura="larga" onFechar={onFechar}
      subtitulo="A escala do mês — planilha (.xlsx), PDF, print ou foto. Cada nome vira os plantões do colega, depois da sua conferência."
      rodape={escala ? (
        <>
          <button type="button" className="outlineClinical compact" onClick={onFechar} disabled={ocupado}>Voltar</button>
          <button type="button" className="primaryClinical compact" onClick={() => void gravar()} disabled={ocupado || !total}>
            {ocupado ? "Salvando…" : `Lançar ${plural(total, "plantão", "plantões")} na escala do grupo`}
          </button>
        </>
      ) : undefined}>
      <ArquivoDaEscala lido={Boolean(escala)} lendo={lendo} ocupado={ocupado} onArquivo={(a) => void escolher(a)} />

      {escala && (
        <>
          <div className={estilos.importarTopo}>
            <label className="clinicalField"><span>Mês da escala</span>
              <input type="month" value={mes} onChange={(e) => { if (e.target.value) setMes(e.target.value); }} />
              <small className={estilos.dica}>
                {escala.mes ? "Lido do arquivo." : "O arquivo não diz o mês: confira."} Vale para os dias que vêm sem mês.
              </small>
            </label>
            <label className="clinicalField"><span>Hospital</span>
              <select value={localId} onChange={(e) => setLocalId(e.target.value)}>
                <option value="">Sem hospital</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
              </select>
              <small className={estilos.dica}>{local ? "Todos os plantões entram neste hospital." : "Escolha o hospital desta escala."}</small>
            </label>
          </div>

          <div className={estilos.importarTabela} role="region" aria-label="Quem é quem na escala" tabIndex={0}>
            <table>
              <thead><tr><th>Na escala</th><th>Colega</th><th>Plantões</th></tr></thead>
              <tbody>
                {porPessoa.map((x) => {
                  const n = novos(x).length;
                  const repetidos = x.plantoes.length - n;
                  return (
                    <tr key={x.pessoa} className={mapa[x.pessoa] ? undefined : estilos.desmarcada}>
                      <td data-rotulo="Paciente"><b>{x.pessoa}</b></td>
                      <td data-rotulo="Colega">
                        <select value={mapa[x.pessoa] ?? NINGUEM} aria-label={`Colega para ${x.pessoa}`}
                          onChange={(e) => setMapa((m) => ({ ...m, [x.pessoa]: e.target.value }))}>
                          <option value={NINGUEM}>Não importar</option>
                          {colegas.map((c) => <option key={c.id} value={c.id}>{c.apelido ? `${c.apelido} — ${c.nome}` : c.nome}</option>)}
                        </select>
                      </td>
                      <td data-rotulo="Plantões">
                        {/* Os dias, para conferir — a foto pode trocar uma sigla ou perder um dia. */}
                        <details className={proprios.dias}>
                          <summary>
                            {mapa[x.pessoa] ? plural(n, "plantão", "plantões") : plural(x.plantoes.length, "plantão lido", "plantões lidos")}
                            {mapa[x.pessoa] && repetidos > 0 && <small>{repetidos} já na escala</small>}
                          </summary>
                          <span>{x.plantoes.map((p) => `${p.data.slice(8, 10)}/${p.data.slice(5, 7)} ${p.codigo}`).join(" · ")}</span>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {semColega.length > 0 && (
            <ul className={estilos.importarAvisos}>
              <li>
                {semColega.length === 1 ? "1 nome ficou" : `${semColega.length} nomes ficaram`} sem colega e não {semColega.length === 1 ? "entra" : "entram"}:{" "}
                <b>{semColega.map((x) => x.pessoa).join(", ").replace(/\.$/, "")}</b>. Quem não aparece na lista precisa estar na escala do grupo
                (com CRM) — veja em <b>Quem entra na escala</b>.
              </li>
            </ul>
          )}

          <HorariosDosTurnos siglas={siglas} horarios={horarios}
            onMudar={(codigo, h) => setHorarios((a) => ({ ...a, [codigo]: h }))} />
        </>
      )}
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Janela>
  );
}
