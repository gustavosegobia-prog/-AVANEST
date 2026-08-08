"use client";

import { useMemo, useState } from "react";
import estilos from "./calculos.module.css";
import { Campo, numero, type Compartilhado } from "./modulos-extras";
import {
  acharFarmaco,
  alertas,
  AVISO_DIRETRIZ,
  AVISO_MODULO,
  AVISO_MULTIMODAL,
  AVISO_SISTEMICAS,
  citar,
  conferir,
  DIVERGENCIA,
  DOSES_SISTEMICAS,
  escreverFaixa,
  FARMACOS,
  MONITORIZACAO,
  NAO_INFERIR,
  porPeso,
  prepararSolucao,
  REGISTRO_MULTIMODAL,
  RESSALVA_BASAL,
  tetoPorHora,
  virgula,
  volumeDaDose,
  type FarmacoId,
  type Perfil,
  type Programacao,
} from "@/lib/calculos/pca";

/**
 * PCA. Nenhuma conta e nenhum número clínico nascem aqui: tudo vem de
 * lib/calculos/pca.ts, que é transcrição de fonte com página anotada.
 *
 * A escolha central da tela: os campos de programação começam vazios e
 * continuam vazios. A faixa publicada fica ao lado, visível, mas o botão que
 * a copiaria para dentro do campo não existe — porque a diretriz do livro não
 * é o protocolo do serviço, e um clique não deveria poder confundir os dois.
 */

type Marcador = keyof Pick<
  Perfil,
  | "cognicaoAdequada" | "compreendeDispositivo" | "toleranteOpioide" | "apneiaSono"
  | "obesidade" | "dpoc" | "funcaoRenalAlterada" | "sedativosConcomitantes"
  | "opioideOutraVia" | "acionamentoPorTerceiros"
>;

const ELEGIBILIDADE: Array<{ chave: Marcador; rotulo: string }> = [
  { chave: "cognicaoAdequada", rotulo: "Função cognitiva adequada" },
  { chave: "compreendeDispositivo", rotulo: "Compreende o dispositivo" },
  { chave: "toleranteOpioide", rotulo: "Tolerante a opioide" },
];

const RISCO: Array<{ chave: Marcador; rotulo: string }> = [
  { chave: "apneiaSono", rotulo: "Apneia obstrutiva do sono" },
  { chave: "obesidade", rotulo: "Obesidade" },
  { chave: "dpoc", rotulo: "DPOC" },
  { chave: "funcaoRenalAlterada", rotulo: "Função renal alterada" },
  { chave: "sedativosConcomitantes", rotulo: "Sedativos concomitantes" },
  { chave: "opioideOutraVia", rotulo: "Opioide por outra via" },
  { chave: "acionamentoPorTerceiros", rotulo: "Acionamento por familiar ou equipe" },
];

