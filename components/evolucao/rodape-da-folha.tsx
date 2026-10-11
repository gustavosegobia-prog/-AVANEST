"use client";

import { BLOQUEIOS, FUNCOES, POSICOES, PROTECOES, type Profissional } from "@/lib/evolucao/folha";
import { ALDRETE, somaAldrete } from "@/lib/evolucao/lista-da-folha";
import { horaLocal } from "@/lib/data-local";

// O rodapé da ficha de papel, clicável.
//
// Posições, técnica, cirurgia, horários, alta da sala, Aldrete e o médico
// anestesista, na ordem e no desenho da folha impressa. Cada "○" do papel é
// um toque; cada "____" é um campo curto na própria linha. Marcar um detalhe
// (paramediana, cateter, VCV…) já marca a técnica a que ele pertence.
//
// Grava no cabeçalho da folha (com histórico na auditoria), como antes: o
// formato dos dados é o mesmo das seções antigas, e a impressão lê igual.

type Dados = Record<string, unknown>;
type Mudar = (m: Dados) => void;
const t = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const sub = (d: Dados, k: string) => ((d[k] as Dados | undefined) ?? {});
const lista = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

/** O "○" do papel: um toque marca, outro desmarca. */
function Op({ marcado, rotulo, onClick, leitura }: { marcado: boolean; rotulo: string; onClick: () => void; leitura: boolean }) {
  return (
    <button type="button" className={`evoOp${marcado ? " marcado" : ""}`} aria-pressed={marcado} disabled={leitura}
      onClick={onClick}>
      <i aria-hidden="true">{marcado ? "◉" : "○"}</i>{rotulo}
    </button>
  );
}

/** O "____" do papel: um campo curto na própria linha. */
function Linha({ valor, onMudar, largura = 6, rotulo, leitura, sufixo, numerico }: {
  valor: string; onMudar: (v: string) => void; largura?: number; rotulo: string; leitura: boolean;
  sufixo?: string; numerico?: boolean;
}) {
  return (
    <label className="evoLinhaCampo">
      <input value={valor} onChange={(e) => onMudar(e.target.value)} disabled={leitura} aria-label={rotulo}
        style={{ width: `${largura + 1.5}ch` }} inputMode={numerico ? "decimal" : undefined} />
      {sufixo && <span>{sufixo}</span>}
    </label>
  );
}

