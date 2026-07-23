"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { BrandMark } from "@/components/brand-mark";

type Perfil = { id: string; institution_id: string; nome: string; role: string; status?: string; must_reset: boolean };
type Paciente = {
  id: string; nome: string; cpf: string | null; rg?: string | null; data_nascimento: string | null;
  sexo?: string | null; telefone: string | null; email: string | null; endereco?: string | null;
  cidade?: string | null; uf?: string | null; cep?: string | null; hospital?: string | null;
  cirurgia?: string | null; especialidade?: string | null; procedimento?: string | null;
  convenio?: string | null; numero_carteirinha?: string | null; validade?: string | null;
  plano?: string | null; data_consulta?: string | null; horario?: string | null;
  observacoes?: string | null; created_at: string;
};
type Avaliacao = { id: string; patient_id: string; status: string; versao?: number; updated_at: string; created_at: string; dados?: Record<string, unknown> | null };
type Agendamento = { id:string; patient_id:string; avaliacao_id:string|null; data:string; horario:string|null; status:string; hospital:string|null; procedimento:string|null; convenio:string|null; observacoes:string|null; created_at:string; updated_at:string };
type Financeiro = { id:string; institution_id:string; patient_id:string; avaliacao_id:string|null; medico_id:string|null; convenio:string; hospital:string|null; valor:number; recebido:number; status:string; nota_fiscal:string|null; lote:string|null; data_recebimento:string|null; repasse_valor:number; repasse_status:string; glosa_valor?:number; periodo?:string|null; fechado_at?:string|null; observacoes:string|null; created_at:string };
type Pagamento = { id:string; atendimento_id:string; valor:number; metodo:string; referencia:string|null; paid_at:string };
type PerfilGerenciado = { id:string; institution_id:string; nome:string; email:string|null; role:string; status:string; crm:string|null; rqe:string|null; created_at:string; updated_at:string };
type Auditoria = { id:string; actor_id:string|null; entidade:string; entidade_id:string|null; acao:string; detalhes:Record<string,unknown>; created_at:string };
type Periodo = { id:string; periodo:string; status:string; conferido_at:string|null; fechado_at:string|null };
type View = "medico" | "recepcao" | "financeiro" | "admin";

