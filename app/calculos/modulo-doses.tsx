"use client";

import { useMemo, useState } from "react";
import estilos from "./calculos.module.css";
import { Campo, numero, type Compartilhado } from "./modulos-extras";
import {
  AVISO_AVULSO,
  AVISO_MODULO,
  AVISO_TITULAVEL,
  buscar,
  calcular,
  CATALOGO_INCOMPLETO,
  citar,
  dePercentual,
  disponiveis,
  doseDe,
  escreverApresentacao,
  GRUPOS,
  IDADE_ADULTO_ANOS,
  populacaoPor,
  ROTULO_NIVEL,
  virgula,
  type Apresentacao,
  type Calculo,
  type GrupoId,
  type Medicamento,
  type Unidade,
} from "@/lib/calculos/doses";

/**
 * Calculadora de doses. O caminho inteiro é idade, peso, calcular.
 *
 * A tela existe para o centro cirúrgico, então o número maior é sempre o
 * volume — é ele que se aspira. A dose em mg ou mcg fica abaixo, menor, junto
 * da dose por quilo e da apresentação usada, que é o que se confere contra a
 * ampola.
 *
 * O catálogo ainda é curto de propósito: só tem o que já tem fonte citada
 * dentro do AVANEST. Enquanto a tabela do serviço não chega, o cálculo avulso
 * resolve qualquer fármaco — e ele é honesto sobre o que faz, que é a regra de
 * três e a conferência de unidade, não a validação da dose.
 */

const FAVORITOS_CHAVE = "avanest.doses.favoritos";

/**
 * Lido na inicialização do estado, e não num efeito.
 *
 * Dá para fazer assim sem risco de descompasso com o servidor porque a lista
 * de favoritos só é desenhada depois de calcular — na primeira pintura ela
 * não aparece, então não há o que divergir.
 */
function lerFavoritos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const salvo = window.localStorage.getItem(FAVORITOS_CHAVE);
    return salvo ? (JSON.parse(salvo) as string[]) : [];
  } catch {
    return []; // navegador sem storage: segue sem favoritos
  }
}
const UNIDADES: Unidade[] = ["mg", "mcg", "g", "UI", "mEq"];

