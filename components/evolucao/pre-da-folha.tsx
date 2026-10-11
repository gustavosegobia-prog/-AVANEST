// O topo da ficha de papel: a linha do paciente e a avaliação pré-anestésica,
// no desenho exato da folha do serviço.
//
// Uma grade só, como no papel: "Nome do paciente | Idade | Data" e, abaixo, a
// tira vertical "Avaliação Pré-Anestésica" com as cinco colunas de sinais e
// exames e a coluna dos aparelhos à direita. Rótulo e valor na mesma linha,
// linhas baixas — a folha inteira cabe na tela com pouca rolagem.
//
// Um componente para a tela e para a impressão: sem `onMudar` ele só desenha
// (é a folha impressa, no servidor). Cada célula grava no cabeçalho, com
// histórico na auditoria; peso, altura, ASA e alergias são os mesmos dados
// que as contas de dose e o alerta de alergia usam.

import type { ReactNode } from "react";
import { Icone } from "@/components/icone";
import { imcDaFolha } from "@/lib/evolucao/folha";
import { dataDoDia } from "@/lib/evolucao/impressao";
import { camposDoPapel, chaveDoCampo, type CampoDoPapel } from "@/lib/evolucao/pre-papel";
import { CampoDecimal } from "./campo-decimal";
import { Linha, Op, Txt, type Modo } from "./papel";

type Dados = Record<string, unknown>;
type Mudar = (m: Dados) => void;
const t = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const decimal = (v: unknown) => (typeof v === "number" ? String(v).replace(".", ",") : "");
const ASA_ROMANO = ["I", "II", "III", "IV", "V", "VI"];

/** Uma célula do papel: o rótulo e, na mesma linha, o que está escrito. */
function Celula({ m, area, rotulo, valor, onMudar, longo, alerta, children }: {
  m: Modo; area: string; rotulo: string; valor: string; onMudar: (v: string) => void;
  longo?: boolean; alerta?: boolean; children?: ReactNode;
}) {
  const nome = rotulo.replace(/:$/, "");
  return (
    <div className={`evoPFCel ${area}${alerta ? " alerta" : ""}`}>
      <span className="r">{rotulo}</span>
      {m.impresso ? <span className="v">{valor}</span>
        : longo ? <textarea rows={1} value={valor} disabled={m.leitura} aria-label={nome} onChange={(e) => onMudar(e.target.value)} />
        : <input value={valor} size={Math.max(4, valor.length + 1)} disabled={m.leitura} aria-label={nome}
          onChange={(e) => onMudar(e.target.value)} />}
      {children}
    </div>
  );
}

/** O número do ASA que se circula no papel. */
function NumeroAsa({ m, n, marcado, onClick }: { m: Modo; n: number; marcado: boolean; onClick: () => void }) {
  if (m.impresso) return <span className={`evoPFAsaN${marcado ? " marcado" : ""}`}>{n}</span>;
  return (
    <button type="button" className={`evoPFAsaN${marcado ? " marcado" : ""}`} aria-pressed={marcado} aria-label={`ASA ${n}`}
      disabled={m.leitura} onClick={onClick}>{n}</button>
  );
}

