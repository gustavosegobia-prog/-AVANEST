"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { BrandMark } from "@/components/brand-mark";
import { Icone } from "@/components/icone";
import { idadePorNascimento, lerIdadeInformada } from "@/lib/idade";
import { ChatFlutuante } from "@/components/chat-flutuante";
import { CaixaDeAvisos } from "@/components/caixa-de-avisos";
import { TutorialInicial, reabrirTutorial } from "@/components/tutorial-inicial";
import { iniciais } from "@/lib/escala";
import type { Aviso } from "@/lib/avisos";
import { PainelRecolhivel } from "@/components/painel-recolhivel";
import { GraficosFinanceiro } from "@/components/graficos-financeiro";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import { LocaisAdmin } from "@/components/locais-admin";
import { OlhoValores, useValoresOcultos } from "@/components/olho-valores";
import {
  FAIXAS_DE_IDADE, envelhecimento, glosa, mesAnterior,
  prazoMedioPorConvenio, saldoAReceber, saldoVencido, totaisDoEnvelhecimento,
  variacao,
} from "@/lib/financeiro-indicadores";
import {
  dePlantao, deProducao, deConsulta, doMes, porOrigem, porProfissional, somar,
  type PlantaoBruto, type ProducaoBruta, type Receita,
  paraRecebivel,
} from "@/lib/receitas";
import { ProducaoRecebida } from "@/components/producao-do-dia";

const NOMES_MES = ["janeiro","fevereiro","março","abril","maio","junho",
                   "julho","agosto","setembro","outubro","novembro","dezembro"];
import { Plantoes } from "@/components/plantoes";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário", admin: "Administrador", medico: "Anestesiologista",
  recepcao: "Recepção", financeiro: "Financeiro",
};

/**
 * As áreas que uma pessoa pode acumular além do próprio perfil.
 *
 * O perfil continua sendo um só — é o que a pessoa é. As áreas extras são o
 * que ela também faz: a recepcionista que fecha o caixa, o anestesiologista
 * que confere o faturamento. Antes isso só existia no banco, e para conceder
 * era preciso abrir o SQL.
 *
 * Administrador e proprietário não aparecem com caixas para marcar: eles já
 * enxergam tudo, e marcar áreas para quem já tem todas só confundiria.
 */
export const AREAS_EXTRAS = ["recepcao", "medico", "financeiro", "admin"] as const;
export const VE_TUDO = ["admin", "owner"];
export const areasExtras = (p: { role: string; permissoes?: string[] | null }) =>
  (Array.isArray(p.permissoes) ? p.permissoes : []).filter(
    (area) => area !== p.role && (AREAS_EXTRAS as readonly string[]).includes(area),
  );

export const PRIVATE_PAY_CONVENIO = "Particular";
export const CONVENIOS = [
  "Particular","Unimed","FUPS","SAS","CISCOMCAM","Humana Saúde","Bradesco Saúde",
  "SulAmérica","Amil","CASSI","SANEPAR","COPEL",
];

/**
 * Quem entra na escala.
 *
 * Duas condições, e as duas são necessárias.
 *
 * O papel corta a equipe de apoio: recepção e financeiro usam o sistema todo
 * dia e não fazem anestesia. Mas o papel sozinho não basta — o dono da clínica
 * é "owner" e é médico, e um corte por role==="medico" tiraria justamente ele
 * da própria escala.
 *
 * O CRM é o que separa médico de administrador dentro do que sobrou. Quem
 * anestesia responde pelo ato com o registro dele, e a escala é o documento de
 * quem responde: sem registro, não entra.
 *
 * Médico ativo sem CRM não é excluído em silêncio — a escala mostra o nome
 * dele num aviso, apontando onde preencher.
 */
const EQUIPE_DE_APOIO = ["recepcao", "financeiro"];

// Quem aparece na fila de nomes de quem monta a escala. Três perguntas, e
// todas precisam de "sim": o acesso está ativo, a pessoa responde pela
// anestesia (recepção e financeiro não entram) e ela tem CRM no cadastro —
// a escala é o documento de quem responde, e o registro faz parte dele.
//
// A quarta é `na_escala`, e ela existe porque as outras três não bastavam: um
// residente em rodízio ou um colega que só faz avaliação passava por todas e
// aparecia na fila de qualquer jeito. `?? true` mantém quem já estava lá
// enquanto a coluna não existir no banco.
const ehEscalavel = (p: { status: string; role: string; crm: string | null; na_escala?: boolean }) =>
  p.status === "ativo" && !EQUIPE_DE_APOIO.includes(p.role)
  && Boolean((p.crm ?? "").trim()) && (p.na_escala ?? true);

type Perfil = { id: string; institution_id: string; nome: string; role: string; permissoes?: string[] | null; status?: string; must_reset: boolean; super_admin?: boolean };
type Organizacao = { nome: string; tipo?: string | null; telefone?: string | null; email?: string | null };
// O que minha_assinatura() devolve. cancelada_em é o que separa "vai
// renovar" de "vai até a data e acaba".
type Assinatura = {
  organizacao: string; plano: string; assinatura_ate: string | null;
  dias_restantes: number | null; profissionais: number; valor_mensal: number;
  liberada: boolean; cancelada_em: string | null;
  // Ainda ativa, é a previsão de como seria cancelando agora. Já cancelada, é
  // a decisão que foi tomada na hora e não muda mais.
  reembolso_devido: boolean; dias_de_uso: number | null; prazo_de_reembolso: number;
};
type Convite = { id:string; email:string; role:string; token:string; status:string; expires_at:string; created_at:string };
type Paciente = {
  id: string; nome: string; cpf: string | null; rg?: string | null; data_nascimento: string | null;
  sexo?: string | null; telefone: string | null; email: string | null; endereco?: string | null;
  cidade?: string | null; uf?: string | null; cep?: string | null; hospital?: string | null;
  cirurgia?: string | null; especialidade?: string | null; procedimento?: string | null;
  convenio?: string | null; numero_carteirinha?: string | null; validade?: string | null;
  plano?: string | null; data_consulta?: string | null; horario?: string | null;
  observacoes?: string | null; created_at: string;
};
type Avaliacao = { id: string; patient_id: string; created_by?: string | null; status: string; versao?: number; updated_at: string; created_at: string; concluida_at?: string | null; dados?: Record<string, unknown> | null; local_atendimento_id?: string | null };
type Agendamento = { id:string; patient_id:string; avaliacao_id:string|null; data:string; horario:string|null; status:string; hospital:string|null; procedimento:string|null; convenio:string|null; observacoes:string|null; created_at:string; updated_at:string };
type Financeiro = { id:string; institution_id:string; patient_id:string; avaliacao_id:string|null; medico_id:string|null; convenio:string; hospital:string|null; valor:number; recebido:number; status:string; nota_fiscal:string|null; nota_emitida_at?:string|null; nota_vencimento_at?:string|null; nota_reprogramada_at?:string|null; lote:string|null; data_recebimento:string|null; repasse_valor:number; repasse_status:string; glosa_valor?:number; periodo?:string|null; fechado_at?:string|null; observacoes:string|null; created_at:string };
type Pagamento = { id:string; atendimento_id:string; valor:number; metodo:string; referencia:string|null; paid_at:string };
type PerfilGerenciado = { id:string; institution_id:string; nome:string; email:string|null; role:string; status:string; crm:string|null; rqe:string|null; permissoes:string[]|null; sem_acesso?:boolean; na_escala?:boolean; created_at:string; updated_at:string };
type Auditoria = { id:string; actor_id:string|null; entidade:string; entidade_id:string|null; acao:string; detalhes:Record<string,unknown>; created_at:string };
type Periodo = { id:string; periodo:string; status:string; conferido_at:string|null; fechado_at:string|null };
type ConvenioValor = { id:string; institution_id:string; convenio:string; procedimento:string|null; hospital:string|null; valor:number; repasse_percentual:number|null; ativo:boolean; created_at:string; updated_at:string };
export type DashboardView = "medico" | "plantoes" | "recepcao" | "financeiro" | "admin";

// A lista de convênios é a mesma no cadastro do paciente e no financeiro:
// os padrão, mais os que a organização cadastrou, menos os que ela removeu.
//
// "Remover" é uma regra com ativo=false, não um DELETE: os nomes padrão vêm
// de uma constante do código e não há como apagá-los por organização. E um
// convênio que algum paciente usa nunca some da lista — sumir deixaria o
// cadastro dele apontando para uma opção inexistente.
function listarConvenios(regras:ConvenioValor[],pacientes:{convenio?:string|null}[]){
  const emUso=new Set(pacientes.map(p=>p.convenio).filter((v):v is string=>Boolean(v)));
  const base=regras.filter(r=>!r.procedimento&&!r.hospital);
  const ocultos=new Set(base.filter(r=>!r.ativo).map(r=>r.convenio));
  const todos=new Set<string>([...CONVENIOS,...emUso,...base.filter(r=>r.ativo).map(r=>r.convenio)]);
  return Array.from(todos)
    .filter(c=>emUso.has(c)||!ocultos.has(c))
    .sort((a,b)=>a.localeCompare(b,"pt-BR"));
}

const brDate = (date?: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—";
/**
 * A sigla do avatar: primeiro nome e último sobrenome.
 *
 * Havia uma cópia local aqui que pegava as duas primeiras palavras do nome —
 * e "Dr" é uma palavra. Todo médico cadastrado com o tratamento na frente
 * virava "D" alguma coisa: Dr. Gustavo Segobia saía "DG", Dr. Igor Morais
 * Monteiro saía "DI", e a letra que deveria distinguir as pessoas era a mesma
 * para metade da equipe.
 *
 * A função boa já existia em lib/escala, com teste para esse caso exato. Uma
 * regra de nome, dois lugares: era só questão de tempo até divergirem.
 */
const initials = iniciais;
const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const timeToMinutes = (time?: string | null) => {
  const [hours, minutes] = String(time ?? "").split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
};
const minutesToTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
const nextAutomaticAppointmentTime = (date: string, appointments: Pick<Agendamento, "horario" | "status">[], now = new Date()) => {
  const morningStart = 8 * 60 + 30;
  const lunchStart = 12 * 60;
  const afternoonStart = 13 * 60 + 30;
  const interval = 30;
  let candidate = morningStart;

  if (date === localDateKey(now)) {
    const currentMinute = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() > 0 || now.getMilliseconds() > 0 ? 1 : 0);
    if (currentMinute <= morningStart) candidate = morningStart;
    else if (currentMinute < lunchStart) {
      candidate = Math.ceil(currentMinute / interval) * interval;
      if (candidate >= lunchStart) candidate = afternoonStart;
    } else if (currentMinute <= afternoonStart) candidate = afternoonStart;
    else candidate = Math.ceil(currentMinute / interval) * interval;
  }

  const occupied = new Set(
    appointments
      .filter((appointment) => !["cancelado", "reagendado"].includes(appointment.status))
      .map((appointment) => timeToMinutes(appointment.horario))
      .filter((minutes): minutes is number => minutes !== null),
  );
  while (occupied.has(candidate)) {
    candidate += interval;
    if (candidate >= lunchStart && candidate < afternoonStart) candidate = afternoonStart;
  }
  return minutesToTime(candidate);
};