const brDate = (date?: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function DashboardClient({
  perfil, pacientes, avaliacoes, agendamentos, financeiro, pagamentos, perfis, auditoria, periodos,
}: {
  perfil: Perfil; pacientes: Paciente[]; avaliacoes: Avaliacao[]; agendamentos:Agendamento[];
  financeiro:Financeiro[]; pagamentos:Pagamento[]; perfis:PerfilGerenciado[]; auditoria:Auditoria[]; periodos:Periodo[];
}) {
  const router = useRouter();
  const allowedViews = useMemo<View[]>(() => {
    if (perfil.role === "recepcao") return ["recepcao"];
    if (perfil.role === "medico") return ["medico"];
    if (perfil.role === "financeiro") return ["financeiro"];
    if (perfil.role === "admin" || perfil.role === "owner") return ["recepcao","medico","financeiro","admin"];
    return ["medico"];
  }, [perfil.role]);
  const [view, setView] = useState<View>(allowedViews[0]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [agendaRange, setAgendaRange] = useState<"hoje"|"amanha"|"semana">("hoje");
  const [dark, setDark] = useState(false);
  const [busy, setBusy] = useState(false);
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
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate()+1);
  const tomorrow = tomorrowDate.toISOString().slice(0,10);
  const weekLimit = new Date(); weekLimit.setDate(weekLimit.getDate()+7);
  const week = weekLimit.toISOString().slice(0,10);
  const patientMap = useMemo(() => new Map(pacientes.map((p)=>[p.id,p])), [pacientes]);
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
    const fd = new FormData(event.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim() || null;
    const birthDate=text("data_nascimento");
    const cpfDigits=String(text("cpf")??"").replace(/\D/g,"");
    const phoneDigits=String(text("telefone")??"").replace(/\D/g,"");
    if(cpfDigits && cpfDigits.length!==11){
      setError("Informe um CPF com 11 números.");
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
    const supabase = createClient();
    if(cpfDigits){
      const {data:duplicate}=await supabase.from("pacientes").select("id,nome").eq("cpf",cpfDigits).maybeSingle();
      if(duplicate){
        setError(`Já existe um paciente com este CPF: ${duplicate.nome}.`);
        setBusy(false);
        return;
      }
    }
    const { data:created, error: insertError } = await supabase.from("pacientes").insert({
      institution_id: perfil.institution_id, created_by: perfil.id,
      nome: text("nome"), cpf: cpfDigits||null, rg: text("rg"), data_nascimento: birthDate,
      sexo: text("sexo"), telefone: phoneDigits||null, email: text("email"), endereco: text("endereco"),
      cidade: text("cidade"), uf: text("uf"), cep: text("cep"), hospital: text("hospital"),
      cirurgia: text("cirurgia"), especialidade: text("especialidade"), procedimento: text("procedimento"),
      convenio: text("convenio"), numero_carteirinha: text("numero_carteirinha"), validade: text("validade"),
      plano: text("plano"), data_consulta: text("data_consulta"), horario: text("horario"), observacoes: text("observacoes"),
    }).select("id").single();
    if (insertError) { setError(`Não foi possível salvar: ${insertError.message}`); setBusy(false); return; }
    const appointmentDate=text("data_consulta");
    if(created && appointmentDate){
      const {error:agendaError}=await supabase.from("agendamentos").insert({
        institution_id:perfil.institution_id,patient_id:created.id,data:appointmentDate,horario:text("horario"),
        hospital:text("hospital"),procedimento:text("procedimento")||text("cirurgia"),convenio:text("convenio"),
        observacoes:text("observacoes"),created_by:perfil.id,
      });
      if(agendaError){
        setError(`Paciente salvo, mas o agendamento não foi criado: ${agendaError.message}`);
        setBusy(false);
        return;
      }
    }
    setOpen(false); setBusy(false); router.refresh();
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
    setBusy(true); setError("");
    const supabase=createClient();
    const result=await supabase.rpc("registrar_presenca",{p_agendamento_id:appointmentId,p_status:agendaStatus});
    setBusy(false);
    if(result.error)setError(`Não foi possível atualizar a presença: ${result.error.message}`);
    else router.refresh();
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login"); router.refresh();
  }

  const firstDraft=drafts[0];
  const goToFirstDraft=()=>firstDraft&&router.push(`/avaliacoes/${firstDraft.id}`);

  return (
    <main className={`clinicalShell ${dark?"clinicalDark":""}`}>
      <header className="clinicalTopbar">
        <Link className="clinicalBrand" href="/"><BrandMark className="clinicalBrandMark" /><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></Link>
        <nav className="roleNav" aria-label="Áreas do sistema">
          <button className="themePill" onClick={()=>setDark(value=>!value)} aria-pressed={dark}>◐ {dark?"Claro":"Escuro"}</button>
          {allowedViews.includes("recepcao")&&<button className={view === "recepcao" ? "active" : ""} onClick={() => setView("recepcao")}>Recepção</button>}
          {allowedViews.includes("medico")&&<button className={view === "medico" ? "active" : ""} onClick={() => setView("medico")}>Médico</button>}
          {allowedViews.includes("financeiro")&&<button className={view === "financeiro" ? "active" : ""} onClick={() => setView("financeiro")}>Financeiro</button>}
          {allowedViews.includes("admin")&&<button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>Admin</button>}
          <span className="roleBadge">{perfil.role === "owner" ? "ADMINISTRADOR" : perfil.role.toUpperCase()}</span>
          <button onClick={logout}>🔒 Bloquear</button><button onClick={logout}>Sair</button>
        </nav>
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
              const attendance=appointment.status;
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
          <div className="quickLinks"><button onClick={() => setOpen(true)}>+ Nova avaliação</button><button onClick={()=>searchRef.current?.focus()}>Pesquisar paciente</button><button onClick={goToFirstDraft}>Avaliações pendentes</button><button onClick={()=>completed[0]&&router.push(`/avaliacoes/${completed[0].id}/documentos`)}>PDFs recentes</button></div>
        </div>
      ) : view === "recepcao" ? (
        <div className="clinicalMain receptionMain">
          <section><h1>Recepção</h1><p>Cadastro de pacientes e agenda — sem acesso a dados clínicos ou financeiros.</p><div className="quickLinks"><button onClick={() => setOpen(true)}>Novo paciente</button><button onClick={()=>setAgendaRange("hoje")}>Agenda de hoje</button><button onClick={()=>searchRef.current?.focus()}>Pesquisar paciente</button></div></section>
          {error&&<p className="clinicalError">{error}</p>}
          <section className="metricGrid receptionMetrics"><Metric value={scheduledToday.length} label="Consultas hoje" tone="blue"/><Metric value={agendamentos.filter(a=>a.data>=today&&!["cancelado","reagendado"].includes(a.status)).length} label="Consultas agendadas" tone="blue"/><Metric value={completedThisMonth.length} label="Concluídas no mês" tone="green"/><Metric value={scheduledToday.filter(a=>a.status==="agendado").length} label="Aguardando confirmação" tone="amber"/><Metric value={agendamentos.filter(a=>a.data.slice(0,7)===today.slice(0,7)&&["faltou","cancelado"].includes(a.status)).length} label="Faltas/canceladas" tone="red"/></section>
          <section className="clinicalPanel searchPanel"><strong>Pesquisar paciente</strong><input ref={searchRef} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Nome, parte do nome, CPF ou telefone..." /><span>O CPF também é verificado ao salvar para evitar duplicidade.</span></section>
          {search&&<section className="clinicalPanel patientSearchResults">{filtered.slice(0,10).map(p=><div className="financeSetupRow" key={p.id}><span><strong>{p.nome}</strong><small>{p.cpf||"CPF não informado"} · {p.telefone||"telefone não informado"}</small></span></div>)}</section>}
          <section className="clinicalPanel"><div className="panelTitle"><strong>Consultas de hoje</strong></div>{queue.map((appointment,index)=>{const p=patientMap.get(appointment.patient_id);if(!p)return null;const agendaStatus=appointment.status;return <div className="queueRow" key={appointment.id}><time>{appointment.horario?.slice(0,5)||`${8+index}:00`.padStart(5,"0")}</time><div className="queueInfo"><strong>{p.nome}</strong><small>{appointment.hospital||p.hospital||"Hospital não informado"} · {appointment.convenio||p.convenio||"Particular"}</small></div><span className={`statusChip ${agendaStatus==="presente"?"present":agendaStatus==="faltou"?"danger":"waiting"}`}>{agendaStatus==="presente"?"PACIENTE PRESENTE":agendaStatus==="faltou"?"FALTOU":agendaStatus==="confirmado"?"CONFIRMADO":"AVALIAÇÃO AGENDADA"}</span><button disabled={busy||agendaStatus==="presente"} className="outlineClinical" onClick={()=>updateAttendance(appointment.id,"presente")}>✓ Presente</button><button disabled={busy||agendaStatus==="faltou"} className="outlineClinical red" onClick={()=>updateAttendance(appointment.id,"faltou")}>Faltou</button></div>})}{queue.length===0&&<div className="emptyClinical compactEmpty">Nenhuma consulta agendada para hoje.</div>}</section>
          <section className="clinicalPanel inlineRegistration"><div className="panelTitle"><strong>Novo paciente</strong></div><p>Use o cadastro completo para incluir dados pessoais, convênio, cirurgia e agendamento.</p><button className="primaryClinical" onClick={()=>setOpen(true)}>Abrir cadastro completo</button></section>
        </div>
      ) : view==="financeiro" ? <FinanceView perfil={perfil} pacientes={pacientes} avaliacoes={avaliacoes} financeiro={financeiro} pagamentos={pagamentos} periodos={periodos} onRefresh={()=>router.refresh()}/>
      : <AdminView perfil={perfil} perfis={perfis} auditoria={auditoria} onRefresh={()=>router.refresh()}/>}

      {open && <PatientModal busy={busy} error={error} onClose={() => setOpen(false)} onSubmit={createPatient} />}
    </main>
  );
}

