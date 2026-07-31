"use client";

import {useMemo,useState} from "react";
import {createClient} from "@/utils/supabase/client";
import {BrandMark} from "@/components/brand-mark";

type Data=Record<string,string|boolean>;
type Props={
  avaliacao:{id:string;institution_id:string;patient_id:string;status:string;versao:number;dados:Data|null;snapshot_conclusao:Data|null;created_at:string;updated_at:string;concluida_at:string|null};
  paciente:{id:string;nome:string;cpf:string|null;data_nascimento:string|null;sexo:string|null;telefone:string|null;email:string|null;hospital:string|null;cirurgia:string|null;procedimento:string|null;convenio:string|null};
  perfil:{id:string;nome:string;crm:string|null;rqe:string|null;role:string;permissoes?:string[]|null};
};
type Medication={id:string;nome:string;dose:string;frequencia:string;conduta:string;orientacao:string;reinicio?:string;fonte?:string;confirmada?:boolean;orientacaoEditada?:boolean};

const PREGNANCY_PRINT_FIELDS:Array<[string,string]>=[
  ["gestacao_idade_gestacional","Idade gestacional"],
  ["gestacao_dheg","DHEG"],
  ["gestacao_diabetes","Diabetes gestacional"],
  ["gestacao_historia_obstetrica","História obstétrica"],
  ["gestacao_numero_gestacoes","Gestações"],
  ["gestacao_partos_normais","Partos normais"],
  ["gestacao_cesarianas","Cesarianas"],
  ["gestacao_abortos","Abortos"],
  ["gestacao_intercorrencias","Intercorrências"],
];

const formatDate=(value?:string|null)=>value?new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"";
const answer=(value:unknown,expected:"Sim"|"Não"|"Não sabe")=>value===expected?"X":"";
const text=(value:unknown,fallback="")=>{const raw=String(value??"").trim();return raw||fallback};
// Textos que representam ausência de informação: nunca vão para o papel.
const PRINT_PLACEHOLDERS=new Set([
  "—","-","--","selecione","nao informado","não informado","a definir","nenhum informado",
  "nenhum selecionado","sem achados selecionados","n/a","na",
]);
const hasText=(value:unknown)=>{
  const raw=String(value??"").trim();
  return raw.length>0&&!PRINT_PLACEHOLDERS.has(raw.toLowerCase());
};
const objectiveMedicationGuidance=(medication:Medication)=>{
  const written=String(medication.orientacao||"").trim();
  // O anestesiologista reescreveu a orientação: o papel reproduz exatamente o
  // texto salvo, sem reaplicar o texto padrão do guia.
  if(medication.orientacaoEditada===true&&written)return written;
  const guidance=(written||String(medication.conduta||"")).trim()
    .replace(/\s*(?:Reinício|Reintrodução|Mecanismo de ação|Justificativa|Fonte)\s*:.*$/i,"")
    .replace(/^Quando a interrupção for aceita,\s*/i,"")
    .trim();
  if(!guidance)return "";
  const sentence=guidance.charAt(0).toUpperCase()+guidance.slice(1);
  if(/^suspender\b/i.test(sentence)&&/\bantes\.?$/i.test(sentence)){
    return `${sentence.replace(/\bantes\.?$/i,"antes do procedimento").replace(/[.;]+$/,"")}.`;
  }
  return /[.!?]$/.test(sentence)?sentence:`${sentence}.`;
};

type Fact={label:string;value:string;span?:"wide"|"full"};
const facts=(items:Array<[string,unknown]|[string,unknown,"wide"|"full"]>):Fact[]=>
  items.filter(([,value])=>hasText(value)).map(([label,value,span])=>({label,value:text(value),span}));
function FactGrid({items,className=""}:{items:Fact[];className?:string}){
  if(!items.length)return null;
  return <div className={`paperExam ${className}`.trim()}>{items.map(fact=>
    <span key={fact.label} className={fact.span==="full"?"paperExamFull":fact.span==="wide"?"paperExamWide":undefined}>{fact.label}: <b>{fact.value}</b></span>)}</div>;
}
function PaperBlock({title,items,className}:{title:string;items:Fact[];className?:string}){
  if(!items.length)return null;
  return <><PaperTitle>{title}</PaperTitle><FactGrid items={items} className={className}/></>;
}

