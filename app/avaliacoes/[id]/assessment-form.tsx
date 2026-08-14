"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { calculateLastDoseDate, ehAntitrombotico, ehGlp1, exigeOrientacao, findMedicationGuideEntry } from "@/lib/medication-guide";
import { orientacaoSugerida } from "@/lib/medication-summary";
import { diaParaMomento, lerMedicamentosEscritos, lerUmMedicamento, mesmoMedicamento } from "@/lib/medicamentos-escritos";
import { BrandMark } from "@/components/brand-mark";
import { Icone } from "@/components/icone";
import {
  AVISO_CLINICO,
  ehPediatrico,
  idadeEmMesesPorNascimento,
  opcoesDeTubo,
} from "@/lib/calculos/via-aerea-pediatrica";

const STEPS = ["Identificação", "Procedimento", "Anamnese", "Medicamentos", "Exame físico", "Via aérea", "Exames", "Escores", "Conclusão"];
type Draft = Record<string, string | boolean>;
type Assessment = { id: string; institution_id: string; patient_id: string; status: string; versao: number; dados: Draft | null; updated_at: string; lock_version:number };
type Profile = { id:string; nome:string; crm:string|null; rqe:string|null; role:string };
type Patient = {
  id:string; nome:string; cpf:string|null; rg?:string|null; data_nascimento:string|null; sexo:string|null;
  telefone:string|null; email:string|null; hospital?:string|null; cirurgia?:string|null;
  especialidade?:string|null; procedimento?:string|null; convenio?:string|null; data_consulta?:string|null; horario?:string|null;
};

// O anticoagulante saiu daqui: a pergunta mora no item 4, junto das outras
// duas perguntas de medicamento. Quem toma anticoagulante toma um
// medicamento, e a pergunta pertence ao bloco que tem a lista.
const ANAMNESIS_KEYS = [
  "cirurgias_anteriores", "reacao_anestesica",
  "cardiovascular", "respiratoria", "diabetes", "neurologica", "outras_doencas",
  "doenca_aguda", "dentaria", "alergias", "habitos", "glaucoma", "gestacao",
] as const;

function getAnamnesisKeys(sex: unknown) {
  return ANAMNESIS_KEYS.filter((key) => key !== "gestacao" || String(sex || "").toLowerCase() === "feminino");
}

// Campos abertos automaticamente quando a paciente é gestante.
export const PREGNANCY_FIELDS: Array<[string, string]> = [
  ["gestacao_idade_gestacional", "Idade gestacional"],
  ["gestacao_historia_obstetrica", "História obstétrica"],
  ["gestacao_intercorrencias", "Outras intercorrências gestacionais"],
];

// Campos que saíram da tela. Continuam listados só para serem apagados
// junto quando a resposta vira "Não": sem isso, uma avaliação antiga já
// preenchida guardaria DHEG ou cesarianas numa ficha que afirma não haver
// gestação — e a impressão, que lê o dado salvo, mostraria a contradição.
const PREGNANCY_LEGACY_FIELDS = [
  "gestacao_dheg", "gestacao_diabetes", "gestacao_numero_gestacoes",
  "gestacao_partos_normais", "gestacao_cesarianas", "gestacao_abortos",
];

function isFilled(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

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
      ecg: saved.ecg == null ? "Ritmo sinusal." : String(saved.ecg),
    };
  });
  const [saveState, setSaveState] = useState<"saved"|"pending"|"saving"|"error">("saved");
  const [saveError, setSaveError] = useState("");
  const [saindo, setSaindo] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedAt, setSavedAt] = useState(() => new Date(avaliacao.updated_at));
  // Etapa que o anestesiologista está lendo agora, para o stepper marcar
  // "atual" em vez de só "concluída/pendente".
  const [etapaAtual, setEtapaAtual] = useState(0);
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
    if(error||!data){
      setSaveError(error?.message || "O rascunho foi alterado em outra tela. Recarregue a página antes de continuar.");
      return false;
    }
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
          if (!saveError) setSaveError(error?.message || "Não foi possível sincronizar o rascunho.");
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
  // Sair sem perder o que foi digitado. O rascunho só é gravado 900 ms depois
  // da última tecla, então clicar em voltar durante essa janela levaria o
  // último campo embora. Aqui o timer é cancelado, a gravação acontece na
  // hora, e a navegação só ocorre se ela der certo — se falhar, a pessoa fica
  // na tela vendo o erro e o botão de tentar de novo.
  async function voltarAoPainel() {
    if (saindo) return;
    setSaindo(true);
    if (timer.current) clearTimeout(timer.current);
    if (saveState === "pending" || saveState === "error") {
      const gravou = await save();
      if (!gravou) { setSaindo(false); return; }
    }
    router.push("/dashboard");
  }
  function set(name: string, value: string | boolean) {
    const next = { ...draftRef.current, [name]: value }; draftRef.current=next;setDraft(next); setSaveState("pending"); setSaveError("");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 900);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Marca no stepper a etapa que está sob os olhos. Sem isso o profissional
  // rola a página e perde a referência de onde está.
  useEffect(() => {
    const secoes = STEPS.map((_, indice) => document.getElementById(`etapa-${indice + 1}`));
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!visivel) return;
        const indice = secoes.findIndex((secao) => secao === visivel.target);
        if (indice >= 0) setEtapaAtual(indice);
      },
      // A etapa passa a ser "a atual" quando cruza o terço superior da tela.
      { rootMargin: "-72px 0px -66% 0px", threshold: 0 },
    );
    secoes.forEach((secao) => { if (secao) observador.observe(secao); });
    return () => observador.disconnect();
  }, []);

  async function createFinancialEntry() {
    try {
      await fetch(`/api/avaliacoes/${avaliacao.id}/faturar`, { method: "POST" });
    } catch {
      // A conclusão clínica não deve ser perdida por uma falha temporária no lançamento financeiro.
    }
  }

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
      await createFinancialEntry();
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
    if(!directError&&concluded) {
      await createFinancialEntry();
      router.push(`/avaliacoes/${avaliacao.id}/documentos`);
    } else setSaveState("error");
  }

  async function deleteAssessment() {
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/api/avaliacoes/${avaliacao.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteError(result.error || "Não foi possível excluir a avaliação.");
        setDeleting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setDeleteError("Falha de conexão ao excluir a avaliação. Tente novamente.");
      setDeleting(false);
    }
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
  const anamnesisKeys = getAnamnesisKeys(draft.sexo || paciente.sexo);
  const anamnesisComplete = anamnesisKeys.every((key) => isFilled(draft[key])) &&
    (draft.alergias !== "Sim" || isFilled(draft.alergias_detalhes));
  const medicationComplete = isFilled(draft.medicacao_continua) && isFilled(draft.anticoagulante) && (
    draft.medicacao_continua !== "Sim" || (
      readMedications(draft.medicamentos_json).length > 0 &&
      readMedications(draft.medicamentos_json).every((item) => item.confirmada === true)
    )
  );
  const completedSteps=[
    Boolean(isFilled(paciente.nome)&&isFilled(paciente.data_nascimento)&&age!==null&&isFilled(draft.peso)&&isFilled(draft.altura)),
    Boolean(isFilled(draft.cirurgia)),
    // A ordem acompanha STEPS: anamnese é a etapa 3, medicamentos a 4.
    anamnesisComplete,
    medicationComplete,
    Boolean(isFilled(draft.pa_sistolica)&&isFilled(draft.pa_diastolica)&&isFilled(draft.fc)&&isFilled(draft.spo2)),
    Boolean(isFilled(draft.mallampati)&&isFilled(draft.abertura_oral)&&isFilled(draft.distancia_tireo)&&isFilled(draft.denticao)&&isFilled(draft.mobilidade)),
    true,
    Boolean(isFilled(draft.asa)&&draft.asa_confirmada===true&&isFilled(draft.capacidade_funcional)),
    Boolean(isFilled(draft.jejum_solidos)&&isFilled(draft.jejum_liquidos)&&isFilled(draft.tecnica)&&isFilled(draft.conclusao)&&isFilled(draft.anestesiologista)&&isFilled(draft.crm)),
  ];
  const progress=Math.round(completedSteps.filter(Boolean).length/completedSteps.length*100);
  const concluidas=completedSteps.filter(Boolean).length;

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
    {/* Cabeçalho, tarja de alergia e barra de progresso grudam juntos, como um
        bloco só. Antes cada um tinha seu próprio "top" em pixels, e bastava a
        altura do cabeçalho mudar para a barra de progresso passar a flutuar no
        meio do formulário. Empilhados aqui, não há conta a manter — e a tarja
        pode aparecer, sumir ou quebrar em duas linhas sem quebrar nada. */}
    <div className="evalFixo">
    <header className="evalTopbar">
      <Link className="clinicalBrand" href="/dashboard"><BrandMark className="clinicalBrandMark" /><span><strong>AVANEST</strong><small>Avaliação pré-anestésica</small></span></Link>
      {/* O estado do salvamento é dito por extenso, não só por um ponto
          colorido. Quando falha, o botão de tentar de novo fica aqui —
          antes o anestesiologista via o erro e não tinha o que fazer. */}
      <span className={`evalSave ${saveState}`} role="status" aria-live="polite">
        <i aria-hidden="true"/>
        {saveState==="saved"?`Salvo às ${savedAt.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`
          :saveState==="saving"?"Salvando..."
          :saveState==="pending"?"Alterações não salvas"
          :"Não foi possível salvar"}
        {saveState==="error"&&<button type="button" className="evalSaveRetry" onClick={()=>void save()}>Tentar de novo</button>}
      </span>
      <nav className="evalRoleNav">
        <button type="button" className="evalVoltar" onClick={()=>void voltarAoPainel()} disabled={saindo}>
          <Icone nome="voltar" tamanho={16}/>
          {saindo?"Salvando...":"Voltar ao painel"}
        </button>
        <button type="button" className="active">Médico</button>
      </nav>
    </header>
    {/* Alergia é informação de alta prioridade: acompanha a rolagem em vez de
        sumir na primeira etapa. Ícone, rótulo e valor — sem caixa alta no
        texto inteiro, que atrapalha a leitura. */}
    {allergy && <div className="allergyBanner" role="alert"><Icone nome="alerta" tamanho={17}/> <b>Alerta de alergia:</b> {allergy}</div>}
    <div className="evalProgress" aria-label={`${progress}% da avaliação preenchida`}><i style={{width:`${progress}%`}}/></div>
    </div>
    <div className="evalMain">
      <nav className="evalSteps" aria-label="Etapas da avaliação">
        <p className="evalStepsResumo">Etapa {etapaAtual+1} de {STEPS.length} · {concluidas} concluída{concluidas===1?"":"s"}</p>
        {STEPS.map((name,index)=>{
          const feita=completedSteps[index];
          const atual=index===etapaAtual;
          const situacao=feita?"concluída":atual?"em preenchimento":"pendente";
          return <button
            type="button"
            key={name}
            className={`${feita?"done":""} ${atual?"atual":""}`.trim()}
            aria-current={atual?"step":undefined}
            onClick={()=>document.getElementById(`etapa-${index+1}`)?.scrollIntoView({behavior:"smooth",block:"start"})}
          >
            {/* O símbolo acompanha a cor: quem não distingue verde de cinza
                continua conseguindo ler o estado. */}
            <i aria-hidden="true">{feita?"✓":atual?"›":""}</i>
            <span>{name}</span>
            <small className="evalStepSituacao">{situacao}</small>
          </button>;
        })}
      </nav>
      <div className="evalControls"><button className="pauseButton"><Icone nome="pausa"/> Pausar</button><button onClick={async()=>{await save();router.push("/dashboard")}}><Icone nome="voltar"/> Salvar e voltar</button>{["medico","admin","owner"].includes(perfil.role)&&!confirmDelete&&<button type="button" className="deleteAssessmentButton" onClick={()=>setConfirmDelete(true)}>Excluir avaliação</button>}</div>
      {confirmDelete&&<div className="deleteConfirmStrip" role="alertdialog" aria-label="Confirmar exclusão da avaliação">
        <p><b>Tem certeza de que deseja excluir esta avaliação?</b> Esta ação não poderá ser desfeita. O cadastro do paciente será mantido.</p>
        <div>
          <button type="button" onClick={()=>{setConfirmDelete(false);setDeleteError("")}} disabled={deleting}>Cancelar</button>
          <button type="button" className="perigo" onClick={deleteAssessment} disabled={deleting}>{deleting?"Excluindo...":"Excluir avaliação"}</button>
        </div>
      </div>}
      {deleteError&&<p className="deleteAssessmentError" role="alert">{deleteError}</p>}

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
        {input("especialidade","Especialidade")}{select("lateralidade","Lateralidade",["Direita","Esquerda","Bilateral","Não se aplica"])}
        {select("carater","Caráter",["Eletiva","Urgência","Emergência"])}{select("porte","Porte cirúrgico",["Pequeno","Médio","Grande"])}{input("duracao","Duração estimada")}
        {select("regime","Regime",["Ambulatorial","Hospital-dia","Internação (1 diária)","Internação prolongada"],"span2")}
      </div></section>

      <div id="etapa-3"><Anamnesis draft={draft} set={set}/></div>
      <div id="etapa-4"><Medications draft={draft} set={set}/></div>
      <div id="etapa-5"><PhysicalExam draft={draft} set={set}/></div>
      <div id="etapa-6"><Airway draft={draft} set={set}/></div>
      <div id="etapa-7"><ComplementaryExams draft={draft} set={set} avaliacao={avaliacao}/></div>
      <div id="etapa-8"><Scores draft={draft} set={set} age={age} sex={paciente.sexo} imc={imc}/></div>
      <div id="etapa-9"><Conclusion draft={draft} set={set} paciente={paciente} age={age} imc={imc} conclude={conclude} retrySave={()=>void save()} saveState={saveState} saveError={saveError}/></div>
    </div>
  </main>;
}

