"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Perfil = { id: string; institution_id: string; nome: string; role: string; must_reset: boolean };
type Paciente = {
  id: string; nome: string; cpf: string | null; rg?: string | null; data_nascimento: string | null;
  sexo?: string | null; telefone: string | null; email: string | null; endereco?: string | null;
  cidade?: string | null; uf?: string | null; cep?: string | null; hospital?: string | null;
  cirurgia?: string | null; especialidade?: string | null; procedimento?: string | null;
  convenio?: string | null; numero_carteirinha?: string | null; validade?: string | null;
  plano?: string | null; data_consulta?: string | null; horario?: string | null;
  observacoes?: string | null; created_at: string;
};
type Avaliacao = { id: string; patient_id: string; status: string; updated_at: string; created_at: string; dados?: Record<string, unknown> | null };
type Financeiro = { id:string; institution_id:string; patient_id:string; avaliacao_id:string|null; medico_id:string|null; convenio:string; hospital:string|null; valor:number; recebido:number; status:string; nota_fiscal:string|null; lote:string|null; data_recebimento:string|null; repasse_valor:number; repasse_status:string; observacoes:string|null; created_at:string };
type Pagamento = { id:string; atendimento_id:string; valor:number; metodo:string; referencia:string|null; paid_at:string };
type View = "medico" | "recepcao" | "financeiro";

