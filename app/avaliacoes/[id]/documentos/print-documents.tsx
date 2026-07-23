"use client";

import {useMemo,useState} from "react";
import {createClient} from "@/utils/supabase/client";

type Data=Record<string,string|boolean>;
type Props={
  avaliacao:{id:string;institution_id:string;patient_id:string;status:string;versao:number;dados:Data|null;created_at:string;updated_at:string;concluida_at:string|null};
  paciente:{id:string;nome:string;cpf:string|null;data_nascimento:string|null;sexo:string|null;telefone:string|null;email:string|null;hospital:string|null;cirurgia:string|null;procedimento:string|null;convenio:string|null};
  perfil:{id:string;nome:string;crm:string|null;rqe:string|null;role:string};
};
type Medication={id:string;nome:string;dose:string;frequencia:string;conduta:string;orientacao:string};

const formatDate=(value?:string|null)=>value?new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"—";
const answer=(value:unknown)=>value==="Sim"?"X":value==="Não"?"X":"";
const text=(value:unknown,fallback="—")=>String(value||fallback);

export function PrintDocuments({avaliacao,paciente,perfil}:Props){
  const dados=avaliacao.dados||{};
  const [selected,setSelected]=useState({assessment:true,consent:true,guidance:true});
  const [notice,setNotice]=useState("");
  const medications=useMemo<Medication[]>(()=>{try{const v=JSON.parse(String(dados.medicamentos_json||"[]"));return Array.isArray(v)?v:[]}catch{return[]}},[dados.medicamentos_json]);
  const age=useMemo(()=>{if(!paciente.data_nascimento)return null;const birth=new Date(`${paciente.data_nascimento}T12:00:00`),now=new Date();return now.getFullYear()-birth.getFullYear()-(now<new Date(now.getFullYear(),birth.getMonth(),birth.getDate())?1:0)},[paciente.data_nascimento]);
  const weight=Number(dados.peso||0),height=Number(dados.altura||0),imc=weight&&height?weight/((height/100)**2):0;
  const questions=[
    ["Já realizou alguma cirurgia?",dados.cirurgias_anteriores,dados.cirurgias_anteriores_detalhes],
    ["Reação ou complicação anestésica?",dados.reacao_anestesica,dados.reacao_anestesica_detalhes],
    ["Medicação contínua ou eventual?",dados.medicacao_continua,dados.medicacao_continua_detalhes],
    ["Anticoagulante ou antiagregante?",dados.anticoagulante,dados.anticoagulante_detalhes],
    ["Doença cardiovascular?",dados.cardiovascular,dados.cardiovascular_detalhes],
    ["Doença respiratória?",dados.respiratoria,dados.respiratoria_detalhes],
    ["Roncos ou apneia do sono?",dados.apneia,dados.apneia_detalhes],
    ["Diabetes?",dados.diabetes,dados.diabetes_detalhes],
    ["Doença neurológica ou psiquiátrica?",dados.neurologica,dados.neurologica_detalhes],
    ["Outras doenças?",dados.outras_doencas,dados.outras_doencas_detalhes],
    ["Doença aguda no momento?",dados.doenca_aguda,dados.doenca_aguda_detalhes],
    ["Prótese ou alterações dentárias?",dados.dentaria,dados.dentaria_detalhes],
    ["Alergias?",dados.alergias,dados.alergias_detalhes],
    ["Tabagismo, álcool ou outras substâncias?",dados.habitos,dados.habitos_detalhes],
    ["Glaucoma?",dados.glaucoma,dados.glaucoma_detalhes],
    ["Possibilidade de gestação?",dados.gestacao,dados.gestacao_detalhes],
  ];
  const checks=[
    ["Paciente identificado",Boolean(paciente.nome)],
    ["Anestesiologista e CRM preenchidos",Boolean(dados.anestesiologista&&dados.crm)],
    ["Técnica anestésica informada",Boolean(dados.tecnica)],
    ["Orientações de medicamentos revisadas",medications.length===0||medications.every(m=>m.orientacao||m.conduta!=="Avaliar")],
    ["Jejum orientado",Boolean(dados.jejum_solidos&&dados.jejum_liquidos)],
    ["Conclusão registrada",Boolean(dados.conclusao)],
  ] as [string,boolean][];
  const pending=checks.filter(([,ok])=>!ok).map(([label])=>label);

  async function printDocuments(){
    setNotice("");
    const entry={at:new Date().toISOString(),documents:Object.entries(selected).filter(([,v])=>v).map(([k])=>k)};
    const previous=(()=>{try{return JSON.parse(String(dados.document_generation_log||"[]"))}catch{return[]}})();
    await createClient().from("avaliacoes").update({dados:{...dados,document_generation_log:JSON.stringify([...previous,entry])}}).eq("id",avaliacao.id);
    window.print();
  }
  function openChannel(channel:"whatsapp"|"email"|"sms"){
    const message=encodeURIComponent(`Olá, ${paciente.nome}. Suas orientações pré-anestésicas do AVANEST estão disponíveis. Confirme com a equipe responsável as informações e horários do procedimento.`);
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
    <header className="clinicalTopbar documentsTopbar"><a className="clinicalBrand" href="/dashboard"><b>AV</b><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></a><span className="docSaved">● Avaliação concluída</span><nav className="roleNav"><button>◐ Escuro</button><button>Recepção</button><button>Médico</button><button>Financeiro</button><button>Admin</button><span className="roleBadge">ADMINISTRADOR</span></nav></header>
    <div className="documentsMain">
      <div className="documentsHeading"><h1>Documentos para impressão</h1><div><a className="outlineClinical" href={`/avaliacoes/${avaliacao.id}`}>← Voltar e corrigir avaliação</a></div></div>
      <div className="documentInfo">Paciente: <b>{paciente.nome}</b> · Avaliação de {formatDate(avaliacao.concluida_at||avaliacao.updated_at)} · {text(dados.anestesiologista,perfil.nome)} ({text(dados.crm,perfil.crm||"CRM não informado")})</div>
      <div className="documentsLayout"><div className="paperStack">
        <article className={`printPaper ${selected.assessment?"":"notSelected"}`}><header><span>AVANEST — Avaliação Pré-Anestésica</span><small>AVA-{avaliacao.id.slice(0,8)} · v{avaliacao.versao}</small></header><h2>FICHA DE AVALIAÇÃO PRÉ-ANESTÉSICA</h2>{dados.alergias_detalhes&&<div className="paperAllergy">⚠ ALERGIA: {text(dados.alergias_detalhes).toUpperCase()}</div>}
          <div className="paperPatientGrid"><span>Nome: <b>{paciente.nome}</b></span><span>Idade: <b>{age??"—"} anos</b></span><span>Sexo: <b>{text(paciente.sexo)}</b></span><span>Peso: <b>{weight||"—"} kg</b></span><span>Altura: <b>{height||"—"} cm</b></span><span>IMC: <b>{imc?imc.toFixed(1):"—"}</b></span><span>Convênio: <b>{text(paciente.convenio)}</b></span></div>
          <PaperTitle>PROCEDIMENTO CIRÚRGICO</PaperTitle><div className="paperColumns"><p>Cirurgia proposta: <b>{text(dados.cirurgia||paciente.cirurgia||paciente.procedimento)}</b><br/>Hospital: <b>{text(dados.hospital||paciente.hospital)}</b><br/>Caráter: <b>{text(dados.carater)}</b></p><p>Cirurgião: <b>{text(dados.cirurgiao)}</b><br/>Data: <b>{formatDate(text(dados.data_cirurgia,""))}</b><br/>Técnica planejada: <b>{text(dados.tecnica)}</b></p></div>
          <PaperTitle>ANAMNESE</PaperTitle><table className="paperTable"><thead><tr><th>#</th><th>PERGUNTA / DETALHES</th><th>SIM</th><th>NÃO</th><th>?</th></tr></thead><tbody>{questions.map(([label,value,detail],i)=><tr key={String(label)}><td>{i+1}</td><td>{label} {detail&&<b>— {text(detail)}</b>}</td><td>{answer(value)}</td><td>{value==="Não"?"X":""}</td><td>{value==="Não sabe"?"X":""}</td></tr>)}</tbody></table>
          <PaperTitle>EXAME FÍSICO E VIA AÉREA</PaperTitle><div className="paperExam"><span>PA: <b>{text(dados.pa_sistolica)}/{text(dados.pa_diastolica)} mmHg</b></span><span>FC: <b>{text(dados.fc)} bpm</b></span><span>SpO₂: <b>{text(dados.spo2)}%</b></span><span>Temperatura: <b>{text(dados.temperatura)} °C</b></span><span>Mallampati: <b>{text(dados.mallampati)}</b></span><span>Abertura oral: <b>{text(dados.abertura_oral)}</b></span></div>
          <PaperTitle>MEDICAMENTOS EM USO</PaperTitle>{medications.length?<table className="paperTable"><tbody>{medications.map(m=><tr key={m.id}><td><b>{m.nome} {m.dose} {m.frequencia}</b></td><td>{m.orientacao||m.conduta||"a definir"}</td></tr>)}</tbody></table>:<p>Nenhum medicamento registrado.</p>}
          <PaperTitle>EXAMES, ESCORES E CONCLUSÃO</PaperTitle><div className="paperColumns"><p>Hemoglobina: <b>{text(dados.hemoglobina)}</b><br/>Plaquetas: <b>{text(dados.plaquetas)}</b><br/>Creatinina: <b>{text(dados.creatinina)}</b><br/>ECG: <b>{text(dados.ecg)}</b></p><p>ASA: <b>{text(dados.asa)}</b><br/>Capacidade funcional: <b>{text(dados.capacidade_funcional)}</b><br/>Conclusão: <b>{text(dados.conclusao)}</b></p></div><p>Observações: {text(dados.plano_anestesico)}</p><PaperSignature dados={dados} perfil={perfil}/></article>

        <article className={`printPaper consentPaper ${selected.consent?"":"notSelected"}`}><header><span>AVANEST — Serviço de Anestesiologia</span></header><h2>Termo de Consentimento Anestésico</h2><div className="legalReview">MODELO INSTITUCIONAL — validar o texto com o responsável técnico e jurídico antes do uso assistencial.</div><p>Paciente: <b>{paciente.nome}</b></p><p>Declaro que recebi explicações claras sobre a avaliação pré-anestésica, as alternativas de técnicas anestésicas, seus benefícios, limitações e riscos possíveis. Tive oportunidade de fazer perguntas e compreendi que a técnica poderá ser ajustada pelo anestesiologista responsável conforme as condições clínicas e o procedimento.</p><p>Autorizo a equipe de anestesiologia a realizar os cuidados necessários e procedimentos adicionais indispensáveis diante de situações imprevistas, sempre segundo avaliação profissional, normas éticas e protocolos institucionais.</p><p>Compreendo que não existem garantias absolutas de resultado e comprometo-me a informar corretamente doenças, alergias, medicamentos, uso de substâncias e alterações recentes de saúde.</p><div className="consentSignatures"><span>PACIENTE / RESPONSÁVEL: ______________________________<br/>Data: ____/____/________</span><span>TESTEMUNHA: _______________________________________<br/>Data: ____/____/________</span></div><PaperSignature dados={dados} perfil={perfil}/></article>

        <article className={`printPaper guidancePaper ${selected.guidance?"":"notSelected"}`}><header><span>AVANEST — Orientações ao paciente</span></header><h2>Orientações Pré-Anestésicas</h2><p>Paciente: <b>{paciente.nome}</b> · Anestesiologista: <b>{text(dados.anestesiologista,perfil.nome)}</b></p><PaperTitle>MEDICAMENTOS</PaperTitle>{medications.length?<table className="paperTable"><thead><tr><th>MEDICAMENTO</th><th>ORIENTAÇÃO CONFIRMADA</th></tr></thead><tbody>{medications.map(m=><tr key={m.id}><td>{m.nome} {m.dose} {m.frequencia}</td><td><b>{m.orientacao||m.conduta||"A definir pelo anestesiologista"}</b></td></tr>)}</tbody></table>:<p>Não há medicamentos registrados nesta avaliação.</p>}<PaperTitle>PLANEJAMENTO</PaperTitle><p>Tipo de anestesia prevista: <b>{text(dados.tecnica,"A definir pelo anestesiologista")}</b></p><p>Jejum — sólidos: <b>{text(dados.jejum_solidos,"A definir")}</b><br/>Jejum — líquidos claros: <b>{text(dados.jejum_liquidos,"A definir")}</b><br/>Horário de chegada: <b>{text(dados.horario_chegada)}</b></p><p>Observações: {text(dados.plano_anestesico)}</p><PaperSignature dados={dados} perfil={perfil}/></article>
      </div>
      <aside className="documentsSidebar"><section><h3>Selecionar documentos</h3><DocChoice checked={selected.assessment} onChange={v=>setSelected(s=>({...s,assessment:v}))} title="Ficha de Avaliação Pré-Anestésica" detail="1 cópia — prontuário"/><DocChoice checked={selected.consent} onChange={v=>setSelected(s=>({...s,consent:v}))} title="Termo de Consentimento Anestésico" detail="1 cópia — assinatura e prontuário"/><DocChoice checked={selected.guidance} onChange={v=>setSelected(s=>({...s,guidance:v}))} title="Orientações Pré-Anestésicas" detail="1 cópia — entrega ao paciente"/></section>
        <section><h3>Verificação antes da impressão</h3><div className="documentChecks">{checks.map(([label,ok])=><span className={ok?"ok":"pending"} key={label}>{ok?"✓":"⚠"} {label}{!ok?" — pendente":""}</span>)}</div>{pending.length>0&&<div className="pendingNotice">Pendências não bloqueantes: {pending.join("; ")}. O documento exibirá “a definir” quando necessário.</div>}</section>
        <section><button className="printButton" disabled={!Object.values(selected).some(Boolean)} onClick={printDocuments}>▣ Imprimir PDF ({Object.values(selected).filter(Boolean).length} documentos)</button><p>Na janela que abrir, escolha “Salvar como PDF”. Cada documento selecionado será impresso em folha própria.</p><hr/><h4>Enviar orientações ao paciente</h4><button className="channelButton whatsapp" onClick={()=>openChannel("whatsapp")}>WhatsApp</button><button className="channelButton" onClick={()=>openChannel("email")}>E-mail</button><button className="channelButton sms" onClick={()=>openChannel("sms")}>SMS</button><p>Os atalhos abrem o aplicativo escolhido. Revise a mensagem e anexe o PDF antes de enviar.</p>{notice&&<div className="pendingNotice">{notice}</div>}</section>
      </aside></div>
    </div>
  </main>;
}

function PaperTitle({children}:{children:React.ReactNode}){return <h3 className="paperTitle">{children}</h3>}
function PaperSignature({dados,perfil}:{dados:Data;perfil:Props["perfil"]}){return <div className="paperSignature"><span>________________________________________<br/><b>{text(dados.anestesiologista,perfil.nome)}</b> — {text(dados.crm,perfil.crm||"CRM não informado")}<br/>Anestesiologista</span></div>}
function DocChoice({checked,onChange,title,detail}:{checked:boolean;onChange:(v:boolean)=>void;title:string;detail:string}){return <label className={`docChoice ${checked?"selected":""}`}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span><b>{title}</b><small>{detail}</small></span></label>}
