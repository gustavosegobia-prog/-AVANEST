import { TITULO_DO_CONSUMO, itemDoCatalogoDeConsumo, lerConsumo, linhasPorGrupo } from "@/lib/evolucao/consumo";
import { dataDoDia, dataHora, idadeParaImpressao } from "@/lib/evolucao/impressao";
import type { DadosDaImpressao } from "./folha-impressa";

// O verso impresso: o consumo da sala (lib/evolucao/consumo.ts), na mesma
// folha A4 da frente, para o faturamento. Sai só quando pedido — "Imprimir o
// verso" —, porque a frente é uma folha só, sempre.
//
// Não tem gráfico para esticar: nasce já "ajustada", e quem manda imprimir
// (imprimir-ficha.tsx) não espera por ela.

const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function VersoImpresso(p: Omit<DadosDaImpressao, "vigentes" | "encerradaPor">) {
  const { folha, paciente, agora } = p;
  const d = folha.dados;
  const consumo = lerConsumo(d);
  const grupos = linhasPorGrupo(consumo);
  const idade = idadeParaImpressao(paciente.data_nascimento, new Date(`${t(d.data_procedimento) || agora.slice(0, 10)}T12:00:00-03:00`), paciente.idade_anos);
  return (
    <div className="imprFolhas" data-paciente={paciente.nome}>
      <article className="imprFolha imprVerso" data-ajustada="1">
        <header className="imprTopo">
          <div className="imprInstituicao">{p.instituicao || t(d.hospital) || "Serviço de anestesiologia"}</div>
          <h1>CONSUMO</h1>
          <div className="imprResponsavel">MATERIAIS E MEDICAMENTOS</div>
        </header>
        <div className="imprPaciente">
          <span className="largo"><small>Nome do paciente</small>{paciente.nome}</span>
          <span><small>Idade</small>{idade}</span>
          <span><small>Data</small>{dataDoDia(t(d.data_procedimento))}</span>
          <span><small>Cirurgia</small>{t(d.procedimento) || "—"}</span>
        </div>

        <div className="imprConsumo">
          {grupos.length === 0 && <p className="imprVazio">Nenhum consumo registrado na ficha.</p>}
          {grupos.map((g) => (
            <section key={g.grupo} className="imprConsumoGrupo">
              <h2>{TITULO_DO_CONSUMO[g.grupo]}</h2>
              <table>
                <tbody>
                  {g.linhas.map((l) => (
                    <tr key={`${l.nome}|${l.numero ?? ""}`}>
                      <td>{l.nome}{itemDoCatalogoDeConsumo(l.nome)?.comNumero ? ` nº ${l.numero || "____"}` : ""}</td>
                      <td className="qtd">{l.qtd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>

        <div className="imprObservacoes imprConsumoObs">
          <small>Observação</small>
          <p>{consumo.observacao ?? ""}</p>
        </div>
        <div className="imprAssinaturaCurta">
          <span className="imprLinhaAssinar" />
          <small>Assinatura / carimbo</small>
        </div>

        <div className="imprRodape">
          <span>Gerado pelo AVANEST a partir da ficha · impresso em {dataHora(agora)} por {p.impressoPor}{folha.status === "aberta" ? " · ficha aberta" : ""}</span>
          <span>Verso</span>
        </div>
      </article>
    </div>
  );
}
