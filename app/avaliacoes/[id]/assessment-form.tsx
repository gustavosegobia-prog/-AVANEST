"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppLogo } from "@/components/app-logo";

const STEPS = ["Identificação", "Procedimento", "Anamnese", "Medicamentos", "Exame físico", "Via aérea", "Exames", "Escores", "Planejamento"];
type Draft = Record<string, string | boolean>;
type Assessment = { id: string; patient_id: string; status: string; versao: number; dados: Draft | null; updated_at: string };
type Patient = { id: string; nome: string; cpf: string | null; data_nascimento: string | null; sexo: string | null; telefone: string | null; email: string | null };

export function AssessmentForm({ avaliacao, paciente }: { avaliacao: Assessment; paciente: Patient }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(avaliacao.dados ?? {});
  const [saveState, setSaveState] = useState<"saved"|"pending"|"saving"|"error">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(next = draft) {
    setSaveState("saving");
    const { error } = await createClient().from("avaliacoes").update({ dados: next, updated_at: new Date().toISOString() }).eq("id", avaliacao.id);
    setSaveState(error ? "error" : "saved");
  }
  function set(name: string, value: string | boolean) {
    const next = { ...draft, [name]: value }; setDraft(next); setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 1200);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function conclude() {
    await save();
    const { error } = await createClient().from("avaliacoes").update({ status: "concluida", concluida_at: new Date().toISOString(), dados: draft }).eq("id", avaliacao.id);
    if (!error) router.push("/dashboard"); else setSaveState("error");
  }

  const field = (name: string, label: string, type = "text") => <div className="avnField"><label>{label}</label><input type={type} value={String(draft[name] ?? "")} onChange={e => set(name, e.target.value)} /></div>;
  const yesNo = (name: string, label: string) => <div className="avnField full"><label>{label}</label><select value={String(draft[name] ?? "")} onChange={e => set(name, e.target.value)}><option value="">Selecione</option><option>Não</option><option>Sim</option><option>Não sabe</option></select></div>;

  return <main className="avnShell"><header className="avnTopbar"><AppLogo/><div className="avnTopbarMeta"><span className="avnSaveState">{saveState === "saved" ? "✓ Dados salvos" : saveState === "saving" ? "Salvando..." : saveState === "pending" ? "Alterações pendentes" : "Falha ao salvar"}</span><button className="avnButton secondary" onClick={() => router.push("/dashboard")}>Sair da avaliação</button></div></header>
    <div className="avnMain"><div className="avnPatientBar"><div><strong>{paciente.nome}</strong><br/><small>{paciente.data_nascimento ? new Date(`${paciente.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR") : "Nascimento não informado"} · versão {avaliacao.versao}</small></div><span>Avaliação em andamento</span></div>
      <div className="avnAssessment"><aside className="avnSteps">{STEPS.map((s,i)=><button className={`avnStep ${step===i?"active":""}`} key={s} onClick={()=>setStep(i)}>{i+1}. {s}</button>)}</aside>
        <section className="avnAssessmentCard"><p className="avnEyebrow">ETAPA {step+1} DE 9</p><h1>{STEPS[step]}</h1>
          <div className="avnFormGrid">
            {step===0 && <>{field("peso","Peso (kg)","number")}{field("altura","Altura (cm)","number")}{field("profissao","Profissão")}{field("religiao","Religião")}</>}
            {step===1 && <>{field("cirurgia","Cirurgia proposta")}{field("diagnostico","Diagnóstico")}{field("cirurgiao","Cirurgião")}{field("hospital","Hospital")}{field("data_cirurgia","Data da cirurgia","date")}<div className="avnField"><label>Caráter</label><select value={String(draft.carater??"")} onChange={e=>set("carater",e.target.value)}><option value="">Selecione</option><option>Eletiva</option><option>Urgência</option><option>Emergência</option></select></div></>}
            {step===2 && <>{yesNo("alergias","Possui alergias?")}{yesNo("cirurgias_anteriores","Já realizou cirurgias?")}{yesNo("reacao_anestesica","Teve reação à anestesia?")}{yesNo("cardiovascular","Possui doença cardiovascular?")}{yesNo("respiratoria","Possui doença respiratória?")}{yesNo("diabetes","Possui diabetes?")}</>}
            {step===3 && <><div className="avnField full"><label>Medicamentos em uso</label><textarea rows={7} value={String(draft.medicamentos??"")} onChange={e=>set("medicamentos",e.target.value)} placeholder="Informe nome, dose e frequência" /></div></>}
            {step===4 && <>{field("pressao","Pressão arterial")}{field("fc","Frequência cardíaca","number")}{field("spo2","SpO₂ (%)","number")}{field("temperatura","Temperatura (°C)","number")}<div className="avnField full"><label>Observações do exame físico</label><textarea rows={5} value={String(draft.exame_obs??"")} onChange={e=>set("exame_obs",e.target.value)} /></div></>}
            {step===5 && <>{field("mallampati","Mallampati")}{field("abertura_oral","Abertura oral")}{field("distancia_tireo","Distância tireomentoniana")}{field("circ_cervical","Circunferência cervical")}{field("denticao","Dentição")}{field("mobilidade","Mobilidade cervical")}</>}
            {step===6 && <>{field("hemoglobina","Hemoglobina")}{field("plaquetas","Plaquetas")}{field("inr","INR")}{field("creatinina","Creatinina")}{field("glicemia","Glicemia")}{field("ecg","ECG")}</>}
            {step===7 && <>{field("asa","ASA")}{field("lee","Lee/RCRI")}{field("stop_bang","STOP-Bang")}{field("apfel","Apfel")}<div className="avnField full"><p className="avnNotice">Os escores devem ser revisados e confirmados pelo anestesiologista.</p></div></>}
            {step===8 && <><div className="avnField full"><label>Técnica anestésica planejada</label><textarea rows={4} value={String(draft.tecnica??"")} onChange={e=>set("tecnica",e.target.value)} /></div><div className="avnField full"><label>Conclusão</label><select value={String(draft.conclusao??"")} onChange={e=>set("conclusao",e.target.value)}><option value="">Selecione</option><option>Apto</option><option>Apto com ressalvas</option><option>Necessita otimização</option><option>Avaliação incompleta</option></select></div></>}
          </div>
          <div className="avnActionsRow"><button className="avnButton secondary" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Anterior</button>{step<8?<button className="avnButton" onClick={async()=>{await save();setStep(s=>s+1)}}>Salvar e continuar</button>:<button className="avnButton" onClick={conclude}>Concluir avaliação</button>}</div>
        </section></div></div></main>;
}
