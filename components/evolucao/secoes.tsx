"use client";

import { useState } from "react";
import { BLOQUEIOS, FUNCOES, POSICOES, PROTECOES, TECNICAS, imcDaFolha, type Profissional } from "@/lib/evolucao/folha";
import { Escolha, Marcas } from "./campos";
import { horaLocal } from "@/lib/data-local";

// As partes da folha que se preenchem uma vez: pré-anestésica conferida,
// técnica, equipe e saída da sala. Tudo grava no cabeçalho (com histórico na
// auditoria) — nada aqui é registro no tempo.

type Dados = Record<string, unknown>;
type Mudar = (m: Dados) => void;
const t = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const sub = (d: Dados, k: string) => ((d[k] as Dados | undefined) ?? {});

function Texto({ rotulo, valor, onMudar, linhas = 1, largo = false, disabled }: {
  rotulo: string; valor: string; onMudar: (v: string) => void; linhas?: number; largo?: boolean; disabled: boolean;
}) {
  return (
    <label className={`evoCampo${largo ? " largo" : ""}`}>
      <span>{rotulo}</span>
      {linhas > 1
        ? <textarea rows={linhas} value={valor} disabled={disabled} onChange={(e) => onMudar(e.target.value)} />
        : <input value={valor} disabled={disabled} onChange={(e) => onMudar(e.target.value)} />}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Pré-anestésica: a grade do papel, só leitura
// ---------------------------------------------------------------------------
/**
 * O bloco da avaliação como sai na folha impressa: seis colunas, rótulo em
 * cima, valor embaixo. É para CONFERIR de relance; editar é no formulário que
 * abre por baixo ("Editar").
 */
export function PreAnestesicaResumo({ dados, sexo }: { dados: Dados; sexo: string | null }) {
  const asa = t(dados.asa);
  const imc = imcDaFolha(dados);
  const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "");
  const alergiaTexto = dados.nega_alergia === true ? "Nega alergia a medicamentos" : t(dados.alergias) || "Não informado";
  const temAlergia = dados.nega_alergia !== true && Boolean(t(dados.alergias));
  const campo = (rotulo: string, valor: string, classe = "") => (
    <div className={`evoPreCampo ${classe}`}><small>{rotulo}</small><span>{valor || "—"}</span></div>
  );
  return (
    <div className="evoPreGradeResumo">
      {campo("Convênio", t(dados.convenio))}
      {campo("Sexo", t(sexo))}
      {campo("Peso", num(dados.peso_kg) && `${num(dados.peso_kg)} kg`)}
      {campo("Altura", num(dados.altura_cm) && `${num(dados.altura_cm)} cm`)}
      {campo("IMC", imc !== null ? `${num(imc)} kg/m²` : "")}
      {campo("ASA", asa ? `${asa}${dados.asa_emergencia === true ? " E (emergência)" : ""}` : "")}
      {campo("Alergias", alergiaTexto, `dobro${temAlergia ? " alerta" : ""}`)}
      {campo("Sinais na avaliação", t(dados.sinais_pre), "dobro")}
      {campo("Jejum", t(dados.jejum), "dobro")}
      {campo("Via aérea", t(dados.via_aerea), "metade")}
      {campo("Medicação em uso", t(dados.medicacao_uso), "metade")}
      {campo("Antecedentes", t(dados.antecedentes), "metade")}
      {campo("Exames", t(dados.exames), "metade")}
      {campo("Anestesia anterior", t(dados.anestesia_anterior), "metade")}
      {campo("Diagnóstico pré-operatório", t(dados.diagnostico), "metade")}
      {t(dados.observacoes_pre) && campo("Observações", t(dados.observacoes_pre), "todo")}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pré-anestésica conferida
// ---------------------------------------------------------------------------
export function SecaoPreAnestesica({ dados, onMudar, leitura, idadeAnos }: {
  dados: Dados; onMudar: Mudar; leitura: boolean; idadeAnos: number | null;
}) {
  const imc = imcDaFolha(dados);
  const crianca = idadeAnos !== null && idadeAnos < 18;
  const origem = dados.preanestesica_origem as { importado_em?: string } | null | undefined;
  const peso = typeof dados.peso_kg === "number" ? String(dados.peso_kg).replace(".", ",") : "";
  const [pesoTexto, setPesoTexto] = useState(peso);
  function mudarPeso(v: string) {
    setPesoTexto(v);
    const n = Number(v.replace(",", "."));
    onMudar({ peso_kg: v.trim() === "" ? null : Number.isFinite(n) && n > 0 && n <= 400 ? n : dados.peso_kg ?? null });
  }
  return (
    <div className="evoSecaoCorpo">
      <p className="evoNota">
        {origem?.importado_em
          ? `Trazido da avaliação pré-anestésica em ${new Date(origem.importado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. O que mudar aqui não altera a avaliação original e fica no histórico da folha.`
          : "Sem avaliação pré-anestésica no sistema para este paciente: preencha o que tiver."}
      </p>
      <div className="evoGradePre">
        <label className="evoCampo"><span>Peso (kg)</span>
          <input inputMode="decimal" value={pesoTexto} disabled={leitura} onChange={(e) => mudarPeso(e.target.value)} />
        </label>
        <Texto rotulo="Altura (cm)" valor={t(dados.altura_cm)} disabled={leitura}
          onMudar={(v) => onMudar({ altura_cm: v.trim() ? Number(v.replace(",", ".")) || null : null })} />
        <div className="evoCampo evoCalculado">
          <span>IMC</span>
          <output>{imc !== null ? imc.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</output>
          <small>{imc === null ? "precisa de peso e altura" : crianca ? "em criança, ler por percentil" : "kg/m², do peso e altura acima"}</small>
        </div>
        <Escolha rotulo="ASA" valor={t(dados.asa) as "I"}
          opcoes={["I", "II", "III", "IV", "V", "VI"].map((v) => ({ valor: v as "I", rotulo: v }))}
          onMudar={(v) => !leitura && onMudar({ asa: v })} />
        <label className="evoMarca">
          <input type="checkbox" checked={dados.asa_emergencia === true} disabled={leitura}
            onChange={(e) => onMudar({ asa_emergencia: e.target.checked })} />
          <span>Cirurgia de emergência (E)</span>
        </label>
        <Texto rotulo="Diagnóstico pré-operatório" valor={t(dados.diagnostico)} onMudar={(v) => onMudar({ diagnostico: v })} largo disabled={leitura} />
        <Texto rotulo="Hospital" valor={t(dados.hospital)} onMudar={(v) => onMudar({ hospital: v })} disabled={leitura} />
        <Texto rotulo="Sala" valor={t(dados.sala)} onMudar={(v) => onMudar({ sala: v })} disabled={leitura} />
        <Texto rotulo="Convênio" valor={t(dados.convenio)} onMudar={(v) => onMudar({ convenio: v })} disabled={leitura} />
        <Texto rotulo="Alergias" valor={t(dados.alergias)} onMudar={(v) => onMudar({ alergias: v, nega_alergia: false })} largo disabled={leitura} />
        <label className="evoMarca">
          <input type="checkbox" checked={dados.nega_alergia === true} disabled={leitura}
            onChange={(e) => onMudar({ nega_alergia: e.target.checked, ...(e.target.checked ? { alergias: "" } : {}) })} />
          <span>Nega alergia a medicamentos</span>
        </label>
        <Texto rotulo="Medicação em uso" valor={t(dados.medicacao_uso)} onMudar={(v) => onMudar({ medicacao_uso: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Antecedentes e comorbidades" valor={t(dados.antecedentes)} onMudar={(v) => onMudar({ antecedentes: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Via aérea" valor={t(dados.via_aerea)} onMudar={(v) => onMudar({ via_aerea: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Exames" valor={t(dados.exames)} onMudar={(v) => onMudar({ exames: v })} linhas={2} largo disabled={leitura} />
        <Texto rotulo="Jejum" valor={t(dados.jejum)} onMudar={(v) => onMudar({ jejum: v })} disabled={leitura} />
        <Texto rotulo="Sinais na avaliação" valor={t(dados.sinais_pre)} onMudar={(v) => onMudar({ sinais_pre: v })} disabled={leitura} />
        <Texto rotulo="Anestesia anterior" valor={t(dados.anestesia_anterior)} onMudar={(v) => onMudar({ anestesia_anterior: v })} largo disabled={leitura} />
        <Texto rotulo="Observações" valor={t(dados.observacoes_pre)} onMudar={(v) => onMudar({ observacoes_pre: v })} linhas={2} largo disabled={leitura} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Técnica e posição
// ---------------------------------------------------------------------------
export function SecaoTecnica({ dados, onMudar, leitura }: { dados: Dados; onMudar: Mudar; leitura: boolean }) {
  const tecnicas = (dados.tecnicas as string[] | undefined) ?? [];
  const det = sub(dados, "tecnica_detalhes");
  const mudarDet = (grupo: string, campo: string, v: unknown) =>
    onMudar({ tecnica_detalhes: { ...det, [grupo]: { ...sub(det, grupo), [campo]: v } } });
  const tem = (c: string) => tecnicas.includes(c);
  const geral = tecnicas.some((c) => c.startsWith("geral"));
  const neuro = tem("raquianestesia") || tem("combinada");
  const peri = tem("peridural") || tem("combinada");
  const g = sub(det, "geral"), r = sub(det, "raqui"), p = sub(det, "peridural"), s = sub(det, "sedacao"), b = sub(det, "bloqueio");

  return (
    <div className="evoSecaoCorpo">
      <Marcas rotulo="Técnica" opcoes={TECNICAS.map((x) => x.rotulo)}
        valores={tecnicas.map((c) => TECNICAS.find((x) => x.codigo === c)?.rotulo ?? c)}
        onMudar={(v) => !leitura && onMudar({ tecnicas: v.map((rot) => TECNICAS.find((x) => x.rotulo === rot)?.codigo ?? rot) })} />

      {geral && (
        <fieldset className="evoDetalhe"><legend>Via aérea e ventilação</legend>
          <Escolha rotulo="Dispositivo" valor={t(g.dispositivo) as "TOT"} onMudar={(v) => !leitura && mudarDet("geral", "dispositivo", v)}
            opcoes={["TOT", "Máscara laríngea", "Máscara facial", "Traqueostomia"].map((v) => ({ valor: v as "TOT", rotulo: v }))} />
          <div className="evoLinhaCampos">
            <Texto rotulo="Nº do tubo / dispositivo" valor={t(g.numero)} onMudar={(v) => mudarDet("geral", "numero", v)} disabled={leitura} />
            <Texto rotulo="Cormack-Lehane" valor={t(g.cormack)} onMudar={(v) => mudarDet("geral", "cormack", v)} disabled={leitura} />
            <Texto rotulo="Laringoscopia / observação" valor={t(g.laringoscopia)} onMudar={(v) => mudarDet("geral", "laringoscopia", v)} disabled={leitura} />
          </div>
          <Escolha rotulo="Ventilação" valor={t(g.modo) as "VCV"} onMudar={(v) => !leitura && mudarDet("geral", "modo", v)}
            opcoes={["Espontânea", "VCV", "PCV", "PSV", "Manual"].map((v) => ({ valor: v as "VCV", rotulo: v }))} />
          <div className="evoLinhaCampos">
            <Texto rotulo="Volume corrente (mL)" valor={t(g.vc)} onMudar={(v) => mudarDet("geral", "vc", v)} disabled={leitura} />
            <Texto rotulo="Pressão (PCV)" valor={t(g.pcv)} onMudar={(v) => mudarDet("geral", "pcv", v)} disabled={leitura} />
            <Texto rotulo="PEEP" valor={t(g.peep)} onMudar={(v) => mudarDet("geral", "peep", v)} disabled={leitura} />
            <Texto rotulo="FR" valor={t(g.fr)} onMudar={(v) => mudarDet("geral", "fr", v)} disabled={leitura} />
          </div>
        </fieldset>
      )}

      {neuro && (
        <fieldset className="evoDetalhe"><legend>Raquianestesia</legend>
          <div className="evoLinhaCampos">
            <Texto rotulo="Espaço (ex.: L3-L4)" valor={t(r.espaco)} onMudar={(v) => mudarDet("raqui", "espaco", v)} disabled={leitura} />
            <Texto rotulo="Agulha (calibre e tipo)" valor={t(r.agulha)} onMudar={(v) => mudarDet("raqui", "agulha", v)} disabled={leitura} />
          </div>
          <Escolha rotulo="Abordagem" valor={t(r.abordagem) as "Mediana"} onMudar={(v) => !leitura && mudarDet("raqui", "abordagem", v)}
            opcoes={["Mediana", "Paramediana"].map((v) => ({ valor: v as "Mediana", rotulo: v }))} />
          <div className="evoLinhaCampos">
            <label className="evoMarca"><input type="checkbox" checked={r.puncao_unica === true} disabled={leitura}
              onChange={(e) => mudarDet("raqui", "puncao_unica", e.target.checked)} /><span>Punção única</span></label>
            <label className="evoMarca"><input type="checkbox" checked={r.lcr_claro === true} disabled={leitura}
              onChange={(e) => mudarDet("raqui", "lcr_claro", e.target.checked)} /><span>LCR claro</span></label>
          </div>
          <Texto rotulo="Observações (os fármacos vão na coluna de medicamentos)" valor={t(r.obs)} onMudar={(v) => mudarDet("raqui", "obs", v)} largo disabled={leitura} />
        </fieldset>
      )}

      {peri && (
        <fieldset className="evoDetalhe"><legend>Peridural</legend>
          <div className="evoLinhaCampos">
            <Texto rotulo="Espaço" valor={t(p.espaco)} onMudar={(v) => mudarDet("peridural", "espaco", v)} disabled={leitura} />
            <Texto rotulo="Agulha" valor={t(p.agulha)} onMudar={(v) => mudarDet("peridural", "agulha", v)} disabled={leitura} />
            <Texto rotulo="Técnica de identificação" valor={t(p.identificacao)} onMudar={(v) => mudarDet("peridural", "identificacao", v)} disabled={leitura} />
          </div>
          <div className="evoLinhaCampos">
            <label className="evoMarca"><input type="checkbox" checked={p.cateter === true} disabled={leitura}
              onChange={(e) => mudarDet("peridural", "cateter", e.target.checked)} /><span>Cateter</span></label>
            <Texto rotulo="Cateter na pele (cm)" valor={t(p.cateter_cm)} onMudar={(v) => mudarDet("peridural", "cateter_cm", v)} disabled={leitura} />
            <Texto rotulo="Dose-teste" valor={t(p.dose_teste)} onMudar={(v) => mudarDet("peridural", "dose_teste", v)} disabled={leitura} />
          </div>
        </fieldset>
      )}

      {tem("sedacao") && (
        <fieldset className="evoDetalhe"><legend>Sedação</legend>
          <Marcas rotulo="Ventilação" opcoes={["Espontânea", "Cateter de O₂", "Máscara", "Assistida sob máscara", "Guedel"]}
            valores={(s.ventilacao as string[] | undefined) ?? []}
            onMudar={(v) => !leitura && mudarDet("sedacao", "ventilacao", v)} />
        </fieldset>
      )}

      {tem("bloqueio_periferico") && (
        <fieldset className="evoDetalhe"><legend>Bloqueio periférico</legend>
          <Marcas rotulo="Bloqueio" opcoes={BLOQUEIOS} valores={(b.tipos as string[] | undefined) ?? []}
            onMudar={(v) => !leitura && mudarDet("bloqueio", "tipos", v)} />
          <div className="evoLinhaCampos">
            <label className="evoMarca"><input type="checkbox" checked={b.usg === true} disabled={leitura}
              onChange={(e) => mudarDet("bloqueio", "usg", e.target.checked)} /><span>Guiado por ultrassom</span></label>
            <label className="evoMarca"><input type="checkbox" checked={b.neuroestimulador === true} disabled={leitura}
              onChange={(e) => mudarDet("bloqueio", "neuroestimulador", e.target.checked)} /><span>Neuroestimulador</span></label>
            <Texto rotulo="Agulha" valor={t(b.agulha)} onMudar={(v) => mudarDet("bloqueio", "agulha", v)} disabled={leitura} />
            <Texto rotulo="Lado" valor={t(b.lado)} onMudar={(v) => mudarDet("bloqueio", "lado", v)} disabled={leitura} />
          </div>
        </fieldset>
      )}

      <Marcas rotulo="Posição" opcoes={POSICOES} valores={(dados.posicoes as string[] | undefined) ?? []}
        onMudar={(v) => !leitura && onMudar({ posicoes: v })} />
      <Marcas rotulo="Proteções" opcoes={PROTECOES} valores={(dados.protecoes as string[] | undefined) ?? []}
        onMudar={(v) => !leitura && onMudar({ protecoes: v })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cirurgia e horários
// ---------------------------------------------------------------------------
type Marcos = { inicioAnestesia: string | null; fimAnestesia: string | null; inicioCirurgia: string | null; fimCirurgia: string | null };

export function SecaoCirurgia({ dados, onMudar, leitura, marcos }: {
  dados: Dados; onMudar: Mudar; leitura: boolean; marcos: Marcos;
}) {
  const h = (iso: string | null) => (iso ? horaLocal(new Date(iso)) : "—");
  const duracao = (a: string | null, b: string | null) => {
    if (!a || !b) return "";
    const min = Math.round((Date.parse(b) - Date.parse(a)) / 60000);
    return min > 0 ? ` (${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")})` : "";
  };
  return (
    <div className="evoSecaoCorpo">
      <Texto rotulo="Cirurgia" valor={t(dados.procedimento)} onMudar={(v) => onMudar({ procedimento: v })} largo disabled={leitura} />
      <Texto rotulo="Cirurgião" valor={t(dados.cirurgiao)} onMudar={(v) => onMudar({ cirurgiao: v })} disabled={leitura} />
      <dl className="evoHorarios">
        <div><dt>Anestesia</dt><dd>{h(marcos.inicioAnestesia)} às {h(marcos.fimAnestesia)}{duracao(marcos.inicioAnestesia, marcos.fimAnestesia)}</dd></div>
        <div><dt>Cirurgia</dt><dd>{h(marcos.inicioCirurgia)} às {h(marcos.fimCirurgia)}{duracao(marcos.inicioCirurgia, marcos.fimCirurgia)}</dd></div>
      </dl>
      <p className="evoNota">Os horários vêm dos eventos de início e fim registrados no gráfico.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------
export function SecaoEquipe({ dados, onMudar, leitura, medicos }: {
  dados: Dados; onMudar: Mudar; leitura: boolean; medicos: Array<{ id: string; nome: string; crm: string }>;
}) {
  const equipe = (dados.equipe as Profissional[] | undefined) ?? [];
  const mudar = (lista: Profissional[]) => onMudar({ equipe: lista });
  const de = (f: Profissional["funcao"]) => equipe.filter((p) => p.funcao === f);
  function trocar(alvo: Profissional, m: Partial<Profissional>) {
    mudar(equipe.map((p) => (p === alvo ? { ...p, ...m } : p)));
  }
  function adicionar(funcao: Profissional["funcao"]) {
    mudar([...equipe, { perfil_id: null, nome: "", crm: "", uf: "PR", funcao, ano_residencia: funcao === "residente" ? "R1" : null }]);
  }
  function linha(p: Profissional) {
    return (
      <div className="evoProfissional" key={equipe.indexOf(p)}>
        <b>{FUNCOES[p.funcao]}</b>
        <label className="evoCampo"><span>Nome</span>
          <input list="evoMedicos" value={p.nome} disabled={leitura} onChange={(e) => {
            const m = medicos.find((x) => x.nome === e.target.value);
            trocar(p, m ? { nome: m.nome, crm: m.crm.replace(/\D/g, "") || m.crm, perfil_id: m.id } : { nome: e.target.value, perfil_id: null });
          }} />
        </label>
        <label className="evoCampo curto"><span>CRM</span>
          <input value={p.crm} disabled={leitura} onChange={(e) => trocar(p, { crm: e.target.value })} />
        </label>
        <label className="evoCampo curto"><span>UF</span>
          <input value={p.uf} maxLength={2} disabled={leitura} onChange={(e) => trocar(p, { uf: e.target.value.toUpperCase() })} />
        </label>
        {p.funcao === "residente" && (
          <label className="evoCampo curto"><span>Ano</span>
            <select value={p.ano_residencia ?? "R1"} disabled={leitura}
              onChange={(e) => trocar(p, { ano_residencia: e.target.value as "R1" })}>
              <option>R1</option><option>R2</option><option>R3</option>
            </select>
          </label>
        )}
        {!leitura && p.funcao !== "responsavel" && (
          <button type="button" className="evoBotao fantasma" onClick={() => mudar(equipe.filter((x) => x !== p))}>Remover</button>
        )}
      </div>
    );
  }
  return (
    <div className="evoSecaoCorpo">
      <datalist id="evoMedicos">{medicos.map((m) => <option key={m.id} value={m.nome} />)}</datalist>
      {de("responsavel").map(linha)}
      {de("preceptor").map(linha)}
      {de("residente").map(linha)}
      {de("outro").map(linha)}
      {!leitura && (
        <div className="evoAcoesLinha">
          {!de("residente").length && <button type="button" className="evoBotao secundario" onClick={() => adicionar("residente")}>+ Residente</button>}
          {!de("preceptor").length && <button type="button" className="evoBotao secundario" onClick={() => adicionar("preceptor")}>+ Preceptor</button>}
          <button type="button" className="evoBotao secundario" onClick={() => adicionar("outro")}>+ Outro médico</button>
        </div>
      )}
      <p className="evoNota">Residente e preceptor são opcionais. A impressão mostra só quem estiver aqui.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saída da sala
// ---------------------------------------------------------------------------
export function SecaoSaida({ dados, onMudar, leitura }: { dados: Dados; onMudar: Mudar; leitura: boolean }) {
  const s = sub(dados, "saida");
  const mudar = (campo: string, v: unknown) => onMudar({ saida: { ...s, [campo]: v } });
  return (
    <div className="evoSecaoCorpo">
      <Escolha rotulo="Destino" valor={t(s.destino) as "RPA"} onMudar={(v) => !leitura && mudar("destino", v)}
        opcoes={["RPA", "UTI", "Enfermaria", "Outro"].map((v) => ({ valor: v as "RPA", rotulo: v }))} />
      {s.destino === "Outro" && <Texto rotulo="Qual" valor={t(s.destino_outro)} onMudar={(v) => mudar("destino_outro", v)} disabled={leitura} />}
      <Escolha rotulo="Condição" valor={t(s.consciencia) as "Consciente"} onMudar={(v) => !leitura && mudar("consciencia", v)}
        opcoes={["Consciente", "Sonolento", "Sedado", "Intubado"].map((v) => ({ valor: v as "Consciente", rotulo: v }))} />
      <div className="evoLinhaCampos">
        <label className="evoMarca"><input type="checkbox" checked={s.estavel === true} disabled={leitura}
          onChange={(e) => mudar("estavel", e.target.checked)} /><span>Estável</span></label>
        <Texto rotulo="PA" valor={t(s.pa)} onMudar={(v) => mudar("pa", v)} disabled={leitura} />
        <Texto rotulo="FC" valor={t(s.fc)} onMudar={(v) => mudar("fc", v)} disabled={leitura} />
        <Texto rotulo="SpO₂ %" valor={t(s.spo2)} onMudar={(v) => mudar("spo2", v)} disabled={leitura} />
      </div>
      <Escolha rotulo="Oxigênio" valor={t(s.oxigenio) as "Sem O₂"} onMudar={(v) => !leitura && mudar("oxigenio", v)}
        opcoes={["Sem O₂", "Com O₂"].map((v) => ({ valor: v as "Sem O₂", rotulo: v }))} />
      <div className="evoLinhaCampos">
        <Texto rotulo="Aldrete na saída da RPA" valor={t(s.aldrete)} onMudar={(v) => mudar("aldrete", v)} disabled={leitura} />
      </div>
      <Texto rotulo="Observações e intercorrências" valor={t(dados.observacoes)} onMudar={(v) => onMudar({ observacoes: v })} linhas={3} largo disabled={leitura} />
    </div>
  );
}
