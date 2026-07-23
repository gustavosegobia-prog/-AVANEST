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
type View = "medico" | "recepcao";

const brDate = (date?: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function DashboardClient({ perfil, pacientes, avaliacoes }: { perfil: Perfil; pacientes: Paciente[]; avaliacoes: Avaliacao[] }) {
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
          <button>Financeiro</button><button>Admin</button>
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
      ) : (
        <div className="clinicalMain receptionMain">
          <section><h1>Recepção</h1><p>Cadastro de pacientes e agenda — sem acesso a dados clínicos ou financeiros.</p><div className="quickLinks"><button onClick={() => setOpen(true)}>Novo paciente</button><button>Agenda</button><button>Pacientes</button><button>Pesquisar</button><button>Convênios</button><button>Anexar documentos</button></div></section>
          <section className="metricGrid receptionMetrics"><Metric value={scheduledToday.length || queue.length} label="Consultas hoje" tone="blue"/><Metric value={pacientes.length} label="Consultas agendadas" tone="blue"/><Metric value={completed.length} label="Concluídas no mês" tone="green"/><Metric value={drafts.length} label="Aguardando cadastro" tone="amber"/><Metric value={0} label="Canceladas" tone="red"/></section>
          <section className="clinicalPanel searchPanel"><strong>Pesquisar paciente</strong><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Nome, parte do nome, CPF ou telefone..." /><span>Pesquise antes de cadastrar — evita duplicidade</span></section>
          <section className="clinicalPanel"><div className="panelTitle"><strong>Consultas de hoje</strong></div>{queue.map((p,index)=><div className="queueRow" key={p.id}><time>{p.horario?.slice(0,5)||`${8+index}:00`.padStart(5,"0")}</time><div className="queueInfo"><strong>{p.nome}</strong><small>{p.hospital||"Hospital não informado"} · {p.convenio||"Particular"}</small></div><span className="statusChip waiting">AVALIAÇÃO AGENDADA</span><button className="outlineClinical">✓ Presente</button><button className="outlineClinical red">Faltou</button></div>)}</section>
          <section className="clinicalPanel inlineRegistration"><div className="panelTitle"><strong>Novo paciente</strong></div><p>Use o cadastro completo para incluir dados pessoais, convênio, cirurgia e agendamento.</p><button className="primaryClinical" onClick={()=>setOpen(true)}>Abrir cadastro completo</button></section>
        </div>
      )}

      {open && <PatientModal busy={busy} error={error} onClose={() => setOpen(false)} onSubmit={createPatient} />}
    </main>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) { return <div className="metricCard"><strong className={tone}>{value}</strong><span>{label}</span></div>; }
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
