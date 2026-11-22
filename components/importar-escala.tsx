"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icone } from "@/components/icone";
import { Janela } from "@/components/janela";
import { createClient } from "@/utils/supabase/client";
import { conteudoDoArquivo, TIPOS_ACEITOS } from "@/components/centro/ler-arquivo";
import {
  lerEscala, linhasDaGrade, linhasDePalavras, plantoesDaPessoa, sugerirPessoa,
  type EscalaLida, type Horario, type Linha,
} from "@/lib/escala-importar";
import { normalizar } from "@/lib/centro-importar";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import estilos from "@/components/centro/mapa.module.css";
import proprios from "./importar-escala.module.css";

// IMPORTAR A ESCALA RECEBIDA (20/11/2026): o médico recebe a escala do mês —
// planilha, PDF ou print do grupo — e os plantões dele entram na escala
// pessoal. A leitura é a de lib/escala-importar.ts; aqui ficam as perguntas
// que só a pessoa responde: qual nome é o dela, de que mês é a escala, onde é
// o plantão e quanto dura cada sigla. Nada grava antes do botão do rodapé, e
// o plantão que já está na escala dela vem desmarcado.

const OUTRO = "__outro__";
/** A sigla que a escala não explica começa como plantão de 12 horas de dia; a tela pede para conferir. */
export const PADRAO: Horario = { inicio: "07:00", fim: "19:00" };
const DIA = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const nomeDoDia = (d: string) => DIA.format(new Date(`${d}T12:00:00Z`)).replace(".", "");
const chave = (p: { data: string; codigo: string }) => `${p.data}|${p.codigo}`;
export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O arquivo lido e entendido como escala; sem escala nele, um erro que a pessoa entende. */
export async function lerArquivoDaEscala(arquivo: File, avancar: (fracao: number) => void): Promise<{ escala: EscalaLida; linhas: Linha[] }> {
  const conteudo = await conteudoDoArquivo(arquivo, avancar);
  const linhas = "grade" in conteudo ? linhasDaGrade(conteudo.grade) : linhasDePalavras(conteudo.palavras);
  const escala = lerEscala(linhas);
  if (!escala || !escala.pessoas.length) {
    throw new Error("Não achei uma escala neste arquivo. Ela precisa ter os dias (na linha de cima ou na primeira coluna) e os nomes. Se for foto, pegue a folha inteira, de frente.");
  }
  return { escala, linhas };
}

