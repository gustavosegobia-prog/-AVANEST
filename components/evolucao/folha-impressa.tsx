import { RegistroImpresso } from "./registro-impresso";
import { RodapeDaFolha } from "./rodape-da-folha";
import { administrados, dosePorKg, exposicaoAnestesicoLocal, type Administracao } from "@/lib/evolucao/medicamentos";
import { equipeParaImpressao, horarioDoMarco, imcDaFolha, type Profissional } from "@/lib/evolucao/folha";
import { conferirAlergia } from "@/lib/evolucao/alergias";
import { camposDoPapel } from "@/lib/evolucao/pre-papel";
import { montarInfusoes, totalDaInfusao } from "@/lib/evolucao/infusoes";
import { balancoHidrico } from "@/lib/evolucao/liquidos";
import { consumoSevoflurano, formatarMl, lerAjuste } from "@/lib/evolucao/sevoflurano";
import {
  dataDoDia, dataHora, hora, idadeParaImpressao,
  janelasDaImpressao, marcasDeEvento, medicacaoPorGrupo, numero, type Janela,
} from "@/lib/evolucao/impressao";
import { num, type Registro } from "@/lib/evolucao/registros";

// A folha de anestesia em A4 retrato, no desenho da ficha de papel do
// serviço: cabeçalho, avaliação pré-anestésica, o registro no tempo com a
// medicação à direita, e embaixo técnica, cirurgia, saída e o anestesista.
//
// Dinâmica: só sai o que aconteceu. Medicação só administrada (planejado,
// preparado e cancelado ficam fora), equipe só quem foi vinculado, técnica só
// a feita. Procedimento de mais de três horas continua em outra folha, com o
// mesmo cabeçalho.
//
// Assinatura: um espaço para assinar à mão. Não há assinatura digital aqui, e
// a folha não finge ter uma.

type Dados = Record<string, unknown>;
const t = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v).replace(".", ",") : "");

export type DadosDaImpressao = {
  folha: {
    id: string; status: "aberta" | "encerrada"; versao: number; intervalo_minutos: number;
    dados: Dados; inicio_em: string; encerrada_em: string | null; created_at: string;
  };
  paciente: {
    nome: string; data_nascimento: string | null; idade_anos: number | null; sexo: string | null;
  };
  vigentes: Registro[];
  instituicao: string;
  impressoPor: string;
  encerradaPor: string | null;
  agora: string;
};