const CONSENT_ITEMS=[
  "Foi claramente exposto a mim que as condutas propostas serão conduzidas de acordo com os princípios éticos básicos de respeito pelo ser humano, da maximização de benefícios e minimização de danos ou prejuízos esperados e pela obrigação de tratamento moralmente certo e adequado, buscando sempre dar a cada um aquilo que é de direito.",
  "Por decisão voluntária, tomada após um processo informativo e deliberativo sobre a natureza, consequência e riscos dos procedimentos a serem realizados, aceito o fato de que qualquer procedimento anestésico poderá necessitar de procedimentos complementares, apesar dos cuidados, esforços e perícia dos profissionais responsáveis envolvidos, bem como, em princípio, não existem anestesias mais ou menos simples, pois todas representam, embora de forma relativa, um risco de vida.",
  "Aceito o fato de que o tabagismo, o uso do álcool ou de drogas são fatores que, embora não impeçam a realização de anestesias, podem determinar a incidência maior das complicações descritas acima.",
  "Reconheço que, durante o curso do ato anestésico, existem aspectos que não podem ser previamente identificados e, por isso, eventualmente necessitam procedimentos adicionais e diferentes dos inicialmente programados e combinados. Por isto estou ciente e autorizo o médico anestesiologista, bem como os seus assistentes ou os seus designados, a realizar qualquer técnica ou tratamento necessário para a condução do ato anestésico, incluindo, mas não limitando, procedimentos de remoção de urgência e terapia intensiva em outras instituições.",
  "Entendo que o médico anestesiologista e toda a sua equipe se obrigam unicamente a usar todos os meios científicos à sua disposição para tentar, com sua arte, atingir um fim desejado, porém não certo. Assim, por estar consciente que a medicina não é uma ciência exata e que é impossível prever-se resultados em quaisquer práticas anestésicas, aceito o fato de que não me podem ser dadas garantias de resultado nos procedimentos anestesiológicos propostos.",
  "Compreendo que no dia da cirurgia pode ser outro médico anestesista que vai aplicar a anestesia, diferente do que me avaliou, por motivo de agendamento ou plantão definido por escala. Se for outro anestesista, estou ciente que ele lerá esta avaliação e seguirá os preceitos éticos e profissionais para segurança anestésica.",
  "Se minha cirurgia for realizada no Hospital Santa Casa de Campo Mourão, aceito o fato de estar recebendo meu tratamento num Hospital Escola e que pode haver contato com Médicos Residentes em Especialização auxiliando no meu tratamento, sempre sob supervisão do Médico Anestesiologista Assistente.",
  "Concordo em cooperar com os médicos responsáveis pelo meu tratamento até o meu restabelecimento completo, aceitando e observando as determinações que me forem recomendadas, oral e/ou por escrito, pois assim não o fazendo poderei provocar a frustração dos fins desejados, pôr em perigo a minha saúde ou meu bem-estar, ou ocasionar sequelas temporárias ou permanentes.",
  "Autorizo o registro (em prontuário médico e/ou computador e/ou som, etc.) dos procedimentos necessários para a realização da anestesia proposta, sendo que todas as informações serão mantidas em estrito sigilo e divulgadas apenas àquelas que necessitam ou têm direito legal às mesmas.",
];
const CONSENT_RISKS=[
  "Dor de garganta, rouquidão, dentes fraturados com perda parcial ou total, sangramento nasal e oral em pequena quantidade e anestesia de partes da língua (intubação oro/nasotraqueal).",
  "Dor de cabeça, dores lombares, dores musculares, tonturas, vertigens, dificuldade respiratória e desmaios durante a recuperação anestésica e nos dias seguintes.",
  "Sede e fome devido ao tempo de jejum prolongado e/ou pelo uso de medicamentos.",
  "Dor nos locais de punções de veias e/ou artérias e flebites, devido aos materiais e medicamentos utilizados.",
  "Ardência nos olhos, úlceras de córnea, deslocamento de lentes e perda de pelos.",
  "Frio, tremores, áreas com falta de sensibilidade por vícios de postura ou após bloqueios, que poderão ser parciais ou totais por período indeterminado e, mesmo raríssimo, permanentes.",
  "Transtornos de comportamento afetivo e de memória, na forma de ansiedade e, apesar de raro, quadros psicológicos mais complexos.",
];

