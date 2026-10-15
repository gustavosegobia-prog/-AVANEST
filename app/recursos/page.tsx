import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
import { comoJson, migalhas } from "@/lib/schema";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { RodapePublico } from "@/components/rodape-publico";

// A trilha que aparece no lugar da URL crua no resultado do Google.
// Breadcrumb é dos poucos dados estruturados que ainda mudam o que se
// VÊ na busca — ao contrário do FAQPage, cujo suporte o Google encerrou
// em junho de 2026.
const TRILHA = [{ nome: "Início", caminho: "/" }, { nome: "O que o AVANEST faz", caminho: "/recursos" }];

export const metadata: Metadata = paginaPublica({
  titulo: "O que o AVANEST faz | Sistema para anestesiologistas",
  descricao:
    "Recepção, avaliação pré-anestésica, ficha anestésica no tablet, protocolos de crise com "
    + "doses pelo peso, escala por hospital e financeiro do médico e do grupo.",
  caminho: "/recursos",
});

/**
 * A apresentação do sistema, para quem ainda não é cliente.
 *
 * Escrita para anestesiologista, e não para comprador de software: o que
 * convence um colega não é "solução completa e integrada", é reconhecer o
 * próprio dia no texto — a ficha que ele preenche de pé, a escala que ele
 * monta em planilha, a produção que ele anota num papel no bolso do pijama.
 *
 * Cada linha aqui corresponde a algo que existe no sistema hoje. Página de
 * produto que promete o que ainda não está pronto vira reclamação na primeira
 * semana de uso, e num sistema clínico vira desconfiança do resto.
 */

// `leia`: a página que trata o assunto do bloco por inteiro, para quem quer
// mais do que os cartões. É também o que liga o /recursos às páginas que
// respondem às buscas — com o nome da busca no texto do link.
type Bloco = { titulo: string; itens: [string, string][]; leia?: [string, string] };