export function FolhaImpressa(p: DadosDaImpressao) {
  const { folha, paciente, vigentes, agora } = p;
  const d = folha.dados;
  const peso = num(d.peso_kg);
  const aberta = folha.status === "aberta";

  const inicioAnestesia = horarioDoMarco(vigentes, "inicio_anestesia");
  const fimAnestesia = horarioDoMarco(vigentes, "fim_anestesia");
  const ultimo = vigentes.reduce((m, r) => Math.max(m, Date.parse(r.momento)), 0);
  const primeiro = vigentes.reduce((m, r) => Math.min(m, Date.parse(r.momento)), Number.POSITIVE_INFINITY);
  // O fim do papel: o fim da anestesia, ou o último registro. Folha aberta
  // impressa no dia seguinte não ganha horas que ninguém registrou — a mesma
  // regra das infusões sem término.
  const fimMs = Math.max(fimAnestesia ? Date.parse(fimAnestesia) : ultimo, ultimo);
  const inicioMs = Math.min(Number.isFinite(primeiro) ? primeiro : Date.parse(folha.inicio_em), Date.parse(folha.inicio_em));
  const janelas = janelasDaImpressao(inicioMs, fimMs);

  const meds = administrados(vigentes);
  const porId = new Map(vigentes.map((r) => [r.id, r]));
  const sevo = consumoSevoflurano(vigentes.map(lerAjuste).filter((a) => a !== null), new Date(fimMs).toISOString());
  const infusoes = montarInfusoes(vigentes);
  const balanco = balancoHidrico(vigentes, peso);
  const locais = exposicaoAnestesicoLocal(meds, peso);
  const equipe = equipeParaImpressao((d.equipe as Profissional[] | undefined) ?? []);
  const responsavel = equipe.find((e) => e.funcao === "responsavel") ?? null;
  const eventos = marcasDeEvento(vigentes).filter((e) => e.simbolo !== "X" && e.simbolo !== "O");
  const intercorrencias = vigentes.filter((r) => r.tipo === "evento" && r.dados.codigo === "intercorrencia");

  const idade = idadeParaImpressao(paciente.data_nascimento, new Date(`${t(d.data_procedimento) || agora.slice(0, 10)}T12:00:00-03:00`), paciente.idade_anos);
  const crm = (e: Profissional) => (e.crm ? `CRM-${e.uf || "—"} ${e.crm}` : "");

  const cabecalho = (n: number) => (
    <>
      <header className="imprTopo">
        <div className="imprInstituicao">{p.instituicao || t(d.hospital) || "Serviço de anestesiologia"}</div>
        <h1>FICHA ANESTÉSICA</h1>
        <div className="imprResponsavel">{responsavel?.nome.toUpperCase() ?? ""}</div>
      </header>
      {aberta && (
        <p className="imprRascunho">Ficha ABERTA — rascunho sujeito a alteração. Impresso em {dataHora(agora)}.</p>
      )}
      <div className="imprPaciente">
        <span className="largo"><small>Nome do paciente</small>{paciente.nome}</span>
        <span><small>Idade</small>{idade}</span>
        <span><small>Data</small>{dataDoDia(t(d.data_procedimento))}</span>
        {n > 0 && <span><small>Continuação</small>página {n + 1}</span>}
      </div>
    </>
  );

  const rodape = (n: number) => (
    // div, e não <footer>: a regra antiga de `footer` do site pinta um bloco escuro de 125px.
    <div className="imprRodape">
      <span>
        Gerado pelo AVANEST a partir dos registros da folha · impresso em {dataHora(agora)} por {p.impressoPor}
        {folha.status === "encerrada" && folha.encerrada_em
          ? ` · versão ${folha.versao}, encerrada em ${dataHora(folha.encerrada_em)}${p.encerradaPor ? ` por ${p.encerradaPor}` : ""}`
          : " · ficha aberta"}
      </span>
      <span>Página {n + 1} de {janelas.length}</span>
    </div>
  );

  return (
    <div className="imprFolhas">
      {janelas.map((janela, n) => (
        <article className="imprFolha" key={janela.inicio}>
          {cabecalho(n)}

          {n === 0 && <PreAnestesica d={d} sexo={paciente.sexo} />}

          <div className="imprCorpo">
            <div className="imprTempo">
              <RegistroImpresso vigentes={vigentes} janela={janela} fimMs={fimMs} intervalo={folha.intervalo_minutos} chave={String(n)} />
              <Legendas
                eventos={eventos.filter((e) => Date.parse(e.momento) >= janela.inicio && Date.parse(e.momento) < janela.fim)}
                sevo={n === janelas.length - 1 ? sevo.totalMl : null}
                aberta={aberta}
                infusoes={n === janelas.length - 1 ? infusoes.map((inf) => ({
                  inf, total: totalDaInfusao(inf, peso),
                  alergia: (porId.get(inf.id)?.dados.alerta_alergia ?? conferirAlergia(d, inf.nome)) as
                    { alergias?: string; justificativa?: string | null } | null,
                })) : []}
                balanco={n === janelas.length - 1 ? balanco : null}
              />
              {n === 0 && (
                <div className="imprObservacoes">
                  <small>Observações e intercorrências</small>
                  {intercorrencias.map((r) => <p key={r.id}>{hora(r.momento)} — {t(r.dados.descricao) || "Intercorrência"}</p>)}
                  {t(d.observacoes) && <p>{t(d.observacoes)}</p>}
                </div>
              )}
            </div>
            <Medicacao
              lista={n === 0 ? meds : meds.filter((a) => noPeriodo(a, janela))}
              titulo={n === 0 ? "MEDICAÇÃO ADMINISTRADA" : "MEDICAÇÃO NESTE PERÍODO"}
              porId={porId} peso={peso} locais={n === 0 ? locais : []} cabecalho={d}
              tecnicas={Array.isArray(d.tecnicas) ? (d.tecnicas as string[]) : []}
            />
          </div>

          {n === 0 && <RodapeDaFolha dados={{ ...d, equipe }} marcos={{ inicioAnestesia, fimAnestesia }} />}

          {n > 0 && (
            <div className="imprAssinaturaCurta">
              <span className="imprLinhaAssinar" aria-hidden="true" />
              <small>{responsavel ? `${responsavel.nome} · ${crm(responsavel)}` : "Médico anestesista"} — assinatura e carimbo</small>
            </div>
          )}

          {rodape(n)}
        </article>
      ))}
    </div>
  );
}

const noPeriodo = (a: Administracao, j: Janela) => Date.parse(a.momento) >= j.inicio && Date.parse(a.momento) < j.fim;

