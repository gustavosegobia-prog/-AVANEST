"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { calculateLastDoseDate, findMedicationGuideEntry } from "@/lib/medication-guide";
import { BrandMark } from "@/components/brand-mark";

const STEPS = ["Identificação", "Procedimento", "Anamnese", "Medicamentos", "Exame físico", "Via aérea", "Exames", "Escores", "Conclusão"];
type Draft = Record<string, string | boolean>;
type Assessment = { id: string; institution_id: string; patient_id: string; status: string; versao: number; dados: Draft | null; updated_at: string; lock_version:number };
type Profile = { id:string; nome:string; crm:string|null; rqe:string|null; role:string };
type Patient = {
  id:string; nome:string; cpf:string|null; rg?:string|null; data_nascimento:string|null; sexo:string|null;
  telefone:string|null; email:string|null; hospital?:string|null; cirurgia?:string|null;
  especialidade?:string|null; procedimento?:string|null; convenio?:string|null; data_consulta?:string|null; horario?:string|null;
};

export function AssessmentForm({ avaliacao, paciente, perfil }: { avaliacao: Assessment; paciente: Patient; perfil:Profile }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = avaliacao.dados ?? {};
    return {
      sexo: paciente.sexo ?? "", convenio: paciente.convenio ?? "", hospital: paciente.hospital ?? "",
      cirurgia: paciente.cirurgia ?? paciente.procedimento ?? "", data_cirurgia: paciente.data_consulta ?? "",
      ...saved,
      anestesiologista: String(saved.anestesiologista || perfil.nome),
      crm: String(saved.crm || perfil.crm || ""),
      rqe: String(saved.rqe || perfil.rqe || ""),
    };
  });
  const [saveState, setSaveState] = useState<"saved"|"pending"|"saving"|"error">("saved");
  const [savedAt, setSavedAt] = useState(() => new Date(avaliacao.updated_at));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef=useRef(draft);
  const lockVersionRef=useRef(Number(avaliacao.lock_version ?? 0));
  const saveInFlightRef=useRef<Promise<boolean>|null>(null);

  async function saveDraftDirectly(next: Draft) {
    const expectedLockVersion=lockVersionRef.current;
    const {data,error}=await createClient()
      .from("avaliacoes")
      .update({
        dados:next,
        updated_at:new Date().toISOString(),
        lock_version:expectedLockVersion+1,
      })
      .eq("id",avaliacao.id)
      .eq("status","rascunho")
      .eq("lock_version",expectedLockVersion)
      .select("updated_at,lock_version")
      .maybeSingle();
    if(error||!data)return false;
    lockVersionRef.current=Number(data.lock_version);
    setSavedAt(new Date(data.updated_at));
    setSaveState("saved");
    return true;
  }

  async function save(next = draftRef.current) {
    if(saveInFlightRef.current)await saveInFlightRef.current;
    setSaveState("saving");
    const operation=(async()=>{
      const {data,error}=await createClient().rpc("salvar_rascunho_avaliacao",{
        p_avaliacao_id:avaliacao.id,p_expected_lock_version:lockVersionRef.current,p_dados:next,
      });
      if(error||!data?.[0]){
        const savedDirectly=await saveDraftDirectly(next);
        if(!savedDirectly){
          // Não sobrescreve um rascunho que foi alterado em outra aba/dispositivo.
          // A pessoa pode tentar novamente; se houver conflito real, a tela informa.
          setSaveState("error");
        }
        return savedDirectly;
      }
      lockVersionRef.current=Number(data[0].lock_version);
      const now=new Date(data[0].updated_at);
      setSaveState("saved");setSavedAt(now);
      return true;
    })();
    saveInFlightRef.current=operation;
    const result=await operation;
    if(saveInFlightRef.current===operation)saveInFlightRef.current=null;
    return result;
  }
  function set(name: string, value: string | boolean) {
    const next = { ...draftRef.current, [name]: value }; draftRef.current=next;setDraft(next); setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 900);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function conclude() {
    if(timer.current)clearTimeout(timer.current);
    const concludedAt = new Date().toISOString();
    const auditedDraft = {
      ...draftRef.current,
      concluido_por_id: perfil.id,
      concluido_por_nome: perfil.nome,
      concluido_por_crm: perfil.crm ?? "",
      concluido_por_rqe: perfil.rqe ?? "",
      concluido_em: concludedAt,
    };
    draftRef.current=auditedDraft;setDraft(auditedDraft);setSaveState("saving");
    const saved=await save(auditedDraft);
    if(!saved)return;
    setSaveState("saving");
    const { error } = await createClient().rpc("concluir_avaliacao",{
      p_avaliacao_id:avaliacao.id,p_expected_lock_version:lockVersionRef.current,p_dados:auditedDraft,
    });
    if (!error) {
      router.push(`/avaliacoes/${avaliacao.id}/documentos`);
      return;
    }
    const expectedLockVersion=lockVersionRef.current;
    const {data:concluded,error:directError}=await createClient()
      .from("avaliacoes")
      .update({
        dados:auditedDraft,
        snapshot_conclusao:auditedDraft,
        status:"concluida",
        concluida_at:concludedAt,
        updated_at:concludedAt,
        lock_version:expectedLockVersion+1,
      })
      .eq("id",avaliacao.id)
      .eq("status","rascunho")
      .eq("lock_version",expectedLockVersion)
      .select("id")
      .maybeSingle();
    if(!directError&&concluded)router.push(`/avaliacoes/${avaliacao.id}/documentos`);
    else setSaveState("error");
  }

  const age = useMemo(() => {
    if (!paciente.data_nascimento) return null;
    const birth = new Date(`${paciente.data_nascimento}T12:00:00`); const now = new Date();
    const calculated = now.getFullYear()-birth.getFullYear()-(now < new Date(now.getFullYear(),birth.getMonth(),birth.getDate()) ? 1 : 0);
    return Number.isFinite(calculated) && calculated >= 0 && calculated <= 130 ? calculated : null;
  },[paciente.data_nascimento]);
  const weight = Number(draft.peso || 0), height = Number(draft.altura || 0);
  const imc = weight && height ? weight / ((height/100) ** 2) : 0;
  const heightInches = height / 2.54;
  const idealWeight = height
    ? Math.max(30, (String(draft.sexo || paciente.sexo).toLowerCase() === "masculino" ? 50 : 45.5) + 2.3 * (heightInches - 60))
    : 0;
  const adjustedWeight = idealWeight && weight > idealWeight
    ? idealWeight + 0.4 * (weight - idealWeight)
    : weight || idealWeight;
  const allergy = String(draft.alergias_detalhes || "");
  const completedSteps=[
    Boolean(paciente.nome&&paciente.data_nascimento&&age!==null),
    Boolean(draft.cirurgia&&draft.data_cirurgia),
    Boolean(draft.cirurgias_anteriores&&draft.alergias),
    readMedications(draft.medicamentos_json).every(item=>item.confirmada===true),
    Boolean(draft.pa_sistolica&&draft.pa_diastolica&&draft.fc&&draft.spo2),
    Boolean(draft.mallampati&&draft.abertura_oral&&draft.distancia_tireo&&draft.denticao&&draft.mobilidade),
    Boolean(draft.hemoglobina||draft.ecg||draft.exames_obs),
    Boolean(draft.asa&&draft.asa_confirmada&&draft.capacidade_funcional),
    Boolean(draft.conclusao&&draft.anestesiologista&&draft.crm),
  ];
  const progress=Math.round(completedSteps.filter(Boolean).length/completedSteps.length*100);

  const numericLimits:Record<string,{min:number;max:number;step?:number}> = {
    peso:{min:1,max:500,step:0.1},
    altura:{min:40,max:250,step:0.1},
  };
  const input = (name:string,label:string,type="text",span="") => {
    const limits=numericLimits[name];
    return <label className={`evalField ${span}`}><span>{label}</span><input type={type} min={limits?.min} max={limits?.max} step={limits?.step} value={String(draft[name]??"")} onChange={(e)=>set(name,e.target.value)}/></label>;
  };
  const select = (name:string,label:string,options:string[],span="") => <label className={`evalField ${span}`}><span>{label}</span><select value={String(draft[name]??"")} onChange={(e)=>set(name,e.target.value)}><option value="">Selecione</option>{options.map(o=><option key={o}>{o}</option>)}</select></label>;

  return <main className="evalShell">
    <header className="evalTopbar">
      <Link className="clinicalBrand" href="/dashboard"><BrandMark className="clinicalBrandMark" /><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></Link>
      <span className={`evalSave ${saveState}`}><i/> {saveState==="saved"?`Salvo automaticamente às ${savedAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:saveState==="saving"?"Salvando...":saveState==="pending"?"Alterações pendentes":"Falha ao salvar"}</span>
      <nav className="evalRoleNav"><button type="button">◐ Escuro</button><button type="button" className="active">Médico</button><b>{perfil.role==="owner"?"ADMINISTRADOR":perfil.role.toUpperCase()}</b></nav>
    </header>
    {allergy && <div className="allergyBanner">⚠ ALERGIA: {allergy.toUpperCase()}</div>}
    <div className="evalProgress" aria-label={`${progress}% da avaliação preenchida`}><i style={{width:`${progress}%`}}/></div>
    <div className="evalMain">
      <div className="evalSteps">{STEPS.map((name,index)=><button type="button" onClick={()=>document.getElementById(`etapa-${index+1}`)?.scrollIntoView({behavior:"smooth",block:"start"})} key={name}><i className={completedSteps[index]?"done":""}/>{name}</button>)}</div>
      <div className="evalControls"><button className="pauseButton">Ⅱ Pausar</button><button onClick={async()=>{await save();router.push("/dashboard")}}>↩ Salvar e voltar</button></div>

      <section id="etapa-1" className="evalSection">
        <h1>1 · Identificação do paciente</h1>
        <div className="evalFormGrid">
          <label className="evalField span3"><span>Nome completo</span><input value={paciente.nome} readOnly/></label>
          <label className="evalField"><span>Data de nascimento</span><input className={paciente.data_nascimento&&age===null?"invalidField":""} value={paciente.data_nascimento??""} type="date" readOnly/>{paciente.data_nascimento&&age===null&&<small className="fieldError">Data inválida. Corrija o cadastro do paciente.</small>}</label>
          {select("sexo","Sexo",["Feminino","Masculino","Outro"])}
          <label className="evalField"><span>CPF</span><input value={paciente.cpf??""} readOnly/></label>
          {input("peso","Peso (kg)","number")}{input("altura","Altura (cm)","number")}{input("convenio","Convênio")}
          <label className="evalField"><span>Telefone / WhatsApp</span><input value={paciente.telefone??""} readOnly/></label>
          <label className="evalField span2"><span>E-mail</span><input value={paciente.email??""} readOnly/></label>
          {input("prontuario","Nº do prontuário")}{input("hospital","Hospital / clínica","text","span2")}{input("unidade","Unidade de internação")}{input("responsavel","Responsável (se necessário)","text","span2")}
        </div>
        <div className="clinicalCalculations"><div><small>IDADE</small><strong>{age!==null?`${age} anos`:"—"}</strong><span>{paciente.data_nascimento&&age===null?"data de nascimento inválida":"calculada automaticamente"}</span></div><div className="amber"><small>IMC</small><strong>{imc?imc.toFixed(1):"—"}</strong><span>{imc>=30?"Obesidade":imc?"Faixa calculada":"informe peso e altura"}</span></div><div><small>PESO IDEAL / AJUSTADO</small><strong>{height?`${idealWeight.toFixed(0)} kg / ${adjustedWeight.toFixed(0)} kg`:"—"}</strong><span>Devine / peso ajustado — confirmar clinicamente</span></div></div>
      </section>

      <section id="etapa-2" className="evalSection"><h1>2 · Procedimento cirúrgico</h1><div className="evalFormGrid">
        {input("cirurgia","Cirurgia proposta","text","span3")}{input("diagnostico","Diagnóstico","text","span3")}{input("cirurgiao","Cirurgião","text","span2")}
        {input("especialidade","Especialidade")}{input("data_cirurgia","Data prevista","date")}{input("horario_cirurgia","Horário previsto","time")}{select("lateralidade","Lateralidade",["Direita","Esquerda","Bilateral","Não se aplica"])}
        {select("carater","Caráter",["Eletiva","Urgência","Emergência"])}{select("porte","Porte cirúrgico",["Pequeno","Médio","Grande"])}{input("duracao","Duração estimada")}
        {select("regime","Regime",["Ambulatorial","Hospital-dia","Internação (1 diária)","Internação prolongada"],"span2")}{select("sangue","Necessidade provável de sangue",["Não","Sim","A definir"])}
        {select("uti","Necessidade provável de UTI",["Não","Sim","A definir"])}{select("tecnica","Técnica anestésica planejada",["Anestesia geral","Sedação","Raquianestesia","Raquianestesia + sedação","Peridural","Bloqueio periférico"],"span2")}
      </div><p className="evalHint">A data prevista da cirurgia é usada para organizar as orientações de medicamentos a suspender.</p></section>

      <div id="etapa-3"><Anamnesis draft={draft} set={set}/></div>
      <div id="etapa-4"><Medications draft={draft} set={set}/></div>
      <div id="etapa-5"><PhysicalExam draft={draft} set={set}/></div>
      <div id="etapa-6"><Airway draft={draft} set={set}/></div>
      <div id="etapa-7"><ComplementaryExams draft={draft} set={set} avaliacao={avaliacao}/></div>
      <div id="etapa-8"><Scores draft={draft} set={set} age={age} sex={paciente.sexo} imc={imc}/></div>
      <div id="etapa-9"><Conclusion draft={draft} set={set} paciente={paciente} age={age} imc={imc} conclude={conclude} retrySave={()=>void save()} saveState={saveState}/></div>
    </div>
  </main>;
}

function Anamnesis({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const questions=[
    ["cirurgias_anteriores","Já realizou alguma cirurgia?"],
    ["reacao_anestesica","Apresentou reação ou complicação anestésica? Há casos na família?"],
    ["medicacao_continua","Faz uso de medicação contínua ou eventual (ex.: caneta emagrecedora)?"],
    ["anticoagulante","Utiliza anticoagulante ou antiagregante?"],
    ["cardiovascular","Possui doença cardiovascular?"],
    ["respiratoria","Possui doença respiratória?"],
    ["apneia","Roncos ou apneia obstrutiva do sono?"],
    ["diabetes","Possui diabetes?"],
    ["neurologica","Doenças neurológicas ou psiquiátricas?"],
    ["outras_doencas","Outras doenças? (tireoide, renal, hepática, artrites, etc.)"],
    ["doenca_aguda","Doença aguda no momento? (gripe, tosse, febre, ITU, etc.)"],
    ["dentaria","Usa prótese dentária removível ou tem alterações dentárias?"],
    ["alergias","Possui alergias?"],
    ["habitos","Tabagismo, álcool, outras substâncias e atividade física?"],
    ["glaucoma","Possui glaucoma?"],
    ["gestacao","Mulher em idade fértil: há possibilidade de gestação?"],
  ].filter(([key])=>key!=="gestacao"||String(draft.sexo||"").toLowerCase()==="feminino");
  return <><section className="evalSection evalIntro"><h1>3 · Anamnese</h1><p>Perguntas da ficha física. Cada resposta “Sim” abre detalhamento e observações.</p></section>
    <div className="anamnesisList">{questions.map(([key,label])=><QuestionCard key={key} name={key} label={label} value={String(draft[key]??"")} detail={String(draft[`${key}_detalhes`]??"")} onChange={(value)=>{set(key,value);if(key==="medicacao_continua"&&value==="Sim")window.setTimeout(()=>document.getElementById("etapa-4")?.scrollIntoView({behavior:"smooth",block:"start"}),180)}} onDetail={(value)=>set(`${key}_detalhes`,value)} draft={draft} set={set}/>)}</div></>;
}
const QUESTION_CHIPS:Record<string,string[]>={
  cirurgias_anteriores:["Cesárea","Colecistectomia","Herniorrafia","Ortopédica","Cardíaca","Outra"],
  reacao_anestesica:["Náuseas/vômitos intensos","Intubação difícil","Dificuldade de ventilação","Alergia","Hipertermia maligna","Cefaleia pós-raqui","UTI","PCR","Outra"],
  medicacao_continua:["Anti-hipertensivo","Antidiabético","Anticoagulante","Psicofármaco","Caneta emagrecedora","Fitoterápico","Outro"],
  anticoagulante:["AAS","Clopidogrel","Varfarina","Rivaroxabana","Apixabana","Dabigatrana","Enoxaparina","Outro"],
  cardiovascular:["Hipertensão","Coronariopatia","Infarto","Insuficiência cardíaca","Arritmia","Valvopatia","Marca-passo/CDI","AVC/AIT","Outra"],
  respiratoria:["Asma","DPOC","Bronquite","Enfisema","Fibrose pulmonar","Hipertensão pulmonar","Outra"],
  apneia:["Ronco alto","Apneia observada","CPAP","Sonolência diurna","Polissonografia"],
  diabetes:["Tipo 1","Tipo 2","Insulina","Hipoglicemia recente","Complicações"],
  neurologica:["Epilepsia","Parkinson","AVC/AIT","Demência","Depressão","Ansiedade","Transtorno bipolar","Outra"],
  outras_doencas:["Tireoide","Renal","Hepática","Refluxo","Câncer","Reumatológica","Obesidade","Outra"],
  doenca_aguda:["Gripe","Tosse","Febre","ITU","Diarreia/vômitos","Outra"],
  dentaria:["Prótese removível","Prótese fixa","Dente solto","Dente fraturado","Edentado","Aparelho"],
  alergias:["Medicamentos","Látex","Alimentos","Antissépticos","Contraste iodado","Outros"],
  habitos:["Tabagismo","Álcool","Cannabis","Cocaína/estimulantes","Sedentarismo","Atividade física"],
  glaucoma:["Ângulo aberto","Ângulo fechado","Colírio em uso"],
  gestacao:["Atraso menstrual","Teste positivo","Amamentação"],
};
function QuestionCard({name,label,value,detail,onChange,onDetail,draft,set}:{name:string;label:string;value:string;detail:string;onChange:(v:string)=>void;onDetail:(v:string)=>void;draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const chips=QUESTION_CHIPS[name]||[];
  const selected=detail.split(",").map(item=>item.trim()).filter(Boolean);
  const toggleChip=(chip:string)=>onDetail(selected.includes(chip)?selected.filter(item=>item!==chip).join(", "):[...selected,chip].join(", "));
  return <section className="questionCard"><div className="questionHead"><strong>{label}</strong><div className="answerButtons">{["Sim","Não","Não sabe"].map(answer=><button type="button" className={value===answer?"active":""} onClick={()=>{onChange(answer);if(answer!=="Sim"){onDetail("");if(name==="respiratoria"){set("respiratoria_controle","");set("respiratoria_ultima_crise","");set("respiratoria_internacao","");set("respiratoria_medicacao","")}}}} key={answer}>{answer}</button>)}</div></div>
    {value==="Sim"&&<><div className="detailChips">{chips.map(chip=><button type="button" className={selected.includes(chip)?"selected":""} onClick={()=>toggleChip(chip)} key={chip}>{chip}</button>)}</div>
      {name==="respiratoria"&&<div className="conditionalDetails">
        <label><span>Controle atual</span><select value={String(draft.respiratoria_controle??"")} onChange={e=>set("respiratoria_controle",e.target.value)}><option value="">Selecione</option><option>Controlada</option><option>Parcialmente controlada</option><option>Não controlada</option><option>Não sabe</option></select></label>
        <label><span>Data da última crise</span><input type="date" value={String(draft.respiratoria_ultima_crise??"")} onChange={e=>set("respiratoria_ultima_crise",e.target.value)}/></label>
        <label><span>Internação/intubação por crise</span><select value={String(draft.respiratoria_internacao??"")} onChange={e=>set("respiratoria_internacao",e.target.value)}><option value="">Selecione</option><option>Não</option><option>Sim, internação</option><option>Sim, UTI</option><option>Sim, intubação</option></select></label>
        <label><span>Medicação respiratória em uso</span><input value={String(draft.respiratoria_medicacao??"")} onChange={e=>set("respiratoria_medicacao",e.target.value)} placeholder="Ex.: salbutamol, corticoide inalatório"/></label>
      </div>}
      {name==="anticoagulante"&&<div className="conditionalDetails">
        <label><span>Última dose</span><input type="datetime-local" value={String(draft.anticoagulante_ultima_dose??"")} onChange={e=>set("anticoagulante_ultima_dose",e.target.value)}/></label>
        <label><span>Indicação</span><input value={String(draft.anticoagulante_indicacao??"")} onChange={e=>set("anticoagulante_indicacao",e.target.value)} placeholder="Ex.: FA, TEV, stent"/></label>
      </div>}
      <input className="detailInput" value={detail} onChange={e=>onDetail(e.target.value)} placeholder="Detalhes e observações"/></>}
  </section>;
}

type Medication = {
  id:string; nome:string; dose:string; frequencia:string; ultimaDose:string; indicacao:string;
  conduta:string; orientacao:string; principioAtivo?:string; classe?:string; prazo?:string;
  reinicio?:string; excecoes?:string; fonte?:string; ultimaDoseSugerida?:string; confirmada?:boolean;
};
function readMedications(value: string | boolean | undefined): Medication[] {
  try { const parsed=JSON.parse(String(value||"[]")); return Array.isArray(parsed)?parsed:[]; } catch { return []; }
}
const MEDICATION_CATEGORY_LABELS = new Set([
  "anti-hipertensivo","antidiabético","anticoagulante","psicofármaco",
  "caneta emagrecedora","fitoterápico","outro",
]);
function normalizeMedicationName(value:string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
}
function medicationFromName(nome:string, surgeryDate:string):Medication {
  const guide=findMedicationGuideEntry(nome);
  return {
    id:crypto.randomUUID(),nome,dose:"",frequencia:"",ultimaDose:"",indicacao:"",
    conduta:guide?.defaultAction??"Avaliar",orientacao:guide?.timing??"",
    principioAtivo:guide?.activeIngredient??"",classe:guide?.medicationClass??"",
    prazo:guide?.timing??"",reinicio:guide?.restart??"",excecoes:guide?.adjustments??"",
    fonte:guide?.source??"",ultimaDoseSugerida:calculateLastDoseDate(surgeryDate,guide?.suspendDays),
    confirmada:false,
  };
}
function medicationNamesFromAnamnesis(value:string) {
  return value
    .split(/[,;\n/]+/)
    .map(item=>item.trim())
    .filter(item=>item.length>=2&&!MEDICATION_CATEGORY_LABELS.has(normalizeMedicationName(item)));
}
function Medications({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const [name,setName]=useState("");
  const medications=readMedications(draft.medicamentos_json);
  const save=(items:Medication[])=>set("medicamentos_json",JSON.stringify(items));
  const continuousDetails=String(draft.medicacao_continua_detalhes||"");
  const anticoagulantDetails=String(draft.anticoagulante_detalhes||"");
  useEffect(()=>{
    const timer=setTimeout(()=>{
      const sourceNames=[
        ...(draft.medicacao_continua==="Sim"?medicationNamesFromAnamnesis(continuousDetails):[]),
        ...(draft.anticoagulante==="Sim"?medicationNamesFromAnamnesis(anticoagulantDetails):[]),
      ];
      if(!sourceNames.length)return;
      const existingNames=new Set(medications.map(item=>normalizeMedicationName(item.nome)));
      const missing=sourceNames.filter(item=>{
        const normalized=normalizeMedicationName(item);
        if(existingNames.has(normalized))return false;
        existingNames.add(normalized);
        return true;
      });
      if(missing.length)save([...medications,...missing.map(item=>medicationFromName(item,String(draft.data_cirurgia||"")))]);
    },700);
    return ()=>clearTimeout(timer);
    // Importa apenas quando os campos de origem da anamnese forem alterados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[continuousDetails,anticoagulantDetails,draft.medicacao_continua,draft.anticoagulante]);
  const add=(suggestion?:string)=>{
    const nome=(suggestion??name).trim(); if(!nome)return;
    if(medications.some(item=>normalizeMedicationName(item.nome)===normalizeMedicationName(nome))){setName("");return;}
    save([...medications,medicationFromName(nome,String(draft.data_cirurgia||""))]); setName("");
  };
  const update=<K extends keyof Medication>(id:string,key:K,value:Medication[K])=>save(medications.map(item=>item.id===id?{...item,[key]:value}:item));
  const groups=[
    ["Manter",medications.filter(m=>m.conduta==="Manter")],
    ["Suspender",medications.filter(m=>m.conduta==="Suspender")],
    ["Individualizar / avaliar",medications.filter(m=>!["Manter","Suspender"].includes(m.conduta))],
  ] as const;
  return <><section className="evalSection">
    <h1>4 · Medicamentos em uso</h1>
    <p className="evalHint"><b>Base:</b> Guia Perioperatório de Medicamentos, versão 1.0, revisão 07/2026. As sugestões são apoio à decisão e devem ser revisadas e confirmadas individualmente pelo anestesiologista.</p>
    <div className="medicationAdd"><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}} placeholder="Ex.: losartana, Xarelto, AAS, metformina..."/><button onClick={()=>add()}>Adicionar</button></div>
    <div className="quickMedication"><span>Adição rápida:</span>{["Losartana","AAS 100 mg","Clopidogrel","Xarelto 20 mg","Metformina","Ozempic","Chá de boldo","Vitamina X"].map(item=><button key={item} onClick={()=>add(item)}>{item}</button>)}</div>
  </section>
  {medications.length===0?<section className="emptyClinical">Nenhum medicamento adicionado nesta avaliação.</section>:medications.map(item=>{const currentSuggested=calculateLastDoseDate(String(draft.data_cirurgia||""),findMedicationGuideEntry(item.nome)?.suspendDays);return <section className="medicationCard" key={item.id}>
    <div className="medicationTitle"><div><strong>{item.nome}</strong><small>{item.principioAtivo||"Medicamento não localizado na base — preencher manualmente"}</small></div><select value={item.conduta} onChange={e=>update(item.id,"conduta",e.target.value)}><option>Avaliar</option><option>Individualizar</option><option>Manter</option><option>Suspender</option></select><button className="removeMedication" onClick={()=>save(medications.filter(m=>m.id!==item.id))}>×</button></div>
    <div className="medicationGrid">
      <label><span>Dose</span><input value={item.dose} onChange={e=>update(item.id,"dose",e.target.value)} placeholder="Ex.: 50 mg"/></label>
      <label><span>Frequência</span><input value={item.frequencia} onChange={e=>update(item.id,"frequencia",e.target.value)} placeholder="Ex.: 1x/dia"/></label>
      <label><span>Última dose tomada</span><input type="datetime-local" value={item.ultimaDose} onChange={e=>update(item.id,"ultimaDose",e.target.value)}/></label>
      <label><span>Indicação</span><input value={item.indicacao} onChange={e=>update(item.id,"indicacao",e.target.value)} placeholder="Opcional"/></label>
      <label className="wide"><span>Orientação médica confirmada</span><input value={item.orientacao} onChange={e=>update(item.id,"orientacao",e.target.value)} placeholder="Registrar somente após avaliação individual"/></label>
    </div>
    {(item.classe||item.prazo||item.reinicio)&&<div className="medicationGuidance">
      <div><b>Classe / princípio ativo</b><span>{item.classe||"—"} · {item.principioAtivo||"—"}</span></div>
      <div><b>Quando suspender ou ajustar</b><span>{item.prazo||"Avaliar individualmente."}</span></div>
      <div><b>Última dose sugerida pela data da cirurgia</b><span>{currentSuggested?new Date(`${currentSuggested}T12:00:00`).toLocaleDateString("pt-BR"):"Não calculável — confirmar risco, função renal e técnica anestésica."}</span></div>
      <div><b>Quando reiniciar</b><span>{item.reinicio||"Definir conforme evolução clínica e hemostasia."}</span></div>
      <div className="wide"><b>Ajustes, exceções e cautelas</b><span>{item.excecoes||"Sem regra automática cadastrada."}</span></div>
      <div className="wide medicationSource"><b>Fonte e versão</b><span>{item.fonte||"Não cadastrado no guia 07/2026."}</span></div>
    </div>}
    <label className="medicationConfirm"><input type="checkbox" checked={item.confirmada===true} onChange={e=>update(item.id,"confirmada",e.target.checked)}/><span>Orientação revisada e confirmada pelo anestesiologista</span></label>
  </section>})}
  <section className="evalSection"><h2>Resumo dos medicamentos</h2><div className="medicationSummary">{groups.map(([label,items])=><div key={label}><strong>{label}</strong>{items.length?items.map(m=><span key={m.id}>• {m.nome}{m.dose?` ${m.dose}`:""}</span>):<span>— nenhum —</span>}</div>)}</div></section></>;
}

function ToggleChips({title,items,draft,set,prefix}:{title:string;items:string[];draft:Draft;set:(name:string,value:string|boolean)=>void;prefix:string}) {
  return <div className="examChipGroup"><strong>{title}</strong><div>{items.map(item=>{const key=`${prefix}_${item.toLowerCase().replace(/\W+/g,"_")}`;return <button className={draft[key]===true?"selected":""} onClick={()=>set(key,draft[key]!==true)} key={item}>{item}</button>})}</div></div>;
}
function PhysicalExam({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const limits:Record<string,{min:number;max:number;step?:number}>={
    pa_sistolica:{min:40,max:300},
    pa_diastolica:{min:20,max:200},
    fc:{min:20,max:250},
    fr:{min:4,max:80},
    spo2:{min:50,max:100},
    temperatura:{min:30,max:45,step:0.1},
    glicemia_capilar:{min:20,max:1000},
    circ_cervical:{min:10,max:100,step:0.1},
    circ_abdominal:{min:20,max:300,step:0.1},
  };
  const field=(name:string,label:string,type="text")=>{const range=limits[name];return <label className="evalField"><span>{label}</span><input type={type} min={range?.min} max={range?.max} step={range?.step} value={String(draft[name]??"")} onChange={e=>set(name,e.target.value)}/></label>};
  return <section className="evalSection"><h1>5 · Exame físico</h1><div className="physicalGrid">
    {field("pa_sistolica","PA sistólica (mmHg)","number")}{field("pa_diastolica","PA diastólica (mmHg)","number")}{field("fc","FC (bpm)","number")}{field("fr","FR (irpm)","number")}{field("spo2","SpO₂ (%)","number")}{field("temperatura","Temperatura (°C)","number")}
    {field("glicemia_capilar","Glicemia capilar (mg/dL)","number")}{field("estado_geral","Estado geral")}{field("consciencia","Nível de consciência")}{field("circ_cervical","Circunf. cervical (cm)","number")}{field("circ_abdominal","Circunf. abdominal (cm)","number")}
  </div>
  <ToggleChips title="EXAME CARDIOVASCULAR" prefix="cardio" items={["Bulhas normofonéticas","Sopro","Arritmia","Edema","Turgência jugular","Pulsos diminuídos","Perfusão lentificada"]} draft={draft} set={set}/>
  <label className="evalField examOptionalNote"><span>Observações cardiovasculares, se houver</span><input value={String(draft.ausculta_cardiaca??"")} onChange={e=>set("ausculta_cardiaca",e.target.value)} placeholder="Descreva somente alterações ou informações relevantes"/></label>
  <ToggleChips title="EXAME RESPIRATÓRIO" prefix="resp" items={["MV preservado","Sibilos","Roncos","Estertores","Estridor","Musculatura acessória","Tosse","Dispneia"]} draft={draft} set={set}/>
  <label className="evalField examOptionalNote"><span>Observações respiratórias, se houver</span><input value={String(draft.ausculta_pulmonar??"")} onChange={e=>set("ausculta_pulmonar",e.target.value)} placeholder="Descreva somente alterações ou informações relevantes"/></label>
  <ToggleChips title="DISPOSITIVOS IMPLANTÁVEIS" prefix="dispositivo" items={["Marca-passo","CDI","Cateter venoso implantado","Fístula AV","Prótese valvar","Estoma"]} draft={draft} set={set}/>
  </section>;
}

function Airway({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const predictors=["Retrognatia/micrognatia","Macroglossia","Pescoço curto","Barba","Massa cervical","Radioterapia cervical prévia","Cirurgia cervical prévia","História de intubação difícil","Dificuldade de ventilação prévia","Traqueostomia","Apneia do sono"];
  const key=(item:string)=>`via_${item.toLowerCase().replace(/\W+/g,"_")}`;
  const primaryOptions: Array<[string,string[]]>=[
    ["mallampati",["Classe III","Classe IV"]],
    ["abertura_oral",["< 3 cm"]],
    ["distancia_tireo",["< 6 cm"]],
    ["mobilidade",["Reduzida","Muito reduzida"]],
    ["denticao",["Prótese removível","Alterações dentárias"]],
  ];
  const primary=primaryOptions.filter(([field,values])=>values.includes(String(draft[field]))).length;
  const count=predictors.filter(item=>draft[key(item)]===true).length+primary;
  const risk=count===0?"Baixa":count<=2?"Moderada":"Alta";
  const choice=(name:string,label:string,options:string[])=><label className="evalField"><span>{label}</span><select value={String(draft[name]??"")} onChange={e=>set(name,e.target.value)}><option value="">Selecione</option>{options.map(o=><option key={o}>{o}</option>)}</select></label>;
  return <section className="evalSection"><h1>6 · Avaliação da via aérea</h1><div className="airwayGrid">
    {choice("mallampati","Mallampati",["Classe I","Classe II","Classe III","Classe IV"])}
    {choice("abertura_oral","Abertura oral",["> 4 cm","3–4 cm","< 3 cm"])}
    {choice("distancia_tireo","Distância tireomentoniana",["> 6,5 cm","6–6,5 cm","< 6 cm"])}
    {choice("denticao","Dentição",["Normais","Prótese removível","Prótese fixa","Edentado","Alterações dentárias"])}
    {choice("mobilidade","Mobilidade cervical",["Normal","Reduzida","Muito reduzida"])}
  </div><ToggleChips title="PREDITORES ADICIONAIS" prefix="via" items={predictors} draft={draft} set={set}/>
  <div className={`airwayRisk ${risk.toLowerCase()}`}><strong>{risk} probabilidade sugerida de via aérea difícil</strong><span>{count} preditor(es) marcado(s) — sugestão de apoio, deve ser confirmada pelo anestesiologista.</span></div>
  </section>;
}

function ComplementaryExams({draft,set,avaliacao}:{draft:Draft;set:(name:string,value:string|boolean)=>void;avaliacao:Assessment}) {
  const [uploading,setUploading]=useState(false);
  const [uploadError,setUploadError]=useState("");
  const attachments=useMemo(()=>{try{const data=JSON.parse(String(draft.exames_anexos||"[]"));return Array.isArray(data)?data:[]}catch{return []}},[draft.exames_anexos]);
  const field=(name:string,label:string,type="text")=><label className="evalField"><span>{label}</span><input type={type} value={String(draft[name]??"")} onChange={e=>set(name,e.target.value)}/></label>;
  async function upload(file?:File) {
    if(!file)return; setUploading(true); setUploadError("");
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=`${avaliacao.institution_id}/${avaliacao.id}/${crypto.randomUUID()}-${safe}`;
    const client=createClient(); const {error}=await client.storage.from("anexos").upload(path,file,{contentType:file.type,upsert:false});
    if(error){setUploadError(error.message)}else{set("exames_anexos",JSON.stringify([...attachments,{name:file.name,path,type:file.type,size:file.size,createdAt:new Date().toISOString()}]))}
    setUploading(false);
  }
  return <section className="evalSection"><h1>7 · Exames complementares</h1><p className="evalHint">Valores de referência não são validados automaticamente. A interpretação e a decisão de repetir exames são do anestesiologista.</p>
    <div className="examResultsGrid">{field("hemoglobina","Hemoglobina (g/dL)")}{field("hematocrito","Hematócrito (%)")}{field("plaquetas","Plaquetas")}{field("inr","INR")}{field("ttpa","TTPa (s)")}{field("creatinina","Creatinina (mg/dL)")}{field("ureia","Ureia (mg/dL)")}{field("sodio","Sódio (mEq/L)")}{field("potassio","Potássio (mEq/L)")}{field("glicemia","Glicemia (mg/dL)")}{field("hba1c","HbA1c (%)")}{field("data_exames","Data dos exames","date")}</div>
    <div className="examDetailGrid">{field("ecg","Eletrocardiograma")}{field("eco","Ecocardiograma")}{field("rx_torax","Radiografia de tórax")}{field("espirometria","Espirometria")}<label className="evalField span2"><span>Outros exames (imagem, gasometria...)</span><input value={String(draft.exames_obs??"")} onChange={e=>set("exames_obs",e.target.value)}/></label></div>
    <div className="attachmentRow"><label className="attachmentButton">📎 {uploading?"Enviando...":"Anexar arquivo (PDF / imagem / câmera)"}<input type="file" accept=".pdf,image/jpeg,image/png" capture="environment" disabled={uploading} onChange={e=>upload(e.target.files?.[0])}/></label><span>Formatos aceitos: PDF, JPG e PNG.</span></div>
    {uploadError&&<p className="clinicalError">Não foi possível anexar: {uploadError}</p>}
    {attachments.length>0&&<div className="attachmentList">{attachments.map((item:{name:string;path:string})=><span key={item.path}>✓ {item.name}</span>)}</div>}
    <label className="medicationConfirm"><input type="checkbox" checked={draft.exames_revisados===true} onChange={e=>set("exames_revisados",e.target.checked)}/><span>Exames e anexos revisados; quando ausentes, confirmo que não foram indicados para esta avaliação.</span></label>
  </section>;
}

function ScoreToggle({name,label,draft,set}:{name:string;label:string;draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  return <button className={draft[name]===true?"scoreToggle selected":"scoreToggle"} onClick={()=>set(name,draft[name]!==true)}><i>{draft[name]===true?"✓":""}</i>{label}</button>;
}
function Scores({draft,set,age,sex,imc}:{draft:Draft;set:(name:string,value:string|boolean)=>void;age:number|null;sex:string|null;imc:number}) {
  const rcri=[["rcri_alto_risco","Cirurgia de alto risco"],["rcri_coronaria","Doença arterial coronariana"],["rcri_ic","Insuficiência cardíaca"],["rcri_cerebrovascular","Doença cerebrovascular (AVC/AIT)"],["rcri_insulina","Diabetes em uso de insulina"],["rcri_creatinina","Creatinina > 2,0 mg/dL"]];
  const stop=[["stop_ronco","Ronco alto"],["stop_cansaco","Cansaço/sonolência diurna"],["stop_apneia","Apneia observada"],["stop_has","Hipertensão arterial"],["stop_pescoco","Circunf. cervical > 40 cm"],["stop_imc","IMC > 35"],["stop_idade","Idade > 50"],["stop_masculino","Sexo masculino"]];
  const apfel=[["apfel_historia","História de NVPO ou cinetose"],["apfel_opioide","Opioides pós-operatórios previstos"],["apfel_feminino","Sexo feminino"],["apfel_nao_tabagista","Não tabagista"]];
  const rcriScore=rcri.filter(([key])=>key==="rcri_creatinina"?Number(String(draft.creatinina||"").replace(",","."))>2:draft[key]===true).length;
  const stopScore=stop.filter(([key])=>{
    if(key==="stop_imc")return imc>35;
    if(key==="stop_idade")return age!==null&&age>50;
    if(key==="stop_masculino")return String(sex||draft.sexo).toLowerCase()==="masculino";
    if(key==="stop_pescoco")return Number(draft.circ_cervical||0)>40;
    return draft[key]===true;
  }).length;
  const apfelScore=apfel.filter(([key])=>{
    if(key==="apfel_feminino")return String(sex||draft.sexo).toLowerCase()==="feminino";
    if(key==="apfel_nao_tabagista")return String(draft.habitos||"")!=="Sim"||!String(draft.habitos_detalhes||"").toLowerCase().includes("tabag");
    return draft[key]===true;
  }).length;
  const stopRisk=stopScore<=2?"baixo risco":stopScore<=4?"risco intermediário":"alto risco";
  const apfelRisk=["≈ 10%","≈ 21%","≈ 39%","≈ 61%","≈ 79%"][apfelScore];
  const asa=["ASA I","ASA II","ASA III","ASA IV","ASA V","ASA VI"];
  return <><div className="scoreGrid">
    <section className="evalSection"><h1>8 · Classificação ASA</h1><p className="evalHint">Selecione e confirme a classificação médica.</p><div className="asaButtons">{asa.map(item=><button className={draft.asa===item?"selected":""} onClick={()=>set("asa",item)} key={item}>{item}</button>)}<button className={draft.asa_emergencia===true?"selected":""} onClick={()=>set("asa_emergencia",draft.asa_emergencia!==true)}>+ E (emergência)</button></div><label className="confirmScore"><input type="checkbox" checked={draft.asa_confirmada===true} onChange={e=>set("asa_confirmada",e.target.checked)}/> Classificação confirmada pelo médico</label></section>
    <section className="evalSection"><h1>Índice de Lee (RCRI)</h1><p className="evalHint">Marque os critérios presentes.</p><div className="scoreList">{rcri.map(([key,label])=><ScoreToggle key={key} name={key} label={label} draft={draft} set={set}/>)}</div><div className="scoreResult">Lee {rcriScore} ponto(s) · Classe {rcriScore===0?"I":rcriScore===1?"II":rcriScore===2?"III":"IV"} <small>apoio à estratificação; confirmar clinicamente</small></div></section>
    <section className="evalSection"><h1>STOP-Bang (apneia do sono)</h1><div className="scoreChipList">{stop.map(([key,label])=><ScoreToggle key={key} name={key} label={`${label}${key==="stop_imc"&&imc?` (IMC ${imc.toFixed(1)})`:key==="stop_idade"&&age?` (${age} anos)`:key==="stop_masculino"&&sex?` (${sex})`:""}`} draft={draft} set={set}/>)}</div><div className={`scoreResult ${stopScore>=5?"warning":"success"}`}>STOP-Bang {stopScore}/8 — {stopRisk}</div></section>
    <section className="evalSection"><h1>Apfel (risco de NVPO)</h1><div className="scoreChipList">{apfel.map(([key,label])=><ScoreToggle key={key} name={key} label={label} draft={draft} set={set}/>)}</div><div className="scoreResult">Apfel {apfelScore}/4 — risco de NVPO {apfelRisk} <small>referência de apoio; confirmar conduta</small></div></section>
  </div><section className="evalSection functionalCapacity"><strong>CAPACIDADE FUNCIONAL</strong><div className="asaButtons">{["< 4 METs","4–10 METs","> 10 METs","Não avaliável"].map(item=><button className={draft.capacidade_funcional===item?"selected":""} onClick={()=>set("capacidade_funcional",item)} key={item}>{item}</button>)}</div><p>Outros escores somente devem ser usados quando houver dados suficientes e validação clínica.</p></section></>;
}

function Conclusion({draft,set,paciente,age,imc,conclude,retrySave,saveState}:{draft:Draft;set:(name:string,value:string|boolean)=>void;paciente:Patient;age:number|null;imc:number;conclude:()=>Promise<void>;retrySave:()=>void;saveState:"saved"|"pending"|"saving"|"error"}) {
  const medications=readMedications(draft.medicamentos_json);
  const lastAutomaticPlan=useRef("");
  const airwayKeys=Object.keys(draft).filter(k=>k.startsWith("via_")&&draft[k]===true).length;
  const rcri=Object.keys(draft).filter(k=>k.startsWith("rcri_")&&draft[k]===true).length;
  const stop=Object.keys(draft).filter(k=>k.startsWith("stop_")&&draft[k]===true).length;
  const apfel=Object.keys(draft).filter(k=>k.startsWith("apfel_")&&draft[k]===true).length;
  const requestsBlood=["Sim","Solicitar"].includes(String(draft.concentrado_hemacias??""));
  const conclusions=["Apto para o procedimento proposto","Apto com ressalvas","Necessita otimização clínica","Necessita exames complementares","Necessita avaliação de outra especialidade","Avaliação inconclusiva"];
  const anamnesisKeys=["cirurgias_anteriores","reacao_anestesica","medicacao_continua","anticoagulante","cardiovascular","respiratoria","apneia","diabetes","neurologica","outras_doencas","doenca_aguda","dentaria","alergias","habitos","glaucoma","gestacao"];
  const checklist=[
    ["Identificação",Boolean(paciente.nome&&paciente.data_nascimento&&age!==null&&draft.peso&&draft.altura)],
    ["Procedimento",Boolean(draft.cirurgia&&draft.data_cirurgia)],
    ["Anamnese",anamnesisKeys.every(key=>Boolean(draft[key]))],
    ["Medicamentos",draft.medicacao_continua==="Não"||(medications.length>0&&medications.every(item=>item.confirmada===true))],
    ["Exame físico",Boolean(draft.pa_sistolica&&draft.pa_diastolica&&draft.fc&&draft.spo2)],
    ["Via aérea",Boolean(draft.mallampati&&draft.abertura_oral&&draft.distancia_tireo&&draft.denticao&&draft.mobilidade)],
    ["Exames",draft.exames_revisados===true],
    ["Escores",Boolean(draft.asa&&draft.asa_confirmada&&draft.capacidade_funcional)],
    ["Planejamento e conclusão",Boolean(draft.jejum_solidos&&draft.jejum_liquidos&&draft.tecnica&&draft.conclusao&&draft.anestesiologista&&draft.crm&&(!requestsBlood||draft.quantidade_ch))],
  ] as const;
  const allComplete=checklist.every(([,ok])=>ok);
  const summary=[["Paciente",`${paciente.nome}${age!==null?` · ${age} anos`:""}`],["Cirurgia",String(draft.cirurgia||"—")],["IMC",imc?imc.toFixed(1):"—"],["Alergias",String(draft.alergias_detalhes||"—")],["Capacidade funcional",String(draft.capacidade_funcional||"—")],["Via aérea",`${airwayKeys===0?"Baixa":airwayKeys<=2?"Moderada":"Alta"} probabilidade sugerida`],["ASA",String(draft.asa||"não definida")],["Lee (RCRI)",`${rcri} ponto(s)`],["STOP-Bang / Apfel",`${stop}/8 · ${apfel}/4`],["Medicamentos",`${medications.filter(m=>m.conduta==="Manter").length} manter · ${medications.filter(m=>m.conduta==="Suspender").length} suspender · ${medications.filter(m=>m.conduta==="Avaliar").length} avaliar`]];
  const medicationOrientations=medications.map(item=>{
    const identification=[item.nome,item.dose,item.frequencia].filter(Boolean).join(" ");
    const guidance=item.orientacao.trim()||item.prazo?.trim()||"orientação a definir";
    const restart=item.reinicio?.trim()?` Reinício: ${item.reinicio.trim()}.`:"";
    return `- ${identification}: ${item.conduta.toUpperCase()} — ${guidance}.${restart}`;
  });
  const automaticPlan=[
    `JEJUM: sólidos — ${String(draft.jejum_solidos||"a definir")}; líquidos claros — ${String(draft.jejum_liquidos||"a definir")}.`,
    `PLANO ANESTÉSICO: ${String(draft.tecnica||"a definir")}.`,
    medicationOrientations.length
      ?`ORIENTAÇÕES SOBRE MEDICAMENTOS:\n${medicationOrientations.join("\n")}`
      :"ORIENTAÇÕES SOBRE MEDICAMENTOS: nenhum medicamento registrado.",
    "ATO ANESTÉSICO, RISCOS ASSOCIADOS E TERMO DE CONSENTIMENTO EXPLICADOS AO PACIENTE.",
  ].join("\n");
  useEffect(()=>{
    const current=String(draft.plano_anestesico||"");
    if(!current||current===lastAutomaticPlan.current){
      lastAutomaticPlan.current=automaticPlan;
      if(current!==automaticPlan)set("plano_anestesico",automaticPlan);
    }
  },[automaticPlan,draft.plano_anestesico,set]);
  function generateText(){lastAutomaticPlan.current=automaticPlan;set("plano_anestesico",automaticPlan)}
  return <><section className="evalSection"><div className="conclusionHeading"><h1>9 · Resumo da avaliação</h1><button className="outlineClinical" onClick={generateText}>Atualizar orientações finais automaticamente ↓</button></div><div className="summaryGrid">{summary.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
  <section className="evalSection"><h2>Prescrição e planejamento pré-anestésico</h2><div className="planningGrid">
    <label className="evalField plan4"><span>Jejum — sólidos</span><select value={String(draft.jejum_solidos??"")} onChange={e=>set("jejum_solidos",e.target.value)}><option value="">Selecione</option><option>8 horas antes</option><option>6 horas antes (refeição leve)</option><option>Protocolo especial</option></select></label>
    <label className="evalField plan4"><span>Jejum — líquidos claros</span><select value={String(draft.jejum_liquidos??"")} onChange={e=>set("jejum_liquidos",e.target.value)}><option value="">Selecione</option><option>Líquidos claros até 2 h antes</option><option>Jejum absoluto</option><option>Protocolo especial</option></select></label>
    <label className="evalField plan2"><span>Horário de chegada</span><input type="time" value={String(draft.horario_chegada??"")} onChange={e=>set("horario_chegada",e.target.value)}/></label>
    <label className="evalField plan2"><span>Dormonid VO (pré-medicação)</span><select value={String(draft.premedicacao??"")} onChange={e=>set("premedicacao",e.target.value)}><option value="">Selecione</option><option>Não prescrever</option><option>7,5 mg</option><option>15 mg</option></select></label>
    <label className="evalField plan2"><span>Leito de UTI</span><select value={String(draft.leito_uti??"")} onChange={e=>set("leito_uti",e.target.value)}><option value="">Selecione</option><option>Não</option><option>Solicitar</option><option>A definir</option></select></label>
    <label className="evalField plan2"><span>Concentrado de hemácias (CH)</span><select value={String(draft.concentrado_hemacias??"")} onChange={e=>{set("concentrado_hemacias",e.target.value);if(e.target.value!=="Solicitar"&&e.target.value!=="Sim")set("quantidade_ch","")}}><option value="">Selecione</option><option>Não</option><option>Solicitar</option><option>A definir</option></select></label>
    {requestsBlood&&<label className="evalField plan2"><span>CH — quantidade (unidades) *</span><input type="number" min="1" step="1" required value={String(draft.quantidade_ch??"")} onChange={e=>set("quantidade_ch",e.target.value)} placeholder="Ex.: 2"/></label>}
    <label className="evalField plan2"><span>Avaliação especializada</span><select value={String(draft.avaliacao_especializada??"")} onChange={e=>set("avaliacao_especializada",e.target.value)}><option value="">Selecione</option><option>Não</option><option>Solicitar</option><option>A definir</option></select></label>
    <label className="evalField plan4"><span>Técnica anestésica</span><select value={String(draft.tecnica??"")} onChange={e=>set("tecnica",e.target.value)}><option value="">—</option><option>Anestesia geral</option><option>Sedação</option><option>Raquianestesia</option><option>Raquianestesia + sedação</option><option>Peridural</option><option>Bloqueio periférico</option><option>Técnica combinada</option></select></label>
    <label className="evalField plan4"><span>Monitorização</span><select value={String(draft.monitorizacao??"")} onChange={e=>set("monitorizacao",e.target.value)}><option value="">Selecione</option><option>Padrão</option><option>Expandida</option><option>Invasiva</option><option>Conforme necessidade clínica</option></select></label>
  </div><label className="evalField"><span>Orientações finais da avaliação (preenchidas automaticamente e editáveis)</span><textarea rows={8} value={String(draft.plano_anestesico??"")} onChange={e=>set("plano_anestesico",e.target.value)}/><small>O texto acompanha as escolhas de jejum, técnica anestésica e conduta dos medicamentos. Depois de uma edição manual, use “Atualizar orientações finais automaticamente” somente se quiser reconstruí-lo.</small></label></section>
  <section className="evalSection"><h2>Checklist final</h2><div className="finalChecklist">{checklist.map(([label,ok])=><span className={ok?"ok":"missing"} key={String(label)}>{ok?"✓":"⚠"} {label} {ok?"completo":"incompleto"}</span>)}</div><h2>Conclusão</h2><div className="conclusionOptions">{conclusions.map(item=><button type="button" className={draft.conclusao===item?"selected":""} onClick={()=>set("conclusao",item)} key={item}>{item}</button>)}</div><div className="signatureGrid"><label className="evalField"><span>Anestesiologista</span><input value={String(draft.anestesiologista??"")} onChange={e=>set("anestesiologista",e.target.value)}/></label><label className="evalField"><span>CRM / UF</span><input value={String(draft.crm??"")} onChange={e=>set("crm",e.target.value)}/></label><label className="evalField"><span>RQE</span><input value={String(draft.rqe??"")} onChange={e=>set("rqe",e.target.value)}/></label><button type="button" className="finishAssessment" disabled={!allComplete||saveState==="saving"||saveState==="error"} onClick={conclude}>✓ {saveState==="saving"?"Salvando...":"Concluir avaliação"}</button></div>{!allComplete&&<p className="completionWarning">Complete os itens marcados com ⚠ antes de concluir. Você pode usar “Salvar e voltar” sem perder o rascunho.</p>}{saveState==="error"&&<p className="completionWarning">Não foi possível sincronizar o rascunho agora. <button type="button" className="outlineClinical" onClick={retrySave}>Tentar salvar novamente</button></p>}<p className="evalHint">Os campos são preenchidos com o perfil conectado e continuam editáveis. Para auditoria, o sistema também grava separadamente o usuário autenticado, seus dados cadastrais, a data e a hora da conclusão.</p></section></>;
}
