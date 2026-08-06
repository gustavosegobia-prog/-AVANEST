"use client";

import {useMemo,useState} from "react";
import {createClient} from "@/utils/supabase/client";
import {MEDICATION_ORIENTATION_ACTIONS} from "@/lib/medication-guide";
import {suspensionSummary} from "@/lib/medication-summary";
import {BrandMark} from "@/components/brand-mark";

type Data=Record<string,string|boolean>;
type Props={
  avaliacao:{id:string;institution_id:string;patient_id:string;status:string;versao:number;dados:Data|null;snapshot_conclusao:Data|null;created_at:string;updated_at:string;concluida_at:string|null};
  paciente:{id:string;nome:string;cpf:string|null;data_nascimento:string|null;sexo:string|null;telefone:string|null;email:string|null;hospital:string|null;cirurgia:string|null;procedimento:string|null;convenio:string|null};
  perfil:{id:string;nome:string;crm:string|null;rqe:string|null;role:string;permissoes?:string[]|null};
  organizacao:{nome:string;tipo:string|null;telefone:string|null;logo_url?:string|null}|null;
};
type Medication={id:string;nome:string;dose:string;frequencia:string;conduta:string;orientacao:string;reinicio?:string;fonte?:string;confirmada?:boolean;orientacaoEditada?:boolean};

// Os três primeiros são os que a tela pergunta hoje. Os demais saíram do
// formulário, mas continuam sendo impressos quando têm conteúdo: avaliações
// já concluídas os têm preenchidos, e a ficha delas precisa seguir mostrando
// o que o anestesiologista de fato registrou. Em avaliação nova eles nascem
// vazios e o filtro de conteúdo os descarta sozinho.
const PREGNANCY_PRINT_FIELDS:Array<[string,string]>=[
  ["gestacao_idade_gestacional","Idade gestacional"],
  ["gestacao_historia_obstetrica","História obstétrica"],
  ["gestacao_intercorrencias","Intercorrências"],
  ["gestacao_dheg","DHEG"],
  ["gestacao_diabetes","Diabetes gestacional"],
  ["gestacao_numero_gestacoes","Gestações"],
  ["gestacao_partos_normais","Partos normais"],
  ["gestacao_cesarianas","Cesarianas"],
  ["gestacao_abortos","Abortos"],
];

const formatDate=(value?:string|null)=>value?new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"";
// A pergunta já termina com "?" na tela; no papel ela vira rótulo de uma linha
// só ("Doença cardiovascular: Não"), então a interrogação sai.
const asLabel=(label:string)=>label.replace(/\s*\?\s*$/,"");
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
  // Suspender vira uma linha só, com o prazo mais longo que o guia admite. Quem
  // lê a ficha precisa da data, não do raciocínio que levou até ela — esse fica
  // na tela da avaliação, onde o anestesiologista decide.
  if(String(medication.conduta||"").trim().toLowerCase()==="suspender"){
    const resumo=suspensionSummary(medication.nome);
    if(resumo)return resumo;
  }
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

// Bloco corrido, para aproveitar a largura da folha: os campos preenchidos
// saem numa linha só, separados por barra, e quebram sozinhos quando falta
// espaço. Cada "linha" recebida vira um parágrafo; "extras" ficam embaixo,
// porque são textos longos (observações) que não cabem ao lado dos demais.
function PaperInlineBlock({title,linhas,extras=[]}:{title:string;linhas:Fact[][];extras?:Fact[]}){
  const preenchidas=linhas.filter(linha=>linha.length);
  if(!preenchidas.length&&!extras.length)return null;
  return <>
    <PaperTitle>{title}</PaperTitle>
    <div className="paperInlineBlock">
      {preenchidas.map((linha,indice)=>
        <p className="paperInline" key={indice}>{linha.map((fact,posicao)=>
          <span key={fact.label}>{posicao>0&&<em className="paperSep">|</em>}{fact.label}: <b>{fact.value}</b></span>)}
        </p>)}
      {extras.map(fact=>
        <p className="paperInlineFull" key={fact.label}>{fact.label}: <b>{fact.value}</b></p>)}
    </div>
  </>;
}

