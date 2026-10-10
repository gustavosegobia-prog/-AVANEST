import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
import Link from "next/link";
import { comoJson, migalhas, paginaDeConteudo } from "@/lib/schema";
import { PaginaDeConteudo } from "@/components/pagina-de-conteudo";

// A ESCALA MÉDICA.
//
// Quem pesquisa "escala médica" é quem monta a escala — o coordenador do
// grupo, o escalista — procurando sair da planilha e do grupo de WhatsApp. A
// busca é de quem quer um sistema, então esta página vende, com o botão do
// teste já no topo. O que ela não faz é prometer o que o sistema não tem: cada
// item abaixo existe hoje (a mesma régua de app/recursos/page.tsx).
//
// A concorrência nesta busca é de sistemas de escala genéricos, para qualquer
// especialidade. O lugar do AVANEST nela é o contrário do genérico: a escala
// de quem também precisa da avaliação pré-anestésica e do faturamento por
// paciente anestesiado. A página diz isso, inclusive para quem não é de
// anestesia — e diz o que serve a ele e o que não serve.

const CAMINHO = "/escala-medica";
const REVISADO_EM = "2026-10-10";

const TITULO = "Escala médica online para grupos e plantões";
const DESCRICAO =
  "Escala médica por hospital e turno, com troca de plantão registrada, aviso no celular, "
  + "impressão em uma folha e fechamento do mês. 2 meses grátis.";

export const metadata: Metadata = paginaPublica({
  titulo: `${TITULO} | AVANEST`,
  descricao: DESCRICAO,
  caminho: CAMINHO,
});

const TRILHA = [
  { nome: "Início", caminho: "/" },
  { nome: "Escala médica", caminho: CAMINHO },
];

const MONTAR: [string, string][] = [
  ["Uma escala por hospital, e a de cada médico com todos juntos",
    "O grupo tem a escala de cada hospital em que atende. Cada médico vê a sua num calendário "
    + "só, com todos os hospitais, porque a pergunta dele é outra: onde eu trabalho este mês."],
  ["Manhã, tarde e noite, com o buraco à vista",
    "O turno é lançado no horário que você quiser, e o dia aparece dividido em três faixas. A "
    + "faixa vazia fica marcada: é o buraco na cobertura, visto antes do dia da cirurgia."],
  ["Escalar é clicar no nome e clicar no turno",
    "Quem monta a escala escolhe o colega numa fila de botões e lança o turno. A escolha "
    + "permanece de um lançamento para o outro, porque montar escala é repetir o mesmo nome em "
    + "vários dias."],
  ["Quem monta a escala não precisa administrar o grupo",
    "O escalista é marcado na pessoa: ele mexe na escala sem ganhar acesso ao financeiro, aos "
    + "convites e ao cadastro de todo mundo."],
  ["Os feriados já vêm marcados",
    "Os feriados nacionais aparecem no calendário, para ninguém descobrir o feriado na hora de "
    + "fechar o mês."],
  ["Plantão particular, só seu",
    "Sedação em consultório ou cobertura fora do grupo entra na sua escala e no seu mês, sem "
    + "aparecer para o grupo nem para quem administra."],
];

const DEPOIS: [string, string][] = [
  ["Troca de plantão com aceite",
    "Plantão do grupo não se apaga. Quem não pode ir oferece o turno a um colega, e o plantão "
    + "continua dele até alguém aceitar. A oferta, a resposta, quem e quando ficam registrados."],
  ["A escala do mês por e-mail, já escrita",
    "Com o botão Avisar a equipe, cada médico com plantão no mês recebe a lista dos próprios "
    + "turnos no e-mail. Quem tem um sábado no mês resolve isso na tela do telefone."],
  ["Aviso no celular",
    "Plantão oferecido ao grupo e resposta à sua oferta chegam como notificação no AVANEST "
    + "instalado na tela de início, e ficam no sino de todas as telas."],
  ["Na parede do hospital e na agenda",
    "A escala sai impressa em paisagem, sempre em uma folha. E vai para o Calendário do iPhone "
    + "e para o Google Agenda num arquivo único, e não um evento de cada vez."],
  ["Confirmar o plantão no dia",
    "Um toque de quem trabalhou. A escala é o plano; a confirmação é o que aconteceu. Turno "
    + "trocado na véspera ou cancelado por sala fechada não vai para a conta como se tivesse "
    + "sido feito."],
  ["O fechamento do mês pronto para pagar",
    "Dia, horário, horas e valor de cada profissional, com o total de cada um. Só o confirmado "
    + "entra na conta; o que ficou sem confirmar aparece marcado, e não some."],
];

