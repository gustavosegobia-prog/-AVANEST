"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const STEPS = ["Identificação", "Procedimento", "Anamnese", "Medicamentos", "Exame físico", "Via aérea", "Exames", "Escores", "Conclusão"];
type Draft = Record<string, string | boolean>;
type Assessment = { id: string; patient_id: string; status: string; versao: number; dados: Draft | null; updated_at: string };
type Patient = {
  id:string; nome:string; cpf:string|null; rg?:string|null; data_nascimento:string|null; sexo:string|null;
  telefone:string|null; email:string|null; hospital?:string|null; cirurgia?:string|null;
  especialidade?:string|null; procedimento?:string|null; convenio?:string|null; data_consulta?:string|null; horario?:string|null;
};

export function AssessmentForm({ avaliacao, paciente }: { avaliacao: Assessment; paciente: Patient }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    sexo: paciente.sexo ?? "", convenio: paciente.convenio ?? "", hospital: paciente.hospital ?? "",
    cirurgia: paciente.cirurgia ?? paciente.procedimento ?? "", data_cirurgia: paciente.data_consulta ?? "",
    ...avaliacao.dados,
  });
  const [saveState, setSaveState] = useState<"saved"|"pending"|"saving"|"error">("saved");
  const [savedAt, setSavedAt] = useState(() => new Date(avaliacao.updated_at));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(next = draft) {
    setSaveState("saving");
    const now = new Date();
    const { error } = await createClient().from("avaliacoes").update({ dados: next, updated_at: now.toISOString() }).eq("id", avaliacao.id);
    setSaveState(error ? "error" : "saved");
    if (!error) setSavedAt(now);
  }
  function set(name: string, value: string | boolean) {
    const next = { ...draft, [name]: value }; setDraft(next); setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 900);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function conclude() {
    await save();
    const { error } = await createClient().from("avaliacoes").update({ status:"concluida", concluida_at:new Date().toISOString(), dados:draft }).eq("id",avaliacao.id);
    if (!error) router.push("/dashboard"); else setSaveState("error");
  }

  const age = useMemo(() => {
    if (!paciente.data_nascimento) return null;
    const birth = new Date(`${paciente.data_nascimento}T12:00:00`); const now = new Date();
    return now.getFullYear()-birth.getFullYear()-(now < new Date(now.getFullYear(),birth.getMonth(),birth.getDate()) ? 1 : 0);
  },[paciente.data_nascimento]);
  const weight = Number(draft.peso || 0), height = Number(draft.altura || 0);
  const imc = weight && height ? weight / ((height/100) ** 2) : 0;
  const allergy = String(draft.alergias_detalhes || "");

  const input = (name:string,label:string,type="text",span="") => <label className={`evalField ${span}`}><span>{label}</span><input type={type} value={String(draft[name]??"")} onChange={(e)=>set(name,e.target.value)}/></label>;
  const select = (name:string,label:string,options:string[],span="") => <label className={`evalField ${span}`}><span>{label}</span><select value={String(draft[name]??"")} onChange={(e)=>set(name,e.target.value)}><option value="">Selecione</option>{options.map(o=><option key={o}>{o}</option>)}</select></label>;

  return <main className="evalShell">
    <header className="evalTopbar">
      <a className="clinicalBrand" href="/dashboard"><b>AV</b><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></a>
      <span className={`evalSave ${saveState}`}><i/> {saveState==="saved"?`Salvo automaticamente às ${savedAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:saveState==="saving"?"Salvando...":saveState==="pending"?"Alterações pendentes":"Falha ao salvar"}</span>
      <nav className="evalRoleNav"><button>◐ Escuro</button><button>Recepção</button><button className="active">Médico</button><button>Financeiro</button><button>Admin</button><b>ADMINISTRADOR</b></nav>
    </header>
    {allergy && <div className="allergyBanner">⚠ ALERGIA: {allergy.toUpperCase()}</div>}
    <div className="evalProgress"><i style={{width:`${((step+1)/9)*100}%`}}/></div>
    <div className="evalMain">
      <div className="evalSteps">{STEPS.map((name,index)=><button className={step===index?"active":""} onClick={()=>setStep(index)} key={name}><i className={index<=step?"done":""}/>{name}</button>)}</div>
      <div className="evalControls"><button className="pauseButton">Ⅱ Pausar</button><button onClick={async()=>{await save();router.push("/dashboard")}}>↩ Salvar e voltar</button></div>

      {step===0 && <section className="evalSection">
        <h1>1 · Identificação do paciente</h1>
        <div className="evalFormGrid">
          <label className="evalField span3"><span>Nome completo</span><input value={paciente.nome} readOnly/></label>
          <label className="evalField"><span>Data de nascimento</span><input value={paciente.data_nascimento??""} type="date" readOnly/></label>
          {select("sexo","Sexo",["Feminino","Masculino","Outro"])}
          <label className="evalField"><span>CPF</span><input value={paciente.cpf??""} readOnly/></label>
          {input("peso","Peso (kg)","number")}{input("altura","Altura (cm)","number")}{input("convenio","Convênio")}
          <label className="evalField"><span>Telefone / WhatsApp</span><input value={paciente.telefone??""} readOnly/></label>
          <label className="evalField span2"><span>E-mail</span><input value={paciente.email??""} readOnly/></label>
          {input("prontuario","Nº do prontuário")}{input("hospital","Hospital / clínica","text","span2")}{input("unidade","Unidade de internação")}{input("responsavel","Responsável (se necessário)","text","span2")}
        </div>
        <div className="clinicalCalculations"><div><small>IDADE</small><strong>{age!==null?`${age} anos`:"—"}</strong><span>calculada automaticamente</span></div><div className="amber"><small>IMC</small><strong>{imc?imc.toFixed(1):"—"}</strong><span>{imc>=30?"Obesidade":imc?"Faixa calculada":"informe peso e altura"}</span></div><div><small>PESO IDEAL / AJUSTADO</small><strong>{height?`${Math.max(0,(22*(height/100)**2)).toFixed(0)} kg`:"—"}</strong><span>estimativa — confirmar clinicamente</span></div></div>
      </section>}

      {step===1 && <section className="evalSection"><h1>2 · Procedimento cirúrgico</h1><div className="evalFormGrid">
        {input("cirurgia","Cirurgia proposta","text","span3")}{input("diagnostico","Diagnóstico","text","span3")}{input("cirurgiao","Cirurgião","text","span2")}
        {input("especialidade","Especialidade")}{input("data_cirurgia","Data prevista","date")}{input("horario_cirurgia","Horário previsto","time")}{select("lateralidade","Lateralidade",["Direita","Esquerda","Bilateral","Não se aplica"])}
        {select("carater","Caráter",["Eletiva","Urgência","Emergência"])}{select("porte","Porte cirúrgico",["Pequeno","Médio","Grande"])}{input("duracao","Duração estimada")}
        {select("regime","Regime",["Ambulatorial","Hospital-dia","Internação (1 diária)","Internação prolongada"],"span2")}{select("sangue","Necessidade provável de sangue",["Não","Sim","A definir"])}
        {select("uti","Necessidade provável de UTI",["Não","Sim","A definir"])}{select("tecnica","Técnica anestésica planejada",["Anestesia geral","Sedação","Raquianestesia","Raquianestesia + sedação","Peridural","Bloqueio periférico"],"span2")}
      </div><p className="evalHint">A data prevista da cirurgia é usada para organizar as orientações de medicamentos a suspender.</p></section>}

      {step===2 && <Anamnesis draft={draft} set={set}/>}
      {step===3 && <Medications draft={draft} set={set}/>}
      {step===4 && <PhysicalExam draft={draft} set={set}/>}
      {step===5 && <Airway draft={draft} set={set}/>}
      {step===6 && <ComplementaryExams draft={draft} set={set}/>}
      {step===7 && <GenericSection title="8 · Escores"><div className="evalFormGrid">{input("asa","ASA")}{input("lee","Lee/RCRI")}{input("stop_bang","STOP-Bang")}{input("apfel","Apfel")}</div><p className="evalHint">Os escores devem ser revisados e confirmados pelo anestesiologista.</p></GenericSection>}
      {step===8 && <GenericSection title="9 · Planejamento e conclusão"><label className="evalField"><span>Plano anestésico</span><textarea rows={5} value={String(draft.plano_anestesico??"")} onChange={e=>set("plano_anestesico",e.target.value)}/></label>{select("conclusao","Conclusão",["Apto","Apto com ressalvas","Necessita otimização","Avaliação incompleta"])}</GenericSection>}

      <div className="evalFooterActions"><button disabled={step===0} onClick={()=>setStep(s=>s-1)}>Anterior</button>{step<8?<button className="primaryClinical" onClick={async()=>{await save();setStep(s=>s+1);scrollTo(0,0)}}>Salvar e continuar</button>:<button className="primaryClinical" onClick={conclude}>Concluir avaliação</button>}</div>
    </div>
  </main>;
}

function GenericSection({title,children}:{title:string;children:React.ReactNode}) { return <section className="evalSection"><h1>{title}</h1>{children}</section>; }
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
  ];
  return <><section className="evalSection evalIntro"><h1>3 · Anamnese</h1><p>Perguntas da ficha física. Cada resposta “Sim” abre detalhamento e observações.</p></section>
    <div className="anamnesisList">{questions.map(([key,label])=><QuestionCard key={key} name={key} label={label} value={String(draft[key]??"")} detail={String(draft[`${key}_detalhes`]??"")} onChange={(value)=>set(key,value)} onDetail={(value)=>set(`${key}_detalhes`,value)}/>)}</div></>;
}
function QuestionCard({name,label,value,detail,onChange,onDetail}:{name:string;label:string;value:string;detail:string;onChange:(v:string)=>void;onDetail:(v:string)=>void}) {
  const chips=name==="alergias"?["Medicamentos","Látex","Alimentos","Antissépticos","Contraste iodado","Outros"]:name==="outras_doencas"?["Tireoide","Renal","Hepática","Refluxo","Câncer","Reumatológica","Obesidade","Outra"]:[];
  return <section className="questionCard"><div className="questionHead"><strong>{label}</strong><div className="answerButtons">{["Sim","Não","Não sabe"].map(answer=><button className={value===answer?"active":""} onClick={()=>onChange(answer)} key={answer}>{answer}</button>)}</div></div>
    {value==="Sim"&&<><div className="detailChips">{chips.map(chip=><button type="button" onClick={()=>onDetail(detail?`${detail}, ${chip}`:chip)} key={chip}>{chip}</button>)}</div><input className="detailInput" value={detail} onChange={e=>onDetail(e.target.value)} placeholder="Detalhes e observações"/></>}
  </section>;
}

type Medication = { id:string; nome:string; dose:string; frequencia:string; ultimaDose:string; indicacao:string; conduta:string; orientacao:string };
function readMedications(value: string | boolean | undefined): Medication[] {
  try { const parsed=JSON.parse(String(value||"[]")); return Array.isArray(parsed)?parsed:[]; } catch { return []; }
}
function Medications({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const [name,setName]=useState("");
  const medications=readMedications(draft.medicamentos_json);
  const save=(items:Medication[])=>set("medicamentos_json",JSON.stringify(items));
  const add=(suggestion?:string)=>{
    const nome=(suggestion??name).trim(); if(!nome)return;
    save([...medications,{id:crypto.randomUUID(),nome,dose:"",frequencia:"",ultimaDose:"",indicacao:"",conduta:"Avaliar",orientacao:""}]); setName("");
  };
  const update=(id:string,key:keyof Medication,value:string)=>save(medications.map(item=>item.id===id?{...item,[key]:value}:item));
  const groups=[
    ["Manter",medications.filter(m=>m.conduta==="Manter")],
    ["Suspender",medications.filter(m=>m.conduta==="Suspender")],
    ["Avaliar / não cadastrado",medications.filter(m=>!["Manter","Suspender"].includes(m.conduta))],
  ] as const;
  return <><section className="evalSection">
    <h1>4 · Medicamentos em uso</h1>
    <p className="evalHint">Registre nome, dose e frequência. A conduta deve ser revisada e confirmada individualmente pelo anestesiologista.</p>
    <div className="medicationAdd"><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}} placeholder="Ex.: losartana, Xarelto, AAS, metformina..."/><button onClick={()=>add()}>Adicionar</button></div>
    <div className="quickMedication"><span>Adição rápida:</span>{["Losartana","AAS 100 mg","Clopidogrel","Xarelto 20 mg","Metformina","Ozempic","Chá de boldo","Vitamina X"].map(item=><button key={item} onClick={()=>add(item)}>{item}</button>)}</div>
  </section>
  {medications.length===0?<section className="emptyClinical">Nenhum medicamento adicionado nesta avaliação.</section>:medications.map(item=><section className="medicationCard" key={item.id}>
    <div className="medicationTitle"><div><strong>{item.nome}</strong><small>Preencha e confirme a orientação clínica</small></div><select value={item.conduta} onChange={e=>update(item.id,"conduta",e.target.value)}><option>Avaliar</option><option>Manter</option><option>Suspender</option></select><button className="removeMedication" onClick={()=>save(medications.filter(m=>m.id!==item.id))}>×</button></div>
    <div className="medicationGrid">
      <label><span>Dose</span><input value={item.dose} onChange={e=>update(item.id,"dose",e.target.value)} placeholder="Ex.: 50 mg"/></label>
      <label><span>Frequência</span><input value={item.frequencia} onChange={e=>update(item.id,"frequencia",e.target.value)} placeholder="Ex.: 1x/dia"/></label>
      <label><span>Última dose tomada</span><input value={item.ultimaDose} onChange={e=>update(item.id,"ultimaDose",e.target.value)} placeholder="Data/hora"/></label>
      <label><span>Indicação</span><input value={item.indicacao} onChange={e=>update(item.id,"indicacao",e.target.value)} placeholder="Opcional"/></label>
      <label className="wide"><span>Orientação médica confirmada</span><input value={item.orientacao} onChange={e=>update(item.id,"orientacao",e.target.value)} placeholder="Registrar somente após avaliação individual"/></label>
    </div>
  </section>)}
  <section className="evalSection"><h2>Resumo dos medicamentos</h2><div className="medicationSummary">{groups.map(([label,items])=><div key={label}><strong>{label}</strong>{items.length?items.map(m=><span key={m.id}>• {m.nome}{m.dose?` ${m.dose}`:""}</span>):<span>— nenhum —</span>}</div>)}</div></section></>;
}

function ToggleChips({title,items,draft,set,prefix}:{title:string;items:string[];draft:Draft;set:(name:string,value:string|boolean)=>void;prefix:string}) {
  return <div className="examChipGroup"><strong>{title}</strong><div>{items.map(item=>{const key=`${prefix}_${item.toLowerCase().replace(/\W+/g,"_")}`;return <button className={draft[key]===true?"selected":""} onClick={()=>set(key,draft[key]!==true)} key={item}>{item}</button>})}</div></div>;
}
function PhysicalExam({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const field=(name:string,label:string,type="text")=><label className="evalField"><span>{label}</span><input type={type} value={String(draft[name]??"")} onChange={e=>set(name,e.target.value)}/></label>;
  return <section className="evalSection"><h1>5 · Exame físico</h1><div className="physicalGrid">
    {field("pa_sistolica","PA sistólica (mmHg)","number")}{field("pa_diastolica","PA diastólica (mmHg)","number")}{field("fc","FC (bpm)","number")}{field("fr","FR (irpm)","number")}{field("spo2","SpO₂ (%)","number")}{field("temperatura","Temperatura (°C)","number")}
    {field("glicemia_capilar","Glicemia capilar (mg/dL)","number")}{field("estado_geral","Estado geral")}{field("consciencia","Nível de consciência")}{field("orientacao","Orientação")}{field("circ_cervical","Circunf. cervical (cm)","number")}{field("circ_abdominal","Circunf. abdominal (cm)","number")}
    <label className="evalField wide3"><span>Ausculta cardíaca — observações</span><input value={String(draft.ausculta_cardiaca??"")} onChange={e=>set("ausculta_cardiaca",e.target.value)}/></label>
    <label className="evalField wide3"><span>Ausculta pulmonar — observações</span><input value={String(draft.ausculta_pulmonar??"")} onChange={e=>set("ausculta_pulmonar",e.target.value)}/></label>
    {field("edema","Edema")}<label className="evalField wide5"><span>Observações</span><input value={String(draft.exame_obs??"")} onChange={e=>set("exame_obs",e.target.value)}/></label>
  </div>
  <ToggleChips title="EXAME CARDIOVASCULAR" prefix="cardio" items={["Bulhas normofonéticas","Sopro","Arritmia","Edema","Turgência jugular","Pulsos diminuídos","Perfusão lentificada"]} draft={draft} set={set}/>
  <ToggleChips title="EXAME RESPIRATÓRIO" prefix="resp" items={["MV preservado","Sibilos","Roncos","Estertores","Estridor","Musculatura acessória","Tosse","Dispneia"]} draft={draft} set={set}/>
  <ToggleChips title="DISPOSITIVOS IMPLANTÁVEIS" prefix="dispositivo" items={["Marca-passo","CDI","Cateter venoso implantado","Fístula AV","Prótese valvar","Estoma"]} draft={draft} set={set}/>
  </section>;
}

function Airway({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const predictors=["Retrognatia/micrognatia","Macroglossia","Pescoço curto","Barba","Massa cervical","Radioterapia cervical prévia","Cirurgia cervical prévia","História de intubação difícil","Dificuldade de ventilação prévia","Traqueostomia","Apneia do sono"];
  const key=(item:string)=>`via_${item.toLowerCase().replace(/\W+/g,"_")}`;
  const count=predictors.filter(item=>draft[key(item)]===true).length;
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

function ComplementaryExams({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const fields=[["hemoglobina","Hemoglobina (g/dL)"],["hematocrito","Hematócrito (%)"],["plaquetas","Plaquetas"],["inr","INR"],["ttpa","TTPa (s)"],["creatinina","Creatinina (mg/dL)"],["glicemia","Glicemia (mg/dL)"],["hba1c","HbA1c (%)"],["ureia","Ureia (mg/dL)"],["potassio","Potássio (mEq/L)"],["sodio","Sódio (mEq/L)"],["ecg","ECG — resumo"]];
  return <section className="evalSection"><h1>7 · Exames complementares</h1><p className="evalHint">Valores de referência não são validados automaticamente. Registre apenas resultados conferidos e anexe os documentos correspondentes quando disponíveis.</p><div className="examResultsGrid">{fields.map(([name,label])=><label className="evalField" key={name}><span>{label}</span><input value={String(draft[name]??"")} onChange={e=>set(name,e.target.value)}/></label>)}</div><label className="evalField"><span>Outros exames e observações</span><textarea rows={5} value={String(draft.exames_obs??"")} onChange={e=>set("exames_obs",e.target.value)}/></label></section>;
}
