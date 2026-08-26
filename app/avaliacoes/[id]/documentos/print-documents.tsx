"use client";

import {Fragment,useMemo,useState} from "react";
import { idadeDoPaciente } from "@/lib/idade";
import {createClient} from "@/utils/supabase/client";
import {ehAntitrombotico,exigeOrientacao} from "@/lib/medication-guide";
import {suspensionSummary} from "@/lib/medication-summary";
import {frasePreditores,preditoresMarcados,resumoViaAerea,riscoNoMasculino} from "@/lib/via-aerea";
import {BrandMark} from "@/components/brand-mark";

type Data=Record<string,string|boolean>;
/**
 * O local como estava no dia do atendimento.
 *
 * Vem congelado dentro da avaliação, e não da tabela de locais, de propósito:
 * se o hospital mudar de nome ou de endereço amanhã, o documento assinado hoje
 * não pode mudar junto.
 */
type LocalCongelado={
  nome?:string;nome_fantasia?:string;cnpj?:string;tipo?:string;
  endereco?:string;numero?:string;bairro?:string;cidade?:string;estado?:string;
  telefone?:string;logo_url?:string;grupo_anestesia?:string;logo_grupo_url?:string;
};
type Props={
  avaliacao:{id:string;institution_id:string;patient_id:string;status:string;versao:number;dados:Data|null;snapshot_conclusao:Data|null;created_at:string;updated_at:string;concluida_at:string|null;local_snapshot?:LocalCongelado|null};
  paciente:{id:string;nome:string;cpf:string|null;data_nascimento:string|null;idade_anos?:number|null;sexo:string|null;telefone:string|null;email:string|null;hospital:string|null;cirurgia:string|null;procedimento:string|null;convenio:string|null};
  perfil:{id:string;nome:string;crm:string|null;rqe:string|null;role:string;permissoes?:string[]|null};
  organizacao:{nome:string;tipo:string|null;telefone:string|null}|null;
};
const normalizar=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();

