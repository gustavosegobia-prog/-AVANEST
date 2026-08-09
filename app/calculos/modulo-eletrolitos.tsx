"use client";

import { useMemo, useState } from "react";
import estilos from "./calculos.module.css";
import { Campo, Eletrolitos as PainelValores, numero, type Compartilhado } from "./modulos-extras";
import {
  ALTO_RISCO_K,
  ANTES_DE_CALCULAR,
  AVISO_MODULO,
  CA_MG_P,
  citar,
  conferirInfusaoK,
  conferirVariacao24h,
  CONDUTA_K,
  CONFERENCIA_HIPERCALEMIA,
  deficitAsh,
  deficitPorAlvo,
  deficitPotassio,
  DISCREPANCIA_ACT,
  FONTE_HIPERCALEMIA,
  HIPERCALEMIA,
  K_REFERENCIA_PADRAO,
  KCL_191,
  LIMIARES,
  LIMITES_HIPERNATREMIA,
  LIMITES_HIPONATREMIA,
  LIMITES_K,
  SEM_DEFICIT_AGUA_LIVRE,
  SOLUCOES,
  TRAVAS,
  variacaoSodio,
  virgula,
  type Acesso,
  type FaixaEtaria,
} from "@/lib/calculos/eletrolitos-correcoes";

/**
 * Eletrólitos. O painel de valores continua sendo a porta de entrada; as
 * correções entram como abas ao lado, porque quem abre para conferir um
 * potássio não deveria ter de rolar uma calculadora de sódio pelo caminho.
 *
 * Nenhuma aba propõe reposição. Todas calculam o que a pessoa pediu, rotulam
 * como estimativa e comparam com os limites que a fonte publicou.
 */

type Aba = "valores" | "sodio" | "potassio" | "hipercalemia" | "bicarbonato" | "camgp";

const ABAS: Array<{ id: Aba; nome: string }> = [
  { id: "valores", nome: "Valores" },
  { id: "sodio", nome: "Sódio" },
  { id: "potassio", nome: "Potássio" },
  { id: "hipercalemia", nome: "Hipercalemia" },
  { id: "bicarbonato", nome: "Bicarbonato" },
  { id: "camgp", nome: "Ca, Mg e P" },
];