const brDate = (date?: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function DashboardClient({ perfil, pacientes, avaliacoes, financeiro, pagamentos }: { perfil: Perfil; pacientes: Paciente[]; avaliacoes: Avaliacao[]; financeiro:Financeiro[]; pagamentos:Pagamento[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>(perfil.role === "recepcao" ? "recepcao" : "medico");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => pacientes.filter((p) => `${p.nome} ${p.cpf ?? ""} ${p.telefone ?? ""} ${p.procedimento ?? ""}`.toLowerCase().includes(search.toLowerCase())), [pacientes, search]);
  const currentByPatient = new Map(avaliacoes.map((a) => [a.patient_id, a]));
  const drafts = avaliacoes.filter((a) => a.status === "rascunho");
  const completed = avaliacoes.filter((a) => a.status === "concluida");
  const today = new Date().toISOString().slice(0, 10);
  const scheduledToday = pacientes.filter((p) => p.data_consulta === today);
  const queue = scheduledToday.length ? scheduledToday : pacientes.slice(0, 3);

  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const fd = new FormData(event.currentTarget);
    const text = (name: string) => String(fd.get(name) ?? "").trim() || null;
    const supabase = createClient();
    const { error: insertError } = await supabase.from("pacientes").insert({
      institution_id: perfil.institution_id, created_by: perfil.id,
      nome: text("nome"), cpf: text("cpf"), rg: text("rg"), data_nascimento: text("data_nascimento"),
      sexo: text("sexo"), telefone: text("telefone"), email: text("email"), endereco: text("endereco"),
      cidade: text("cidade"), uf: text("uf"), cep: text("cep"), hospital: text("hospital"),
      cirurgia: text("cirurgia"), especialidade: text("especialidade"), procedimento: text("procedimento"),
      convenio: text("convenio"), numero_carteirinha: text("numero_carteirinha"), validade: text("validade"),
      plano: text("plano"), data_consulta: text("data_consulta"), horario: text("horario"), observacoes: text("observacoes"),
    });
    if (insertError) { setError(`Não foi possível salvar: ${insertError.message}`); setBusy(false); return; }
    setOpen(false); setBusy(false); router.refresh();
  }

  async function openAssessment(patientId: string) {
    const existing = currentByPatient.get(patientId);
    if (existing && existing.status === "rascunho") { router.push(`/avaliacoes/${existing.id}`); return; }
    if (existing && existing.status === "concluida") { router.push(`/avaliacoes/${existing.id}/documentos`); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const { data, error: createError } = await supabase.from("avaliacoes").insert({
      institution_id: perfil.institution_id, patient_id: patientId, created_by: perfil.id, status: "rascunho",
    }).select("id").single();
    if (createError || !data) { setError(createError?.message ?? "Falha ao iniciar avaliação."); setBusy(false); return; }
    router.push(`/avaliacoes/${data.id}`);
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login"); router.refresh();
  }

  return (
    <main className="clinicalShell">
      <header className="clinicalTopbar">
        <a className="clinicalBrand" href="/"><b>AV</b><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></a>
        <nav className="roleNav">
          <button className="themePill">◐ Escuro</button>
          <button className={view === "recepcao" ? "active" : ""} onClick={() => setView("recepcao")}>Recepção</button>
          <button className={view === "medico" ? "active" : ""} onClick={() => setView("medico")}>Médico</button>
          <button className={view === "financeiro" ? "active" : ""} onClick={() => setView("financeiro")}>Financeiro</button><button>Admin</button>
          <span className="roleBadge">{perfil.role === "owner" ? "ADMINISTRADOR" : perfil.role.toUpperCase()}</span>
          <button>🔒 Bloquear</button><button onClick={logout}>Sair</button>
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
            <Metric value={scheduledToday.length || queue.length} label="Consultas hoje" tone="blue" />
            <Metric value={drafts.length} label="Pendências" tone="red" />
            <Metric value={completed.length} label="Avaliações concluídas" tone="green" />
            <Metric value={drafts.length} label="Orientações pendentes" tone="amber" />
            <Metric value={0} label="Pacientes ASA III+" tone="red" />
          </section>
          <section className="clinicalPanel">
            <div className="panelTitle"><strong>Fila de atendimento — hoje</strong><span>prioridade → horário agendado → chegada → encaixes</span></div>
            {queue.length ? queue.map((p, index) => {
              const a = currentByPatient.get(p.id);
              return <div className="queueRow" key={p.id}>
                <time>{p.horario?.slice(0,5) || `${8 + index}:00`.padStart(5,"0")}</time>
                <div className="queueInfo"><strong>{p.nome}</strong><small>{p.procedimento || p.cirurgia || "Procedimento não informado"} · {p.hospital || "Hospital não informado"}</small></div>
                <span className={`statusChip ${a?.status === "rascunho" ? "paused" : "present"}`}>{a?.status === "rascunho" ? "AVALIAÇÃO PAUSADA" : "PACIENTE PRESENTE"}</span>
                <button className="primaryClinical compact" disabled={busy} onClick={() => openAssessment(p.id)}>{a?.status === "rascunho" ? "Continuar avaliação" : "Iniciar avaliação"}</button>
              </div>;
            }) : <div className="emptyClinical">Cadastre um paciente para iniciar a fila.</div>}
          </section>
          <section className="clinicalPanel alertsPanel">
            <div className="panelTitle"><strong>Central Operacional</strong><span>alertas da rotina baseados nas avaliações em andamento</span></div>
            <div className="alertGrid">
              <Alert icon="△" title="Avaliações incompletas" text={`${drafts.length} avaliação(ões) aguardando conclusão`} action="REVISAR" danger />
              <Alert icon="!" title="Medicamentos" text="Revisar anticoagulantes e GLP-1 durante a anamnese" action="AVALIAR" />
              <Alert icon="×" title="Exames pendentes" text="Confira exames e pareceres antes da conclusão" action="PENDÊNCIA" />
              <Alert icon="✉" title="Orientações não enviadas" text={`${drafts.length} avaliação(ões) ainda não concluída(s)`} action="ENVIAR" />
            </div>
          </section>
          <section className="clinicalPanel agendaPanel">
            <div className="agendaHead"><strong>Agenda</strong><button className="active">Hoje</button><button>Amanhã</button><button>Semana</button><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por paciente, CPF, prontuário, procedimento, cirurgião..." /></div>
            {filtered.slice(0, 8).map((p) => { const a = currentByPatient.get(p.id); return <button className="agendaRow" key={p.id} onClick={() => openAssessment(p.id)}>
              <span className="avatar">{initials(p.nome)}</span><span><strong>{p.nome}</strong><small>{p.procedimento || p.cirurgia || "Procedimento não informado"} · {p.hospital || "Hospital não informado"}</small></span>
              <time>{brDate(p.data_consulta || p.created_at.slice(0,10))}</time><span className={`statusChip ${a?.status === "concluida" ? "present" : "waiting"}`}>{a?.status === "concluida" ? "CONCLUÍDA" : a ? "EM ANDAMENTO" : "AGENDADA"}</span>
            </button>})}
          </section>
          <div className="quickLinks"><button onClick={() => setOpen(true)}>+ Nova avaliação</button><button>Pesquisar paciente</button><button>Protocolos</button><button>Consulta de medicamentos</button><button>Calculadoras</button><button>PDFs</button><button>Estatísticas</button></div>
        </div>
      ) : view === "recepcao" ? (
        <div className="clinicalMain receptionMain">
          <section><h1>Recepção</h1><p>Cadastro de pacientes e agenda — sem acesso a dados clínicos ou financeiros.</p><div className="quickLinks"><button onClick={() => setOpen(true)}>Novo paciente</button><button>Agenda</button><button>Pacientes</button><button>Pesquisar</button><button>Convênios</button><button>Anexar documentos</button></div></section>
          <section className="metricGrid receptionMetrics"><Metric value={scheduledToday.length || queue.length} label="Consultas hoje" tone="blue"/><Metric value={pacientes.length} label="Consultas agendadas" tone="blue"/><Metric value={completed.length} label="Concluídas no mês" tone="green"/><Metric value={drafts.length} label="Aguardando cadastro" tone="amber"/><Metric value={0} label="Canceladas" tone="red"/></section>
          <section className="clinicalPanel searchPanel"><strong>Pesquisar paciente</strong><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Nome, parte do nome, CPF ou telefone..." /><span>Pesquise antes de cadastrar — evita duplicidade</span></section>
          <section className="clinicalPanel"><div className="panelTitle"><strong>Consultas de hoje</strong></div>{queue.map((p,index)=><div className="queueRow" key={p.id}><time>{p.horario?.slice(0,5)||`${8+index}:00`.padStart(5,"0")}</time><div className="queueInfo"><strong>{p.nome}</strong><small>{p.hospital||"Hospital não informado"} · {p.convenio||"Particular"}</small></div><span className="statusChip waiting">AVALIAÇÃO AGENDADA</span><button className="outlineClinical">✓ Presente</button><button className="outlineClinical red">Faltou</button></div>)}</section>
          <section className="clinicalPanel inlineRegistration"><div className="panelTitle"><strong>Novo paciente</strong></div><p>Use o cadastro completo para incluir dados pessoais, convênio, cirurgia e agendamento.</p><button className="primaryClinical" onClick={()=>setOpen(true)}>Abrir cadastro completo</button></section>
        </div>
      ) : <FinanceView perfil={perfil} pacientes={pacientes} avaliacoes={avaliacoes} financeiro={financeiro} pagamentos={pagamentos} onRefresh={()=>router.refresh()}/>}

      {open && <PatientModal busy={busy} error={error} onClose={() => setOpen(false)} onSubmit={createPatient} />}
    </main>
  );
}