/** Aceita tanto "2026-08-09" quanto "2026-08-09T14:30". */
function formatarQuando(valor:string){
  const data=new Date(valor.length<=10?`${valor}T12:00:00`:valor);
  if(Number.isNaN(data.getTime()))return valor;
  return valor.length<=10
    ? data.toLocaleDateString("pt-BR")
    : data.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
type Medication={id:string;nome:string;dose:string;frequencia:string;ultimaDose?:string;indicacao?:string;conduta:string;orientacao:string;reinicio?:string;fonte?:string;confirmada?:boolean;orientacaoEditada?:boolean};

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
// Número e unidade grudados por espaço inseparável. Com espaço comum, "31 kg"
// quebra no fim da célula e o "kg" desce sozinho para a linha de baixo, o que
// num papel clínico chega a parecer outro campo.
// Escrito como \u00A0, e não como o caractere em si: invisível no editor, ele
// viraria espaço comum sem ninguém perceber, no primeiro copiar e colar.
/* O cadastro tem máscara, mas quem foi gravado antes dela — ou por importação —
   está no banco só com dígitos. Formatar na impressão resolve os dois casos sem
   mexer no que está salvo.
   Só pontua com 11 dígitos exatos: cadastro incompleto ou documento estrangeiro
   sai como está, em vez de virar um número que parece CPF e não é. */
const cpfPontuado=(v:unknown)=>{
  const digitos=String(v??"").replace(/\D/g,"");
  if(digitos.length!==11)return String(v??"");
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4");
};

/* Numa faixa de identificação, "feminino" por extenso ocupa o espaço de dois
   outros campos e não informa mais do que FEM. */
const sexoCurto=(v:unknown)=>{
  const t=String(v??"").trim().toLowerCase();
  if(t.startsWith("f"))return "FEM";
  if(t.startsWith("m"))return "MASC";
  return String(v??"");
};
const comUnidade=(value:unknown,unidade:string)=>
  hasText(value)?`${String(value).trim()}\u00A0${unidade}`:"";
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

type Fact={label:string;value:string;span?:"wide"|"full"|"nome"|"direita"};
const facts=(items:Array<[string,unknown]|[string,unknown,Fact["span"]]>):Fact[]=>
  items.filter(([,value])=>hasText(value)).map(([label,value,span])=>({label,value:text(value),span}));
function FactGrid({items,className=""}:{items:Fact[];className?:string}){
  if(!items.length)return null;
  // O espaço entre um campo e outro não é enfeite: sem ele o navegador não tem
  // onde quebrar a linha, e o texto sai da folha em vez de passar para a linha
  // seguinte. Numa caixa com overflow escondido isso vira dado sumido — o CPF
  // saía 95 px fora do papel e ninguém via.
  return <div className={`paperExam ${className}`.trim()}>{items.map((fact,indice)=>
    <Fragment key={fact.label}>{indice>0?" ":""}
      <span className={fact.span==="full"?"paperExamFull":fact.span==="wide"?"paperExamWide":undefined}>{fact.label}: <b>{fact.value}</b></span>
    </Fragment>)}</div>;
}
function PaperBlock({title,items,className}:{title:string;items:Fact[];className?:string}){
  if(!items.length)return null;
  return <><PaperTitle>{title}</PaperTitle><FactGrid items={items} className={className}/></>;
}

// Bloco corrido, para aproveitar a largura da folha: os campos preenchidos
// saem numa linha só, separados por barra, e quebram sozinhos quando falta
// espaço. Cada "linha" recebida vira um parágrafo; "extras" ficam embaixo,
// porque são textos longos (observações) que não cabem ao lado dos demais.
function PaperInlineBlock({title,linhas,extras=[],classe}:{title?:string;linhas:Fact[][];extras?:Fact[];classe?:string}){
  const preenchidas=linhas.filter(linha=>linha.length);
  if(!preenchidas.length&&!extras.length)return null;
  return <>
    {title&&<PaperTitle>{title}</PaperTitle>}
    <div className={classe?`paperInlineBlock ${classe}`:"paperInlineBlock"}>
      {preenchidas.map((linha,indice)=>
        <p className="paperInline" key={indice}>{linha.map((fact,posicao)=>
          // "direita" vai para a extremidade da linha e dispensa o separador:
          // quem está encostado na borda não precisa de barra para se separar
          // do vizinho.
          <span key={fact.label} className={fact.span==="nome"?"nomePaciente":fact.span==="direita"?"aoDireita":undefined}>
            {posicao>0&&fact.span!=="direita"&&<em className="paperSep">|</em>}{fact.label}: <b>{fact.value}</b></span>)}
        </p>)}
      {extras.map(fact=>
        <p className="paperInlineFull" key={fact.label}>{fact.label}: <b>{fact.value}</b></p>)}
    </div>
  </>;
}

// O texto do termo.
//
// A numeração impressa sai de como o bloco é montado lá embaixo: os dois
// primeiros itens viram 2 e 3, os riscos viram o item 4, e o resto segue de 5
// em diante. Mexer na ordem daqui muda os números no papel.
//
// Nada aqui cita clínica nem hospital pelo nome: quem assina o termo é a
// organização que está usando o sistema, e o nome dela entra pelo cadastro.
// Um nome fixo no texto já foi motivo de retrabalho uma vez.
//
// Isto é documento jurídico. Foi escrito para ser claro para quem vai assinar
// — frases curtas, sem juridiquês desnecessário — mas continua sendo texto que
// o advogado da organização deve ler antes de virar rotina.
const CONSENT_ITEMS=[
  "Foi claramente exposto a mim que os cuidados propostos seguirão os princípios éticos da medicina: respeito à pessoa, busca do maior benefício possível e redução dos danos e riscos previsíveis.",
  "Minha decisão é voluntária e foi tomada depois de receber informações sobre a natureza, as consequências e os riscos dos procedimentos, e de poder discuti-las. Entendo que qualquer procedimento anestésico pode exigir procedimentos complementares, mesmo com todo o cuidado e a perícia da equipe, e que não existe anestesia sem risco: todas, ainda que em graus diferentes, envolvem risco de vida.",
  "Aceito o fato de que o tabagismo e o uso de álcool ou de outras drogas, embora não impeçam a realização da anestesia, aumentam a chance das complicações descritas acima.",
  "Reconheço que, durante o ato anestésico, podem surgir situações que não era possível prever antes. Por isso autorizo o médico anestesiologista e a equipe que o auxilia a realizar as técnicas e os tratamentos necessários à condução segura da anestesia — inclusive mudar a técnica combinada, se for preciso —, além de procedimentos de urgência e a transferência para terapia intensiva, na própria instituição ou em outra.",
  "Entendo que o médico anestesiologista e sua equipe se comprometem a empregar todos os meios ao seu alcance para alcançar o melhor resultado, mas não podem garantir o resultado em si. A medicina não é uma ciência exata, e não é possível prever com certeza o desfecho de nenhum procedimento anestésico.",
  "Compreendo que, no dia da cirurgia, a anestesia pode ser aplicada por um anestesiologista diferente do que me avaliou, por escala ou plantão. Nesse caso, estou ciente de que ele lerá esta avaliação e seguirá os mesmos cuidados de segurança.",
  "Se minha cirurgia for realizada em hospital de ensino, aceito que médicos residentes participem do meu atendimento, sempre sob supervisão do médico anestesiologista responsável.",
  "Concordo em seguir as orientações que me forem dadas, por escrito ou verbalmente, até minha recuperação — em especial o tempo de jejum e a orientação sobre quais dos meus medicamentos manter e quais suspender. Estou ciente de que não seguir essas orientações pode levar ao adiamento da cirurgia e aumentar o risco do procedimento.",
  "Autorizo o registro dos dados necessários à minha avaliação e à realização da anestesia, em prontuário em papel ou eletrônico. Estou ciente de que esses dados são protegidos por sigilo profissional e pela Lei Geral de Proteção de Dados, e de que só serão compartilhados com quem participa do meu cuidado ou com quem tenha direito legal de acesso.",
  "Tive a oportunidade de fazer perguntas e todas foram respondidas em linguagem que compreendi. Estou ciente de que posso recusar o procedimento ou retirar este consentimento a qualquer momento antes do início da anestesia, sem que isso prejudique o meu atendimento.",
];
// A repetição do "Poderá ocorrer" é de propósito. Sem ela a lista vira um
// rol de coisas que vão acontecer, e não de coisas que podem acontecer —
// e é exatamente essa a diferença que o paciente precisa entender.
const CONSENT_RISKS=[
  "Poderá ocorrer dor de garganta, rouquidão, lesão ou perda de dentes, pequeno sangramento pelo nariz ou pela boca e dormência em partes da língua, relacionados à colocação do tubo respiratório.",
  "Poderá ocorrer dor de cabeça, dor lombar, dores musculares, tontura, vertigem, dificuldade para respirar e desmaio durante a recuperação da anestesia e nos dias seguintes.",
  "Poderá ocorrer sede e fome, pelo tempo de jejum e pelos medicamentos usados.",
  "Poderá ocorrer dor no local das punções de veia ou artéria, além de inflamação da veia (flebite), pelos materiais e medicamentos utilizados.",
  "Poderá ocorrer ardência nos olhos, lesão da córnea, deslocamento de lentes de contato e queda de pelos.",
  "Poderá ocorrer frio, tremores e áreas com falta de sensibilidade, por posicionamento durante a cirurgia ou após bloqueios. Em geral são passageiras, podem durar um tempo indeterminado e, muito raramente, ser permanentes.",
  "Poderá ocorrer alteração do humor e da memória, mais comumente na forma de ansiedade e confusão passageira, e, embora raros, quadros psicológicos mais complexos.",
];

/**
 * O cabeçalho institucional dos documentos.
 *
 * Três colunas: marca da instituição, identidade do documento, marca do grupo.
 * O que não estiver cadastrado simplesmente não ocupa espaço — cabeçalho com
 * buraco reservado para um logo que não existe fica pior do que cabeçalho sem
 * logo nenhum.
 *
 * No meio vai o nome do documento, e não a marca do AVANEST. O papel que chega
 * na mão do paciente é da clínica que o atendeu; a plataforma que gerou o
 * arquivo não é parte do atendimento e não precisa assinar junto.
 *
 * Tudo aqui vem do snapshot da avaliação, nunca do local ativo agora: reimprimir
 * um documento de março não pode carimbá-lo com o hospital de hoje.
 */
function CabecalhoInstitucional({
  local, clinica, titulo, referencia,
}: {
  local: LocalCongelado | null;
  clinica: string;
  titulo: string;
  referencia?: string;
}) {
  const instituicao = (local?.nome_fantasia || local?.nome || clinica || "").trim();
  const cidade = [local?.cidade, local?.estado].filter(Boolean).join("/");
  // Sem o nome do médico. Ele já assina embaixo, com CRM e RQE, que é onde a
  // assinatura tem valor — repetido no alto ele só empurrava o cabeçalho para
  // baixo e dizia duas vezes a mesma coisa. O cabeçalho é da instituição.
  const linhas = [local?.grupo_anestesia, cidade].filter(Boolean) as string[];

  return (
    <header className="paperHeader">
      {local?.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- papel impresso: sem otimização nem carregamento tardio.
        <img className="paperLogo" src={local.logo_url} alt="" />
      )}
      <span className="paperHeaderMeio">
        <strong>{titulo}</strong>
        {instituicao && <b className="paperInstituicao">{instituicao}</b>}
        {linhas.length > 0 && <small>{linhas.join(" · ")}</small>}
        {referencia && <small className="paperRef">{referencia}</small>}
      </span>
      {local?.logo_grupo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- idem.
        <img className="paperLogo paperLogoGrupo" src={local.logo_grupo_url} alt="" />
      )}
    </header>
  );
}