/** Escolher o arquivo ou tirar a foto, e o "Lendo…" enquanto a foto é lida. */
export function ArquivoDaEscala({ lido, lendo, ocupado, onArquivo }: {
  lido: boolean; lendo: number | null; ocupado: boolean; onArquivo: (arquivo: File | undefined) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  return (
    <div className={estilos.importarArquivo}>
      <input ref={entrada} type="file" accept={TIPOS_ACEITOS} hidden
        onChange={(e) => { onArquivo(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { onArquivo(e.target.files?.[0]); e.target.value = ""; }} />
      <div className={estilos.importarBotoes}>
        <button type="button" className={lido ? "outlineClinical compact" : "primaryClinical compact"}
          onClick={() => entrada.current?.click()} disabled={lendo != null || ocupado} data-foco-inicial>
          <Icone nome="nota" tamanho={16} /> {lido ? "Escolher outro arquivo" : "Escolher arquivo ou print"}
        </button>
        <button type="button" className="outlineClinical compact"
          onClick={() => camera.current?.click()} disabled={lendo != null || ocupado}>
          <Icone nome="camera" tamanho={16} /> {lido ? "Tirar outra foto" : "Tirar foto da escala"}
        </button>
      </div>
      {lendo != null && (
        <p className={estilos.dica} role="status">
          {`Lendo${lendo > 0 ? ` (${Math.round(lendo * 100)}%)` : ""}… a foto leva alguns segundos.`}
        </p>
      )}
      {!lido && lendo == null && (
        <p className={estilos.dica}>
          O arquivo é lido neste aparelho e não fica guardado. A planilha do Excel entra sem erro; o PDF, o print e a foto
          funcionam, mas confira os dias — a leitura de imagem pode trocar uma letra.
        </p>
      )}
    </div>
  );
}

/** O horário de cada sigla da escala, que a pessoa confere e corrige. */
export function HorariosDosTurnos({ siglas, horarios, onMudar }: {
  siglas: ReadonlyArray<readonly [string, Horario | null]>;
  horarios: Readonly<Record<string, Horario>>;
  onMudar: (codigo: string, h: Horario) => void;
}) {
  if (!siglas.length) return null;
  return (
    <fieldset className={proprios.turnos}>
      <legend>Horário de cada turno</legend>
      {siglas.map(([codigo, lido]) => {
        const h = horarios[codigo] ?? lido ?? PADRAO;
        const mudar = (x: Partial<Horario>) => onMudar(codigo, { ...h, ...x });
        return (
          <div key={codigo} className={proprios.turno}>
            <b title={codigo}>{codigo}{!lido && !horarios[codigo] && <small>confira</small>}</b>
            <input type="time" value={h.inicio} aria-label={`Início do turno ${codigo}`} onChange={(e) => mudar({ inicio: e.target.value })} />
            <span>às</span>
            <input type="time" value={h.fim} aria-label={`Fim do turno ${codigo}`} onChange={(e) => mudar({ fim: e.target.value })} />
          </div>
        );
      })}
    </fieldset>
  );
}

/** O hospital cujo nome aparece no arquivo ("ESCALA HOSPITAL TESTE — DEZ"). */
export function localDoArquivo(linhas: readonly Linha[], locais: readonly LocalDisponivel[]): string {
  const texto = ` ${normalizar(linhas.slice(0, 6).flat().map((c) => c.t).join(" "))} `;
  const achado = locais.find((l) => [l.nome, l.nome_fantasia ?? ""].some((n) => {
    const k = normalizar(n);
    return k.length >= 4 && texto.includes(` ${k} `);
  }));
  return achado?.id ?? "";
}

export function ImportarEscala({
  perfilId, institutionId, nome, apelido, ehAdmin, locais, mesAberto, valorDoLocal, onFechar, onImportado,
}: {
  perfilId: string;
  institutionId: string;
  /** O nome do cadastro, para achar a pessoa na escala. */
  nome: string;
  /** O nome dela na escala do grupo ("Fulano S."), que costuma ser o da escala recebida também. */
  apelido?: string | null;
  ehAdmin: boolean;
  locais: LocalDisponivel[];
  /** O mês aberto na tela ("2026-12"): vale quando o arquivo não diz o mês. */
  mesAberto: string;
  /** O último valor pago naquele lugar, como no lançamento à mão. */
  valorDoLocal?: (alvo: { local_id: string | null; local_texto: string | null }) => Promise<number>;
  onFechar: () => void;
  onImportado: (quantos: number, primeiraData: string) => void;
}) {
  const [lendo, setLendo] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [escala, setEscala] = useState<EscalaLida | null>(null);
  const [mes, setMes] = useState(mesAberto);
  const [pessoa, setPessoa] = useState("");
  const [digitado, setDigitado] = useState("");
  // O mesmo padrão do "Lançar plantão": quem monta a escala lança para o
  // grupo; quem não monta, só para si (components/plantoes.tsx, LancarPlantao).
  const [privado, setPrivado] = useState(!ehAdmin);
  const [localId, setLocalId] = useState("");
  const [localTexto, setLocalTexto] = useState("");
  const [horarios, setHorarios] = useState<Record<string, Horario>>({});
  const [escolha, setEscolha] = useState<Map<string, boolean>>(new Map());
  const [existentes, setExistentes] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(""); setEscala(null); setLendo(0);
    try {
      const { escala: lida, linhas } = await lerArquivoDaEscala(arquivo, (f) => setLendo(f));
      setEscala(lida);
      setMes(lida.mes ?? mesAberto);
      const sugerida = sugerirPessoa(lida.pessoas, nome, apelido);
      setPessoa(sugerida ?? lida.pessoas[0]);
      setDigitado("");
      setHorarios({});
      setEscolha(new Map());
      const local = localDoArquivo(linhas, locais);
      if (local) { setLocalId(local); setPrivado(false); }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLendo(null);
    }
  }

  const quem = pessoa === OUTRO ? digitado : pessoa;
  const lidos = useMemo(() => (escala && quem.trim() ? plantoesDaPessoa(escala, quem, mes) : []), [escala, quem, mes]);
  const siglas = useMemo(() => {
    const m = new Map<string, Horario | null>();
    for (const p of lidos) if (!m.has(p.codigo)) m.set(p.codigo, p.horario);
    return [...m];
  }, [lidos]);
  const horarioDe = (p: { codigo: string; horario: Horario | null }) => horarios[p.codigo] ?? p.horario ?? PADRAO;

  // O que já está na escala dela nesses dias, para vir desmarcado: o banco
  // não aceita o mesmo começo no mesmo dia, e importar de novo o mesmo
  // arquivo não pode dobrar nada.
  const periodo = lidos.length ? `${lidos[0].data}|${lidos[lidos.length - 1].data}` : "";
  useEffect(() => {
    if (!periodo) return;
    const [de, ate] = periodo.split("|");
    let vivo = true;
    void createClient().from("plantoes").select("data,hora_inicio")
      .eq("perfil_id", perfilId).neq("situacao", "cancelado").gte("data", de).lte("data", ate)
      .then(({ data }) => {
        if (vivo) setExistentes(new Set((data ?? []).map((r) => `${r.data}|${String(r.hora_inicio).slice(0, 5)}`)));
      });
    return () => { vivo = false; };
  }, [periodo, perfilId]);

  const jaTem = (p: { data: string; codigo: string; horario: Horario | null }) => existentes.has(`${p.data}|${horarioDe(p).inicio}`);
  const marcado = (p: { data: string; codigo: string; horario: Horario | null }) => escolha.get(chave(p)) ?? !jaTem(p);
  const escolhidos = lidos.filter(marcado);
  const repetidos = lidos.filter(jaTem).length;

  async function gravar() {
    if (!escolhidos.length) return;
    setOcupado(true); setErro("");
    try {
      const lugar = {
        local_id: privado ? null : (localId || null),
        local_texto: privado || !localId ? (localTexto.trim() || null) : null,
      };
      const valor = valorDoLocal ? await valorDoLocal(lugar).catch(() => 0) : 0;
      const linhas = escolhidos.map((p) => ({
        institution_id: institutionId, perfil_id: perfilId, ...lugar, privado,
        data: p.data, hora_inicio: horarioDe(p).inicio, hora_fim: horarioDe(p).fim,
        valor, created_by: perfilId,
      }));
      const supabase = createClient();
      let entraram = 0, jaEstavam = 0;
      const { error } = await supabase.from("plantoes").insert(linhas);
      if (!error) entraram = linhas.length;
      else if (error.code === "23505") {
        // Um deles já estava (lançado em outra aba, ou dois turnos com o mesmo
        // começo): grava um a um e conta o que o banco recusou.
        for (const l of linhas) {
          const { error: e } = await supabase.from("plantoes").insert(l);
          if (!e) entraram++;
          else if (e.code === "23505") jaEstavam++;
          else throw e;
        }
      } else throw error;
      if (!entraram) {
        setErro(jaEstavam ? "Todos esses plantões já estavam na sua escala." : "Nada foi gravado.");
        return;
      }
      onImportado(entraram, escolhidos[0].data);
    } catch {
      setErro("Não foi possível gravar os plantões. Confira a conexão e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Janela titulo="Importar escala" largura="larga" onFechar={onFechar}
      subtitulo="A escala que você recebeu: a planilha (.xlsx), o PDF, o print do grupo ou a foto da folha. Os seus plantões entram na sua escala depois da sua conferência."
      rodape={escala ? (
        <>
          <button type="button" className="outlineClinical compact" onClick={onFechar} disabled={ocupado}>Voltar</button>
          <button type="button" className="primaryClinical compact" onClick={() => void gravar()} disabled={ocupado || !escolhidos.length}>
            {ocupado ? "Salvando…" : `Pôr ${plural(escolhidos.length, "plantão", "plantões")} na minha escala`}
          </button>
        </>
      ) : undefined}>
      <ArquivoDaEscala lido={Boolean(escala)} lendo={lendo} ocupado={ocupado} onArquivo={(a) => void escolher(a)} />

      {escala && (
        <>
          <div className={estilos.importarTopo}>
            <label className="clinicalField"><span>Você nesta escala</span>
              <select value={pessoa} onChange={(e) => { setPessoa(e.target.value); setEscolha(new Map()); }}>
                {escala.pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value={OUTRO}>Outro nome…</option>
              </select>
              {pessoa === OUTRO && (
                <input value={digitado} placeholder="Como o seu nome aparece" aria-label="Como o seu nome aparece na escala"
                  onChange={(e) => { setDigitado(e.target.value); setEscolha(new Map()); }} />
              )}
              <small className={estilos.dica}>
                {sugerirPessoa(escala.pessoas, nome, apelido) === pessoa ? "Achado pelo seu nome. " : ""}
                {plural(escala.pessoas.length, "nome lido", "nomes lidos")} no arquivo.
              </small>
            </label>
            <label className="clinicalField"><span>Mês da escala</span>
              <input type="month" value={mes} onChange={(e) => { if (e.target.value) { setMes(e.target.value); setEscolha(new Map()); } }} />
              <small className={estilos.dica}>
                {escala.mes ? "Lido do arquivo." : "O arquivo não diz o mês: confira."} Vale para os dias que vêm sem mês.
              </small>
            </label>
          </div>

          <div className={proprios.onde}>
            <div className="plantaoFilaNomes" role="group" aria-label="Para quem">
              <button type="button" className={`plantaoNomeChip${!privado ? " escolhido" : ""}`} aria-pressed={!privado}
                title="Entra na escala do grupo e na conta do serviço."
                onClick={() => setPrivado(false)}>Do grupo</button>
              <button type="button" className={`plantaoNomeChip soMeu${privado ? " escolhido" : ""}`} aria-pressed={privado}
                title="Hospital que não é do grupo, cobertura particular: só você vê."
                onClick={() => setPrivado(true)}>Só meu</button>
            </div>
            {privado || !locais.length ? (
              <label className="clinicalField"><span>Onde</span>
                <input value={localTexto} placeholder="Hospital ou clínica (opcional)" onChange={(e) => setLocalTexto(e.target.value)} />
              </label>
            ) : (
              <label className="clinicalField"><span>Hospital</span>
                <select value={localId} onChange={(e) => setLocalId(e.target.value)}>
                  <option value="">Sem hospital</option>
                  {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
                </select>
              </label>
            )}
          </div>

          <HorariosDosTurnos siglas={siglas} horarios={horarios}
            onMudar={(codigo, h) => setHorarios((a) => ({ ...a, [codigo]: h }))} />

          {repetidos > 0 && (
            <ul className={estilos.importarAvisos}>
              <li><b>{repetidos}</b> já {repetidos === 1 ? "está" : "estão"} na sua escala e {repetidos === 1 ? "veio desmarcado" : "vieram desmarcados"}.</li>
            </ul>
          )}

          {lidos.length === 0 ? (
            <p className={estilos.dica} role="status">Nenhum plantão com esse nome. Escolha outro nome na lista acima, ou o mês da escala.</p>
          ) : (
            <div className={estilos.importarTabela} role="region" aria-label="Plantões lidos do arquivo" tabIndex={0}>
              <table>
                <thead><tr><th aria-label="Importar"></th><th>Dia</th><th>Na escala</th><th>Horário</th></tr></thead>
                <tbody>
                  {lidos.map((p) => {
                    const h = horarioDe(p);
                    const k = chave(p);
                    return (
                      <tr key={k} className={marcado(p) ? undefined : estilos.desmarcada}>
                        <td><input type="checkbox" checked={marcado(p)} aria-label={`Importar ${nomeDoDia(p.data)}`}
                          onChange={() => setEscolha((m) => new Map(m).set(k, !marcado(p)))} /></td>
                        <td data-rotulo="Paciente"><b>{nomeDoDia(p.data)}</b>{jaTem(p) && <small>já na sua escala</small>}</td>
                        <td data-rotulo="Na escala">{p.codigo}</td>
                        <td data-rotulo="Horário">{h.inicio}–{h.fim}{h.fim <= h.inicio ? " (dia seguinte)" : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Janela>
  );
}