function FinanceView({perfil,pacientes,avaliacoes,financeiro,pagamentos,onRefresh}:{perfil:Perfil;pacientes:Paciente[];avaliacoes:Avaliacao[];financeiro:Financeiro[];pagamentos:Pagamento[];onRefresh:()=>void}) {
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [values,setValues]=useState<Record<string,string>>({});
  const [methods,setMethods]=useState<Record<string,string>>({});
  const patientMap=new Map(pacientes.map(p=>[p.id,p]));
  const evaluationMap=new Map(avaliacoes.map(a=>[a.patient_id,a]));
  const billedPatients=new Set(financeiro.map(item=>item.patient_id));
  const pendingPatients=pacientes.filter(p=>!billedPatients.has(p.id));
  const money=(value:number)=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const total=financeiro.reduce((sum,item)=>sum+Number(item.valor),0);
  const received=financeiro.reduce((sum,item)=>sum+Number(item.recebido),0);
  const pending=Math.max(0,total-received);
  const glosas=financeiro.filter(item=>item.status==="glosa");
  const groups=Object.entries(financeiro.reduce<Record<string,Financeiro[]>>((acc,item)=>{(acc[item.convenio||"Particular"]??=[]).push(item);return acc},{}));
  const lots=Object.entries(financeiro.filter(item=>item.lote).reduce<Record<string,Financeiro[]>>((acc,item)=>{(acc[item.lote as string]??=[]).push(item);return acc},{}));

  async function createBilling(patient:Paciente) {
    setBusy(patient.id); setMessage("");
    const evaluation=evaluationMap.get(patient.id);
    const {error}=await createClient().from("financeiro_atendimentos").insert({
      institution_id:perfil.institution_id,patient_id:patient.id,avaliacao_id:evaluation?.id??null,
      convenio:patient.convenio||"Particular",hospital:patient.hospital||null,valor:0,status:"aguardando"
    });
    setBusy(""); if(error)setMessage(`Não foi possível criar o lançamento: ${error.message}`);else{setMessage("Lançamento criado. Informe o valor e os dados de cobrança.");onRefresh()}
  }
  async function updateItem(id:string,changes:Record<string,string|number|null>) {
    setBusy(id); setMessage(""); const {error}=await createClient().from("financeiro_atendimentos").update({...changes,updated_at:new Date().toISOString()}).eq("id",id);
    setBusy(""); if(error)setMessage(`Não foi possível atualizar: ${error.message}`);else onRefresh();
  }
  async function registerPayment(item:Financeiro) {
    const amount=Number(String(values[item.id]||"").replace(",","."));
    if(!amount||amount<=0){setMessage("Informe um valor de pagamento válido.");return}
    setBusy(item.id); const client=createClient();
    const {error}=await client.from("financeiro_pagamentos").insert({institution_id:perfil.institution_id,atendimento_id:item.id,valor:amount,metodo:methods[item.id]||"PIX",created_by:perfil.id});
    if(!error){const next=Number(item.recebido)+amount;await client.from("financeiro_atendimentos").update({recebido:next,status:next>=Number(item.valor)&&Number(item.valor)>0?"pago":item.status,data_recebimento:new Date().toISOString().slice(0,10),updated_at:new Date().toISOString()}).eq("id",item.id)}
    setBusy(""); if(error)setMessage(`Não foi possível registrar: ${error.message}`);else{setValues(v=>({...v,[item.id]:""}));setMessage("Pagamento registrado.");onRefresh()}
  }

  return <div className="clinicalMain financeMain">
    <section><h1>Financeiro</h1><p>Consultas organizadas por convênio — sem acesso ao conteúdo clínico das avaliações.</p></section>
    {message&&<p className={message.includes("não foi")?"clinicalError":"financeSuccess"}>{message}</p>}
    <section className="metricGrid financeMetrics"><Metric value={financeiro.length} label="Atendimentos no mês" tone="blue"/><Metric value={financeiro.filter(i=>!i.nota_fiscal).length} label="Notas pendentes" tone="amber"/><MoneyMetric value={received} label="Recebido no mês" tone="green"/><Metric value={glosas.length} label="Glosas em recurso" tone="red"/></section>

    {pendingPatients.length>0&&<section className="clinicalPanel"><div className="panelTitle"><strong>Atendimentos aguardando lançamento</strong><span>vindos automaticamente da recepção e agenda</span></div>{pendingPatients.slice(0,8).map(patient=><div className="financeSetupRow" key={patient.id}><span><strong>{patient.nome}</strong><small>{patient.hospital||"Hospital não informado"} · {patient.convenio||"Particular"} · {patient.data_consulta?brDate(patient.data_consulta):"sem data"}</small></span><button className="outlineClinical" disabled={busy===patient.id} onClick={()=>createBilling(patient)}>Criar lançamento</button></div>)}</section>}

    {groups.length===0?<div className="emptyClinical">Nenhum lançamento financeiro cadastrado.</div>:groups.map(([convenio,items])=><section className="clinicalPanel financeGroup" key={convenio}><div className="financeGroupHead"><strong>▣ &nbsp;{convenio}</strong><span>{items.length} atendimento(s)</span><b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b></div>{items.map(item=>{const patient=patientMap.get(item.patient_id);return <div className="financeItemRow" key={item.id}><div><strong>{patient?.nome||"Paciente"}</strong><small>{item.hospital||patient?.hospital||"Hospital não informado"} · Consulta {patient?.data_consulta?brDate(patient.data_consulta):"sem data"}</small></div><label className="inlineMoney"><span>Valor</span><input defaultValue={Number(item.valor)||""} placeholder="R$ 0,00" onBlur={e=>updateItem(item.id,{valor:Number(e.target.value.replace(",","."))||0})}/></label><select value={item.status} onChange={e=>updateItem(item.id,{status:e.target.value})}><option value="aguardando">Aguardando</option><option value="pago">Pago</option><option value="glosa">Glosa</option><option value="cancelado">Cancelado</option></select><input className="financeSmallInput" defaultValue={item.nota_fiscal??""} placeholder="Nota fiscal" onBlur={e=>updateItem(item.id,{nota_fiscal:e.target.value||null})}/><input className="financeSmallInput" defaultValue={item.lote??""} placeholder="Lote" onBlur={e=>updateItem(item.id,{lote:e.target.value||null})}/></div>})}</section>)}

    <section className="clinicalPanel"><div className="panelTitle"><strong>📦 Lotes de cobrança</strong><span>agrupamento por convênio/hospital, sem dados clínicos</span></div>{lots.length?lots.map(([lot,items])=><div className="financeLotRow" key={lot}><strong>{lot}</strong><span>{items[0]?.convenio} · {items.length} atendimento(s)</span><b>{money(items.reduce((s,i)=>s+Number(i.valor),0))}</b><span className={`statusChip ${items.every(i=>i.status==="pago")?"present":"waiting"}`}>{items.every(i=>i.status==="pago")?"PAGO":"EM ABERTO"}</span></div>):<div className="emptyClinical compactEmpty">Informe o número do lote nos atendimentos para agrupá-los aqui.</div>}</section>

    <section className="clinicalPanel"><div className="panelTitle"><strong>💳 Recebimentos</strong><span>PIX, dinheiro, cartão ou transferência; pagamentos parciais atualizam o saldo</span></div>{financeiro.map(item=>{const patient=patientMap.get(item.patient_id);const balance=Math.max(0,Number(item.valor)-Number(item.recebido));return <div className="paymentRow" key={item.id}><span><strong>{patient?.nome||"Paciente"} ({item.convenio})</strong><small>Valor {money(item.valor)} · recebido {money(item.recebido)} · saldo {money(balance)}</small></span><input value={values[item.id]||""} onChange={e=>setValues(v=>({...v,[item.id]:e.target.value}))} placeholder="Valor R$"/><select value={methods[item.id]||"PIX"} onChange={e=>setMethods(v=>({...v,[item.id]:e.target.value}))}><option>PIX</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Outro</option></select><button className="paymentButton" disabled={busy===item.id||balance<=0} onClick={()=>registerPayment(item)}>Registrar pagamento</button></div>})}{financeiro.length===0&&<div className="emptyClinical compactEmpty">Crie um lançamento para registrar recebimentos.</div>}</section>

    <section className="clinicalPanel"><div className="panelTitle"><strong>🩺 Repasses aos anestesiologistas</strong><span>liberação após recebimento; valores visíveis conforme as permissões do perfil</span></div>{financeiro.filter(i=>Number(i.repasse_valor)>0).map(item=><div className="repasseRow" key={item.id}><span><strong>Profissional vinculado ao atendimento</strong><small>{item.convenio} · {patientMap.get(item.patient_id)?.nome}</small></span><b>{money(item.repasse_valor)}</b><select value={item.repasse_status} onChange={e=>updateItem(item.id,{repasse_status:e.target.value})}><option value="pendente">Repasse pendente</option><option value="aguardando_recebimento">Aguardando recebimento</option><option value="pago">Pago</option></select></div>)}{!financeiro.some(i=>Number(i.repasse_valor)>0)&&<div className="emptyClinical compactEmpty">Nenhum repasse configurado.</div>}</section>

    <section className="clinicalPanel closingPanel"><div className="panelTitle"><strong>🔒 Fechamento do período</strong><span className="statusChip waiting">EM PREPARAÇÃO</span></div><div className="closingMetrics"><MoneySmall value={total} label="Total cobrado"/><MoneySmall value={received} label="Recebido" tone="green"/><MoneySmall value={pending} label="Pendente" tone="amber"/><MoneySmall value={glosas.reduce((s,i)=>s+Number(i.valor),0)} label="Glosas" tone="red"/><MoneySmall value={financeiro.reduce((s,i)=>s+(i.repasse_status==="pago"?Number(i.repasse_valor):0),0)} label="Repasses realizados" tone="blue"/></div><div className="closingFooter"><span>⚠ Revise notas, glosas e pagamentos pendentes antes da conferência.</span><button className="primaryClinical compact">Confirmar conferência</button></div></section>
    <p className="financeFootnote">Pagamentos registrados: {pagamentos.length}. Valores exibidos são os lançamentos reais cadastrados para esta instituição.</p>
  </div>
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) { return <div className="metricCard"><strong className={tone}>{value}</strong><span>{label}</span></div>; }
function MoneyMetric({value,label,tone}:{value:number;label:string;tone:string}){return <div className="metricCard"><strong className={tone}>{value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{label}</span></div>}
function MoneySmall({value,label,tone=""}:{value:number;label:string;tone?:string}){return <div><strong className={tone}>{value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><span>{label}</span></div>}
function Alert({ icon, title, text, action, danger=false }: { icon:string; title:string; text:string; action:string; danger?:boolean }) { return <div className="alertItem"><i className={danger?"danger":""}>{icon}</i><span><strong>{title}</strong> — {text}</span><b className={danger?"dangerText":""}>{action}</b></div>; }

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
