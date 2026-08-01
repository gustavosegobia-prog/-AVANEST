"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { BrandMark } from "@/components/brand-mark";

export const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário", admin: "Administrador", medico: "Anestesiologista",
  recepcao: "Recepção", financeiro: "Financeiro",
};

export const PRIVATE_PAY_CONVENIO = "Particular";
export const CONVENIOS = [
  "Particular","Unimed","FUPS","SAS","CISCOMCAM","Humana Saúde","Bradesco Saúde",
  "SulAmérica","Amil","CASSI","SANEPAR","COPEL",
];

type Perfil = { id: string; institution_id: string; nome: string; role: string; permissoes?: string[] | null; status?: string; must_reset: boolean; super_admin?: boolean };
type Organizacao = { nome: string; tipo?: string | null };
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
type Avaliacao = { id: string; patient_id: string; created_by?: string | null; status: string; versao?: number; updated_at: string; created_at: string; concluida_at?: string | null; dados?: Record<string, unknown> | null };
type Agendamento = { id:string; patient_id:string; avaliacao_id:string|null; data:string; horario:string|null; status:string; hospital:string|null; procedimento:string|null; convenio:string|null; observacoes:string|null; created_at:string; updated_at:string };
type Financeiro = { id:string; institution_id:string; patient_id:string; avaliacao_id:string|null; medico_id:string|null; convenio:string; hospital:string|null; valor:number; recebido:number; status:string; nota_fiscal:string|null; nota_emitida_at?:string|null; nota_vencimento_at?:string|null; nota_reprogramada_at?:string|null; lote:string|null; data_recebimento:string|null; repasse_valor:number; repasse_status:string; glosa_valor?:number; periodo?:string|null; fechado_at?:string|null; observacoes:string|null; created_at:string };
type Pagamento = { id:string; atendimento_id:string; valor:number; metodo:string; referencia:string|null; paid_at:string };
type PerfilGerenciado = { id:string; institution_id:string; nome:string; email:string|null; role:string; status:string; crm:string|null; rqe:string|null; created_at:string; updated_at:string };
type Auditoria = { id:string; actor_id:string|null; entidade:string; entidade_id:string|null; acao:string; detalhes:Record<string,unknown>; created_at:string };
type Periodo = { id:string; periodo:string; status:string; conferido_at:string|null; fechado_at:string|null };
type ConvenioValor = { id:string; institution_id:string; convenio:string; procedimento:string|null; hospital:string|null; valor:number; repasse_percentual:number|null; ativo:boolean; created_at:string; updated_at:string };
export type DashboardView = "medico" | "recepcao" | "financeiro" | "admin";