function Anamnesis({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const questions=[
    ["cirurgias_anteriores","Histórico cirúrgico / Cirurgias prévias"],
    ["reacao_anestesica","Apresentou reação ou complicação anestésica? Há casos na família?"],
    ["cardiovascular","Possui doença cardiovascular?"],
    ["respiratoria","Doença respiratória?"],
    ["diabetes","Possui diabetes?"],
    ["neurologica","Doenças neurológicas ou psiquiátricas?"],
    ["outras_doencas","Outras doenças? (tireoide, renal, hepática, artrites, etc.)"],
    ["doenca_aguda","Doença aguda no momento? (gripe, tosse, febre, ITU, etc.)"],
    ["dentaria","Usa prótese dentária removível ou tem alterações dentárias?"],
    ["alergias","Possui alergias?"],
    ["habitos","Tabagismo, álcool ou outras substâncias"],
    ["glaucoma","Possui glaucoma?"],
    ["gestacao","Gestante?"],
  ].filter(([key])=>key!=="gestacao"||String(draft.sexo||"").toLowerCase()==="feminino");
  return <><section className="evalSection evalIntro"><h1>3 · Anamnese</h1><p>Perguntas da ficha física. Cada resposta “Sim” abre detalhamento e observações.</p></section>
    <div className="anamnesisList">{questions.map(([key,label])=><QuestionCard key={key} name={key} label={label} value={String(draft[key]??"")} detail={String(draft[`${key}_detalhes`]??"")} onChange={(value)=>set(key,value)} onDetail={(value)=>set(`${key}_detalhes`,value)} draft={draft} set={set}/>)}</div></>;
}
const QUESTION_CHIPS:Record<string,string[]>={
  cirurgias_anteriores:["Cesárea","Colecistectomia","Herniorrafia","Ortopédica","Cardíaca","Outra"],
  reacao_anestesica:["Náuseas/vômitos intensos","Intubação difícil","Dificuldade de ventilação","Alergia","Hipertermia maligna","Cefaleia pós-raqui","UTI","PCR","Outra"],
  respiratoria:["DPOC","Asma","Enfisema pulmonar","CA de pulmão","Apneia do sono","Tabagismo","Outra"],
  cardiovascular:["Hipertensão","Coronariopatia","Infarto","Insuficiência cardíaca","Arritmia","Valvopatia","Marca-passo/CDI","AVC/AIT","Outra"],
  diabetes:["Tipo 1","Tipo 2","Insulina","Hipoglicemia recente","Complicações"],
  neurologica:["Epilepsia","Parkinson","AVC/AIT","Demência","Depressão","Ansiedade","Transtorno bipolar","Outra"],
  outras_doencas:["Tireoide","Renal","Hepática","Refluxo","Câncer","Reumatológica","Obesidade","Outra"],
  doenca_aguda:["Gripe","Tosse","Febre","ITU","Diarreia/vômitos","Outra"],
  dentaria:["Prótese removível","Prótese fixa","Dente solto","Dente fraturado","Edentado","Aparelho"],
  alergias:["Medicamentos","Látex","Alimentos","Antissépticos","Contraste iodado","Outros"],
  habitos:["Tabagismo","Álcool","Cannabis","Cocaína/estimulantes","Outras substâncias"],
  glaucoma:["Ângulo aberto","Ângulo fechado","Colírio em uso"],
  gestacao:[],
};
/**
 * Quais doenças respiratórias pedem data da última crise.
 *
 * DPOC e asma são as que cursam com exacerbação, e é a exacerbação recente —
 * não o diagnóstico — que muda a conduta: crise nas últimas semanas costuma
 * adiar cirurgia eletiva. Enfisema e neoplasia entram na lista de botões
 * porque são o que mais se digita ali, mas não abrem esses campos: não é
 * "crise" que se pergunta a respeito deles.
 */
export const RESPIRATORIAS_COM_CRISE = ["DPOC", "Asma"];
const abreCrise = (selecionados: string[]) =>
  selecionados.some((item) => RESPIRATORIAS_COM_CRISE.includes(item));

function QuestionCard({name,label,value,detail,onChange,onDetail,draft,set}:{name:string;label:string;value:string;detail:string;onChange:(v:string)=>void;onDetail:(v:string)=>void;draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const chips=name==="cirurgias_anteriores" ? [] : QUESTION_CHIPS[name]||[];
  const answerOptions=name==="gestacao"?["Sim","Não"]:["Sim","Não","Não sabe"];
  const selected=detail.split(",").map(item=>item.trim()).filter(Boolean);
  const toggleChip=(chip:string)=>onDetail(selected.includes(chip)?selected.filter(item=>item!==chip).join(", "):[...selected,chip].join(", "));
  return <section className="questionCard"><div className="questionHead"><strong>{label}</strong><div className="answerButtons">{answerOptions.map(answer=><button type="button" className={value===answer?"active":""} onClick={()=>{onChange(answer);if(answer!=="Sim"){onDetail("");if(name==="cirurgias_anteriores"){set("cirurgias_anteriores_cirurgia","");set("cirurgias_anteriores_anestesia","")}if(name==="respiratoria"){set("respiratoria_ultima_crise","");set("respiratoria_controle","")}if(name==="gestacao"){for(const field of [...PREGNANCY_FIELDS.map(([f])=>f),...PREGNANCY_LEGACY_FIELDS])set(field,"")}}}} key={answer}>{answer}</button>)}</div></div>
    {value==="Sim"&&<><div className="detailChips">{chips.map(chip=><button type="button" className={selected.includes(chip)?"selected":""} onClick={()=>toggleChip(chip)} key={chip}>{chip}</button>)}</div>
      {name==="cirurgias_anteriores"&&<div className="conditionalDetails">
        <label><span>Qual cirurgia foi realizada?</span><input value={String(draft.cirurgias_anteriores_cirurgia??detail)} onChange={e=>set("cirurgias_anteriores_cirurgia",e.target.value)} placeholder="Ex.: cesárea, colecistectomia, herniorrafia"/></label>
        <label><span>Qual foi o tipo de anestesia utilizada?</span><input value={String(draft.cirurgias_anteriores_anestesia??"")} onChange={e=>set("cirurgias_anteriores_anestesia",e.target.value)} placeholder="Ex.: geral, raquianestesia, sedação"/></label>
      </div>}
      {name==="respiratoria"&&abreCrise(selected)&&<div className="conditionalDetails">
        <label><span>Quando foi a última crise?</span><input value={String(draft.respiratoria_ultima_crise??"")} onChange={e=>set("respiratoria_ultima_crise",e.target.value)} placeholder="Ex.: há 3 meses, março/2026, nunca teve"/></label>
        <label><span>Está controlada?</span><select value={String(draft.respiratoria_controle??"")} onChange={e=>set("respiratoria_controle",e.target.value)}>
          <option value="">Selecione</option>
          <option>Controlada</option>
          <option>Parcialmente controlada</option>
          <option>Não controlada</option>
        </select></label>
      </div>}
      {name==="gestacao"&&<div className="conditionalDetails pregnancyDetails">
        {PREGNANCY_FIELDS.map(([field,fieldLabel])=><label key={field}><span>{fieldLabel}</span><input value={String(draft[field]??"")} onChange={e=>set(field,e.target.value)}/></label>)}
      </div>}
      {!["cirurgias_anteriores","gestacao"].includes(name)&&<input className="detailInput" value={detail} onChange={e=>onDetail(e.target.value)} placeholder={name==="alergias"?"Nome completo da medicação ou do agente causador — não use abreviações":name==="respiratoria"?"Detalhes: gravidade, medicação em uso, internações":"Detalhes e observações"}/>}</>}
  </section>;
}

/**
 * A pergunta do anticoagulante não tem mais lista de remédio própria.
 *
 * Antes ela morava na anamnese e repetia AAS, Clopidogrel, Varfarina e mais
 * cinco — os mesmos nomes que a lista de medicamentos já oferece, e lá com
 * dose, última dose, conduta, prazo de suspensão e data de reinício. Escrever o
 * remédio duas vezes é o jeito de perder a segunda: a lista ficava com
 * "Xarelto" e a anamnese com "Rivaroxabana", e quem lia a ficha não sabia qual
 * das duas o anestesiologista tinha de fato revisado.
 *
 * Agora a pergunta mora no mesmo bloco da lista e lê dela. O que aparece aqui é
 * reflexo, não digitação — por isso não há campo nenhum para editar.
 *
 * Os campos antigos de última dose e indicação continuam sendo mostrados quando
 * a avaliação já os tiver preenchido: apagá-los da tela esconderia dado clínico
 * de ficha antiga sem avisar ninguém.
 */
function Antitromboticos({draft,resposta}:{draft:Draft;resposta:string}) {
  const encontrados=readMedications(draft.medicamentos_json).filter(item=>ehAntitrombotico(item.nome));
  const legadoDose=String(draft.anticoagulante_ultima_dose??"");
  const legadoIndicacao=String(draft.anticoagulante_indicacao??"");
  const irParaMedicamentos=()=>document.querySelector(".medicationAdd")?.scrollIntoView({behavior:"smooth",block:"center"});

  // Lista vazia e resposta "Não": nada a dizer. É o caso mais comum.
  if(!encontrados.length&&resposta!=="Sim"&&!legadoDose&&!legadoIndicacao)return null;

  return <div className="antithromboticBox">
    {encontrados.length>0&&resposta!==""&&resposta!=="Sim"&&
      <p className="antithromboticWarn">A resposta é <b>{resposta}</b>, mas a lista abaixo tem {encontrados.length===1?"um medicamento que afina o sangue":"medicamentos que afinam o sangue"}. Confira antes de concluir.</p>}

    {encontrados.length>0
      ? <>
          <strong>Da lista de medicamentos</strong>
          <ul>{encontrados.map(item=><li key={item.id}>
            <b>{item.nome}</b>
            {item.classe?<small>{item.classe}</small>:null}
            <span>{[item.dose,item.frequencia,item.ultimaDose?`última dose ${formatarQuando(item.ultimaDose)}`:"",item.indicacao].filter(Boolean).join(" · ")||"Sem dose, última dose ou indicação preenchidas — completar na lista abaixo."}</span>
            <span className="antithromboticAction">Conduta: <b>{item.conduta}</b></span>
          </li>)}</ul>
        </>
      : resposta==="Sim"&&<p className="antithromboticEmpty">Nenhum medicamento que afine o sangue está na lista abaixo. Cadastre lá — é de onde saem a dose, a última dose, o prazo de suspensão e a data de reinício.</p>}

    <button type="button" onClick={irParaMedicamentos}>{encontrados.length?"Editar na lista abaixo":"Ir para a lista de medicamentos"}</button>

    {(legadoDose||legadoIndicacao)&&<p className="antithromboticLegacy">
      Registrado em versão anterior desta ficha: {[legadoDose?`última dose ${formatarQuando(legadoDose)}`:"",legadoIndicacao?`indicação ${legadoIndicacao}`:""].filter(Boolean).join(" · ")}.
    </p>}
  </div>;
}

/** Aceita tanto "2026-08-09" quanto "2026-08-09T14:30". */
function formatarQuando(valor:string) {
  const data=new Date(valor.length<=10?`${valor}T12:00:00`:valor);
  if(Number.isNaN(data.getTime()))return valor;
  return valor.length<=10
    ? data.toLocaleDateString("pt-BR")
    : data.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}

type Medication = {
  id:string; nome:string; dose:string; frequencia:string; ultimaDose:string; indicacao:string;
  conduta:string; orientacao:string; principioAtivo?:string; classe?:string; prazo?:string;
  reinicio?:string; excecoes?:string; fonte?:string; ultimaDoseSugerida?:string; confirmada?:boolean;
  // Marca que o anestesiologista reescreveu a orientação. Quando verdadeiro, a
  // impressão reproduz o texto salvo sem reaplicar o texto automático do guia.
  orientacaoEditada?:boolean;
};
function readMedications(value: string | boolean | undefined): Medication[] {
  try { const parsed=JSON.parse(String(value||"[]")); return Array.isArray(parsed)?parsed:[]; } catch { return []; }
}
function medicationFromName(nome:string, surgeryDate:string, dose="", frequencia="", ultimaDose=""):Medication {
  const guide=findMedicationGuideEntry(nome);
  return {
    id:crypto.randomUUID(),nome,dose,frequencia,ultimaDose,indicacao:"",
    conduta:guide?.defaultAction??"Avaliar",
    // Nasce com a frase que a ficha vai imprimir, e não com o texto longo do
    // guia: o campo é editável justamente para o anestesiologista discordar do
    // prazo antes de imprimir. O raciocínio completo continua logo abaixo, em
    // "Quando suspender ou ajustar".
    orientacao:orientacaoSugerida(nome,guide?.defaultAction??"Avaliar",guide?.timing??""),
    principioAtivo:guide?.activeIngredient??"",classe:guide?.medicationClass??"",
    prazo:guide?.timing??"",reinicio:guide?.restart??"",excecoes:guide?.adjustments??"",
    fonte:guide?.source??"",ultimaDoseSugerida:calculateLastDoseDate(surgeryDate,guide?.suspendDays),
    confirmada:false,orientacaoEditada:false,
  };
}
function Medications({draft,set}:{draft:Draft;set:(name:string,value:string|boolean)=>void}) {
  const [name,setName]=useState("");
  const medications=readMedications(draft.medicamentos_json);
  const medicationAnswer=String(draft.medicacao_continua??"");
  const showMedicationForm=medicationAnswer==="Sim"||medications.length>0;
  const save=(items:Medication[])=>{
    set("medicamentos_json",JSON.stringify(items));
    // Cadastrar um antitrombótico responde a pergunta logo acima — é
    // justamente para não digitar o remédio duas vezes. Só preenche resposta
    // em branco: quem respondeu "Não" de propósito recebe um aviso de
    // divergência, e não uma resposta trocada pelas suas costas.
    if(!String(draft.anticoagulante??"").trim()&&items.some(item=>ehAntitrombotico(item.nome)))set("anticoagulante","Sim");
    if(!String(draft.glp1??"").trim()&&items.some(item=>ehGlp1(item.nome)))set("glp1","Sim");
  };
  const continuousDetails=String(draft.medicacao_continua_detalhes||"");
  const anticoagulantDetails=String(draft.anticoagulante_detalhes||"");
  const glp1Details=String(draft.glp1_detalhes||"");
  const glp1UltimaDose=String(draft.glp1_ultima_dose||"");
  useEffect(()=>{
    const timer=setTimeout(()=>{
      // A data da última dose só acompanha o que foi escrito na pergunta da
      // caneta — é lá que ela é perguntada. Os outros campos não têm data.
      const escritos=[
        ...(draft.medicacao_continua==="Sim"?lerMedicamentosEscritos(continuousDetails):[])
          .map(item=>({...item,ultimaDose:""})),
        ...(draft.anticoagulante==="Sim"?lerMedicamentosEscritos(anticoagulantDetails):[])
          .map(item=>({...item,ultimaDose:""})),
        // A caneta é o fármaco cuja conduta decide o jejum. Quem escreveu
        // "Ozempic 1 mg" e a data ali em cima já disse tudo — não precisa
        // repetir dose nem data na lista para ver o prazo de suspensão.
        ...(draft.glp1==="Sim"?lerMedicamentosEscritos(glp1Details):[])
          .map(item=>({...item,ultimaDose:diaParaMomento(glp1UltimaDose)})),
      ];
      if(!escritos.length)return;

      const atuais=[...medications];
      let mudou=false;
      for(const escrito of escritos){
        const existente=atuais.find(item=>mesmoMedicamento(item.nome,escrito.nome));
        if(!existente){
          atuais.push(medicationFromName(
            escrito.nome,String(draft.data_cirurgia||""),
            escrito.dose,escrito.frequencia,escrito.ultimaDose,
          ));
          mudou=true;
          continue;
        }
        // Já cadastrado: completa só o que está em branco. Quem corrigiu a
        // dose no cartão corrigiu por algum motivo, e o texto da pergunta não
        // desfaz isso pelas costas.
        for(const campo of ["dose","frequencia","ultimaDose"] as const){
          if(escrito[campo]&&!String(existente[campo]||"").trim()){
            existente[campo]=escrito[campo];
            mudou=true;
          }
        }
      }
      if(mudou)save(atuais);
    },700);
    return ()=>clearTimeout(timer);
    // Importa apenas quando os campos de origem da anamnese forem alterados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[continuousDetails,anticoagulantDetails,glp1Details,glp1UltimaDose,draft.medicacao_continua,draft.anticoagulante,draft.glp1]);
  const add=(suggestion?:string)=>{
    // Passa pela mesma leitura da anamnese: quem digita "Xarelto 20 mg" — ou
    // clica no botão rápido, que vem escrito assim — cadastra o remédio com a
    // dose no campo de dose, e não grudada no nome.
    const escrito=lerUmMedicamento(suggestion??name);
    if(!escrito)return;
    if(medications.some(item=>mesmoMedicamento(item.nome,escrito.nome))){setName("");return;}
    save([...medications,medicationFromName(
      escrito.nome,String(draft.data_cirurgia||""),escrito.dose,escrito.frequencia,
    )]); setName("");
  };
  const update=<K extends keyof Medication>(id:string,key:K,value:Medication[K])=>save(medications.map(item=>{
    if(item.id!==id)return item;
    const next={...item,[key]:value};
    // Uma orientação reescrita à mão passa a ser a versão oficial: o PDF deixa de
    // reconstruir o texto padrão do guia para esse medicamento. A comparação é
    // contra a frase sugerida, não contra o texto do guia — senão quem apagasse
    // a sugestão e digitasse de volta o parágrafo do guia veria a ficha ignorar
    // o que ele escreveu.
    if(key==="orientacao"){
      const sugerida=orientacaoSugerida(item.nome,String(next.conduta??""),String(item.prazo??""));
      next.orientacaoEditada=String(value??"").trim()!==sugerida.trim();
    }
    // Trocar a conduta troca a frase sugerida junto: quem muda de Manter para
    // Suspender espera ver o prazo aparecer. Só que orientação escrita à mão é
    // decisão registrada do anestesiologista, e essa não se sobrescreve sozinha.
    if(key==="conduta"&&item.orientacaoEditada!==true){
      next.orientacao=orientacaoSugerida(item.nome,String(value??""),String(item.prazo??""));
    }
    return next;
  }));
  const groups=[
    ["Manter",medications.filter(m=>m.conduta==="Manter")],
    ["Suspender",medications.filter(m=>m.conduta==="Suspender")],
    ["Individualizar / avaliar",medications.filter(m=>!["Manter","Suspender"].includes(m.conduta))],
  ] as const;
  return <><section className="evalSection">
    <h1>4 · Medicamentos em uso</h1>
    <div className="questionCard medicationUseQuestion">
      <div className="questionHead">
        <strong>Utiliza alguma medicação de uso contínuo?</strong>
        <div className="answerButtons">{["Sim","Não","Não sabe"].map(answer=><button type="button" className={medicationAnswer===answer?"active":""} onClick={()=>set("medicacao_continua",answer)} key={answer}>{answer}</button>)}</div>
      </div>
    </div>
    {/* Pergunta separada porque a resposta muda a conduta, não só a lista: o
        GLP-1 atrasa o esvaziamento gástrico, e é a data da última dose que
        define o jejum e o risco de broncoaspiração. Perguntado junto com os
        demais medicamentos, o paciente costuma não lembrar de citar — ele não
        pensa na caneta como remédio. */}
    <div className="questionCard medicationUseQuestion">
      <div className="questionHead">
        <strong>Usa Ozempic, Mounjaro, Saxenda, Rybelsus ou outra caneta emagrecedora?</strong>
        <div className="answerButtons">{["Sim","Não","Não sabe"].map(answer=><button type="button" className={String(draft.glp1??"")===answer?"active":""} onClick={()=>set("glp1",answer)} key={answer}>{answer}</button>)}</div>
      </div>
      {draft.glp1==="Sim"&&<div className="conditionalDetails">
        <label><span>Dia da última dose</span>
          <input type="date" value={String(draft.glp1_ultima_dose??"")} onChange={e=>set("glp1_ultima_dose",e.target.value)}/></label>
        <label><span>Qual caneta e dose</span>
          <input value={String(draft.glp1_detalhes??"")} onChange={e=>set("glp1_detalhes",e.target.value)} placeholder="Ex.: Ozempic 1 mg, semanal"/></label>
      </div>}
    </div>
    {/* Terceira pergunta do bloco, e não da anamnese: anticoagulante é
        medicamento. Aqui ela fica ao lado da lista de onde tira a resposta —
        e do outro lado da tela ninguém precisa escrever o remédio de novo. */}
    <div className="questionCard medicationUseQuestion">
      <div className="questionHead">
        <strong>Usa anticoagulante ou antiagregante? (afina o sangue)</strong>
        <div className="answerButtons">{["Sim","Não","Não sabe"].map(answer=><button type="button" className={String(draft.anticoagulante??"")===answer?"active":""} onClick={()=>{set("anticoagulante",answer);if(answer!=="Sim")set("anticoagulante_detalhes","")}} key={answer}>{answer}</button>)}</div>
      </div>
      <Antitromboticos draft={draft} resposta={String(draft.anticoagulante??"")}/>
      {draft.anticoagulante==="Sim"&&<input className="detailInput" value={String(draft.anticoagulante_detalhes??"")} onChange={e=>set("anticoagulante_detalhes",e.target.value)} placeholder="Observações: ponte, indicação, conduta combinada com o cardiologista"/>}
    </div>
    <p className="evalHint"><b>Base:</b> Guia Perioperatório de Medicamentos, versão 1.0, revisão 07/2026. As sugestões são apoio à decisão e devem ser revisadas e confirmadas individualmente pelo anestesiologista.</p>
    {showMedicationForm&&<><div className="medicationAdd"><input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}} placeholder="Ex.: losartana, Xarelto, AAS, metformina..."/><button onClick={()=>add()}>Adicionar</button></div>
    <div className="quickMedication"><span>Adição rápida:</span>{["Losartana","Enalapril","Anlodipino","Hidroclorotiazida","Metoprolol","AAS 100 mg","Clopidogrel","Xarelto 20 mg","Eliquis","Varfarina","Dabigatrana","Enoxaparina","Metformina","Ozempic","Dapagliflozina","Insulina NPH","Levotiroxina","Sinvastatina","Omeprazol","Sertralina"].map(item=><button key={item} onClick={()=>add(item)}>{item}</button>)}</div></>}
  </section>
  {!showMedicationForm&&medicationAnswer&&<section className="emptyClinical">Resposta registrada: <b>{medicationAnswer}</b>.</section>}
  {showMedicationForm&&(medications.length===0?<section className="emptyClinical">Nenhum medicamento adicionado nesta avaliação.</section>:medications.map(item=>{const currentSuggested=calculateLastDoseDate(String(draft.data_cirurgia||""),findMedicationGuideEntry(item.nome)?.suspendDays);return <section className="medicationCard" key={item.id}>
    <div className="medicationTitle"><div><strong>{item.nome}</strong><small>{item.principioAtivo||"Medicamento não localizado na base — preencher manualmente"}</small></div><select value={item.conduta} onChange={e=>update(item.id,"conduta",e.target.value)}><option>Avaliar</option><option>Individualizar</option><option>Manter</option><option>Suspender</option></select><button className="removeMedication" onClick={()=>save(medications.filter(m=>m.id!==item.id))}>×</button></div>
    <div className="medicationGrid">
      <label><span>Dose</span><input value={item.dose} onChange={e=>update(item.id,"dose",e.target.value)} placeholder="Ex.: 50 mg"/></label>
      <label><span>Frequência</span><input value={item.frequencia} onChange={e=>update(item.id,"frequencia",e.target.value)} placeholder="Ex.: 1x/dia"/></label>
      <label><span>Última dose</span><input type="datetime-local" value={item.ultimaDose} onChange={e=>update(item.id,"ultimaDose",e.target.value)}/></label>
      <label><span>Indicação</span><input value={item.indicacao} onChange={e=>update(item.id,"indicacao",e.target.value)} placeholder="Ex.: FA, TEV, stent"/></label>
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
  </section>}))}
  {showMedicationForm&&<section className="evalSection"><h2>Resumo dos medicamentos</h2><div className="medicationSummary">{groups.map(([label,items])=><div key={label}><strong>{label}</strong>{items.length?items.map(m=><span key={m.id}>• {m.nome}{m.dose?` ${m.dose}`:""}</span>):<span>— nenhum —</span>}</div>)}</div></section>}</>;
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
  };
  const field=(name:string,label:string,type="text")=>{const range=limits[name];return <label className="evalField"><span>{label}</span><input type={type} min={range?.min} max={range?.max} step={range?.step} value={String(draft[name]??"")} onChange={e=>set(name,e.target.value)}/></label>};
  const choice=(name:string,label:string,options:string[])=>{
    const current=String(draft[name]??"");
    const hasLegacyValue=current!==""&&!options.includes(current);
    return <label className="evalField"><span>{label}</span><select value={current} onChange={e=>set(name,e.target.value)}>
      <option value="">Selecione</option>
      {hasLegacyValue&&<option value={current}>{current} (valor anterior)</option>}
      {options.map(option=><option key={option} value={option}>{option}</option>)}
    </select></label>;
  };
  return <section className="evalSection"><h1>5 · Exame físico</h1><div className="physicalGrid">
    {field("pa_sistolica","PA sistólica (mmHg)","number")}{field("pa_diastolica","PA diastólica (mmHg)","number")}{field("fc","FC (bpm)","number")}{field("fr","FR (irpm)","number")}{field("spo2","SpO₂ (%)","number")}{field("temperatura","Temperatura (°C)","number")}
    {field("glicemia_capilar","Glicemia capilar (mg/dL)","number")}
    {choice("estado_geral","Estado geral",["Bom estado geral","Regular estado geral","Mau estado geral"])}
  </div>
  <ToggleChips title="EXAME CARDIOVASCULAR" prefix="cardio" items={["Bulhas normofonéticas","Sopro","Arritmia","Edema","Turgência jugular","Pulsos diminuídos","Perfusão lentificada"]} draft={draft} set={set}/>
  <ToggleChips title="EXAME RESPIRATÓRIO" prefix="resp" items={["MV preservado","Sibilos","Roncos","Estertores","Estridor","Musculatura acessória","Tosse","Dispneia"]} draft={draft} set={set}/>
  <label className="evalField examOptionalNote"><span>Observações do exame físico</span><textarea value={String(draft.observacoes_exame_fisico??"")} onChange={e=>set("observacoes_exame_fisico",e.target.value)} placeholder="Ex.: Paciente em bom estado geral, eupneico, corado e hidratado."/></label>
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
  <label className="evalField examOptionalNote"><span>Observações da via aérea</span><textarea value={String(draft.observacoes_via_aerea??"")} onChange={e=>set("observacoes_via_aerea",e.target.value)}/></label>
  <div className={`airwayRisk ${risk.toLowerCase()}`}><strong>{risk} probabilidade sugerida de via aérea difícil</strong><span>{count} preditor(es) marcado(s) — sugestão de apoio, deve ser confirmada pelo anestesiologista.</span></div>
  {/* A conta acima é sugestão; esta linha é a decisão. São coisas diferentes e
      por isso ficam em campos diferentes: contar preditor não substitui o
      julgamento de quem vai intubar, e quem lê a ficha depois precisa saber
      qual das duas está vendo. */}
  <div className="questionCard airwayVerdict">
    <div className="questionHead">
      <strong>Via aérea difícil?</strong>
      <div className="answerButtons">{["Sim","Não"].map(answer=><button type="button" className={String(draft.via_aerea_dificil??"")===answer?"active":""} onClick={()=>set("via_aerea_dificil",answer)} key={answer}>{answer}</button>)}</div>
    </div>
    <small>Conclusão do anestesiologista. A probabilidade acima é apoio, não resposta.</small>
  </div>
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
  return <section className="evalSection"><h1>7 · Exames complementares <small className="optionalField">Opcional</small></h1><p className="evalHint">Preencha somente os exames indicados para este paciente. A ausência de exames — por exemplo, ecocardiograma sem indicação clínica — não impede a conclusão da avaliação.</p>
    <div className="examResultsGrid">{field("hemoglobina","Hemoglobina (g/dL)")}{field("hematocrito","Hematócrito (%)")}{field("plaquetas","Plaquetas")}{field("tap","TAP (s)")}{field("inr","INR")}{field("ttpa","TTPa (s)")}{field("creatinina","Creatinina (mg/dL)")}{field("ureia","Ureia (mg/dL)")}{field("sodio","Sódio (mEq/L)")}{field("potassio","Potássio (mEq/L)")}{field("glicemia","Glicemia (mg/dL)")}{field("hba1c","HbA1c (%)")}{field("data_exames","Data dos exames","date")}</div>
    <div className="examDetailGrid">{field("ecg","Eletrocardiograma")}{field("eco","Ecocardiograma")}{field("rx_torax","Radiografia de tórax")}{field("espirometria","Espirometria")}<label className="evalField span2"><span>Outros exames (imagem, gasometria...)</span><input value={String(draft.exames_obs??"")} onChange={e=>set("exames_obs",e.target.value)}/></label></div>
    <div className="attachmentRow"><label className="attachmentButton">📎 {uploading?"Enviando...":"Anexar arquivo (PDF / imagem / câmera)"}<input type="file" accept=".pdf,image/jpeg,image/png" capture="environment" disabled={uploading} onChange={e=>upload(e.target.files?.[0])}/></label><span>Formatos aceitos: PDF, JPG e PNG.</span></div>
    {uploadError&&<p className="clinicalError">Não foi possível anexar: {uploadError}</p>}
    {attachments.length>0&&<div className="attachmentList">{attachments.map((item:{name:string;path:string})=><span key={item.path}>✓ {item.name}</span>)}</div>}
    <label className="medicationConfirm"><input type="checkbox" checked={draft.exames_revisados===true} onChange={e=>set("exames_revisados",e.target.checked)}/><span>Exames e anexos revisados, quando aplicável.</span></label>
  </section>;
}

function ScoreToggle({name,label,draft,set,motivo,onAlternar}:{name:string;label:string;draft:Draft;set:(name:string,value:string|boolean)=>void;motivo?:string;onAlternar?:(nome:string,ligado:boolean)=>void}) {
  const ligado=draft[name]===true;
  return <button
    className={`scoreToggle${ligado?" selected":""}${motivo?" sugerido":""}`}
    onClick={()=>{const proximo=!ligado;set(name,proximo);onAlternar?.(name,proximo)}}
    title={motivo?`Sugerido pelo que já foi preenchido — ${motivo}`:undefined}
  >
    <i>{ligado?"✓":""}</i>
    <span>{label}{motivo&&<small className="scoreMotivo">{motivo}</small>}</span>
  </button>;
}
// Sugestões de escore a partir do que já foi respondido.
//
// Cada uma carrega o motivo, e o motivo é sempre um trecho do que a pessoa
// escreveu. Escore marcado sozinho, sem dizer por quê, é pior do que escore
// vazio: o médico assina um risco que ele não conferiu e não tem como
// rastrear de onde saiu.
//
// O que depende de perguntar ao paciente — ronco, sonolência, apneia
// observada, opioide previsto — fica de fora. Não há como deduzir isso da
// ficha, e chutar seria inventar dado clínico.

const texto = (valor: unknown) => String(valor ?? "").toLowerCase();
const contem = (valor: unknown, termos: string[]) =>
  termos.some((termo) => texto(valor).includes(termo));

// Cirurgias de alto risco cardíaco do próprio RCRI: intraperitoneal,
// intratorácica e vascular suprainguinal.
const CIRURGIA_ALTO_RISCO = [
  "laparotomia", "gastrectomia", "colectomia", "colecistectomia", "hepatectomia",
  "pancreat", "esofag", "intraperitone", "abdominal",
  "toracotomia", "lobectomia", "pneumonectomia", "torác", "torac",
  "aneurisma", "aorta", "aórtic", "aortic", "revascularização de membro",
  "femoro", "fêmoro", "endarterectomia", "vascular",
];

type Sugestao = { valor: true; motivo: string };

function sugerirEscores(draft: Draft, medicamentos: Medication[]): Record<string, Sugestao> {
  const s: Record<string, Sugestao> = {};
  const marcar = (chave: string, motivo: string) => { if (!s[chave]) s[chave] = { valor: true, motivo }; };

  const cardio = draft.cardiovascular === "Sim" ? draft.cardiovascular_detalhes : "";
  const neuro = draft.neurologica === "Sim" ? draft.neurologica_detalhes : "";
  const outras = draft.outras_doencas === "Sim" ? draft.outras_doencas_detalhes : "";

  // ── Índice de Lee ────────────────────────────────────────────────────────
  if (contem(cardio, ["coronar", "infarto", "iam", "angina", "stent", "revasculariz", "ponte de safena"]))
    marcar("rcri_coronaria", `Cardiovascular: ${draft.cardiovascular_detalhes}`);

  if (contem(cardio, ["insuficiência cardíaca", "insuficiencia cardiaca", "icc", " ic ", "fração de ejeção", "fracao de ejecao"]))
    marcar("rcri_ic", `Cardiovascular: ${draft.cardiovascular_detalhes}`);

  if (contem(neuro, ["avc", "ait", "derrame", "isquemia cerebral", "acidente vascular"]))
    marcar("rcri_cerebrovascular", `Neurológica: ${draft.neurologica_detalhes}`);

  const usaInsulina = medicamentos.some((m) => contem(m.nome, ["insulina", "lantus", "novorapid", "humalog", "tresiba", "glargina", "nph"]));
  if (draft.diabetes === "Sim" && (usaInsulina || contem(draft.diabetes_detalhes, ["insulina"])))
    marcar("rcri_insulina", usaInsulina ? "Insulina na lista de medicamentos" : `Diabetes: ${draft.diabetes_detalhes}`);

  if (contem(draft.cirurgia, CIRURGIA_ALTO_RISCO))
    marcar("rcri_alto_risco", `Cirurgia: ${draft.cirurgia}`);

  // ── STOP-Bang ────────────────────────────────────────────────────────────
  if (contem(cardio, ["hipertens", "has ", "pressão alta", "pressao alta"]) || contem(outras, ["hipertens"]))
    marcar("stop_has", `Cardiovascular: ${draft.cardiovascular_detalhes || draft.outras_doencas_detalhes}`);

  // ── Apfel ────────────────────────────────────────────────────────────────
  const reacao = draft.reacao_anestesica === "Sim" ? draft.reacao_anestesica_detalhes : "";
  if (contem(reacao, ["náusea", "nausea", "vômito", "vomito", "nvpo", "enjoo"]) ||
      contem(outras, ["cinetose", "enjoo de viagem"]))
    marcar("apfel_historia", `Reação anestésica: ${draft.reacao_anestesica_detalhes || draft.outras_doencas_detalhes}`);

  return s;
}

const LEE_CLASSES = ["I", "II", "III", "IV"];
// Taxas de evento cardíaco maior da derivação original (Lee et al., Circulation
// 1999). São as que acompanham o índice na literatura; trocá-las por outra
// coorte mudaria o número que o anestesiologista lê ao lado da classe.
const LEE_RISCO = ["0,4%", "0,9%", "6,6%", "11%"];
// Rótulo curto na tela, valor por extenso no que é gravado e impresso. Os
// quatro cabem numa linha só com o texto curto; a ficha continua dizendo
// "Liberado sem restrições", que é o que o leitor do papel precisa ler.
const PARECER_CARDIO: Array<[string, string]> = [
  ["Sem avaliação", "Sem avaliação"],
  ["Liberado sem restrições", "Liberado"],
  ["Liberado com ressalvas", "Com ressalvas"],
  ["Não liberado", "Não liberado"],
];

function Scores({draft,set,age,sex,imc}:{draft:Draft;set:(name:string,value:string|boolean)=>void;age:number|null;sex:string|null;imc:number}) {
  const rcri=[["rcri_alto_risco","Cirurgia de alto risco"],["rcri_coronaria","Doença arterial coronariana"],["rcri_ic","Insuficiência cardíaca"],["rcri_cerebrovascular","Doença cerebrovascular (AVC/AIT)"],["rcri_insulina","Diabetes em uso de insulina"],["rcri_creatinina","Creatinina > 2,0 mg/dL"]];
  const stop=[["stop_ronco","Ronco alto"],["stop_cansaco","Cansaço/sonolência diurna"],["stop_apneia","Apneia observada"],["stop_has","Hipertensão arterial"],["stop_pescoco","Circunf. cervical > 40 cm"],["stop_imc","IMC > 35"],["stop_idade","Idade > 50"],["stop_masculino","Sexo masculino"]];
  const apfel=[["apfel_historia","História de NVPO ou cinetose"],["apfel_opioide","Opioides pós-operatórios previstos"],["apfel_feminino","Sexo feminino"],["apfel_nao_tabagista","Não tabagista"]];
  const rcriScore=rcri.filter(([key])=>key==="rcri_creatinina"?Number(String(draft.creatinina||"").replace(",","."))>2:draft[key]===true).length;

  // Preenchimento automático dos escores.
  //
  // Aplica o que a anamnese e os exames já indicam, mas guarda o que o médico
  // desmarcou: se ele tirou "insuficiência cardíaca", não vale a tela remarcar
  // na próxima visita. Quem decide é ele; o automático só evita redigitar o
  // que já está na ficha.
  const sugestoes=useMemo(()=>sugerirEscores(draft,readMedications(draft.medicamentos_json)),[draft]);
  const recusados=String(draft.escores_recusados||"").split(",").filter(Boolean);
  const pendentes=Object.keys(sugestoes).filter(chave=>draft[chave]!==true&&!recusados.includes(chave));
  const aplicados=Object.keys(sugestoes).filter(chave=>draft[chave]===true);

  useEffect(()=>{
    if(!pendentes.length) return;
    for(const chave of pendentes) set(chave,true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pendentes.join(",")]);

  function registrarAlternancia(nome:string,ligado:boolean){
    if(!sugestoes[nome]) return;
    const lista=new Set(recusados);
    if(ligado) lista.delete(nome); else lista.add(nome);
    set("escores_recusados",Array.from(lista).join(","));
  }
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
    <section className="evalSection"><h1>Índice de Lee (RCRI)</h1><p className="evalHint">Marque os critérios presentes.</p>
      <div className="scoreList">{rcri.map(([key,label])=><ScoreToggle key={key} name={key} label={label} draft={draft} set={set} motivo={sugestoes[key]?.motivo} onAlternar={registrarAlternancia}/>)}</div>
      <div className={`scoreResult ${rcriScore>=2?"warning":""}`}>
        Lee {rcriScore} ponto(s) · Classe {LEE_CLASSES[Math.min(rcriScore,3)]} · evento cardíaco maior ≈ {LEE_RISCO[Math.min(rcriScore,3)]}
        <small>Lee et al., 1999. Apoio à estratificação; confirmar clinicamente.</small>
      </div>
      {/* O parecer do cardiologista entra como registro ao lado do índice, e
          não como pontos. O RCRI é um escore fechado de seis critérios — somar
          ou descontar por causa do parecer inventaria um número que não existe
          em lugar nenhum. Quem decide continua sendo o anestesiologista. */}
      <div className="cardioParecer">
        <strong>Avaliação do cardiologista</strong>
        <div className="cardioOpcoes">
          {PARECER_CARDIO.map(([valor,curto])=>
            <button key={valor} className={draft.cardio_parecer===valor?"selected":""} title={valor}
              onClick={()=>set("cardio_parecer",draft.cardio_parecer===valor?"":valor)}>{curto}</button>)}
        </div>
        {/* A observação fica sempre visível: o cardiologista costuma escrever
            algo mesmo quando libera sem restrição, e esconder o campo até
            escolher um parecer fazia perder essa anotação. */}
        <label className="clinicalField"><span>Observação do cardiologista</span>
          <textarea className="detailInput cardioObs" rows={2} value={String(draft.cardio_conduta??"")}
            onChange={e=>set("cardio_conduta",e.target.value)}
            placeholder="Ex.: manter betabloqueador no dia da cirurgia; ecocardiograma em 6 meses"/></label>
        {rcriScore>=2&&!draft.cardio_parecer&&
          <p className="cardioAlerta"><Icone nome="alerta" tamanho={15}/> Classe {LEE_CLASSES[Math.min(rcriScore,3)]} sem parecer cardiológico registrado.</p>}
        {draft.cardio_parecer==="Não liberado"&&
          <p className="cardioAlerta grave"><Icone nome="alerta" tamanho={15}/> Cardiologista não liberou o procedimento.</p>}
      </div>
    </section>
    <section className="evalSection"><h1>STOP-Bang (apneia do sono)</h1><div className="scoreChipList">{stop.map(([key,label])=><ScoreToggle key={key} name={key} label={`${label}${key==="stop_imc"&&imc?` (IMC ${imc.toFixed(1)})`:key==="stop_idade"&&age?` (${age} anos)`:key==="stop_masculino"&&sex?` (${sex})`:""}`} draft={draft} set={set} motivo={sugestoes[key]?.motivo} onAlternar={registrarAlternancia}/>)}</div><div className={`scoreResult ${stopScore>=5?"warning":"success"}`}>STOP-Bang {stopScore}/8 — {stopRisk}</div></section>
    <section className="evalSection"><h1>Apfel (risco de NVPO)</h1><div className="scoreChipList">{apfel.map(([key,label])=><ScoreToggle key={key} name={key} label={label} draft={draft} set={set} motivo={sugestoes[key]?.motivo} onAlternar={registrarAlternancia}/>)}</div><div className="scoreResult">Apfel {apfelScore}/4 — risco de NVPO {apfelRisk} <small>referência de apoio; confirmar conduta</small></div></section>
  </div><section className="evalSection functionalCapacity"><strong>CAPACIDADE FUNCIONAL</strong><div className="asaButtons">{["< 4 METs","4–10 METs","> 10 METs","Não avaliável"].map(item=><button className={draft.capacidade_funcional===item?"selected":""} onClick={()=>set("capacidade_funcional",item)} key={item}>{item}</button>)}</div><p>Outros escores somente devem ser usados quando houver dados suficientes e validação clínica.</p></section></>;
}

function Conclusion({draft,set,paciente,age,imc,conclude,retrySave,saveState,saveError}:{draft:Draft;set:(name:string,value:string|boolean)=>void;paciente:Patient;age:number|null;imc:number;conclude:()=>Promise<void>;retrySave:()=>void;saveState:"saved"|"pending"|"saving"|"error";saveError:string}) {
  const medications=readMedications(draft.medicamentos_json);
  const lastAutomaticPlan=useRef("");
  /* Tubo pediátrico no planejamento: peso e data de nascimento já estão na
     ficha, e trocar de tela no meio da indução é o que se quer evitar.
     A idade em anos inteiros não serve — abaixo de 1 ano o calibre vem do
     peso, e um lactente de 8 meses apareceria como "0 ano". */
  const idadeMeses=idadeEmMesesPorNascimento(paciente.data_nascimento);
  const pesoKg=Number(draft.peso||0)||undefined;
  const usaTubo=["Anestesia geral","Técnica combinada"].includes(String(draft.tecnica??""));
  const opcoesTubo=usaTubo&&ehPediatrico(idadeMeses)
    ?opcoesDeTubo({idadeMeses,pesoKg})
    :[];
  const airwayKeys=Object.keys(draft).filter(k=>k.startsWith("via_")&&draft[k]===true).length;
  const rcri=Object.keys(draft).filter(k=>k.startsWith("rcri_")&&draft[k]===true).length;
  const stop=Object.keys(draft).filter(k=>k.startsWith("stop_")&&draft[k]===true).length;
  const apfel=Object.keys(draft).filter(k=>k.startsWith("apfel_")&&draft[k]===true).length;
  const requestsBlood=["Sim","Solicitar"].includes(String(draft.concentrado_hemacias??""));
  const conclusions=["Apto para o procedimento proposto","Apto com ressalvas","Necessita otimização clínica","Necessita exames complementares","Necessita avaliação de outra especialidade","Avaliação inconclusiva"];
  // Gestação só é exibida para paciente feminina; portanto não pode bloquear
  // indevidamente a conclusão de uma avaliação masculina.
  const anamnesisKeys = getAnamnesisKeys(draft.sexo || paciente.sexo);
  const anamnesisLabels:Record<string,string>={
    cirurgias_anteriores:"histórico cirúrgico", reacao_anestesica:"reações anestésicas",
    cardiovascular:"doença cardiovascular", respiratoria:"doença respiratória",
    diabetes:"diabetes", neurologica:"doença neurológica/psiquiátrica", outras_doencas:"outras doenças",
    doenca_aguda:"doença aguda", dentaria:"alterações dentárias", alergias:"alergias", habitos:"tabagismo/álcool/substâncias",
    glaucoma:"glaucoma", gestacao:"gestante",
  };
  const missingAnamnesis=[
    ...anamnesisKeys.filter(key=>!isFilled(draft[key])).map(key=>anamnesisLabels[key]),
    ...(draft.alergias==="Sim"&&!isFilled(draft.alergias_detalhes)
      ? ["nome completo da medicação ou do agente causador da alergia"]
      : []),
  ];
  // Somente o essencial para uma avaliação válida bloqueia a conclusão. Todo o
  // restante é opcional: o que não for preenchido simplesmente não é impresso.
  const requirementGroups = [
    ["Identificação", [
      [paciente.nome, "nome do paciente"],
      [age === null && paciente.data_nascimento ? "" : "ok", "data de nascimento válida"],
    ]],
    ["Procedimento", [
      [draft.cirurgia, "cirurgia/procedimento"],
    ]],
    ["ASA", [
      [draft.asa, "classificação ASA"],
    ]],
    ["Conduta", [
      [draft.tecnica, "técnica anestésica"],
      [!requestsBlood || isFilled(draft.quantidade_ch) ? "ok" : "", "quantidade de concentrado de hemácias"],
    ]],
    ["Avaliação final e assinatura", [
      [draft.conclusao, "conclusão"],
      [draft.anestesiologista, "anestesiologista"],
      [draft.crm, "CRM"],
    ]],
  ] as const;
  const missingByGroup = Object.fromEntries(requirementGroups.map(([group, fields]) => [
    group,
    fields.filter(([value]) => !isFilled(value)).map(([, label]) => label),
  ])) as Record<string, string[]>;
  const checklist=requirementGroups.map(([group])=>[group,missingByGroup[group].length===0] as const);
  const allComplete=checklist.every(([,ok])=>ok);
  const missingFields = checklist.filter(([,ok])=>!ok).flatMap(([group])=>missingByGroup[group] ?? []);
  // Lembretes não bloqueantes: ajudam a revisar sem impedir a conclusão.
  const optionalReminders=[
    !isFilled(draft.peso)||!isFilled(draft.altura)?"peso e altura":"",
    missingAnamnesis.length?`anamnese (${missingAnamnesis.length} item(ns))`:"",
    isFilled(draft.medicacao_continua)?"":"uso de medicação contínua",
    isFilled(draft.anticoagulante)?"":"uso de anticoagulante ou antiagregante",
    medications.some(item=>item.confirmada!==true)?"confirmação das orientações de medicamentos":"",
    !isFilled(draft.pa_sistolica)||!isFilled(draft.fc)?"sinais vitais":"",
    !isFilled(draft.mallampati)?"via aérea":"",
    !isFilled(draft.jejum_solidos)||!isFilled(draft.jejum_liquidos)?"jejum":"",
  ].filter(Boolean);
  const summary=[["Paciente",`${paciente.nome}${age!==null?` · ${age} anos`:""}`],["Cirurgia",String(draft.cirurgia||"—")],["IMC",imc?imc.toFixed(1):"—"],["Alergias",draft.alergias==="Não"?"Não relata alergias.":String(draft.alergias_detalhes||"—")],["Capacidade funcional",String(draft.capacidade_funcional||"—")],["Via aérea",`${airwayKeys===0?"Baixa":airwayKeys<=2?"Moderada":"Alta"} probabilidade sugerida`],["ASA",String(draft.asa||"não definida")],["Lee (RCRI)",`${rcri} ponto(s)`],["STOP-Bang / Apfel",`${stop}/8 · ${apfel}/4`],["Medicamentos",`${medications.filter(m=>m.conduta==="Manter").length} manter · ${medications.filter(m=>m.conduta==="Suspender").length} suspender · ${medications.filter(m=>m.conduta==="Avaliar").length} avaliar`]];
  // Entra tudo que não for "Manter". Suspender, individualizar e avaliar são
  // decisões que alguém precisa ler no papel; manter é a única que não pede
  // nada. Antes daqui "Avaliar" ficava de fora, e era o pior lugar para uma
  // omissão: é o valor com que nasce todo medicamento que o guia não conhece.
  //
  // Sem orientação escrita, a linha leva a própria conduta em vez de terminar
  // em dois-pontos e nada — assim a pendência aparece na ficha em vez de sumir.
  const medicationOrientations=medications
    .filter(item=>exigeOrientacao(item.conduta))
    .map(item=>`- ${item.nome}: ${String(item.orientacao||"").trim()||String(item.conduta||"").trim()}`);
  // Jejum e técnica anestésica já saem no bloco de planejamento da ficha; repetir
  // aqui só consumia papel. Restam as orientações de medicamentos.
  const automaticPlan=medicationOrientations.length
    ?`ORIENTAÇÕES SOBRE MEDICAMENTOS:\n${medicationOrientations.join("\n")}`
    :"";
  const planManuallyEdited=draft.plano_anestesico_editado===true;
  useEffect(()=>{
    // Enquanto o texto não for reescrito à mão, ele acompanha jejum, técnica e
    // conduta dos medicamentos. Depois de uma edição manual, nada é sobrescrito.
    if(planManuallyEdited)return;
    const current=String(draft.plano_anestesico||"");
    if(!current||current===lastAutomaticPlan.current){
      lastAutomaticPlan.current=automaticPlan;
      if(current!==automaticPlan)set("plano_anestesico",automaticPlan);
    }
  },[automaticPlan,draft.plano_anestesico,planManuallyEdited,set]);
  function generateText(){lastAutomaticPlan.current=automaticPlan;set("plano_anestesico",automaticPlan);set("plano_anestesico_editado",false)}
  return <><section className="evalSection"><div className="conclusionHeading"><h1>9 · Resumo da avaliação</h1><button className="outlineClinical" onClick={generateText}>Atualizar orientações finais automaticamente ↓</button></div><div className="summaryGrid">{summary.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>
  <section className="evalSection"><h2>Prescrição e planejamento pré-anestésico</h2><div className="planningGrid">
    <label className="evalField plan4"><span>Jejum — sólidos</span><select value={String(draft.jejum_solidos??"")} onChange={e=>set("jejum_solidos",e.target.value)}><option value="">Selecione</option><option>8 horas antes</option><option>6 horas antes (refeição leve)</option><option>Protocolo especial</option></select></label>
    <label className="evalField plan4"><span>Jejum — líquidos claros</span><select value={String(draft.jejum_liquidos??"")} onChange={e=>set("jejum_liquidos",e.target.value)}><option value="">Selecione</option><option>Líquidos claros até 2 h antes</option><option>Jejum absoluto</option><option>Protocolo especial</option></select></label>
    <label className="evalField plan2"><span>Dormonid VO (pré-medicação)</span><select value={String(draft.premedicacao??"")} onChange={e=>set("premedicacao",e.target.value)}><option value="">Selecione</option><option>Não prescrever</option><option>7,5 mg</option><option>15 mg</option></select></label>
    <label className="evalField plan2"><span>Leito de UTI</span><select value={String(draft.leito_uti??"")} onChange={e=>set("leito_uti",e.target.value)}><option value="">Selecione</option><option>Não</option><option>Solicitar</option><option>A definir</option></select></label>
    <label className="evalField plan2"><span>Concentrado de hemácias (CH)</span><select value={String(draft.concentrado_hemacias??"")} onChange={e=>{set("concentrado_hemacias",e.target.value);if(e.target.value!=="Solicitar"&&e.target.value!=="Sim")set("quantidade_ch","")}}><option value="">Selecione</option><option>Não</option><option>Solicitar</option><option>A definir</option></select></label>
    {requestsBlood&&<label className="evalField plan2"><span>CH — quantidade (unidades) *</span><input type="number" min="1" step="1" required value={String(draft.quantidade_ch??"")} onChange={e=>set("quantidade_ch",e.target.value)} placeholder="Ex.: 2"/></label>}
    <label className="evalField plan4"><span>Avaliação especializada</span><input value={String(draft.avaliacao_especializada??"")} onChange={e=>set("avaliacao_especializada",e.target.value)}/></label>
    <label className="evalField plan4"><span>Técnica anestésica</span><select value={String(draft.tecnica??"")} onChange={e=>set("tecnica",e.target.value)}><option value="">—</option><option>Anestesia geral</option><option>Sedação</option><option>Raquianestesia</option><option>Raquianestesia + sedação</option><option>Peridural</option><option>Bloqueio periférico</option><option>Técnica combinada</option></select></label>
    <label className="evalField plan4"><span>Monitorização</span><select value={String(draft.monitorizacao??"")} onChange={e=>set("monitorizacao",e.target.value)}><option value="">Selecione</option><option>Padrão</option><option>Expandida</option><option>Invasiva</option><option>Conforme necessidade clínica</option></select></label>
  </div>{opcoesTubo.length>0&&<div className="pediatricTube">
    <strong>Via aérea pediátrica — sugestão pelo peso e pela idade</strong>
    {/* Aparece calculado, mas so entra na ficha quando o anestesiologista
        toca. E, uma vez tocado, o campo e dele: nada aqui sobrescreve o que
        ele escrever ou apagar depois. */}
    <div className="conclusionOptions">{opcoesTubo.map(o=><button type="button" key={o.tipo} className={draft.tubo_traqueal===o.texto?"selected":""} onClick={()=>set("tubo_traqueal",o.texto)}>{o.texto}</button>)}</div>
    <label className="evalField"><span>Tubo e profundidade (sai na ficha impressa)</span><input value={String(draft.tubo_traqueal??"")} onChange={e=>set("tubo_traqueal",e.target.value)} placeholder="Toque numa opção acima ou escreva"/></label>
    <p className="evalHint">{AVISO_CLINICO}</p>
  </div>}<label className="evalField"><span>Orientações finais da avaliação (preenchidas automaticamente e editáveis)</span><textarea rows={8} value={String(draft.plano_anestesico??"")} onChange={e=>{set("plano_anestesico",e.target.value);set("plano_anestesico_editado",true)}}/><small>{planManuallyEdited?"Texto editado manualmente — será impresso exatamente como está. Use “Atualizar orientações finais automaticamente” para reconstruí-lo.":"O texto acompanha as escolhas de jejum, técnica anestésica e conduta dos medicamentos. Depois de uma edição manual, ele passa a ser impresso exatamente como você escreveu."}</small></label></section>
  <section className="evalSection"><h2>Checklist final <small className="optionalField">Somente estes campos são obrigatórios</small></h2><div className="finalChecklist">{checklist.map(([label,ok])=><span className={ok?"ok":"missing"} key={String(label)}><Icone nome={ok?"confirmado":"alerta"} tamanho={14}/> {label} {ok?"completo":"incompleto"}</span>)}</div><h2>Conclusão</h2><div className="conclusionOptions">{conclusions.map(item=><button type="button" className={draft.conclusao===item?"selected":""} onClick={()=>set("conclusao",item)} key={item}>{item}</button>)}</div><div className="signatureGrid"><label className="evalField"><span>Anestesiologista</span><input value={String(draft.anestesiologista??"")} onChange={e=>set("anestesiologista",e.target.value)}/></label><label className="evalField"><span>CRM / UF</span><input value={String(draft.crm??"")} onChange={e=>set("crm",e.target.value)}/></label><label className="evalField"><span>RQE</span><input value={String(draft.rqe??"")} onChange={e=>set("rqe",e.target.value)}/></label><button type="button" className="finishAssessment" title={saveState==="error"?saveError:undefined} disabled={!allComplete||saveState==="saving"||saveState==="error"} onClick={conclude}>✓ {saveState==="saving"?"Salvando...":"Concluir avaliação"}</button></div>{!allComplete&&<p className="completionWarning">Ainda falta preencher: <strong>{missingFields.join(", ")}.</strong> Revise somente esses campos antes de concluir.</p>}{allComplete&&optionalReminders.length>0&&<p className="evalHint">Opcionais em branco (não impedem a conclusão e não serão impressos): {optionalReminders.join(", ")}.</p>}{saveState==="error"&&<p className="completionWarning">{saveError||"Não foi possível sincronizar o rascunho agora."} <button type="button" className="outlineClinical" onClick={retrySave}>Tentar salvar novamente</button></p>}<p className="evalHint">Os campos são preenchidos com o perfil conectado e continuam editáveis. Para auditoria, o sistema também grava separadamente o usuário autenticado, seus dados cadastrais, a data e a hora da conclusão.</p></section></>;
}