export function RodapeDaFolha({ dados, onMudar, leitura, marcos, medicos }: {
  dados: Dados; onMudar: Mudar; leitura: boolean;
  marcos: { inicioAnestesia: string | null; fimAnestesia: string | null; inicioCirurgia: string | null; fimCirurgia: string | null };
  medicos: Array<{ id: string; nome: string; crm: string }>;
}) {
  const tecnicas = lista(dados.tecnicas);
  const det = sub(dados, "tecnica_detalhes");
  const g = sub(det, "geral"), r = sub(det, "raqui"), p = sub(det, "peridural"), s = sub(det, "sedacao"), b = sub(det, "bloqueio");
  const saida = sub(dados, "saida");
  const pontos = sub(saida, "aldrete_pontos");
  const totalAldrete = somaAldrete(pontos);
  const posicoes = lista(dados.posicoes), protecoes = lista(dados.protecoes);
  const equipe = (dados.equipe as Profissional[] | undefined) ?? [];

  const tem = (c: string) => tecnicas.includes(c);
  const alternar = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const comTecnica = (c: string) => (tem(c) ? tecnicas : [...tecnicas, c]);
  // Um detalhe da técnica: grava o detalhe e garante a técnica marcada.
  function detalhe(grupo: string, campo: string, v: unknown, tecnica: string) {
    onMudar({
      tecnicas: comTecnica(tecnica),
      tecnica_detalhes: { ...det, [grupo]: { ...sub(det, grupo), [campo]: v } },
    });
  }
  const mudarSaida = (campo: string, v: unknown) => onMudar({ saida: { ...saida, [campo]: v } });
  function mudarAldrete(chave: string, v: number) {
    const novos = { ...pontos, [chave]: pontos[chave] === v ? undefined : v };
    const soma = somaAldrete(novos);
    onMudar({ saida: { ...saida, aldrete_pontos: novos, aldrete: soma !== null ? String(soma) : "" } });
  }
  const mudarEquipe = (nova: Profissional[]) => onMudar({ equipe: nova });
  function trocarProfissional(alvo: Profissional, m: Partial<Profissional>) {
    mudarEquipe(equipe.map((x) => (x === alvo ? { ...x, ...m } : x)));
  }

  // Espaço da raqui no desenho do papel: L__-L__.
  const espaco = /^L?(\d*)\s*-\s*L?(\d*)$/i.exec(t(r.espaco)) ?? ["", "", ""];
  const mudarEspaco = (a: string, z: string) => detalhe("raqui", "espaco", a || z ? `L${a}-L${z}` : "", "raquianestesia");

  const h = (iso: string | null) => (iso ? horaLocal(new Date(iso)) : "—");
  const responsavel = equipe.find((x) => x.funcao === "responsavel");

  return (
    <section className="evoPapel evoRodape" aria-label="Técnica, cirurgia e alta">
      <div className="evoRLinha">
        <b>Posições:</b>
        {POSICOES.map((x) => (
          <Op key={x} rotulo={x} marcado={posicoes.includes(x)} leitura={leitura}
            onClick={() => onMudar({ posicoes: alternar(posicoes, x) })} />
        ))}
        <b>Proteções:</b>
        {PROTECOES.map((x) => (
          <Op key={x} rotulo={x.replace("Coxim — ", "coxim ")} marcado={protecoes.includes(x)} leitura={leitura}
            onClick={() => onMudar({ protecoes: alternar(protecoes, x) })} />
        ))}
      </div>

      <div className="evoRTecnica">
        <div className="evoRTira" aria-hidden="true">Técnica</div>
        <div className="evoRTecnicaLinhas">
          <div className="evoRLinha">
            <Op rotulo="Raquianestesia" marcado={tem("raquianestesia")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "raquianestesia") })} />
            <span className="evoRTexto">L</span>
            <Linha rotulo="Espaço, de" valor={espaco[1]} largura={2} leitura={leitura} numerico onMudar={(v) => mudarEspaco(v, espaco[2])} />
            <span className="evoRTexto">-L</span>
            <Linha rotulo="Espaço, até" valor={espaco[2]} largura={2} leitura={leitura} numerico onMudar={(v) => mudarEspaco(espaco[1], v)} />
            <Op rotulo="paramediana" marcado={r.abordagem === "Paramediana"} leitura={leitura}
              onClick={() => detalhe("raqui", "abordagem", r.abordagem === "Paramediana" ? "" : "Paramediana", "raquianestesia")} />
            <Op rotulo="mediana" marcado={r.abordagem === "Mediana"} leitura={leitura}
              onClick={() => detalhe("raqui", "abordagem", r.abordagem === "Mediana" ? "" : "Mediana", "raquianestesia")} />
            <span className="evoRTexto">agulha</span>
            <Linha rotulo="Agulha da raqui" valor={t(r.agulha)} largura={8} leitura={leitura}
              onMudar={(v) => detalhe("raqui", "agulha", v, "raquianestesia")} />
            <Op rotulo="LCR claro" marcado={r.lcr_claro === true} leitura={leitura}
              onClick={() => detalhe("raqui", "lcr_claro", r.lcr_claro !== true, "raquianestesia")} />
            <Op rotulo="punção única" marcado={r.puncao_unica === true} leitura={leitura}
              onClick={() => detalhe("raqui", "puncao_unica", r.puncao_unica !== true, "raquianestesia")} />
            <Op rotulo="Peridural" marcado={tem("peridural")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "peridural") })} />
            <Linha rotulo="Espaço da peridural" valor={t(p.espaco)} largura={6} leitura={leitura}
              onMudar={(v) => detalhe("peridural", "espaco", v, "peridural")} />
            <Op rotulo="cateter" marcado={p.cateter === true} leitura={leitura}
              onClick={() => detalhe("peridural", "cateter", p.cateter !== true, "peridural")} />
            <Linha rotulo="Cateter na pele, em cm" valor={t(p.cateter_cm)} largura={3} sufixo="cm" leitura={leitura} numerico
              onMudar={(v) => detalhe("peridural", "cateter_cm", v, "peridural")} />
            <Op rotulo="combinada" marcado={tem("combinada")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "combinada") })} />
          </div>

          <div className="evoRLinha">
            <span className="evoRTexto forte">Anestesia geral</span>
            <Op rotulo="balanceada" marcado={tem("geral_balanceada")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "geral_balanceada") })} />
            <Op rotulo="inalatória" marcado={tem("geral_inalatoria")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "geral_inalatoria") })} />
            <Op rotulo="venosa total" marcado={tem("geral_venosa_total")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "geral_venosa_total") })} />
            {["TOT", "Máscara laríngea", "Máscara facial", "Traqueostomia"].map((d) => (
              <Op key={d} rotulo={d} marcado={g.dispositivo === d} leitura={leitura}
                onClick={() => detalhe("geral", "dispositivo", g.dispositivo === d ? "" : d,
                  tecnicas.some((c) => c.startsWith("geral")) ? tecnicas.find((c) => c.startsWith("geral"))! : "geral_balanceada")} />
            ))}
            <span className="evoRTexto">nº</span>
            <Linha rotulo="Número do tubo" valor={t(g.numero)} largura={10} leitura={leitura}
              onMudar={(v) => onMudar({ tecnica_detalhes: { ...det, geral: { ...g, numero: v } } })} />
            <span className="evoRTexto">VM:</span>
            {["VCV", "PCV", "PSV", "Espontânea"].map((m) => (
              <Op key={m} rotulo={m} marcado={g.modo === m} leitura={leitura}
                onClick={() => onMudar({ tecnica_detalhes: { ...det, geral: { ...g, modo: g.modo === m ? "" : m } } })} />
            ))}
            <span className="evoRTexto">VC</span>
            <Linha rotulo="Volume corrente" valor={t(g.vc)} largura={4} sufixo="mL" leitura={leitura} numerico
              onMudar={(v) => onMudar({ tecnica_detalhes: { ...det, geral: { ...g, vc: v } } })} />
            <span className="evoRTexto">P</span>
            <Linha rotulo="Pressão (PCV)" valor={t(g.pcv)} largura={3} leitura={leitura} numerico
              onMudar={(v) => onMudar({ tecnica_detalhes: { ...det, geral: { ...g, pcv: v } } })} />
            <span className="evoRTexto">PEEP</span>
            <Linha rotulo="PEEP" valor={t(g.peep)} largura={3} leitura={leitura} numerico
              onMudar={(v) => onMudar({ tecnica_detalhes: { ...det, geral: { ...g, peep: v } } })} />
            <span className="evoRTexto">FR</span>
            <Linha rotulo="Frequência respiratória" valor={t(g.fr)} largura={3} leitura={leitura} numerico
              onMudar={(v) => onMudar({ tecnica_detalhes: { ...det, geral: { ...g, fr: v } } })} />
            <span className="evoRTexto">Cormack</span>
            <Linha rotulo="Cormack-Lehane" valor={t(g.cormack)} largura={2} leitura={leitura}
              onMudar={(v) => onMudar({ tecnica_detalhes: { ...det, geral: { ...g, cormack: v } } })} />
          </div>

          <div className="evoRLinha">
            <Op rotulo="Sedação" marcado={tem("sedacao")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "sedacao") })} />
            <span className="evoRTexto">ventilação:</span>
            {["Espontânea sob cateter de O₂", "Assistida sob máscara", "Guedel"].map((v) => (
              <Op key={v} rotulo={v} marcado={lista(s.ventilacao).includes(v)} leitura={leitura}
                onClick={() => detalhe("sedacao", "ventilacao", alternar(lista(s.ventilacao), v), "sedacao")} />
            ))}
            <Op rotulo="Local assistida" marcado={tem("local_assistida")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "local_assistida") })} />
          </div>

          <div className="evoRLinha">
            <Op rotulo="Bloqueio" marcado={tem("bloqueio_periferico")} leitura={leitura}
              onClick={() => onMudar({ tecnicas: alternar(tecnicas, "bloqueio_periferico") })} />
            <Op rotulo="com USG" marcado={b.usg === true} leitura={leitura}
              onClick={() => detalhe("bloqueio", "usg", b.usg !== true, "bloqueio_periferico")} />
            {BLOQUEIOS.map((x) => (
              <Op key={x} rotulo={x} marcado={lista(b.tipos).includes(x)} leitura={leitura}
                onClick={() => detalhe("bloqueio", "tipos", alternar(lista(b.tipos), x), "bloqueio_periferico")} />
            ))}
            <span className="evoRTexto">lado</span>
            <Linha rotulo="Lado do bloqueio" valor={t(b.lado)} largura={5} leitura={leitura}
              onMudar={(v) => detalhe("bloqueio", "lado", v, "bloqueio_periferico")} />
          </div>
        </div>
      </div>

      <div className="evoRLinha larga">
        <b>Cirurgia:</b>
        <Linha rotulo="Cirurgia" valor={t(dados.procedimento)} largura={48} leitura={leitura} onMudar={(v) => onMudar({ procedimento: v })} />
      </div>
      <div className="evoRLinha larga">
        <b>Cirurgião:</b>
        <Linha rotulo="Cirurgião" valor={t(dados.cirurgiao)} largura={36} leitura={leitura} onMudar={(v) => onMudar({ cirurgiao: v })} />
      </div>

      <div className="evoRBase">
        <div className="evoRBaseEsq">
          <div className="evoRLinha">
            <b>Início:</b><span className="evoRValor">{h(marcos.inicioAnestesia)}</span>
            <b>Fim:</b><span className="evoRValor">{h(marcos.fimAnestesia)}</span>
            <span className="evoRTexto">cirurgia {h(marcos.inicioCirurgia)} às {h(marcos.fimCirurgia)} · pelos eventos do gráfico</span>
          </div>
          <div className="evoRLinha">
            <b>Alta da sala p/</b>
            {["RPA", "UTI", "Enfermaria", "Outro"].map((d) => (
              <Op key={d} rotulo={d} marcado={saida.destino === d} leitura={leitura}
                onClick={() => mudarSaida("destino", saida.destino === d ? "" : d)} />
            ))}
            {saida.destino === "Outro" && (
              <Linha rotulo="Qual destino" valor={t(saida.destino_outro)} largura={12} leitura={leitura}
                onMudar={(v) => mudarSaida("destino_outro", v)} />
            )}
            <b>Condições:</b>
            {["Consciente", "Sonolento", "Sedado", "Intubado"].map((c) => (
              <Op key={c} rotulo={c.toLowerCase()} marcado={saida.consciencia === c} leitura={leitura}
                onClick={() => mudarSaida("consciencia", saida.consciencia === c ? "" : c)} />
            ))}
          </div>
          <div className="evoRLinha">
            <Op rotulo="Estável" marcado={saida.estavel === true} leitura={leitura} onClick={() => mudarSaida("estavel", saida.estavel !== true)} />
            <span className="evoRTexto">PA</span>
            <Linha rotulo="PA na saída" valor={t(saida.pa)} largura={7} leitura={leitura} onMudar={(v) => mudarSaida("pa", v)} />
            <span className="evoRTexto">FC</span>
            <Linha rotulo="FC na saída" valor={t(saida.fc)} largura={3} leitura={leitura} numerico onMudar={(v) => mudarSaida("fc", v)} />
            <span className="evoRTexto">SAT</span>
            <Linha rotulo="Saturação na saída" valor={t(saida.spo2)} largura={3} sufixo="%" leitura={leitura} numerico
              onMudar={(v) => mudarSaida("spo2", v)} />
            {["Sem O₂", "Com O₂"].map((o) => (
              <Op key={o} rotulo={o} marcado={saida.oxigenio === o} leitura={leitura}
                onClick={() => mudarSaida("oxigenio", saida.oxigenio === o ? "" : o)} />
            ))}
          </div>
          <div className="evoRLinha evoRAldrete">
            <b>Alta da RPA c/ Aldrete:</b>
            {ALDRETE.map((c) => (
              <span key={c.chave} className="evoRAldreteItem" role="group" aria-label={c.nome}>
                <span className="evoRTexto">{c.nome.replace(" (PA)", "")}</span>
                {[0, 1, 2].map((v) => (
                  <button type="button" key={v} className={`evoOpNum${pontos[c.chave] === v ? " marcado" : ""}`}
                    aria-pressed={pontos[c.chave] === v} title={`${v} · ${c.opcoes[v]}`} disabled={leitura}
                    onClick={() => mudarAldrete(c.chave, v)}>{v}</button>
                ))}
              </span>
            ))}
            <span className="evoRValor">= {totalAldrete ?? (t(saida.aldrete) || "—")}</span>
          </div>
        </div>

        <div className="evoRMedico">
          <small>Médico anestesista</small>
          <datalist id="evoMedicosRodape">{medicos.map((m) => <option key={m.id} value={m.nome} />)}</datalist>
          {(responsavel ? [responsavel, ...equipe.filter((x) => x !== responsavel)] : equipe).map((x, i) => (
            <div key={i} className="evoRProfissional">
              {x.funcao !== "responsavel" && (
                <small>{FUNCOES[x.funcao]}{x.funcao === "residente" ? ` ${x.ano_residencia ?? ""}` : ""}</small>
              )}
              <input className="nome" list="evoMedicosRodape" value={x.nome} disabled={leitura} aria-label={FUNCOES[x.funcao]}
                onChange={(e) => {
                  const m = medicos.find((y) => y.nome === e.target.value);
                  trocarProfissional(x, m ? { nome: m.nome, crm: m.crm.replace(/\D/g, "") || m.crm, perfil_id: m.id } : { nome: e.target.value, perfil_id: null });
                }} />
              <span className="evoRTexto">CRM-</span>
              <input className="uf" value={x.uf} maxLength={2} disabled={leitura} aria-label="UF do CRM"
                onChange={(e) => trocarProfissional(x, { uf: e.target.value.toUpperCase() })} />
              <input className="crm" value={x.crm} disabled={leitura} aria-label="Número do CRM" inputMode="numeric"
                onChange={(e) => trocarProfissional(x, { crm: e.target.value })} />
              {x.funcao === "residente" && (
                <select value={x.ano_residencia ?? "R1"} disabled={leitura} aria-label="Ano da residência"
                  onChange={(e) => trocarProfissional(x, { ano_residencia: e.target.value as "R1" })}>
                  <option>R1</option><option>R2</option><option>R3</option>
                </select>
              )}
              {!leitura && x.funcao !== "responsavel" && (
                <button type="button" className="evoOp" aria-label={`Remover ${FUNCOES[x.funcao]}`}
                  onClick={() => mudarEquipe(equipe.filter((y) => y !== x))}>×</button>
              )}
            </div>
          ))}
          {!leitura && (
            <div className="evoRLinha">
              {!equipe.some((x) => x.funcao === "residente") && (
                <button type="button" className="evoOp" onClick={() => mudarEquipe([...equipe, { perfil_id: null, nome: "", crm: "", uf: "PR", funcao: "residente", ano_residencia: "R1" }])}>+ residente</button>
              )}
              {!equipe.some((x) => x.funcao === "preceptor") && (
                <button type="button" className="evoOp" onClick={() => mudarEquipe([...equipe, { perfil_id: null, nome: "", crm: "", uf: "PR", funcao: "preceptor" }])}>+ preceptor</button>
              )}
            </div>
          )}
          <small className="evoRAssinar">Assinatura à mão na folha impressa</small>
        </div>
      </div>
    </section>
  );
}