export function PrintDocuments({avaliacao,paciente,perfil}:Props){
  const dados=avaliacao.snapshot_conclusao||avaliacao.dados||{};
  const assignedPermissions=Array.isArray(perfil.permissoes)?perfil.permissoes:[];
  const hasLegacyFullAccess=["admin","owner"].includes(perfil.role)||assignedPermissions.includes("todos");
  const canManage=hasLegacyFullAccess||perfil.role==="admin"||assignedPermissions.includes("admin");
  const canFinance=hasLegacyFullAccess||perfil.role==="financeiro"||assignedPermissions.includes("financeiro");
  const canReception=hasLegacyFullAccess||perfil.role==="recepcao"||assignedPermissions.includes("recepcao");
  const canMedical=hasLegacyFullAccess||perfil.role==="medico"||assignedPermissions.includes("medico");
  const [selected,setSelected]=useState({assessment:true,consent:true,guidance:false});
  const [notice,setNotice]=useState("");
  const [hasPrinted,setHasPrinted]=useState(false);
  const medications=useMemo<Medication[]>(()=>{try{const v=JSON.parse(String(dados.medicamentos_json||"[]"));return Array.isArray(v)?v:[]}catch{return[]}},[dados.medicamentos_json]);
  const age=useMemo(()=>{if(!paciente.data_nascimento)return null;const birth=new Date(`${paciente.data_nascimento}T12:00:00`),now=new Date();return now.getFullYear()-birth.getFullYear()-(now<new Date(now.getFullYear(),birth.getMonth(),birth.getDate())?1:0)},[paciente.data_nascimento]);
  const weight=Number(dados.peso||0),height=Number(dados.altura||0),imc=weight&&height?weight/((height/100)**2):0;
  const heightInches=height/2.54;
  const idealWeight=height?Math.max(30,(String(dados.sexo||paciente.sexo).toLowerCase()==="masculino"?50:45.5)+2.3*(heightInches-60)):0;
  const adjustedWeight=idealWeight&&weight>idealWeight?idealWeight+0.4*(weight-idealWeight):(weight||idealWeight);
  const patientSex=String(dados.sexo||paciente.sexo||"").toLowerCase();
  const previousSurgeryDetails=[
    dados.cirurgias_anteriores_cirurgia||dados.cirurgias_anteriores_detalhes
      ? `Cirurgia: ${text(dados.cirurgias_anteriores_cirurgia||dados.cirurgias_anteriores_detalhes)}`
      : "",
    dados.cirurgias_anteriores_anestesia
      ? `Anestesia: ${text(dados.cirurgias_anteriores_anestesia)}`
      : "",
  ].filter(Boolean).join(" · ");
  const pregnancyDetails=PREGNANCY_PRINT_FIELDS
    .filter(([field])=>hasText(dados[field]))
    .map(([field,label])=>`${label}: ${text(dados[field])}`)
    .join(" · ");
  // Só entram na ficha as perguntas efetivamente respondidas.
  const questions=([
    ["Histórico cirúrgico / cirurgias prévias",dados.cirurgias_anteriores,previousSurgeryDetails],
    ["Reação ou complicação anestésica?",dados.reacao_anestesica,dados.reacao_anestesica_detalhes],
    ["Anticoagulante ou antiagregante?",dados.anticoagulante,dados.anticoagulante_detalhes],
    ["Doença cardiovascular?",dados.cardiovascular,dados.cardiovascular_detalhes],
    ["Doença respiratória?",dados.respiratoria,dados.respiratoria==="Não sabe"?"Não sabe informar doença respiratória.":dados.respiratoria_detalhes],
    ["Diabetes?",dados.diabetes,dados.diabetes_detalhes],
    ["Doença neurológica ou psiquiátrica?",dados.neurologica,dados.neurologica_detalhes],
    ["Outras doenças?",dados.outras_doencas,dados.outras_doencas_detalhes],
    ["Doença aguda no momento?",dados.doenca_aguda,dados.doenca_aguda_detalhes],
    ["Prótese ou alterações dentárias?",dados.dentaria,dados.dentaria_detalhes],
    ["Alergias?",dados.alergias,dados.alergias==="Não"?"Não relata alergias.":dados.alergias_detalhes],
    ["Tabagismo, álcool ou outras substâncias?",dados.habitos,dados.habitos_detalhes],
    ["Glaucoma?",dados.glaucoma,dados.glaucoma_detalhes],
    ["Gestante?",dados.gestacao,dados.gestacao==="Sim"?pregnancyDetails:dados.gestacao_detalhes],
  ] as Array<[string,unknown,unknown]>).filter(([label,value])=>
    hasText(value)&&(label!=="Gestante?"||patientSex==="feminino")
  );
  const toggleKey=(prefix:string,label:string)=>`${prefix}_${label.toLowerCase().replace(/\W+/g,"_")}`;
  const selectedToggleLabels=(prefix:string,labels:string[])=>labels.filter(label=>dados[toggleKey(prefix,label)]===true);
  const cardiovascularFindings=selectedToggleLabels("cardio",["Bulhas normofonéticas","Sopro","Arritmia","Edema","Turgência jugular","Pulsos diminuídos","Perfusão lentificada"]);
  const respiratoryFindings=selectedToggleLabels("resp",["MV preservado","Sibilos","Roncos","Estertores","Estridor","Musculatura acessória","Tosse","Dispneia"]);
  const implantedDevices=selectedToggleLabels("dispositivo",["Marca-passo","CDI","Cateter venoso implantado","Fístula AV","Prótese valvar","Estoma"]);
  const airwayPredictors=selectedToggleLabels("via",["Retrognatia/micrognatia","Macroglossia","Pescoço curto","Barba","Massa cervical","Radioterapia cervical prévia","Cirurgia cervical prévia","História de intubação difícil","Dificuldade de ventilação prévia","Traqueostomia","Apneia do sono"]);
  const checks=[
    ["Paciente identificado",Boolean(paciente.nome)],
    ["Anestesiologista e CRM preenchidos",Boolean(dados.anestesiologista&&dados.crm)],
    ["Técnica anestésica informada",Boolean(dados.tecnica)],
    ["Orientações de medicamentos revisadas",medications.length===0||medications.every(m=>m.confirmada===true)],
    ["Jejum orientado",Boolean(dados.jejum_solidos&&dados.jejum_liquidos)],
    ["Conclusão registrada",Boolean(dados.conclusao)],
  ] as [string,boolean][];
  const pending=checks.filter(([,ok])=>!ok).map(([label])=>label);
  const rcriScore=["rcri_alto_risco","rcri_coronaria","rcri_ic","rcri_cerebrovascular","rcri_insulina"].filter(key=>dados[key]===true).length+(Number(String(dados.creatinina||"").replace(",","."))>2?1:0);
  const stopScore=["stop_ronco","stop_cansaco","stop_apneia","stop_has"].filter(key=>dados[key]===true).length+
    (Number(dados.circ_cervical||0)>40?1:0)+(imc>35?1:0)+((age??0)>50?1:0)+(String(paciente.sexo||dados.sexo).toLowerCase()==="masculino"?1:0);
  const apfelScore=["apfel_historia","apfel_opioide"].filter(key=>dados[key]===true).length+
    (String(paciente.sexo||dados.sexo).toLowerCase()==="feminino"?1:0)+
    (String(dados.habitos||"")!=="Sim"||!String(dados.habitos_detalhes||"").toLowerCase().includes("tabag")?1:0);
  const apfelRisk=["10%","21%","39%","61%","79%"][apfelScore];
  const airwayCount=Object.keys(dados).filter(key=>key.startsWith("via_")&&dados[key]===true).length;
  const airwayRisk=airwayCount===0?"Baixa":airwayCount<=2?"Moderada":"Alta";

  const guidedMedications=medications.filter(item=>hasText(objectiveMedicationGuidance(item)));
  const planManuallyEdited=dados.plano_anestesico_editado===true;
  const printablePlan=useMemo(()=>{
    const saved=String(dados.plano_anestesico||"").trim();
    // Texto reescrito pelo anestesiologista é impresso exatamente como foi salvo.
    // O bloco automático de medicamentos só é reconstruído quando não houve edição.
    if(planManuallyEdited)return saved;
    const base=saved.replace(/\n?ORIENTAÇÕES SOBRE MEDICAMENTOS:[\s\S]*$/i,"").trim();
    const objectiveMedications=guidedMedications.length
      ?`ORIENTAÇÕES SOBRE MEDICAMENTOS:\n${guidedMedications.map(item=>`- ${item.nome}: ${objectiveMedicationGuidance(item)}`).join("\n")}`
      :"";
    return [base,objectiveMedications].filter(Boolean).join("\n");
  },[guidedMedications,dados.plano_anestesico,planManuallyEdited]);
  const guidanceMessage=[
    `Olá, ${paciente.nome}. Seguem suas orientações pré-anestésicas.`,
    `Cirurgia: ${text(dados.cirurgia||paciente.cirurgia||paciente.procedimento,"a confirmar")}.`,
    `Jejum de sólidos: ${text(dados.jejum_solidos,"a confirmar")}.`,
    `Líquidos claros: ${text(dados.jejum_liquidos,"a confirmar")}.`,
    "Antes de entrar na sala cirúrgica, retire piercings e próteses ou dentaduras removíveis.",
    guidedMedications.length?`Medicamentos:\n${guidedMedications.map(item=>`• ${item.nome}: ${objectiveMedicationGuidance(item)}`).join("\n")}`:"",
    "@useavanest",
  ].filter(Boolean).join("\n");

  async function printDocuments(){
    setNotice("");
    const entry={at:new Date().toISOString(),documents:Object.entries(selected).filter(([,v])=>v).map(([k])=>k)};
    await createClient().from("auditoria").insert({
      institution_id:avaliacao.institution_id,actor_id:perfil.id,entidade:"avaliacao",entidade_id:avaliacao.id,
      acao:"documentos_impressos",detalhes:entry,
    });
    window.print();
    setHasPrinted(true);
  }
  function openChannel(channel:"whatsapp"|"email"|"sms"){
    const message=encodeURIComponent(guidanceMessage);
    if(channel==="whatsapp"){
      const phone=(paciente.telefone||"").replace(/\D/g,""); if(!phone){setNotice("Cadastre o telefone do paciente antes de abrir o WhatsApp.");return}
      window.open(`https://wa.me/55${phone}?text=${message}`,"_blank","noopener,noreferrer");
    }else if(channel==="email"){
      if(!paciente.email){setNotice("Cadastre o e-mail do paciente antes de abrir a mensagem.");return}
      window.location.href=`mailto:${paciente.email}?subject=${encodeURIComponent("Orientações pré-anestésicas")}&body=${message}`;
    }else{
      const phone=(paciente.telefone||"").replace(/\D/g,""); if(!phone){setNotice("Cadastre o telefone do paciente antes de abrir o SMS.");return}
      window.location.href=`sms:${phone}?body=${message}`;
    }
  }

  return <main className="documentsShell">
    <header className="clinicalTopbar documentsTopbar"><a className="clinicalBrand" href="/dashboard"><BrandMark className="clinicalBrandMark"/><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></a><span className="docSaved">● Avaliação concluída</span><nav className="roleNav" aria-label="Áreas do sistema">{canReception&&<a href="/dashboard?area=recepcao">Recepção</a>}{canMedical&&<a href="/dashboard?area=medico">Médico</a>}{canFinance&&<a href="/dashboard?area=financeiro">Financeiro</a>}{canManage&&<a href="/dashboard?area=admin">Admin</a>}</nav></header>
    <div className="documentsMain">
      <div className="documentsHeading"><h1>Documentos para impressão</h1><div><a className="outlineClinical" href={`/avaliacoes/${avaliacao.id}?editar=1`}>← Voltar e corrigir avaliação</a></div></div>
      <div className="documentInfo">Paciente: <b>{paciente.nome}</b> · Avaliação de {formatDate(avaliacao.concluida_at||avaliacao.updated_at)} · {text(dados.anestesiologista,perfil.nome)} ({text(dados.crm,perfil.crm||"CRM não informado")})</div>
      <div className="documentsLayout"><div className="paperStack">
        <article className={`printPaper assessmentPaper ${selected.assessment?"":"notSelected"}`}><header className="assessmentHeader"><span><b>AVANEST</b> · Avaliação Pré-Anestésica</span><strong>FICHA DE AVALIAÇÃO PRÉ-ANESTÉSICA</strong><small>AVA-{avaliacao.id.slice(0,8)} · v{avaliacao.versao}</small></header>{dados.alergias==="Sim"&&dados.alergias_detalhes&&<div className="paperAllergy">⚠ ALERGIA: {text(dados.alergias_detalhes).toUpperCase()}</div>}
          <FactGrid className="paperIdentification" items={facts([
            ["Nome",paciente.nome,"wide"],["Idade",age!==null?`${age} anos`:""],["Sexo",paciente.sexo],
            ["Peso",weight?`${weight} kg`:""],["Altura",height?`${height} cm`:""],["IMC",imc?imc.toFixed(1):""],
            ["Peso ideal",idealWeight?`${idealWeight.toFixed(0)} kg`:""],["Peso ajustado",adjustedWeight?`${adjustedWeight.toFixed(0)} kg`:""],
            ["Convênio",paciente.convenio],["CPF",paciente.cpf],
          ])}/>
          <PaperBlock title="PROCEDIMENTO CIRÚRGICO" items={facts([
            ["Cirurgia proposta",dados.cirurgia||paciente.cirurgia||paciente.procedimento,"wide"],
            ["Cirurgião",dados.cirurgiao],["Hospital",dados.hospital||paciente.hospital],
            ["Caráter",dados.carater],["Porte",dados.porte],["Lateralidade",dados.lateralidade],
            ["Regime",dados.regime],["Data",formatDate(text(dados.data_cirurgia))],["Horário",dados.horario_cirurgia],
          ])}/>
          {questions.length>0&&<><PaperTitle>ANAMNESE</PaperTitle><table className="paperTable"><thead><tr><th>#</th><th>PERGUNTA / DETALHES</th><th>SIM</th><th>NÃO</th><th>?</th></tr></thead><tbody>{questions.map(([label,value,detail],i)=><tr key={String(label)}><td>{i+1}</td><td>{label} {hasText(detail)&&<b>— {text(detail)}</b>}</td><td>{answer(value,"Sim")}</td><td>{answer(value,"Não")}</td><td>{answer(value,"Não sabe")}</td></tr>)}</tbody></table></>}
          <PaperBlock title="EXAME FÍSICO" items={facts([
            ["PA",hasText(dados.pa_sistolica)&&hasText(dados.pa_diastolica)?`${text(dados.pa_sistolica)}/${text(dados.pa_diastolica)} mmHg`:""],
            ["FC",hasText(dados.fc)?`${text(dados.fc)} bpm`:""],["FR",hasText(dados.fr)?`${text(dados.fr)} irpm`:""],
            ["SpO₂",hasText(dados.spo2)?`${text(dados.spo2)}%`:""],["Temperatura",hasText(dados.temperatura)?`${text(dados.temperatura)} °C`:""],
            ["Glicemia capilar",hasText(dados.glicemia_capilar)?`${text(dados.glicemia_capilar)} mg/dL`:""],
            ["Estado geral",dados.estado_geral],
            ["Cardiovascular",cardiovascularFindings.join(", "),"wide"],
            ["Respiratório",respiratoryFindings.join(", "),"wide"],
            ["Dispositivos",implantedDevices.join(", "),"wide"],
            ["Observações",dados.observacoes_exame_fisico,"full"],
          ])}/>
          <PaperBlock title="VIA AÉREA" items={facts([
            ["Mallampati",dados.mallampati],["Abertura oral",dados.abertura_oral],
            ["Dist. tireomentoniana",dados.distancia_tireo],["Dentição",dados.denticao],
            ["Mobilidade cervical",dados.mobilidade],
            ["Risco sugerido",airwayCount>0?`${airwayRisk} (${airwayCount} preditor(es))`:""],
            ["Preditores",airwayPredictors.join(", "),"wide"],
            ["Observações",dados.observacoes_via_aerea,"full"],
          ])}/>
          <section className={`paperMedicationSection ${medications.length?"hasMedications":""}`}><PaperTitle>MEDICAMENTOS EM USO E ORIENTAÇÕES</PaperTitle>{medications.length?<table className="paperTable medicationPrintTable"><thead><tr><th>MEDICAMENTO</th><th>ORIENTAÇÃO DEFINIDA PELO ANESTESIOLOGISTA</th></tr></thead><tbody>{medications.map(m=><tr key={m.id}><td><b>{m.nome}</b></td><td>{objectiveMedicationGuidance(m)||"A definir pelo anestesiologista"}</td></tr>)}</tbody></table>:<p className="paperEmpty">{dados.medicacao_continua==="Não"?"Paciente informa não fazer uso de medicação contínua ou eventual.":dados.medicacao_continua==="Não sabe"?"Uso de medicação não informado pelo paciente.":"Nenhum medicamento registrado nesta avaliação."}</p>}</section>
          <PaperBlock title="EXAMES COMPLEMENTARES" className="labPrintGrid" items={facts([
            ["Hb",dados.hemoglobina],["Ht",dados.hematocrito],["Plaquetas",dados.plaquetas],["INR",dados.inr],
            ["TTPa",dados.ttpa],["Creatinina",dados.creatinina],["Ureia",dados.ureia],["Glicemia",dados.glicemia],
            ["Sódio",dados.sodio],["Potássio",dados.potassio],["HbA1c",dados.hba1c],["Data",formatDate(text(dados.data_exames))],
            ["ECG",dados.ecg,"wide"],["Ecocardiograma",dados.eco,"wide"],
            ["Radiografia de tórax",dados.rx_torax,"wide"],["Espirometria",dados.espirometria,"wide"],
            ["Outros exames",dados.exames_obs,"full"],
          ])}/>
          <PaperTitle>ESCORES E ESTRATIFICAÇÃO</PaperTitle><div className="paperScores">{hasText(dados.asa)&&<span><small>ASA</small><b>{text(dados.asa)}{dados.asa_emergencia===true?" + E":""}</b></span>}<span><small>LEE (RCRI)</small><b>{rcriScore} pt - Classe {rcriScore===0?"I":rcriScore===1?"II":rcriScore===2?"III":"IV"}</b></span><span><small>STOP-BANG</small><b>{stopScore}/8 - {stopScore<=2?"baixo risco":stopScore<=4?"risco intermediário":"alto risco"}</b></span><span><small>APFEL</small><b>{apfelScore}/4 - NVPO {apfelRisk}</b></span>{hasText(dados.capacidade_funcional)&&<span><small>CAPACIDADE FUNCIONAL</small><b>{text(dados.capacidade_funcional)}</b></span>}</div>
          <PaperBlock title="PLANEJAMENTO E CONCLUSÃO" items={facts([
            ["Jejum sólidos",dados.jejum_solidos],["Líquidos claros",dados.jejum_liquidos],
            ["Técnica anestésica",dados.tecnica],["Monitorização",dados.monitorizacao],
            ["Pré-medicação",dados.premedicacao],["UTI",dados.leito_uti],
            ["Hemoderivados",["Sim","Solicitar"].includes(text(dados.concentrado_hemacias))?`${text(dados.concentrado_hemacias)}${hasText(dados.quantidade_ch)?` — ${text(dados.quantidade_ch)} CH`:""}`:dados.concentrado_hemacias],
            ["Avaliação especializada",dados.avaliacao_especializada,"wide"],
            ["Conclusão",dados.conclusao,"wide"],
          ])}/>
          {hasText(printablePlan)&&<p className="paperObservations">{text(printablePlan)}</p>}<PaperSignature dados={dados} perfil={perfil}/></article>

        <article className={`printPaper consentPaper officialConsent ${selected.consent?"":"notSelected"}`}><header><span>INOVANEST — SERVIÇO DE ANESTESIOLOGIA DE CAMPO MOURÃO</span></header><h2>TERMO DE CONSENTIMENTO ANESTÉSICO</h2><h3>PÓS-INFORMAÇÃO, DECISÃO E ORDEM ANTECIPADA DE TRATAMENTO E CUIDADOS MÉDICOS</h3>
          <p><b>1.</b> Por determinação explícita de minha vontade e em consideração ao meu interesse pessoal eu: <b>{paciente.nome}</b></p>
          <p>Por este termo autorizo os anestesistas da equipe de anestesiologia INOVANEST que atuam com serviço de anestesia nos Hospitais de Campo Mourão a realizar os procedimentos anestésicos necessários para a realização da cirurgia à qual, no momento, me proponho a realizar.</p>
          <ol start={2}>{CONSENT_ITEMS.slice(0,2).map(item=><li key={item}>{item}</li>)}</ol>
          <p><b>4. Os seguintes pontos me foram esclarecidos:</b></p><ul>{CONSENT_RISKS.map(item=><li key={item}>{item}</li>)}</ul>
          <ol start={5}>{CONSENT_ITEMS.slice(2).map(item=><li key={item}>{item}</li>)}</ol>
          <h4>AUTORIZAÇÃO</h4><p>Entendo que os meios utilizados visando assegurar a compreensão adequada das informações foram observados e, embora sendo sabedor(a) de que os procedimentos aos quais me submeterei, além de serem de risco, poderão ocasionar as alterações descritas acima e limitação das minhas atividades cotidianas por um período indeterminado de tempo, aceito e autorizo que os profissionais acima designados realizem os procedimentos constantes neste termo de autorização.</p>
          <div className="consentSignatures"><span>PACIENTE: ___________________________________________<br/><small>Assinar escrevendo o nome por extenso</small><br/>Data: ____/____/________</span><span>TESTEMUNHA: _______________________________________<br/><small>Assinar escrevendo o nome por extenso</small><br/>Data: ____/____/________</span></div>
        </article>

        <article className={`printPaper guidancePaper ${selected.guidance?"":"notSelected"}`}><header><span>AVANEST — Orientações ao paciente</span></header><h2>Orientações Pré-Anestésicas</h2><p>Paciente: <b>{paciente.nome}</b> · Anestesiologista: <b>{text(dados.anestesiologista,perfil.nome)}</b></p><PaperTitle>MEDICAMENTOS</PaperTitle>{medications.length?<table className="paperTable"><thead><tr><th>MEDICAMENTO</th><th>ORIENTAÇÃO DEFINIDA PELO ANESTESIOLOGISTA</th></tr></thead><tbody>{medications.map(m=><tr key={m.id}><td><b>{m.nome}</b></td><td><b>{objectiveMedicationGuidance(m)||"A definir pelo anestesiologista"}</b></td></tr>)}</tbody></table>:<p>Não há medicamentos registrados nesta avaliação.</p>}
          <PaperBlock title="PLANEJAMENTO" items={facts([
            ["Tipo de anestesia prevista",dados.tecnica,"wide"],
            ["Jejum — sólidos",dados.jejum_solidos],["Jejum — líquidos claros",dados.jejum_liquidos],
            ["Pré-medicação",dados.premedicacao],["Leito de UTI",dados.leito_uti],
            ["Hemoderivados",["Sim","Solicitar"].includes(text(dados.concentrado_hemacias))?`${text(dados.concentrado_hemacias)}${hasText(dados.quantidade_ch)?` — ${text(dados.quantidade_ch)} CH`:""}`:""],
          ])}/>
          {hasText(printablePlan)&&<p>{text(printablePlan)}</p>}<PaperSignature dados={dados} perfil={perfil}/></article>
      </div>
      <aside className="documentsSidebar"><section><h3>Selecionar documentos</h3><DocChoice checked={selected.assessment} onChange={v=>setSelected(s=>({...s,assessment:v}))} title="Ficha de Avaliação Pré-Anestésica" detail="1 cópia — prontuário"/><DocChoice checked={selected.consent} onChange={v=>setSelected(s=>({...s,consent:v}))} title="Termo de Consentimento Anestésico" detail="1 cópia — assinatura e prontuário"/><DocChoice checked={selected.guidance} onChange={v=>setSelected(s=>({...s,guidance:v}))} title="Orientações Pré-Anestésicas" detail="1 cópia — entrega ao paciente"/></section>
        <section><h3>Verificação antes da impressão</h3><div className="documentChecks">{checks.map(([label,ok])=><span className={ok?"ok":"pending"} key={label}>{ok?"✓":"⚠"} {label}{!ok?" — pendente":""}</span>)}</div>{pending.length>0&&<div className="pendingNotice">Pendências não bloqueantes: {pending.join("; ")}. O documento exibirá “a definir” quando necessário.</div>}</section>
        <section><button className="printButton" disabled={!Object.values(selected).some(Boolean)} onClick={printDocuments}>▣ Imprimir PDF ({Object.values(selected).filter(Boolean).length} documentos)</button><p>Na janela que abrir, escolha “Salvar como PDF”. Cada documento selecionado será impresso em folha própria.</p>{hasPrinted&&<div className="postPrintActions"><a className="nextPatientButton" href="/dashboard?area=medico&novo=1&iniciar=1">Próximo paciente</a><a className="postPrintMenuButton" href="/dashboard?area=medico">Menu de avaliações</a></div>}<hr/><h4>Enviar orientações ao paciente</h4><button className="channelButton whatsapp" onClick={()=>openChannel("whatsapp")}>WhatsApp</button><button className="channelButton" onClick={()=>openChannel("email")}>E-mail</button><button className="channelButton sms" onClick={()=>openChannel("sms")}>SMS</button><p>Os atalhos abrem o aplicativo escolhido. Revise a mensagem e anexe o PDF antes de enviar.</p>{notice&&<div className="pendingNotice">{notice}</div>}</section>
      </aside></div>
    </div>
  </main>;
}

function PaperTitle({children}:{children:React.ReactNode}){return <h3 className="paperTitle">{children}</h3>}
function PaperSignature({dados,perfil}:{dados:Data;perfil:Props["perfil"]}){return <div className="paperSignature"><span>________________________________________<br/><b>{text(dados.anestesiologista,perfil.nome)}</b> — {text(dados.crm,perfil.crm||"CRM não informado")}<br/>Anestesiologista</span></div>}
function DocChoice({checked,onChange,title,detail}:{checked:boolean;onChange:(v:boolean)=>void;title:string;detail:string}){return <label className={`docChoice ${checked?"selected":""}`}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span><b>{title}</b><small>{detail}</small></span></label>}