/**
 * A pré-anestésica no desenho exato da ficha: cinco colunas à esquerda, os
 * aparelhos à direita. Campo vazio sai vazio, com a linha para escrever à mão.
 */
function PreAnestesica({ d, sexo }: { d: Dados; sexo: string | null }) {
  const c = camposDoPapel(d);
  const asa = t(d.asa);
  const imc = imcDaFolha(d);
  const alergia = d.nega_alergia === true ? "Nega alergia a medicamentos" : t(d.alergias) || "Não informado";
  const campo = (rotulo: string, valor: string, classe = "") => (
    <span className={classe}><small>{rotulo}</small>{valor}</span>
  );
  return (
    <section className="imprPre" aria-label="Avaliação pré-anestésica">
      <div className="imprPreTira">Avaliação pré-anestésica</div>
      <div className="imprPreGrade papel">
        {campo("Convênio", c.convenio)}
        {campo("Sexo", t(sexo))}
        {campo("Cor", c.cor)}
        {campo("Peso", t(d.peso_kg) ? `${t(d.peso_kg)} kg` : "")}
        {campo("Altura", t(d.altura_cm) ? `${t(d.altura_cm)} cm${imc !== null ? ` · IMC ${numero(imc, 1)}` : ""}` : "")}
        {campo("Ap. respiratório", c.ap_respiratorio, "direita")}
        {campo("Pressão arterial", c.pa)}
        {campo("Pulso", c.pulso)}
        {campo("Respiração", c.respiracao)}
        {campo("Temperatura", c.temperatura)}
        {campo("Tipo sanguíneo", c.tipo_sanguineo)}
        {campo("Ap. digestivo", c.ap_digestivo, "direita")}
        {campo("TAP / INR", c.tap_inr)}
        {campo("Plaquetas", c.plaquetas)}
        {campo("Hemoglobina", c.hemoglobina)}
        {campo("Hematócrito", c.hematocrito)}
        {campo("Glicemia", c.glicemia)}
        {campo("Ap. circulatório", c.ap_circulatorio, "direita")}
        {campo("Creatinina", c.creatinina)}
        {campo("Outros", c.exames_outros)}
        {campo("ASA", asa ? `${asa}${d.asa_emergencia === true ? " E" : ""}   ·   cirurgia de emergência: ${d.asa_emergencia === true ? "sim" : "não"}` : "", "tres")}
        {campo("Ap. endócrino", c.ap_endocrino, "direita")}
        {campo("Medicação em uso", c.medicacao_uso, "cinco")}
        {campo("Estado mental", c.estado_mental, "direita")}
        {campo("Obs.", c.observacoes_pre, "cinco")}
        {campo("Anestesia anterior", c.anestesia_anterior, "direita")}
        {campo("Diagnóstico pré-operatório", c.diagnostico, "cinco")}
        {campo("Alergias", alergia, `direita${d.nega_alergia !== true && t(d.alergias) ? " alerta" : ""}`)}
      </div>
    </section>
  );
}

