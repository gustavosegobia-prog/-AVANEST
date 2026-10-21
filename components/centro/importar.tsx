"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Janela } from "@/components/janela";
import {
  casarAnestesista, casarSala, normalizar, lerMapa, type LinhaImportada, type MapaImportado,
} from "@/lib/centro-importar";
import { type Sala } from "@/lib/centro-cirurgico";
import type { Anestesista } from "./mapa-cirurgico";
import { mensagemDoBanco } from "./janelas";
import { TIPOS_ACEITOS, gradeDoArquivo } from "./ler-arquivo";
import estilos from "./mapa.module.css";

const DATA_CURTA = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const nomeDoDia = (d: string) => DATA_CURTA.format(new Date(`${d}T12:00:00Z`));

/**
 * Importar o mapa que o centro cirúrgico já faz — a planilha, o PDF ou o print
 * do grupo.
 *
 * Três passos: escolher o arquivo, conferir, pôr no mapa. A conferência é o
 * centro da tela, porque a leitura de foto erra letra: cada linha tem a sua
 * caixa de marcar, a sala que ainda não existe aparece como "nova" (e é criada
 * junto), e o paciente que já está no mapa daquele dia vem desmarcado — subir
 * o mesmo arquivo duas vezes não duplica ninguém.
 */
export function JanelaDeImportar({ institutionId, diaAberto, salas, anestesistas, dePlantao, onFechar, onImportado }: {
  institutionId: string;
  diaAberto: string;
  salas: Sala[];
  anestesistas: Anestesista[];
  dePlantao: (data: string, horario: string | null) => string[];
  onFechar: () => void;
  onImportado: (data: string, quantos: number) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [mapa, setMapa] = useState<MapaImportado | null>(null);
  const [data, setData] = useState(diaAberto);
  const [anestesistaId, setAnestesistaId] = useState("");
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [jaNoMapa, setJaNoMapa] = useState<Set<number>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  /**
   * Quem já está no mapa daquele dia — o mesmo paciente com a mesma cirurgia —
   * sai desmarcado. Corre depois de a lista aparecer, e não antes: numa rede
   * lenta, a conferência não pode ficar esperando o banco para mostrar o que já
   * foi lido. Se o banco não responder, ninguém é desmarcado.
   */
  async function conferirRepetidos(m: MapaImportado, dia: string) {
    try {
      const { data: existentes, error } = await createClient().from("centro_casos").select("paciente, procedimento")
        .eq("institution_id", institutionId).eq("data", dia);
      if (error) return;
      const chave = (p: string, c: string) => `${normalizar(p)}|${normalizar(c)}`;
      const ja = new Set((existentes ?? []).map((e) => chave(String(e.paciente), String(e.procedimento))));
      const repetidas = new Set(m.linhas.filter((l) => ja.has(chave(l.paciente, l.procedimento))).map((l) => l.linha));
      setJaNoMapa(repetidas);
      if (repetidas.size) setMarcadas((atual) => new Set([...atual].filter((n) => !repetidas.has(n))));
    } catch { /* sem conferência de repetidos: segue com tudo marcado */ }
  }

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(""); setMapa(null); setLendo(0);
    try {
      const m = lerMapa(await gradeDoArquivo(arquivo, (f) => setLendo(f)));
      if (!m || !m.linhas.length) {
        setErro("Li o arquivo, mas não achei pacientes. Confira se a tabela tem as colunas PACIENTE e PROCEDIMENTO.");
        return;
      }
      const dia = m.data ?? diaAberto;
      setMapa(m);
      setData(dia);
      setAnestesistaId(casarAnestesista(m.anestesista, anestesistas)?.id ?? dePlantao(dia, null)[0] ?? "");
      setJaNoMapa(new Set());
      setMarcadas(new Set(m.linhas.map((l) => l.linha)));
      void conferirRepetidos(m, dia);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para ler o arquivo.");
    } finally {
      setLendo(null);
    }
  }

  const escolhidas = useMemo(() => (mapa?.linhas ?? []).filter((l) => marcadas.has(l.linha)), [mapa, marcadas]);
  const salasNovas = useMemo(() => [...new Set(escolhidas.map((l) => l.sala).filter((s): s is string => Boolean(s) && !casarSala(s, salas)))],
    [escolhidas, salas]);

  async function importar() {
    if (!escolhidas.length) return;
    setOcupado(true); setErro("");
    const sb = createClient();
    try {
      // 1. As salas que o arquivo tem e o cadastro não.
      let todas = [...salas];
      if (salasNovas.length) {
        const base = salas.reduce((m, s) => Math.max(m, s.ordem), 0);
        const { data: criadas, error } = await sb.from("centro_salas")
          .insert(salasNovas.map((nome, i) => ({ institution_id: institutionId, nome, ordem: base + i + 1 })))
          .select("id, nome, ordem, ativa");
        if (error) throw new Error(mensagemDoBanco(error.message));
        todas = [...todas, ...((criadas ?? []) as Sala[])];
      }
      // 2. Os pacientes, depois dos que já estão no mapa daquele dia, na ordem do arquivo.
      const { data: ultimos } = await sb.from("centro_casos").select("ordem").eq("institution_id", institutionId)
        .eq("data", data).not("ordem", "is", null).order("ordem", { ascending: false }).limit(1);
      const base = Number(ultimos?.[0]?.ordem ?? 0);
      const linhas = escolhidas.map((l, i) => ({
        institution_id: institutionId, data, ordem: base + i + 1,
        horario: l.horario, paciente: l.paciente, idade: l.idade, convenio: l.convenio, cirurgiao: l.cirurgiao,
        sala_id: casarSala(l.sala, todas)?.id ?? null, procedimento: l.procedimento, leito: l.leito,
        anestesista_id: anestesistaId || null,
      }));
      const { error } = await sb.from("centro_casos").insert(linhas);
      if (error) throw new Error(mensagemDoBanco(error.message));
      onImportado(data, linhas.length);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para gravar.");
    } finally {
      setOcupado(false);
    }
  }

  const alternar = (l: LinhaImportada) => setMarcadas((m) => {
    const n = new Set(m);
    if (n.has(l.linha)) n.delete(l.linha); else n.add(l.linha);
    return n;
  });

  return (
    <Janela titulo="Importar o mapa" largura="larga" onFechar={onFechar}
      subtitulo="A planilha (.xlsx), o PDF ou o print do mapa do grupo. Nada é salvo antes da sua conferência."
      rodape={mapa ? (
        <>
          <button type="button" className="outlineClinical compact" onClick={onFechar} disabled={ocupado}>Voltar</button>
          <button type="button" className="primaryClinical compact" onClick={() => void importar()} disabled={ocupado || !escolhidas.length}>
            {ocupado ? "Salvando…" : `Pôr ${escolhidas.length} ${escolhidas.length === 1 ? "paciente" : "pacientes"} no mapa`}
          </button>
        </>
      ) : undefined}>
      <div className={estilos.importarArquivo}>
        <input ref={entrada} type="file" accept={TIPOS_ACEITOS} hidden
          onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className={mapa ? "outlineClinical compact" : "primaryClinical compact"}
          onClick={() => entrada.current?.click()} disabled={lendo != null || ocupado} data-foco-inicial>
          {mapa ? "Escolher outro arquivo" : "Escolher o arquivo do mapa"}
        </button>
        {lendo != null && <p className={estilos.dica} role="status">Lendo o arquivo{lendo > 0 ? ` (${Math.round(lendo * 100)}%)` : "…"}</p>}
        {!mapa && lendo == null && (
          <p className={estilos.dica}>
            Do Excel, a planilha é o melhor: entra sem erro. A foto e o print também funcionam, mas confira os nomes —
            a leitura de imagem pode trocar uma letra.
          </p>
        )}
      </div>

      {mapa && (
        <>
          <div className={estilos.importarTopo}>
            <label className="clinicalField"><span>Dia do mapa</span>
              <input type="date" value={data} onChange={(e) => {
                setData(e.target.value);
                setMarcadas(new Set(mapa.linhas.map((l) => l.linha)));
                setJaNoMapa(new Set());
                void conferirRepetidos(mapa, e.target.value);
              }} />
              <small className={estilos.dica}>{mapa.data ? "Lido do título do mapa." : "O arquivo não diz o dia: confira."} {data && nomeDoDia(data)}</small></label>
            <label className="clinicalField"><span>Anestesista do dia</span>
              <select value={anestesistaId} onChange={(e) => setAnestesistaId(e.target.value)}>
                <option value="">A definir</option>
                {anestesistas.map((a) => <option key={a.id} value={a.id}>{a.apelido}</option>)}
              </select>
              <small className={estilos.dica}>
                {mapa.anestesista ? `No título do mapa: “${mapa.anestesista}”.` : "Sugerido pela escala do dia."} Vale para todos; dá para trocar um a um depois.
              </small></label>
          </div>
          {(salasNovas.length > 0 || jaNoMapa.size > 0 || mapa.ignoradas > 0) && (
            <ul className={estilos.importarAvisos}>
              {salasNovas.length > 0 && <li>{salasNovas.length === 1 ? "Sala nova, criada junto" : "Salas novas, criadas junto"}: <b>{salasNovas.join(", ")}</b>.</li>}
              {jaNoMapa.size > 0 && <li><b>{jaNoMapa.size}</b> já {jaNoMapa.size === 1 ? "está" : "estão"} no mapa deste dia e {jaNoMapa.size === 1 ? "veio desmarcado" : "vieram desmarcados"}.</li>}
              {mapa.ignoradas > 0 && <li><b>{mapa.ignoradas}</b> {mapa.ignoradas === 1 ? "linha tem" : "linhas têm"} paciente sem cirurgia e {mapa.ignoradas === 1 ? "ficou" : "ficaram"} de fora.</li>}
            </ul>
          )}
          <div className={estilos.importarTabela} role="region" aria-label="Pacientes lidos do arquivo" tabIndex={0}>
            <table>
              <thead>
                <tr><th aria-label="Importar"></th><th>Hora</th><th>Paciente</th><th>Idade</th><th>Convênio</th><th>Cirurgião</th><th>Sala</th><th>Cirurgia</th><th>Leito</th></tr>
              </thead>
              <tbody>
                {mapa.linhas.map((l) => {
                  const sala = l.sala ? casarSala(l.sala, salas)?.nome ?? l.sala : "";
                  const nova = Boolean(l.sala) && !casarSala(l.sala, salas);
                  return (
                    <tr key={l.linha} className={marcadas.has(l.linha) ? undefined : estilos.desmarcada}>
                      <td><input type="checkbox" checked={marcadas.has(l.linha)} onChange={() => alternar(l)}
                        aria-label={`Importar ${l.paciente}`} /></td>
                      <td data-rotulo="Hora">{l.horario ?? "A/S"}</td>
                      <td data-rotulo="Paciente"><b>{l.paciente}</b>{jaNoMapa.has(l.linha) && <small> já está no mapa</small>}</td>
                      <td data-rotulo="Idade">{l.idade ?? ""}</td>
                      <td data-rotulo="Convênio">{l.convenio ?? ""}</td>
                      <td data-rotulo="Cirurgião">{l.cirurgiao ?? ""}</td>
                      <td data-rotulo="Sala">{sala}{nova && <small> nova</small>}</td>
                      <td data-rotulo="Cirurgia">{l.procedimento}</td>
                      <td data-rotulo="Leito">{l.leito ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
    </Janela>
  );
}