export function Eletrolitos({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [aba, setAba] = useState<Aba>("valores");

  return (
    <>
      <h1 className={estilos.titulo}>Eletrólitos</h1>
      <p className={estilos.subtitulo}>
        Valores e classificação, e as correções que as fontes sustentam. Cada número
        traz a página de onde veio; o que a fonte não define fica em branco.
      </p>
      <p className={estilos.confira}>{AVISO_MODULO}</p>

      <nav className={estilos.barraInterna} aria-label="Eletrólitos">
        {ABAS.map((a) => (
          <button key={a.id} type="button"
            className={aba === a.id ? `${estilos.aba} ${estilos.abaAtiva}` : estilos.aba}
            aria-current={aba === a.id ? "page" : undefined}
            onClick={() => setAba(a.id)}>{a.nome}</button>
        ))}
      </nav>

      {aba === "valores" && <PainelValores dados={dados} set={set} semTitulo />}
      {aba === "sodio" && <Sodio dados={dados} set={set} />}
      {aba === "potassio" && <Potassio dados={dados} set={set} />}
      {aba === "hipercalemia" && <Hipercalemia />}
      {aba === "bicarbonato" && <Bicarbonato dados={dados} set={set} />}
      {aba === "camgp" && <CaMgP />}

      <Antes />
    </>
  );
}

function Antes() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={estilos.verMais} onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar o que conferir antes" : "O que conferir antes de calcular"}
      </button>
      {aberto && (
        <div className={estilos.correcao}>
          <strong>Antes de calcular</strong>
          <ul className={estilos.lista}>{ANTES_DE_CALCULAR.map((t) => <li key={t}>{t}</li>)}</ul>
          <strong>Travas do módulo</strong>
          <ul className={estilos.lista}>{TRAVAS.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </>
  );
}

const Limiar = ({ chave }: { chave: keyof typeof LIMIARES }) => {
  const l = LIMIARES[chave];
  return (
    <div className={`${estilos.bloco} ${estilos.blocoFonte}`}>
      <p>{l.texto}</p>
      <p className={estilos.fonte}>{citar(l.fonte)}</p>
    </div>
  );
};

/* ------------------------------------------------------------------ */

function Sodio({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [solucaoId, setSolucaoId] = useState("nacl3");
  const [faixa, setFaixa] = useState<FaixaEtaria>("jovem");
  const [naOutra, setNaOutra] = useState("");

  const solucao = SOLUCOES.find((s) => s.id === solucaoId)!;
  const naSolucao = solucaoId === "outra" ? numero(naOutra) : solucao.sodio;

  const r = useMemo(() => variacaoSodio({
    naSerico: numero(dados.sodio ?? ""),
    naSolucao,
    pesoKg: numero(dados.peso ?? ""),
    faixaEtaria: faixa,
    volumeMl: numero(dados.volumePlanejado ?? ""),
  }), [dados.sodio, dados.peso, dados.volumePlanejado, naSolucao, faixa]);

  const acumulada = conferirVariacao24h(numero(dados.variacao24h ?? ""));
  const naAtual = numero(dados.sodio ?? "");
  const hipo = naAtual !== undefined && naAtual < LIMIARES.hiponatremia.valor;
  const hiper = naAtual !== undefined && naAtual > LIMIARES.hipernatremia.valor;

  return (
    <>
      <section className={estilos.correcao}>
        <strong>Variação prevista por solução</strong>
        <div className={estilos.grade}>
          <Campo chave="sodio" rotulo="Sódio sérico (mmol/L)" valor={dados.sodio ?? ""} aoMudar={set} />
          <Campo chave="peso" rotulo="Peso (kg)" passo="0.1" valor={dados.peso ?? ""} aoMudar={set} />
          <label className={estilos.campo}>
            <span>Água corporal</span>
            <select className={estilos.seletor} value={faixa} onChange={(e) => setFaixa(e.target.value as FaixaEtaria)}>
              <option value="jovem">Jovem (0,6 × peso)</option>
              <option value="idoso">Idoso (0,5 × peso)</option>
            </select>
          </label>
          <label className={estilos.campo}>
            <span>Solução</span>
            <select className={estilos.seletor} value={solucaoId} onChange={(e) => setSolucaoId(e.target.value)}>
              {SOLUCOES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
          {solucaoId === "outra" && (
            <label className={estilos.campo}>
              <span>Sódio da solução (mmol/L)</span>
              <input type="number" inputMode="decimal" value={naOutra} onChange={(e) => setNaOutra(e.target.value)} />
            </label>
          )}
          <Campo chave="volumePlanejado" rotulo="Volume planejado (mL)" valor={dados.volumePlanejado ?? ""} aoMudar={set} />
        </div>

        {solucaoId === "outra" && (
          <p className={estilos.dica}>
            O capítulo cita salina 0,2% e 0,45% sem declarar o sódio delas. O AVANEST não
            preenche esse número por conta própria — confira o rótulo e digite.
          </p>
        )}

        {r ? (
          <>
            <div className={estilos.linha}>
              <span>Água corporal total</span><b>{virgula(r.act)} L</b>
              <span>ΔNa por 1 L</span><b>{virgula(r.deltaPorLitro)} mmol/L</b>
              {r.deltaNoVolume !== undefined && (
                <><span>ΔNa em {virgula(r.volumeL! * 1000)} mL</span><b>{virgula(r.deltaNoVolume)} mmol/L</b></>
              )}
            </div>
            <p className={estilos.confira}>{r.aviso}</p>
            <p className={estilos.aviso}><b>Fórmula:</b> {r.formula}</p>
            <p className={estilos.aviso}>{DISCREPANCIA_ACT}</p>
          </>
        ) : (
          <p className={estilos.dica}>Informe sódio sérico, peso e o sódio da solução.</p>
        )}
      </section>

      <section className={estilos.correcao}>
        <strong>Variação já acumulada</strong>
        <div className={estilos.gradeCurta}>
          <Campo chave="variacao24h" rotulo="ΔNa nas últimas 24 h (mmol/L)" passo="0.1"
            valor={dados.variacao24h ?? ""} aoMudar={set} />
        </div>
        {acumulada
          ? <p className={estilos.confira}>{acumulada}</p>
          : <p className={estilos.dica}>O alerta é pela variação acumulada, não pela dose isolada.</p>}
      </section>

      {hipo && <Limiar chave={naAtual! < LIMIARES.hiponatremiaSintomas.valor ? "hiponatremiaSintomas" : "hiponatremia"} />}
      {hiper && <Limiar chave="hipernatremia" />}

      <section className={estilos.correcao}>
        <strong>Limites e monitorização</strong>
        {(hiper ? LIMITES_HIPERNATREMIA : LIMITES_HIPONATREMIA).map((l) => (
          <div key={l.rotulo} className={estilos.bloco}>
            <strong>{l.rotulo}</strong>
            <p>{l.texto}</p>
            <p className={estilos.fonte}>{citar(l.fonte)}</p>
          </div>
        ))}
        <p className={estilos.aviso}>{SEM_DEFICIT_AGUA_LIVRE}</p>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Potassio({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [acesso, setAcesso] = useState<Acesso>("periferico");
  const [infusao, setInfusao] = useState<Record<string, string>>({});
  const escrever = (c: string, v: string) => setInfusao((x) => ({ ...x, [c]: v }));

  const kAtual = numero(dados.potassio ?? "");
  const deficit = useMemo(() => deficitPotassio(kAtual), [kAtual]);
  const conferencia = useMemo(() => conferirInfusaoK({
    mEq: numero(infusao.mEq ?? ""),
    volumeMl: numero(infusao.volume ?? ""),
    horas: numero(infusao.horas ?? ""),
    acesso,
  }), [infusao, acesso]);

  return (
    <>
      <section className={estilos.correcao}>
        <strong>Déficit aproximado</strong>
        <div className={estilos.gradeCurta}>
          <Campo chave="potassio" rotulo="Potássio atual (mmol/L)" passo="0.1" valor={dados.potassio ?? ""} aoMudar={set} />
        </div>
        {deficit ? (
          <>
            <div className={estilos.linha}>
              <span>Diferença para {virgula(K_REFERENCIA_PADRAO)} mmol/L</span><b>{virgula(deficit.diferenca)} mEq/L</b>
              <span>Déficit corporal aproximado</span><b>{deficit.deficitAproximado} mEq</b>
            </div>
            <p className={estilos.confira}>{deficit.aviso}</p>
            <p className={estilos.aviso}><b>Regra:</b> {deficit.formula}</p>
          </>
        ) : (
          <p className={estilos.dica}>
            {kAtual === undefined ? "Informe o potássio." : "Potássio na referência ou acima: sem déficit a estimar."}
          </p>
        )}
        {kAtual !== undefined && kAtual < LIMIARES.hipocalemiaTratar.valor && <Limiar chave="hipocalemiaTratar" />}
      </section>

      <section className={estilos.correcao}>
        <strong>Conferir uma infusão montada</strong>
        <p className={estilos.dica}>
          Digite o esquema que você preparou. O módulo devolve concentração e velocidade
          e compara com os limites da tabela — não propõe o esquema.
        </p>
        <div className={estilos.grade}>
          <Campo chave="mEq" rotulo="Potássio (mEq)" valor={infusao.mEq ?? ""} aoMudar={escrever} />
          <Campo chave="volume" rotulo="Volume final (mL)" valor={infusao.volume ?? ""} aoMudar={escrever} />
          <Campo chave="horas" rotulo="Tempo (h)" passo="0.5" valor={infusao.horas ?? ""} aoMudar={escrever} />
          <label className={estilos.campo}>
            <span>Acesso</span>
            <select className={estilos.seletor} value={acesso} onChange={(e) => setAcesso(e.target.value as Acesso)}>
              <option value="periferico">Periférico</option>
              <option value="central">Central</option>
            </select>
          </label>
        </div>

        {conferencia ? (
          <>
            <div className={estilos.linha}>
              <span>Concentração</span><b>{virgula(conferencia.concentracao)} mEq/L</b>
              <span>Velocidade</span><b>{virgula(conferencia.velocidade)} mEq/h</b>
              <span>{KCL_191.rotulo}</span><b>{virgula(conferencia.volumeKclMl)} mL</b>
            </div>
            {conferencia.alertas.length > 0
              ? conferencia.alertas.map((a) => <p key={a} className={estilos.confira}>{a}</p>)
              : <p className={estilos.veredito}>Dentro dos limites descritos para este acesso.</p>}
            <p className={estilos.aviso}>{LIMITES_K[acesso].nota}</p>
            <p className={estilos.aviso}>{KCL_191.nota}</p>
            <p className={estilos.fonte}>{citar(conferencia.fonte)}</p>
          </>
        ) : (
          <p className={estilos.dica}>Informe potássio, volume final e tempo.</p>
        )}
      </section>

      <section className={estilos.correcao}>
        <strong>Conduta descrita pela fonte</strong>
        {CONDUTA_K.map((c) => (
          <div key={c.condicao} className={estilos.bloco}>
            <strong>{c.condicao}</strong>
            <p>{c.via}</p>
            <p className={estilos.aviso}>{c.limite}</p>
          </div>
        ))}
        <p className={estilos.confira}>{ALTO_RISCO_K}</p>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Hipercalemia() {
  return (
    <section className={estilos.correcao}>
      <strong>Estabilizar, deslocar, remover</strong>
      <p className={estilos.dica}>
        Confirme ou pesquise pseudo-hipercalemia sem atrasar o tratamento quando houver
        instabilidade ou alteração do ECG.
      </p>
      {HIPERCALEMIA.map((e) => (
        <div key={e.etapa + e.conduta} className={estilos.bloco}>
          <strong>{e.etapa}</strong>
          <p>{e.conduta}</p>
          <p className={estilos.aviso}>{e.observacao}</p>
        </div>
      ))}
      <p className={estilos.fonte}>{citar(FONTE_HIPERCALEMIA)}</p>
      <p className={estilos.confira}>{CONFERENCIA_HIPERCALEMIA}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Bicarbonato({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const peso = numero(dados.peso ?? "");
  const ash = useMemo(() => deficitAsh(peso, numero(dados.be ?? "")), [peso, dados.be]);
  const alvo = useMemo(
    () => deficitPorAlvo(peso, numero(dados.hco3 ?? ""), numero(dados.hco3Desejado ?? "")),
    [peso, dados.hco3, dados.hco3Desejado],
  );

  return (
    <>
      <section className={estilos.correcao}>
        <strong>Déficit de bicarbonato</strong>
        <div className={estilos.grade}>
          <Campo chave="peso" rotulo="Peso (kg)" passo="0.1" valor={dados.peso ?? ""} aoMudar={set} />
          <Campo chave="be" rotulo="BE (mEq/L)" passo="0.1" valor={dados.be ?? ""} aoMudar={set} />
          <Campo chave="hco3" rotulo="HCO3 atual (mEq/L)" passo="0.1" valor={dados.hco3 ?? ""} aoMudar={set} />
          <Campo chave="hco3Desejado" rotulo="HCO3 desejado (mEq/L)" passo="0.1" valor={dados.hco3Desejado ?? ""} aoMudar={set} />
        </div>

        {[["Fórmula de Ash", ash], ["Por alvo de HCO3", alvo]].map(([titulo, r]) =>
          r ? (
            <div key={titulo as string} className={estilos.bloco}>
              <strong>{titulo as string}</strong>
              <div className={estilos.linha}>
                <span>Déficit estimado</span><b>{virgula((r as { deficit: number }).deficit)} mEq</b>
                <span>Metade</span><b>{virgula((r as { metade: number }).metade)} mEq</b>
              </div>
              <p className={estilos.aviso}><b>Fórmula:</b> {(r as { formula: string }).formula}</p>
              <p className={estilos.confira}>{(r as { aviso: string }).aviso}</p>
            </div>
          ) : null,
        )}

        {!ash && !alvo && (
          <p className={estilos.dica}>
            Informe peso e BE negativo, ou peso com HCO3 atual e desejado.
          </p>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function CaMgP() {
  return (
    <section className={estilos.correcao}>
      <strong>Cálcio, magnésio e fósforo</strong>
      <p className={estilos.confira}>
        Os trechos localizados não oferecem protocolo adulto geral para esses eletrólitos.
        Esta aba dá alerta e contexto: dose e velocidade ficam bloqueadas até haver
        fonte validada e protocolo do serviço.
      </p>
      {CA_MG_P.map((d) => (
        <div key={d.disturbio} className={estilos.bloco}>
          <strong>{d.disturbio}</strong>
          <p>{d.sustentado}</p>
          <p className={estilos.aviso}>{d.conduta}</p>
          <p className={estilos.fonte}>{citar(d.fonte)}</p>
        </div>
      ))}
    </section>
  );
}