function Medicacao({ lista, titulo, porId, peso, locais, cabecalho, tecnicas }: {
  lista: Administracao[]; titulo: string; porId: Map<string, Registro>; peso: number | null; cabecalho: Dados;
  tecnicas: string[];
  locais: Array<{ nome: string; mg: number | null; mgPorKg: number | null }>;
}) {
  const grupos = medicacaoPorGrupo(lista, porId, tecnicas);
  const dose = (v: number, u: string) => `${numero(v, 3)} ${u}`;
  // Grama vira mg/kg: "0,048 g/kg" ninguém lê; "47,6 mg/kg" todo mundo.
  const porKg = (a: Administracao) => {
    if (!peso || !["g", "mg", "mcg", "UI", "mEq"].includes(a.unidade)) return "";
    const emMg = a.unidade === "g";
    const v = dosePorKg(emMg ? a.dose * 1000 : a.dose, peso);
    if (v === null) return "";
    return ` (${numero(v, v < 1 ? 3 : v < 10 ? 2 : 1)} ${emMg ? "mg" : a.unidade}/kg)`;
  };
  return (
    <aside className="imprMedicacao">
      <h2>{titulo}</h2>
      {!grupos.length && <p className="imprVazio">Nenhum medicamento administrado registrado.</p>}
      {grupos.map((g) => (
        <section key={g.codigo}>
          <h3>{g.numero}. {g.titulo}</h3>
          <ul>
            {g.medicamentos.map((m) => (
              <li key={m.nome}>
                <b>{m.nome}</b>
                {m.vezes.length > 1 && m.total !== null && <span className="imprTotal"> total {dose(m.total, m.unidade)}</span>}
                {m.vezes.map((a) => {
                  const alerta = (porId.get(a.id)?.dados.alerta ?? null) as { nivel?: string; justificativa?: string | null } | null;
                  const alergia = (porId.get(a.id)?.dados.alerta_alergia ?? conferirAlergia(cabecalho, a.nome)) as
                    { alergias?: string; justificativa?: string | null } | null;
                  return (
                    <span className="imprDose" key={a.id}>
                      {hora(a.momento)} · {dose(a.dose, a.unidade)} {a.via}{porKg(a)}
                      {typeof porId.get(a.id)?.dados.apresentacao === "string" && ` · ${String(porId.get(a.id)?.dados.apresentacao)}`}
                      {alerta?.justificativa && (alerta.nivel === "amarelo" || alerta.nivel === "vermelho") && (
                        <em> Alerta {alerta.nivel === "vermelho" ? "crítico" : "de conferência"} — justificativa: {alerta.justificativa}</em>
                      )}
                      {alergia && (
                        <em> Coincide com alergia registrada ({alergia.alergias}){alergia.justificativa ? ` — justificativa: ${alergia.justificativa}` : "."}</em>
                      )}
                    </span>
                  );
                })}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {locais.length > 0 && (
        <p className="imprNotaPequena">
          Anestésico local, total: {locais.map((l) => `${l.nome} ${l.mg === null ? "—" : `${numero(l.mg, 1)} mg`}${l.mgPorKg !== null ? ` (${numero(l.mgPorKg, 2)} mg/kg)` : ""}`).join("; ")}.
        </p>
      )}
    </aside>
  );
}

function Legendas({ eventos, sevo, aberta, infusoes, balanco }: {
  eventos: Array<{ id: string; momento: string; simbolo: string; rotulo: string }>;
  sevo: number | null;
  aberta: boolean;
  infusoes: Array<{
    inf: ReturnType<typeof montarInfusoes>[number]; total: ReturnType<typeof totalDaInfusao>;
    alergia: { alergias?: string; justificativa?: string | null } | null;
  }>;
  balanco: ReturnType<typeof balancoHidrico> | null;
}) {
  return (
    <div className="imprLegendas">
      {eventos.length > 0 && (
        <p><b>Eventos:</b> {eventos.map((e) => `${e.simbolo}) ${hora(e.momento)} ${e.rotulo}`).join(" · ")}</p>
      )}
      {sevo !== null && sevo > 0 && (
        <p>
          <b>Sevoflurano:</b> {formatarMl(sevo)} {aberta ? "até o último registro " : ""}— estimativa pelo ajuste do vaporizador
          (3,26 × fluxo total × % × min ÷ 60), não medição.
        </p>
      )}
      {infusoes.length > 0 && (
        <p>
          <b>Infusões:</b>{" "}
          {infusoes.map(({ inf, total, alergia }) => `${inf.nome}${inf.diluicao ? ` (${inf.diluicao})` : ""}, ${hora(inf.inicio)}–${inf.fim ? hora(inf.fim) : "sem término"}: ${[
            total.quantidade !== null && total.unidadeQuantidade && `${numero(total.quantidade, 2)} ${total.unidadeQuantidade}`,
            total.volumeMl !== null && `${numero(total.volumeMl, 1)} mL`,
          ].filter(Boolean).join(", ") || "total desconhecido"}${total.incompleto ? " (contada até o último registro)" : ""}${
            alergia ? ` — coincide com alergia registrada (${alergia.alergias})${alergia.justificativa ? `, justificativa: ${alergia.justificativa}` : ""}` : ""}`).join(" · ")}
        </p>
      )}
      {balanco && (balanco.entradas > 0 || balanco.saidas > 0) && (
        <p>
          <b>Balanço hídrico:</b> entradas {numero(balanco.entradas, 0)} mL
          {balanco.infusoesMl > 0 ? ` (inclui ${numero(balanco.infusoesMl, 0)} mL de infusões)` : ""} · saídas {numero(balanco.saidas, 0)} mL ·
          saldo {balanco.saldo > 0 ? "+" : ""}{numero(balanco.saldo, 0)} mL.
          {balanco.avisos.length > 0 && <span className="imprNotaPequena"> {balanco.avisos.join(" ")}</span>}
        </p>
      )}
    </div>
  );
}