function FinanceView({perfil,pacientes,avaliacoes,financeiro,pagamentos,periodos,onRefresh}:{perfil:Perfil;pacientes:Paciente[];avaliacoes:Avaliacao[];financeiro:Financeiro[];pagamentos:Pagamento[];periodos:Periodo[];onRefresh:()=>void}) {
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [values,setValues]=useState<Record<string,string>>({});
  const [methods,setMethods]=useState<Record<string,string>>({});
  const currentMonth=new Date().toISOString().slice(0,7);
  const [period,setPeriod]=useState(currentMonth);
  const patientMap=new Map(pacientes.map(p=>[p.id,p]));
  const evaluationMap=new Map<string,Avaliacao>();
  for(const item of avaliacoes)if(!evaluationMap.has(item.patient_id))evaluationMap.set(item.patient_id,item);
  const billedPatients=new Set(financeiro.map(item=>item.patient_id));
  const pendingPatients=pacientes.filter(p=>!billedPatients.has(p.id));
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

  async function createBilling(patient:Paciente) {
    setBusy(patient.id); setMessage("");
    const evaluation=evaluationMap.get(patient.id);
    const {error}=await createClient().from("financeiro_atendimentos").insert({
      institution_id:perfil.institution_id,patient_id:patient.id,avaliacao_id:evaluation?.id??null,
      convenio:patient.convenio||"Particular",hospital:patient.hospital||null,valor:0,status:"aguardando",
      periodo:patient.data_consulta?.slice(0,7)||currentMonth,
    });
    setBusy(""); if(error)setMessage(`Não foi possível criar o lançamento: ${error.message}`);else{setMessage("Lançamento criado. Informe o valor e os dados de cobrança.");onRefresh()}
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

  return <div className="clinicalMain financeMain">
    <section className="financeHeading"><div><h1>Financeiro</h1><p>Consultas organizadas por convênio — sem acesso ao conteúdo clínico das avaliações.</p></div><label><span>Competência</span><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label></section>
    {message&&<p className={message.includes("não foi")?"clinicalError":"financeSuccess"}>{message}</p>}
    <section className="metricGrid financeMetrics"><Metric value={periodItems.length} label="Atendimentos no mês" tone="blue"/><Metric value={periodItems.filter(i=>!i.nota_fiscal).length} label="Notas pendentes" tone="amber"/><MoneyMetric value={received} label="Recebido no mês" tone="green"/><Metric value={glosas.length} label="Glosas em recurso" tone="red"/></section>

    {pendingPatients.length>0&&<section className="clinicalPanel"><div className="panelTitle"><strong>Atendimentos aguardando lançamento</strong><span>vindos automaticamente da recepção e agenda</span></div>{pendingPatients.slice(0,8).map(patient=><div className="financeSetupRow" key={patient.id}><span><strong>{patient.nome}</strong><small>{patient.hospital||"Hospital não informado"} · {patient.convenio||"Particular"} · {patient.data_consulta?brDate(patient.data_consulta):"sem data"}</small></span><button className="outlineClinical" disabled={busy===patient.id} onClick={()=>createBilling(patient)}>Criar lançamento</button></div>)}</section>}

    {groups.length===0?<div className="emptyClinical">Nenhum lançamento financeiro cadastrado.</div>:groups.map(([convenio,items])=><section className="clinicalPanel financeGroup" key={convenio}><div className="financeGroupHead"><strong>▣ &nbsp;{convenio}</strong><span>{items.length} atendimento(s)</span><b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b></div>{items.map(item=>{const patient=patientMap.get(item.patient_id);return <div className="financeItemRow" key={item.id}><div><strong>{patient?.nome||"Paciente"}</strong><small>{item.hospital||patient?.hospital||"Hospital não informado"} · Consulta {patient?.data_consulta?brDate(patient.data_consulta):"sem data"}</small></div><label className="inlineMoney"><span>Valor</span><input defaultValue={Number(item.valor)||""} placeholder="R$ 0,00" onBlur={e=>updateItem(item.id,{valor:Number(e.target.value.replace(",","."))||0})}/></label><select value={item.status} onChange={e=>updateItem(item.id,{status:e.target.value})}><option value="aguardando">Aguardando</option><option value="pago">Pago</option><option value="glosa">Glosa</option><option value="cancelado">Cancelado</option></select><input className="financeSmallInput" defaultValue={item.nota_fiscal??""} placeholder="Nota fiscal" onBlur={e=>updateItem(item.id,{nota_fiscal:e.target.value||null})}/><input className="financeSmallInput" defaultValue={item.lote??""} placeholder="Lote" onBlur={e=>updateItem(item.id,{lote:e.target.value||null})}/></div>})}</section>)}

    <section className="clinicalPanel"><div className="panelTitle"><strong>📦 Lotes de cobrança</strong><span>agrupamento por convênio/hospital, sem dados clínicos</span></div>{lots.length?lots.map(([lot,items])=><div className="financeLotRow" key={lot}><strong>{lot}</strong><span>{items[0]?.convenio} · {items.length} atendimento(s)</span><b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b><span className={`statusChip ${items.every(i=>i.status==="pago")?"present":"waiting"}`}>{items.every(i=>i.status==="pago")?"PAGO":"EM ABERTO"}</span></div>):<div className="emptyClinical compactEmpty">Informe o número do lote nos atendimentos para agrupá-los aqui.</div>}</section>

    <section className="clinicalPanel"><div className="panelTitle"><strong>💳 Recebimentos</strong><span>PIX, dinheiro, cartão ou transferência; pagamentos parciais atualizam o saldo</span></div>{financeiro.map(item=>{const patient=patientMap.get(item.patient_id);const balance=Math.max(0,Number(item.valor)-Number(item.recebido));return <div className="paymentRow" key={item.id}><span><strong>{patient?.nome||"Paciente"} ({item.convenio})</strong><small>Valor {money(item.valor)} · recebido {money(item.recebido)} · saldo {money(balance)}</small></span><input value={values[item.id]||""} onChange={e=>setValues(v=>({...v,[item.id]:e.target.value}))} placeholder="Valor R$"/><select value={methods[item.id]||"PIX"} onChange={e=>setMethods(v=>({...v,[item.id]:e.target.value}))}><option>PIX</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option></select><button className="paymentButton" disabled={busy===item.id||balance<=0} onClick={()=>registerPayment(item)}>Registrar pagamento</button></div>})}{financeiro.length===0&&<div className="emptyClinical compactEmpty">Crie um lançamento para registrar recebimentos.</div>}</section>

    <section className="clinicalPanel"><div className="panelTitle"><strong>🩺 Repasses aos anestesiologistas</strong><span>liberação após recebimento; valores visíveis conforme as permissões do perfil</span></div>{financeiro.filter(i=>Number(i.repasse_valor)>0).map(item=><div className="repasseRow" key={item.id}><span><strong>Profissional vinculado ao atendimento</strong><small>{item.convenio} · {patientMap.get(item.patient_id)?.nome}</small></span><b>{money(item.repasse_valor)}</b><select value={item.repasse_status} onChange={e=>updateItem(item.id,{repasse_status:e.target.value})}><option value="pendente">Repasse pendente</option><option value="aguardando_recebimento">Aguardando recebimento</option><option value="pago">Pago</option></select></div>)}{!financeiro.some(i=>Number(i.repasse_valor)>0)&&<div className="emptyClinical compactEmpty">Nenhum repasse configurado.</div>}</section>

    <section className="clinicalPanel closingPanel"><div className="panelTitle"><strong>🔒 Fechamento do período — {period.split("-").reverse().join("/")}</strong><span className={`statusChip ${periodState?.status==="conferido"?"present":"waiting"}`}>{periodState?.status?.toUpperCase()||"EM PREPARAÇÃO"}</span></div><div className="closingMetrics"><MoneySmall value={total} label="Total cobrado"/><MoneySmall value={received} label="Recebido" tone="green"/><MoneySmall value={pending} label="Pendente" tone="amber"/><MoneySmall value={glosas.reduce((s,i)=>s+Number(i.glosa_valor||0),0)} label="Glosas" tone="red"/><MoneySmall value={periodItems.reduce((s,i)=>s+(i.repasse_status==="pago"?Number(i.repasse_valor):0),0)} label="Repasses realizados" tone="blue"/></div><div className="closingFooter"><span>⚠ Revise notas, glosas e pagamentos pendentes antes da conferência.</span><button className="primaryClinical compact" disabled={busy==="period"||periodState?.status==="conferido"} onClick={confirmPeriod}>{periodState?.status==="conferido"?"Período conferido":"Confirmar conferência"}</button></div></section>
    <p className="financeFootnote">Pagamentos registrados: {pagamentos.length}. Valores exibidos são os lançamentos reais cadastrados para esta instituição.</p>
  </div>
}

function AdminView({perfil,perfis,auditoria,onRefresh}:{perfil:Perfil;perfis:PerfilGerenciado[];auditoria:Auditoria[];onRefresh:()=>void}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState("");
  const [editing,setEditing]=useState<Record<string,PerfilGerenciado>>(()=>Object.fromEntries(perfis.map(item=>[item.id,{...item}])));
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

  async function invite(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy("invite");setMessage("");
    const form=new FormData(event.currentTarget);
    const response=await fetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      nome:String(form.get("nome")||"").trim(),email:String(form.get("email")||"").trim(),
      role:String(form.get("role")||"recepcao"),
    })});
    const result=await response.json().catch(()=>({error:"Resposta inválida do servidor."}));
    setBusy("");
    if(!response.ok)setMessage(result.error||"Não foi possível convidar o usuário.");
    else{setMessage("Convite enviado. O novo usuário receberá um link para definir a senha.");event.currentTarget.reset();onRefresh()}
  }

  return <div className="clinicalMain adminMain">
    <section><h1>Administração</h1><p>Gerencie usuários, permissões profissionais e acompanhe ações importantes do sistema.</p></section>
    {message&&<p className={message.startsWith("Não")?"clinicalError":"financeSuccess"}>{message}</p>}
    <section className="metricGrid adminMetrics"><Metric value={perfis.filter(item=>item.status==="ativo").length} label="Usuários ativos" tone="green"/><Metric value={perfis.filter(item=>item.role==="medico").length} label="Médicos" tone="blue"/><Metric value={perfis.filter(item=>item.status==="inativo").length} label="Acessos inativos" tone="red"/><Metric value={auditoria.length} label="Eventos recentes" tone="amber"/></section>
    <section className="clinicalPanel adminInvite">
      <div className="panelTitle"><strong>Adicionar novo acesso</strong><span>O usuário receberá um e-mail para criar a própria senha.</span></div>
      <form onSubmit={invite}>
        <label><span>Nome completo</span><input name="nome" required/></label>
        <label><span>E-mail</span><input name="email" type="email" required/></label>
        <label><span>Área de acesso</span><select name="role" defaultValue="recepcao"><option value="recepcao">Recepção</option><option value="medico">Médico</option><option value="financeiro">Financeiro</option><option value="admin">Administrador</option></select></label>
        <button className="primaryClinical compact" disabled={busy==="invite"}>{busy==="invite"?"Enviando...":"Enviar convite"}</button>
      </form>
    </section>
    <section className="clinicalPanel adminUsers">
      <div className="panelTitle"><strong>Usuários e permissões</strong><span>Alterações ficam registradas na auditoria.</span></div>
      {perfis.map(source=>{
        const item=editing[source.id]||source;
        const setItem=(changes:Partial<PerfilGerenciado>)=>setEditing(state=>({...state,[source.id]:{...item,...changes}}));
        return <div className="adminUserRow" key={source.id}>
          <label><span>Nome</span><input value={item.nome} onChange={e=>setItem({nome:e.target.value})}/></label>
          <label><span>E-mail</span><input value={item.email||""} readOnly/></label>
          <label><span>Perfil</span><select value={item.role} disabled={source.role==="owner"&&perfil.role!=="owner"} onChange={e=>setItem({role:e.target.value})}><option value="recepcao">Recepção</option><option value="medico">Médico</option><option value="financeiro">Financeiro</option><option value="admin">Administrador</option>{perfil.role==="owner"&&<option value="owner">Proprietário</option>}</select></label>
          <label><span>Status</span><select value={item.status} disabled={source.id===perfil.id} onChange={e=>setItem({status:e.target.value})}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
          <label><span>CRM / UF</span><input value={item.crm||""} onChange={e=>setItem({crm:e.target.value})} placeholder="Somente médico"/></label>
          <label><span>RQE</span><input value={item.rqe||""} onChange={e=>setItem({rqe:e.target.value})} placeholder="Opcional"/></label>
          <button className="outlineClinical" disabled={busy===item.id} onClick={()=>saveProfile(item)}>{busy===item.id?"Salvando...":"Salvar"}</button>
        </div>;
      })}
    </section>
    <section className="clinicalPanel auditPanel">
      <div className="panelTitle"><strong>Auditoria recente</strong><span>Conclusões, pagamentos, presenças e mudanças de acesso.</span></div>
      {auditoria.length?auditoria.slice(0,50).map(item=><div className="auditRow" key={item.id}><time>{new Date(item.created_at).toLocaleString("pt-BR")}</time><span><strong>{item.acao.replaceAll("_"," ")}</strong><small>{item.entidade} · {item.actor_id?actorNames.get(item.actor_id)||"Usuário":"Sistema"}</small></span></div>):<div className="emptyClinical compactEmpty">Nenhum evento de auditoria registrado ainda.</div>}
    </section>
  </div>;
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) { return <div className="metricCard"><strong className={tone}>{value}</strong><span>{label}</span></div>; }
function MoneyMetric({value,label,tone}:{value:number;label:string;tone:string}){return <div className="metricCard"><strong className={tone}>{value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{label}</span></div>}
function MoneySmall({value,label,tone=""}:{value:number;label:string;tone?:string}){return <div><strong className={tone}>{value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{label}</span></div>}
function Alert({ icon, title, text, action, danger=false, onClick }: { icon:string; title:string; text:string; action:string; danger?:boolean; onClick?:()=>void }) { return <button type="button" className="alertItem" onClick={onClick} disabled={!onClick}><i className={danger?"danger":""}>{icon}</i><span><strong>{title}</strong> — {text}</span><b className={danger?"dangerText":""}>{action}</b></button>; }

function PatientModal({ busy, error, onClose, onSubmit }: { busy:boolean; error:string; onClose:()=>void; onSubmit:(e:FormEvent<HTMLFormElement>)=>void }) {
  return <div className="patientModalBackdrop"><form className="patientModal" onSubmit={onSubmit}>
    <div className="patientModalHead"><div><h2>Novo paciente</h2><p>Cadastro, convênio, procedimento e agendamento.</p></div><button type="button" onClick={onClose}>×</button></div>
    <div className="insuranceBar"><strong>Convênios/planos:</strong> Unimed · FUPS · SAS · CISCOMCAM · Humana Saúde · Bradesco Saúde · SulAmérica · Amil · Particular</div>
    <div className="patientFormGrid">
      <Field name="nome" label="Nome completo *" wide required/><Field name="cpf" label="CPF"/><Field name="rg" label="RG"/><Field name="data_nascimento" label="Data de nascimento" type="date"/>
      <SelectField name="sexo" label="Sexo" options={["Feminino","Masculino","Outro","Não informado"]}/><Field name="telefone" label="Telefone / WhatsApp"/><Field name="email" label="E-mail" type="email" span2/><Field name="endereco" label="Endereço" span2/>
      <Field name="cidade" label="Cidade"/><Field name="uf" label="UF"/><Field name="cep" label="CEP"/><Field name="hospital" label="Hospital" span2/>
      <Field name="cirurgia" label="Cirurgia" span2/><Field name="especialidade" label="Especialidade"/><Field name="procedimento" label="Procedimento" span2/><SelectField name="convenio" label="Convênio" options={["Unimed","FUPS","SAS","CISCOMCAM","Humana Saúde","Bradesco Saúde","SulAmérica","Amil","Particular"]}/>
      <Field name="numero_carteirinha" label="Nº da carteirinha"/><Field name="validade" label="Validade" type="date"/><Field name="plano" label="Plano"/><Field name="data_consulta" label="Data da consulta" type="date"/><Field name="horario" label="Horário" type="time"/>
      <Field name="observacoes" label="Observações" wide/>
    </div>
    {error && <p className="clinicalError">{error}</p>}
    <div className="modalActions"><button type="button" className="outlineClinical" onClick={onClose}>Cancelar</button><button className="primaryClinical" disabled={busy}>{busy?"Salvando...":"SALVAR"}</button></div>
  </form></div>;
}
function Field({name,label,type="text",wide=false,span2=false,required=false}:{name:string;label:string;type?:string;wide?:boolean;span2?:boolean;required?:boolean}) { return <label className={`clinicalField ${wide?"wide":""} ${span2?"span2":""}`}><span>{label}</span><input name={name} type={type} required={required}/></label>; }
function SelectField({name,label,options}:{name:string;label:string;options:string[]}) { return <label className="clinicalField"><span>{label}</span><select name={name}>{options.map(o=><option key={o}>{o}</option>)}</select></label>; }