const BLOCOS: Bloco[] = [
  {
    titulo: "A recepção",
    itens: [
      ["A agenda do dia por médico e por hospital",
        "A recepção marca, registra a chegada e acompanha cada paciente até o fim da consulta. "
        + "Agendado, aguardando, em atendimento e concluído aparecem na mesma lista."],
      ["Busca por nome, CPF ou telefone",
        "O paciente que volta é achado pelo que a recepção tiver na mão, e o horário já ocupado "
        + "aparece antes de marcar outro por cima."],
      ["Falta, desmarcação e reagendamento no histórico",
        "Reagendar cria uma marcação nova e a antiga fica registrada como reagendada. Cada consulta "
        + "tem o histórico de quem mudou o quê, e quando."],
      ["Sem acesso ao conteúdo clínico",
        "A recepção vê agenda e cadastro. A avaliação e o financeiro ficam fechados para ela no "
        + "banco de dados, e não só na tela."],
    ],
  },
  {
    titulo: "A avaliação pré-anestésica",
    leia: ["/avaliacao-pre-anestesica", "O que a avaliação pré-anestésica deve conter"],
    itens: [
      ["Nove etapas, salvas enquanto você digita",
        "Identificação, anamnese, exame físico, via aérea, exames, medicamentos, escores, "
        + "planejamento e conclusão. O texto é salvo sozinho: fechar a tela no meio não perde nada."],
      ["Via aérea com os preditores que mudam a conduta",
        "Mallampati, distância tireomentoniana, abertura bucal, mobilidade cervical e o histórico "
        + "de intubação difícil. O resumo sai escrito, do jeito que vai para a ficha."],
      ["Risco cardíaco pelo RCRI",
        "O índice de Lee com os seis critérios, calculado a partir do que já foi respondido na "
        + "anamnese — sem repetir pergunta que a tela já fez."],
      ["Medicamentos de uso contínuo com orientação de suspensão",
        "A base diz quantos dias antes suspender cada antitrombótico e quando reintroduzir. "
        + "Você confere e ajusta; a orientação sai na ficha que o paciente leva para casa."],
      ["Via aérea pediátrica por idade — e por peso no neonato",
        "Acima de um ano vale a fórmula da idade. Abaixo de um ano, não: o tamanho do tubo passa "
        + "a sair de tabela por peso, porque aplicar a fórmula de criança maior em recém-nascido "
        + "erra para cima."],
    ],
  },
  {
    titulo: "A ficha anestésica",
    leia: ["/ficha-anestesica", "O que a ficha anestésica deve conter"],
    itens: [
      ["No tablet, dentro da sala",
        "A folha de anestesia na tela, no desenho da ficha de papel. Ela já começa com o que a "
        + "avaliação respondeu (peso, ASA, alergias, medicamentos em uso, via aérea e jejum) para "
        + "você conferir, e não redigitar."],
      ["PA e FC no toque do gráfico",
        "Você toca no gráfico para lançar a pressão e a frequência do horário. Medicação, "
        + "infusões, gases, líquidos e eventos entram com um toque."],
      ["Doses sugeridas pelo peso e pela idade",
        "A dose do adulto e a da criança aparecem sugeridas, e a infusão já vem em mL/h. Você "
        + "confere e muda antes de registrar. Alergia registrada na avaliação gera alerta."],
      ["A foto do monitor vira registro",
        "Fotografe a tela de tendências no fim do caso. Os valores lidos aparecem numa tabela "
        + "para você conferir antes de lançar."],
      ["Saída da sala, autor e horário",
        "A saída para a RPA ou a UTI fecha o tempo da anestesia, com o Aldrete. Cada registro guarda "
        + "quem lançou e quando, e a folha sai impressa em A4."],
    ],
  },
  {
    titulo: "O manejo de crises",
    itens: [
      ["49 protocolos de crise em anestesia",
        "Parada cardíaca, anafilaxia, hipertermia maligna, via aérea difícil, crises obstétricas e "
        + "pediátricas, e as listas de verificação do aparelho e da pré-indução."],
      ["Doses pelo peso e pela idade do paciente",
        "Com o peso e a idade, cada dose sai calculada com o volume de cada apresentação. O "
        + "dantroleno de um paciente de 72 kg já aparece em frascos."],
      ["Para ler de longe, durante a crise",
        "O que fazer agora vem primeiro, em passos numerados. Os ritmos de parada aparecem como "
        + "no monitor, e os favoritos ficam no alto da lista."],
      ["Cada protocolo cita a fonte",
        "A diretriz de onde cada recomendação saiu fica no fim do protocolo, que também sai em PDF "
        + "para imprimir e deixar na sala."],
    ],
  },
  {
    titulo: "O que sai impresso",
    leia: ["/ficha-anestesica", "As fichas da anestesia e um modelo para imprimir"],
    itens: [
      ["Ficha, termo de consentimento e orientações",
        "Cada documento sai com o logo e o nome do hospital onde aquele paciente foi atendido. Se "
        + "você reimprimir hoje uma ficha de março, ela sai com o hospital de março."],
      ["A sua assinatura, com CRM e RQE",
        "Impressa no rodapé de cada documento. E pergunta que ficou sem resposta não vai para o "
        + "papel: a ficha sai do tamanho do caso, sem páginas de espaço em branco."],
    ],
  },
  {
    titulo: "A escala do serviço",
    leia: ["/escala-medica", "A escala médica em detalhe"],
    itens: [
      ["Uma escala por hospital, e a sua com todos juntos",
        "O grupo não tem uma escala: tem a de cada hospital em que atende. A sua junta "
        + "tudo em um calendário só, porque ali a pergunta é outra: onde eu trabalho este mês."],
      ["O dia dividido em manhã, tarde e noite",
        "O turno continua sendo lançado no horário que você quiser. Quem fica até as 13h aparece na "
        + "manhã; quem faz o dia todo, na manhã e na tarde. A faixa vazia fica à vista: é o buraco "
        + "na cobertura."],
      ["Escalar é clicar no nome e clicar no turno",
        "Quem monta a escala escolhe a pessoa numa fila de botões e lança o turno. A escolha "
        + "permanece de um lançamento para o outro, porque montar escala é repetir o mesmo nome em "
        + "vários dias. No calendário aparece o primeiro nome de cada um, e não iniciais."],
      ["Plantão do grupo não se apaga — se passa",
        "Sair de um turno tem um caminho só: oferecer a um colega e esperar que ele aceite. "
        + "Enquanto ninguém aceita, o plantão continua seu — quem abandona um turno sem avisar deixa "
        + "o buraco para ser descoberto no dia da cirurgia."],
      ["Plantão só seu, que ninguém do grupo enxerga",
        "Sedação em consultório, hospital que não é do serviço, cobertura particular. Entra na sua "
        + "escala e no seu mês; não aparece para o grupo, nem para quem administra."],
      ["No seu celular e na parede do hospital",
        "A escala sai impressa em paisagem, sempre em uma folha só, para pregar na parede. E vai "
        + "para o Calendário do iPhone e para o Google Agenda em um arquivo único, e não um evento de "
        + "cada vez. Os feriados nacionais já vêm marcados no calendário."],
    ],
  },
  {
    titulo: "O dinheiro do plantão",
    itens: [
      ["A produção do dia, anotada com o jaleco ainda vestido",
        "Nome, convênio e cirurgia de cada paciente em uma linha só, com o cursor voltando para o "
        + "campo do nome depois de salvar. Se anotar oito pacientes custar mais do que rabiscar num "
        + "papel, ninguém anota — e o que não foi anotado não é cobrado."],
      ["A ficha de internação lida pela foto",
        "O laudo de AIH do SUS e as fichas de convênio: fotografe, e os campos vêm preenchidos. O "
        + "reconhecimento do texto acontece dentro do seu aparelho, e a imagem é descartada ao final "
        + "— a ficha traz dados de saúde, e dado de saúde não precisa viajar."],
      ["A lista é sua até você mandar",
        "Ninguém do faturamento vê a sua produção enquanto você não clicar em Enviar. O envio é por mês, "
        + "só o que você enviou, e dá para desfazer."],
      ["Confirmar o plantão no dia em que ele acontece",
        "Um toque, de quem trabalhou. A escala é um plano: o turno trocado na véspera e o cancelado "
        + "por sala fechada continuam nela iguais ao que estava previsto. Só quem fez o plantão pode "
        + "confirmá-lo, e não se confirma plantão que ainda não aconteceu."],
      ["O fechamento do mês, pronto para o financeiro",
        "Dia, horário, horas e valor de cada profissional, com o total de cada um. Só o que foi confirmado "
        + "entra na conta a pagar; o que ficou sem confirmar aparece marcado, e não sumido — turno "
        + "esquecido não pode desaparecer da conta de alguém sem ninguém ver."],
      ["Quanto entrou, quanto falta receber",
        "O valor de cada turno, o que já foi pago e o total do mês — com um botão em forma de olho "
        + "que esconde os números quando alguém está olhando por cima do seu ombro."],
      ["As duas notas do mês, separadas por hospital",
        "Uma folha dos plantões e outra dos pacientes anestesiados, porque são duas notas contra "
        + "tomadores diferentes. As duas saem com um total por hospital, e na de faturamento você "
        + "marca, paciente por paciente, se recebe direto, se a conta vai para o hospital ou se "
        + "quem paga é o convênio."],
    ],
  },
  {
    titulo: "O que o sistema avisa",
    itens: [
      ["Um sino, em todas as telas",
        "Plantão oferecido ao grupo, resposta ao turno que você ofereceu, mensagem nova da equipe e "
        + "resposta do suporte. O aviso nasce numa área e é lido em outra: quem está na recepção "
        + "cadastrando paciente precisa ver o plantão oferecido sem abrir a escala."],
      ["O número no sino é só o que espera resposta sua",
        "Aviso que é apenas informação não entra na contagem: aparece como um ponto, que some quando "
        + "você abre a caixa. Um contador que nunca zera é um contador que se aprende a ignorar — "
        + "inclusive no dia em que ele estiver certo."],
      ["O que ficou para trás na cobrança",
        "Paciente anestesiado e ainda não cobrado, conta faturada que não voltou como pagamento, "
        + "plantão trabalhado e não pago. Só de mês já fechado: cobrar um paciente de anteontem não "
        + "é atraso, é o trabalho normal."],
    ],
  },
  {
    titulo: "O grupo",
    itens: [
      ["Recepção, médico, financeiro e administração",
        "Cada um vê o que precisa ver. A recepção conduz a fila do dia sem abrir conteúdo clínico."],
      ["Quem entra na escala é médico com CRM, e o RQE vai junto",
        "A escala é o documento de quem responde pela anestesia, e o registro faz parte dela: sem "
        + "CRM no cadastro, o nome não entra — e não fica de fora em silêncio, aparece num aviso, "
        + "pelo nome, indicando onde preencher. O RQE fica guardado no mesmo cadastro e sai "
        + "impresso ao lado do CRM na assinatura da ficha e das orientações — quem tem o registro "
        + "da especialidade assina como especialista."],
      ["O colega que não usa o sistema também entra",
        "O anestesiologista que não tem e-mail é cadastrado do mesmo jeito. Ele aparece na escala e "
        + "no faturamento, e não recebe login nenhum."],
      ["Conversa da equipe, separada por instituição",
        "Uma sala de conversa por organização. Quem é de uma não lê a sala da outra."],
    ],
  },
  {
    titulo: "O sigilo e a segurança",
    itens: [
      ["Os dados da sua clínica não se misturam com os de outra",
        "Todo pedido de informação sai identificado com a sua organização, e quem não é dela não "
        + "recebe resposta. A trava fica no banco de dados, e não apenas na tela: esconder um botão "
        + "impede o clique, não o pedido."],
      ["Fica registrado quem fez o quê, e quando",
        "Cada cadastro, alteração e exclusão guarda o autor, a data e a hora. Se um dia alguém "
        + "perguntar quem mudou aquele campo, a resposta existe."],
      ["Cada um vê apenas o que precisa para trabalhar",
        "A recepção conduz a fila do dia sem abrir a avaliação clínica. É o princípio da necessidade "
        + "previsto na LGPD: quanto menos gente com acesso ao dado do paciente, menor o risco para "
        + "ele e para você."],
      ["Valor clínico vem de referência, não de estimativa",
        "Os pontos de corte, as fórmulas e os prazos de suspensão de medicamento vêm das referências "
        + "publicadas, sem arredondar nem tirar média entre uma e outra. Onde a referência não "
        + "existe, o campo fica em branco — num sistema clínico, um número inventado é pior do que "
        + "um campo vazio."],
    ],
  },
];