export function Doses({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [calculado, setCalculado] = useState(false);
  const [termo, setTermo] = useState("");
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);
  const [abertos, setAbertos] = useState<GrupoId[]>(["inducao", "opioides"]);
  const [apresentacaoEscolhida, setApresentacaoEscolhida] = useState<Record<string, number>>({});

  // Os favoritos são do aparelho, não do prontuário: ficam no próprio
  // navegador e não viajam para servidor nenhum.
  const alternarFavorito = (id: string) =>
    setFavoritos((v) => {
      const novo = v.includes(id) ? v.filter((x) => x !== id) : [...v, id];
      try { window.localStorage.setItem(FAVORITOS_CHAVE, JSON.stringify(novo)); } catch { /* idem */ }
      return novo;
    });

  const idade = numero(dados.idade ?? "");
  const peso = numero(dados.peso ?? "");
  const populacao = populacaoPor(idade);
  const pronto = populacao !== undefined && peso !== undefined && peso > 0;

  const lista = useMemo(
    () => (populacao ? buscar(termo, disponiveis(populacao)) : []),
    [populacao, termo],
  );
  const favoritados = lista.filter((m) => favoritos.includes(m.id));

  const apresentacaoDe = (m: Medicamento) => m.apresentacoes[apresentacaoEscolhida[m.id] ?? 0];

  const cartao = (m: Medicamento) => (
    <Cartao key={m.id} m={m} peso={peso!} populacao={populacao!}
      apresentacao={apresentacaoDe(m)}
      aoTrocarApresentacao={(i) => setApresentacaoEscolhida((v) => ({ ...v, [m.id]: i }))}
      favorito={favoritos.includes(m.id)} aoFavoritar={() => alternarFavorito(m.id)} />
  );

  return (
    <>
      <h1 className={estilos.titulo}>Calculadora de doses</h1>
      <p className={estilos.subtitulo}>
        Idade e peso, e a lista sai calculada em dose e em mililitros. O número
        grande é sempre o volume.
      </p>
      <p className={estilos.confira}>{AVISO_MODULO}</p>

      <section className={estilos.correcao}>
        <div className={estilos.gradeCurta}>
          <Campo chave="idade" rotulo="Idade (anos)" valor={dados.idade ?? ""} aoMudar={set} />
          <Campo chave="peso" rotulo="Peso (kg)" passo="0.1" valor={dados.peso ?? ""} aoMudar={set} />
        </div>
        <div className={estilos.acoes}>
          <button type="button" className={estilos.primario} disabled={!pronto}
            onClick={() => setCalculado(true)}>Calcular doses</button>
          {!pronto && <span className={estilos.dica}>Informe idade e peso.</span>}
          {pronto && (
            <span className={estilos.dica}>
              {populacao === "adulto" ? "Adulto" : "Pediátrico"} — a partir de {IDADE_ADULTO_ANOS} anos
              o AVANEST carrega a tabela de adulto. Esse corte é nosso, não de fonte.
            </span>
          )}
        </div>
      </section>

      {calculado && pronto && (
        <>
          <label className={estilos.campo}>
            <span>Buscar medicamento</span>
            <input type="search" value={termo} placeholder="Digite parte do nome"
              onChange={(e) => setTermo(e.target.value)} />
          </label>

          {favoritados.length > 0 && (
            <section className={estilos.correcao}>
              <strong>⭐ Favoritos</strong>
              <div className={estilos.completa}>{favoritados.map(cartao)}</div>
            </section>
          )}

          {GRUPOS.map((g) => {
            const doGrupo = lista.filter((m) => m.grupo === g.id);
            if (doGrupo.length === 0) return null;
            const aberto = abertos.includes(g.id) || termo.trim() !== "";
            return (
              <section key={g.id} className={estilos.correcao}>
                <button type="button" className={estilos.acordeao}
                  aria-expanded={aberto}
                  onClick={() => setAbertos((v) => (v.includes(g.id) ? v.filter((x) => x !== g.id) : [...v, g.id]))}>
                  <span aria-hidden="true">{aberto ? "▼" : "▶"}</span> {g.icone} {g.nome}
                  <small>{doGrupo.length}</small>
                </button>
                {aberto && <div className={estilos.completa}>{doGrupo.map(cartao)}</div>}
              </section>
            );
          })}

          {lista.length === 0 && (
            <p className={estilos.confira}>
              {termo.trim()
                ? `Nada com “${termo}” no catálogo${populacao === "pediatrico" ? " pediátrico" : ""}. Use o cálculo avulso abaixo.`
                : CATALOGO_INCOMPLETO}
            </p>
          )}
          {lista.length > 0 && <p className={estilos.aviso}>{CATALOGO_INCOMPLETO}</p>}

          <Avulso peso={peso!} />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Cartao({
  m, peso, populacao, apresentacao, aoTrocarApresentacao, favorito, aoFavoritar,
}: {
  m: Medicamento; peso: number; populacao: "adulto" | "pediatrico";
  apresentacao?: Apresentacao; aoTrocarApresentacao: (i: number) => void;
  favorito: boolean; aoFavoritar: () => void;
}) {
  const dose = doseDe(m, populacao)!;
  const contas = calcular(dose, peso, apresentacao, m.tetoAbsoluto);

  return (
    <div className={estilos.remedio}>
      <div className={estilos.remedioTopo}>
        <strong>{m.nome}</strong>
        <button type="button" className={estilos.estrela} aria-pressed={favorito}
          aria-label={favorito ? `Tirar ${m.nome} dos favoritos` : `Marcar ${m.nome} como favorito`}
          onClick={aoFavoritar}>{favorito ? "★" : "☆"}</button>
      </div>
      <small className={estilos.remedioVia}>{m.via}</small>

      {m.titulavel && <p className={estilos.confira}>{AVISO_TITULAVEL}</p>}

      <div className={estilos.doses}>
        {contas.map((c) => <Dose key={c.nivel} c={c} unico={contas.length === 1} />)}
      </div>

      {m.apresentacoes.length > 1 ? (
        <div className={estilos.parametroBotoes}>
          {m.apresentacoes.map((a, i) => (
            <button key={a.rotulo} type="button"
              className={a === apresentacao ? estilos.tresAtivo : estilos.tresBotao}
              onClick={() => aoTrocarApresentacao(i)}>{a.rotulo}</button>
          ))}
        </div>
      ) : (
        apresentacao && <small className={estilos.remedioVia}>Apresentação: {apresentacao.rotulo} ({escreverApresentacao(apresentacao)})</small>
      )}

      {m.observacao && <p className={estilos.aviso}>{m.observacao}</p>}
      {m.fonte && <p className={estilos.fonte}>{citar(m.fonte)} · revisão {m.revisao}</p>}
    </div>
  );
}

function Dose({ c, unico }: { c: Calculo; unico: boolean }) {
  const porHora = c.por === "kg/h" ? "/h" : "";
  return (
    <div className={c.limitada ? `${estilos.dose} ${estilos.blocoAtencao}` : estilos.dose}>
      {!unico && <small className={estilos.doseNivel}>{ROTULO_NIVEL[c.nivel]}</small>}
      {c.volumeMl !== undefined
        ? <b className={estilos.volume}>{virgula(c.volumeMl)} mL{porHora}</b>
        : <b className={estilos.volume}>{virgula(c.doseTotal)} {c.unidadeDose}{porHora}</b>}
      <small>
        {virgula(c.doseTotal)} {c.unidadeDose}{porHora} · {virgula(c.dosePorKg)} {c.unidadeDose}/{c.por}
      </small>
      {c.limitada && (
        <small className={estilos.limitada}>
          ⚠️ Limitada pela dose máxima cadastrada. Pelo peso seriam {virgula(c.doseAntesDoTeto!)} {c.unidadeDose}.
        </small>
      )}
      {c.incompatibilidade && <small className={estilos.limitada}>⚠️ {c.incompatibilidade}</small>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Cálculo avulso: o que faz a tela servir hoje, com o catálogo ainda curto.
 * A pessoa traz a dose e a apresentação; a máquina faz a regra de três e
 * confere a unidade.
 */
function Avulso({ peso }: { peso: number }) {
  const [dosePorKg, setDosePorKg] = useState("");
  const [unidadeDose, setUnidadeDose] = useState<Unidade>("mg");
  const [modo, setModo] = useState<"concentracao" | "percentual">("concentracao");
  const [quantidade, setQuantidade] = useState("");
  const [unidadeApres, setUnidadeApres] = useState<Unidade>("mg");
  const [mL, setML] = useState("1");
  const [percentual, setPercentual] = useState("");

  const apresentacao = useMemo<Apresentacao | undefined>(() => {
    if (modo === "percentual") return dePercentual(numero(percentual) ?? Number.NaN);
    const q = numero(quantidade), v = numero(mL);
    if (q === undefined || v === undefined || q <= 0 || v <= 0) return undefined;
    return { rotulo: `${virgula(q)} ${unidadeApres} / ${virgula(v)} mL`, quantidade: q, unidade: unidadeApres, mL: v };
  }, [modo, percentual, quantidade, unidadeApres, mL]);

  const conta = useMemo(() => {
    const d = numero(dosePorKg);
    if (d === undefined) return undefined;
    return calcular({ usual: d, unidade: unidadeDose, por: "kg" }, peso, apresentacao)[0];
  }, [dosePorKg, unidadeDose, peso, apresentacao]);

  return (
    <section className={estilos.correcao}>
      <strong>Cálculo avulso</strong>
      <p className={estilos.dica}>{AVISO_AVULSO}</p>

      <div className={estilos.grade}>
        <label className={estilos.campo}>
          <span>Dose por quilo</span>
          <input type="number" inputMode="decimal" step="0.001" value={dosePorKg}
            onChange={(e) => setDosePorKg(e.target.value)} />
        </label>
        <label className={estilos.campo}>
          <span>Unidade da dose</span>
          <select className={estilos.seletor} value={unidadeDose}
            onChange={(e) => setUnidadeDose(e.target.value as Unidade)}>
            {UNIDADES.map((u) => <option key={u} value={u}>{u}/kg</option>)}
          </select>
        </label>
        <label className={estilos.campo}>
          <span>Apresentação informada como</span>
          <select className={estilos.seletor} value={modo}
            onChange={(e) => setModo(e.target.value as "concentracao" | "percentual")}>
            <option value="concentracao">Quantidade e volume</option>
            <option value="percentual">Porcentagem</option>
          </select>
        </label>
      </div>

      {modo === "percentual" ? (
        <div className={estilos.gradeCurta}>
          <label className={estilos.campo}>
            <span>Porcentagem (%)</span>
            <input type="number" inputMode="decimal" step="0.05" value={percentual}
              onChange={(e) => setPercentual(e.target.value)} placeholder="Ex.: 2" />
          </label>
          {apresentacao && (
            <p className={estilos.veredito}>{apresentacao.rotulo} = {escreverApresentacao(apresentacao)}</p>
          )}
        </div>
      ) : (
        <div className={estilos.grade}>
          <label className={estilos.campo}>
            <span>Quantidade na ampola</span>
            <input type="number" inputMode="decimal" step="0.01" value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)} />
          </label>
          <label className={estilos.campo}>
            <span>Unidade</span>
            <select className={estilos.seletor} value={unidadeApres}
              onChange={(e) => setUnidadeApres(e.target.value as Unidade)}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className={estilos.campo}>
            <span>Em quantos mL</span>
            <input type="number" inputMode="decimal" step="0.1" value={mL}
              onChange={(e) => setML(e.target.value)} />
          </label>
        </div>
      )}

      {conta ? (
        <div className={estilos.remedio}>
          <div className={estilos.doses}><Dose c={conta} unico /></div>
          {apresentacao && <small className={estilos.remedioVia}>Apresentação: {escreverApresentacao(apresentacao)} · peso {virgula(peso)} kg</small>}
        </div>
      ) : (
        <p className={estilos.dica}>Informe a dose por quilo e a apresentação.</p>
      )}
    </section>
  );
}
