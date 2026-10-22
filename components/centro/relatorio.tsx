import Link from "next/link";
import type { CSSProperties } from "react";
import { Icone } from "@/components/icone";
import { duracao, horaDe } from "@/lib/centro-cirurgico";
import {
  dataBR, faixaDeTempo, mesVizinho, nomeDoMes, type Estatistica, type Grupo, type LinhaDoRelatorio, type RelatorioDoMes,
} from "@/lib/centro-relatorio";
import type { Celula } from "@/lib/xlsx";
import { AcoesDoRelatorio } from "./relatorio-acoes";
import estilos from "./relatorio.module.css";

const DIA_DA_SEMANA = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const diaDaSemana = (data: string) => DIA_DA_SEMANA.format(new Date(`${data}T12:00:00Z`)).replace(".", "");
const ddmm = (data: string) => dataBR(data).slice(0, 5);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * O relatório do mês do centro cirúrgico.
 *
 * No alto, a resposta: quantas cirurgias e quanto tempo em sala e na RPA. Logo
 * abaixo, o que pode estar errado nesses números (horário que faltou, paciente
 * que ficou "agendado"). Depois o detalhe — por dia, sala, cirurgião, convênio,
 * anestesista — e por fim cada cirurgia, que é de onde todo o resto sai.
 */
export function RelatorioDoMes({ r, nomeDaCasa, mesDeHoje, planilha }: {
  r: RelatorioDoMes;
  nomeDaCasa: string;
  mesDeHoje: string;
  planilha: Celula[][];
}) {
  const vazio = r.feitas === 0 && r.canceladas === 0 && r.semRegistro === 0 && r.aindaAgendados === 0;
  return (
    <>
      <div className={estilos.titulo}>
        <div>
          <h1>Relatório do mês</h1>
          {nomeDaCasa && <p>{nomeDaCasa}</p>}
        </div>
        <AcoesDoRelatorio planilha={planilha} arquivo={`avanest-centro-cirurgico-${r.mes}.xlsx`} />
      </div>

      <nav className={estilos.mes} aria-label="Mês do relatório">
        <Link href={`/centro-cirurgico/relatorio?mes=${mesVizinho(r.mes, -1)}`} className={estilos.passoMes} aria-label="Mês anterior">
          <Icone nome="seta" tamanho={18} className={estilos.setaEsquerda} />
        </Link>
        <span className={estilos.nomeDoMes}>
          <strong>{nomeDoMes(r.mes)}</strong>
          {r.mes === mesDeHoje ? <em>Este mês, até hoje</em> : <Link href="/centro-cirurgico/relatorio">Voltar para este mês</Link>}
        </span>
        <Link href={`/centro-cirurgico/relatorio?mes=${mesVizinho(r.mes, 1)}`} className={estilos.passoMes} aria-label="Próximo mês">
          <Icone nome="seta" tamanho={18} className={estilos.setaDireita} />
        </Link>
      </nav>

      {vazio ? (
        <p className={estilos.vazio}>Nenhum paciente no mapa em {nomeDoMes(r.mes)}.</p>
      ) : (
        <>
          <Numeros r={r} />
          <Avisos r={r} />
          {r.feitas > 0 && <PorDia r={r} />}
          {r.feitas > 0 && (
            <div className={estilos.divisoes}>
              <TabelaDeGrupos titulo="Por sala" coluna="Sala" grupos={r.porSala} />
              <TabelaDeGrupos titulo="Por cirurgião" coluna="Cirurgião" grupos={r.porCirurgiao} />
              <Contagem titulo="Por convênio" coluna="Convênio" linhas={r.porConvenio.map((c) => ({ nome: c.convenio, n: c.atos }))} />
              <Contagem titulo="Por anestesista" coluna="Anestesista" linhas={r.porAnestesista} />
            </div>
          )}
          {r.canceladas > 0 && <Canceladas r={r} />}
          {r.feitas > 0 && <CadaCirurgia linhas={r.linhas} />}
        </>
      )}
    </>
  );
}