export default function RecursosPage() {
  const whatsappUrl =
    "https://wa.me/5541997870810?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20conversa%20de%2015%20minutos%20sobre%20o%20AVANEST.";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(migalhas(TRILHA)) }}
      />
    <main className="avnLanding">
      <header className="avnNav">
        <Link href="/" aria-label="AVANEST"><AppLogo /></Link>
        <nav>
          <a className="avnLogin" href="/login">Login</a>
          <a className="avnPrimary" href="/planos">Ver planos</a>
        </nav>
      </header>

      <section className="recHero">
        <p className="avnEyebrow">O SISTEMA POR DENTRO</p>
        <h1>O dia inteiro do anestesiologista, em um sistema só.</h1>
        <p className="avnLead">
          Da recepção do paciente ao valor que entra no fim do mês, passando pela consulta
          pré-anestésica, pela ficha da sala, pelos protocolos de crise, pela escala do serviço
          e pelo fechamento que vai para o financeiro.
        </p>
      </section>

      {BLOCOS.map((bloco) => (
        <section className="recBloco" key={bloco.titulo}>
          <h2>{bloco.titulo}</h2>
          <div className="recGrade">
            {bloco.itens.map(([titulo, texto]) => (
              <article key={titulo}>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </article>
            ))}
          </div>
          {bloco.leia && (
            <Link className="avnCartaoLink" href={bloco.leia[0]}>{bloco.leia[1]} →</Link>
          )}
        </section>
      ))}

      <section className="recFim">
        <h2>Feito por quem passa o plantão dentro do centro cirúrgico.</h2>
        <p>
          O AVANEST nasceu no serviço de anestesiologia de Campo Mourão, para resolver o
          que atrapalhava o dia por lá. Cada detalhe desta página existe porque faltou
          num plantão.
        </p>
        <div className="avnActions">
          <a className="avnPrimary" href="/planos">Ver planos e preços</a>
          <a className="avnSecondary" href={whatsappUrl} target="_blank" rel="noreferrer">
            Conversar 15 minutos
          </a>
        </div>
      </section>

      <RodapePublico />
    </main>
    </>
  );
}
