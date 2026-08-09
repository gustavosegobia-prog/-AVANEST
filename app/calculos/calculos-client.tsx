"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import estilos from "./calculos.module.css";
import {
  indicadores,
  interpretar,
  REFERENCIAS,
  type Gasometria,
  type Interpretacao,
} from "@/lib/calculos/gasometria";
import {
  AVISO_CORRECOES,
  AVISO_ORIENTACOES,
  deficitBicarbonato,
  frequenciaParaAlvo,
  orientacoes,
  ventilacaoParaAlvo,
} from "@/lib/calculos/gasometria-orientacoes";
import { AVISO_LEITURA, lerGasometria } from "@/lib/calculos/gasometria-leitura";
import { Fick, GapOsmolar, type Compartilhado } from "./modulos-extras";
import { Eletrolitos } from "./modulo-eletrolitos";
import { Pca } from "./modulo-pca";
import { Rotem } from "./modulo-rotem";
import {
  AVISO_CLINICO,
  profundidadeOral,
  sugerirTubo,
  type Paciente,
} from "@/lib/calculos/via-aerea-pediatrica";

// A interface não faz conta nenhuma: tudo vem de lib/calculos. Aqui só entra
// o que a pessoa digitou e sai o que aquelas funções devolveram — é o que
// permite corrigir uma fórmula sem mexer em tela, e o contrário também.

// Ponto de extensão da aba: um módulo novo é uma entrada em MODULOS e um
// componente próprio. "teg", "rotem", "doses" entram assim, sem tocar nos que
// já existem.
type Modulo = "hub" | "gasometria" | "tubo" | "eletrolitos" | "osmolar" | "fick" | "pca" | "rotem";

const MODULOS: Array<{ id: Exclude<Modulo, "hub">; icone: string; nome: string; descricao: string }> = [
  { id: "gasometria", icone: "🩸", nome: "Gasometria", descricao: "Foto ou digitação, interpretação ácido-base e orientações." },
  { id: "tubo", icone: "👶", nome: "Tubo pediátrico", descricao: "Tamanho do tubo, opção acima e abaixo, e profundidade." },
  { id: "eletrolitos", icone: "⚡", nome: "Eletrólitos", descricao: "Valores, correção de sódio e potássio, hipercalemia e bicarbonato." },
  { id: "osmolar", icone: "💧", nome: "Gap osmolar", descricao: "Osmolalidade calculada, com divisor certo para ureia ou BUN." },
  { id: "fick", icone: "❤️", nome: "Débito cardíaco", descricao: "Fick, com CaO2, CvO2, débito e índice cardíaco." },
  { id: "pca", icone: "💉", nome: "PCA", descricao: "Confere a programação da bomba contra as faixas do SAESP e do Miller." },
  { id: "rotem", icone: "🩹", nome: "ROTEM", descricao: "Leitura cruzada entre os ensaios, com o fenótipo e as verificações que ele exige." },
];

const CAMPOS_GASO: Array<{ chave: keyof Gasometria; rotulo: string; passo?: string }> = [
  { chave: "ph", rotulo: "pH", passo: "0.01" },
  { chave: "paco2", rotulo: "PaCO2 (mmHg)" },
  { chave: "pao2", rotulo: "PaO2 (mmHg)" },
  { chave: "hco3", rotulo: "HCO3 (mEq/L)", passo: "0.1" },
  { chave: "be", rotulo: "BE (mEq/L)", passo: "0.1" },
  { chave: "na", rotulo: "Na (mEq/L)" },
  { chave: "k", rotulo: "K (mEq/L)", passo: "0.1" },
  { chave: "cl", rotulo: "Cl (mEq/L)" },
  { chave: "lactato", rotulo: "Lactato (mmol/L)", passo: "0.1" },
  { chave: "fio2", rotulo: "FiO2 (% ou fração)", passo: "0.01" },
  { chave: "sao2", rotulo: "SaO2 (%)" },
  { chave: "albumina", rotulo: "Albumina (g/dL)", passo: "0.1" },
];