const brDate = (date?: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
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
  perfil, organizacao = null, pacientes, avaliacoes, agendamentos, financeiro, pagamentos, perfis, auditoria, periodos, convenioValores, initialView,
  initialNewPatient = false, autoStartAssessment = false,
}: {
  perfil: Perfil; organizacao?: Organizacao | null;
  pacientes: Paciente[]; avaliacoes: Avaliacao[]; agendamentos:Agendamento[];
  financeiro:Financeiro[]; pagamentos:Pagamento[]; perfis:PerfilGerenciado[]; auditoria:Auditoria[]; periodos:Periodo[]; convenioValores:ConvenioValor[];
  initialView?: DashboardView;
  initialNewPatient?: boolean;
  autoStartAssessment?: boolean;
}) {
  const router = useRouter();
  const allowedViews = useMemo<DashboardView[]>(() => {
    const permissionOrder: DashboardView[] = ["recepcao", "medico", "financeiro", "admin"];
    const assignedPermissions = Array.isArray(perfil.permissoes) ? perfil.permissoes : [];
    if (["admin", "owner"].includes(perfil.role) || assignedPermissions.includes("todos")) return permissionOrder;
    const permittedViews = permissionOrder.filter((area) => perfil.role === area || assignedPermissions.includes(area));
    return permittedViews.length > 0 ? permittedViews : ["medico"];
  }, [perfil.role, perfil.permissoes]);
  const view = initialView && allowedViews.includes(initialView) ? initialView : allowedViews[0];
  const [isAreaPending, startAreaTransition] = useTransition();
  const [open, setOpen] = useState(initialNewPatient);
  const [search, setSearch] = useState("");
  const [agendaRange, setAgendaRange] = useState<"hoje"|"amanha"|"semana">("hoje");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState("todas");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [dark, setDark] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attendanceBusy, setAttendanceBusy] = useState("");
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string,string>>({});
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => pacientes.filter((p) => `${p.nome} ${p.cpf ?? ""} ${p.telefone ?? ""} ${p.procedimento ?? ""}`.toLowerCase().includes(search.toLowerCase())), [pacientes, search]);
  const currentByPatient = useMemo(() => {
    const result = new Map<string,Avaliacao>();
    for (const item of avaliacoes) if (!result.has(item.patient_id)) result.set(item.patient_id, item);
    return result;
  }, [avaliacoes]);
  const evaluationById = useMemo(() => new Map(avaliacoes.map((a)=>[a.id,a])), [avaliacoes]);
  const drafts = avaliacoes.filter((a) => a.status === "rascunho");
  const completed = avaliacoes.filter((a) => a.status === "concluida");
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
    const searchable = `${patient?.nome ?? ""} ${patient?.cpf ?? ""} ${patient?.procedimento ?? ""} ${patient?.hospital ?? ""} ${professional}`.toLowerCase();
    const referenceDate = (assessment.concluida_at || assessment.updated_at || assessment.created_at).slice(0, 10);
    return (historyStatus === "todas" || assessment.status === historyStatus)
      && (!historyQuery || searchable.includes(historyQuery.toLowerCase()))
      && (!historyFrom || referenceDate >= historyFrom)
      && (!historyTo || referenceDate <= historyTo);
  }).sort((a,b) => (b.concluida_at || b.updated_at || b.created_at).localeCompare(a.concluida_at || a.updated_at || a.created_at)), [avaliacoes, patientMap, professionalMap, historyQuery, historyStatus, historyFrom, historyTo]);
  const scheduledToday = agendamentos.filter((a) => a.data === today && !["cancelado","reagendado"].includes(a.status));
  const queue = scheduledToday;
  const filteredAgenda = agendamentos.filter((item) => {
    if (agendaRange === "hoje") return item.data === today;
    if (agendaRange === "amanha") return item.data === tomorrow;
    return item.data >= today && item.data <= week;
  }).filter((item) => {
    const p=patientMap.get(item.patient_id);
    return `${p?.nome??""} ${p?.cpf??""} ${p?.procedimento??""} ${item.procedimento??""}`.toLowerCase().includes(search.toLowerCase());
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
    const isPrivatePay=convenio===PRIVATE_PAY_CONVENIO;
    const planoFinal=isPrivatePay?null:plano;
    if(!isPrivatePay&&!planoFinal){
      setError("Informe o plano do paciente ou selecione o convênio Particular.");
      setBusy(false);
      return;
    }
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
      sexo: text("sexo"), telefone: phoneDigits||null, email: text("email"), endereco: text("endereco"),
      cidade: text("cidade"), uf: text("uf"), cep: text("cep"), hospital: text("hospital"),
      cirurgia: text("cirurgia"), especialidade: text("especialidade"), procedimento: text("procedimento"),
      convenio: convenio ?? PRIVATE_PAY_CONVENIO,
      numero_carteirinha: isPrivatePay?null:text("numero_carteirinha"), validade: isPrivatePay?null:text("validade"),
      plano: planoFinal, data_consulta: appointmentDate, horario: automaticTime, observacoes: text("observacoes"),
    };
    const appointmentPayload = {
      data: appointmentDate, horario: automaticTime, hospital: text("hospital"),
      procedimento: text("procedimento") || text("cirurgia"), convenio: convenio ?? PRIVATE_PAY_CONVENIO,
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
      versao:previous?.status==="concluida"?Number(previous.versao||1)+1:1,
      avaliacao_anterior_id:previous?.status==="concluida"?previous.id:null,
    }).select("id").single();
    if (createError || !data) { setError(createError?.message ?? "Falha ao iniciar avaliação."); setBusy(false); return; }
    if(appointmentId) await supabase.from("agendamentos").update({avaliacao_id:data.id,updated_at:new Date().toISOString()}).eq("id",appointmentId);
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
        <Link className="clinicalBrand" href="/"><BrandMark className="clinicalBrandMark" /><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></Link>
        <div className="orgBadge" title={organizacao?.nome ?? "Organização"}>
          <strong>{organizacao?.nome ?? "Organização"}</strong>
        </div>
        {/* Só os módulos de trabalho ficam na barra. Tema, assinatura, bloqueio
            e saída são utilidades: foram para o menu do usuário, senão nove
            controles disputam a mesma faixa e nenhum se destaca. */}
        <nav className="roleNav" aria-label="Áreas do sistema">
          {allowedViews.includes("recepcao")&&<button disabled={isAreaPending} className={view === "recepcao" ? "active" : ""} aria-current={view==="recepcao"?"page":undefined} onClick={() => changeView("recepcao")}>Recepção</button>}
          {allowedViews.includes("medico")&&<button disabled={isAreaPending} className={view === "medico" ? "active" : ""} aria-current={view==="medico"?"page":undefined} onClick={() => changeView("medico")}>Médico</button>}
          {allowedViews.includes("financeiro")&&<button disabled={isAreaPending} className={view === "financeiro" ? "active" : ""} aria-current={view==="financeiro"?"page":undefined} onClick={() => changeView("financeiro")}>Financeiro</button>}
          {allowedViews.includes("admin")&&<button disabled={isAreaPending} className={view === "admin" ? "active" : ""} aria-current={view==="admin"?"page":undefined} onClick={() => changeView("admin")}>Admin</button>}
        </nav>
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
              {/* menuitemcheckbox, nao menuitem: o item liga e desliga um estado
                  e o leitor de tela precisa anunciar qual e o atual. */}
              <button role="menuitemcheckbox" aria-checked={dark} onClick={()=>{setDark(value=>!value);setUserMenu(false)}}>
                <span aria-hidden="true">◐</span> {dark?"Tema claro":"Tema escuro"}
              </button>
              {["owner","admin"].includes(perfil.role)&&
                <Link role="menuitem" href="/assinatura" onClick={()=>setUserMenu(false)}>
                  <span aria-hidden="true">◈</span> Assinatura
                </Link>}
              {perfil.super_admin===true&&
                <Link role="menuitem" href="/organizacoes" onClick={()=>setUserMenu(false)}>
                  <span aria-hidden="true">★</span> Organizações
                </Link>}
              <hr/>
              <button role="menuitem" onClick={logout}><span aria-hidden="true">🔒</span> Bloquear tela</button>
              <button role="menuitem" className="userMenuSair" onClick={logout}>Sair da conta</button>
            </div>
          </>}
        </div>
      </header>

      {view === "medico" ? (
        <div className="clinicalMain">
          <section className="clinicalWelcome">
            <div><h1>Consultas pré-anestésicas agendadas</h1><p>Olá, {perfil.nome}. Acompanhe a fila e continue suas avaliações.</p></div>
            <button className="primaryClinical" onClick={() => setOpen(true)}>+ Nova avaliação pré-anestésica</button>
          </section>
          {error && <p className="clinicalError">{error}</p>}
          <section className="metricGrid">
            <Metric value={scheduledToday.length} label="Consultas hoje" tone="blue" />
            <Metric value={drafts.length} label="Pendências" tone="red" />
            <Metric value={completedThisMonth.length} label="Concluídas no mês" tone="green" />
            <Metric value={completed.filter(a=>a.dados?.orientacoes_enviadas!==true).length} label="Orientações pendentes" tone="amber" />
            <Metric value={asaHigh} label="Pacientes ASA III+" tone="red" />
          </section>
          <section className="clinicalPanel">
            <div className="panelTitle"><strong>Fila de atendimento — hoje</strong><span>prioridade → horário agendado → chegada → encaixes</span></div>
            {queue.length ? queue.map((appointment, index) => {
              const p=patientMap.get(appointment.patient_id); if(!p)return null;
              const a=appointment.avaliacao_id?evaluationById.get(appointment.avaliacao_id):undefined;
              const attendance=attendanceOverrides[appointment.id]??appointment.status;
              const statusLabel=a?.status==="concluida"?"CONCLUÍDA":a?.status==="rascunho"?"AVALIAÇÃO PAUSADA":attendance==="presente"?"PACIENTE PRESENTE":attendance==="faltou"?"FALTOU":"AGUARDANDO";
              const statusTone=a?.status==="concluida"||attendance==="presente"?"present":attendance==="faltou"?"danger":a?.status==="rascunho"?"paused":"waiting";
              return <div className="queueRow" key={appointment.id}>
                <time>{appointment.horario?.slice(0,5) || `${8 + index}:00`.padStart(5,"0")}</time>
                <div className="queueInfo"><strong>{p.nome}</strong><small>{appointment.procedimento || p.procedimento || p.cirurgia || "Procedimento não informado"} · {appointment.hospital || p.hospital || "Hospital não informado"}</small></div>
                <span className={`statusChip ${statusTone}`}>{statusLabel}</span>
                <button className="primaryClinical compact" disabled={busy||attendance==="faltou"} onClick={() => openAssessment(p.id,appointment.id,appointment.avaliacao_id)}>{a?.status==="concluida"?"Ver documentos":a?.status==="rascunho"?"Continuar avaliação":"Iniciar avaliação"}</button>
              </div>;
            }) : <div className="emptyClinical">Nenhuma consulta agendada para hoje.</div>}
          </section>
          <section className="clinicalPanel alertsPanel">
            <div className="panelTitle"><strong>Central Operacional</strong><span>alertas da rotina baseados nas avaliações em andamento</span></div>
            <div className="alertGrid">
              <Alert icon="△" title="Avaliações incompletas" text={`${drafts.length} avaliação(ões) aguardando conclusão`} action="REVISAR" danger onClick={goToFirstDraft} />
              <Alert icon="!" title="Medicamentos" text="Revisar anticoagulantes e GLP-1 durante a anamnese" action="AVALIAR" onClick={goToFirstDraft} />
              <Alert icon="×" title="Exames pendentes" text="Confira exames e pareceres antes da conclusão" action="PENDÊNCIA" onClick={goToFirstDraft} />
              <Alert icon="✉" title="Orientações não enviadas" text={`${completed.filter(a=>a.dados?.orientacoes_enviadas!==true).length} documento(s) aguardando envio`} action="ENVIAR" onClick={()=>completed[0]&&router.push(`/avaliacoes/${completed[0].id}/documentos`)} />
            </div>
          </section>
          <section className="clinicalPanel agendaPanel">
            <div className="agendaHead"><strong>Agenda</strong><button className={agendaRange==="hoje"?"active":""} onClick={()=>setAgendaRange("hoje")}>Hoje</button><button className={agendaRange==="amanha"?"active":""} onClick={()=>setAgendaRange("amanha")}>Amanhã</button><button className={agendaRange==="semana"?"active":""} onClick={()=>setAgendaRange("semana")}>Semana</button><input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por paciente, CPF, procedimento..." /></div>
            {filteredAgenda.slice(0,20).map((appointment) => { const p=patientMap.get(appointment.patient_id); if(!p)return null; const a=appointment.avaliacao_id?evaluationById.get(appointment.avaliacao_id):undefined; return <button className="agendaRow" key={appointment.id} onClick={() => openAssessment(p.id,appointment.id,appointment.avaliacao_id)}>
              <span className="avatar">{initials(p.nome)}</span><span><strong>{p.nome}</strong><small>{appointment.procedimento || p.procedimento || p.cirurgia || "Procedimento não informado"} · {appointment.hospital || p.hospital || "Hospital não informado"}</small></span>
              <time>{brDate(appointment.data)}</time><span className={`statusChip ${a?.status === "concluida" ? "present" : appointment.status==="faltou"?"danger":"waiting"}`}>{a?.status === "concluida" ? "CONCLUÍDA" : a?.status==="rascunho" ? "EM ANDAMENTO" : appointment.status.toUpperCase()}</span>
            </button>;})}
            {filteredAgenda.length===0&&<div className="emptyClinical compactEmpty">Nenhum agendamento neste período.</div>}
          </section>
          <section className="clinicalPanel historyPanel">
            <div className="panelTitle"><strong>Histórico de avaliações</strong><span>Encontre rascunhos e avaliações concluídas já salvas.</span></div>
            <div className="historyFilters">
              <input value={historyQuery} onChange={(event)=>setHistoryQuery(event.target.value)} placeholder="Nome, CPF, procedimento, hospital ou profissional..." />
              <select value={historyStatus} onChange={(event)=>setHistoryStatus(event.target.value)} aria-label="Filtrar por status"><option value="todas">Todos os status</option><option value="rascunho">Em andamento</option><option value="concluida">Concluída</option><option value="cancelada">Cancelada</option></select>
              <label>De<input type="date" value={historyFrom} onChange={(event)=>setHistoryFrom(event.target.value)} /></label>
              <label>Até<input type="date" value={historyTo} onChange={(event)=>setHistoryTo(event.target.value)} /></label>
            </div>
            {historicalAssessments.slice(0,50).map((assessment)=>{const patient=patientMap.get(assessment.patient_id);const date=assessment.concluida_at||assessment.updated_at||assessment.created_at;const professional=assessment.created_by?professionalMap.get(assessment.created_by):undefined;const done=assessment.status==="concluida";return <Link className="historyRow" key={assessment.id} href={done?`/avaliacoes/${assessment.id}/documentos`:`/avaliacoes/${assessment.id}`}><span className="avatar">{initials(patient?.nome||"Paciente")}</span><span><strong>{patient?.nome||"Paciente não localizado"}</strong><small>{patient?.cpf||"CPF não informado"} · {patient?.procedimento||"Procedimento não informado"}{professional?` · ${professional}`:""}</small></span><time>{new Date(date).toLocaleDateString("pt-BR")}</time><span className={`statusChip ${done?"present":assessment.status==="cancelada"?"danger":"waiting"}`}>{done?"CONCLUÍDA":assessment.status==="rascunho"?"EM ANDAMENTO":assessment.status.toUpperCase()}</span><b>{done?"Ver documentos":"Continuar"}</b></Link>;})}
            {historicalAssessments.length===0&&<div className="emptyClinical compactEmpty">Nenhuma avaliação encontrada com estes filtros.</div>}
            {historicalAssessments.length>50&&<div className="historyLimit">Mostrando as 50 avaliações mais recentes. Refine os filtros para ver uma lista menor.</div>}
          </section>
          <div className="quickLinks"><button onClick={()=>searchRef.current?.focus()}>Pesquisar paciente</button><button onClick={goToFirstDraft}>Avaliações pendentes</button><button onClick={()=>completed[0]&&router.push(`/avaliacoes/${completed[0].id}/documentos`)}>PDFs recentes</button></div>
        </div>
      ) : view === "recepcao" ? (
        <div className="clinicalMain receptionMain">
          <section><h1>Recepção</h1><p>Cadastro de pacientes e agenda — sem acesso a dados clínicos ou financeiros.</p><div className="quickLinks"><button onClick={() => setOpen(true)}>Novo paciente</button><button onClick={()=>setAgendaRange("hoje")}>Agenda de hoje</button><button onClick={()=>searchRef.current?.focus()}>Pesquisar paciente</button></div></section>
          {error&&<p className="clinicalError">{error}</p>}
          <section className="metricGrid receptionMetrics"><Metric value={scheduledToday.length} label="Consultas hoje" tone="blue"/><Metric value={agendamentos.filter(a=>a.data>=today&&!["cancelado","reagendado"].includes(a.status)).length} label="Consultas agendadas" tone="blue"/><Metric value={completedThisMonth.length} label="Concluídas no mês" tone="green"/><Metric value={scheduledToday.filter(a=>a.status==="agendado").length} label="Aguardando confirmação" tone="amber"/><Metric value={agendamentos.filter(a=>a.data.slice(0,7)===today.slice(0,7)&&["faltou","cancelado"].includes(a.status)).length} label="Faltas/canceladas" tone="red"/></section>
          <section className="clinicalPanel searchPanel"><strong>Pesquisar paciente</strong><input ref={searchRef} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Nome, parte do nome, CPF ou telefone..." /><span>O CPF também é verificado ao salvar para evitar duplicidade.</span></section>
          {search&&<section className="clinicalPanel patientSearchResults">{filtered.slice(0,10).map(p=><div className="financeSetupRow" key={p.id}><span><strong>{p.nome}</strong><small>{p.cpf||"CPF não informado"} · {p.telefone||"telefone não informado"}</small></span></div>)}</section>}
          <section className="clinicalPanel"><div className="panelTitle"><strong>Consultas de hoje</strong></div>{queue.map((appointment,index)=>{const p=patientMap.get(appointment.patient_id);if(!p)return null;const agendaStatus=attendanceOverrides[appointment.id]??appointment.status;const updating=attendanceBusy===appointment.id;return <div className="queueRow" key={appointment.id}><time>{appointment.horario?.slice(0,5)||`${8+index}:00`.padStart(5,"0")}</time><div className="queueInfo"><strong>{p.nome}</strong><small>{appointment.hospital||p.hospital||"Hospital não informado"} · {appointment.convenio||p.convenio||"Particular"}</small></div><span className={`statusChip ${agendaStatus==="presente"?"present":agendaStatus==="faltou"?"danger":"waiting"}`}>{updating?"SALVANDO...":agendaStatus==="presente"?"PACIENTE PRESENTE":agendaStatus==="faltou"?"FALTOU":agendaStatus==="confirmado"?"CONFIRMADO":"AVALIAÇÃO AGENDADA"}</span><button aria-busy={updating} disabled={updating||agendaStatus==="presente"} className="outlineClinical" onClick={()=>updateAttendance(appointment.id,"presente")}>✓ Presente</button><button aria-busy={updating} disabled={updating||agendaStatus==="faltou"} className="outlineClinical red" onClick={()=>updateAttendance(appointment.id,"faltou")}>Faltou</button></div>})}{queue.length===0&&<div className="emptyClinical compactEmpty">Nenhuma consulta agendada para hoje.</div>}</section>
        </div>
      ) : view==="financeiro" ? <FinanceView perfil={perfil} pacientes={pacientes} avaliacoes={avaliacoes} financeiro={financeiro} pagamentos={pagamentos} periodos={periodos} convenioValores={convenioValores} onRefresh={()=>router.refresh()}/>
      : <AdminView perfil={perfil} organizacao={organizacao} perfis={perfis} auditoria={auditoria} convenioValores={convenioValores} onRefresh={()=>router.refresh()}/>}

      {open && <PatientModal busy={busy} error={error} onClose={() => {
        setOpen(false);
        if(initialNewPatient) router.replace(`/dashboard?area=${view}`);
      }} onSubmit={createPatient} />}
    </main>
  );
}