export default function EscalaMedicaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(paginaDeConteudo({
          nome: TITULO, descricao: DESCRICAO, caminho: CAMINHO, revisadoEm: REVISADO_EM, medica: false,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(migalhas(TRILHA)) }}
      />
      <PaginaDeConteudo
        sobretitulo="ESCALA DE PLANTÕES"
        titulo="Escala médica online para o seu grupo"
        resumo={"A escala de cada hospital em que o grupo atende, montada com dois cliques por "
          + "turno, com as trocas entre colegas registradas e o fechamento do mês pronto para "
          + "pagar. Feita por um anestesiologista que monta a escala do próprio serviço."}
        comAcao
        origem="escala-medica"
        atual={CAMINHO}
        fim={{
          titulo: "Monte a escala do próximo mês no AVANEST.",
          texto: "Os dois primeiros meses são grátis, sem cartão de crédito, com a escala e a "
            + "ficha anestésica liberadas. Cadastre o grupo, os hospitais e os colegas, monte o mês "
            + "e avise a equipe: cada médico recebe os próprios plantões por e-mail.",
        }}
      >
        <section className="recBloco">
          <h2>Montar a escala</h2>
          <div className="recGrade">
            {MONTAR.map(([titulo, texto]) => (
              <article key={titulo}><h3>{titulo}</h3><p>{texto}</p></article>
            ))}
          </div>
        </section>

        <section className="recBloco">
          <h2>Depois de publicada</h2>
          <div className="recGrade">
            {DEPOIS.map(([titulo, texto]) => (
              <article key={titulo}><h3>{titulo}</h3><p>{texto}</p></article>
            ))}
          </div>
        </section>

        <section className="recBloco">
          <h2>Escala médica em planilha ou em sistema?</h2>
          <p>
            A planilha resolve a montagem. O problema começa depois, quando a escala muda e cada
            um tem uma versão diferente dela.
          </p>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th></th><th>Planilha e grupo de mensagens</th><th>AVANEST</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>Troca de plantão</strong></td>
                  <td>Combinada no grupo; alguém precisa lembrar de corrigir a planilha.</td>
                  <td>Oferta e aceite no sistema, com autor, data e resposta registrados.</td></tr>
                <tr><td><strong>Versão atual</strong></td>
                  <td>O arquivo mais recente de quem enviou por último.</td>
                  <td>Uma só, a do sistema, no celular de cada médico.</td></tr>
                <tr><td><strong>Aviso</strong></td>
                  <td>Cada um confere quando lembra.</td>
                  <td>E-mail com os plantões de cada um e notificação quando um turno é oferecido.</td></tr>
                <tr><td><strong>Parede do hospital</strong></td>
                  <td>Copiar, formatar e torcer para caber.</td>
                  <td>Uma folha em paisagem, pronta para imprimir.</td></tr>
                <tr><td><strong>Fechamento do mês</strong></td>
                  <td>Somar à mão, a partir da escala planejada.</td>
                  <td>Horas e valor por profissional, só do que foi confirmado.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="recBloco">
          <h2>Perguntas frequentes</h2>
          <div className="conteudoPerguntas">
            <article>
              <h3>Quanto custa a escala médica do AVANEST?</h3>
              <p>Os valores estão em <Link href="/planos">planos e preços</Link>. Os dois primeiros
                meses são grátis e sem cartão de crédito, com a escala liberada.</p>
            </article>
            <article>
              <h3>Todos os médicos do grupo precisam de login?</h3>
              <p>Não. O colega que não tem e-mail é cadastrado do mesmo jeito: aparece na escala e
                no fechamento do mês, sem receber login.</p>
            </article>
            <article>
              <h3>Funciona no celular?</h3>
              <p>Sim. O AVANEST abre no navegador e pode ser{" "}
                <Link href="/app">instalado na tela de início</Link> do iPhone e do Android, que é
                o que libera as notificações.</p>
            </article>
            <article>
              <h3>Quem pode entrar na escala?</h3>
              <p>Médico com CRM cadastrado. O RQE fica no mesmo cadastro. Quem está sem CRM não
                some da escala em silêncio: aparece num aviso, pelo nome, indicando onde preencher.</p>
            </article>
            <article>
              <h3>Serve para outras especialidades?</h3>
              <p>A escala foi desenhada para grupos de anestesiologia. Hospital, turno, troca e
                fechamento servem a qualquer equipe médica que divide plantões; o resto do sistema
                (a <Link href="/avaliacao-pre-anestesica">avaliação pré-anestésica</Link> e o
                faturamento por paciente anestesiado) é de anestesia.</p>
            </article>
            <article>
              <h3>Os dados ficam seguros?</h3>
              <p>Cada grupo só enxerga os próprios dados, e a trava fica no banco de dados. Cada
                alteração guarda autor, data e hora, e as contas de quem administra o grupo entram com
                verificação em duas etapas.</p>
            </article>
          </div>
        </section>
      </PaginaDeConteudo>
    </>
  );
}