function Numeros({ r }: { r: RelatorioDoMes }) {
  const dias = r.porDia.filter((d) => d.n > 0).length;
  const tempo = (e: Estatistica, onde: string, mais?: string) => (
    <div className={estilos.numero}>
      <span>Tempo médio {onde}</span>
      <strong>{e.media != null ? duracao(e.media) : "—"}</strong>
      <small>
        {e.n ? <>{faixaDeTempo(e)}<br />{plural(e.n, "cirurgia com horário", "cirurgias com horário")}</> : "Nenhuma com horário completo"}
        {mais && <><br />{mais}</>}
      </small>
    </div>
  );
  const motivo = r.motivos[0];
  return (
    <section className={estilos.numeros} aria-label="Números do mês">
      <div className={estilos.numero}>
        <span>Cirurgias feitas</span>
        <strong>{r.feitas}</strong>
        <small>{dias ? `em ${plural(dias, "dia", "dias")}` : "Nenhuma ainda"}</small>
      </div>
      {tempo(r.emSala, "em sala")}
      {tempo(r.naRpa, "na RPA", r.diretoUti ? `${r.diretoUti} da sala direto para a UTI, fora da RPA` : undefined)}
      <div className={estilos.numero}>
        <span>Canceladas</span>
        <strong>{r.canceladas}</strong>
        <small>{motivo ? `Mais comum: ${motivo.motivo.toLowerCase()} (${motivo.n})` : "Nenhuma"}</small>
      </div>
    </section>
  );
}

/** O que pode deixar os números errados — e como acertar no mapa. */
function Avisos({ r }: { r: RelatorioDoMes }) {
  if (!r.incompletas && !r.semRegistro && !r.aindaAgendados) return null;
  return (
    <ul className={estilos.avisos}>
      {r.incompletas > 0 && (
        <li>
          <b>{r.incompletas}</b> {r.incompletas === 1 ? "cirurgia está" : "cirurgias estão"} sem algum horário e
          {r.incompletas === 1 ? " ficou" : " ficaram"} fora da média. Estão marcadas com “sem horário” na lista abaixo; o horário
          se acerta no mapa daquele dia.
        </li>
      )}
      {r.semRegistro > 0 && (
        <li>
          <b>{r.semRegistro}</b> {r.semRegistro === 1 ? "paciente de dia que já passou continua" : "pacientes de dias que já passaram continuam"} como
          agendado, sem “Entrou em sala”. Se a cirurgia não aconteceu, cancele no mapa com o motivo; se aconteceu, marque a entrada.
        </li>
      )}
      {r.aindaAgendados > 0 && <li><b>{r.aindaAgendados}</b> ainda {r.aindaAgendados === 1 ? "agendado" : "agendados"}, de hoje em diante.</li>}
    </ul>
  );
}

