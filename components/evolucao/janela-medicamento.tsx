"use client";

import { useMemo, useState } from "react";
import { Janela } from "@/components/janela";
import { horaLocal } from "@/lib/data-local";
import {
  CATALOGO, CATEGORIAS, buscarNoCatalogo, doseAcumulada, doseDoVolume, dosePorKg, volumeDaDose,
  type Administracao, type ItemDoCatalogo, type UnidadeDeConcentracao, type UnidadeDeDose,
} from "@/lib/evolucao/medicamentos";
import { avaliarDose, type RegraDeDose } from "@/lib/evolucao/doses";
import { conferirAlergia, situacaoDaAlergia } from "@/lib/evolucao/alergias";
import { minutosEntre } from "@/lib/evolucao/registros";
import { momentoDeHora } from "./use-folha";
import { CampoHora, CampoNumero, Escolha, numero } from "./campos";

// Registrar um medicamento.
//
// NADA AQUI SUGERE DOSE. O médico escolhe o fármaco, digita a concentração da
// ampola que tem na mão e a dose; o volume sai da conta (ou a dose sai do
// volume). A conferência de dose só julga contra regra APROVADA — sem ela,
// aparece "Referência de dose indisponível" e a conta em mg/kg, sem veredito.
// E nenhum registro nasce "administrado" sem o médico marcar: o padrão é o que
// ele escolher, e a escolha fica visível no botão de confirmar.

export type NovoMedicamento = {
  momento: string;
  dados: Record<string, unknown>;
};

const VIAS = [
  { valor: "EV", rotulo: "EV" }, { valor: "IM", rotulo: "IM" }, { valor: "SC", rotulo: "SC" },
  { valor: "intratecal", rotulo: "Intratecal" }, { valor: "peridural", rotulo: "Peridural" },
  { valor: "perineural", rotulo: "Perineural" }, { valor: "VO", rotulo: "VO" },
  { valor: "intranasal", rotulo: "Intranasal" }, { valor: "inalatoria", rotulo: "Inalatória" },
  { valor: "topica", rotulo: "Tópica" }, { valor: "retal", rotulo: "Retal" }, { valor: "outra", rotulo: "Outra" },
] as const;
const FORMAS = [
  { valor: "bolus", rotulo: "Bolus" }, { valor: "infusao", rotulo: "Infusão" },
  { valor: "neuroeixo", rotulo: "Neuroeixo" }, { valor: "bloqueio", rotulo: "Bloqueio" },
] as const;
const SITUACOES = [
  { valor: "administrado", rotulo: "Administrado" }, { valor: "preparado", rotulo: "Preparado" },
  { valor: "planejado", rotulo: "Planejado" },
] as const;
const INDICACOES = ["Indução", "Manutenção", "Analgesia", "Antibioticoprofilaxia", "Antiemese", "Reversão",
  "Raquianestesia", "Peridural", "Bloqueio", "Vasopressor", "Outra"];
const UNIDADES_DOSE: UnidadeDeDose[] = ["mg", "mcg", "g", "UI", "mEq", "mL"];
const UNIDADES_CONC: UnidadeDeConcentracao[] = ["mg/mL", "mcg/mL", "g/mL", "UI/mL", "mEq/mL", "%"];

const NIVEL: Record<string, string> = {
  verde: "Dentro da referência", amarelo: "Conferir", vermelho: "Alerta crítico",
  indisponivel: "Sem referência aprovada", erro: "Dado inválido",
};