export function PrintDocuments({avaliacao,paciente,perfil,organizacao}:Props){
  const dados=avaliacao.snapshot_conclusao||avaliacao.dados||{};
  // O papel que chega na mão do paciente leva o nome de quem atende, não o da
  // plataforma. Para o anestesiologista sozinho, o nome da organização é
  // "Fulano — Individual"; o sufixo é controle interno e não vai para o papel.
  // O nome do local vem primeiro. A organização é quem contrata o AVANEST; o
  // local é onde o paciente foi atendido, e é esse que o papel precisa dizer.
  // Sem local — avaliação anterior a esta funcionalidade —, segue a organização,
  // e nada muda para o que já foi impresso.
  const clinica=(avaliacao.local_snapshot?.nome_fantasia||avaliacao.local_snapshot?.nome||"").trim()
    ||(organizacao
      ?(organizacao.tipo==="individual"
        ?organizacao.nome.replace(/\s*[—-]\s*Individual$/i,"").trim()
        :organizacao.nome).trim()
      :"");
  // A marca vem do local do atendimento, não da organização: quem atende em
  // três hospitais tem três cabeçalhos, e o logo certo é o do lugar onde o
  // paciente foi visto. Sem local ou sem logo, o cabeçalho segue em texto,
  // como sempre foi.
  const local=avaliacao.local_snapshot??null;
  const logo=String(local?.logo_url||"").trim();
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
  // A mesma conta da avaliação, do mesmo arquivo: a ficha impressa não pode
  // mostrar uma idade diferente da que entrou nos escores.
  const age=useMemo(()=>idadeDoPaciente(paciente).anos,[paciente]);
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
  /* Numa DPOC ou asma, o dado que muda a conduta é a última crise e o
     controle — não o diagnóstico, que já está na resposta. Eles saem colados
     ao detalhe da pergunta em vez de virar linha própria: a anamnese impressa
     é compacta de propósito. */
  const respiratoryDetails=[
    text(dados.respiratoria_detalhes),
    hasText(dados.respiratoria_ultima_crise)?`última crise ${text(dados.respiratoria_ultima_crise)}`:"",
    text(dados.respiratoria_controle),
  ].filter(Boolean).join(" · ");
  const pregnancyDetails=PREGNANCY_PRINT_FIELDS
    .filter(([field])=>hasText(dados[field]))
    .map(([field,label])=>`${label}: ${text(dados[field])}`)
    .join(" · ");
  /* O detalhe do anticoagulante vem da lista de medicamentos, que é onde o
     remédio é escrito uma vez só. O texto antigo da anamnese continua entrando
     quando existir: ficha preenchida antes desta mudança não pode imprimir
     menos do que imprimia. */
  const antithrombotics=medications.filter(item=>ehAntitrombotico(item.nome));
  const antithromboticDetails=[
    ...antithrombotics.map(item=>{
      // "Xarelto 20 mg" com a dose repetida atrás vira "Xarelto 20 mg · 20 mg".
      // Quando o nome já traz a dose, ela não entra de novo.
      const dose=hasText(item.dose)&&!normalizar(item.nome).includes(normalizar(String(item.dose)))?String(item.dose):"";
      return [item.nome,dose,item.ultimaDose?`última dose ${formatarQuando(item.ultimaDose)}`:"",item.indicacao,item.conduta]
        .filter(Boolean).join(" · ");
    }),
    text(dados.anticoagulante_detalhes),
    hasText(dados.anticoagulante_ultima_dose)?`última dose ${formatarQuando(text(dados.anticoagulante_ultima_dose))}`:"",
    hasText(dados.anticoagulante_indicacao)?`indicação ${text(dados.anticoagulante_indicacao)}`:"",
  ].filter(Boolean).join(" · ");
  /* "Não" com antiagregante na lista é contradição, e ficha que emenda as duas
     coisas numa linha só ("Não · Clopidogrel · Suspender") lê como erro de
     digitação. A ficha diz que há divergência, em vez de escondê-la ou de
     fingir que o "Não" resolve. */
  const antithromboticConflict=antithrombotics.length>0&&hasText(dados.anticoagulante)&&text(dados.anticoagulante)!=="Sim";
  // Só entram na ficha as perguntas efetivamente respondidas.
  const questions=([
    ["Histórico cirúrgico / cirurgias prévias",dados.cirurgias_anteriores,previousSurgeryDetails],
    ["Reação ou complicação anestésica?",dados.reacao_anestesica,dados.reacao_anestesica_detalhes],
    ["Doença cardiovascular?",dados.cardiovascular,dados.cardiovascular_detalhes],
    ["Doença respiratória?",dados.respiratoria,respiratoryDetails],
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
  const airwayPredictors=preditoresMarcados(dados);
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
  // A mesma conta da tela da avaliação, do mesmo arquivo. Antes eram duas, e
  // a do papel esquecia os achados do exame: Mallampati IV virava "Moderada
  // (1 preditor)" na ficha e "Alta (3)" na tela.
  const {total:airwayCount,risco:airwayRisk}=resumoViaAerea(dados);

  // Na ficha, as orientações cobrem tudo que não for "Manter" — inclusive o que
  // ficou em "Avaliar", que é decisão pendente e precisa aparecer. Os mantidos
  // seguem só na lista de medicamentos em uso.
  const guidedMedications=medications.filter(item=>exigeOrientacao(item.conduta));
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
    <header className="clinicalTopbar documentsTopbar"><a className="clinicalBrand" href="/dashboard"><BrandMark className="clinicalBrandMark"/><span><strong>AVANEST</strong><small>Gestão em anestesiologia</small></span></a><span className="docSaved">● Avaliação concluída</span><nav className="roleNav" aria-label="Áreas do sistema">{canReception&&<a href="/dashboard?area=recepcao">Recepção</a>}{canMedical&&<a href="/dashboard?area=medico">Médico</a>}{canFinance&&<a href="/dashboard?area=financeiro">Financeiro</a>}{canManage&&<a href="/dashboard?area=admin">Admin</a>}</nav></header>
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
        <article className={`printPaper assessmentPaper ${selected.assessment?"":"notSelected"}`}><CabecalhoInstitucional local={local} clinica={clinica} titulo="FICHA DE AVALIAÇÃO PRÉ-ANESTÉSICA" referencia={`AVA-${avaliacao.id.slice(0,8)} · v${avaliacao.versao}`}/>{dados.alergias==="Sim"&&dados.alergias_detalhes&&<div className="paperAllergy">⚠ ALERGIA: {text(dados.alergias_detalhes).toUpperCase()}</div>}
          {/* Duas linhas, e a divisão é de propósito: em cima quem é o
              paciente — nome, CPF, idade, sexo —, embaixo as medidas e o
              convênio. Deixar a quebra por conta do acaso jogava o CPF para
              o fim da segunda linha, longe do nome que ele identifica. */}
          <PaperInlineBlock classe="paperIdentification"
            linhas={[
              facts([
                ["Nome",paciente.nome,"nome"],["CPF",cpfPontuado(paciente.cpf)],
                ["Idade",comUnidade(age,"anos")],["Sexo",sexoCurto(paciente.sexo)],
              ]),
              facts([
                ["Peso",comUnidade(weight||"","kg")],["Altura",comUnidade(height||"","cm")],["IMC",imc?imc.toFixed(1):""],
                ["Peso ideal",comUnidade(idealWeight?idealWeight.toFixed(0):"","kg")],
                ["Peso ajustado",comUnidade(adjustedWeight?adjustedWeight.toFixed(0):"","kg")],
                ["Convênio",paciente.convenio,"direita"],
              ]),
            ]}/>
          <PaperBlock title="PROCEDIMENTO CIRÚRGICO" items={facts([
            ["Cirurgia proposta",dados.cirurgia||paciente.cirurgia||paciente.procedimento,"wide"],
            // Hospital em duas colunas: nome de hospital é longo ("HOSPITAL
            // SANTA CASA CAMPO MOURÃO") e numa célula estreita quebrava em duas
            // linhas com o Caráter colado ao lado. Ocupando a linha de cima
            // inteira, o Caráter desce para a linha seguinte e os dois se leem
            // de relance.
            ["Cirurgião",dados.cirurgiao],["Hospital",dados.hospital||paciente.hospital,"wide"],
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
          <section className="paperMedicationSection"><PaperTitle>MEDICAMENTOS EM USO</PaperTitle>{medications.length?<p className="paperMedicationList">{medications.map((m,i)=><span key={m.id}>{i>0&&<em className="paperSep">|</em>}<b>{[m.nome,normalizar(m.nome).includes(normalizar(String(m.dose||"")))?"":m.dose,m.frequencia].filter(Boolean).join(" ")}</b></span>)}</p>:<p className="paperEmpty">{dados.medicacao_continua==="Não"?"Paciente informa não fazer uso de medicação contínua ou eventual.":dados.medicacao_continua==="Não sabe"?"Uso de medicação não informado pelo paciente.":"Nenhum medicamento registrado nesta avaliação."}</p>}
            {/* Sai junto dos medicamentos, e não na anamnese, porque quem lê
                este bloco antes da indução está decidindo jejum: com GLP-1 em
                uso, a data da última dose é o dado que muda a conduta. */}
            {hasText(dados.anticoagulante)&&<p className="paperGlp1">Anticoagulante ou antiagregante: <b>{text(dados.anticoagulante)}</b>
              {antithromboticConflict&&<> · <b>conferir — a lista acima tem: {antithromboticDetails}</b></>}
              {!antithromboticConflict&&hasText(antithromboticDetails)&&<> · <b>{antithromboticDetails}</b></>}</p>}
            {hasText(dados.glp1)&&<p className="paperGlp1">Caneta emagrecedora (GLP-1): <b>{text(dados.glp1)}</b>
              {hasText(dados.glp1_detalhes)&&<> · <b>{text(dados.glp1_detalhes)}</b></>}
              {hasText(dados.glp1_ultima_dose)&&<> · Última dose: <b>{formatDate(text(dados.glp1_ultima_dose))}</b></>}</p>}</section>
          <PaperInlineBlock title="EXAME FÍSICO"
            linhas={[
              facts([
                ["PA",hasText(dados.pa_sistolica)&&hasText(dados.pa_diastolica)?comUnidade(`${text(dados.pa_sistolica)}/${text(dados.pa_diastolica)}`,"mmHg"):""],
                ["FC",comUnidade(dados.fc,"bpm")],["FR",comUnidade(dados.fr,"irpm")],
                ["SpO₂",hasText(dados.spo2)?`${text(dados.spo2)}%`:""],["Temperatura",comUnidade(dados.temperatura,"°C")],
                ["Glicemia capilar",comUnidade(dados.glicemia_capilar,"mg/dL")],
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
          <PaperInlineBlock title="VIA AÉREA" classe="paperViaAerea"
            linhas={[
              facts([
                ["Via aérea difícil",dados.via_aerea_dificil],
                ["Mallampati",dados.mallampati],["Abertura oral",dados.abertura_oral],
                ["Dist. tireoment.",dados.distancia_tireo],["Dentição",dados.denticao],
                ["Mobilidade cervical",dados.mobilidade],
                ["Risco sugerido",airwayCount>0?`${riscoNoMasculino(airwayRisk)} (${frasePreditores(airwayCount)})`:""],
                ["Preditores",airwayPredictors.join(", ")],
              ]),
            ]}
            extras={facts([["Observações",dados.observacoes_via_aerea]])}/>
          <PaperInlineBlock title="EXAMES COMPLEMENTARES"
            linhas={[
              facts([
                ["Hb",dados.hemoglobina],["Ht",dados.hematocrito],["Plaquetas",dados.plaquetas],["TAP",dados.tap],["INR",dados.inr],
                ["TTPa",dados.ttpa],["Creatinina",dados.creatinina],["Ureia",dados.ureia],["Glicemia",dados.glicemia],
                ["Sódio",dados.sodio],["Potássio",dados.potassio],["HbA1c",dados.hba1c],["Data",formatDate(text(dados.data_exames))],
              ]),
              facts([
                ["ECG",dados.ecg],["Ecocardiograma",dados.eco],
                ["Radiografia de tórax",dados.rx_torax],["Espirometria",dados.espirometria],
              ]),
            ]}
            extras={facts([["Outros exames",dados.exames_obs]])}/>
          <PaperTitle>ESCORES E ESTRATIFICAÇÃO</PaperTitle><div className="paperScores">{hasText(dados.asa)&&<span><small>ASA</small><b>{text(dados.asa)}{dados.asa_emergencia===true?" + E":""}</b></span>}<span><small>LEE (RCRI)</small><b>{rcriScore} pt - Classe {["I","II","III","IV"][Math.min(rcriScore,3)]} - evento cardíaco maior ~{["0,4%","0,9%","6,6%","11%"][Math.min(rcriScore,3)]}</b></span><span><small>STOP-BANG</small><b>{stopScore}/8 - {stopScore<=2?"baixo risco":stopScore<=4?"risco intermediário":"alto risco"}</b></span><span><small>APFEL</small><b>{apfelScore}/4 - NVPO {apfelRisk}</b></span>{hasText(dados.capacidade_funcional)&&<span><small>CAPACIDADE FUNCIONAL</small><b>{text(dados.capacidade_funcional)}</b></span>}</div>
          {/* O parecer do cardiologista e frase, nao escore: dentro da grade
              ele esticava a caixa dele e, por tabela, a altura de toda a
              linha. Embaixo, corrido, ocupa so o que precisa. */}
          {hasText(dados.cardio_parecer)&&dados.cardio_parecer!=="Sem avaliação"&&
            <p className="paperCardioNota">Cardiologista: <b>{text(dados.cardio_parecer)}{hasText(dados.cardio_conduta)?` — ${text(dados.cardio_conduta)}`:""}</b></p>}
          <PaperBlock title="PLANEJAMENTO E CONCLUSÃO" items={facts([
            ["Jejum sólidos",dados.jejum_solidos],["Líquidos claros",dados.jejum_liquidos],
            ["Técnica anestésica",dados.tecnica],["Monitorização",dados.monitorizacao],
            ["Tubo traqueal",dados.tubo_traqueal,"wide"],
            ["Pré-medicação",dados.premedicacao],["UTI",dados.leito_uti],
            ["Hemoderivados",["Sim","Solicitar"].includes(text(dados.concentrado_hemacias))?`${text(dados.concentrado_hemacias)}${hasText(dados.quantidade_ch)?` — ${comUnidade(dados.quantidade_ch,"CH")}`:""}`:dados.concentrado_hemacias],
            ["Avaliação especializada",dados.avaliacao_especializada,"wide"],
            ["Conclusão",dados.conclusao,"wide"],
          ])}/>
          {hasText(printablePlan)&&<p className="paperObservations">{text(printablePlan)}</p>}<PaperSignature dados={dados} perfil={perfil}/></article>

        <article className={`printPaper consentPaper officialConsent ${selected.consent?"":"notSelected"}`}><CabecalhoInstitucional local={local} clinica={clinica} titulo="TERMO DE CONSENTIMENTO ANESTÉSICO"/><h3>PÓS-INFORMAÇÃO, DECISÃO E ORDEM ANTECIPADA DE TRATAMENTO E CUIDADOS MÉDICOS</h3>
          <p><b>1.</b> Por determinação explícita de minha vontade e em consideração ao meu interesse pessoal, eu: <b>{paciente.nome}</b></p>
          <p>Por este termo autorizo {clinica?<b>{clinica}</b>:"o serviço de anestesiologia responsável pelo meu atendimento"} e os médicos anestesiologistas de sua equipe a realizar os procedimentos anestésicos necessários à realização da cirurgia a que, no momento, me proponho{(() => {
            // O lugar só é dito de novo quando é OUTRO. Com o local
            // preenchido, quem autoriza e onde se opera são o mesmo nome, e
            // repeti-lo produzia "autorizo Santa Casa ... me proponho, no
            // Santa Casa" — além de feio, "no" com nome feminino estava
            // errado, e não há como acertar o artigo sem saber o gênero de
            // cada razão social.
            //
            // "em", sem artigo, é a saída que serve aos dois gêneros. Ela só
            // aparece nas avaliações antigas, que têm hospital digitado no
            // cadastro do paciente e nenhum local vinculado.
            const daAvaliacao=(local?.nome_fantasia||local?.nome||"").trim();
            const doCadastro=text(paciente.hospital);
            if(daAvaliacao) return null;
            return hasText(doCadastro)?<>, a ser realizada em <b>{doCadastro}</b></>:null;
          })()}.</p>
          <ol start={2}>{CONSENT_ITEMS.slice(0,2).map(item=><li key={item}>{item}</li>)}</ol>
          <p><b>4. Os seguintes pontos me foram esclarecidos:</b></p><ul>{CONSENT_RISKS.map(item=><li key={item}>{item}</li>)}</ul>
          <ol start={5}>{CONSENT_ITEMS.slice(2).map(item=><li key={item}>{item}</li>)}</ol>
          {/* O fecho do termo é um bloco só, e isso não é organização: é o que
              impede a assinatura de sair sozinha numa folha. Antes o parágrafo
              da autorização terminava no pé de uma página e as linhas de
              PACIENTE e TESTEMUNHA caíam na seguinte, sem nada em volta — um
              papel com duas linhas e um espaço em branco, que não se sustenta
              como consentimento assinado. Envolvidos num mesmo elemento com
              break-inside:avoid, ou os dois cabem, ou os dois viram juntos. */}
          <div className="consentClosing">
            <h4>AUTORIZAÇÃO</h4><p>Entendo que os meios utilizados para assegurar a compreensão adequada das informações foram observados e, embora saiba que os procedimentos aos quais me submeterei, além de serem de risco, poderão ocasionar as alterações descritas acima e limitação das minhas atividades cotidianas por período indeterminado, aceito e autorizo que os profissionais acima designados realizem os procedimentos constantes neste termo de autorização.</p>
            <div className="consentSignatures"><span>PACIENTE: ___________________________________________<br/><small>Assinar escrevendo o nome por extenso</small><br/>Data: ____/____/________</span><span>TESTEMUNHA: _______________________________________<br/><small>Assinar escrevendo o nome por extenso</small><br/>Data: ____/____/________</span></div>
          </div>
        </article>

        <article className={`printPaper guidancePaper ${selected.guidance?"":"notSelected"}`}><CabecalhoInstitucional local={local} clinica={clinica} titulo="ORIENTAÇÕES PRÉ-ANESTÉSICAS"/><p>Paciente: <b>{paciente.nome}</b> · Anestesiologista: <b>{text(dados.anestesiologista,perfil.nome)}</b></p><PaperTitle>MEDICAMENTOS</PaperTitle>{medications.length?<table className="paperTable"><thead><tr><th>MEDICAMENTO</th><th>ORIENTAÇÃO DEFINIDA PELO ANESTESIOLOGISTA</th></tr></thead><tbody>{medications.map(m=><tr key={m.id}><td><b>{m.nome}</b></td><td><b>{objectiveMedicationGuidance(m)||"A definir pelo anestesiologista"}</b></td></tr>)}</tbody></table>:<p>Não há medicamentos registrados nesta avaliação.</p>}
          <PaperBlock title="PLANEJAMENTO" items={facts([
            ["Tipo de anestesia prevista",dados.tecnica,"wide"],
            ["Jejum — sólidos",dados.jejum_solidos],["Jejum — líquidos claros",dados.jejum_liquidos],
            ["Pré-medicação",dados.premedicacao],["Leito de UTI",dados.leito_uti],
            ["Hemoderivados",["Sim","Solicitar"].includes(text(dados.concentrado_hemacias))?`${text(dados.concentrado_hemacias)}${hasText(dados.quantidade_ch)?` — ${comUnidade(dados.quantidade_ch,"CH")}`:""}`:""],
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
  // Muita gente escreve a titulação junto do CRM — "60593/PR (residente em
  // anestesiologia)" — porque não havia outro lugar para ela. Impresso assim,
  // saía tudo grudado numa linha só e ainda contradizia o rótulo fixo
  // "Anestesiologista" logo abaixo. O que vem entre parênteses no fim do campo
  // é essa titulação: sobe para a linha própria e substitui o rótulo.
  const crmBruto=text(dados.crm,perfil.crm||"CRM não informado").trim();
  const entreParenteses=crmBruto.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  const crm=entreParenteses?entreParenteses[1].trim():crmBruto;
  const titulo=entreParenteses?entreParenteses[2].trim():"Anestesiologista";
  // O cadastro guarda só o número e a UF — "60593/PR". Sozinho no papel, isso
  // não diz que registro é: podia ser matrícula, ramal, qualquer coisa. Quem
  // confere uma ficha assinada precisa ler CRM, número e estado.
  //
  // O prefixo só entra quando falta. Parte dos perfis já tem "CRM" digitado no
  // campo, e prefixar sem olhar produziria "CRM CRM 60593/PR" — inclusive no
  // texto de ausência, que já começa com CRM.
  //
  // Sem \b depois do "crm" de propósito: com ele, "CRMSP 1234" e "CRMPR 60593"
  // não casavam (S e P são letras, não há fronteira de palavra ali) e saíam
  // como "CRM CRMSP 1234". Número de CRM começa com dígito, então qualquer
  // coisa que já comece com essas três letras é o prefixo.
  const registro=`${/^\s*crm/i.test(crm)?crm:`CRM ${crm}`}${rqe?` · ${rqe}`:""}`;
  // Três linhas empilhadas, no canto inferior direito: nome, registro, e
  // embaixo a especialidade ou a residência. É como se assina um documento
  // clínico — e estreito, para ler como carimbo e não como parágrafo.
  return <div className="paperSignature">
    <div className="paperSignatureBloco">
      <span className="paperSignatureLinha" aria-hidden="true"/>
      <b>{text(dados.anestesiologista,perfil.nome)}</b>
      <span>{registro}</span>
      <small>{titulo}</small>
    </div>
  </div>;
}
function DocChoice({checked,onChange,title,detail}:{checked:boolean;onChange:(v:boolean)=>void;title:string;detail:string}){return <label className={`docChoice ${checked?"selected":""}`}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span><b>{title}</b><small>{detail}</small></span></label>}