const numero = (texto: string): number | undefined => {
  const limpo = texto.replace(",", ".").trim();
  if (!limpo) return undefined;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : undefined;
};

export function CalculosClient() {
  const [modulo, setModulo] = useState<Modulo>("hub");
  /**
   * Peso, sódio, hemoglobina e companhia valem para mais de uma calculadora.
   * Ficam aqui em cima e descem por props, então o que foi digitado numa
   * aparece já preenchido na outra — sempre à vista e editável, nunca aplicado
   * às escondidas. Nada disto vai para o prontuário.
   */
  const [dados, setDados] = useState<Compartilhado>({});
  const set = (chave: string, valor: string) => setDados((d) => ({ ...d, [chave]: valor }));

  return (
    <main className={estilos.tela}>
      <header className={estilos.topo}>
        <Link className={estilos.marca} href="/dashboard">
          <BrandMark className={estilos.marcaIcone} />
          <span><strong>AVANEST</strong><small>Cálculos extras</small></span>
        </Link>
        {/* O botão nunca some: do módulo ele volta ao hub, e do hub volta ao
            painel. Antes, quem chegasse ao hub só saía clicando na marca — e
            ninguém adivinha que a marca é um link. */}
        {modulo === "hub" ? (
          <Link className={estilos.voltar} href="/dashboard">← Voltar ao painel</Link>
        ) : (
          <button type="button" className={estilos.voltar} onClick={() => setModulo("hub")}>
            ← Cálculos extras
          </button>
        )}
      </header>

      {/* Barra de troca rápida: no celular ela rola na horizontal, que é como
          se troca de calculadora sem voltar ao hub. */}
      {modulo !== "hub" && (
        <nav className={estilos.barra} aria-label="Calculadoras">
          {MODULOS.map((m) => (
            <button key={m.id} type="button"
              className={modulo === m.id ? `${estilos.aba} ${estilos.abaAtiva}` : estilos.aba}
              aria-current={modulo === m.id ? "page" : undefined}
              onClick={() => setModulo(m.id)}>
              <span aria-hidden="true">{m.icone}</span> {m.nome}
            </button>
          ))}
        </nav>
      )}

      <div className={estilos.conteudo}>
        {modulo === "hub" && <Hub aoEscolher={setModulo} />}
        {modulo === "gasometria" && <Gaso dados={dados} set={set} />}
        {modulo === "tubo" && <TuboPediatrico />}
        {modulo === "eletrolitos" && <Eletrolitos dados={dados} set={set} />}
        {modulo === "osmolar" && <GapOsmolar dados={dados} set={set} />}
        {modulo === "fick" && <Fick dados={dados} set={set} />}
        {modulo === "pca" && <Pca dados={dados} set={set} />}
        {modulo === "rotem" && <Rotem />}
      </div>
    </main>
  );
}

function Hub({ aoEscolher }: { aoEscolher: (m: Modulo) => void }) {
  return (
    <>
      <h1 className={estilos.titulo}>Cálculos extras</h1>
      <p className={estilos.subtitulo}>
        Ferramentas de apoio rápido. Nada aqui altera a avaliação do paciente.
      </p>
      <div className={estilos.cards}>
        {MODULOS.map((m) => (
          <button key={m.id} type="button" className={estilos.card} onClick={() => aoEscolher(m.id)}>
            <strong><span aria-hidden="true">{m.icone}</span> {m.nome}</strong>
            <span>{m.descricao}</span>
          </button>
        ))}
      </div>
    </>
  );
}

const COMPARTILHADOS_GASO: Record<string, string> = {
  na: "sodio", k: "potassio", cl: "cloro", pao2: "pao2", sao2: "sao2", albumina: "albumina",
};