/** Uma coluna por dia do mês. O dia mais cheio leva o número em cima; os outros, no toque. */
function PorDia({ r }: { r: RelatorioDoMes }) {
  const maior = Math.max(...r.porDia.map((d) => d.n));
  const maiores = r.porDia.filter((d) => d.n === maior);
  const quais = maiores.map((d) => `${diaDaSemana(d.data)} ${ddmm(d.data)}`);
  const marcados = new Set([1, 5, 10, 15, 20, 25, r.porDia.length]);
  return (
    <section className={estilos.secao} aria-labelledby="rel-por-dia">
      <h2 id="rel-por-dia">Cirurgias por dia</h2>
      <p className={estilos.nota}>
        O máximo num dia foi {plural(maior, "cirurgia", "cirurgias")}: {quais.length <= 3
          ? quais.join(quais.length === 2 ? " e " : ", ").replace(/, ([^,]*)$/, " e $1")
          : `em ${quais.length} dias`}.
      </p>
      <ol className={estilos.barras} style={{ "--dias": r.porDia.length } as CSSProperties}>
        {r.porDia.map((d) => {
          const altura = `${maior ? (d.n / maior) * 100 : 0}%`;
          const texto = `${diaDaSemana(d.data)}, ${ddmm(d.data)}`;
          return (
            <li key={d.data} className={estilos.dia} style={{ "--altura": altura } as CSSProperties} tabIndex={0}
              aria-label={`${texto}: ${plural(d.n, "cirurgia", "cirurgias")}`}>
              {d.n > 0 && <span className={estilos.barra} />}
              {d.n === maior && <span className={estilos.rotuloDoMaior} aria-hidden="true">{maior}</span>}
              <span className={estilos.dica} aria-hidden="true">
                <strong>{plural(d.n, "cirurgia", "cirurgias")}</strong>
                <span>{texto}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className={estilos.eixo} style={{ "--dias": r.porDia.length } as CSSProperties} aria-hidden="true">
        {r.porDia.map((d, i) => <span key={d.data}>{marcados.has(i + 1) ? i + 1 : ""}</span>)}
      </div>
    </section>
  );
}

function TabelaDeGrupos({ titulo, coluna, grupos }: { titulo: string; coluna: string; grupos: Grupo[] }) {
  return (
    <section className={estilos.secao}>
      <h2>{titulo}</h2>
      <table className={estilos.tabelinha}>
        <thead><tr><th>{coluna}</th><th>Cirurgias</th><th>Média em sala</th></tr></thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.nome}><td>{g.nome}</td><td>{g.n}</td><td>{g.emSala.media != null ? duracao(g.emSala.media) : "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Contagem({ titulo, coluna, linhas }: { titulo: string; coluna: string; linhas: Array<{ nome: string; n: number }> }) {
  return (
    <section className={estilos.secao}>
      <h2>{titulo}</h2>
      <table className={estilos.tabelinha}>
        <thead><tr><th>{coluna}</th><th>Cirurgias</th></tr></thead>
        <tbody>{linhas.map((l) => <tr key={l.nome}><td>{l.nome}</td><td>{l.n}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

function Canceladas({ r }: { r: RelatorioDoMes }) {
  return (
    <section className={estilos.secao} aria-labelledby="rel-canceladas">
      <h2 id="rel-canceladas">Canceladas <small>{r.canceladas}</small></h2>
      <ul className={estilos.motivos} aria-label="Motivos">
        {r.motivos.map((m) => <li key={m.motivo}>{m.motivo} <b>{m.n}</b></li>)}
      </ul>
      <div className={estilos.rolagem}>
        <table className={estilos.lista}>
          <thead><tr><th>Data</th><th>Sala</th><th>Paciente</th><th>Cirurgia</th><th>Motivo</th></tr></thead>
          <tbody>
            {r.listaCanceladas.map(({ caso: c, sala }) => (
              <tr key={c.id}>
                <td className={estilos.data} data-rotulo="Data">{ddmm(c.data)}<small>{diaDaSemana(c.data)}</small></td>
                <td data-rotulo="Sala">{sala}</td>
                <td data-rotulo="Paciente" data-largo>{c.paciente}</td>
                <td data-rotulo="Cirurgia" data-largo>{c.procedimento}</td>
                <td data-rotulo="Motivo" data-largo>{c.cancelado_motivo || "Sem motivo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TempoEmSala({ l }: { l: LinhaDoRelatorio }) {
  const c = l.caso;
  if (l.emSala != null) return <>{duracao(l.emSala)}<small>{horaDe(c.entrada_sala_em)}–{horaDe(c.saida_sala_em)}</small></>;
  return <><em className={estilos.semHorario}>sem horário</em><small>falta a {l.falta[0] ?? "saída da sala"}</small></>;
}

function TempoNaRpa({ l }: { l: LinhaDoRelatorio }) {
  const c = l.caso;
  if (l.naRpa != null) return <>{duracao(l.naRpa)}<small>alta {horaDe(c.alta_rpa_em)}</small></>;
  if (c.saida_sala_em && !c.alta_rpa_em && c.destino === "uti") return <>—<small>direto para a UTI</small></>;
  if (l.falta.includes("alta da RPA")) return <><em className={estilos.semHorario}>sem horário</em><small>falta a alta</small></>;
  return <>—</>;
}

/** Cada cirurgia feita no mês, com os dois tempos. É a lista de onde sai todo o resto. */
function CadaCirurgia({ linhas }: { linhas: LinhaDoRelatorio[] }) {
  return (
    <section className={`${estilos.secao} ${estilos.secaoLista}`} aria-labelledby="rel-lista">
      <h2 id="rel-lista">Cada cirurgia <small>{linhas.length}</small></h2>
      <div className={estilos.rolagem}>
        <table className={estilos.lista}>
          <thead>
            <tr><th>Data</th><th>Sala</th><th>Paciente</th><th>Cirurgia</th><th>Cirurgião</th><th>Convênio</th><th>Anestesista</th>
              <th>Em sala</th><th>Na RPA</th></tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.caso.id}>
                <td className={estilos.data} data-rotulo="Data">{ddmm(l.caso.data)}<small>{diaDaSemana(l.caso.data)}</small></td>
                <td data-rotulo="Sala">{l.sala}</td>
                <td data-rotulo="Paciente" data-largo><b>{l.caso.paciente}</b>{l.caso.idade != null && <small>{l.caso.idade} anos</small>}</td>
                <td data-rotulo="Cirurgia" data-largo>{l.caso.procedimento}</td>
                <td data-rotulo="Cirurgião">{l.caso.cirurgiao ?? ""}</td>
                <td data-rotulo="Convênio">{l.caso.convenio ?? ""}</td>
                <td data-rotulo="Anestesista">{l.anestesista}</td>
                <td className={estilos.tempo} data-rotulo="Em sala"><TempoEmSala l={l} /></td>
                <td className={estilos.tempo} data-rotulo="Na RPA"><TempoNaRpa l={l} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