export function JanelaMedicamento({
  pesoKg, idadeDias, regras, dadas, favoritos, inicial, alergias, onConfirmar, onFechar,
}: {
  pesoKg: number | null;
  /** O cabeçalho da folha: alergias e "nega alergia". */
  alergias: { alergias?: unknown; nega_alergia?: unknown };
  idadeDias: number | null;
  regras: RegraDeDose[];
  dadas: Administracao[];
  favoritos: string[];
  /** Ao administrar algo planejado: a folha abre com os campos dele. */
  inicial?: Record<string, unknown> | null;
  onConfirmar: (m: NovoMedicamento) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [item, setItem] = useState<ItemDoCatalogo | { nome: string; unidade: UnidadeDeDose } | null>(
    inicial ? { nome: String(inicial.nome), unidade: (inicial.unidade as UnidadeDeDose) ?? "mg" } : null);
  const [hora, setHora] = useState(horaLocal());
  const [apresentacao, setApresentacao] = useState(String(inicial?.apresentacao ?? ""));
  const [conc, setConc] = useState(inicial?.concentracao ? String((inicial.concentracao as { valor: number }).valor) : "");
  const [uConc, setUConc] = useState<UnidadeDeConcentracao>(
    (inicial?.concentracao as { unidade?: UnidadeDeConcentracao } | undefined)?.unidade ?? "mg/mL");
  const [dose, setDose] = useState(inicial?.dose != null ? String(inicial.dose) : "");
  const [unidade, setUnidade] = useState<UnidadeDeDose>((inicial?.unidade as UnidadeDeDose) ?? "mg");
  const [volume, setVolume] = useState("");
  const [editouVolume, setEditouVolume] = useState(false);
  const [via, setVia] = useState<string>(String(inicial?.via ?? "EV"));
  const [forma, setForma] = useState<string>(String(inicial?.forma ?? "bolus"));
  const [situacao, setSituacao] = useState<string>("administrado");
  const [indicacao, setIndicacao] = useState(String(inicial?.indicacao ?? ""));
  const [obs, setObs] = useState(String(inicial?.observacao ?? ""));
  const [justificativa, setJustificativa] = useState("");
  const [justificaAlergia, setJustificaAlergia] = useState("");

  const momento = momentoDeHora(hora);
  const concN = numero(conc);
  const concentracao = concN && concN > 0 ? { valor: concN, unidade: uConc } : null;
  // Dose e volume andam juntos: o que foi digitado por último manda.
  const doseN = editouVolume && concentracao && numero(volume) !== null
    ? doseDoVolume(numero(volume)!, unidade, concentracao) : numero(dose);
  const volumeCalc = !editouVolume && concentracao && doseN !== null ? volumeDaDose(doseN, unidade, concentracao) : null;
  const volumeN = editouVolume ? numero(volume) : volumeCalc;
  const unidadesIncompativeis = Boolean(concentracao && doseN !== null && unidade !== "mL"
    && volumeDaDose(doseN, unidade, concentracao) === null);

  const nome = item?.nome ?? "";
  const ultima = dadas.filter((a) => a.nome.toLowerCase() === nome.toLowerCase())
    .map((a) => a.momento).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const acumuladoAntes = nome ? doseAcumulada(dadas, nome, unidade) ?? 0 : 0;
  const conferencia = useMemo(() => doseN && nome ? avaliarDose(regras, {
    medicamento: nome, via, indicacao, dose: doseN, unidade, pesoKg, idadeDias,
    acumuladoAntes, minutosDesdeUltima: ultima && momento ? minutosEntre(ultima, momento) : null,
  }) : null, [regras, nome, via, indicacao, doseN, unidade, pesoKg, idadeDias, acumuladoAntes, ultima, momento]);

  const porKg = doseN && unidade !== "mL" ? dosePorKg(doseN, pesoKg) : null;
  const administrando = situacao === "administrado";
  const precisaJustificar = administrando && conferencia?.exigeJustificativa === true;
  // Alergia: avisa sempre; para ADMINISTRAR, pede justificativa (o servidor confere de novo).
  const alergia = nome ? conferirAlergia(alergias, nome) : null;
  const ok = Boolean(nome && momento) && !unidadesIncompativeis
    && (!administrando || (doseN !== null && doseN > 0))
    && !(administrando && conferencia?.nivel === "erro")
    && (!precisaJustificar || justificativa.trim().length >= 5)
    && (!(administrando && alergia) || justificaAlergia.trim().length >= 5);

  const lista = useMemo(() => {
    const achados = buscarNoCatalogo(busca);
    if (busca.trim()) return achados;
    const fav = favoritos.map((f) => CATALOGO.find((c) => c.nome === f)).filter((c): c is ItemDoCatalogo => Boolean(c));
    return fav.length ? fav : CATALOGO;
  }, [busca, favoritos]);

  function escolher(i: ItemDoCatalogo) {
    setItem(i);
    setUnidade(i.unidade);
    if (i.anestesicoLocal) { setForma("bloqueio"); setVia("perineural"); }
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!ok || !momento) return;
    const dados: Record<string, unknown> = {
      nome, status: situacao, via, forma, unidade,
      dose: doseN ?? null,
      ...(concentracao ? { concentracao } : {}),
      ...(volumeN ? { volume_ml: Math.round(volumeN * 1000) / 1000 } : {}),
      ...(apresentacao.trim() ? { apresentacao: apresentacao.trim() } : {}),
      ...(indicacao ? { indicacao } : {}),
      ...(obs.trim() ? { observacao: obs.trim() } : {}),
      ...(precisaJustificar ? { alerta: { justificativa: justificativa.trim() } } : {}),
      ...(alergia ? { alerta_alergia: { ...alergia, justificativa: administrando ? justificaAlergia.trim() : null } } : {}),
    };
    if (dados.dose === null) delete dados.dose;
    onConfirmar({ momento, dados });
  }

  if (!item) {
    return (
      <Janela titulo="Medicamento" largura="media" onFechar={onFechar}>
        <div className="evoForm">
          <label className="evoCampo"><span>Buscar por princípio ativo ou nome comercial</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
              placeholder="Ex.: fentanil, Dormonid, rocurônio" />
          </label>
          <p className={`evoAlergiaSituacao${alergias.nega_alergia !== true && String(alergias.alergias ?? "").trim() ? " tem" : ""}`}>
            {situacaoDaAlergia(alergias)}
          </p>
          {!busca.trim() && favoritos.length > 0 && <p className="evoNota">Os que você mais usa:</p>}
          <ul className="evoCatalogo">
            {lista.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => escolher(i)}>
                  <strong>{i.nome}</strong>
                  <span>{CATEGORIAS[i.categoria]}{i.sinonimos.length ? ` · ${i.sinonimos.join(", ")}` : ""}</span>
                  {conferirAlergia(alergias, i.nome) && <em className="evoAlergiaTag">Alergia registrada</em>}
                </button>
              </li>
            ))}
            {busca.trim() && (
              <li>
                <button type="button" onClick={() => setItem({ nome: busca.trim(), unidade: "mg" })}>
                  <strong>Usar “{busca.trim()}”</strong>
                  <span>Medicamento fora da lista</span>
                  {conferirAlergia(alergias, busca.trim()) && <em className="evoAlergiaTag">Alergia registrada</em>}
                </button>
              </li>
            )}
          </ul>
        </div>
      </Janela>
    );
  }

  return (
    <Janela titulo={nome} subtitulo={inicial ? "Registrar a administração do que estava planejado." : undefined}
      largura="larga" onFechar={onFechar}
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={inicial ? onFechar : () => setItem(null)}>
          {inicial ? "Cancelar" : "Trocar medicamento"}
        </button>
        <button type="submit" form="evoFormMed" className={`evoBotao${conferencia?.nivel === "vermelho" && administrando ? " perigo" : ""}`} disabled={!ok}>
          {administrando ? "Registrar como administrado" : `Registrar como ${situacao}`}
        </button>
      </>}>
      <form id="evoFormMed" className="evoForm" onSubmit={confirmar}>
        {alergia ? (
          <section className="evoAlergia" role="alert">
            <b>Possível alergia</b>
            <p>
              O paciente tem alergia registrada a “{alergia.alergias}”, e {nome} coincide com “{alergia.termo}”.
              A conferência compara nomes; não avalia reação cruzada entre classes.
            </p>
            {administrando && (
              <label className="evoCampo"><span>Justificativa para administrar mesmo assim (fica registrada)</span>
                <textarea value={justificaAlergia} onChange={(e) => setJustificaAlergia(e.target.value)} rows={2} maxLength={500} />
              </label>
            )}
          </section>
        ) : <p className="evoAlergiaSituacao">{situacaoDaAlergia(alergias)}</p>}
        <Escolha rotulo="Situação" valor={situacao as "administrado"} opcoes={[...SITUACOES]} onMudar={setSituacao} />
        <div className="evoLinhaCampos">
          <CampoHora valor={hora} onMudar={setHora} />
          <label className="evoCampo"><span>Apresentação (opcional)</span>
            <input value={apresentacao} onChange={(e) => setApresentacao(e.target.value)} placeholder="Ex.: ampola 10 mL" />
          </label>
        </div>
        <div className="evoLinhaCampos">
          <CampoNumero rotulo="Concentração" valor={conc} onMudar={setConc} />
          <label className="evoCampo evoUnidade"><span>Unidade</span>
            <select value={uConc} onChange={(e) => setUConc(e.target.value as UnidadeDeConcentracao)}>
              {UNIDADES_CONC.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <CampoNumero rotulo="Dose" valor={editouVolume && doseN !== null ? String(doseN) : dose}
            onMudar={(t) => { setDose(t); setEditouVolume(false); }} autoFocus />
          <label className="evoCampo evoUnidade"><span>Unidade</span>
            <select value={unidade} onChange={(e) => setUnidade(e.target.value as UnidadeDeDose)}>
              {UNIDADES_DOSE.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
          <CampoNumero rotulo="Volume" unidade="mL"
            valor={editouVolume ? volume : volumeCalc !== null ? String(volumeCalc).replace(".", ",") : volume}
            onMudar={(t) => { setVolume(t); setEditouVolume(true); }} />
        </div>
        {unidadesIncompativeis && (
          <p className="evoErro" role="alert">A dose em {unidade} não se converte com a concentração em {uConc}.</p>
        )}
        <Escolha rotulo="Via" valor={via as "EV"} opcoes={[...VIAS]} onMudar={setVia} />
        <Escolha rotulo="Forma" valor={forma as "bolus"} opcoes={[...FORMAS]} onMudar={setForma} />
        <label className="evoCampo"><span>Indicação</span>
          <select value={indicacao} onChange={(e) => setIndicacao(e.target.value)}>
            <option value="">Não informada</option>
            {INDICACOES.map((i) => <option key={i}>{i}</option>)}
          </select>
        </label>

        {(doseN || nome) && (
          <section className={`evoConferencia ${conferencia?.nivel ?? "indisponivel"}`} aria-live="polite">
            <header>
              <b>{conferencia ? NIVEL[conferencia.nivel] : "Informe a dose"}</b>
              {porKg !== null && <span>{porKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unidade}/kg</span>}
              {pesoKg === null && <span>Sem peso na folha</span>}
            </header>
            {conferencia?.motivos.map((m) => <p key={m}>{m}</p>)}
            {doseN !== null && acumuladoAntes > 0 && (
              <p>Acumulado com esta dose: {(acumuladoAntes + doseN).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {unidade}.</p>
            )}
            {precisaJustificar && (
              <label className="evoCampo"><span>Justificativa clínica (fica registrada com a dose)</span>
                <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2} maxLength={500} />
              </label>
            )}
          </section>
        )}

        <label className="evoCampo"><span>Observação</span>
          <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} />
        </label>
      </form>
    </Janela>
  );
}