export function PreAnestesicaDaFolha({ dados, paciente, idade, idadeAnos = null, onMudar, leitura = false, aberta = true, onAlternar }: {
  dados: Dados;
  paciente: { nome: string; sexo: string | null };
  /** A idade como se escreve na ficha ("28 anos", "1 ano e 3 meses"). */
  idade: string;
  idadeAnos?: number | null;
  /** Sem ele, a folha só para ler: é a impressão. */
  onMudar?: Mudar;
  leitura?: boolean;
  /** Na tela, a avaliação pode ficar recolhida numa linha só. */
  aberta?: boolean;
  onAlternar?: () => void;
}) {
  const m: Modo = { impresso: !onMudar, leitura };
  const mudar: Mudar = onMudar ?? (() => {});
  const c = camposDoPapel(dados);
  const campo = (k: CampoDoPapel) => (v: string) => mudar({ [chaveDoCampo(k)]: v });
  const imc = imcDaFolha(dados);
  const imcTexto = imc !== null
    ? `IMC ${imc.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${idadeAnos !== null && idadeAnos < 18 ? " (percentil)" : ""}`
    : "";
  const asa = t(dados.asa);
  // Cirurgia de emergência: sim, não, ou sem resposta. A folha antiga só
  // guardava o "sim" (asa_emergencia); o "não" passa a ser escolha marcada.
  const emergencia = dados.emergencia === "sim" || dados.emergencia === "nao"
    ? dados.emergencia : dados.asa_emergencia === true ? "sim" : "";
  const marcarEmergencia = (v: "sim" | "nao") => mudar(emergencia === v
    ? { emergencia: "", asa_emergencia: false }
    : { emergencia: v, asa_emergencia: v === "sim" });
  const nega = dados.nega_alergia === true;
  const alergias = t(dados.alergias);
  const temAlergia = !nega && Boolean(alergias.trim());
  const recolhida = !m.impresso && !aberta;
  const origem = dados.preanestesica_origem as { importado_em?: string } | null | undefined;

  const linhaDoPaciente = (
    <>
      <div className="evoPFCel nome"><span className="r">Nome do paciente:</span><b className="v">{paciente.nome}</b></div>
      <div className="evoPFCel idade"><span className="r">Idade:</span><b className="v">{idade}</b></div>
      <div className="evoPFCel data"><span className="r">Data:</span><b className="v">{dataDoDia(t(dados.data_procedimento))}</b></div>
    </>
  );

  if (recolhida) {
    return (
      <section className="evoPapel evoPF" aria-label="Paciente e avaliação pré-anestésica">
        <div className="evoPFGrade recolhida">
          {linhaDoPaciente}
          <div className="evoPFCel resumo">
            <span className={temAlergia ? "evoPreAlergia" : undefined}>
              {temAlergia ? `Alergias: ${alergias}` : nega ? "Nega alergia a medicamentos" : "Alergias não informadas"}
            </span>
            <span className="evoPFResumo">
              {[decimal(dados.peso_kg) && `${decimal(dados.peso_kg)} kg`, imcTexto, asa && `ASA ${asa}${emergencia === "sim" ? " E" : ""}`,
                c.jejum_horas && `jejum > ${c.jejum_horas} h`].filter(Boolean).join(" · ")}
            </span>
            <button type="button" className="evoBotao pequeno secundario" aria-expanded={false} onClick={onAlternar}>
              Mostrar avaliação pré-anestésica
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`evoPapel evoPF${m.impresso ? " impresso" : ""}`} aria-label="Paciente e avaliação pré-anestésica">
      <div className="evoPFGrade">
        {linhaDoPaciente}

        {m.impresso || !onAlternar ? (
          <div className="evoPFTira"><span>Avaliação Pré-Anestésica</span></div>
        ) : (
          <button type="button" className="evoPFTira" aria-expanded onClick={onAlternar} title="Recolher a avaliação pré-anestésica">
            <span>Avaliação Pré-Anestésica</span>
            <Icone nome="seta" tamanho={14} />
          </button>
        )}

        <Celula m={m} area="conv" rotulo="Convênio:" valor={c.convenio} onMudar={campo("convenio")} />
        <div className="evoPFCel sexo"><span className="r">Sexo:</span><span className="v">{t(paciente.sexo)}</span></div>
        <Celula m={m} area="cor" rotulo="Cor:" valor={c.cor} onMudar={campo("cor")} />
        <div className="evoPFCel peso">
          <span className="r">Peso:</span>
          {m.impresso ? <span className="v">{decimal(dados.peso_kg) && `${decimal(dados.peso_kg)} kg`}</span> : <>
            <CampoDecimal valor={typeof dados.peso_kg === "number" ? dados.peso_kg : null} max={400} rotulo="Peso, em kg"
              leitura={leitura} onMudar={(v) => mudar({ peso_kg: v })} />
            <span className="u">kg</span>
          </>}
        </div>
        <div className="evoPFCel alt">
          <span className="r">Altura:</span>
          {m.impresso ? <span className="v">{decimal(dados.altura_cm) && `${decimal(dados.altura_cm)} cm`}</span> : <>
            <CampoDecimal valor={typeof dados.altura_cm === "number" ? dados.altura_cm : null} max={250} rotulo="Altura, em cm"
              leitura={leitura} onMudar={(v) => mudar({ altura_cm: v })} />
            <span className="u">cm</span>
          </>}
          {imcTexto && <small className="evoPFImc">{imcTexto}</small>}
        </div>
        <Celula m={m} area="resp" rotulo="Ap. Respiratório:" valor={c.ap_respiratorio} onMudar={campo("ap_respiratorio")} longo />

        <Celula m={m} area="pa" rotulo="Pressão Arterial:" valor={c.pa} onMudar={campo("pa")} />
        <Celula m={m} area="pulso" rotulo="Pulso:" valor={c.pulso} onMudar={campo("pulso")} />
        <Celula m={m} area="fr" rotulo="Respiração:" valor={c.respiracao} onMudar={campo("respiracao")} />
        <Celula m={m} area="temp" rotulo="Temperatura:" valor={c.temperatura} onMudar={campo("temperatura")} />
        <Celula m={m} area="tipo" rotulo="Tipo Sanguíneo:" valor={c.tipo_sanguineo} onMudar={campo("tipo_sanguineo")} />
        <Celula m={m} area="dig" rotulo="Ap. Digestivo:" valor={c.ap_digestivo} onMudar={campo("ap_digestivo")} longo>
          <span className="evoPFJejum">
            <Txt>jejum &gt;</Txt>
            <Linha m={m} rotulo="Jejum, em horas" valor={c.jejum_horas} largura={2} sufixo="h" numerico onMudar={campo("jejum_horas")} />
          </span>
        </Celula>

        <Celula m={m} area="tap" rotulo="TAP / INR:" valor={c.tap_inr} onMudar={campo("tap_inr")} />
        <Celula m={m} area="plaq" rotulo="Plaquetas:" valor={c.plaquetas} onMudar={campo("plaquetas")} />
        <Celula m={m} area="hb" rotulo="Hemoglobina:" valor={c.hemoglobina} onMudar={campo("hemoglobina")} />
        <Celula m={m} area="ht" rotulo="Hematócrito:" valor={c.hematocrito} onMudar={campo("hematocrito")} />
        <Celula m={m} area="glic" rotulo="Glicemia:" valor={c.glicemia} onMudar={campo("glicemia")} />
        <Celula m={m} area="circ" rotulo="Ap. Circulatório:" valor={c.ap_circulatorio} onMudar={campo("ap_circulatorio")} longo />

        <Celula m={m} area="cr" rotulo="Creatinina:" valor={c.creatinina} onMudar={campo("creatinina")} />
        <Celula m={m} area="outros" rotulo="Outros:" valor={c.exames_outros} onMudar={campo("exames_outros")} longo />
        <div className="evoPFCel asa">
          <div className="evoPFAsa" role="group" aria-label="ASA">
            <span className="r">ASA:</span>
            {ASA_ROMANO.slice(0, 5).map((r, i) => (
              <NumeroAsa key={r} m={m} n={i + 1} marcado={asa === r} onClick={() => mudar({ asa: asa === r ? "" : r })} />
            ))}
            {asa === "VI" && <NumeroAsa m={m} n={6} marcado onClick={() => mudar({ asa: "" })} />}
          </div>
          <div className="evoPFEmergencia" role="group" aria-label="Cirurgia de emergência">
            <span className="r">CIRURGIA DE EMERGÊNCIA:</span>
            <Op m={m} rotulo="SIM" marcado={emergencia === "sim"} onClick={() => marcarEmergencia("sim")} />
            <Op m={m} rotulo="NÃO" marcado={emergencia === "nao"} onClick={() => marcarEmergencia("nao")} />
          </div>
        </div>
        <Celula m={m} area="endo" rotulo="Ap. Endócrino:" valor={c.ap_endocrino} onMudar={campo("ap_endocrino")} longo />

        <Celula m={m} area="med" rotulo="Medicação em Uso:" valor={c.medicacao_uso} onMudar={campo("medicacao_uso")} longo />
        <Celula m={m} area="mental" rotulo="Estado Mental:" valor={c.estado_mental} onMudar={campo("estado_mental")} longo />
        <Celula m={m} area="obs" rotulo="Obs:" valor={c.observacoes_pre} onMudar={campo("observacoes_pre")} longo />
        <Celula m={m} area="anterior" rotulo="Anestesia Anterior" valor={c.anestesia_anterior} onMudar={campo("anestesia_anterior")} longo />
        <Celula m={m} area="diag" rotulo="Diagnóstico Pré - Operatório:" valor={c.diagnostico} onMudar={campo("diagnostico")} longo />
        <div className={`evoPFCel alerg${temAlergia ? " alerta" : ""}`}>
          <span className="r">Alergias:</span>
          {m.impresso ? <span className="v">{nega ? "" : alergias}</span> : (
            <textarea rows={1} value={nega ? "" : alergias} disabled={leitura || nega} aria-label="Alergias"
              onChange={(e) => mudar({ alergias: e.target.value, nega_alergia: false })} />
          )}
          <span className="evoPFNega">
            <Op m={m} rotulo="nega alergia a medicamentos" marcado={nega}
              onClick={() => mudar({ nega_alergia: !nega, ...(!nega ? { alergias: "" } : {}) })} />
          </span>
        </div>
      </div>

      {!m.impresso && (
        <p className="evoPreOrigem">
          {origem?.importado_em
            ? `Trazido da avaliação pré-anestésica em ${new Date(origem.importado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. Mudar aqui não altera a avaliação; fica no histórico da ficha.`
            : "Sem avaliação pré-anestésica no sistema para este paciente: preencha o que tiver."}
        </p>
      )}
    </section>
  );
}