export function Pca({ dados, set }: { dados: Compartilhado; set: (c: string, v: string) => void }) {
  const [farmacoId, setFarmacoId] = useState<FarmacoId>("morfina");
  const [perfil, setPerfil] = useState<Perfil>({});
  const [prog, setProg] = useState<Record<string, string>>({});
  const [conferido, setConferido] = useState(false);
  const [referencia, setReferencia] = useState(false);

  const farmaco = acharFarmaco(farmacoId)!;
  const d = farmaco.diretriz;
  const pesoKg = numero(dados.peso ?? "");

  const programacao: Programacao = useMemo(() => ({
    demanda: numero(prog.demanda ?? ""),
    lockoutMin: numero(prog.lockout ?? ""),
    basal: numero(prog.basal ?? ""),
    concentracao: numero(prog.concentracao ?? ""),
    volumeTotal: numero(prog.volume ?? ""),
    doseCarga: numero(prog.carga ?? ""),
    limiteValor: numero(prog.limiteValor ?? ""),
    limiteJanelaH: numero(prog.limiteJanela ?? ""),
  }), [prog]);

  const perfilCompleto: Perfil = useMemo(
    () => ({ ...perfil, pesoKg, idade: numero(dados.idade ?? "") }),
    [perfil, pesoKg, dados.idade],
  );

  const conferencias = useMemo(() => conferir(farmacoId, programacao), [farmacoId, programacao]);
  const teto = useMemo(() => tetoPorHora(farmacoId, programacao), [farmacoId, programacao]);
  const avisos = useMemo(() => alertas(farmacoId, perfilCompleto, programacao), [farmacoId, perfilCompleto, programacao]);
  const preparo = useMemo(
    () => prepararSolucao(farmacoId, numero(prog.massa ?? ""), programacao.volumeTotal),
    [farmacoId, prog.massa, programacao.volumeTotal],
  );
  const concentracaoUsada = programacao.concentracao ?? preparo?.concentracao;
  const volumeBolo = volumeDaDose(programacao.demanda, concentracaoUsada);

  const algoPreenchido = conferencias.length > 0 || avisos.length > 0;
  const marcar = (chave: Marcador, valor: boolean) => setPerfil((v) => ({ ...v, [chave]: valor }));
  const escrever = (chave: string, valor: string) => setProg((v) => ({ ...v, [chave]: valor }));

  return (
    <>
      <h1 className={estilos.titulo}>PCA — analgesia controlada pelo paciente</h1>
      <p className={estilos.subtitulo}>
        As faixas dos livros ficam ao lado dos campos, e só ali. Nada é preenchido
        automaticamente: a programação que vale é a do protocolo do seu serviço.
      </p>
      <p className={estilos.confira}>{AVISO_MODULO}</p>

      {/* 1. Paciente */}
      <section className={estilos.correcao}>
        <strong>1. Paciente e elegibilidade</strong>
        <div className={estilos.gradeCurta}>
          <Campo chave="peso" rotulo="Peso (kg)" passo="0.1" valor={dados.peso ?? ""} aoMudar={set} />
          <Campo chave="idade" rotulo="Idade (anos)" valor={dados.idade ?? ""} aoMudar={set} />
        </div>

        <div className={estilos.opcoes} role="group" aria-label="Elegibilidade">
          {ELEGIBILIDADE.map(({ chave, rotulo }) => (
            <Tres key={chave} rotulo={rotulo} valor={perfil[chave]} aoMudar={(v) => marcar(chave, v)} />
          ))}
        </div>
        <div className={estilos.opcoes} role="group" aria-label="Fatores de risco">
          {RISCO.map(({ chave, rotulo }) => (
            <label key={chave} className={estilos.opcao}>
              <input type="checkbox" checked={perfil[chave] === true}
                onChange={(e) => marcar(chave, e.target.checked)} />
              <span>{rotulo}</span>
            </label>
          ))}
        </div>

        {perfil.obesidade && (
          <label className={estilos.campo}>
            <span>Peso usado no cálculo</span>
            <select className={estilos.seletor} value={perfil.tipoPeso ?? ""}
              onChange={(e) => setPerfil((v) => ({ ...v, tipoPeso: (e.target.value || undefined) as Perfil["tipoPeso"] }))}>
              <option value="">Informe</option>
              <option value="ideal">Peso ideal</option>
              <option value="total">Peso total</option>
            </select>
          </label>
        )}
      </section>

      {/* 2. Fármaco e o que as fontes publicaram */}
      <section className={estilos.correcao}>
        <strong>2. Fármaco</strong>
        <label className={estilos.campo}>
          <span>Opioide</span>
          <select className={estilos.seletor} value={farmacoId}
            onChange={(e) => setFarmacoId(e.target.value as FarmacoId)}>
            {FARMACOS.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>

        {d && (
          <div className={`${estilos.bloco} ${estilos.blocoFonte}`}>
            <strong>Diretriz publicada — {d.populacao}</strong>
            <div className={estilos.linha}>
              <span>Concentração citada</span><b>{d.concentracao}</b>
              <span>Dose de demanda</span><b>{d.demanda ? escreverFaixa(d.demanda, farmaco.unidadeDose) : "—"}</b>
              <span>Bloqueio</span><b>{d.lockoutMin ? escreverFaixa(d.lockoutMin, "min") : "—"}</b>
              <span>Infusão basal</span><b>{d.basal ? escreverFaixa(d.basal, farmaco.unidadeBasal) : "—"}</b>
            </div>
            <p className={estilos.fonte}>{citar(d.fonte)}</p>
            <p className={estilos.aviso}>{RESSALVA_BASAL}</p>
            <p className={estilos.aviso}>{AVISO_DIRETRIZ}</p>
          </div>
        )}

        {farmaco.saesp && (
          <div className={`${estilos.bloco} ${estilos.blocoFonte}`}>
            <strong>Recomendação do SAESP</strong>
            <p>{farmaco.saesp.texto}</p>
            <p className={estilos.fonte}>{citar(farmaco.saesp.fonte)}</p>
          </div>
        )}
      </section>

      {/* 3. Programação — campos vazios, sempre */}
      <section className={estilos.correcao}>
        <strong>3. Programação do serviço</strong>
        <p className={estilos.dica}>
          Digite o que o protocolo da sua instituição define. O AVANEST confere e mostra
          onde cada valor caiu em relação às faixas publicadas — sem substituí-los.
        </p>
        <div className={estilos.grade}>
          <Campo chave="demanda" rotulo={`Dose de demanda (${farmaco.unidadeDose})`} passo="0.01"
            valor={prog.demanda ?? ""} aoMudar={escrever} />
          <Campo chave="lockout" rotulo="Bloqueio (min)" valor={prog.lockout ?? ""} aoMudar={escrever} />
          <Campo chave="basal" rotulo={`Infusão basal (${farmaco.unidadeBasal}) — opcional`} passo="0.01"
            valor={prog.basal ?? ""} aoMudar={escrever} />
          <Campo chave="carga" rotulo={`Dose de carga (${farmaco.unidadeDose}) — opcional`} passo="0.01"
            valor={prog.carga ?? ""} aoMudar={escrever} />
          <Campo chave="limiteValor" rotulo={`Limite por janela (${farmaco.unidadeDose})`} passo="0.01"
            valor={prog.limiteValor ?? ""} aoMudar={escrever} />
          <Campo chave="limiteJanela" rotulo="Janela do limite (h)" valor={prog.limiteJanela ?? ""} aoMudar={escrever} />
        </div>

        <strong>Solução montada</strong>
        <div className={estilos.grade}>
          <Campo chave="massa" rotulo={`Fármaco na seringa (${farmaco.unidadeDose})`} passo="0.1"
            valor={prog.massa ?? ""} aoMudar={escrever} />
          <Campo chave="volume" rotulo="Volume total (mL)" passo="0.1" valor={prog.volume ?? ""} aoMudar={escrever} />
          <Campo chave="concentracao" rotulo={`Concentração (${farmaco.unidadeDose}/mL) — se já pronta`} passo="0.01"
            valor={prog.concentracao ?? ""} aoMudar={escrever} />
        </div>
      </section>

      <div className={estilos.acoes}>
        <button type="button" className={estilos.primario} disabled={!algoPreenchido}
          onClick={() => setConferido(true)}>Conferir</button>
        {!algoPreenchido && <span className={estilos.dica}>Preencha a programação ou marque o perfil do paciente.</span>}
      </div>

      {conferido && (
        <section className={estilos.resultado} aria-live="polite">
          <h2 className={estilos.resultadoTitulo}>Conferência</h2>

          {conferencias.length > 0 && (
            <div className={estilos.completa}>
              {conferencias.map((c) => (
                <div key={c.campo} className={`${estilos.bloco} ${classeDaSituacao(c.situacao)}`}>
                  <div className={estilos.linha}>
                    <span>{c.campo}</span>
                    <b>{virgula(c.valor)} {c.unidade}</b>
                  </div>
                  <p>{c.texto}</p>
                  {c.fonte && <p className={estilos.fonte}>{citar(c.fonte)}</p>}
                </div>
              ))}
            </div>
          )}

          {preparo && (
            <div className={estilos.correcao}>
              <strong>Solução</strong>
              <p className={estilos.veredito}>{preparo.texto}</p>
            </div>
          )}

          {volumeBolo !== undefined && (
            <div className={estilos.linha}>
              <span>Volume de cada dose de demanda</span>
              <b>{virgula(volumeBolo)} mL</b>
            </div>
          )}

          {teto && (
            <div className={estilos.correcao}>
              <strong>Teto aritmético por hora</strong>
              <div className={estilos.linha}>
                <span>Acionamentos possíveis</span><b>{teto.dosesPorHora}/h</b>
                <span>Por demanda</span><b>{virgula(teto.porDemanda)} {teto.unidade}</b>
                {teto.porBasal > 0 && (<><span>Pela basal</span><b>{virgula(teto.porBasal)} {teto.unidade}</b></>)}
                <span>Total</span><b>{virgula(teto.total)} {teto.unidade}</b>
              </div>
              <p className={estilos.aviso}>{teto.aviso}</p>
            </div>
          )}

          {avisos.length > 0 && (
            <div className={estilos.completa}>
              {avisos.map((a) => (
                <div key={a.titulo}
                  className={`${estilos.bloco} ${a.gravidade === "critico" ? estilos.blocoCritico : a.gravidade === "atencao" ? estilos.blocoAtencao : ""}`}>
                  <strong>{a.titulo}</strong>
                  <p>{a.texto}</p>
                  {a.fonte && <p className={estilos.fonte}>{citar(a.fonte)}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Referência sempre disponível, fechada por padrão para não competir
          com a tarefa de conferir a bomba. */}
      <button type="button" className={estilos.verMais} onClick={() => setReferencia((v) => !v)}>
        {referencia ? "Ocultar referência das fontes" : "Ver referência das fontes"}
      </button>

      {referencia && (
        <div className={estilos.completa}>
          <div className={estilos.correcao}>
            <strong>Doses sistêmicas do SAESP</strong>
            <p className={estilos.confira}>{AVISO_SISTEMICAS}</p>
            {DOSES_SISTEMICAS.map((s, i) => {
              const comPeso = pesoKg !== undefined ? porPeso(s, pesoKg) : undefined;
              return (
                <div key={i} className={estilos.bloco}>
                  <div className={estilos.linha}>
                    <span>{s.farmaco}</span><b>{s.dose}</b>
                    <span>Via e modalidade</span><b>{s.via}</b>
                    {comPeso && (<><span>Para {virgula(pesoKg!)} kg</span><b>{comPeso}</b></>)}
                  </div>
                  <p className={estilos.fonte}>{citar(s.fonte)}</p>
                </div>
              );
            })}
          </div>

          <div className={estilos.correcao}>
            <strong>O que não se preenche por inferência</strong>
            {NAO_INFERIR.map((n) => (
              <div key={n.campo} className={estilos.bloco}>
                <strong>{n.campo}</strong>
                <p>{n.conduta}</p>
              </div>
            ))}
          </div>

          <div className={estilos.correcao}>
            <strong>Monitorização e barreiras de segurança</strong>
            {MONITORIZACAO.map((m) => (
              <div key={m.dominio} className={estilos.bloco}>
                <strong>{m.dominio}</strong>
                <p>{m.registrar}</p>
                <p className={estilos.aviso}>{m.alerta}</p>
              </div>
            ))}
          </div>

          <div className={estilos.correcao}>
            <strong>{DIVERGENCIA.titulo}</strong>
            <div className={estilos.bloco}>
              <p>{DIVERGENCIA.saesp.texto}</p>
              <p className={estilos.fonte}>{citar(DIVERGENCIA.saesp.fonte)}</p>
            </div>
            <div className={estilos.bloco}>
              <p>{DIVERGENCIA.miller.texto}</p>
              <p className={estilos.fonte}>{citar(DIVERGENCIA.miller.fonte)}</p>
            </div>
            <p className={estilos.aviso}>
              As duas formulações ficam atribuídas e datadas. Achatá-las numa frase só criaria
              uma equivalência que nenhuma das fontes afirma.
            </p>
          </div>

          <div className={estilos.correcao}>
            <strong>Plano multimodal — registro mínimo</strong>
            <ul className={estilos.lista}>
              {REGISTRO_MULTIMODAL.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <p className={estilos.aviso}>{AVISO_MULTIMODAL}</p>
          </div>
        </div>
      )}
    </>
  );
}

const classeDaSituacao = (s: string) =>
  s === "dentro" ? estilos.blocoOk : s === "sem-faixa" ? "" : estilos.blocoAtencao;

/**
 * Sim, não e "não informado" são três estados, não dois.
 *
 * Uma caixa de marcar só sabe dizer sim e vazio, e vazio seria lido como não —
 * o que faria "cognição não avaliada" virar "cognição inadequada" e disparar
 * um alerta crítico que ninguém afirmou.
 */
function Tres({
  rotulo, valor, aoMudar,
}: { rotulo: string; valor?: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className={estilos.tres}>
      <span>{rotulo}</span>
      <div>
        <button type="button" className={valor === true ? estilos.tresAtivo : estilos.tresBotao}
          aria-pressed={valor === true} onClick={() => aoMudar(true)}>Sim</button>
        <button type="button" className={valor === false ? estilos.tresAtivo : estilos.tresBotao}
          aria-pressed={valor === false} onClick={() => aoMudar(false)}>Não</button>
      </div>
    </div>
  );
}
