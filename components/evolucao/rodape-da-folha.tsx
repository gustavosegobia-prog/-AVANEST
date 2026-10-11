// O rodapé da ficha de papel, no desenho exato da folha do serviço.
//
// Posições e coxins, o bloco de técnica com a tira vertical, cirurgia,
// cirurgião, e a grade de baixo: início e fim, alta da sala, condições de
// saída, Aldrete e o médico anestesista. Cada "○" do papel é um toque; cada
// "____" é um campo curto na própria linha. Marcar um detalhe (paramediana,
// VCV, TOT…) já marca a técnica a que ele pertence.
//
// Um componente só para a tela e para a impressão: sem `onMudar` ele desenha
// a mesma folha, só para ler — as bolinhas marcadas, o que foi escrito nas
// linhas e as linhas vazias, como no papel. Não tem estado: na tela entra
// pela folha (cliente), na impressão pela folha impressa (servidor).
//
// Grava no cabeçalho da folha (com histórico na auditoria), no mesmo formato
// de antes. Opção que a ficha já tinha marcada e que o papel não traz
// (sentado, manta térmica, máscara laríngea…) continua aparecendo, marcada,
// no fim da linha dela — para ser vista e, se for o caso, desmarcada.

import { BLOQUEIOS, FUNCOES, type Profissional } from "@/lib/evolucao/folha";
import { ALDRETE, somaAldrete } from "@/lib/evolucao/lista-da-folha";
import { hora } from "@/lib/evolucao/impressao";
import { Linha, Op, Txt, type Modo } from "./papel";

type Dados = Record<string, unknown>;
type Mudar = (m: Dados) => void;

const t = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const sub = (d: Dados, k: string) => ((d[k] as Dados | undefined) ?? {});
const lista = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
const alternar = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

// As opções do papel: o valor que fica gravado e o rótulo impresso.
const POSICOES_DO_PAPEL: Array<[string, string]> = [["DDH", "DDH"], ["Litotomia", "litotomia"], ["DLE", "DLE"], ["DLD", "DLD"]];
const VENTRAL = "Decúbito ventral";
const OCULAR = "Proteção ocular";
const COXINS: Array<[string, string]> = [
  ["Coxim — cabeça", "Cabeça"], ["Coxim — face", "Face"], ["Coxim — braços", "Braços"], ["Coxim — pernas", "Pernas"],
  ["Colchão inflável", "Colchão inflável"],
];
const GERAIS: Array<[string, string]> = [["geral_balanceada", "Balanceada"], ["geral_inalatoria", "Inalatória"], ["geral_venosa_total", "Venosa total,"]];
const VENTILACAO: Array<[string, string]> = [
  ["Espontânea sob cateter de O₂", "espontânea sob cateter de O₂"], ["Assistida sob máscara", "Assistida sob máscara"],
];
const BLOQUEIOS_DO_PAPEL: Array<[string, string]> = [
  ["Interescalênico", "interescalênica"], ["Supraclavicular", "supraclavicular"], ["Axilar", "axilar"],
  ["ESP (eretor da espinha)", "ESP block"], ["Outro", "outro:"],
];
const OUTROS_BLOQUEIOS = BLOQUEIOS.filter((x) => !BLOQUEIOS_DO_PAPEL.some(([v]) => v === x));

/** "29156" → "29.156", como no carimbo. Número com letra fica como veio. */
const crmEscrito = (crm: string) => (/^\d{4,}$/.test(crm) ? crm.replace(/\B(?=(\d{3})+$)/g, ".") : crm);