export function DashboardClient({
  perfil, email = "", organizacao = null, pacientes, avaliacoes, agendamentos, financeiro, pagamentos, perfis, auditoria, periodos, convenioValores, initialView,
  initialNewPatient = false, autoStartAssessment = false, localAtivo = null, totalDeLocais = 0, locais = [],
  trocasEsperando = 0,
  avisos = [],
  plantoesDaReceita = [], producaoDaReceita = [],
}: {
  perfil: Perfil; email?: string; organizacao?: Organizacao | null;
  pacientes: Paciente[]; avaliacoes: Avaliacao[]; agendamentos:Agendamento[];
  financeiro:Financeiro[]; pagamentos:Pagamento[]; perfis:PerfilGerenciado[]; auditoria:Auditoria[]; periodos:Periodo[]; convenioValores:ConvenioValor[];
  /**
   * As duas outras fontes de receita do serviço, para o Financeiro.
   *
   * A tela nasceu enxergando só a consulta pré-anestésica cobrada por convênio,
   * e para a maioria dos grupos de anestesia essa é a MENOR fatia: o plantão e
   * a produção do dia existiam no sistema e não chegavam a conta nenhuma.
   */
  plantoesDaReceita?: PlantaoBruto[]; producaoDaReceita?: ProducaoBruta[];
  /** Onde a pessoa está atendendo agora. Null quando a organização ainda não cadastrou nenhum local. */
  localAtivo?:LocalDisponivel|null; totalDeLocais?:number; locais?:LocalDisponivel[];
  initialView?: DashboardView;
  initialNewPatient?: boolean;
  autoStartAssessment?: boolean;
  /**
   * Plantões oferecidos esperando a resposta desta pessoa.
   *
   * Chega do servidor como contagem, e não como lista: a Escala já carrega os
   * pedidos inteiros quando é aberta, e trazer os mesmos dados duas vezes é
   * uma consulta a mais em toda abertura do painel.
   */
  trocasEsperando?: number;
  /** O que espera você, já derivado no servidor. Ver lib/avisos.ts. */
  avisos?: Aviso[];
}) {
  const router = useRouter();
  const allowedViews = useMemo<DashboardView[]>(() => {
    // Médico primeiro: é a área de trabalho do anestesiologista, e a ordem daqui
    // decide tanto os botões da barra quanto em qual área o sistema abre. Quem
    // não tem Médico continua abrindo na própria área — a lista é filtrada pelo
    // que a pessoa pode ver, então nunca sobra ninguém sem aba.
    //
    // ATENÇÃO: esta lista tem uma gêmea em app/dashboard/page.tsx, e as duas
    // precisam concordar. O servidor usa a dele para decidir quais dados
    // carregar; esta aqui decide quais botões aparecem. Área nova acrescentada
    // só de um lado vira exatamente o que aconteceu com Plantões: o botão
    // existe no código, a condição nunca é verdadeira, e a aba simplesmente
    // não nasce — sem erro, sem aviso, sem nada para investigar.
    //
    // A ordem tem uma terceira gêmea: a dos botões no JSX da barra, mais
    // abaixo, que é escrita à mão. Mudar a ordem aqui sem mudar lá deixa a
    // barra numa ordem e a área de entrada noutra.
    const permissionOrder: DashboardView[] = ["medico", "recepcao", "financeiro", "admin", "plantoes"];
    const assignedPermissions = Array.isArray(perfil.permissoes) ? perfil.permissoes : [];
    if (["admin", "owner"].includes(perfil.role) || assignedPermissions.includes("todos")) return permissionOrder;
    const permittedViews = permissionOrder.filter((area) => perfil.role === area || assignedPermissions.includes(area)
      // Plantões acompanha o acesso Médico: não é uma permissão à parte.
      || (area === "plantoes" && (perfil.role === "medico" || assignedPermissions.includes("medico"))));
    return permittedViews.length > 0 ? permittedViews : ["medico"];
  }, [perfil.role, perfil.permissoes]);
  const view = initialView && allowedViews.includes(initialView) ? initialView : allowedViews[0];
  const [isAreaPending, startAreaTransition] = useTransition();
  const [open, setOpen] = useState(initialNewPatient);
  const [search, setSearch] = useState("");
  const [agendaRange, setAgendaRange] = useState<"hoje"|"amanha"|"semana">("hoje");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState("todas");
  // Começa em "todos", e não no local ativo — o pedido diz "mostrar primeiro",
  // que é ordenar, não esconder. Filtrar por padrão abriria o histórico vazio
  // para quem acabou de adotar os locais: nenhuma avaliação anterior tem um, e
  // a tela pareceria ter perdido o trabalho de meses.
  const [historyLocal, setHistoryLocal] = useState("todos");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [dark, setDark] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  // O pedido de abrir o chat, vindo da caixa de avisos. O token cresce a cada
  // clique: sem ele, clicar duas vezes no mesmo aviso não reabriria a janela.
  const [pedidoDeChat, setPedidoDeChat] = useState<
    { aba: "equipe" | "suporte"; chamado?: string | null; token: number } | null
  >(null);
  // O mesmo, para a Escala: em que aba ela deve abrir quando o clique veio do
  // sino. Mesma razão para o token — a aba é estado da tela da Escala, e a
  // pessoa pode ter saído dela entre um clique e outro.
  const [aberturaDaEscala, setAberturaDaEscala] = useState<
    { aba: "escala" | "producao" | "trocas"; token: number } | null
  >(null);
  /** Em que seção do Admin abrir, quando o pedido vem de outra área. */
  const [aberturaDoAdmin, setAberturaDoAdmin] = useState<
    { aba: string; token: number } | null
  >(null);
  const [contaAberta, setContaAberta] = useState(false);
  const [senha, setSenha] = useState({atual:"",nova:"",confirma:""});
  const [senhaMsg, setSenhaMsg] = useState("");
  const [senhaBusy, setSenhaBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState("");
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string,string>>({});
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // O "Pesquisar paciente" da área Médico focava o campo da Recepção, que não
  // está montado aqui — o botão simplesmente não fazia nada. Passa a focar a
  // busca do histórico, que é o campo de busca que existe nesta tela.
  const buscaHistoricoRef = useRef<HTMLInputElement>(null);
  const [secaoRecepcao,setSecaoRecepcao]=useState<"hoje"|"buscar">("hoje");
  const [secaoMedico,setSecaoMedico]=useState("agenda");
  const filtered = useMemo(() => pacientes.filter((p) => `${p.nome} ${p.cpf ?? ""} ${p.telefone ?? ""} ${p.cirurgia ?? ""} ${p.procedimento ?? ""}`.toLowerCase().includes(search.toLowerCase())), [pacientes, search]);
  const currentByPatient = useMemo(() => {
    const result = new Map<string,Avaliacao>();
    for (const item of avaliacoes) if (!result.has(item.patient_id)) result.set(item.patient_id, item);
    return result;
  }, [avaliacoes]);
  const evaluationById = useMemo(() => new Map(avaliacoes.map((a)=>[a.id,a])), [avaliacoes]);
  const drafts = avaliacoes.filter((a) => a.status === "rascunho");
  const completed = avaliacoes.filter((a) => a.status === "concluida");
  const orientacoesPendentes = completed.filter((a) => a.dados?.orientacoes_enviadas !== true);
  // O que a Central mostra em número quando está recolhida. Só entra aqui o
  // que tem contagem real: os outros dois alertas são lembretes fixos da
  // rotina, e somá-los inflaria o aviso com trabalho que talvez não exista.
  const pendenciasCentral = drafts.length + orientacoesPendentes.length;
  const today = localDateKey();
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate()+1);
  const tomorrow = localDateKey(tomorrowDate);
  const weekLimit = new Date(); weekLimit.setDate(weekLimit.getDate()+7);
  const week = localDateKey(weekLimit);
  const patientMap = useMemo(() => new Map(pacientes.map((p)=>[p.id,p])), [pacientes]);
  const professionalMap = useMemo(() => new Map(perfis.map((item)=>[item.id,item.nome])), [perfis]);
  const historicalAssessments = useMemo(() => avaliacoes.filter((assessment) => {
    const patient = patientMap.get(assessment.patient_id);
    const professional = assessment.created_by ? professionalMap.get(assessment.created_by) ?? "" : "";
    const searchable = `${patient?.nome ?? ""} ${patient?.cpf ?? ""} ${patient?.cirurgia ?? ""} ${patient?.procedimento ?? ""} ${patient?.hospital ?? ""} ${professional}`.toLowerCase();
    const referenceDate = (assessment.concluida_at || assessment.updated_at || assessment.created_at).slice(0, 10);
    return (historyStatus === "todas" || assessment.status === historyStatus)
      && (historyLocal === "todos"
          || (historyLocal === "sem" ? !assessment.local_atendimento_id
              : assessment.local_atendimento_id === historyLocal))
      && (!historyQuery || searchable.includes(historyQuery.toLowerCase()))
      && (!historyFrom || referenceDate >= historyFrom)
      && (!historyTo || referenceDate <= historyTo);
  }).sort((a,b) => {
    // Sem filtro escolhido, o que foi feito no local de hoje sobe. É o
    // "mostrar primeiro" do pedido: nada some, só muda de ordem. Com um
    // filtro ativo a comparação empata em todos, e vale a data.
    const doLocal = (x:Avaliacao) => localAtivo && x.local_atendimento_id === localAtivo.id ? 0 : 1;
    return doLocal(a) - doLocal(b)
      || (b.concluida_at || b.updated_at || b.created_at).localeCompare(a.concluida_at || a.updated_at || a.created_at);
  }), [avaliacoes, patientMap, professionalMap, historyQuery, historyStatus, historyFrom, historyTo, historyLocal, localAtivo]);
  const scheduledToday = agendamentos.filter((a) => a.data === today && !["cancelado","reagendado"].includes(a.status));
  const queue = scheduledToday;
  const filteredAgenda = agendamentos.filter((item) => {
    if (agendaRange === "hoje") return item.data === today;
    if (agendaRange === "amanha") return item.data === tomorrow;
    return item.data >= today && item.data <= week;
  }).filter((item) => {
    const p=patientMap.get(item.patient_id);
    return `${p?.nome??""} ${p?.cpf??""} ${p?.cirurgia??""} ${p?.procedimento??""} ${item.procedimento??""}`.toLowerCase().includes(search.toLowerCase());
  });
  const completedThisMonth = completed.filter((a)=>a.updated_at.slice(0,7)===today.slice(0,7));
  const asaHigh = completed.filter((a)=>["ASA III","ASA IV","ASA V","ASA VI"].includes(String(a.dados?.asa??""))).length;

  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
    const fd = new FormData(event.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim() || null;
    const patientName=text("nome");
    const convenio=text("convenio");
    const plano=text("plano");
    const birthDate=text("data_nascimento");
    const cpfDigits=String(text("cpf")??"").replace(/\D/g,"");
    const phoneDigits=String(text("telefone")??"").replace(/\D/g,"");
    if(!patientName){
      setError("Informe o nome completo do paciente.");
      setBusy(false);
      return;
    }
    if(cpfDigits.length!==11){
      setError("Informe um CPF válido com 11 números.");
      setBusy(false);
      return;
    }
    // Particular não tem plano: o campo fica desabilitado no formulário e o valor
    // é descartado aqui para não gravar lixo de preenchimento automático.
    // Nos demais convênios o plano é opcional — a recepção nem sempre tem a
    // carteirinha em mãos na hora de agendar, e travar o cadastro por causa
    // disso só empurrava o atendimento para o papel.
    const isPrivatePay=convenio===PRIVATE_PAY_CONVENIO;
    const planoFinal=isPrivatePay?null:(plano||null);
    if(phoneDigits && (phoneDigits.length<10 || phoneDigits.length>11)){
      setError("Informe um telefone com DDD.");
      setBusy(false);
      return;
    }
    if(birthDate){
      const birth=new Date(`${birthDate}T12:00:00`),todayDate=new Date();
      const age=todayDate.getFullYear()-birth.getFullYear()-(todayDate<new Date(todayDate.getFullYear(),birth.getMonth(),birth.getDate())?1:0);
      if(!Number.isFinite(age)||age<0||age>130){
        setError("Data de nascimento inválida. Confira o ano antes de salvar.");
        setBusy(false);
        return;
      }
    }
    const appointmentDate = text("data_consulta") || localDateKey();
    const supabase = createClient();
    if(appointmentDate < localDateKey()){
      setError("A data da consulta não pode ser anterior à data de hoje.");
      setBusy(false);
      return;
    }
    if(cpfDigits){
      const {data:duplicate}=await supabase.from("pacientes").select("id,nome").eq("cpf",cpfDigits).maybeSingle();
      if(duplicate){
        setError(`Já existe um paciente com este CPF: ${duplicate.nome}.`);
        setBusy(false);
        return;
      }
    }
    const {data:appointmentsForDate,error:appointmentsError}=await supabase
      .from("agendamentos")
      .select("horario,status")
      .eq("institution_id",perfil.institution_id)
      .eq("data",appointmentDate);
    if(appointmentsError){
      setError(`Não foi possível calcular o próximo horário disponível: ${appointmentsError.message}`);
      setBusy(false);
      return;
    }
    // Horário em branco = próximo livre da agenda. Preenchido, respeita o que a
    // recepção marcou — é comum o paciente já chegar com hora combinada.
    const horarioEscolhido=String(text("horario")??"").trim();
    const automaticTime=horarioEscolhido
      ? `${horarioEscolhido}:00`.slice(0,8)
      : nextAutomaticAppointmentTime(appointmentDate,appointmentsForDate??[]);
    if(horarioEscolhido){
      const jaOcupado=(appointmentsForDate??[]).some(item=>
        !["cancelado","reagendado"].includes(item.status)&&
        String(item.horario??"").slice(0,5)===horarioEscolhido);
      if(jaOcupado){
        setError(`Já existe uma consulta às ${horarioEscolhido} nesta data. Escolha outro horário ou deixe em branco para o próximo livre.`);
        setBusy(false);
        return;
      }
    }
    const patientPayload = {
      institution_id: perfil.institution_id, created_by: perfil.id,
      nome: patientName, cpf: cpfDigits, rg: text("rg"), data_nascimento: birthDate,
      // Só entra quando não há data de nascimento: com as duas gravadas, um
      // aniversário faria as duas discordarem sem ninguém perceber.
      idade_anos: birthDate ? null : lerIdadeInformada(text("idade_anos")),
      sexo: text("sexo"), telefone: phoneDigits||null, email: text("email"), endereco: text("endereco"),
      cidade: text("cidade"), uf: text("uf"), cep: text("cep"), hospital: text("hospital"),
      cirurgia: text("cirurgia"), especialidade: text("especialidade"),
      convenio: convenio ?? PRIVATE_PAY_CONVENIO,
      numero_carteirinha: isPrivatePay?null:text("numero_carteirinha"), validade: isPrivatePay?null:text("validade"),
      plano: planoFinal, data_consulta: appointmentDate, horario: automaticTime, observacoes: text("observacoes"),
    };
    const appointmentPayload = {
      data: appointmentDate, horario: automaticTime, hospital: text("hospital"),
      procedimento: text("cirurgia"), convenio: convenio ?? PRIVATE_PAY_CONVENIO,
      observacoes: text("observacoes"), created_by: perfil.id,
    };
    const atomic = await supabase.rpc("criar_paciente_e_agendamento", {
      p_paciente: patientPayload, p_agendamento: appointmentPayload,
    });
    if (!atomic.error) {
      if (autoStartAssessment) {
        const result = (Array.isArray(atomic.data) ? atomic.data[0] : atomic.data) as {
          patient_id?: string;
          appointment_id?: string | null;
        } | null;
        if (!result?.patient_id) {
          throw new Error("Paciente salvo, mas não foi possível identificar o novo cadastro.");
        }
        await openAssessment(result.patient_id, result.appointment_id ?? undefined);
        return;
      }
      setOpen(false);
      router.refresh();
      return;
    }
    // Compatibilidade temporária até a migração de cadastro atômico ser executada no Supabase.
    if (atomic.error.code !== "PGRST202") {
      setError(`Não foi possível salvar paciente e consulta: ${atomic.error.message}`);
      setBusy(false);
      return;
    }
    const { data:created, error: insertError } = await supabase.from("pacientes").insert(patientPayload).select("id").single();
    if (insertError) { setError(`Não foi possível salvar: ${insertError.message}`); setBusy(false); return; }
    if(created){
      const {data:createdAppointment,error:agendaError}=await supabase.from("agendamentos").insert({
        institution_id:perfil.institution_id,patient_id:created.id,...appointmentPayload,
      }).select("id").single();
      if(agendaError){
        setError(`Paciente salvo, mas o agendamento não foi criado: ${agendaError.message}`);
        setBusy(false);
        return;
      }
      if(autoStartAssessment){
        await openAssessment(created.id,createdAppointment?.id);
        return;
      }
    }
    setOpen(false); router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Erro desconhecido ao salvar.";
      setError(`Não foi possível salvar: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function openAssessment(patientId: string, appointmentId?:string, assessmentId?:string|null) {
    const existing = assessmentId ? evaluationById.get(assessmentId) : currentByPatient.get(patientId);
    if (existing && existing.status === "rascunho") { router.push(`/avaliacoes/${existing.id}`); return; }
    if (existing && existing.status === "concluida") { router.push(`/avaliacoes/${existing.id}/documentos`); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const previous=currentByPatient.get(patientId);
    const { data, error: createError } = await supabase.from("avaliacoes").insert({
      institution_id: perfil.institution_id, patient_id: patientId, created_by: perfil.id, status: "rascunho",
      // Onde o paciente está sendo atendido. O gatilho do banco congela os
      // dados do local a partir daqui, e é esse congelado que os documentos
      // imprimem — trocar de local depois não mexe nesta avaliação.
      local_atendimento_id: localAtivo?.id ?? null,
      versao:previous?.status==="concluida"?Number(previous.versao||1)+1:1,
      avaliacao_anterior_id:previous?.status==="concluida"?previous.id:null,
    }).select("id").single();
    if (createError || !data) { setError(createError?.message ?? "Falha ao iniciar avaliação."); setBusy(false); return; }
    // O agendamento aponta para a avaliação que acabou de nascer. Se esta
    // ligação falha em silêncio, a avaliação existe e a fila da recepção
    // continua sem saber dela: o paciente aparece como não avaliado, e alguém
    // começa uma segunda avaliação do mesmo caso. A avaliação já está criada,
    // então isto não impede de seguir — avisa e segue.
    if(appointmentId){
      const {error:linkError}=await supabase.from("agendamentos")
        .update({avaliacao_id:data.id,updated_at:new Date().toISOString()}).eq("id",appointmentId);
      if(linkError) setError("A avaliação foi criada, mas não ficou ligada ao agendamento da recepção. Avise quem administra.");
    }
    router.push(`/avaliacoes/${data.id}`);
  }

  async function updateAttendance(appointmentId:string, agendaStatus:"presente"|"faltou") {
    const previous=agendamentos.find(item=>item.id===appointmentId)?.status;
    setAttendanceBusy(appointmentId); setError("");
    setAttendanceOverrides(current=>({...current,[appointmentId]:agendaStatus}));
    const supabase=createClient();
    // Esta função também registra a ação na auditoria. A atualização direta
    // abaixo é mantida somente como compatibilidade com bases ainda sem a migração.
    let result=await supabase.rpc("registrar_presenca",{
      p_agendamento_id:appointmentId,
      p_status:agendaStatus,
    });
    if(result.error){
      const now=new Date().toISOString();
      result=await supabase
        .from("agendamentos")
        .update({ status:agendaStatus, status_by:perfil.id, status_at:now, updated_at:now })
        .eq("id",appointmentId)
        .select("id,status")
        .single();
    }
    setAttendanceBusy("");
    if(result.error){
      setAttendanceOverrides(current=>({...current,[appointmentId]:previous??"agendado"}));
      setError(`Não foi possível atualizar a presença: ${result.error.message}`);
    }
    else router.refresh();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  const firstDraft=drafts[0];
  const goToFirstDraft=()=>firstDraft&&router.push(`/avaliacoes/${firstDraft.id}`);
  const changeView=(nextView:DashboardView)=>{
    if(nextView===view)return;
    startAreaTransition(()=>router.push(`/dashboard?area=${nextView}`,{scroll:false}));
  };

  return (
    <main className={`clinicalShell ${dark?"clinicalDark":""}`}>
      <header className="clinicalTopbar">
        <Link className="clinicalBrand" href="/"><BrandMark className="clinicalBrandMark" /><span><strong>AVANEST</strong><small>Gestão em anestesiologia</small></span></Link>
        {/* Com local escolhido, é ele que aparece: quem atende em três
            hospitais precisa saber em qual está antes de imprimir a primeira
            ficha, e o nome da organização é o mesmo nos três. Sem local
            cadastrado, o cabeçalho segue como sempre foi. */}
        {localAtivo ? (
          <Link
            className="orgBadge localAtivoBadge"
            href="/locais?trocar=1"
            title={`Atendendo em ${nomeDoLocal(localAtivo)}. Clique para trocar.`}
          >
            <span aria-hidden="true">📍</span>
            <strong>{nomeDoLocal(localAtivo)}</strong>
            {totalDeLocais > 1 && <span className="localSeta" aria-hidden="true">▾</span>}
            <span className="visuallyHidden">Trocar local de atendimento</span>
          </Link>
        ) : (
          <div className="orgBadge" title={organizacao?.nome ?? "Organização"}>
            <strong>{organizacao?.nome ?? "Organização"}</strong>
          </div>
        )}
        {/* Só os módulos de trabalho ficam na barra. Tema, assinatura, bloqueio
            e saída são utilidades: foram para o menu do usuário, senão nove
            controles disputam a mesma faixa e nenhum se destaca. */}
        {/* No celular a barra vira uma faixa que rola com o polegar, com TODAS
            as áreas. Antes ela mostrava só o Médico, e o resultado foi quem faz
            plantão abrir o telefone e não achar a Escala — sem nada na tela
            dizendo que ela existia noutro tamanho de janela. Área que some é
            área que o usuário conclui que o sistema não tem. */}
        <nav className="roleNav" aria-label="Áreas do sistema">
          {allowedViews.includes("medico")&&<button data-area="medico" disabled={isAreaPending} className={view === "medico" ? "active" : ""} aria-current={view==="medico"?"page":undefined} onClick={() => changeView("medico")}>Médico</button>}
          {allowedViews.includes("recepcao")&&<button data-area="recepcao" disabled={isAreaPending} className={view === "recepcao" ? "active" : ""} aria-current={view==="recepcao"?"page":undefined} onClick={() => changeView("recepcao")}>Recepção</button>}
          {allowedViews.includes("financeiro")&&<button data-area="financeiro" disabled={isAreaPending} className={view === "financeiro" ? "active" : ""} aria-current={view==="financeiro"?"page":undefined} onClick={() => changeView("financeiro")}>Financeiro</button>}
          {allowedViews.includes("admin")&&<button data-area="admin" disabled={isAreaPending} className={view === "admin" ? "active" : ""} aria-current={view==="admin"?"page":undefined} onClick={() => changeView("admin")}>Admin</button>}
          {/* O contador de trocas fica AQUI, no topo, e não só dentro da
              Escala. Um plantão oferecido que ninguém vê é o buraco chegando
              no dia da cirurgia — e quem está na Recepção ou no Financeiro
              precisa saber que tem alguém esperando resposta sem ter de abrir
              a Escala para descobrir. */}
          {allowedViews.includes("plantoes")&&<button data-area="plantoes" disabled={isAreaPending} className={view === "plantoes" ? "active" : ""} aria-current={view==="plantoes"?"page":undefined} onClick={() => changeView("plantoes")}>
            Escala
            {trocasEsperando>0&&<b className="navAviso" title={`${trocasEsperando===1?"Um plantão oferecido espera":"Plantões oferecidos esperam"} a sua resposta`}>{trocasEsperando}</b>}
          </button>}
        </nav>
        {/* Sino e menu do usuário viajam JUNTOS, num item só.
            A barra é um grid de quatro colunas, e não um flex: acrescentar o
            sino solto criou um quinto filho, que o grid jogou para uma segunda
            linha — o menu do usuário apareceu embaixo da marca. Agrupados, a
            barra continua com os mesmos quatro itens de sempre, e as regras de
            coluna dos três pontos de quebra seguem valendo sem serem tocadas. */}
        <div className="topbarFim">
        {/* O sino fica no TOPO, ao lado do seu nome, e não dentro da Escala.
            O aviso que importa nasce numa área e é lido em outra: um plantão
            oferecido às 6 da manhã por quem passou mal precisa alcançar quem
            está na Recepção cadastrando paciente — e essa pessoa não tem
            motivo nenhum para abrir a Escala.

            O contador da aba Escala continua onde está. Ele responde outra
            pergunta — "tem coisa esperando LÁ DENTRO" — e some junto quando a
            resposta é dada. */}
        <CaixaDeAvisos
          avisos={avisos}
          onIr={(aviso) => {
            // O clique tem de RESOLVER, não só informar. Um aviso que abre uma
            // lista onde a pessoa ainda precisa procurar do que ele falava é
            // meio caminho, e o meio caminho é onde ela desiste.
            //
            // E o clique escolhe a ABA, não só a área. O aviso de troca cai em
            // Trocas, onde estão o dia, o horário e os botões Assumir e
            // Recusar — largá-lo no calendário obrigaria a procurar dia a dia
            // um pedido que está a uma aba de distância.
            //
            // Os lembretes de dinheiro moram na Escala, na aba Produção: é lá
            // que se marca "faturado" e "recebido". Mandar para o Financeiro
            // seria mandar para a tela da organização, e a conta é da pessoa.
            if (aviso.area === "plantoes" || aviso.area === "producao") {
              changeView("plantoes");
              setAberturaDaEscala({
                aba: aviso.tipo === "troca_pedida" || aviso.tipo === "troca_resolvida"
                  ? "trocas"
                  : aviso.area === "producao" ? "producao" : "escala",
                token: Date.now(),
              });
              return;
            }
            setPedidoDeChat({
              aba: aviso.area === "suporte" ? "suporte" : "equipe",
              chamado: aviso.area === "suporte" ? aviso.id : null,
              token: Date.now(),
            });
          }}
        />
        <div className="userMenuWrap">
          <button
            className="userMenuTrigger"
            onClick={()=>setUserMenu(open=>!open)}
            aria-expanded={userMenu}
            aria-haspopup="menu"
          >
            <span className="userMenuAvatar" aria-hidden="true">{initials(perfil.nome)}</span>
            <span className="userMenuNome">
              <strong>{perfil.nome}</strong>
              <small>{ROLE_LABELS[perfil.role] ?? perfil.role}</small>
            </span>
            <span className="userMenuSeta" aria-hidden="true">▾</span>
          </button>
          {userMenu&&<>
            {/* Clique fora fecha o menu sem precisar de listener global. */}
            <button className="userMenuFundo" aria-label="Fechar menu" onClick={()=>setUserMenu(false)}/>
            <div className="userMenuLista" role="menu">
              {/* Ferramentas de apoio: nao mexem em paciente nenhum, e por isso
                  saem da barra das areas de trabalho. Enquanto os modulos
                  amadurecem, so o super-admin ve — a pagina tambem recusa
                  quem nao e, porque menu escondido nao e restricao. */}
              {perfil.super_admin===true&&<>
                <Link role="menuitem" href="/calculos" onClick={()=>setUserMenu(false)}>
                  <Icone nome="calculadora"/> Cálculos extras
                </Link>
                <hr/>
              </>}
              {/* menuitemcheckbox, nao menuitem: o item liga e desliga um estado
                  e o leitor de tela precisa anunciar qual e o atual. */}
              {/* Um tutorial que não se reabre é um tutorial que se perde no
                  primeiro "Pular". */}
              <button role="menuitem" onClick={()=>{setUserMenu(false);reabrirTutorial()}}>
                <Icone nome="estrela"/> Ver o tutorial
              </button>
              <hr/>
              <button role="menuitemcheckbox" aria-checked={dark} onClick={()=>{setDark(value=>!value);setUserMenu(false)}}>
                <Icone nome="tema"/> {dark?"Tema claro":"Tema escuro"}
              </button>
              <button role="menuitem" onClick={()=>{
                setUserMenu(false);setContaAberta(true);setSenhaMsg("");
                setSenha({atual:"",nova:"",confirma:""});
              }}>
                <Icone nome="pessoa"/> Minha conta e senha
              </button>
              {["owner","admin"].includes(perfil.role)&&
                <Link role="menuitem" href="/assinatura" onClick={()=>setUserMenu(false)}>
                  <Icone nome="assinatura"/> Assinatura
                </Link>}
              {perfil.super_admin===true&&
                <Link role="menuitem" href="/organizacoes" onClick={()=>setUserMenu(false)}>
                  <Icone nome="estrela"/> Organizações
                </Link>}
              <hr/>
              <button role="menuitem" onClick={logout}><Icone nome="cadeado"/> Bloquear tela</button>
              <button role="menuitem" className="userMenuSair" onClick={logout}>Sair da conta</button>
            </div>
          </>}
        </div>
        </div>
      </header>

      {view === "medico" ? (
        <div className="clinicalMain">
          <section className="clinicalWelcome">
            <div><h1>Consultas pré-anestésicas agendadas</h1><p>Olá, {perfil.nome}. Acompanhe a fila e continue suas avaliações.</p></div>
            <button className="primaryClinical" onClick={() => setOpen(true)}>+ Nova avaliação pré-anestésica</button>
          </section>
          {error && <p className="clinicalError">{error}</p>}
          {/* A barra de cinco cartões saiu daqui.
              Três deles — consultas de hoje, pendências e orientações — já
              apareciam mais duas vezes cada: no contador ao lado do item do
              menu e escritos por extenso dentro da própria seção. Três cópias
              do mesmo número não informam três vezes mais; informam a mesma
              coisa e ocupam a primeira tela do dia.
              Os outros dois — concluídas no mês e ASA III+ — não pedem ação
              nenhuma: são retrato do passado. Foram para o topo do Histórico,
              que é justamente a tela que eles descrevem. */}

          <div className="financeLayout">
            <nav className="financeTarefas" aria-label="Seções da área Médico">
              {([
                ["grupo","Atendimento"],
                // Uma entrada só. "Consultas de hoje" e "Agenda" mostravam os
                // mesmos agendamentos — no código eram a mesma variável —, com
                // desenhos diferentes e uma discordância silenciosa: a Agenda
                // contava cancelados e a fila não, então as duas telas diziam
                // números diferentes para o mesmo dia.
                ["agenda","Agenda",queue.length],
                ["grupo","Acompanhamento"],
                ["central","Central Operacional",pendenciasCentral],
                ["historico","Histórico de avaliações"],
              ] as [string,string,number?][]).map(([id,rotulo,contador],i)=>
                id==="grupo"
                  ? <span className="financeTarefaGrupo" key={`g${i}`}>{rotulo}</span>
                  : <button
                      type="button" key={id}
                      className={secaoMedico===id?"active":""}
                      aria-current={secaoMedico===id?"true":undefined}
                      onClick={()=>setSecaoMedico(id)}
                    >
                      <span>{rotulo}</span>
                      {contador?<b className="financeTarefaContador">{contador}</b>:null}
                    </button>)}
              <span className="financeTarefaGrupo">Atalhos</span>
              <button type="button" className="financeTarefaAtalho" onClick={goToFirstDraft}>
                <span>Continuar avaliação pendente</span>
              </button>
              <button type="button" className="financeTarefaAtalho"
                disabled={!completed[0]}
                onClick={()=>completed[0]&&router.push(`/avaliacoes/${completed[0].id}/documentos`)}>
                <span>Documentos mais recentes</span>
              </button>
            </nav>

            <div className="financeConteudo">
            {secaoMedico==="agenda"&&<>
          <section className="clinicalPanel agendaPanel">
            <div className="agendaHead"><strong>Agenda</strong><button className={agendaRange==="hoje"?"active":""} onClick={()=>setAgendaRange("hoje")}>Hoje</button><button className={agendaRange==="amanha"?"active":""} onClick={()=>setAgendaRange("amanha")}>Amanhã</button><button className={agendaRange==="semana"?"active":""} onClick={()=>setAgendaRange("semana")}>Semana</button><input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por paciente, CPF, procedimento..." /></div>
            {filteredAgenda.slice(0,20).map((appointment, index) => {
              const p=patientMap.get(appointment.patient_id); if(!p)return null;
              const a=appointment.avaliacao_id?evaluationById.get(appointment.avaliacao_id):undefined;
              const attendance=attendanceOverrides[appointment.id]??appointment.status;
              const desmarcado=["cancelado","reagendado"].includes(attendance);
              const statusLabel=a?.status==="concluida"?"CONCLUÍDA":a?.status==="rascunho"?"AVALIAÇÃO PAUSADA":attendance==="presente"?"PACIENTE PRESENTE":attendance==="faltou"?"FALTOU":desmarcado?attendance.toUpperCase():"AGUARDANDO";
              const statusTone=a?.status==="concluida"||attendance==="presente"?"present":attendance==="faltou"?"danger":a?.status==="rascunho"?"paused":"waiting";
              // A data só aparece quando o período mostra mais de um dia. Em
              // "Hoje" ela seria a mesma em todas as linhas, e o que interessa
              // ali é a HORA — que é como a fila se lê de cima para baixo.
              const soHoje=agendaRange==="hoje";
              const hora=appointment.horario?.slice(0,5) || `${8 + index}:00`.padStart(5,"0");
              return <div className={desmarcado?"queueRow desmarcado":"queueRow"} key={appointment.id}>
                {/* Data e hora em duas linhas curtas, e não "27/08 · 08:30"
                    numa só: abaixo de 1050px a coluna da hora encolhe para
                    65px, e a frase inteira não cabe. */}
                <time>{soHoje ? hora : <><span>{brDate(appointment.data)}</span><small>{hora}</small></>}</time>
                <div className="queueInfo"><strong>{p.nome}</strong><small>{appointment.procedimento || p.procedimento || p.cirurgia || "Procedimento não informado"} · {appointment.hospital || p.hospital || "Hospital não informado"}</small></div>
                <span className={`statusChip ${statusTone}`}>{statusLabel}</span>
                {/* O botão de ação era exclusivo da fila de hoje. Trazê-lo para
                    cá é o ganho da fusão: dá para adiantar na véspera a
                    avaliação de um paciente de amanhã, coisa que antes não
                    tinha por onde. Desmarcado não abre — não há o que atender. */}
                <button className="primaryClinical compact" disabled={busy||attendance==="faltou"||desmarcado} onClick={() => openAssessment(p.id,appointment.id,appointment.avaliacao_id)}>{a?.status==="concluida"?"Ver documentos":a?.status==="rascunho"?"Continuar avaliação":"Iniciar avaliação"}</button>
              </div>;
            })}
            {filteredAgenda.length===0&&<div className="emptyClinical">{agendaRange==="hoje"?"Nenhuma consulta agendada para hoje.":"Nenhum agendamento neste período."}</div>}
          </section>
            </>}
            {secaoMedico==="central"&&<>
          <PainelRecolhivel
            className="alertsPanel"
            chave="central-operacional"
            titulo="Central Operacional"
            legenda="alertas da rotina baseados nas avaliações em andamento"
            extra={pendenciasCentral > 0 ? (
              <em className="centralResumo">{pendenciasCentral} pendência{pendenciasCentral > 1 ? "s" : ""}</em>
            ) : undefined}
          >
            <div className="alertGrid">
              <Alert icone="alerta" title="Avaliações incompletas" text={`${drafts.length} avaliação(ões) aguardando conclusão`} action="REVISAR" danger onClick={goToFirstDraft} />
              <Alert icone="alerta" title="Medicamentos" text="Revisar anticoagulantes e GLP-1 durante a anamnese" action="AVALIAR" onClick={goToFirstDraft} />
              <Alert icone="fechar" title="Exames pendentes" text="Confira exames e pareceres antes da conclusão" action="PENDÊNCIA" onClick={goToFirstDraft} />
              <Alert icone="envelope" title="Orientações não enviadas" text={`${orientacoesPendentes.length} documento(s) aguardando envio`} action="ENVIAR" onClick={()=>completed[0]&&router.push(`/avaliacoes/${completed[0].id}/documentos`)} />
            </div>
          </PainelRecolhivel>
            </>}
            {secaoMedico==="historico"&&<>
          <section className="clinicalPanel historyPanel">
            <div className="panelTitle"><strong>Histórico de avaliações</strong></div>
            {/* Os dois números que ficavam na barra do topo. Ali eles eram a
                primeira coisa do dia e não pediam ação nenhuma; aqui são o
                resumo da lista que vem logo abaixo, que é o que eles medem.
                O ASA III+ conta todas as avaliações concluídas, não as de
                hoje — por isso o rótulo diz "no total". */}
            <section className="metricGrid historyResumo">
              <Metric value={completedThisMonth.length} label="Concluídas no mês" tone="green" />
              <Metric value={asaHigh} label="Pacientes ASA III+ no total" tone="red" />
            </section>
            <div className="historyFilters">
              <input ref={buscaHistoricoRef} value={historyQuery} onChange={(event)=>setHistoryQuery(event.target.value)} placeholder="Nome, CPF, procedimento, hospital ou profissional..." />
              <select value={historyStatus} onChange={(event)=>setHistoryStatus(event.target.value)} aria-label="Filtrar por status"><option value="todas">Todos os status</option><option value="rascunho">Em andamento</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option></select>
              {/* Só aparece com mais de um local: com um só, o filtro não filtra
                  nada e vira um controle que ocupa espaço sem responder nada. */}
              {locais.length>1&&(
                <select value={historyLocal} onChange={(event)=>setHistoryLocal(event.target.value)} aria-label="Filtrar por local de atendimento">
                  <option value="todos">Todos os locais</option>
                  {locais.map((item)=><option key={item.id} value={item.id}>{nomeDoLocal(item)}</option>)}
                  {/* As avaliações feitas antes desta funcionalidade não têm
                      local. Sem esta opção elas sumiriam do histórico assim que
                      alguém filtrasse, e pareceriam perdidas. */}
                  <option value="sem">Sem local registrado</option>
                </select>
              )}
              <label>De<input type="date" value={historyFrom} onChange={(event)=>setHistoryFrom(event.target.value)} /></label>
              <label>Até<input type="date" value={historyTo} onChange={(event)=>setHistoryTo(event.target.value)} /></label>
            </div>
            {historicalAssessments.slice(0,50).map((assessment)=>{const patient=patientMap.get(assessment.patient_id);const date=assessment.concluida_at||assessment.updated_at||assessment.created_at;const professional=assessment.created_by?professionalMap.get(assessment.created_by):undefined;const done=assessment.status==="concluida";return <Link className="historyRow" key={assessment.id} href={done?`/avaliacoes/${assessment.id}/documentos`:`/avaliacoes/${assessment.id}`}><span className="avatar">{initials(patient?.nome||"Paciente")}</span><span><strong>{patient?.nome||"Paciente não localizado"}</strong><small>{patient?.cpf||"CPF não informado"} · {patient?.procedimento||"Procedimento não informado"}{professional?` · ${professional}`:""}</small></span><time>{new Date(date).toLocaleDateString("pt-BR")}</time><span className={`statusChip ${done?"present":assessment.status==="cancelada"?"danger":"waiting"}`}>{done?"CONCLUÍDA":assessment.status==="rascunho"?"EM ANDAMENTO":assessment.status.toUpperCase()}</span><b>{done?"Ver documentos":"Continuar"}</b></Link>;})}
            {historicalAssessments.length===0&&<div className="emptyClinical compactEmpty">Nenhuma avaliação encontrada com estes filtros.</div>}
            {historicalAssessments.length>50&&<div className="historyLimit">Mostrando as 50 avaliações mais recentes. Refine os filtros para ver uma lista menor.</div>}
          </section>
            </>}
            </div>
          </div>
        </div>
      ) : view === "plantoes" ? (
        <Plantoes
          perfilId={perfil.id} institutionId={perfil.institution_id}
          locais={locais} ehAdmin={["owner","admin"].includes(perfil.role)}
          // Duas listas, e a diferença importa. `colegas` é todo mundo da
          // organização e serve para RESOLVER NOME: um plantão antigo de quem
          // hoje está inativo, ou de quem ainda não tem CRM no cadastro,
          // precisa continuar mostrando o nome de quem está escalado — filtrar
          // esta lista trocaria o nome por "Profissional" na escala inteira.
          //
          // `escalaveis` é quem pode ENTRAR na escala: médico com CRM. Quem
          // anestesia responde pelo ato com o registro dele, e escala é
          // documento de quem responde — recepção e financeiro não entram.
          colegas={perfis.map(p=>({id:p.id,nome:p.nome}))}
          escalaveis={perfis.filter(ehEscalavel).map(p=>({id:p.id,nome:p.nome}))}
          // Quem é da clínica, está ativo e ainda não tem CRM no cadastro.
          // Não some da lista em silêncio: vira aviso com o nome, porque
          // "fulano não aparece para escalar" sem explicação é o tipo de coisa
          // que faz o coordenador achar que a tela quebrou.
          semCRM={perfis
            .filter(p=>p.status==="ativo" && !EQUIPE_DE_APOIO.includes(p.role)
              && !(p.crm ?? "").trim())
            .map(p=>p.nome)}
          // A escala do grupo abre no hospital onde a pessoa está hoje: ela já
          // respondeu isso ao entrar, e perguntar de novo é perguntar duas vezes.
          localAtivoId={localAtivo?.id ?? null}
          abrirEm={aberturaDaEscala}
          // "+ Nova escala", no fim da lista de hospitais da Escala. Quem
          // descobre que falta um hospital descobre olhando aquela lista; o
          // cadastro fica no Admin, e este atalho leva até ele em vez de
          // deixar a pessoa procurar.
          onNovoLocal={()=>{ setAberturaDoAdmin({aba:"locais",token:Date.now()}); changeView("admin"); }}
          // Todo mundo que PODE entrar na escala, com o estado de cada um. É
          // a lista da janela "Quem entra na escala" — por isso não passa
          // pelo filtro de CRM: quem está sem CRM aparece lá, marcado e
          // travado, com o motivo escrito.
          equipe={perfis
            .filter(p=>p.status==="ativo" && !EQUIPE_DE_APOIO.includes(p.role))
            .map(p=>({id:p.id,nome:p.nome,crm:p.crm,naEscala:p.na_escala??true}))}
          onEquipeMudou={()=>router.refresh()}
          // Respondeu a troca, confirmou o plantão, ofereceu um turno: o sino
          // precisa ser remontado no servidor, senão o alerta continua lá
          // depois de a coisa já ter sido resolvida.
          onAvisosMudaram={()=>router.refresh()}
        />
      ) : view === "recepcao" ? (
        <div className="clinicalMain receptionMain">
          <section className="clinicalWelcome">
            <div>
              <h1>Recepção</h1>
              <p>Cadastro de pacientes e agenda — sem acesso a dados clínicos ou financeiros.</p>
            </div>
            <button className="primaryClinical compact" onClick={()=>setOpen(true)}>+ Novo paciente</button>
          </section>
          {error&&<p className="clinicalError">{error}</p>}
          <section className="metricGrid receptionMetrics"><Metric value={scheduledToday.length} label="Consultas hoje" tone="blue"/><Metric value={agendamentos.filter(a=>a.data>=today&&!["cancelado","reagendado"].includes(a.status)).length} label="Consultas agendadas" tone="blue"/><Metric value={completedThisMonth.length} label="Concluídas no mês" tone="green"/><Metric value={scheduledToday.filter(a=>a.status==="agendado").length} label="Aguardando confirmação" tone="amber"/><Metric value={agendamentos.filter(a=>a.data.slice(0,7)===today.slice(0,7)&&["faltou","cancelado"].includes(a.status)).length} label="Faltas/canceladas" tone="red"/></section>
          {/* Coluna de tarefas, como no Médico, no Financeiro e no Admin. A
              Recepção era a única área sem ela: abria com três botões soltos
              acima dos números e empilhava tudo o que existe numa página só. */}
          <div className="financeLayout">
            <nav className="financeTarefas" aria-label="Seções da Recepção">
              {([
                ["grupo","Atendimento"],
                ["hoje","Consultas de hoje",queue.length],
                ["grupo","Cadastro"],
                ["buscar","Pesquisar paciente"],
              ] as [string,string,number?][]).map(([id,rotulo,contador],i)=>
                id==="grupo"
                  ? <span className="financeTarefaGrupo" key={`g${i}`}>{rotulo}</span>
                  : <button
                      type="button" key={id}
                      className={secaoRecepcao===id?"active":""}
                      aria-current={secaoRecepcao===id?"true":undefined}
                      onClick={()=>{
                        setSecaoRecepcao(id as "hoje"|"buscar");
                        if(id==="buscar") requestAnimationFrame(()=>searchRef.current?.focus());
                      }}
                    >
                      <span>{rotulo}</span>
                      {contador?<b className="financeTarefaContador">{contador}</b>:null}
                    </button>,
              )}
            </nav>

            <div className="financeConteudo">
          {secaoRecepcao==="buscar"&&<>
          <section className="clinicalPanel searchPanel"><strong>Pesquisar paciente</strong><input ref={searchRef} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Nome, parte do nome, CPF ou telefone..." /><span>O CPF também é verificado ao salvar para evitar duplicidade.</span></section>
          {search&&<section className="clinicalPanel patientSearchResults">{filtered.slice(0,10).map(p=><div className="financeSetupRow" key={p.id}><span><strong>{p.nome}</strong><small>{p.cpf||"CPF não informado"} · {p.telefone||"telefone não informado"}</small></span></div>)}</section>}
          {!search&&<div className="emptyClinical">Digite acima para encontrar um paciente pelo nome, CPF ou telefone.</div>}
          </>}
          {secaoRecepcao==="hoje"&&
          <section className="clinicalPanel"><div className="panelTitle"><strong>Consultas de hoje</strong></div>{queue.map((appointment,index)=>{const p=patientMap.get(appointment.patient_id);if(!p)return null;const agendaStatus=attendanceOverrides[appointment.id]??appointment.status;const updating=attendanceBusy===appointment.id;return <div className="queueRow" key={appointment.id}><time>{appointment.horario?.slice(0,5)||`${8+index}:00`.padStart(5,"0")}</time><div className="queueInfo"><strong>{p.nome}</strong><small>{appointment.hospital||p.hospital||"Hospital não informado"} · {appointment.convenio||p.convenio||"Particular"}</small></div><span className={`statusChip ${agendaStatus==="presente"?"present":agendaStatus==="faltou"?"danger":"waiting"}`}>{updating?"SALVANDO...":agendaStatus==="presente"?"PACIENTE PRESENTE":agendaStatus==="faltou"?"FALTOU":agendaStatus==="confirmado"?"CONFIRMADO":"AVALIAÇÃO AGENDADA"}</span><button aria-busy={updating} disabled={updating||agendaStatus==="presente"} className="outlineClinical" onClick={()=>updateAttendance(appointment.id,"presente")}>✓ Presente</button><button aria-busy={updating} disabled={updating||agendaStatus==="faltou"} className="outlineClinical red" onClick={()=>updateAttendance(appointment.id,"faltou")}>Faltou</button></div>})}{queue.length===0&&<div className="emptyClinical compactEmpty">Nenhuma consulta agendada para hoje.</div>}</section>}
            </div>
          </div>
        </div>
      ) : view==="financeiro" ? <FinanceView perfil={perfil} pacientes={pacientes} avaliacoes={avaliacoes} financeiro={financeiro} pagamentos={pagamentos} periodos={periodos} convenioValores={convenioValores} plantoesDaReceita={plantoesDaReceita} producaoDaReceita={producaoDaReceita} perfis={perfis} locais={locais} ehGrupo={organizacao?.tipo==="grupo"} onRefresh={()=>router.refresh()}/>
      : <AdminView perfil={perfil} organizacao={organizacao} perfis={perfis} auditoria={auditoria} onRefresh={()=>router.refresh()} abrirEm={aberturaDoAdmin}/>}

      {contaAberta&&<div className="patientModalBackdrop" role="presentation">
        <section className="contaModal" role="dialog" aria-modal="true" aria-labelledby="conta-titulo">
          <div className="patientModalHead">
            <div><strong id="conta-titulo">Minha conta</strong><span>Seus dados de acesso ao AVANEST.</span></div>
            <button type="button" onClick={()=>setContaAberta(false)} aria-label="Fechar">×</button>
          </div>
          <dl className="contaDados">
            <div><dt>Nome</dt><dd>{perfil.nome}</dd></div>
            <div><dt>E-mail de acesso</dt><dd>{email||"—"}</dd></div>
            <div><dt>Perfil</dt><dd>{ROLE_LABELS[perfil.role]??perfil.role}</dd></div>
          </dl>
          <p className="contaNota">
            Nome e perfil são alterados pelo administrador da organização, em Admin → Usuários e permissões.
          </p>
          <form className="contaSenha" onSubmit={async event=>{
            event.preventDefault();
            setSenhaMsg("");
            if(senha.nova.length<8){setSenhaMsg("A nova senha precisa ter pelo menos 8 caracteres.");return}
            if(senha.nova!==senha.confirma){setSenhaMsg("A confirmação não confere com a nova senha.");return}
            if(senha.nova===senha.atual){setSenhaMsg("A nova senha precisa ser diferente da atual.");return}
            setSenhaBusy(true);
            const cliente=createClient();
            // Confere a senha atual antes de trocar. Sem isso, quem sentasse
            // numa tela destravada assumiria a conta alheia em dois cliques —
            // e o dono perderia o acesso sem nunca saber por quê.
            const {error:erroAtual}=await cliente.auth.signInWithPassword({email,password:senha.atual});
            if(erroAtual){setSenhaBusy(false);setSenhaMsg("A senha atual não confere.");return}
            // A senha atual vai junto da nova, e não só na conferência acima: o
            // Supabase deste projeto exige as duas na mesma chamada, e sem ela
            // recusava a troca com uma mensagem em inglês.
            const {error}=await cliente.auth.updateUser({current_password:senha.atual,password:senha.nova});
            setSenhaBusy(false);
            if(error){
              // A recusa mais comum é senha atual errada — que a conferência
              // acima já pega, mas o servidor confere de novo por conta dele.
              const recusouSenha=/current password|invalid|credential/i.test(error.message);
              setSenhaMsg(recusouSenha
                ?"A senha atual não confere."
                :`Não foi possível alterar: ${error.message}`);
              return;
            }
            setSenha({atual:"",nova:"",confirma:""});
            setSenhaMsg("Senha alterada. Use a nova no próximo acesso.");
          }}>
            <h3>Alterar senha</h3>
            <label className="clinicalField"><span>Senha atual</span>
              <input type="password" autoComplete="current-password" value={senha.atual} onChange={e=>setSenha(s=>({...s,atual:e.target.value}))} required/></label>
            <label className="clinicalField"><span>Nova senha</span>
              <input type="password" autoComplete="new-password" value={senha.nova} onChange={e=>setSenha(s=>({...s,nova:e.target.value}))} required minLength={8} placeholder="Mínimo de 8 caracteres"/></label>
            <label className="clinicalField"><span>Repita a nova senha</span>
              <input type="password" autoComplete="new-password" value={senha.confirma} onChange={e=>setSenha(s=>({...s,confirma:e.target.value}))} required/></label>
            {senhaMsg&&<p className={senhaMsg.startsWith("Senha alterada")?"financeSuccess":"clinicalError"} role="status">{senhaMsg}</p>}
            <div className="patientModalActions">
              <button type="button" className="outlineClinical" onClick={()=>setContaAberta(false)}>Fechar</button>
              <button type="submit" className="primaryClinical compact" disabled={senhaBusy||!email}>{senhaBusy?"Alterando...":"Alterar senha"}</button>
            </div>
          </form>
        </section>
      </div>}

      {open && <PatientModal busy={busy} error={error} convenios={listarConvenios(convenioValores,pacientes)} onClose={() => {
        setOpen(false);
        if(initialNewPatient) router.replace(`/dashboard?area=${view}`);
      }} onSubmit={createPatient} />}

      {/* Vale para todas as áreas: a recepção avisa que a paciente chegou e o
          anestesista lê sem trocar de tela. Fica por último no HTML porque é
          um apoio — quem navega pelo teclado passa por ele depois do trabalho,
          e não antes. */}
      {/* O tutorial só aparece no primeiro acesso deste aparelho, e cada etapa
          leva o painel para a área de que ela fala: ler "em Médico você faz a
          avaliação" olhando para o Financeiro não ensina nada. */}
      <TutorialInicial
        papel={{ role: perfil.role, nome: perfil.nome, areas: allowedViews }}
        onIrPara={(area) => changeView(area as DashboardView)}
      />
      <ChatFlutuante perfil={perfil} abrirEm={pedidoDeChat} />
    </main>
  );
}

function FinanceView({perfil,pacientes,avaliacoes,financeiro,pagamentos,periodos,convenioValores,plantoesDaReceita=[],producaoDaReceita=[],perfis=[],locais=[],ehGrupo=false,onRefresh}:{perfil:Perfil;pacientes:Paciente[];avaliacoes:Avaliacao[];financeiro:Financeiro[];pagamentos:Pagamento[];periodos:Periodo[];convenioValores:ConvenioValor[];plantoesDaReceita?:PlantaoBruto[];producaoDaReceita?:ProducaoBruta[];perfis?:PerfilGerenciado[];locais?:LocalDisponivel[];ehGrupo?:boolean;onRefresh:()=>void}) {
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [configOpen,setConfigOpen]=useState(false);
  const {oculto,alternar,mascara}=useValoresOcultos();
  const [priceValues,setPriceValues]=useState<Record<string,string>>({});
  const [values,setValues]=useState<Record<string,string>>({});
  const [methods,setMethods]=useState<Record<string,string>>({});
  const [filtroReceb,setFiltroReceb]=useState<"todos"|"aberto"|"quitado">("todos");
  const [novoConvenio,setNovoConvenio]=useState("");
  const currentMonth=new Date().toISOString().slice(0,7);
  const [period,setPeriod]=useState(currentMonth);
  // Qual tarefa está aberta na coluna da esquerda. Uma de cada vez: a tela
  // antiga empilhava tudo e obrigava a rolar para achar o que fazer.
  const [tarefa,setTarefa]=useState("lancamentos");
  const patientMap=new Map(pacientes.map(p=>[p.id,p]));
  const evaluationMap=new Map<string,Avaliacao>();
  for(const item of avaliacoes)if(!evaluationMap.has(item.patient_id)||item.status==="concluida")evaluationMap.set(item.patient_id,item);
  const billedPatients=new Set(financeiro.map(item=>item.patient_id));
  // Só chegam ao financeiro atendimentos efetivamente agendados e vinculados a um hospital.
  // Cadastros incompletos da recepção não devem virar cobrança.
  const pendingPatients=pacientes.filter(p=>!billedPatients.has(p.id)&&evaluationMap.get(p.id)?.status==="concluida");
  const money=(value:number)=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const parseMoney=(value:string)=>{
    const normalized=value.trim().replace(/\s/g,"").replace(/^R\$/i,"");
    const decimal=normalized.includes(",")?normalized.replace(/\./g,"").replace(",","."):normalized;
    return Number(decimal);
  };
  const periodItems=financeiro.filter(item=>(item.periodo||item.created_at.slice(0,7))===period);
  const total=periodItems.reduce((sum,item)=>sum+Number(item.valor),0);
  const received=periodItems.reduce((sum,item)=>sum+Number(item.recebido),0);
  const pending=Math.max(0,total-received);
  const glosas=periodItems.filter(item=>item.status==="glosa");

  // Os indicadores que decidem o mês. Quase todos olham o HISTÓRICO INTEIRO, e
  // não a competência: em faturamento por convênio o dinheiro do mês passado
  // ainda está na rua, e uma tela que só olha o mês corrente faz uma operação
  // saudável e uma quebrada parecerem iguais.
  const hojeIso=new Date().toISOString().slice(0,10);
  const glosaDoMes=glosa(periodItems);
  const anterior=mesAnterior(period);

  // As TRÊS fontes de receita do serviço, num formato só.
  //
  // A consulta pré-anestésica cobrada por convênio era a única que chegava aos
  // números. O plantão e a produção do dia existiam no sistema — cada um com
  // dono, data e valor — e não entravam em conta nenhuma: a produção era lista
  // de leitura, o plantão vivia só na Escala. Para a maioria dos grupos de
  // anestesia o plantão é a MAIOR fatia, então o painel vinha mostrando a menor
  // e chamando de faturamento.
  const nomeDoLocalPorId=new Map(locais.map(l=>[l.id,nomeDoLocal(l)]));
  const receitas=useMemo(()=>{
    const lista:Receita[]=[];
    for(const item of financeiro){
      const r=deConsulta(item,patientMap.get(item.patient_id)?.nome);
      if(r) lista.push(r);
    }
    for(const item of producaoDaReceita){ const r=deProducao(item); if(r) lista.push(r); }
    for(const item of plantoesDaReceita){
      const r=dePlantao({...item,local_nome:item.local_id?nomeDoLocalPorId.get(item.local_id)??null:null});
      if(r) lista.push(r);
    }
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[financeiro,producaoDaReceita,plantoesDaReceita,locais,pacientes]);

  const receitasDoMes=doMes(receitas,period);
  const receitaTotal=somar(receitasDoMes);
  const receitaAnterior=somar(doMes(receitas,anterior));
  const origens=porOrigem(receitasDoMes);
  const nomesDosPerfis=new Map(perfis.map(p=>[p.id,p.nome]));
  const fatias=porProfissional(receitasDoMes,nomesDosPerfis);

  const totalAnterior=receitaAnterior.valor;
  const recebidoAnterior=receitaAnterior.recebido;

  // Os indicadores de recebível passam a ler as TRÊS fontes, e não só a
  // consulta. `paraRecebivel` traduz a receita para o formato que eles já
  // sabiam ler — duplicar as funções para um segundo tipo é onde nasce a
  // divergência silenciosa entre duas contas que deveriam ser a mesma.
  const recebiveis=useMemo(()=>receitas.map(paraRecebivel),[receitas]);
  const aReceber=saldoAReceber(recebiveis);
  const vencido=saldoVencido(recebiveis,hojeIso);
  const linhasIdade=envelhecimento(recebiveis,hojeIso);
  const totaisIdade=totaisDoEnvelhecimento(linhasIdade);
  // O prazo médio segue lendo só as consultas: ele conta da EMISSÃO da nota até
  // o pagamento, e plantão e produção não passam por emissão dentro do sistema.
  // Misturá-los devolveria "0 dias" para o hospital que paga em sessenta.
  const prazos=prazoMedioPorConvenio(financeiro,pagamentos);
  const groups=Object.entries(periodItems.reduce<Record<string,Financeiro[]>>((acc,item)=>{(acc[item.convenio||"Particular"]??=[]).push(item);return acc},{}));
  const lots=Object.entries(periodItems.filter(item=>item.lote).reduce<Record<string,Financeiro[]>>((acc,item)=>{(acc[item.lote as string]??=[]).push(item);return acc},{}));
  const periodState=periodos.find(item=>item.periodo===period);
  const byPlan=groups.map(([convenio,items])=>{
    const billed=items.reduce((sum,item)=>sum+Number(item.valor),0);
    const paid=items.reduce((sum,item)=>sum+Number(item.recebido),0);
    const defaultRule=convenioValores.find(rule=>rule.ativo&&rule.convenio===convenio&&!rule.procedimento&&!rule.hospital);
    return {convenio,consultas:items.length,unit:Number(defaultRule?.valor||0),valor:billed,recebido:paid,pendente:Math.max(0,billed-paid)};
  }).sort((a,b)=>b.valor-a.valor);
  const knownConvenios=listarConvenios(convenioValores,pacientes);
  const todayIso=new Date().toISOString().slice(0,10);
  const noteAlerts=financeiro.filter(item=>{
    if(!item.nota_fiscal||Number(item.recebido)>=Number(item.valor)||item.status==="cancelado") return false;
    const due=item.nota_vencimento_at || (item.nota_emitida_at ? new Date(new Date(`${item.nota_emitida_at}T12:00:00`).getTime()+15*86400000).toISOString().slice(0,10) : null);
    return Boolean(due&&due<=todayIso);
  });

  async function createBilling(patient:Paciente) {
    setBusy(patient.id); setMessage("");
    const evaluation=evaluationMap.get(patient.id);
    const price=convenioValores.find(rule=>rule.ativo&&rule.convenio=== (patient.convenio||"Particular") && (!rule.procedimento||rule.procedimento===patient.procedimento||rule.procedimento===patient.cirurgia) && (!rule.hospital||rule.hospital===patient.hospital));
    const {error}=await createClient().from("financeiro_atendimentos").insert({
      institution_id:perfil.institution_id,patient_id:patient.id,avaliacao_id:evaluation?.id??null,
      convenio:patient.convenio||"Particular",hospital:patient.hospital||null,valor:Number(price?.valor||0),repasse_valor:price?.repasse_percentual?Number(price.valor)*Number(price.repasse_percentual)/100:0,status:"aguardando",
      periodo:patient.data_consulta?.slice(0,7)||currentMonth,
    });
    setBusy(""); if(error)setMessage(`Não foi possível criar o lançamento: ${error.message}`);else{setMessage("Lançamento criado. Informe o valor e os dados de cobrança.");onRefresh()}
  }
  function openPriceConfig(){
    const initial:Record<string,string>={};
    for(const convenio of knownConvenios){
      const rule=convenioValores.find(item=>item.ativo&&item.convenio===convenio&&!item.procedimento&&!item.hospital);
      initial[convenio]=rule?String(Number(rule.valor)):"0";
    }
    setPriceValues(initial);setConfigOpen(true);setMessage("");
  }
  async function addConvenio(){
    const nome=novoConvenio.trim();
    if(!nome){setMessage("Informe o nome do convênio antes de adicionar.");return}
    if(knownConvenios.some(c=>c.localeCompare(nome,"pt-BR",{sensitivity:"base"})===0)){
      setMessage(`${nome} já está na lista.`);return;
    }
    setBusy("novoConvenio");setMessage("");
    // Pode existir uma regra desativada com esse nome (foi removido antes):
    // nesse caso religa, em vez de criar uma segunda linha para o mesmo nome.
    const antiga=convenioValores.find(r=>!r.procedimento&&!r.hospital&&r.convenio.localeCompare(nome,"pt-BR",{sensitivity:"base"})===0);
    const client=createClient();
    const agora=new Date().toISOString();
    const resultado=antiga
      ? await client.from("convenio_valores").update({ativo:true,updated_at:agora}).eq("id",antiga.id)
      : await client.from("convenio_valores").insert({institution_id:perfil.institution_id,convenio:nome,procedimento:null,hospital:null,valor:0,repasse_percentual:0,ativo:true,updated_at:agora});
    setBusy("");
    if(resultado.error)setMessage(`Não foi possível adicionar ${nome}: ${resultado.error.message}`);
    else{setNovoConvenio("");setPriceValues(v=>({...v,[nome]:"0"}));setMessage(`${nome} adicionado. Informe o valor e salve.`);onRefresh()}
  }
  async function removeConvenio(nome:string){
    const emUso=pacientes.filter(p=>p.convenio===nome).length;
    if(emUso){setMessage(`Não foi possível remover ${nome}: ${emUso} paciente(s) cadastrado(s) com esse convênio.`);return}
    setBusy(`remover-${nome}`);setMessage("");
    const regra=convenioValores.find(r=>r.convenio===nome&&!r.procedimento&&!r.hospital);
    const client=createClient();
    const agora=new Date().toISOString();
    const resultado=regra
      ? await client.from("convenio_valores").update({ativo:false,updated_at:agora}).eq("id",regra.id)
      : await client.from("convenio_valores").insert({institution_id:perfil.institution_id,convenio:nome,procedimento:null,hospital:null,valor:0,repasse_percentual:0,ativo:false,updated_at:agora});
    setBusy("");
    if(resultado.error)setMessage(`Não foi possível remover ${nome}: ${resultado.error.message}`);
    else{setMessage(`${nome} saiu da lista. Para trazer de volta, basta adicionar de novo.`);onRefresh()}
  }
  async function savePrices(){
    setBusy("prices");setMessage("");
    const client=createClient();
    for(const convenio of knownConvenios){
      const amount=parseMoney(priceValues[convenio]||"0");
      if(!Number.isFinite(amount)||amount<0){setBusy("");setMessage(`Informe um valor válido para ${convenio}.`);return}
      const rule=convenioValores.find(item=>item.convenio===convenio&&!item.procedimento&&!item.hospital);
      const payload={institution_id:perfil.institution_id,convenio,procedimento:null,hospital:null,valor:amount,repasse_percentual:Number(rule?.repasse_percentual||0),ativo:true,updated_at:new Date().toISOString()};
      const result=rule
        ? await client.from("convenio_valores").update(payload).eq("id",rule.id)
        : await client.from("convenio_valores").insert(payload);
      if(result.error){setBusy("");setMessage(`Não foi possível salvar ${convenio}: ${result.error.message}`);return}
    }
    setBusy("");setConfigOpen(false);setMessage("Valores das consultas salvos.");onRefresh();
  }
  async function updateItem(id:string,changes:Record<string,string|number|null>) {
    const item=financeiro.find(entry=>entry.id===id);
    if(item?.fechado_at){setMessage("Este período está fechado e não pode mais ser alterado.");return}
    setBusy(id); setMessage(""); const {error}=await createClient().from("financeiro_atendimentos").update({...changes,updated_at:new Date().toISOString()}).eq("id",id);
    setBusy(""); if(error)setMessage(`Não foi possível atualizar: ${error.message}`);else onRefresh();
  }
  async function registerPayment(item:Financeiro) {
    const amount=parseMoney(values[item.id]||"");
    const balance=Math.max(0,Number(item.valor)-Number(item.recebido));
    if(!Number.isFinite(amount)||amount<=0){setMessage("Informe um valor de pagamento válido.");return}
    if(amount>balance){setMessage(`O pagamento não pode ultrapassar o saldo de ${money(balance)}.`);return}
    setBusy(item.id); const client=createClient();
    const {error}=await client.rpc("registrar_pagamento_financeiro",{
      p_atendimento_id:item.id,p_valor:amount,p_metodo:methods[item.id]||"PIX",p_referencia:null,
    });
    setBusy(""); if(error)setMessage(`Não foi possível registrar: ${error.message}`);else{setValues(v=>({...v,[item.id]:""}));setMessage("Pagamento registrado.");onRefresh()}
  }
  async function confirmPeriod(){
    if(periodItems.some(item=>!item.nota_fiscal&&item.status!=="cancelado")){
      setMessage("Ainda há atendimentos sem nota fiscal. Complete ou cancele antes de conferir.");
      return;
    }
    setBusy("period");setMessage("");
    const {error}=await createClient().rpc("conferir_periodo_financeiro",{p_periodo:period});
    setBusy("");
    if(error)setMessage(`Não foi possível conferir o período: ${error.message}`);
    else{setMessage("Período conferido e registrado na auditoria.");onRefresh()}
  }
  async function reprogramNote(item:Financeiro){
    const base=item.nota_vencimento_at||todayIso;
    const due=new Date(`${base}T12:00:00`);due.setDate(due.getDate()+15);
    await updateItem(item.id,{nota_vencimento_at:due.toISOString().slice(0,10),nota_reprogramada_at:todayIso});
    setMessage(`Nota ${item.nota_fiscal||"sem número"} reprogramada para ${due.toLocaleDateString("pt-BR")}.`);
  }
  function exportCsv(){
    // Ponto e vírgula e vírgula decimal: é o que o Excel em português abre
    // direto, sem assistente de importação. O BOM diz que é UTF-8.
    const num=(v:number)=>String(Number(v||0).toFixed(2)).replace(".",",");
    const linhas:string[][]=[["Paciente","Convênio","Hospital","Competência","Valor","Recebido","Saldo","Status","Nota fiscal","Emissão","Vencimento","Lote"]];
    for(const item of periodItems){
      const p=patientMap.get(item.patient_id);
      linhas.push([p?.nome||"Paciente",item.convenio||"",item.hospital||p?.hospital||"",period,
        num(Number(item.valor)),num(Number(item.recebido)),num(Math.max(0,Number(item.valor)-Number(item.recebido))),
        item.status,item.nota_fiscal||"",item.nota_emitida_at||"",item.nota_vencimento_at||"",item.lote||""]);
    }
    linhas.push(["TOTAL","","",period,num(total),num(received),num(pending),"","","","",""]);
    const csv="﻿"+linhas.map(l=>l.map(c=>`"${c.replaceAll('"','""')}"`).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=`avanest-financeiro-${period}.csv`;a.click();
    URL.revokeObjectURL(url);
  }

  return <div className="clinicalMain financeMain">
    <section className="financeHeading"><div><h1>Financeiro</h1><p>Consultas organizadas por convênio — sem acesso ao conteúdo clínico das avaliações.</p></div><div className="financeHeadingActions"><label><span>Competência</span><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label><button className="outlineClinical" disabled={!periodItems.length} title={periodItems.length?undefined:"Sem lançamentos na competência selecionada"} onClick={exportCsv}><Icone nome="imprimir" tamanho={15}/> Exportar CSV</button>{(perfil.role==="admin"||perfil.role==="owner")&&<button className="outlineClinical" onClick={openPriceConfig}>Configurar valores das consultas</button>}</div></section>
    {message&&<p className={message.includes("não foi")?"clinicalError":"financeSuccess"}>{message}</p>}
    {/* A barra responde à pergunta certa.
        Antes ela dizia quanto foi faturado e recebido NO MÊS. Em faturamento
        por convênio essa não é a pergunta: a nota saiu há dez dias e o convênio
        paga em quarenta, então o mês corrente quase não tem recebimento e o
        dinheiro que importa é o dos meses anteriores, ainda na rua.
        Saem "Atendimentos no mês" (vira ticket médio, no fechamento) e "Notas
        pendentes" (já tem contador no menu). Entram o saldo, o atraso e a
        variação — número sem base de comparação não diz se foi bom ou ruim. */}
    <section className="metricGrid financeMetrics">
      <MoneyMetric value={aReceber} label="A receber" tone="blue" mascara={mascara}/>
      <MoneyMetric value={vencido} label="Vencido" tone={vencido>0?"red":"green"} mascara={mascara}/>
      {/* Faturado e recebido somam as TRÊS fontes — consulta, produção e
          plantão. `total` e `received` continuam existindo com o recorte antigo
          (só consultas) porque o fechamento do mês e o CSV falam do ciclo de
          cobrança por convênio, que é outra coisa. */}
      <MoneyMetric value={receitaTotal.valor} label="Faturado no mês" tone="blue" mascara={mascara}
        extra={<Variacao atual={receitaTotal.valor} anterior={totalAnterior} oculto={oculto}/>}/>
      <MoneyMetric value={receitaTotal.recebido} label="Recebido no mês" tone="green" mascara={mascara}
        extra={<Variacao atual={receitaTotal.recebido} anterior={recebidoAnterior} oculto={oculto}/>}/>
      <MoneyMetric value={glosaDoMes.valor} label={glosaDoMes.percentual===null
        ? "Glosa no mês"
        : `Glosa no mês — ${glosaDoMes.percentual.toFixed(1).replace(".",",")}% do faturado`}
        tone={glosaDoMes.valor>0?"red":"green"} mascara={mascara}
        extra={<OlhoValores oculto={oculto} onAlternar={alternar}/>}/>
    </section>

    <div className="financeLayout">
      {/* Coluna de tarefas. Os contadores são só do que pede ação — número em
          tarefa parada vira ruído e a pessoa para de olhar para todos. */}
      <nav className="financeTarefas" aria-label="Seções do Financeiro">
        {([
          ["grupo","Operação"],
          ["lancamentos","Lançamentos",pendingPatients.length],
          ["recebimentos","Recebimentos",financeiro.filter(i=>Number(i.valor)-Number(i.recebido)>0).length],
          ["notas","Notas fiscais",noteAlerts.length],
          ["lotes","Lotes de cobrança"],
          ["producao","Produção da equipe"],
          ["repasses","Repasses"],
          ["grupo","Análise"],
          ["origem","De onde vem o dinheiro"],
          // O contador é o que está vencido, e não o total a receber: a coluna
          // conta o que pede ação hoje.
          ["idade","A receber por idade",linhasIdade.filter(l=>l.faixas.acima90>0).length],
          ["graficos","Gráficos"],
          ["faturamento","Faturado por convênio"],
          ["fechamento","Fechamento do mês"],
          ["extrato","Extrato de pagamentos"],
          ["grupo","Configuração"],
          ["valores","Valores por convênio"],
        ] as [string,string,number?][]).map(([id,rotulo,contador],i)=>
          id==="grupo"
            ? <span className="financeTarefaGrupo" key={`g${i}`}>{rotulo}</span>
            : <button
                type="button" key={id}
                className={tarefa===id?"active":""}
                aria-current={tarefa===id?"true":undefined}
                onClick={()=>setTarefa(id)}
              >
                <span>{rotulo}</span>
                {contador?<b className="financeTarefaContador">{contador}</b>:null}
              </button>)}
      </nav>

      <div className="financeConteudo">
      {tarefa==="lancamentos"&&<>
    {pendingPatients.length>0&&<PainelRecolhivel chave="fin-aguardando" titulo="Atendimentos aguardando lançamento" legenda="vindos automaticamente da recepção e agenda">{pendingPatients.slice(0,8).map(patient=><div className="financeSetupRow" key={patient.id}><span><strong>{patient.nome}</strong><small>{patient.hospital||"Hospital não informado"} · {patient.convenio||"Particular"} · {patient.data_consulta?brDate(patient.data_consulta):"sem data"}</small></span><button className="outlineClinical" disabled={busy===patient.id} onClick={()=>createBilling(patient)}>Criar lançamento</button></div>)}</PainelRecolhivel>}
    {groups.length===0?<div className="emptyClinical">Nenhum lançamento financeiro cadastrado.</div>:groups.map(([convenio,items])=><PainelRecolhivel className="financeGroup" key={convenio} chave={`fin-grupo-${convenio}`} classeCabecalho="financeGroupHead" titulo={convenio} legenda={`${items.length} atendimento(s)`} extra={<b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b>}>{items.map(item=>{const patient=patientMap.get(item.patient_id);return <div className="financeItemRow" key={item.id}><div><strong>{patient?.nome||"Paciente"}</strong><small>{item.hospital||patient?.hospital||"Hospital não informado"} · Consulta {patient?.data_consulta?brDate(patient.data_consulta):"sem data"}</small></div>{/* parseMoney, não Number(replace): "1.234,56" com replace simples vira
    "1.234.56", que é NaN — e o valor da consulta zerava sem aviso. */}
<div className="financeItemFields"><label className="inlineMoney"><span>Valor</span><input defaultValue={Number(item.valor)||""} placeholder="R$ 0,00" onBlur={e=>{const v=parseMoney(e.target.value);updateItem(item.id,{valor:Number.isFinite(v)&&v>=0?v:0})}}/></label><label className="inlineMoney"><span>Situação</span><select value={item.status} onChange={e=>updateItem(item.id,{status:e.target.value})}><option value="aguardando">Aguardando</option><option value="pago">Pago</option><option value="glosa">Glosa</option><option value="cancelado">Cancelado</option></select>{item.status==="glosa"&&<input className="financeGlosado" defaultValue={Number(item.glosa_valor)||""} placeholder="Glosado: R$ 0,00" aria-label="Valor glosado pelo convênio" onBlur={e=>{const v=parseMoney(e.target.value);updateItem(item.id,{glosa_valor:Number.isFinite(v)&&v>=0?v:0})}}/>}</label><label className="inlineMoney"><span>Nota fiscal</span><input className="financeSmallInput" defaultValue={item.nota_fiscal??""} placeholder="Número" onBlur={e=>updateItem(item.id,{nota_fiscal:e.target.value||null})}/></label><label className="inlineMoney"><span>Emissão</span><input className="financeSmallInput" type="date" defaultValue={item.nota_emitida_at??""} onBlur={e=>updateItem(item.id,{nota_emitida_at:e.target.value||null})}/></label><label className="inlineMoney"><span>Vencimento</span><input className="financeSmallInput" type="date" defaultValue={item.nota_vencimento_at??""} onBlur={e=>updateItem(item.id,{nota_vencimento_at:e.target.value||null})}/></label><label className="inlineMoney"><span>Lote</span><input className="financeSmallInput" defaultValue={item.lote??""} placeholder="—" onBlur={e=>updateItem(item.id,{lote:e.target.value||null})}/></label></div></div>})}</PainelRecolhivel>)}
      </>}
      {tarefa==="recebimentos"&&<>
    <PainelRecolhivel chave="fin-recebimentos" titulo="Recebimentos" legenda="PIX, dinheiro, cartão ou transferência; pagamentos parciais atualizam o saldo">
      <div className="financeChips" role="group" aria-label="Filtrar recebimentos">
        {([["todos","Todos"],["aberto","Em aberto"],["quitado","Quitados"]] as const).map(([valor,rotulo])=>
          <button type="button" key={valor} className={filtroReceb===valor?"active":""} onClick={()=>setFiltroReceb(valor)}>{rotulo}</button>)}
      </div>
      {financeiro
        .filter(item=>{
          const saldo=Math.max(0,Number(item.valor)-Number(item.recebido));
          return filtroReceb==="todos"||(filtroReceb==="aberto"?saldo>0:saldo<=0);
        })
        // Em aberto primeiro: é neles que o financeiro age. Quitado é conferência.
        .sort((a,b)=>{
          const sa=Math.max(0,Number(a.valor)-Number(a.recebido))>0?0:1;
          const sb=Math.max(0,Number(b.valor)-Number(b.recebido))>0?0:1;
          return sa-sb||b.created_at.localeCompare(a.created_at);
        })
        .map(item=>{
        const patient=patientMap.get(item.patient_id);
        const balance=Math.max(0,Number(item.valor)-Number(item.recebido));
        const quitado=balance<=0;
        const parcial=!quitado&&Number(item.recebido)>0;
        const digitado=parseMoney(values[item.id]||"");
        // O botão só habilita quando o valor digitado é aceitável — antes ele
        // ficava aceso e só reclamava depois do clique.
        const valorValido=Number.isFinite(digitado)&&digitado>0&&digitado<=balance;
        return <div className="paymentRow" id={`recebimento-${item.id}`} key={item.id}>
          <span className="paymentQuem">
            <strong>{patient?.nome||"Paciente"}</strong>
            <small>{item.convenio}{item.hospital?` · ${item.hospital}`:""}</small>
          </span>
          <span className="paymentValores">
            <b>{money(item.valor)}</b>
            <small>recebido {money(item.recebido)}</small>
          </span>
          <span className="paymentSaldo">
            <b className={quitado?"green":""}>{quitado?"quitado":money(balance)}</b>
            {!quitado&&<small>em aberto</small>}
          </span>
          <span className={`statusChip ${quitado?"present":parcial?"waiting":"paused"}`}>{quitado?"Quitado":parcial?"Parcial":"A receber"}</span>
          {quitado
            ? <span className="paymentPago">Nada a registrar</span>
            : <>
                <input
                  value={values[item.id]||""} onChange={e=>setValues(v=>({...v,[item.id]:e.target.value}))}
                  placeholder="Valor R$" inputMode="decimal"
                  aria-label={`Valor a registrar para ${patient?.nome||"paciente"}`}
                />
                <select value={methods[item.id]||"PIX"} onChange={e=>setMethods(v=>({...v,[item.id]:e.target.value}))} aria-label="Forma de pagamento">
                  <option>PIX</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option>
                </select>
                <button className="paymentButton" disabled={busy===item.id||!valorValido} onClick={()=>registerPayment(item)}>
                  {busy===item.id?"Registrando...":"Registrar"}
                </button>
              </>}
        </div>;
      })}
      {financeiro.length===0&&<div className="emptyClinical">
        <strong>Nenhum lançamento neste período.</strong>
        Os lançamentos nascem das avaliações concluídas e faturadas. Fature um atendimento para que ele apareça aqui.
      </div>}
    </PainelRecolhivel>
      </>}
      {tarefa==="notas"&&<>
    <PainelRecolhivel chave="fin-notas" className="noteAlerts" titulo="Notas fiscais para acompanhamento" legenda="Alerta após 15 dias da emissão, até receber baixa financeira." abrePadrao={noteAlerts.length>0}>{noteAlerts.length?noteAlerts.map(item=>{const patient=patientMap.get(item.patient_id);const due=item.nota_vencimento_at||new Date(new Date(`${item.nota_emitida_at}T12:00:00`).getTime()+15*86400000).toISOString().slice(0,10);return <div className="noteAlertRow" key={item.id}><span><strong>NF {item.nota_fiscal}</strong><small>{item.convenio} · {patient?.nome||"Paciente"} · verificar pagamento desde {brDate(due)}</small></span><button className="paymentButton" disabled={busy===item.id} onClick={()=>{setTarefa("recebimentos");setMessage("Informe o valor recebido abaixo para confirmar a baixa da nota.");/* o alvo da rolagem vive na seção de Recebimentos: sem trocar de seção antes, getElementById não acha nada e o botão não faz coisa alguma */ requestAnimationFrame(()=>document.getElementById(`recebimento-${item.id}`)?.scrollIntoView({behavior:"smooth",block:"center"}))}}>Dar baixa</button><button className="outlineClinical" disabled={busy===item.id} onClick={()=>reprogramNote(item)}>+15 dias</button></div>}):<div className="emptyClinical compactEmpty">Nenhuma nota vencida para acompanhamento.</div>}</PainelRecolhivel>
      </>}
      {tarefa==="producao"&&<ProducaoRecebida mes={period} nomeMes={NOMES_MES[Number(period.slice(5,7))-1]??""} ano={Number(period.slice(0,4))}/>}

      {tarefa==="lotes"&&<>
    <PainelRecolhivel chave="fin-lotes" titulo="📦 Lotes de cobrança" legenda="agrupamento por convênio/hospital, sem dados clínicos" abrePadrao={false}>{lots.length?lots.map(([lot,items])=><div className="financeLotRow" key={lot}><strong>{lot}</strong><span>{items[0]?.convenio} · {items.length} atendimento(s)</span><b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b><span className={`statusChip ${items.every(i=>i.status==="pago")?"present":"waiting"}`}>{items.every(i=>i.status==="pago")?"PAGO":"EM ABERTO"}</span></div>):<div className="emptyClinical compactEmpty">Informe o número do lote nos atendimentos para agrupá-los aqui.</div>}</PainelRecolhivel>
      </>}
      {tarefa==="repasses"&&<>
    <PainelRecolhivel chave="fin-repasses" titulo="🩺 Repasses aos anestesiologistas" legenda="liberação após recebimento; valores visíveis conforme as permissões do perfil" abrePadrao={false}>{financeiro.filter(i=>Number(i.repasse_valor)>0).map(item=><div className="repasseRow" key={item.id}><span><strong>Profissional vinculado ao atendimento</strong><small>{item.convenio} · {patientMap.get(item.patient_id)?.nome}</small></span><b>{money(item.repasse_valor)}</b><select value={item.repasse_status} onChange={e=>updateItem(item.id,{repasse_status:e.target.value})}><option value="pendente">Repasse pendente</option><option value="aguardando_recebimento">Aguardando recebimento</option><option value="pago">Pago</option></select></div>)}{!financeiro.some(i=>Number(i.repasse_valor)>0)&&<div className="emptyClinical compactEmpty">Nenhum repasse configurado.</div>}</PainelRecolhivel>
      </>}
      {tarefa==="origem"&&<>
    {/* As três fontes de receita do serviço, lado a lado.
        Sempre as três, mesmo zeradas: origem que some da tabela vira pergunta
        ("cadê os plantões?") em vez de resposta ("os plantões deram zero"). */}
    <PainelRecolhivel chave="fin-origem" titulo="De onde vem o dinheiro"
      legenda={`receita de ${NOMES_MES[Number(period.slice(5,7))-1]??""} por fonte`} abrePadrao
      extra={<b>{mascara(money(receitaTotal.valor))}</b>}>
      <div className="financeTabelaRolavel">
        <table className="financeTabela">
          <thead><tr><th>Fonte</th><th className="num">Lançamentos</th><th className="num">Faturado</th><th className="num">Recebido</th><th className="num">A receber</th></tr></thead>
          <tbody>{origens.map(o=><tr key={o.origem}>
            <td>{o.rotulo}</td>
            <td className="num">{o.linhas}</td>
            <td className="num">{mascara(money(o.valor))}</td>
            <td className="num">{mascara(money(o.recebido))}</td>
            <td className="num">{mascara(money(o.aReceber))}</td>
          </tr>)}</tbody>
          <tfoot><tr>
            <td>Total</td>
            <td className="num">{receitaTotal.linhas}</td>
            <td className="num">{mascara(money(receitaTotal.valor))}</td>
            <td className="num">{mascara(money(receitaTotal.recebido))}</td>
            <td className="num">{mascara(money(receitaTotal.aReceber))}</td>
          </tr></tfoot>
        </table>
      </div>
      <p className="financeNota">Plantão entra quando está <strong>realizado</strong> — escalado ainda não aconteceu e não é receita. Produção entra assim que anotada, mesmo antes de cobrada.</p>
    </PainelRecolhivel>

    {/* Quanto é de cada um. Só faz sentido em grupo: sozinho, a tabela seria
        uma linha repetindo o total que já está no cartão acima. */}
    {ehGrupo&&<PainelRecolhivel chave="fin-profissional" titulo="Quanto é de cada um"
      legenda="cada um leva o que produziu — plantão de quem plantonou, consulta de quem avaliou">
      {fatias.length===0
        ? <div className="emptyClinical compactEmpty">Nenhuma receita neste mês.</div>
        : <div className="financeTabelaRolavel">
            <table className="financeTabela">
              <thead><tr><th>Profissional</th><th className="num">Lançamentos</th><th className="num">Faturado</th><th className="num">Recebido</th><th className="num">A receber</th></tr></thead>
              <tbody>{fatias.map(f=><tr key={f.donoId??"sem"}>
                <td>{f.nome}</td>
                <td className="num">{f.linhas}</td>
                <td className="num">{mascara(money(f.valor))}</td>
                <td className="num">{mascara(money(f.recebido))}</td>
                <td className="num">{mascara(money(f.aReceber))}</td>
              </tr>)}</tbody>
              <tfoot><tr>
                <td>Total</td>
                <td className="num">{receitaTotal.linhas}</td>
                <td className="num">{mascara(money(receitaTotal.valor))}</td>
                <td className="num">{mascara(money(receitaTotal.recebido))}</td>
                <td className="num">{mascara(money(receitaTotal.aReceber))}</td>
              </tr></tfoot>
            </table>
          </div>}
      <p className="financeNota">A regra hoje é uma só: cada um leva o que produziu. Grupos que dividem por cotas de sociedade precisam de outro cálculo — quando isso existir, é aqui que muda.</p>
    </PainelRecolhivel>}
      </>}
      {tarefa==="idade"&&<>
    {/* O instrumento nº 1 de recebíveis, e o que faltava.
        "R$ 40.000 a receber" não diz nada sozinho: quarenta mil com trinta dias
        é operação saudável, quarenta mil com cento e vinte é dinheiro em risco.
        É esta tabela que diz para quem ligar na segunda-feira. */}
    <PainelRecolhivel chave="fin-idade" titulo="A receber por idade"
      legenda="há quanto tempo cada convênio está devendo" abrePadrao
      extra={<b>{mascara(money(totaisIdade.total))}</b>}>
      {linhasIdade.length===0
        ? <div className="emptyClinical compactEmpty">Nada a receber. Tudo quitado.</div>
        : <div className="financeTabelaRolavel">
            <table className="financeTabela">
              <thead><tr>
                <th>Convênio</th>
                {FAIXAS_DE_IDADE.map(f=><th key={f.id} className="num">{f.rotulo}</th>)}
                <th className="num">Total</th>
              </tr></thead>
              <tbody>
                {linhasIdade.map(linha=><tr key={linha.convenio}>
                  <td>{linha.convenio}</td>
                  {FAIXAS_DE_IDADE.map(f=>
                    <td key={f.id} className={f.id==="acima90"&&linha.faixas[f.id]>0?"num alerta":"num"}>
                      {linha.faixas[f.id]>0?mascara(money(linha.faixas[f.id])):"—"}
                    </td>)}
                  <td className="num"><b>{mascara(money(linha.total))}</b></td>
                </tr>)}
              </tbody>
              <tfoot><tr>
                <td>Total</td>
                {FAIXAS_DE_IDADE.map(f=><td key={f.id} className="num">{mascara(money(totaisIdade.faixas[f.id]))}</td>)}
                <td className="num">{mascara(money(totaisIdade.total))}</td>
              </tr></tfoot>
            </table>
          </div>}
      {totaisIdade.faixas.acima90>0&&
        <p className="financeNota alerta"><Icone nome="alerta" tamanho={15}/> {mascara(money(totaisIdade.faixas.acima90))} esperando há mais de 90 dias. É o que costuma virar perda se ninguém cobrar.</p>}
    </PainelRecolhivel>

    {/* Quanto tempo cada convênio leva para pagar. Muda conversa de contrato e
        muda a projeção de caixa: quem paga em 78 dias exige quase três meses de
        capital de giro parado. */}
    <PainelRecolhivel chave="fin-prazo" titulo="Prazo de pagamento por convênio"
      legenda="da emissão da nota até o dinheiro entrar, com base no que já foi pago">
      {prazos.length===0
        ? <div className="emptyClinical compactEmpty">Ainda não há pagamentos com nota emitida para calcular o prazo.</div>
        : <div className="financeTabelaRolavel">
            <table className="financeTabela">
              <thead><tr><th>Convênio</th><th className="num">Prazo médio</th><th className="num">Pagamentos</th><th className="num">Valor recebido</th></tr></thead>
              <tbody>{prazos.map(p=><tr key={p.convenio}>
                <td>{p.convenio}</td>
                <td className={p.dias>60?"num alerta":"num"}>{p.dias} dias</td>
                <td className="num">{p.pagamentos}</td>
                <td className="num">{mascara(money(p.valor))}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      <p className="financeNota">A média é ponderada pelo valor: um pagamento grande e demorado pesa mais que vários pequenos e rápidos, porque é onde o seu dinheiro está.</p>
    </PainelRecolhivel>
      </>}
      {tarefa==="graficos"&&<GraficosFinanceiro financeiro={financeiro} pagamentos={pagamentos} periodo={period}/>}
      {tarefa==="faturamento"&&<>
    <PainelRecolhivel chave="fin-faturamento" className="billingDashboard" titulo="Faturamento por convênio" legenda="Valores faturados e recebidos na competência selecionada."><div className="billingPlanTable"><table><thead><tr><th>Convênio</th><th>Consultas</th><th>Valor unitário</th><th>Faturado</th><th>Recebido</th><th>Pendente</th></tr></thead><tbody>{byPlan.map(item=><tr key={item.convenio}><td><strong>{item.convenio}</strong></td><td>{item.consultas}</td><td>{money(item.unit)}</td><td>{money(item.valor)}</td><td>{money(item.recebido)}</td><td>{money(item.pendente)}</td></tr>)}</tbody></table>{!byPlan.length&&<div className="emptyClinical compactEmpty">Os valores por convênio aparecerão após os lançamentos.</div>}</div></PainelRecolhivel>
      </>}
      {tarefa==="fechamento"&&<>
    <PainelRecolhivel className="closingPanel" chave="fin-fechamento" titulo={<><Icone nome="cadeado"/> Fechamento do período — {period.split("-").reverse().join("/")}</>} extra={<span className={`statusChip ${periodState?.status==="conferido"?"present":"waiting"}`}>{periodState?.status?.toUpperCase()||"EM PREPARAÇÃO"}</span>}><div className="closingMetrics"><MoneySmall value={total} label="Total cobrado"/><MoneySmall value={received} label="Recebido" tone="green"/><MoneySmall value={pending} label="Pendente" tone="amber"/><MoneySmall value={glosas.reduce((s,i)=>s+Number(i.glosa_valor||0),0)} label="Glosas" tone="red"/><MoneySmall value={periodItems.reduce((s,i)=>s+(i.repasse_status==="pago"?Number(i.repasse_valor):0),0)} label="Repasses realizados" tone="blue"/><MoneySmall value={periodItems.length?total/periodItems.length:0} label="Ticket médio"/></div><div className="closingFooter"><span><Icone nome="alerta" tamanho={15}/> Revise notas, glosas e pagamentos pendentes antes da conferência.</span><button className="primaryClinical compact" disabled={busy==="period"||periodState?.status==="conferido"} onClick={confirmPeriod}>{periodState?.status==="conferido"?"Período conferido":"Confirmar conferência"}</button></div></PainelRecolhivel>
      </>}
      {tarefa==="extrato"&&<>
    {/* O extrato responde "quando e como entrou cada real" — antes isso era
        uma frase de rodapé com a contagem, inútil para conferência. */}
    <PainelRecolhivel
      chave="fin-extrato"
      abrePadrao={false}
      titulo="Extrato de pagamentos recebidos"
      legenda={`${pagamentos.length} registro(s) · data, paciente, forma e valor`}
    >
      {pagamentos.length?pagamentos.slice(0,80).map(pg=>{
        const atendimento=financeiro.find(f=>f.id===pg.atendimento_id);
        const patient=atendimento?patientMap.get(atendimento.patient_id):undefined;
        return <div className="extratoRow" key={pg.id}>
          <time>{new Date(pg.paid_at).toLocaleDateString("pt-BR")}</time>
          <span><strong>{patient?.nome||"Paciente"}</strong><small>{atendimento?.convenio||""}{pg.referencia?` · ${pg.referencia}`:""}</small></span>
          <span className="statusChip paused">{pg.metodo}</span>
          <b>{money(Number(pg.valor))}</b>
        </div>;
      }):<div className="emptyClinical compactEmpty">Nenhum pagamento registrado ainda.</div>}
    </PainelRecolhivel>
      </>}
      {tarefa==="valores"&&<>
    <ConvenioValoresPanel perfil={perfil} convenioValores={convenioValores} onRefresh={onRefresh}/>
      </>}
      </div>
    </div>
    {configOpen&&<div className="patientModalBackdrop" role="presentation"><section className="financeConfigModal" role="dialog" aria-modal="true" aria-labelledby="finance-config-title">
      <div className="patientModalHead"><div><strong id="finance-config-title">Configurar valores das consultas</strong><span>Adicione os convênios que você atende e remova os que não usa.</span></div><button type="button" onClick={()=>setConfigOpen(false)} aria-label="Fechar">×</button></div>
      {message&&<p className={message.startsWith("Não")?"clinicalError":"financeSuccess"} role="status">{message}</p>}
      <form className="financeConfigNovo" onSubmit={e=>{e.preventDefault();void addConvenio()}}>
        <label><span>Adicionar convênio</span><input value={novoConvenio} onChange={e=>setNovoConvenio(e.target.value)} placeholder="Ex.: Cassems, Unimed Regional..."/></label>
        <button className="outlineClinical" type="submit" disabled={busy==="novoConvenio"||!novoConvenio.trim()}>{busy==="novoConvenio"?"Adicionando...":"Adicionar"}</button>
      </form>
      <div className="financeConfigList">{knownConvenios.map(convenio=>{
        const usos=pacientes.filter(p=>p.convenio===convenio).length;
        return <div className="financeConfigItem" key={convenio}>
          <label><span>{convenio}</span><div><b>R$</b><input inputMode="decimal" value={priceValues[convenio]??"0"} onChange={event=>setPriceValues(current=>({...current,[convenio]:event.target.value}))} aria-label={`Valor da consulta ${convenio}`}/></div></label>
          <button
            type="button" className="financeConfigRemover"
            disabled={busy===`remover-${convenio}`||usos>0}
            title={usos>0?`${usos} paciente(s) usam ${convenio} — não dá para remover.`:`Remover ${convenio} da lista`}
            aria-label={`Remover ${convenio}`}
            onClick={()=>removeConvenio(convenio)}
          ><Icone nome="fechar" tamanho={14}/></button>
        </div>;
      })}</div>
      <div className="patientModalActions"><button className="outlineClinical" type="button" onClick={()=>setConfigOpen(false)}>Fechar</button><button className="primaryClinical compact" type="button" disabled={busy==="prices"} onClick={savePrices}>{busy==="prices"?"Salvando...":"Salvar valores"}</button></div>
    </section></div>}
  </div>
}

/**
 * Assinatura: o que está valendo, e o botão de encerrar.
 *
 * A página de planos promete "sem fidelidade, cancele quando quiser". Sem uma
 * tela, isso dependia de alguém atender o WhatsApp — e promessa que depende de
 * atendimento não é promessa.
 *
 * Cancelar aqui quer dizer "não renove mais". O acesso vai até a data já paga,
 * e a tela diz essa data antes e depois de confirmar: quem cancela precisa
 * saber que não vai perder o sistema na mesma hora, senão adia a decisão e
 * pede reembolso depois.
 *
 * A confirmação é digitada, não é um "tem certeza?". Numa clínica, quem clica
 * pode ser o administrador contratado, e o clique derruba a cobrança de todo
 * mundo.
 */
function PainelAssinatura({onRefresh}:{onRefresh:()=>void}) {
  const [dados,setDados]=useState<Assinatura|null>(null);
  const [carregando,setCarregando]=useState(true);
  const [encerrando,setEncerrando]=useState(false);
  const [confirmacao,setConfirmacao]=useState("");
  const [motivo,setMotivo]=useState("");
  const [aviso,setAviso]=useState("");
  const [erro,setErro]=useState("");
  const [versao,setVersao]=useState(0);

  useEffect(()=>{
    let ativo=true;
    createClient().rpc("minha_assinatura").then(({data})=>{
      if(!ativo)return;
      setDados((Array.isArray(data)?data[0]:data)??null);
      setCarregando(false);
    });
    return ()=>{ ativo=false };
  },[versao]);

  async function cancelar(){
    setEncerrando(true); setErro(""); setAviso("");
    const resposta=await fetch("/api/assinatura/cancelar",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({motivo}),
    });
    const corpo=await resposta.json().catch(()=>null);
    setEncerrando(false);
    if(!resposta.ok){ setErro(corpo?.error||"Não consegui cancelar. Tente de novo."); return; }
    setConfirmacao(""); setMotivo("");
    setAviso(corpo?.aviso||(corpo?.reembolsoDevido
      ?"Assinatura cancelada. Não haverá nova cobrança, e o valor deste mês será devolvido."
      :"Assinatura cancelada. Não haverá nova cobrança."));
    setVersao(v=>v+1);
    onRefresh();
  }

  async function reativar(){
    setEncerrando(true); setErro(""); setAviso("");
    const {error}=await createClient().rpc("reativar_assinatura");
    setEncerrando(false);
    if(error){ setErro(error.message); return; }
    setAviso("Assinatura reativada. A cobrança volta a renovar normalmente.");
    setVersao(v=>v+1);
    onRefresh();
  }

  if(carregando) return null;
  const cancelada=Boolean(dados?.cancelada_em);
  const ate=dados?.assinatura_ate ? new Date(dados.assinatura_ate).toLocaleDateString("pt-BR") : null;

  return <PainelRecolhivel
    chave="adm-assinatura"
    abrePadrao={false}
    titulo="Assinatura"
    legenda={cancelada
      ? (ate?`cancelada — acesso liberado até ${ate}`:"cancelada")
      : (ate?`renova em ${ate}`:"sem data de renovação")}
  >
    {aviso&&<p className="financeSuccess assinaturaRecado">{aviso}</p>}
    {erro&&<p className="clinicalError assinaturaRecado">{erro}</p>}

    {cancelada ? (
      <div className="assinaturaBloco">
        <p>
          Você cancelou a renovação{dados?.cancelada_em?` em ${new Date(dados.cancelada_em).toLocaleDateString("pt-BR")}`:""}.
          {ate?` O acesso continua até ${ate} — nada é desligado antes disso.`:" O acesso continua até o fim do período pago."}
        </p>
        {dados?.reembolso_devido
          ? <p className="assinaturaReembolso dentro">
              O cancelamento entrou no prazo de {dados.prazo_de_reembolso} dias: o valor deste mês
              será devolvido pela mesma forma de pagamento.
            </p>
          : <p className="assinaturaReembolso fora">
              Fora do prazo de {dados?.prazo_de_reembolso??14} dias de devolução — o valor deste mês
              não é reembolsado, e o acesso segue até o fim dele.
            </p>}
        <button className="outlineClinical" disabled={encerrando} onClick={reativar}>
          {encerrando?"Reativando...":"Voltar atrás e continuar assinando"}
        </button>
      </div>
    ) : (
      <div className="assinaturaBloco">
        <p>
          Sem fidelidade e sem multa. Ao cancelar, não há nova cobrança
          {ate?`, e o acesso continua até ${ate}`:""} — nada é desligado na hora.
        </p>
        {/* O aviso do reembolso vem ANTES do botão, e não depois: descobrir
            que o dinheiro não volta só na tela de confirmação é o tipo de
            surpresa que vira reclamação. */}
        {dados?.dias_de_uso!=null&&(
          dados.reembolso_devido
            ? <p className="assinaturaReembolso dentro">
                Você está no dia {dados.dias_de_uso} deste mês. Cancelando agora, dentro dos
                primeiros {dados.prazo_de_reembolso} dias, o valor deste mês é devolvido.
              </p>
            : <p className="assinaturaReembolso fora">
                Você está no dia {dados.dias_de_uso} deste mês. O prazo de devolução é de
                {" "}{dados.prazo_de_reembolso} dias, então o valor já pago não volta — mas o
                acesso continua até o fim do mês{ate?`, em ${ate}`:""}.
              </p>
        )}
        <label className="clinicalField">
          <span>Por que está cancelando? (opcional, ajuda a melhorar)</span>
          <input value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={500} placeholder="Ex.: parei de atender, ficou caro, faltou um recurso"/>
        </label>
        <label className="clinicalField">
          <span>Para confirmar, digite CANCELAR</span>
          <input value={confirmacao} onChange={e=>setConfirmacao(e.target.value)} placeholder="CANCELAR" autoComplete="off"/>
        </label>
        <button
          className="outlineClinical red"
          disabled={encerrando||confirmacao.trim().toUpperCase()!=="CANCELAR"}
          onClick={cancelar}
        >{encerrando?"Cancelando...":"Cancelar assinatura"}</button>
      </div>
    )}
  </PainelRecolhivel>;
}

function InvitePanel({perfil,organizacao,onRefresh}:{perfil:Perfil;organizacao:Organizacao|null;onRefresh:()=>void}) {
  const [convites,setConvites]=useState<Convite[]>([]);
  const [meio,setMeio]=useState<"email"|"link"|"sem-acesso">("email");
  // A função escolhida decide se o CRM aparece. Recepção e financeiro não
  // entram na escala; pedir o registro a eles seria pedir o que não existe.
  const [papel,setPapel]=useState("medico");
  const [versao,setVersao]=useState(0);
  const [busy,setBusy]=useState("");
  const [aviso,setAviso]=useState("");
  const [copiado,setCopiado]=useState("");

  // O RLS já limita a consulta aos convites da própria organização.
  useEffect(()=>{
    let ativo=true;
    createClient().from("convites")
      .select("id,email,role,token,status,expires_at,created_at")
      .order("created_at",{ascending:false})
      .then(({data})=>{ if(ativo) setConvites(data??[]) });
    return ()=>{ ativo=false };
  },[versao]);
  const carregar=useCallback(()=>setVersao(v=>v+1),[]);

  const linkDoConvite=(token:string)=>
    `${typeof window==="undefined"?"":window.location.origin}/convite/${token}`;

  async function convidar(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formulario=event.currentTarget;
    setBusy("novo");setAviso("");
    const form=new FormData(formulario);
    const email=String(form.get("email")??"").trim().toLowerCase();
    const role=String(form.get("role")??"");

    // O anestesiologista que não usa o sistema. Sem e-mail, sem convite, sem
    // senha: nasce só para ser escalado e faturado.
    if(meio==="sem-acesso"){
      const nome=String(form.get("nome")??"").trim();
      const crm=String(form.get("crm")??"").trim();
      if(!nome){setAviso("Informe o nome do profissional.");setBusy("");return}
      if(!crm){setAviso("Informe o CRM — sem ele o profissional não entra na escala.");setBusy("");return}
      const resposta=await fetch("/api/admin/users",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({nome,role:"medico",sem_acesso:true,crm,
          rqe:String(form.get("rqe")??"").trim()}),
      });
      const resultado=await resposta.json().catch(()=>({}));
      setBusy("");
      if(!resposta.ok){setAviso(resultado.error??"Não foi possível cadastrar.");return}
      formulario.reset();
      setAviso(`${nome} cadastrado. Já pode ser escalado — e não recebe acesso ao sistema.`);
      onRefresh();
      return;
    }

    if(!email){setAviso("Informe o e-mail de quem será convidado.");setBusy("");return}

    if(meio==="email"){
      // O Supabase envia a mensagem e o perfil já nasce com a função escolhida.
      const nome=String(form.get("nome")??"").trim();
      if(!nome){setAviso("Informe o nome de quem será convidado.");setBusy("");return}
      const resposta=await fetch("/api/admin/users",{
        method:"POST", headers:{"Content-Type":"application/json"},
        // O CRM vai junto quando o administrador soube informar. É ele que
        // faz o convidado aparecer na escala hoje, sem esperar a ativação.
        body:JSON.stringify({nome,email,role,
          crm:String(form.get("crm")??"").trim(),
          rqe:String(form.get("rqe")??"").trim()}),
      });
      const resultado=await resposta.json().catch(()=>({}));
      setBusy("");
      if(!resposta.ok){setAviso(resultado.error??"Não foi possível enviar o convite.");return}
      const crmInformado=String(form.get("crm")??"").trim();
      formulario.reset();
      setPapel("medico");
      // A segunda frase é o que o administrador precisa saber agora: dá para
      // escalar hoje, sem esperar a pessoa clicar no e-mail.
      setAviso(`Convite enviado para ${email}.`
        +(crmInformado&&papel==="medico"
          ?" Já pode ser escalado — os plantões estarão lá quando ativar a conta."
          :""));
      onRefresh();
      return;
    }

    const dias=Number(form.get("dias")??7);
    const {error}=await createClient().from("convites").insert({
      institution_id:perfil.institution_id, email, role, invited_by:perfil.id,
      expires_at:new Date(Date.now()+dias*86400000).toISOString(),
    });
    setBusy("");
    if(error){
      setAviso(error.code==="23505"
        ? "Já existe um convite pendente para este e-mail. Cancele o anterior antes de criar outro."
        : `Não foi possível convidar: ${error.message}`);
      return;
    }
    formulario.reset();
    carregar();
  }

  async function revogar(id:string){
    setBusy(id);
    const {error}=await createClient().from("convites")
      .update({status:"revogado"}).eq("id",id);
    setBusy("");
    if(error)setAviso(`Não foi possível cancelar: ${error.message}`);
    else carregar();
  }

  /**
   * Uma frase por papel, dizendo onde a pessoa vai trabalhar.
   *
   * UMA. A versão anterior listava as oito funções em oito linhas, e o primeiro
   * convite de verdade mostrou dois problemas de uma vez: o WhatsApp entregou
   * tudo num parágrafo só, e a lista foi para uma administradora que não faz
   * plantão. Convite não vende — quem recebe já foi convidado por alguém, e a
   * decisão de entrar já está tomada. Oito linhas antes do link só afastam o
   * dedo do link.
   *
   * A frase muda com o papel porque o papel muda o sistema inteiro: quem entra
   * na recepção não tem escala, e quem entra no financeiro não tem paciente.
   * Prometer a escala a quem não a terá é começar com uma decepção.
   */
  const ONDE_TRABALHA:Record<string,string>={
    medico:"É onde ficam a escala do serviço, os seus plantões e as avaliações pré-anestésicas, com ficha e termo prontos para imprimir.",
    recepcao:"É onde ficam o cadastro dos pacientes e a agenda das consultas pré-anestésicas.",
    financeiro:"É onde ficam o faturamento do serviço e o controle dos recebimentos.",
    admin:"É onde ficam a equipe, os locais de atendimento e a organização do serviço.",
    owner:"É onde ficam a equipe, os locais de atendimento e a organização do serviço.",
  };

  // Abre o WhatsApp com a mensagem pronta; o contato é escolhido na hora.
  function enviarWhatsApp(item:Convite){
    const papel=ROLE_LABELS[item.role]??item.role;
    const validade=new Date(item.expires_at).toLocaleDateString("pt-BR");
    const mensagem=[
      `Olá! Você foi convidado para o AVANEST — ${organizacao?.nome??"nossa organização"}, como ${papel}.`,
      "",
      ONDE_TRABALHA[item.role]??"",
      "",
      `Crie seu acesso: ${linkDoConvite(item.token)}`,
      "",
      `Válido até ${validade}, apenas para o e-mail ${item.email}.`,
    // Sem a linha vazia quando não há frase para o papel: duas quebras seguidas
    // viram um buraco no meio da mensagem.
    ].filter((l,i,todas)=>l!==""||todas[i-1]!=="").join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`,"_blank","noopener,noreferrer");
  }

  async function copiar(token:string){
    try{
      await navigator.clipboard.writeText(linkDoConvite(token));
      setCopiado(token);
      setTimeout(()=>setCopiado(""),2500);
    }catch{
      setAviso("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  const pendentes=convites.filter(c=>c.status==="pendente");
  const expirado=(c:Convite)=>new Date(c.expires_at)<=new Date();

  return <section className="clinicalPanel">
    <div className="panelTitle">
      <strong><Icone nome="envelope"/> Convidar para {organizacao?.nome??"a organização"}</strong>
    </div>
    <div className="inviteModeSwitch" role="tablist">
      <button type="button" role="tab" aria-selected={meio==="email"} className={meio==="email"?"active":""}
        onClick={()=>{setMeio("email");setAviso("")}}>Enviar por e-mail</button>
      <button type="button" role="tab" aria-selected={meio==="link"} className={meio==="link"?"active":""}
        onClick={()=>{setMeio("link");setAviso("")}}>Gerar link</button>
      {/* O terceiro caminho não é um jeito diferente de convidar: é um cadastro
          que não convida ninguém. Fica junto porque é aqui que o administrador
          vem quando precisa pôr mais alguém no grupo. */}
      <button type="button" role="tab" aria-selected={meio==="sem-acesso"} className={meio==="sem-acesso"?"active":""}
        onClick={()=>{setMeio("sem-acesso");setAviso("")}}>Sem e-mail</button>
    </div>
    {/* Fora do formulário de propósito: ele é uma grade de seis colunas, e um
        parágrafo dentro dela quebraria a linha dos campos ao meio. */}
    {meio==="email"&&(papel==="medico"||papel==="admin")&&
      <p className="inviteHint">Com o CRM preenchido, o convidado já entra na escala hoje — sem esperar ele ativar a conta. Os plantões estarão lá quando ele entrar.</p>}
    <form className="convenioForm" onSubmit={convidar}>
      {meio!=="link"&&<label className="clinicalField span2"><span>Nome completo *</span>
        <input name="nome" required autoComplete="off" placeholder="Ex.: Dra. Helena Martins"/></label>}
      {meio!=="sem-acesso"&&<label className="clinicalField span2"><span>E-mail do convidado *</span>
        <input name="email" type="email" required autoComplete="off" placeholder="pessoa@exemplo.com"/></label>}
      {meio!=="sem-acesso"&&<label className="clinicalField"><span>Função</span>
        <select name="role" value={papel} onChange={e=>setPapel(e.target.value)}>
          <option value="medico">Anestesiologista</option>
          <option value="recepcao">Recepção</option>
          <option value="financeiro">Financeiro</option>
          <option value="admin">Administrador</option>
        </select></label>}
      {/* O CRM é obrigatório no cadastro sem acesso e opcional no convite.
          A diferença é quem preenche depois: quem não entra no sistema nunca
          vai preencher nada, e sem CRM não aparece na escala — que é a única
          razão daquele cadastro existir.

          No convite ele existe por outro motivo. O perfil nasce no instante em
          que o convite é enviado, mas sem CRM ninguém consegue escalar a
          pessoa até ela ativar a conta. Preenchido aqui, o convidado entra na
          escala do mês hoje, e os plantões já são dele quando ele entrar. */}
      {/* No "Gerar link" não: ali o perfil só nasce quando a pessoa aceita, e
          o que ela digitar no aceite é que vale. Um CRM pedido aqui seria um
          campo que o sistema aceita e depois joga fora. */}
      {(meio==="sem-acesso"||(meio==="email"&&(papel==="medico"||papel==="admin")))&&<>
        <label className="clinicalField">
          <span>CRM {meio==="sem-acesso"?"*":"(opcional)"}</span>
          <input name="crm" required={meio==="sem-acesso"} autoComplete="off"
            placeholder="Ex.: 60593/PR"/></label>
        <label className="clinicalField"><span>RQE (opcional)</span>
          <input name="rqe" autoComplete="off" placeholder="Registro da especialidade"/></label>
      </>}
      {meio==="link"&&<label className="clinicalField"><span>Validade</span>
        <select name="dias" defaultValue="7">
          <option value="3">3 dias</option><option value="7">7 dias</option><option value="30">30 dias</option>
        </select></label>}
      <button className="primaryClinical compact" type="submit" disabled={busy==="novo"}>
        {busy==="novo"?"Salvando...":meio==="email"?"Enviar convite":meio==="link"?"Gerar link":"Cadastrar sem acesso"}</button>
    </form>
    {aviso&&<p className={/^(Convite enviado|.+cadastrado\.)/.test(aviso)?"financeSuccess":"clinicalError"} role="alert">{aviso}</p>}
    <p className="evalHint">{meio==="email"
      ? "O AVANEST envia um e-mail com um link para a pessoa criar a própria senha. O acesso já entra com a função escolhida."
      : meio==="link"
      ? "Copie o link gerado e envie por WhatsApp ou onde preferir. Ele só funciona para o e-mail informado, expira na data escolhida e pode ser cancelado a qualquer momento."
      : "Para o anestesiologista que não usa o sistema. Ele entra na escala, no faturamento e na ficha impressa, e não recebe login nem senha — não há e-mail, não há convite e não há como ele entrar. Se um dia precisar de acesso, você adiciona o e-mail no cadastro dele e o convite sai na hora, sem perder plantão nenhum."}</p>
    {pendentes.length===0
      ? <div className="emptyClinical compactEmpty">Nenhum convite pendente.</div>
      : pendentes.map(item=><div className="conviteRow" key={item.id}>
          <span className="conviteQuem">
            <strong>{item.email}</strong>
            <small>{ROLE_LABELS[item.role]??item.role} · {expirado(item)?"expirado":`válido até ${new Date(item.expires_at).toLocaleDateString("pt-BR")}`}</small>
          </span>
          <div className="conviteAcoes">
            <button type="button" className="outlineClinical compacto whatsappAction" onClick={()=>enviarWhatsApp(item)}>
              <Icone nome="whatsapp"/> WhatsApp</button>
            <button type="button" className="outlineClinical compacto" onClick={()=>copiar(item.token)}>
              <Icone nome={copiado===item.token?"confirmado":"copiar"}/> {copiado===item.token?"Copiado":"Copiar link"}</button>
            <button type="button" className="outlineClinical compacto" disabled={busy===item.id} onClick={()=>revogar(item.id)}>
              {busy===item.id?"Cancelando...":"Cancelar"}</button>
          </div>
        </div>)}
  </section>;
}

const ACAO_LABELS:Record<string,string>={
  organizacao_criada:"Organização criada",
  avaliacao_excluida:"Avaliação excluída",
  perfil_atualizado:"Perfil atualizado",
  usuario_excluido:"Acesso excluído",
  pagamento_registrado:"Pagamento registrado",
  periodo_conferido:"Período conferido",
  convite_criado:"Convite enviado",
  convite_aceito:"Convite aceito",
  avaliacao_concluida:"Avaliação concluída",
  presenca_confirmada:"Presença confirmada",
};

function AdminView({perfil,organizacao,perfis,auditoria,onRefresh,abrirEm}:{perfil:Perfil;organizacao:Organizacao|null;perfis:PerfilGerenciado[];auditoria:Auditoria[];onRefresh:()=>void;
  /**
   * Em que seção abrir, quando quem manda abrir é de fora — hoje, o
   * "+ Nova escala" da coluna da Escala.
   *
   * O `token` existe pelo mesmo motivo que na Escala: a seção é ESTADO desta
   * tela e a pessoa pode sair dela. Sem o token, um segundo clique no mesmo
   * atalho não mudaria a propriedade e o botão pareceria quebrado.
   */
  abrirEm?:{aba:string;token:number}|null}) {
  const [message,setMessage]=useState("");
  // Qual seção da Administração está aberta, igual ao Financeiro.
  const [aba,setAba]=useState("usuarios");
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido vindo de outra área
    if(abrirEm) setAba(abrirEm.aba);
  },[abrirEm]);
  const [busy,setBusy]=useState("");
  const [org,setOrg]=useState({nome:organizacao?.nome??"",telefone:organizacao?.telefone??"",email:organizacao?.email??""});
  const orgAlterada=org.nome!==(organizacao?.nome??"")||org.telefone!==(organizacao?.telefone??"")||org.email!==(organizacao?.email??"");

  async function saveOrganizacao(){
    if(!org.nome.trim()){setMessage("Não foi possível salvar: o nome da organização não pode ficar vazio.");return}
    setBusy("org");setMessage("");
    const {error}=await createClient().from("instituicoes")
      .update({nome:org.nome.trim(),telefone:org.telefone.trim()||null,email:org.email.trim()||null,updated_at:new Date().toISOString()})
      .eq("id",perfil.institution_id);
    setBusy("");
    if(error)setMessage(`Não foi possível salvar os dados da organização: ${error.message}`);
    else{setMessage("Dados da organização salvos. O nome novo passa a sair nas fichas impressas.");onRefresh()}
  }
  const [editing,setEditing]=useState<Record<string,PerfilGerenciado>>(()=>Object.fromEntries(perfis.map(item=>[item.id,{...item}])));
  // A edição abre sob demanda: com todas as linhas abertas, seis campos por
  // usuário viram uma parede de caixas e a lista deixa de ser consultável.
  const [aberto,setAberto]=useState("");
  const [buscaUsuario,setBuscaUsuario]=useState("");
  const [filtroPapel,setFiltroPapel]=useState("todos");
  const [filtroStatus,setFiltroStatus]=useState("todos");
  const actorNames=new Map(perfis.map(item=>[item.id,item.nome]));

  async function saveProfile(item:PerfilGerenciado){
    setBusy(item.id);setMessage("");
    const {error}=await createClient().rpc("admin_atualizar_perfil",{
      p_perfil_id:item.id,p_role:item.role,p_status:item.status,p_nome:item.nome,p_crm:item.crm||null,p_rqe:item.rqe||null,
      // Sempre uma lista, nunca nulo: nulo quer dizer "não mexa", e aqui a
      // tela está justamente dizendo quais áreas devem valer. Desmarcar todas
      // precisa apagar as que havia.
      p_permissoes:areasExtras(item),
    });
    setBusy("");
    if(error)setMessage(`Não foi possível atualizar o acesso: ${error.message}`);
    else{setMessage("Perfil atualizado e registrado na auditoria.");onRefresh()}
  }

  async function removeUser(item:PerfilGerenciado){
    if(!window.confirm(`Excluir definitivamente o acesso de ${item.nome}? Só é possível para quem ainda não registrou nada no sistema.`))return;
    setBusy(item.id);setMessage("");
    const {error}=await createClient().rpc("excluir_usuario",{p_perfil_id:item.id});
    setBusy("");
    if(error)setMessage(error.message);
    else{setMessage(`Acesso de ${item.nome} excluído.`);onRefresh()}
  }

  return <div className="clinicalMain adminMain">
    <section><h1>Administração</h1><p>Gerencie usuários, permissões profissionais e acompanhe ações importantes do sistema.</p></section>
    {message&&<p className={message.startsWith("Não")?"clinicalError":"financeSuccess"}>{message}</p>}
    <section className="metricGrid adminMetrics"><Metric value={perfis.filter(item=>item.status==="ativo").length} label="Usuários ativos" tone="green"/><Metric value={perfis.filter(item=>item.role==="medico").length} label="Médicos" tone="blue"/><Metric value={perfis.filter(item=>item.status==="inativo").length} label="Acessos inativos" tone="red"/><Metric value={auditoria.length} label="Eventos recentes" tone="amber"/></section>

    <div className="financeLayout">
      {/* Mesma coluna de tarefas do Financeiro. O contador é só o de acessos
          inativos, que é a única coisa aqui que de fato pede uma decisão —
          inventar contador nas outras faria os números pararem de significar
          alguma coisa. */}
      <nav className="financeTarefas" aria-label="Seções da Administração">
        {([
          ["grupo","Equipe"],
          ["usuarios","Usuários e permissões",perfis.filter(i=>i.status==="inativo").length],
          ["convites","Convites"],
          ["grupo","Organização"],
          ["dados","Dados da organização"],
          ["locais","Locais de atendimento"],
          ["assinatura","Assinatura"],
          ["grupo","Registro"],
          ["auditoria","Auditoria"],
        ] as [string,string,number?][]).map(([id,rotulo,contador],i)=>
          id==="grupo"
            ? <span className="financeTarefaGrupo" key={`g${i}`}>{rotulo}</span>
            : <button
                type="button" key={id}
                className={aba===id?"active":""}
                aria-current={aba===id?"true":undefined}
                onClick={()=>setAba(id)}
              >
                <span>{rotulo}</span>
                {contador?<b className="financeTarefaContador">{contador}</b>:null}
              </button>)}
      </nav>

      <div className="financeConteudo">
      {aba==="usuarios"&&<>
    <section className="clinicalPanel adminUsers">
      <div className="panelTitle"><strong>Usuários e permissões</strong></div>
      <div className="adminFiltros">
        <input
          className="adminBusca" type="search" value={buscaUsuario}
          onChange={e=>setBuscaUsuario(e.target.value)}
          placeholder="Buscar por nome, e-mail ou CRM" aria-label="Buscar usuário"
        />
        <label><span>Perfil</span><select value={filtroPapel} onChange={e=>setFiltroPapel(e.target.value)}>
          <option value="todos">Todos</option>
          {Object.entries(ROLE_LABELS).map(([valor,rotulo])=><option key={valor} value={valor}>{rotulo}</option>)}
        </select></label>
        <label><span>Status</span><select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option>
        </select></label>
      </div>
      {(()=>{
        const termo=buscaUsuario.trim().toLowerCase();
        const lista=perfis.filter(item=>
          (filtroPapel==="todos"||item.role===filtroPapel)&&
          (filtroStatus==="todos"||item.status===filtroStatus)&&
          (!termo||`${item.nome} ${item.email??""} ${item.crm??""}`.toLowerCase().includes(termo)));
        if(!lista.length) return <div className="emptyClinical">
          <strong>Nenhum usuário encontrado.</strong>
          {perfis.length
            ? <>Nenhum dos {perfis.length} usuários combina com a busca ou os filtros. Limpe os filtros para ver todos.</>
            : <>Convide alguém da equipe pelo painel acima para começar.</>}
        </div>;
        return lista.map(source=>{
          const item=editing[source.id]||source;
          const setItem=(changes:Partial<PerfilGerenciado>)=>setEditing(state=>({...state,[source.id]:{...item,...changes}}));
          const expandido=aberto===source.id;
          const podeExcluir=source.id!==perfil.id&&source.role!=="owner";
          return <div className={`adminUserItem ${expandido?"expandido":""}`.trim()} key={source.id}>
            {/* Linha fechada: identidade e situação de relance. */}
            <div className="adminUserResumo">
              <span className="avatar" aria-hidden="true">{initials(source.nome)}</span>
              <span className="adminUserIdent">
                <strong>{source.nome}</strong>
                <small>{source.sem_acesso?"não usa o sistema":source.email||"sem e-mail"}{source.crm?` · ${source.crm}`:""}</small>
              </span>
              {/* Os papéis ficam numa faixa de largura fixa, e não soltos na
                  linha: quem tem duas áreas empurrava o status e o botão das
                  linhas vizinhas para outra posição, e a lista virava escada. */}
              <span className="adminUserPapeis">
                <span className="statusChip paused">{ROLE_LABELS[source.role]??source.role}</span>
                {/* Quem acumula área aparece acumulando: sem isso, a lista mostra
                    "Financeiro" para alguém que também abre a recepção. */}
                {areasExtras(source).map(area=><span className="statusChip present" key={area} title="Área extra concedida">+ {ROLE_LABELS[area]??area}</span>)}
                {/* CRM não é burocracia aqui: a contagem de profissionais do
                    plano só conta médico com CRM, e a ficha sai sem assinatura. */}
                {source.role==="medico"&&!source.crm?.trim()&&<span className="statusChip waiting" title="Médico sem CRM não entra na contagem do plano e a ficha impressa sai sem o registro.">Sem CRM</span>}
                {/* Quem foi cadastrado para ser escalado e não entra no
                    sistema. Sem esta marca, o administrador vê um usuário que
                    "nunca fez login" e tenta reenviar convite para um e-mail
                    que não existe. */}
                {source.sem_acesso&&<span className="statusChip paused" title="Entra na escala e no faturamento. Não tem login: não há e-mail, senha nem convite.">Sem acesso</span>}
              </span>
              <span className={`statusChip ${source.status==="ativo"?"present":"waiting"}`}>{source.status==="ativo"?"Ativo":"Inativo"}</span>
              <button
                className="outlineClinical" aria-expanded={expandido}
                onClick={()=>setAberto(atual=>atual===source.id?"":source.id)}
              >{expandido?"Fechar":"Editar"}</button>
            </div>
            {expandido&&<div className="adminUserEdicao">
              <div className="adminUserCampos">
                <label className="clinicalField"><span>Nome</span><input value={item.nome} onChange={e=>setItem({nome:e.target.value})}/></label>
                <label className="clinicalField"><span>E-mail</span><input value={item.email||""} readOnly/></label>
                <label className="clinicalField"><span>Perfil</span><select value={item.role} disabled={source.role==="owner"&&perfil.role!=="owner"} onChange={e=>setItem({role:e.target.value})}><option value="recepcao">Recepção</option><option value="medico">Médico</option><option value="financeiro">Financeiro</option><option value="admin">Administrador</option>{perfil.role==="owner"&&<option value="owner">Proprietário</option>}</select></label>
                <label className="clinicalField"><span>Status</span><select value={item.status} disabled={source.id===perfil.id} onChange={e=>setItem({status:e.target.value})}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
                <label className="clinicalField"><span>CRM / UF</span><input value={item.crm||""} onChange={e=>setItem({crm:e.target.value})} placeholder="Somente médico"/></label>
                <label className="clinicalField"><span>RQE</span><input value={item.rqe||""} onChange={e=>setItem({rqe:e.target.value})} placeholder="Opcional"/></label>
              </div>
              <div className="adminAreasExtras">
                <strong>Áreas extras</strong>
                {VE_TUDO.includes(item.role)
                  ? <small>{ROLE_LABELS[item.role]} já enxerga todas as áreas.</small>
                  : <>
                      <small>Além de {ROLE_LABELS[item.role]?.toLowerCase()??item.role}, esta pessoa também acessa:</small>
                      <div>{AREAS_EXTRAS.filter(area=>area!==item.role).map(area=>{
                        const marcada=areasExtras(item).includes(area);
                        return <label key={area}>
                          <input type="checkbox" checked={marcada}
                            onChange={()=>setItem({permissoes:marcada
                              ? areasExtras(item).filter(x=>x!==area)
                              : [...areasExtras(item),area]})}/>
                          <span>{ROLE_LABELS[area]??area}</span>
                        </label>;
                      })}</div>
                    </>}
              </div>
              <div className="adminUserAcoes">
                <button className="primaryClinical compact" disabled={busy===item.id} onClick={()=>saveProfile(item)}>{busy===item.id?"Salvando...":"Salvar alterações"}</button>
              </div>
              {/* Excluir fica fora do fluxo, numa área separada e discreta: é
                  irreversível e não deve competir com o botão de salvar. */}
              {podeExcluir&&<div className="adminZonaPerigo">
                <span>
                  <strong>Excluir acesso</strong>
                  <small>Só funciona para quem ainda não registrou nada no sistema. Para os demais, use Status: Inativo — o histórico clínico precisa continuar atribuído.</small>
                </span>
                <button className="outlineClinical red" disabled={busy===item.id} onClick={()=>removeUser(source)}>Excluir</button>
              </div>}
            </div>}
          </div>;
        });
      })()}
    </section>
      </>}
      {aba==="convites"&&<>
    <InvitePanel perfil={perfil} organizacao={organizacao} onRefresh={onRefresh}/>
      </>}
      {aba==="dados"&&<>
    <section className="clinicalPanel">
      <div className="panelTitle"><strong>Dados da organização</strong><span>sai impresso na ficha e no termo</span></div>
      <div className="orgCampos">
        <label className="clinicalField"><span>Nome da organização</span><input value={org.nome} onChange={e=>setOrg(v=>({...v,nome:e.target.value}))}/></label>
        <label className="clinicalField"><span>Telefone</span><input value={org.telefone} onChange={e=>setOrg(v=>({...v,telefone:e.target.value}))} placeholder="(00) 00000-0000"/></label>
        <label className="clinicalField"><span>E-mail de contato</span><input value={org.email} onChange={e=>setOrg(v=>({...v,email:e.target.value}))} placeholder="contato@exemplo.com.br"/></label>
      </div>
      <div className="orgAcoes">
        <small>{organizacao?.tipo==="individual"?"Cadastro individual":"Grupo"} · plano e cobrança ficam na página de assinatura.</small>
        <div>
          <a className="outlineClinical" href="/assinatura"><Icone nome="assinatura" tamanho={15}/> Plano e cobrança</a>
          <button className="primaryClinical compact" disabled={busy==="org"||!orgAlterada} onClick={saveOrganizacao}>{busy==="org"?"Salvando...":"Salvar dados"}</button>
        </div>
      </div>
    </section>
      </>}
      {aba==="locais"&&<>
        <section className="clinicalPanel">
          <div className="panelTitle"><strong>Locais de atendimento</strong></div>
          <div className="locaisAdminCaixa">
            <LocaisAdmin
              institutionId={perfil.institution_id}
              perfilId={perfil.id}
              podeCompartilhar={["owner","admin"].includes(perfil.role)||(Array.isArray(perfil.permissoes)&&perfil.permissoes.includes("admin"))}
            />
          </div>
        </section>
      </>}
      {aba==="assinatura"&&<>
    <PainelAssinatura onRefresh={onRefresh}/>
      </>}
      {aba==="auditoria"&&<>
    {/* Auditoria também fica recolhida: é registro para consulta, não painel
        de rotina, e expõe quem fez o quê a cada acesso à tela. */}
    <PainelRecolhivel
      className="auditPanel"
      chave="adm-auditoria"
      abrePadrao={false}
      titulo="Auditoria recente"
      legenda={`${auditoria.length} evento(s) · conclusões, pagamentos, presenças e mudanças de acesso`}
    >
      {auditoria.length?auditoria.slice(0,50).map(item=>{
        const detalhes=item.detalhes as {paciente?:string;excluida_por?:string;nome?:string}|null;
        // O nome escrito no evento vale mais que o mapa de perfis: quem
        // excluiu (ou foi excluído) pode não existir mais como perfil.
        const quem=detalhes?.excluida_por||(item.actor_id?actorNames.get(item.actor_id):null)||"Sistema";
        const sobre=detalhes?.paciente?`paciente ${detalhes.paciente}`:detalhes?.nome||item.entidade;
        return <div className="auditRow" key={item.id}><time>{new Date(item.created_at).toLocaleString("pt-BR")}</time><span><strong>{ACAO_LABELS[item.acao]??item.acao.replaceAll("_"," ")}</strong><small>{sobre} · por {quem}</small></span></div>;
      }):<div className="emptyClinical compactEmpty">Nenhum evento de auditoria registrado ainda.</div>}
    </PainelRecolhivel>
      </>}
      </div>
    </div>
  </div>;
}

// Zero de coisa ruim e boa noticia: nao pinta de vermelho nem de ambar. A cor
// aqui e para comunicar, nao para enfeitar o numero.

// Valores por convênio: configuração usada pelo Financeiro ao criar o
// lançamento, então mora na tela do Financeiro. Quem grava continua sendo
// admin ou proprietário — é o que a policy do banco permite; o financeiro
// enxerga a referência, mas não a altera.
function ConvenioValoresPanel({perfil,convenioValores,onRefresh}:{perfil:Perfil;convenioValores:ConvenioValor[];onRefresh:()=>void}) {
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const podeEditar=["admin","owner"].includes(perfil.role);
  async function saveConvenio(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy("convenio");setMessage("");
    const form=new FormData(event.currentTarget);
    const valor=Number(String(form.get("valor")||"").replace(",","."));
    if(!String(form.get("convenio")||"").trim()||!Number.isFinite(valor)||valor<0){setBusy("");setMessage("Informe convênio e um valor válido.");return}
    const {error}=await createClient().from("convenio_valores").insert({institution_id:perfil.institution_id,convenio:String(form.get("convenio")).trim(),procedimento:String(form.get("procedimento")||"").trim()||null,hospital:String(form.get("hospital")||"").trim()||null,valor,repasse_percentual:Number(String(form.get("repasse")||""))||null,ativo:true});
    setBusy("");if(error)setMessage(`Não foi possível salvar o valor: ${error.message}`);else{setMessage("Valor do convênio salvo. Os próximos lançamentos usarão esta referência.");event.currentTarget.reset();onRefresh()}
  }
  async function toggleConvenio(item:ConvenioValor){
    setBusy(item.id);const {error}=await createClient().from("convenio_valores").update({ativo:!item.ativo,updated_at:new Date().toISOString()}).eq("id",item.id);setBusy("");if(error)setMessage(`Não foi possível atualizar: ${error.message}`);else onRefresh();
  }

  return <>
    {message&&<p className={message.startsWith("Não")?"clinicalError":"financeSuccess"}>{message}</p>}
    {/* Recolhida por padrão: é configuração, consultada de vez em quando, e
        aberta ocupava a tela inteira com uma linha por convênio. */}
    <PainelRecolhivel
      className="convenioAdmin"
      chave="convenio-valores"
      abrePadrao={false}
      titulo="Valores por convênio"
      legenda={`${convenioValores.length} referência(s) cadastrada(s) · o Financeiro sugere o valor ao criar o lançamento`}
    >
      {podeEditar&&<form className="convenioForm" onSubmit={saveConvenio}><label><span>Convênio *</span><input name="convenio" required placeholder="Ex.: Unimed"/></label><label><span>Procedimento</span><input name="procedimento" placeholder="Opcional"/></label><label><span>Hospital</span><input name="hospital" placeholder="Opcional"/></label><label><span>Valor R$ *</span><input name="valor" inputMode="decimal" required placeholder="0,00"/></label><label><span>Repasse %</span><input name="repasse" inputMode="decimal" placeholder="Opcional"/></label><button className="primaryClinical compact" disabled={busy==="convenio"}>{busy==="convenio"?"Salvando...":"Salvar referência"}</button></form>}
      {convenioValores.length?convenioValores.map(item=><div className="convenioRow" key={item.id}><span><strong>{item.convenio}</strong><small>{item.procedimento||"Todos os procedimentos"} · {item.hospital||"Todos os hospitais"}{item.repasse_percentual?` · repasse ${item.repasse_percentual}%`:""}</small></span><b>{Number(item.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b><span className={`statusChip ${item.ativo?"present":"paused"}`}>{item.ativo?"ATIVO":"INATIVO"}</span>{podeEditar?<button className="outlineClinical compacto" disabled={busy===item.id} onClick={()=>toggleConvenio(item)}>{item.ativo?"Desativar":"Ativar"}</button>:<span/>}</div>):<div className="emptyClinical compactEmpty">Nenhuma referência de valor cadastrada ainda.</div>}
    </PainelRecolhivel>
  </>;
}

// `mascara` e `extra` existem para o olho que esconde os números: a função de
// mascarar vem de fora, e o botão entra no último cartão da fileira.
function Metric({ value, label, tone, mascara, extra }: { value: number; label: string; tone: string; mascara?: (t:string)=>string; extra?: React.ReactNode }) {
  const tomReal = value === 0 && ["red", "amber"].includes(tone) ? "" : tone;
  const texto = value.toLocaleString("pt-BR");
  return <div className="metricCard"><strong className={tomReal}>{mascara?mascara(texto):texto}</strong><span>{label}</span>{extra}</div>;
}
function MoneyMetric({value,label,tone,mascara,extra}:{value:number;label:string;tone:string;mascara?:(t:string)=>string;extra?:React.ReactNode}){
  const texto=value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  return <div className="metricCard"><strong className={tone}>{mascara?mascara(texto):texto}</strong><span>{label}</span>{extra}</div>}
function MoneySmall({value,label,tone=""}:{value:number;label:string;tone?:string}){return <div><strong className={tone}>{value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{label}</span></div>}
/**
 * A seta de comparação com o mês anterior.
 *
 * Um valor sozinho não diz se foi bom ou ruim; ele só vira informação ao lado
 * de uma base. Quando não há base — primeiro mês, ou mês anterior zerado — não
 * inventa: some. "Aumento de 1.000%" saindo de zero é um número sem sentido
 * ocupando o lugar mais visível da tela.
 *
 * Some também com os valores ocultos: o percentual entrega a ordem de grandeza
 * de quem está olhando por cima do ombro, e era exatamente disso que o olhinho
 * de esconder valores protege.
 */
function Variacao({atual,anterior,oculto}:{atual:number;anterior:number;oculto:boolean}){
  const pct=variacao(atual,anterior);
  if(pct===null||oculto) return null;
  const subiu=pct>=0;
  return <em className={`metricVariacao ${subiu?"subiu":"caiu"}`}>
    {subiu?"▲":"▼"} {Math.abs(pct).toFixed(0)}% vs. mês anterior
  </em>;
}
function Alert({ icone, title, text, action, danger=false, onClick }: { icone:Parameters<typeof Icone>[0]["nome"]; title:string; text:string; action:string; danger?:boolean; onClick?:()=>void }) {
  return <button type="button" className="alertItem" onClick={onClick} disabled={!onClick}>
    <i className={danger?"danger":""}><Icone nome={icone} tamanho={15}/></i>
    <span><strong>{title}</strong> — {text}</span>
    <b className={danger?"dangerText":""}>{action}</b>
  </button>;
}

function PatientModal({ busy, error, convenios, onClose, onSubmit }: { busy:boolean; error:string; convenios:string[]; onClose:()=>void; onSubmit:(e:FormEvent<HTMLFormElement>)=>void }) {
  const [convenio,setConvenio]=useState<string>(PRIVATE_PAY_CONVENIO);
  const isPrivatePay=convenio===PRIVATE_PAY_CONVENIO;
  // O formulário deixa de ser um bloco único de dezoito campos e passa a ter
  // grupos com título: o preenchimento segue a ordem natural da conversa com
  // o paciente, e o que falta fica visível sem rolar tudo.
  return <div className="patientModalBackdrop">
    <form className="patientModal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="titulo-novo-paciente">
      <div className="patientModalHead">
        <div><h2 id="titulo-novo-paciente">Novo paciente</h2><p>Cadastro, convênio, procedimento e agendamento. Campos com <b>*</b> são obrigatórios.</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar sem salvar">×</button>
      </div>

      <div className="patientModalCorpo">
        <fieldset className="modalGrupo">
          <legend>Dados do paciente</legend>
          <div className="patientFormGrid">
            <Field name="nome" label="Nome completo" wide required autoFocus/>
            <Field name="cpf" label="CPF" required mask="cpf" inputMode="numeric"/>
            <Field name="rg" label="RG"/>
            <CamposIdade/>
            <SelectField name="sexo" label="Sexo" options={["Feminino","Masculino","Outro","Não informado"]}/>
          </div>
        </fieldset>

        <fieldset className="modalGrupo">
          <legend>Contato e endereço</legend>
          <div className="patientFormGrid">
            <Field name="telefone" label="Telefone / WhatsApp" mask="telefone" inputMode="numeric" span2/>
            <Field name="email" label="E-mail" type="email" span2/>
            <Field name="endereco" label="Endereço" wide/>
            <Field name="cidade" label="Cidade" span2/>
            <Field name="uf" label="UF"/>
            <Field name="cep" label="CEP" mask="cep" inputMode="numeric"/>
          </div>
        </fieldset>

        <fieldset className="modalGrupo">
          <legend>Procedimento e hospital</legend>
          <div className="patientFormGrid">
            <Field name="hospital" label="Hospital" span2/>
            <Field name="cirurgia" label="Cirurgia" span2/>
            <Field name="especialidade" label="Especialidade" span2/>
          </div>
        </fieldset>

        <fieldset className="modalGrupo">
          <legend>Convênio</legend>
          <div className="patientFormGrid">
            <SelectField name="convenio" label="Convênio" options={convenios} value={convenio} onChange={setConvenio} span2/>
            {!isPrivatePay&&<>
              <Field name="numero_carteirinha" label="Nº da carteirinha" span2/>
              <Field name="validade" label="Validade" type="date"/>
              <Field name="plano" label="Plano" autoComplete="off" span2/>
            </>}
          </div>
          {isPrivatePay&&<p className="modalGrupoAjuda">Particular não exige carteirinha nem plano.</p>}
        </fieldset>

        <fieldset className="modalGrupo">
          <legend>Data e horário</legend>
          <div className="patientFormGrid">
            <Field name="data_consulta" label="Data da consulta" type="date" required defaultValue={localDateKey()} span2/>
            <Field name="horario" label="Horário da consulta" type="time" span2/>
            <p className="modalGrupoAjuda span2">Deixe o horário em branco para o sistema usar o próximo livre da agenda.</p>
          </div>
        </fieldset>

        <fieldset className="modalGrupo">
          <legend>Observações</legend>
          <div className="patientFormGrid"><Field name="observacoes" label="Observações" wide/></div>
        </fieldset>
      </div>

      <div className="modalActions">
        {error
          ? <p className="clinicalError modalErro" role="alert" aria-live="assertive">{error}</p>
          : <span className="saveStatus" aria-live="polite">{busy ? "Salvando no banco de dados…" : ""}</span>}
        <button type="button" className="outlineClinical" onClick={onClose}>Cancelar</button>
        <button type="submit" className="primaryClinical" disabled={busy}>{busy?"Salvando...":"Salvar paciente"}</button>
      </div>
    </form>
  </div>;
}

// Máscaras: o índice único do banco compara só os dígitos do CPF, então
// formatar aqui não interfere na checagem de paciente duplicado.
const MASCARAS: Record<string,(valor:string)=>string> = {
  cpf: (valor) => valor.replace(/\D/g,"").slice(0,11)
    .replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2"),
  telefone: (valor) => {
    const digitos = valor.replace(/\D/g,"").slice(0,11);
    if (digitos.length <= 10) return digitos.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{4})(\d)/,"$1-$2");
    return digitos.replace(/(\d{2})(\d)/,"($1) $2").replace(/(\d{5})(\d)/,"$1-$2");
  },
  cep: (valor) => valor.replace(/\D/g,"").slice(0,8).replace(/(\d{5})(\d)/,"$1-$2"),
};

/**
 * Data de nascimento e idade, lado a lado.
 *
 * Nem todo paciente chega com a data: o idoso que não lembra, a ficha de
 * internação que só traz "78 anos", o encaixe de última hora. O cadastro não
 * pode parar por causa disso — mas também não pode acabar com dois números
 * discordando um do outro.
 *
 * Por isso os dois campos são um só controle: com a data preenchida, a idade
 * aparece calculada e trancada, e vai vazia para o banco. Sem a data, a idade
 * é digitável. Quem manda depois, na hora de usar, é lib/idade.ts.
 */
function CamposIdade({nascimento:inicial="",idade:idadeInicial=""}:{nascimento?:string;idade?:string}) {
  const [nascimento,setNascimento]=useState(inicial);
  const [idade,setIdade]=useState(idadeInicial);
  const calculada=idadePorNascimento(nascimento);
  const temData=Boolean(nascimento.trim());
  return <>
    <label className="clinicalField"><span>Data de nascimento</span>
      <input name="data_nascimento" type="date" value={nascimento} onChange={e=>setNascimento(e.target.value)}/>
    </label>
    <label className="clinicalField"><span>Idade (anos)</span>
      <input
        // Sem name quando a data manda: campo desabilitado não entra no envio,
        // e assim nunca se grava uma idade que contradiz a data de nascimento.
        {...(temData?{}:{name:"idade_anos"})}
        type="number" min={0} max={130} step={1} inputMode="numeric"
        value={temData?(calculada!==null?String(calculada):""):idade}
        onChange={e=>setIdade(e.target.value)}
        disabled={temData}
        placeholder={temData?"":"Ex.: 78"}
      />
      <small className="campoNota">
        {temData
          ? (calculada!==null?"calculada pela data de nascimento":"data de nascimento inválida")
          : "preencha a data acima, ou digite a idade aqui"}
      </small>
    </label>
  </>;
}

function Field({name,label,type="text",wide=false,span2=false,required=false,defaultValue,autoComplete,mask,inputMode,autoFocus}:{name:string;label:string;type?:string;wide?:boolean;span2?:boolean;required?:boolean;defaultValue?:string;autoComplete?:string;mask?:keyof typeof MASCARAS;inputMode?:"numeric"|"text";autoFocus?:boolean}) {
  // Campo com máscara é controlado: o valor exibido é sempre o formatado,
  // sem depender de reescrever o valor dentro do evento.
  const [valor,setValor]=useState(defaultValue??"");
  const comum={name,type,required,autoComplete,inputMode,autoFocus};
  return <label className={`clinicalField ${wide?"wide":""} ${span2?"span2":""} ${required?"obrigatorio":""}`.trim()}>
    <span>{label}</span>
    {mask
      ? <input {...comum} value={valor} onChange={(evento)=>setValor(MASCARAS[mask](evento.target.value))}/>
      : <input {...comum} defaultValue={defaultValue}/>}
  </label>;
}
function SelectField({name,label,options,required=false,placeholder,value,onChange,span2=false}:{name:string;label:string;options:string[];required?:boolean;placeholder?:string;value?:string;onChange?:(value:string)=>void;span2?:boolean}) {
  const controlled=value!==undefined&&onChange!==undefined;
  return <label className={`clinicalField ${span2?"span2":""} ${required?"obrigatorio":""}`.trim()}><span>{label}</span><select
    name={name}
    required={required}
    {...(controlled?{value,onChange:(event:ChangeEvent<HTMLSelectElement>)=>onChange(event.target.value)}:{defaultValue:placeholder?"":undefined})}
  >{placeholder&&<option value="" disabled>{placeholder}</option>}{options.map(o=><option key={o}>{o}</option>)}</select></label>;
}