const CONSENT_ITEMS=[
  "Foi claramente exposto a mim que as condutas propostas serão conduzidas de acordo com os princípios éticos básicos de respeito pelo ser humano, da maximização de benefícios e minimização de danos ou prejuízos esperados e pela obrigação de tratamento moralmente certo e adequado, buscando sempre dar a cada um aquilo que é de direito.",
  "Por decisão voluntária, tomada após um processo informativo e deliberativo sobre a natureza, consequência e riscos dos procedimentos a serem realizados, aceito o fato de que qualquer procedimento anestésico poderá necessitar de procedimentos complementares, apesar dos cuidados, esforços e perícia dos profissionais responsáveis envolvidos, bem como, em princípio, não existem anestesias mais ou menos simples, pois todas representam, embora de forma relativa, um risco de vida.",
  "Aceito o fato de que o tabagismo, o uso do álcool ou de drogas são fatores que, embora não impeçam a realização de anestesias, podem determinar a incidência maior das complicações descritas acima.",
  "Reconheço que, durante o curso do ato anestésico, existem aspectos que não podem ser previamente identificados e, por isso, eventualmente necessitam procedimentos adicionais e diferentes dos inicialmente programados e combinados. Por isto estou ciente e autorizo o médico anestesiologista, bem como os seus assistentes ou os seus designados, a realizar qualquer técnica ou tratamento necessário para a condução do ato anestésico, incluindo, mas não limitando, procedimentos de remoção de urgência e terapia intensiva em outras instituições.",
  "Entendo que o médico anestesiologista e toda a sua equipe se obrigam unicamente a usar todos os meios científicos à sua disposição para tentar, com sua arte, atingir um fim desejado, porém não certo. Assim, por estar consciente que a medicina não é uma ciência exata e que é impossível prever-se resultados em quaisquer práticas anestésicas, aceito o fato de que não me podem ser dadas garantias de resultado nos procedimentos anestesiológicos propostos.",
  "Compreendo que no dia da cirurgia pode ser outro médico anestesista que vai aplicar a anestesia, diferente do que me avaliou, por motivo de agendamento ou plantão definido por escala. Se for outro anestesista, estou ciente que ele lerá esta avaliação e seguirá os preceitos éticos e profissionais para segurança anestésica.",
  "Se minha cirurgia for realizada em Hospital Escola, aceito o fato de que pode haver contato com Médicos Residentes em Especialização auxiliando no meu tratamento, sempre sob supervisão do Médico Anestesiologista Assistente.",
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

export function PrintDocuments({avaliacao,paciente,perfil,organizacao}:Props){
  const dados=avaliacao.snapshot_conclusao||avaliacao.dados||{};
  // O papel que chega na mão do paciente leva o nome de quem atende, não o da
  // plataforma. Para o anestesiologista sozinho, o nome da organização é
  // "Fulano — Individual"; o sufixo é controle interno e não vai para o papel.
  const clinica=organizacao
    ?(organizacao.tipo==="individual"
      ?organizacao.nome.replace(/\s*[—-]\s*Individual$/i,"").trim()
      :organizacao.nome).trim()
    :"";
  // Organização com marca cadastrada imprime a marca; sem ela, o cabeçalho
  // segue com o nome em texto, como sempre foi.
  const logo=String(organizacao?.logo_url||"").trim();
  const assignedPermissions=Array.isArray(perfil.permissoes)?perfil.permissoes:[];
  const hasLegacyFullAccess=["admin","owner"].includes(perfil.role)||assignedPermissions.includes("todos");
  const canManage=hasLegacyFullAccess||perfil.role==="admin"||assignedPermissions.includes("admin");
  const canFinance=hasLegacyFullAccess||perfil.role==="financeiro"||assignedPermissions.includes("financeiro");
  const canReception=hasLegacyFullAccess||perfil.role==="recepcao"||assignedPermissions.includes("recepcao");
  const canMedical=hasLegacyFullAccess||perfil.role==="medico"||assignedPermissions.includes("medico");
  const [selected,setSelected]=useState({assessment:true,consent:true,guidance:false});
  const [notice,setNotice]=useState("");
  const [hasPrinted,setHasPrinted]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [deleteError,setDeleteError]=useState("");

  async function deleteAssessment(){
    setDeleting(true);
    setDeleteError("");
    try{
      const response=await fetch(`/api/avaliacoes/${avaliacao.id}`,{method:"DELETE"});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){
        setDeleteError(result.error||"Não foi possível excluir a avaliação.");
        setDeleting(false);
        return;
      }
      window.location.href="/dashboard?area=medico";
    }catch{
      setDeleteError("Falha de conexão ao excluir a avaliação. Tente novamente.");
      setDeleting(false);
    }
  }
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
    ["Doença respiratória?",dados.respiratoria,dados.respiratoria_detalhes],
    ["Diabetes?",dados.diabetes,dados.diabetes_detalhes],
    ["Doença neurológica ou psiquiátrica?",dados.neurologica,dados.neurologica_detalhes],
    ["Outras doenças?",dados.outras_doencas,dados.outras_doencas_detalhes],
    ["Doença aguda no momento?",dados.doenca_aguda,dados.doenca_aguda_detalhes],
    ["Prótese ou alterações dentárias?",dados.dentaria,dados.dentaria_detalhes],
    ["Alergias?",dados.alergias,dados.alergias_detalhes],
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

  // Na ficha, as orientações cobrem apenas os medicamentos suspensos ou
  // individualizados; os mantidos aparecem na lista de medicamentos em uso.
  const guidedMedications=medications.filter(item=>MEDICATION_ORIENTATION_ACTIONS.includes(item.conduta));
  const planManuallyEdited=dados.plano_anestesico_editado===true;
  const printablePlan=useMemo(()=>{
    const saved=String(dados.plano_anestesico||"").trim();
    // Texto reescrito pelo anestesiologista é impresso exatamente como foi salvo.
    // O bloco automático de medicamentos só é reconstruído quando não houve edição.
    if(planManuallyEdited)return saved;
    const base=saved.replace(/\n?ORIENTAÇÕES SOBRE MEDICAMENTOS:[\s\S]*$/i,"").trim();
    const objectiveMedications=guidedMedications.length
      // objectiveMedicationGuidance já respeita o texto reescrito e, quando não
      // houve reescrita, usa a conduta do guia. Antes daqui saía o nome do
      // medicamento seguido de nada sempre que ninguém tivesse editado à mão.
      ?`ORIENTAÇÕES SOBRE MEDICAMENTOS:\n${guidedMedications
          .map(item=>[item.nome,objectiveMedicationGuidance(item)].filter(Boolean).join(": "))
          .map(linha=>`- ${linha}`).join("\n")}`
      :"";
    return [base,objectiveMedications].filter(Boolean).join("\n");
  },[guidedMedications,dados.plano_anestesico,planManuallyEdited]);
  const guidanceMessage=[
    `Olá, ${paciente.nome}. Seguem suas orientações pré-anestésicas.`,
    `Cirurgia: ${text(dados.cirurgia||paciente.cirurgia||paciente.procedimento,"a confirmar")}.`,
    `Jejum de sólidos: ${text(dados.jejum_solidos,"a confirmar")}.`,
    `Líquidos claros: ${text(dados.jejum_liquidos,"a confirmar")}.`,
    "Antes de entrar na sala cirúrgica, retire piercings e próteses ou dentaduras removíveis.",
    guidedMedications.length?`Medicamentos:\n${guidedMedications.map(item=>{const guidance=objectiveMedicationGuidance(item);return `• ${item.nome}${guidance?`: ${guidance}`:""}`}).join("\n")}`:"",
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
      <div className="documentsHeading"><h1>Documentos para impressão</h1><div><a className="outlineClinical" href={`/avaliacoes/${avaliacao.id}?editar=1`}>← Voltar e corrigir avaliação</a>{/* A concluída só abre nesta tela, então excluir precisa existir aqui —
        era por isso que a opção "sumia" depois da conclusão. */}
      {["medico","admin","owner"].includes(perfil.role)&&!confirmDelete&&<button type="button" className="deleteAssessmentButton" onClick={()=>setConfirmDelete(true)}>Excluir avaliação</button>}</div></div>
      {confirmDelete&&<div className="deleteConfirmStrip" role="alertdialog" aria-label="Confirmar exclusão da avaliação">
        <p><b>Tem certeza de que deseja excluir esta avaliação?</b> Esta ação não poderá ser desfeita. O cadastro do paciente será mantido.</p>
        <div>
          <button type="button" onClick={()=>{setConfirmDelete(false);setDeleteError("")}} disabled={deleting}>Cancelar</button>
          <button type="button" className="perigo" onClick={deleteAssessment} disabled={deleting}>{deleting?"Excluindo...":"Excluir avaliação"}</button>
        </div>
      </div>}
      {deleteError&&<p className="deleteAssessmentError" role="alert">{deleteError}</p>}
      <div className="documentInfo">Paciente: <b>{paciente.nome}</b> · Avaliação de {formatDate(avaliacao.concluida_at||avaliacao.updated_at)} · {text(dados.anestesiologista,perfil.nome)} ({text(dados.crm,perfil.crm||"CRM não informado")})</div>
      <div className="documentsLayout"><div className="paperStack">
        <article className={`printPaper assessmentPaper ${selected.assessment?"":"notSelected"}`}><header className="assessmentHeader"><span>{logo
            // eslint-disable-next-line @next/next/no-img-element -- papel impresso: a imagem precisa sair no tamanho original, sem otimização nem carregamento tardio.
            ?<img className="paperLogo" src={logo} alt={clinica||"Logo da organização"}/>
            :<b>{clinica||"Avaliação Pré-Anestésica"}</b>}</span><strong>FICHA DE AVALIAÇÃO PRÉ-ANESTÉSICA</strong><small>AVA-{avaliacao.id.slice(0,8)} · v{avaliacao.versao}</small></header>{dados.alergias==="Sim"&&dados.alergias_detalhes&&<div className="paperAllergy">⚠ ALERGIA: {text(dados.alergias_detalhes).toUpperCase()}</div>}
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
          {/* Resposta seca (o "Não" da maioria das perguntas) flui na mesma
              linha da seguinte; pergunta com detalhe ocupa a linha inteira.
              Numa anamnese normal quase tudo é "Não", e uma linha por resposta
              gastava meia página em espaço branco — a ordem das perguntas não
              muda, só o quanto elas ocupam. */}
          {questions.length>0&&<><PaperTitle>ANAMNESE</PaperTitle>
            <div className="paperAnamnese">{questions.map(([label,value,detail])=>{
              const comDetalhe=hasText(detail);
              // Pergunta e resposta em elementos próprios: é o que permite ao
              // CSS alinhar todos os Sim/Não numa coluna só, em vez de cada um
              // parar onde a pergunta terminou.
              return <p key={String(label)} className={comDetalhe?"anamneseDetalhada":undefined}>
                <span>{asLabel(String(label))}:</span>
                <b>{text(value)}{comDetalhe?` — ${text(detail)}`:""}</b>
              </p>;
            })}
            </div></>}
          <PaperInlineBlock title="EXAME FÍSICO"
            linhas={[
              facts([
                ["PA",hasText(dados.pa_sistolica)&&hasText(dados.pa_diastolica)?`${text(dados.pa_sistolica)}/${text(dados.pa_diastolica)} mmHg`:""],
                ["FC",hasText(dados.fc)?`${text(dados.fc)} bpm`:""],["FR",hasText(dados.fr)?`${text(dados.fr)} irpm`:""],
                ["SpO₂",hasText(dados.spo2)?`${text(dados.spo2)}%`:""],["Temperatura",hasText(dados.temperatura)?`${text(dados.temperatura)} °C`:""],
                ["Glicemia capilar",hasText(dados.glicemia_capilar)?`${text(dados.glicemia_capilar)} mg/dL`:""],
              ]),
              facts([
                ["Estado geral",dados.estado_geral],
                ["Cardiovascular",cardiovascularFindings.join(", ")],
                ["Respiratório",respiratoryFindings.join(", ")],
              ]),
            ]}
            extras={facts([["Observações",dados.observacoes_exame_fisico]])}/>
          {/* Uma linha só. Separado em duas, "Mobilidade cervical" descia
              sozinho e gastava uma linha inteira da folha mesmo quando não
              havia preditor nenhum a registrar. Junto, os campos fluem e só
              quebram quando de fato não couberem. */}
          <PaperInlineBlock title="VIA AÉREA"
            linhas={[
              facts([
                ["Mallampati",dados.mallampati],["Abertura oral",dados.abertura_oral],
                ["Dist. tireomentoniana",dados.distancia_tireo],["Dentição",dados.denticao],
                ["Mobilidade cervical",dados.mobilidade],
                ["Risco sugerido",airwayCount>0?`${airwayRisk} (${airwayCount} preditor(es))`:""],
                ["Preditores",airwayPredictors.join(", ")],
              ]),
            ]}
            extras={facts([["Observações",dados.observacoes_via_aerea]])}/>
          <section className="paperMedicationSection"><PaperTitle>MEDICAMENTOS EM USO</PaperTitle>{medications.length?<p className="paperMedicationList">{medications.map((m,i)=><span key={m.id}>{i>0&&<em className="paperSep">|</em>}<b>{[m.nome,m.dose,m.frequencia].filter(Boolean).join(" ")}</b></span>)}</p>:<p className="paperEmpty">{dados.medicacao_continua==="Não"?"Paciente informa não fazer uso de medicação contínua ou eventual.":dados.medicacao_continua==="Não sabe"?"Uso de medicação não informado pelo paciente.":"Nenhum medicamento registrado nesta avaliação."}</p>}
            {/* Sai junto dos medicamentos, e não na anamnese, porque quem lê
                este bloco antes da indução está decidindo jejum: com GLP-1 em
                uso, a data da última dose é o dado que muda a conduta. */}
            {hasText(dados.glp1)&&<p className="paperGlp1">Caneta emagrecedora (GLP-1): <b>{text(dados.glp1)}</b>
              {hasText(dados.glp1_detalhes)&&<> · <b>{text(dados.glp1_detalhes)}</b></>}
              {hasText(dados.glp1_ultima_dose)&&<> · Última dose: <b>{formatDate(text(dados.glp1_ultima_dose))}</b></>}</p>}</section>
          <PaperInlineBlock title="EXAMES COMPLEMENTARES"
            linhas={[
              facts([
                ["Hb",dados.hemoglobina],["Ht",dados.hematocrito],["Plaquetas",dados.plaquetas],["INR",dados.inr],
                ["TTPa",dados.ttpa],["Creatinina",dados.creatinina],["Ureia",dados.ureia],["Glicemia",dados.glicemia],
                ["Sódio",dados.sodio],["Potássio",dados.potassio],["HbA1c",dados.hba1c],["Data",formatDate(text(dados.data_exames))],
              ]),
              facts([
                ["ECG",dados.ecg],["Ecocardiograma",dados.eco],
                ["Radiografia de tórax",dados.rx_torax],["Espirometria",dados.espirometria],
              ]),
            ]}
            extras={facts([["Outros exames",dados.exames_obs]])}/>
          <PaperTitle>ESCORES E ESTRATIFICAÇÃO</PaperTitle><div className="paperScores">{hasText(dados.asa)&&<span><small>ASA</small><b>{text(dados.asa)}{dados.asa_emergencia===true?" + E":""}</b></span>}<span><small>LEE (RCRI)</small><b>{rcriScore} pt - Classe {["I","II","III","IV"][Math.min(rcriScore,3)]} - evento cardíaco maior ~{["0,4%","0,9%","6,6%","11%"][Math.min(rcriScore,3)]}</b></span>{hasText(dados.cardio_parecer)&&dados.cardio_parecer!=="Sem avaliação"&&<span><small>CARDIOLOGISTA</small><b>{text(dados.cardio_parecer)}{hasText(dados.cardio_conduta)?` - ${text(dados.cardio_conduta)}`:""}</b></span>}<span><small>STOP-BANG</small><b>{stopScore}/8 - {stopScore<=2?"baixo risco":stopScore<=4?"risco intermediário":"alto risco"}</b></span><span><small>APFEL</small><b>{apfelScore}/4 - NVPO {apfelRisk}</b></span>{hasText(dados.capacidade_funcional)&&<span><small>CAPACIDADE FUNCIONAL</small><b>{text(dados.capacidade_funcional)}</b></span>}</div>
          <PaperBlock title="PLANEJAMENTO E CONCLUSÃO" items={facts([
            ["Jejum sólidos",dados.jejum_solidos],["Líquidos claros",dados.jejum_liquidos],
            ["Técnica anestésica",dados.tecnica],["Monitorização",dados.monitorizacao],
            ["Pré-medicação",dados.premedicacao],["UTI",dados.leito_uti],
            ["Hemoderivados",["Sim","Solicitar"].includes(text(dados.concentrado_hemacias))?`${text(dados.concentrado_hemacias)}${hasText(dados.quantidade_ch)?` — ${text(dados.quantidade_ch)} CH`:""}`:dados.concentrado_hemacias],
            ["Avaliação especializada",dados.avaliacao_especializada,"wide"],
            ["Conclusão",dados.conclusao,"wide"],
          ])}/>
          {hasText(printablePlan)&&<p className="paperObservations">{text(printablePlan)}</p>}<PaperSignature dados={dados} perfil={perfil}/></article>

        <article className={`printPaper consentPaper officialConsent ${selected.consent?"":"notSelected"}`}><header><span>{(clinica||"SERVIÇO DE ANESTESIOLOGIA").toUpperCase()}</span></header><h2>TERMO DE CONSENTIMENTO ANESTÉSICO</h2><h3>PÓS-INFORMAÇÃO, DECISÃO E ORDEM ANTECIPADA DE TRATAMENTO E CUIDADOS MÉDICOS</h3>
          <p><b>1.</b> Por determinação explícita de minha vontade e em consideração ao meu interesse pessoal eu: <b>{paciente.nome}</b></p>
          <p>Por este termo autorizo {clinica?<b>{clinica}</b>:"o serviço de anestesiologia responsável pelo meu atendimento"} e os médicos anestesiologistas de sua equipe a realizar os procedimentos anestésicos necessários para a realização da cirurgia à qual, no momento, me proponho a realizar{hasText(paciente.hospital)?<>, no <b>{text(paciente.hospital)}</b></>:null}.</p>
          <ol start={2}>{CONSENT_ITEMS.slice(0,2).map(item=><li key={item}>{item}</li>)}</ol>
          <p><b>4. Os seguintes pontos me foram esclarecidos:</b></p><ul>{CONSENT_RISKS.map(item=><li key={item}>{item}</li>)}</ul>
          <ol start={5}>{CONSENT_ITEMS.slice(2).map(item=><li key={item}>{item}</li>)}</ol>
          <h4>AUTORIZAÇÃO</h4><p>Entendo que os meios utilizados visando assegurar a compreensão adequada das informações foram observados e, embora sendo sabedor(a) de que os procedimentos aos quais me submeterei, além de serem de risco, poderão ocasionar as alterações descritas acima e limitação das minhas atividades cotidianas por um período indeterminado de tempo, aceito e autorizo que os profissionais acima designados realizem os procedimentos constantes neste termo de autorização.</p>
          <div className="consentSignatures"><span>PACIENTE: ___________________________________________<br/><small>Assinar escrevendo o nome por extenso</small><br/>Data: ____/____/________</span><span>TESTEMUNHA: _______________________________________<br/><small>Assinar escrevendo o nome por extenso</small><br/>Data: ____/____/________</span></div>
        </article>

        <article className={`printPaper guidancePaper ${selected.guidance?"":"notSelected"}`}><header><span>{clinica||"Orientações ao paciente"}</span></header><h2>Orientações Pré-Anestésicas</h2><p>Paciente: <b>{paciente.nome}</b> · Anestesiologista: <b>{text(dados.anestesiologista,perfil.nome)}</b></p><PaperTitle>MEDICAMENTOS</PaperTitle>{medications.length?<table className="paperTable"><thead><tr><th>MEDICAMENTO</th><th>ORIENTAÇÃO DEFINIDA PELO ANESTESIOLOGISTA</th></tr></thead><tbody>{medications.map(m=><tr key={m.id}><td><b>{m.nome}</b></td><td><b>{objectiveMedicationGuidance(m)||"A definir pelo anestesiologista"}</b></td></tr>)}</tbody></table>:<p>Não há medicamentos registrados nesta avaliação.</p>}
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
function PaperSignature({dados,perfil}:{dados:Data;perfil:Props["perfil"]}){
  // O RQE é o registro da especialidade: sai na assinatura de quem o tem
  // cadastrado, e some para quem não tem, sem deixar rótulo órfão no papel.
  // O prefixo não é repetido quando quem preencheu já escreveu "RQE" junto
  // do número — o campo aceita as duas formas.
  const rqeBruto=String(dados.rqe??"").trim()||String(perfil.rqe??"").trim();
  const rqe=hasText(rqeBruto)?(/^rqe\b/i.test(rqeBruto)?rqeBruto:`RQE ${rqeBruto}`):"";
  return <div className="paperSignature"><span>________________________________________<br/>
    <b>{text(dados.anestesiologista,perfil.nome)}</b> — {text(dados.crm,perfil.crm||"CRM não informado")}{rqe?` · ${rqe}`:""}<br/>
    Anestesiologista</span></div>;
}
function DocChoice({checked,onChange,title,detail}:{checked:boolean;onChange:(v:boolean)=>void;title:string;detail:string}){return <label className={`docChoice ${checked?"selected":""}`}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span><b>{title}</b><small>{detail}</small></span></label>}