export function RodapeDaFolha({ dados, onMudar, leitura = false, marcos, medicos = [] }: {
  dados: Dados;
  /** Sem ele, a folha só para ler: é a impressão. */
  onMudar?: Mudar;
  leitura?: boolean;
  marcos: { inicioAnestesia: string | null; fimAnestesia: string | null };
  medicos?: Array<{ id: string; nome: string; crm: string }>;
}) {
  const m: Modo = { impresso: !onMudar, leitura };
  const mudar: Mudar = onMudar ?? (() => {});

  const tecnicas = lista(dados.tecnicas);
  const det = sub(dados, "tecnica_detalhes");
  const g = sub(det, "geral"), r = sub(det, "raqui"), s = sub(det, "sedacao"), b = sub(det, "bloqueio");
  const saida = sub(dados, "saida");
  const pontos = sub(saida, "aldrete_pontos");
  const posicoes = lista(dados.posicoes), protecoes = lista(dados.protecoes);
  const ventilacao = lista(s.ventilacao), tiposDeBloqueio = lista(b.tipos);
  const equipe = (dados.equipe as Profissional[] | undefined) ?? [];
  const responsavel = equipe.find((x) => x.funcao === "responsavel");
  const demais = equipe.filter((x) => x !== responsavel);

  const tem = (c: string) => tecnicas.includes(c);
  const gerais = tecnicas.filter((c) => c.startsWith("geral"));
  const alternarTecnica = (c: string) => mudar({ tecnicas: alternar(tecnicas, c) });
  const comTecnica = (c: string) => (tem(c) ? tecnicas : [...tecnicas, c]);
  // Geral sem tipo marcado fica como "geral"; marcar um tipo tira o genérico.
  const comGeral = () => (gerais.length ? tecnicas : [...tecnicas, "geral"]);
  const alternarGeral = () =>
    mudar({ tecnicas: gerais.length ? tecnicas.filter((c) => !c.startsWith("geral")) : [...tecnicas, "geral"] });
  const alternarTipoDeGeral = (c: string) =>
    mudar({ tecnicas: tem(c) ? tecnicas.filter((x) => x !== c) : [...tecnicas.filter((x) => x !== "geral"), c] });
  // Um detalhe da técnica: grava o detalhe e garante a técnica marcada.
  const detalhe = (grupo: string, mudancas: Dados, novas: string[]) =>
    mudar({ tecnicas: novas, tecnica_detalhes: { ...det, [grupo]: { ...sub(det, grupo), ...mudancas } } });
  const raqui = (x: Dados) => detalhe("raqui", x, comTecnica("raquianestesia"));
  const geral = (x: Dados) => detalhe("geral", x, comGeral());
  const sedacao = (x: Dados) => detalhe("sedacao", x, comTecnica("sedacao"));
  const bloqueio = (x: Dados) => detalhe("bloqueio", x, comTecnica("bloqueio_periferico"));
  const mudarSaida = (x: Dados) => mudar({ saida: { ...saida, ...x } });
  function mudarAldrete(chave: string, v: number) {
    const novos = { ...pontos, [chave]: pontos[chave] === v ? undefined : v };
    const soma = somaAldrete(novos);
    mudarSaida({ aldrete_pontos: novos, aldrete: soma !== null ? String(soma) : t(saida.aldrete) });
  }
  const mudarEquipe = (nova: Profissional[]) => mudar({ equipe: nova });
  const trocarProfissional = (alvo: Profissional, x: Partial<Profissional>) =>
    mudarEquipe(equipe.map((y) => (y === alvo ? { ...y, ...x } : y)));

  // Espaço da raqui no desenho do papel: L__-L__.
  const espaco = /^L?(\d*)\s*-\s*L?(\d*)$/i.exec(t(r.espaco)) ?? ["", "", ""];
  const mudarEspaco = (a: string, z: string) => raqui({ espaco: a || z ? `L${a}-L${z}` : "" });
  // PA da saída no desenho do papel: ___/___.
  const [paS = "", paD = ""] = t(saida.pa).split("/");
  const mudarPa = (sist: string, diast: string) => mudarSaida({ pa: sist || diast ? `${sist}/${diast}` : "" });

  // O que a ficha tem marcado e o papel não traz.
  const ventral = posicoes.includes(VENTRAL);
  const extrasPosicao = posicoes.filter((x) => x !== VENTRAL && !POSICOES_DO_PAPEL.some(([v]) => v === x));
  const extrasProtecao = protecoes.filter((x) => !COXINS.some(([v]) => v === x) && !(x === OCULAR && ventral));
  const extrasBloqueio = tiposDeBloqueio.filter((x) => !BLOQUEIOS_DO_PAPEL.some(([v]) => v === x));
  const dispositivo = t(g.dispositivo);
  const modo = t(g.modo);
  const h = (iso: string | null) => (iso ? hora(iso) : m.impresso ? "" : "—");
  const somaMarcada = somaAldrete(pontos);

  return (
    <section className={`evoPapel evoRodape${m.impresso ? " impresso" : ""}`} aria-label="Posição, técnica, cirurgia e alta">
      {!m.impresso && (
        <>
          <datalist id="evoOutrosBloqueios">{OUTROS_BLOQUEIOS.map((x) => <option key={x} value={x} />)}</datalist>
          <datalist id="evoMedicosRodape">{medicos.map((x) => <option key={x.id} value={x.nome} />)}</datalist>
        </>
      )}

      <div className="evoRLinha">
        <b>Posições:</b>
        {POSICOES_DO_PAPEL.map(([v, rot]) => (
          <Op key={v} m={m} rotulo={rot} marcado={posicoes.includes(v)} onClick={() => mudar({ posicoes: alternar(posicoes, v) })} />
        ))}
        <Op m={m} rotulo="Dec. Ventral com proteção ocular" marcado={ventral} onClick={() => mudar({
          posicoes: alternar(posicoes, VENTRAL),
          protecoes: ventral ? protecoes.filter((x) => x !== OCULAR) : protecoes.includes(OCULAR) ? protecoes : [...protecoes, OCULAR],
        })} />
        {extrasPosicao.map((x) => (
          <Op key={x} m={m} rotulo={x} marcado onClick={() => mudar({ posicoes: alternar(posicoes, x) })} />
        ))}
        <Txt>Coxins:</Txt>
        {COXINS.map(([v, rot]) => (
          <Op key={v} m={m} rotulo={rot} marcado={protecoes.includes(v)} onClick={() => mudar({ protecoes: alternar(protecoes, v) })} />
        ))}
        {extrasProtecao.map((x) => (
          <Op key={x} m={m} rotulo={x.replace("Coxim — ", "coxim ")} marcado onClick={() => mudar({ protecoes: alternar(protecoes, x) })} />
        ))}
      </div>

      <div className="evoRTecnica">
        <div className="evoRTira" aria-hidden="true">Técnica</div>
        <div className="evoRTecnicaLinhas">
          <div className="evoRLinha">
            <Op m={m} rotulo="Raquianestesia," marcado={tem("raquianestesia")} onClick={() => alternarTecnica("raquianestesia")} />
            <Txt>L</Txt>
            <Linha m={m} rotulo="Espaço, de" valor={espaco[1]} largura={2} numerico onMudar={(v) => mudarEspaco(v, espaco[2])} />
            <Txt>-L</Txt>
            <Linha m={m} rotulo="Espaço, até" valor={espaco[2]} largura={2} sufixo="," numerico onMudar={(v) => mudarEspaco(espaco[1], v)} />
            <Op m={m} rotulo="paramediana" marcado={r.abordagem === "Paramediana"}
              onClick={() => raqui({ abordagem: r.abordagem === "Paramediana" ? "" : "Paramediana" })} />
            <Op m={m} rotulo="mediana," marcado={r.abordagem === "Mediana"}
              onClick={() => raqui({ abordagem: r.abordagem === "Mediana" ? "" : "Mediana" })} />
            <Txt>Agulha</Txt>
            <Linha m={m} rotulo="Agulha da raqui, em gauge" valor={t(r.agulha)} largura={4} sufixo="G ," onMudar={(v) => raqui({ agulha: v })} />
            <Op m={m} rotulo="LCRC," marcado={r.lcr_claro === true} onClick={() => raqui({ lcr_claro: r.lcr_claro !== true })} />
            <Op m={m} rotulo="Punção única" marcado={r.puncao_unica === true} onClick={() => raqui({ puncao_unica: r.puncao_unica !== true })} />
            <span className="evoREspaco" aria-hidden="true" />
            <Op m={m} rotulo="Peridural" marcado={tem("peridural")} onClick={() => alternarTecnica("peridural")} />
            {tem("combinada") && <Op m={m} rotulo="combinada" marcado onClick={() => alternarTecnica("combinada")} />}
          </div>

          <div className="evoRLinha">
            <Op m={m} rotulo="Anestesia Geral" marcado={gerais.length > 0} onClick={alternarGeral} />
            {GERAIS.map(([c, rot]) => (
              <Op key={c} m={m} rotulo={rot} marcado={tem(c)} onClick={() => alternarTipoDeGeral(c)} />
            ))}
            <Txt>TOT</Txt>
            <Linha m={m} rotulo="Número do tubo" valor={!dispositivo || dispositivo === "TOT" ? t(g.numero) : ""} largura={5} sufixo=","
              onMudar={(v) => geral({ numero: v, dispositivo: v ? "TOT" : "" })} />
            {dispositivo && dispositivo !== "TOT" && (
              <Op m={m} rotulo={`${dispositivo}${t(g.numero) ? ` ${t(g.numero)}` : ""}`} marcado
                onClick={() => geral({ dispositivo: "", numero: "" })} />
            )}
            <Txt>VM:</Txt>
            <Op m={m} rotulo="VCV" marcado={modo === "VCV"} onClick={() => geral({ modo: modo === "VCV" ? "" : "VCV" })} />
            <Linha m={m} rotulo="Volume corrente, em mL" valor={t(g.vc)} largura={4} sufixo="ml" numerico
              onMudar={(v) => geral({ vc: v, modo: v && !modo ? "VCV" : modo })} />
            <Op m={m} rotulo="PCV" marcado={modo === "PCV"} onClick={() => geral({ modo: modo === "PCV" ? "" : "PCV" })} />
            <Linha m={m} rotulo="Pressão inspiratória (PCV)" valor={t(g.pcv)} largura={3} sufixo="," numerico
              onMudar={(v) => geral({ pcv: v, modo: v && !modo ? "PCV" : modo })} />
            {modo && modo !== "VCV" && modo !== "PCV" && <Op m={m} rotulo={modo} marcado onClick={() => geral({ modo: "" })} />}
            <Txt>PEEP</Txt>
            <Linha m={m} rotulo="PEEP" valor={t(g.peep)} largura={3} sufixo="," numerico onMudar={(v) => geral({ peep: v })} />
            <Txt>FR</Txt>
            <Linha m={m} rotulo="Frequência respiratória" valor={t(g.fr)} largura={3} sufixo="." numerico onMudar={(v) => geral({ fr: v })} />
          </div>

          <div className="evoRLinha">
            <Op m={m} rotulo="Sedação, com ventilação:" marcado={tem("sedacao")} onClick={() => alternarTecnica("sedacao")} />
            {VENTILACAO.map(([v, rot]) => (
              <Op key={v} m={m} rotulo={rot} marcado={ventilacao.includes(v)} onClick={() => sedacao({ ventilacao: alternar(ventilacao, v) })} />
            ))}
            <Txt>e</Txt>
            <Op m={m} rotulo="guedel" marcado={ventilacao.includes("Guedel")} onClick={() => sedacao({ ventilacao: alternar(ventilacao, "Guedel") })} />
            {tem("local_assistida") && <Op m={m} rotulo="local assistida" marcado onClick={() => alternarTecnica("local_assistida")} />}
          </div>

          <div className="evoRLinha">
            <Op m={m} rotulo="Bloqueio:" marcado={tem("bloqueio_periferico")} onClick={() => alternarTecnica("bloqueio_periferico")} />
            <Op m={m} rotulo="com Auxílio de USG" marcado={b.usg === true} onClick={() => bloqueio({ usg: b.usg !== true })} />
            {BLOQUEIOS_DO_PAPEL.map(([v, rot]) => (
              <Op key={v} m={m} rotulo={rot} marcado={tiposDeBloqueio.includes(v)} onClick={() => bloqueio({ tipos: alternar(tiposDeBloqueio, v) })} />
            ))}
            <Linha m={m} rotulo="Outro bloqueio" valor={t(b.outro)} largura={16} sugestoes="evoOutrosBloqueios"
              onMudar={(v) => bloqueio({
                outro: v,
                tipos: v.trim() && !tiposDeBloqueio.includes("Outro") ? [...tiposDeBloqueio, "Outro"] : tiposDeBloqueio,
              })} />
            {extrasBloqueio.map((x) => (
              <Op key={x} m={m} rotulo={x} marcado onClick={() => bloqueio({ tipos: alternar(tiposDeBloqueio, x) })} />
            ))}
          </div>
        </div>
      </div>

      <div className="evoRLinha larga alta">
        <b>Cirurgia:</b>
        <Linha m={m} rotulo="Cirurgia" valor={t(dados.procedimento)} largura={48} onMudar={(v) => mudar({ procedimento: v })} />
      </div>
      <div className="evoRLinha larga">
        <b>Cirurgião:</b>
        <Linha m={m} rotulo="Cirurgião" valor={t(dados.cirurgiao)} largura={36} onMudar={(v) => mudar({ cirurgiao: v })} />
      </div>

      <div className="evoRBase">
        <div className="evoRCel inicio" title={m.impresso ? undefined : "Vem do evento de início da anestesia, no gráfico"}>
          <b>Início:</b><span className="evoRValor">{h(marcos.inicioAnestesia)}</span>
        </div>
        <div className="evoRCel fim" title={m.impresso ? undefined : "Vem do evento de fim da anestesia, no gráfico"}>
          <b>Fim:</b><span className="evoRValor">{h(marcos.fimAnestesia)}</span>
        </div>
        <div className="evoRCel caixa" aria-hidden="true" />

        <div className="evoRCel alta">
          <b>Alta da sala p/</b>
          {["RPA", "UTI"].map((d) => (
            <Op key={d} m={m} rotulo={d} marcado={saida.destino === d} onClick={() => mudarSaida({ destino: saida.destino === d ? "" : d })} />
          ))}
          {t(saida.destino) && saida.destino !== "RPA" && saida.destino !== "UTI" && (
            <Op m={m} rotulo={saida.destino === "Outro" ? t(saida.destino_outro) || "outro" : t(saida.destino)} marcado
              onClick={() => mudarSaida({ destino: "" })} />
          )}
          <b className="depois">Condições:</b>
          {["Consciente", "Intubado"].map((c) => (
            <Op key={c} m={m} rotulo={c.toUpperCase()} marcado={saida.consciencia === c}
              onClick={() => mudarSaida({ consciencia: saida.consciencia === c ? "" : c })} />
          ))}
          {t(saida.consciencia) && saida.consciencia !== "Consciente" && saida.consciencia !== "Intubado" && (
            <Op m={m} rotulo={t(saida.consciencia).toUpperCase()} marcado onClick={() => mudarSaida({ consciencia: "" })} />
          )}
        </div>

        <div className="evoRCel estavel">
          <Op m={m} rotulo="ESTÁVEL" marcado={saida.estavel === true} onClick={() => mudarSaida({ estavel: saida.estavel !== true })} />
          <Txt>PA</Txt>
          <Linha m={m} rotulo="PA sistólica na saída" valor={paS} largura={3} numerico onMudar={(v) => mudarPa(v, paD)} />
          <Txt>/</Txt>
          <Linha m={m} rotulo="PA diastólica na saída" valor={paD} largura={3} numerico onMudar={(v) => mudarPa(paS, v)} />
          <Txt>FC</Txt>
          <Linha m={m} rotulo="FC na saída" valor={t(saida.fc)} largura={3} numerico onMudar={(v) => mudarSaida({ fc: v })} />
          <Txt>SAT</Txt>
          <Linha m={m} rotulo="Saturação na saída" valor={t(saida.spo2).replace(/%$/, "")} largura={3} sufixo="%" numerico
            onMudar={(v) => mudarSaida({ spo2: v })} />
          {["Sem O₂", "Com O₂"].map((o) => (
            <Op key={o} m={m} rotulo={o.toUpperCase()} marcado={saida.oxigenio === o}
              onClick={() => mudarSaida({ oxigenio: saida.oxigenio === o ? "" : o })} />
          ))}
        </div>

        <div className="evoRCel aldrete">
          <b>Alta da RPA c/ Aldrete:</b>
          <Linha m={m} rotulo="Aldrete na alta da RPA" valor={t(saida.aldrete)} largura={3} numerico
            onMudar={(v) => mudarSaida({ aldrete: v })} />
          {!m.impresso && !leitura && (
            // Os cinco critérios ficam guardados aqui, fora do desenho do papel: tocar soma sozinho.
            <details className="evoRCalc">
              <summary>somar</summary>
              <div className="evoRCalcPainel">
                {ALDRETE.map((c) => (
                  <div key={c.chave} className="evoRCalcItem" role="group" aria-label={c.nome}>
                    <span>{c.nome.replace(" (PA)", "")}</span>
                    {[0, 1, 2].map((v) => (
                      <button type="button" key={v} className={`evoOpNum${pontos[c.chave] === v ? " marcado" : ""}`}
                        aria-pressed={pontos[c.chave] === v} title={`${v} · ${c.opcoes[v]}`}
                        onClick={() => mudarAldrete(c.chave, v)}>{v}</button>
                    ))}
                  </div>
                ))}
                <p aria-live="polite">{somaMarcada === null ? "Marque os cinco critérios." : `Soma: ${somaMarcada}`}</p>
              </div>
            </details>
          )}
        </div>

        <div className="evoRCel medico">
          <small>Médico anestesista:</small>
          {m.impresso ? (
            <>
              <b className="evoRNome">{responsavel?.nome.toUpperCase() ?? ""}</b>
              <span className="evoRCrm">{responsavel?.crm ? `CRM-${responsavel.uf || "—"}: ${crmEscrito(responsavel.crm)}` : ""}</span>
              {demais.filter((x) => x.nome.trim()).map((x) => (
                <span key={`${x.funcao}${x.nome}`} className="evoRDemais">
                  {FUNCOES[x.funcao]}{x.funcao === "residente" && x.ano_residencia ? ` ${x.ano_residencia}` : ""}: {x.nome}
                  {x.crm ? ` · CRM-${x.uf || "—"} ${crmEscrito(x.crm)}` : ""}
                </span>
              ))}
            </>
          ) : (
            <>
              {(responsavel ? [responsavel, ...demais] : demais).map((x, i) => (
                <div key={i} className={`evoRProfissional${x.funcao === "responsavel" ? " principal" : ""}`}>
                  {x.funcao !== "responsavel" && <small>{FUNCOES[x.funcao]}</small>}
                  <input className="nome" list="evoMedicosRodape" value={x.nome} disabled={leitura} aria-label={FUNCOES[x.funcao]}
                    onChange={(e) => {
                      const achado = medicos.find((y) => y.nome === e.target.value);
                      trocarProfissional(x, achado
                        ? { nome: achado.nome, crm: achado.crm.replace(/\D/g, "") || achado.crm, perfil_id: achado.id }
                        : { nome: e.target.value, perfil_id: null });
                    }} />
                  <span className="evoRCrm">
                    CRM-
                    <input className="uf" value={x.uf} maxLength={2} disabled={leitura} aria-label="UF do CRM"
                      onChange={(e) => trocarProfissional(x, { uf: e.target.value.toUpperCase() })} />
                    :
                    <input className="crm" value={x.crm} disabled={leitura} aria-label="Número do CRM" inputMode="numeric"
                      onChange={(e) => trocarProfissional(x, { crm: e.target.value })} />
                    {x.funcao === "residente" && (
                      <select value={x.ano_residencia ?? "R1"} disabled={leitura} aria-label="Ano da residência"
                        onChange={(e) => trocarProfissional(x, { ano_residencia: e.target.value as "R1" })}>
                        <option>R1</option><option>R2</option><option>R3</option>
                      </select>
                    )}
                  </span>
                  {!leitura && x.funcao !== "responsavel" && (
                    <button type="button" className="evoOp evoRRemover" onClick={() => mudarEquipe(equipe.filter((y) => y !== x))}>
                      Remover {FUNCOES[x.funcao].toLowerCase()}
                    </button>
                  )}
                </div>
              ))}
              {!leitura && (!equipe.some((x) => x.funcao === "residente") || !equipe.some((x) => x.funcao === "preceptor")) && (
                <div className="evoRMais">
                  {!equipe.some((x) => x.funcao === "residente") && (
                    <button type="button" className="evoOp" onClick={() => mudarEquipe([...equipe, { perfil_id: null, nome: "", crm: "", uf: "PR", funcao: "residente", ano_residencia: "R1" }])}>+ residente</button>
                  )}
                  {!equipe.some((x) => x.funcao === "preceptor") && (
                    <button type="button" className="evoOp" onClick={() => mudarEquipe([...equipe, { perfil_id: null, nome: "", crm: "", uf: "PR", funcao: "preceptor" }])}>+ preceptor</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