function Gaso({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  // Os campos que outras calculadoras também usam vivem no estado compartilhado;
  // os que só existem aqui ficam locais.
  const [local, setLocal] = useState<Record<string, string>>({});
  const bruto: Record<string, string> = { ...local };
  for (const [aqui, la] of Object.entries(COMPARTILHADOS_GASO)) bruto[aqui] = dados[la] ?? local[aqui] ?? "";
  const setBrutoCampo = (chave: string, valor: string) => {
    const compartilhado = COMPARTILHADOS_GASO[chave];
    if (compartilhado) set(compartilhado, valor);
    else setLocal((b) => ({ ...b, [chave]: valor }));
  };
  const [resultado, setResultado] = useState<Interpretacao | null>(null);
  const [completa, setCompleta] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [avisoFoto, setAvisoFoto] = useState("");
  const [erroFoto, setErroFoto] = useState("");

  /**
   * A imagem é lida no próprio aparelho e descartada ao fim: nada é enviado
   * para servidor nenhum, e nada fica guardado. O motor de reconhecimento
   * entra por import dinâmico — se ele não carregar, a tela continua servindo
   * para digitar, em vez de quebrar inteira.
   */
  async function lerFoto(arquivo?: File) {
    if (!arquivo) return;
    setLendo(true); setErroFoto(""); setAvisoFoto(""); setResultado(null);
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(arquivo, "por");
      const { valores, descartados } = lerGasometria(data.text);

      const preenchidos = Object.entries(valores);
      if (!preenchidos.length) {
        setErroFoto("Não reconheci nenhum valor nesta imagem. Tente uma foto mais próxima e sem reflexo, ou digite os valores.");
        return;
      }
      for (const [k, val] of preenchidos) setBrutoCampo(k, String(val));
      setAvisoFoto(
        descartados.length
          ? `${AVISO_LEITURA} Não usei o que li em: ${descartados.join(", ")} — valor fora do plausível.`
          : AVISO_LEITURA,
      );
    } catch {
      setErroFoto("Não consegui carregar o leitor de imagem. Digite os valores.");
    } finally {
      setLendo(false);
    }
  }

  const valores = useMemo<Gasometria>(() => {
    const g: Gasometria = {};
    for (const { chave } of CAMPOS_GASO) {
      const valor = numero(bruto[chave] ?? "");
      if (valor !== undefined) g[chave] = valor;
    }
    return g;
  }, [bruto]);

  const podeCalcular = valores.ph !== undefined;

  return (
    <>
      <h1 className={estilos.titulo}>Gasometria</h1>
      <p className={estilos.subtitulo}>
        Preencha o que tiver. O que não for informado apenas deixa de fora os cálculos que dependem dele.
      </p>

      <div className={estilos.acoes}>
        <label className={estilos.foto}>
          {lendo ? "Lendo a imagem..." : "Fotografar gasometria"}
          <input type="file" accept="image/*" capture="environment" disabled={lendo}
            onChange={(e) => { lerFoto(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <span className={estilos.dica}>A foto é lida no próprio aparelho e não fica guardada.</span>
      </div>
      {avisoFoto && <p className={estilos.confira} role="status">{avisoFoto}</p>}
      {erroFoto && <p className={estilos.dica} role="alert">{erroFoto}</p>}

      <div className={estilos.grade}>
        {CAMPOS_GASO.map(({ chave, rotulo, passo }) => (
          <label key={chave} className={estilos.campo}>
            <span>{rotulo}</span>
            <input
              type="number"
              inputMode="decimal"
              step={passo ?? "1"}
              value={bruto[chave] ?? ""}
              onChange={(e) => { setBrutoCampo(chave, e.target.value); setResultado(null); }}
            />
          </label>
        ))}
      </div>

      <div className={estilos.acoes}>
        <button
          type="button"
          className={estilos.primario}
          disabled={!podeCalcular}
          onClick={() => { setResultado(interpretar(valores)); setCompleta(false); setAvisoFoto(""); }}
        >
          {avisoFoto ? "Confirmar dados e calcular" : "Calcular"}
        </button>
        <button type="button" className={estilos.secundario} onClick={() => { setLocal({}); setResultado(null); setAvisoFoto(""); setErroFoto(""); }}>
          Limpar
        </button>
        {!podeCalcular && <span className={estilos.dica}>Informe ao menos o pH.</span>}
      </div>

      {resultado && <ResultadoGaso r={{ ...resultado, indicadores: indicadores(valores, resultado) }} completa={completa} alternar={() => setCompleta((v) => !v)} />}
      {resultado && <Orientacoes blocos={orientacoes(valores, resultado, REFERENCIAS)} />}
      {resultado && <Correcoes g={valores} />}
    </>
  );
}

function ResultadoGaso({ r, completa, alternar }: { r: Interpretacao & { indicadores: ReturnType<typeof indicadores> }; completa: boolean; alternar: () => void }) {
  return (
    <section className={estilos.resultado} aria-live="polite">
      <h2 className={estilos.resultadoTitulo}>Interpretação</h2>
      {r.indicadores.length > 0 && (
        <div className={estilos.indicadores}>
          {r.indicadores.map((i) => (
            <span key={i.rotulo} className={`${estilos.indicador} ${estilos[i.estado]}`}>
              <small>{i.rotulo}</small><b>{i.valor}</b>
            </span>
          ))}
        </div>
      )}
      <p className={estilos.disturbio}>
        {r.disturbio.charAt(0).toUpperCase() + r.disturbio.slice(1)}
        {r.misto && <em className={estilos.selo}>distúrbio misto</em>}
      </p>

      {r.compensacao && (
        <div className={estilos.linha}>
          <span>PaCO2 medida</span><b>{r.compensacao.medida} mmHg</b>
          <span>PaCO2 esperada</span>
          <b>{r.compensacao.esperada.min}–{r.compensacao.esperada.max} mmHg</b>
          <span>Diferença</span>
          <b>{r.compensacao.diferenca > 0 ? "+" : ""}{r.compensacao.diferenca} mmHg</b>
        </div>
      )}
      {r.compensacao && <p className={estilos.veredito}>{r.compensacao.texto}</p>}

      {r.respiratorio && (
        <>
          <div className={estilos.linha}>
            <span>HCO3 medido</span><b>{r.respiratorio.medido} mEq/L</b>
            <span>Esperado se agudo</span><b>{r.respiratorio.hipotese.agudo} mEq/L</b>
            <span>Esperado se crônico</span><b>{r.respiratorio.hipotese.cronico} mEq/L</b>
          </div>
          <p className={estilos.veredito}>
            Padrão mais compatível: <b>{r.respiratorio.hipotese.compativel}</b>
            {r.respiratorio.alertaMetabolico && " — HCO3 fora dos dois cenários, considerar distúrbio metabólico associado"}
          </p>
        </>
      )}

      <div className={estilos.numeros}>
        {r.anionGap !== undefined && <Numero rotulo="Ânion gap" valor={`${r.anionGap} mEq/L`} />}
        {r.anionGapCorrigido !== undefined && <Numero rotulo="AG corrigido" valor={`${r.anionGapCorrigido} mEq/L`} />}
        {r.deltaRatio && <Numero rotulo="Delta ratio" valor={String(r.deltaRatio.valor)} />}
        {r.relacaoPF !== undefined && <Numero rotulo="P/F" valor={String(r.relacaoPF)} />}
        {r.gradienteAa && <Numero rotulo="Gradiente A-a" valor={`${r.gradienteAa.gradiente} mmHg`} />}
        {r.lactato && (
          <Numero
            rotulo="Lactato"
            valor={`${r.lactato.valor} mmol/L`}
            alerta={r.lactato.acimaDoNormal}
          />
        )}
      </div>

      {r.deltaRatio && <p className={estilos.veredito}>{r.deltaRatio.texto}</p>}

      <button type="button" className={estilos.verMais} onClick={alternar}>
        {completa ? "Ocultar análise completa" : "Ver análise completa"}
      </button>

      {completa && (
        <div className={estilos.completa}>
          {r.gradienteAa && <p>PAO2 calculada: <b>{r.gradienteAa.pao2Alveolar} mmHg</b> (Patm {REFERENCIAS.gradiente.patm} mmHg, R {REFERENCIAS.gradiente.r}).</p>}
          {r.faltando.length > 0 && <p>Para completar a análise, faltou: <b>{r.faltando.join(", ")}</b>.</p>}
          <p className={estilos.aviso}>
            Interpretação de apoio. Não substitui a avaliação clínica, e nenhum ajuste de ventilador é
            sugerido automaticamente — a diferença entre a PaCO2 medida e a esperada está acima para
            orientar a decisão, que continua sendo do médico.
          </p>
        </div>
      )}
    </section>
  );
}

function Orientacoes({ blocos }: { blocos: ReturnType<typeof orientacoes> }) {
  if (!blocos.length) return null;
  return (
    <section className={estilos.resultado}>
      <h2 className={estilos.resultadoTitulo}>Orientações</h2>
      {blocos.map((bloco) => (
        <div key={bloco.titulo} className={bloco.tom === "critico" ? `${estilos.bloco} ${estilos.blocoCritico}` : estilos.bloco}>
          <strong>{bloco.titulo}</strong>
          <ul>{bloco.itens.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ))}
      <p className={estilos.aviso}>{AVISO_ORIENTACOES}</p>
    </section>
  );
}

// O alvo é sempre digitado aqui. Nenhum campo vem preenchido com um valor que
// o sistema "acha" bom: escolher para onde levar o paciente é decisão clínica,
// e um campo pré-preenchido é uma sugestão disfarçada.
function Correcoes({ g }: { g: Gasometria }) {
  const [c, setC] = useState<Record<string, string>>({});
  const peso = numero(c.peso ?? "");
  const hco3Alvo = numero(c.hco3Alvo ?? "");
  const veAtual = numero(c.veAtual ?? "");
  const frAtual = numero(c.frAtual ?? "");
  const paco2Alvo = numero(c.paco2Alvo ?? "");

  const bic = peso !== undefined && hco3Alvo !== undefined && g.hco3 !== undefined
    ? deficitBicarbonato(peso, g.hco3, hco3Alvo) : undefined;
  const ve = veAtual !== undefined && paco2Alvo !== undefined && g.paco2 !== undefined
    ? ventilacaoParaAlvo(veAtual, g.paco2, paco2Alvo) : undefined;
  const fr = frAtual !== undefined && paco2Alvo !== undefined && g.paco2 !== undefined
    ? frequenciaParaAlvo(frAtual, g.paco2, paco2Alvo) : undefined;

  const campo = (chave: string, rotulo: string, passo = "1") => (
    <label className={estilos.campo}><span>{rotulo}</span>
      <input type="number" inputMode="decimal" step={passo} value={c[chave] ?? ""}
        onChange={(e) => setC((v) => ({ ...v, [chave]: e.target.value }))} /></label>
  );

  return (
    <section className={estilos.resultado}>
      <h2 className={estilos.resultadoTitulo}>Correções — você define o alvo</h2>

      {g.hco3 !== undefined && (
        <div className={estilos.correcao}>
          <strong>Déficit de bicarbonato</strong>
          <div className={estilos.gradeCurta}>
            {campo("peso", "Peso (kg)", "0.1")}
            {campo("hco3Alvo", "HCO3 alvo (mEq/L)", "0.1")}
          </div>
          {bic !== undefined && <p className={estilos.veredito}>≈ <b>{bic} mEq</b> para ir de {g.hco3} a {hco3Alvo} mEq/L</p>}
        </div>
      )}

      {g.paco2 !== undefined && (
        <div className={estilos.correcao}>
          <strong>Ventilação para uma PaCO2 alvo</strong>
          <div className={estilos.gradeCurta}>
            {campo("paco2Alvo", "PaCO2 alvo (mmHg)")}
            {campo("veAtual", "VE atual (L/min)", "0.1")}
            {campo("frAtual", "FR atual (irpm)")}
          </div>
          {ve !== undefined && <p className={estilos.veredito}>VE necessária: <b>{ve} L/min</b></p>}
          {fr !== undefined && <p className={estilos.veredito}>FR equivalente, com volume corrente mantido: <b>{fr} irpm</b></p>}
        </div>
      )}

      <p className={estilos.aviso}>{AVISO_CORRECOES}</p>
    </section>
  );
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <span className={alerta ? `${estilos.numero} ${estilos.numeroAlerta}` : estilos.numero}>
      <small>{rotulo}</small><b>{valor}</b>
    </span>
  );
}

function TuboPediatrico() {
  const [p, setP] = useState<Record<string, string>>({});

  const paciente = useMemo<Paciente>(() => ({
    idadeAnos: numero(p.anos ?? ""),
    idadeMeses: numero(p.meses ?? ""),
    pesoKg: numero(p.peso ?? ""),
  }), [p]);

  const tubo = useMemo(() => sugerirTubo(paciente), [paciente]);
  const di = tubo?.comCuff?.sugerido ?? tubo?.semCuff?.sugerido;
  const prof = useMemo(() => profundidadeOral(paciente, di), [paciente, di]);

  return (
    <>
      <h1 className={estilos.titulo}>Tubo pediátrico</h1>
      <p className={estilos.subtitulo}>
        Abaixo de 1 ano o calibre vem do peso, e não da idade — recém-nascido não segue a fórmula da criança maior.
      </p>

      <div className={estilos.gradeCurta}>
        <label className={estilos.campo}><span>Idade (anos)</span>
          <input type="number" inputMode="numeric" min="0" value={p.anos ?? ""} onChange={(e) => setP((v) => ({ ...v, anos: e.target.value }))} /></label>
        <label className={estilos.campo}><span>Idade (meses)</span>
          <input type="number" inputMode="numeric" min="0" value={p.meses ?? ""} onChange={(e) => setP((v) => ({ ...v, meses: e.target.value }))} /></label>
        <label className={estilos.campo}><span>Peso (kg)</span>
          <input type="number" inputMode="decimal" step="0.1" min="0" value={p.peso ?? ""} onChange={(e) => setP((v) => ({ ...v, peso: e.target.value }))} /></label>
      </div>

      {tubo?.aviso && <p className={estilos.dica}>{tubo.aviso}</p>}

      {tubo && !tubo.aviso && (
        <section className={estilos.resultado} aria-live="polite">
          <h2 className={estilos.resultadoTitulo}>Tubo sugerido</h2>
          <p className={estilos.origem}>Calculado pela {tubo.origem}.</p>

          {tubo.comCuff && <Escada titulo="Com cuff" opcao={tubo.comCuff} />}
          {tubo.semCuff && <Escada titulo="Sem cuff" opcao={tubo.semCuff} />}
          {tubo.faixaNeonatal && (
            <p className={estilos.veredito}>
              Faixa de referência para este peso: <b>{tubo.faixaNeonatal.de}–{tubo.faixaNeonatal.ate} mm</b>
            </p>
          )}

          {prof && (
            <>
              <h2 className={estilos.resultadoTitulo}>Profundidade oral</h2>
              <div className={estilos.linha}>
                {prof.pelaIdade !== undefined && <><span>Pela idade</span><b>{prof.pelaIdade} cm</b></>}
                {prof.peloTubo !== undefined && <><span>Pelo diâmetro do tubo</span><b>{prof.peloTubo} cm</b></>}
              </div>
              <p className={estilos.veredito}>Profundidade inicial estimada: <b>{prof.sugerida}</b></p>
            </>
          )}

          <p className={estilos.aviso}>{AVISO_CLINICO}</p>
        </section>
      )}
    </>
  );
}

function Escada({ titulo, opcao }: { titulo: string; opcao: { calculado: number; abaixo?: number; sugerido: number; acima?: number } }) {
  return (
    <div className={estilos.escada}>
      <small>{titulo}</small>
      <div>
        {opcao.abaixo !== undefined && <span>{opcao.abaixo.toFixed(1)}</span>}
        <b>{opcao.sugerido.toFixed(1)} mm</b>
        {opcao.acima !== undefined && <span>{opcao.acima.toFixed(1)}</span>}
      </div>
      <small className={estilos.calculado}>calculado: {opcao.calculado.toFixed(2)} mm</small>
    </div>
  );
}