function FinanceView({perfil,pacientes,avaliacoes,financeiro,pagamentos,periodos,convenioValores,onRefresh}:{perfil:Perfil;pacientes:Paciente[];avaliacoes:Avaliacao[];financeiro:Financeiro[];pagamentos:Pagamento[];periodos:Periodo[];convenioValores:ConvenioValor[];onRefresh:()=>void}) {
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [configOpen,setConfigOpen]=useState(false);
  const [priceValues,setPriceValues]=useState<Record<string,string>>({});
  const [values,setValues]=useState<Record<string,string>>({});
  const [methods,setMethods]=useState<Record<string,string>>({});
  const currentMonth=new Date().toISOString().slice(0,7);
  const [period,setPeriod]=useState(currentMonth);
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
  const groups=Object.entries(periodItems.reduce<Record<string,Financeiro[]>>((acc,item)=>{(acc[item.convenio||"Particular"]??=[]).push(item);return acc},{}));
  const lots=Object.entries(periodItems.filter(item=>item.lote).reduce<Record<string,Financeiro[]>>((acc,item)=>{(acc[item.lote as string]??=[]).push(item);return acc},{}));
  const periodState=periodos.find(item=>item.periodo===period);
  const byPlan=groups.map(([convenio,items])=>{
    const billed=items.reduce((sum,item)=>sum+Number(item.valor),0);
    const paid=items.reduce((sum,item)=>sum+Number(item.recebido),0);
    const defaultRule=convenioValores.find(rule=>rule.ativo&&rule.convenio===convenio&&!rule.procedimento&&!rule.hospital);
    return {convenio,consultas:items.length,unit:Number(defaultRule?.valor||0),valor:billed,recebido:paid,pendente:Math.max(0,billed-paid)};
  }).sort((a,b)=>b.valor-a.valor);
  const knownConvenios=Array.from(new Set([
    ...CONVENIOS,
    ...pacientes.map(item=>item.convenio).filter((item):item is string=>Boolean(item)),
    ...convenioValores.map(item=>item.convenio).filter(Boolean),
  ])).sort((a,b)=>a.localeCompare(b,"pt-BR"));
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

  return <div className="clinicalMain financeMain">
    <section className="financeHeading"><div><h1>Financeiro</h1><p>Consultas organizadas por convênio — sem acesso ao conteúdo clínico das avaliações.</p></div><div className="financeHeadingActions"><label><span>Competência</span><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>{(perfil.role==="admin"||perfil.role==="owner")&&<button className="outlineClinical" onClick={openPriceConfig}>Configurar valores das consultas</button>}</div></section>
    {message&&<p className={message.includes("não foi")?"clinicalError":"financeSuccess"}>{message}</p>}
    <section className="metricGrid financeMetrics"><Metric value={periodItems.length} label="Atendimentos no mês" tone="blue"/><MoneyMetric value={total} label="Faturado no mês" tone="blue"/><Metric value={periodItems.filter(i=>!i.nota_fiscal).length} label="Notas pendentes" tone="amber"/><MoneyMetric value={received} label="Recebido no mês" tone="green"/><Metric value={glosas.length} label="Glosas em recurso" tone="red"/></section>

    <section className="clinicalPanel billingDashboard"><div className="panelTitle"><strong>Faturamento por convênio</strong><span>Valores faturados e recebidos na competência selecionada.</span></div><div className="billingPlanTable"><table><thead><tr><th>Convênio</th><th>Consultas</th><th>Valor unitário</th><th>Faturado</th><th>Recebido</th><th>Pendente</th></tr></thead><tbody>{byPlan.map(item=><tr key={item.convenio}><td><strong>{item.convenio}</strong></td><td>{item.consultas}</td><td>{money(item.unit)}</td><td>{money(item.valor)}</td><td>{money(item.recebido)}</td><td>{money(item.pendente)}</td></tr>)}</tbody></table>{!byPlan.length&&<div className="emptyClinical compactEmpty">Os valores por convênio aparecerão após os lançamentos.</div>}</div></section>

    <section className="clinicalPanel noteAlerts"><div className="panelTitle"><strong>Notas fiscais para acompanhamento</strong><span>Alerta após 15 dias da emissão, até receber baixa financeira.</span></div>{noteAlerts.length?noteAlerts.map(item=>{const patient=patientMap.get(item.patient_id);const due=item.nota_vencimento_at||new Date(new Date(`${item.nota_emitida_at}T12:00:00`).getTime()+15*86400000).toISOString().slice(0,10);return <div className="noteAlertRow" key={item.id}><span><strong>NF {item.nota_fiscal}</strong><small>{item.convenio} · {patient?.nome||"Paciente"} · verificar pagamento desde {brDate(due)}</small></span><button className="paymentButton" disabled={busy===item.id} onClick={()=>{document.getElementById(`recebimento-${item.id}`)?.scrollIntoView({behavior:"smooth",block:"center"});setMessage("Informe o valor recebido abaixo para confirmar a baixa da nota.")}}>Dar baixa</button><button className="outlineClinical" disabled={busy===item.id} onClick={()=>reprogramNote(item)}>+15 dias</button></div>}):<div className="emptyClinical compactEmpty">Nenhuma nota vencida para acompanhamento.</div>}</section>

    {pendingPatients.length>0&&<section className="clinicalPanel"><div className="panelTitle"><strong>Atendimentos aguardando lançamento</strong><span>vindos automaticamente da recepção e agenda</span></div>{pendingPatients.slice(0,8).map(patient=><div className="financeSetupRow" key={patient.id}><span><strong>{patient.nome}</strong><small>{patient.hospital||"Hospital não informado"} · {patient.convenio||"Particular"} · {patient.data_consulta?brDate(patient.data_consulta):"sem data"}</small></span><button className="outlineClinical" disabled={busy===patient.id} onClick={()=>createBilling(patient)}>Criar lançamento</button></div>)}</section>}

    {groups.length===0?<div className="emptyClinical">Nenhum lançamento financeiro cadastrado.</div>:groups.map(([convenio,items])=><section className="clinicalPanel financeGroup" key={convenio}><div className="financeGroupHead"><strong>▣ &nbsp;{convenio}</strong><span>{items.length} atendimento(s)</span><b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b></div>{items.map(item=>{const patient=patientMap.get(item.patient_id);return <div className="financeItemRow" key={item.id}><div><strong>{patient?.nome||"Paciente"}</strong><small>{item.hospital||patient?.hospital||"Hospital não informado"} · Consulta {patient?.data_consulta?brDate(patient.data_consulta):"sem data"}</small></div><label className="inlineMoney"><span>Valor</span><input defaultValue={Number(item.valor)||""} placeholder="R$ 0,00" onBlur={e=>updateItem(item.id,{valor:Number(e.target.value.replace(",","."))||0})}/></label><select value={item.status} onChange={e=>updateItem(item.id,{status:e.target.value})}><option value="aguardando">Aguardando</option><option value="pago">Pago</option><option value="glosa">Glosa</option><option value="cancelado">Cancelado</option></select><input className="financeSmallInput" defaultValue={item.nota_fiscal??""} placeholder="Nota fiscal" onBlur={e=>updateItem(item.id,{nota_fiscal:e.target.value||null})}/><input className="financeSmallInput" type="date" defaultValue={item.nota_emitida_at??""} aria-label="Data de emissão da nota" onBlur={e=>updateItem(item.id,{nota_emitida_at:e.target.value||null})}/><input className="financeSmallInput" type="date" defaultValue={item.nota_vencimento_at??""} aria-label="Data de vencimento da nota" onBlur={e=>updateItem(item.id,{nota_vencimento_at:e.target.value||null})}/><input className="financeSmallInput" defaultValue={item.lote??""} placeholder="Lote" onBlur={e=>updateItem(item.id,{lote:e.target.value||null})}/></div>})}</section>)}

    <section className="clinicalPanel"><div className="panelTitle"><strong>📦 Lotes de cobrança</strong><span>agrupamento por convênio/hospital, sem dados clínicos</span></div>{lots.length?lots.map(([lot,items])=><div className="financeLotRow" key={lot}><strong>{lot}</strong><span>{items[0]?.convenio} · {items.length} atendimento(s)</span><b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b><span className={`statusChip ${items.every(i=>i.status==="pago")?"present":"waiting"}`}>{items.every(i=>i.status==="pago")?"PAGO":"EM ABERTO"}</span></div>):<div className="emptyClinical compactEmpty">Informe o número do lote nos atendimentos para agrupá-los aqui.</div>}</section>

    <section className="clinicalPanel"><div className="panelTitle"><strong>💳 Recebimentos</strong><span>PIX, dinheiro, cartão ou transferência; pagamentos parciais atualizam o saldo</span></div>{financeiro.map(item=>{const patient=patientMap.get(item.patient_id);const balance=Math.max(0,Number(item.valor)-Number(item.recebido));return <div className="paymentRow" id={`recebimento-${item.id}`} key={item.id}><span><strong>{patient?.nome||"Paciente"} ({item.convenio})</strong><small>Valor {money(item.valor)} · recebido {money(item.recebido)} · saldo {money(balance)}</small></span><input value={values[item.id]||""} onChange={e=>setValues(v=>({...v,[item.id]:e.target.value}))} placeholder="Valor R$"/><select value={methods[item.id]||"PIX"} onChange={e=>setMethods(v=>({...v,[item.id]:e.target.value}))}><option>PIX</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option></select><button className="paymentButton" disabled={busy===item.id||balance<=0} onClick={()=>registerPayment(item)}>Registrar pagamento</button></div>})}{financeiro.length===0&&<div className="emptyClinical compactEmpty">Crie um lançamento para registrar recebimentos.</div>}</section>

    <section className="clinicalPanel"><div className="panelTitle"><strong>🩺 Repasses aos anestesiologistas</strong><span>liberação após recebimento; valores visíveis conforme as permissões do perfil</span></div>{financeiro.filter(i=>Number(i.repasse_valor)>0).map(item=><div className="repasseRow" key={item.id}><span><strong>Profissional vinculado ao atendimento</strong><small>{item.convenio} · {patientMap.get(item.patient_id)?.nome}</small></span><b>{money(item.repasse_valor)}</b><select value={item.repasse_status} onChange={e=>updateItem(item.id,{repasse_status:e.target.value})}><option value="pendente">Repasse pendente</option><option value="aguardando_recebimento">Aguardando recebimento</option><option value="pago">Pago</option></select></div>)}{!financeiro.some(i=>Number(i.repasse_valor)>0)&&<div className="emptyClinical compactEmpty">Nenhum repasse configurado.</div>}</section>

    <section className="clinicalPanel closingPanel"><div className="panelTitle"><strong>🔒 Fechamento do período — {period.split("-").reverse().join("/")}</strong><span className={`statusChip ${periodState?.status==="conferido"?"present":"waiting"}`}>{periodState?.status?.toUpperCase()||"EM PREPARAÇÃO"}</span></div><div className="closingMetrics"><MoneySmall value={total} label="Total cobrado"/><MoneySmall value={received} label="Recebido" tone="green"/><MoneySmall value={pending} label="Pendente" tone="amber"/><MoneySmall value={glosas.reduce((s,i)=>s+Number(i.glosa_valor||0),0)} label="Glosas" tone="red"/><MoneySmall value={periodItems.reduce((s,i)=>s+(i.repasse_status==="pago"?Number(i.repasse_valor):0),0)} label="Repasses realizados" tone="blue"/></div><div className="closingFooter"><span>⚠ Revise notas, glosas e pagamentos pendentes antes da conferência.</span><button className="primaryClinical compact" disabled={busy==="period"||periodState?.status==="conferido"} onClick={confirmPeriod}>{periodState?.status==="conferido"?"Período conferido":"Confirmar conferência"}</button></div></section>
    <p className="financeFootnote">Pagamentos registrados: {pagamentos.length}. Valores exibidos são os lançamentos reais cadastrados para esta instituição.</p>
    {configOpen&&<div className="patientModalBackdrop" role="presentation"><section className="financeConfigModal" role="dialog" aria-modal="true" aria-labelledby="finance-config-title"><div className="patientModalHead"><div><strong id="finance-config-title">Configurar valores das consultas</strong><span>Os convênios cadastrados aparecem automaticamente.</span></div><button type="button" onClick={()=>setConfigOpen(false)} aria-label="Fechar">×</button></div><div className="financeConfigList">{knownConvenios.map(convenio=><label key={convenio}><span>{convenio}</span><div><b>R$</b><input inputMode="decimal" value={priceValues[convenio]??"0"} onChange={event=>setPriceValues(current=>({...current,[convenio]:event.target.value}))}/></div></label>)}</div><div className="patientModalActions"><button className="outlineClinical" type="button" onClick={()=>setConfigOpen(false)}>Cancelar</button><button className="primaryClinical compact" type="button" disabled={busy==="prices"} onClick={savePrices}>{busy==="prices"?"Salvando...":"Salvar valores"}</button></div></section></div>}
  </div>
}

function InvitePanel({perfil,organizacao,onRefresh}:{perfil:Perfil;organizacao:Organizacao|null;onRefresh:()=>void}) {
  const [convites,setConvites]=useState<Convite[]>([]);
  const [meio,setMeio]=useState<"email"|"link">("email");
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
    if(!email){setAviso("Informe o e-mail de quem será convidado.");setBusy("");return}

    if(meio==="email"){
      // O Supabase envia a mensagem e o perfil já nasce com a função escolhida.
      const nome=String(form.get("nome")??"").trim();
      if(!nome){setAviso("Informe o nome de quem será convidado.");setBusy("");return}
      const resposta=await fetch("/api/admin/users",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({nome,email,role}),
      });
      const resultado=await resposta.json().catch(()=>({}));
      setBusy("");
      if(!resposta.ok){setAviso(resultado.error??"Não foi possível enviar o convite.");return}
      formulario.reset();
      setAviso(`Convite enviado para ${email}.`);
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

  // Abre o WhatsApp com a mensagem pronta; o contato é escolhido na hora.
  function enviarWhatsApp(item:Convite){
    const papel=ROLE_LABELS[item.role]??item.role;
    const validade=new Date(item.expires_at).toLocaleDateString("pt-BR");
    const mensagem=[
      `Olá! Você foi convidado para o AVANEST — ${organizacao?.nome??"nossa organização"}, como ${papel}.`,
      "",
      `Acesse este link para criar seu acesso: ${linkDoConvite(item.token)}`,
      "",
      `O convite é válido até ${validade} e funciona apenas para o e-mail ${item.email}.`,
    ].join("\n");
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
      <strong>✉️ Convidar para {organizacao?.nome??"a organização"}</strong>
      <span>quem aceitar entra somente nesta organização, com o papel definido aqui</span>
    </div>
    <div className="inviteModeSwitch" role="tablist">
      <button type="button" role="tab" aria-selected={meio==="email"} className={meio==="email"?"active":""}
        onClick={()=>{setMeio("email");setAviso("")}}>Enviar por e-mail</button>
      <button type="button" role="tab" aria-selected={meio==="link"} className={meio==="link"?"active":""}
        onClick={()=>{setMeio("link");setAviso("")}}>Gerar link</button>
    </div>
    <form className="convenioForm" onSubmit={convidar}>
      {meio==="email"&&<label className="clinicalField span2"><span>Nome completo *</span>
        <input name="nome" required autoComplete="off" placeholder="Ex.: Dra. Helena Martins"/></label>}
      <label className="clinicalField span2"><span>E-mail do convidado *</span>
        <input name="email" type="email" required autoComplete="off" placeholder="pessoa@exemplo.com"/></label>
      <label className="clinicalField"><span>Função</span>
        <select name="role" defaultValue="medico">
          <option value="medico">Anestesiologista</option>
          <option value="recepcao">Recepção</option>
          <option value="financeiro">Financeiro</option>
          <option value="admin">Administrador</option>
        </select></label>
      {meio==="link"&&<label className="clinicalField"><span>Validade</span>
        <select name="dias" defaultValue="7">
          <option value="3">3 dias</option><option value="7">7 dias</option><option value="30">30 dias</option>
        </select></label>}
      <button className="primaryClinical compact" type="submit" disabled={busy==="novo"}>
        {busy==="novo"?"Enviando...":meio==="email"?"Enviar convite":"Gerar link"}</button>
    </form>
    {aviso&&<p className={aviso.startsWith("Convite enviado")?"financeSuccess":"clinicalError"} role="alert">{aviso}</p>}
    <p className="evalHint">{meio==="email"
      ? "O AVANEST envia um e-mail com um link para a pessoa criar a própria senha. O acesso já entra com a função escolhida."
      : "Copie o link gerado e envie por WhatsApp ou onde preferir. Ele só funciona para o e-mail informado, expira na data escolhida e pode ser cancelado a qualquer momento."}</p>
    {pendentes.length===0
      ? <div className="emptyClinical compactEmpty">Nenhum convite pendente.</div>
      : pendentes.map(item=><div className="convenioRow" key={item.id}>
          <span>
            <strong>{item.email}</strong>
            <small>{ROLE_LABELS[item.role]??item.role} · {expirado(item)?"expirado":`válido até ${new Date(item.expires_at).toLocaleDateString("pt-BR")}`}</small>
          </span>
          <button type="button" className="outlineClinical whatsappAction" onClick={()=>enviarWhatsApp(item)}>WhatsApp</button>
          <button type="button" className="outlineClinical" onClick={()=>copiar(item.token)}>
            {copiado===item.token?"Link copiado ✓":"Copiar link"}</button>
          <button type="button" className="outlineClinical" disabled={busy===item.id} onClick={()=>revogar(item.id)}>
            {busy===item.id?"Cancelando...":"Cancelar"}</button>
        </div>)}
  </section>;
}

function AdminView({perfil,organizacao,perfis,auditoria,convenioValores,onRefresh}:{perfil:Perfil;organizacao:Organizacao|null;perfis:PerfilGerenciado[];auditoria:Auditoria[];convenioValores:ConvenioValor[];onRefresh:()=>void}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
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

  return <div className="clinicalMain adminMain">
    <section><h1>Administração</h1><p>Gerencie usuários, permissões profissionais e acompanhe ações importantes do sistema.</p></section>
    {message&&<p className={message.startsWith("Não")?"clinicalError":"financeSuccess"}>{message}</p>}
    <InvitePanel perfil={perfil} organizacao={organizacao} onRefresh={onRefresh}/>
    <section className="metricGrid adminMetrics"><Metric value={perfis.filter(item=>item.status==="ativo").length} label="Usuários ativos" tone="green"/><Metric value={perfis.filter(item=>item.role==="medico").length} label="Médicos" tone="blue"/><Metric value={perfis.filter(item=>item.status==="inativo").length} label="Acessos inativos" tone="red"/><Metric value={auditoria.length} label="Eventos recentes" tone="amber"/></section>
    <section className="clinicalPanel adminUsers">
      <div className="panelTitle"><strong>Usuários e permissões</strong><span>Alterações ficam registradas na auditoria.</span></div>
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
                <small>{source.email||"sem e-mail"}{source.crm?` · ${source.crm}`:""}</small>
              </span>
              <span className="statusChip paused">{ROLE_LABELS[source.role]??source.role}</span>
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
    <section className="clinicalPanel convenioAdmin">
      <div className="panelTitle"><strong>Gestão de valores por convênio</strong><span>Defina referência por procedimento e/ou hospital. O Financeiro sugere o valor ao criar o lançamento.</span></div>
      <form className="convenioForm" onSubmit={saveConvenio}><label><span>Convênio *</span><input name="convenio" required placeholder="Ex.: Unimed"/></label><label><span>Procedimento</span><input name="procedimento" placeholder="Opcional"/></label><label><span>Hospital</span><input name="hospital" placeholder="Opcional"/></label><label><span>Valor R$ *</span><input name="valor" inputMode="decimal" required placeholder="0,00"/></label><label><span>Repasse %</span><input name="repasse" inputMode="decimal" placeholder="Opcional"/></label><button className="primaryClinical compact" disabled={busy==="convenio"}>{busy==="convenio"?"Salvando...":"Salvar referência"}</button></form>
      {convenioValores.length?convenioValores.map(item=><div className="convenioRow" key={item.id}><span><strong>{item.convenio}</strong><small>{item.procedimento||"Todos os procedimentos"} · {item.hospital||"Todos os hospitais"}{item.repasse_percentual?` · repasse ${item.repasse_percentual}%`:""}</small></span><b>{Number(item.valor).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b><span className={`statusChip ${item.ativo?"present":"paused"}`}>{item.ativo?"ATIVO":"INATIVO"}</span><button className="outlineClinical" disabled={busy===item.id} onClick={()=>toggleConvenio(item)}>{item.ativo?"Desativar":"Ativar"}</button></div>):<div className="emptyClinical compactEmpty">Nenhuma referência de valor cadastrada ainda.</div>}
    </section>
    <section className="clinicalPanel auditPanel">
      <div className="panelTitle"><strong>Auditoria recente</strong><span>Conclusões, pagamentos, presenças e mudanças de acesso.</span></div>
      {auditoria.length?auditoria.slice(0,50).map(item=><div className="auditRow" key={item.id}><time>{new Date(item.created_at).toLocaleString("pt-BR")}</time><span><strong>{item.acao.replaceAll("_"," ")}</strong><small>{item.entidade} · {item.actor_id?actorNames.get(item.actor_id)||"Usuário":"Sistema"}</small></span></div>):<div className="emptyClinical compactEmpty">Nenhum evento de auditoria registrado ainda.</div>}
    </section>
  </div>;
}

// Zero de coisa ruim e boa noticia: nao pinta de vermelho nem de ambar. A cor
// aqui e para comunicar, nao para enfeitar o numero.
function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  const tomReal = value === 0 && ["red", "amber"].includes(tone) ? "" : tone;
  return <div className="metricCard"><strong className={tomReal}>{value.toLocaleString("pt-BR")}</strong><span>{label}</span></div>;
}
function MoneyMetric({value,label,tone}:{value:number;label:string;tone:string}){return <div className="metricCard"><strong className={tone}>{value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{label}</span></div>}
function MoneySmall({value,label,tone=""}:{value:number;label:string;tone?:string}){return <div><strong className={tone}>{value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{label}</span></div>}
function Alert({ icon, title, text, action, danger=false, onClick }: { icon:string; title:string; text:string; action:string; danger?:boolean; onClick?:()=>void }) { return <button type="button" className="alertItem" onClick={onClick} disabled={!onClick}><i className={danger?"danger":""}>{icon}</i><span><strong>{title}</strong> — {text}</span><b className={danger?"dangerText":""}>{action}</b></button>; }

function PatientModal({ busy, error, onClose, onSubmit }: { busy:boolean; error:string; onClose:()=>void; onSubmit:(e:FormEvent<HTMLFormElement>)=>void }) {
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
            <Field name="data_nascimento" label="Data de nascimento" type="date"/>
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
            <Field name="procedimento" label="Procedimento" wide/>
          </div>
        </fieldset>

        <fieldset className="modalGrupo">
          <legend>Convênio</legend>
          <div className="patientFormGrid">
            <SelectField name="convenio" label="Convênio" options={CONVENIOS} value={convenio} onChange={setConvenio} span2/>
            {!isPrivatePay&&<>
              <Field name="numero_carteirinha" label="Nº da carteirinha" span2/>
              <Field name="validade" label="Validade" type="date"/>
              <Field name="plano" label="Plano" required autoComplete="off" span2/>
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
