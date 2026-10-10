import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** A ÁREA MÉDICA — ligações da tela e o que não pode voltar. */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const tela = ler("components/area-medica.tsx");
const painel = ler("app/dashboard/dashboard-client.tsx");
const recepcao = ler("components/recepcao.tsx");
const form = ler("app/avaliacoes/[id]/assessment-form.tsx");

test("entrada: Área médica, local e data, Nova avaliação e as quatro seções", () => {
  assert.match(tela, /<h1>Área médica<\/h1>/);
  assert.match(tela, /\["agenda", "Meu dia"[\s\S]*\["avaliacoes", "Avaliações"[\s\S]*\["pendencias", "Pendências"[\s\S]*\["documentos", "Documentos"/);
  assert.doesNotMatch(painel, /Consultas pré-anestésicas agendadas/);
  assert.doesNotMatch(painel, /Documentos mais recentes/, "o atalho desabilitado sem explicação voltou");
});

test("pendências verificadas separadas de lembretes e do que não é registrado", () => {
  assert.match(tela, /aria-label="Pendências verificadas"/);
  assert.match(tela, /aria-label="Lembretes gerais"/);
  assert.match(tela, /aria-label="Informações indisponíveis"/);
  assert.match(tela, /Nenhuma pendência nos registros \{nomeDoEscopo === "na equipe" \? "da equipe" : "dos seus pacientes"\}\./);
  assert.doesNotMatch(tela + painel, /orientacoes_enviadas/, "o envio não é registrado: não pode virar contagem");
  assert.doesNotMatch(painel, /action="ENVIAR"/);
});

test("várias avaliações abertas aparecem em lista, com local, datas e Continuar", () => {
  assert.match(tela, /outrasAbertas\.map\(\(a\) =>/);
  assert.match(tela, /Outro local: /);
  assert.match(tela, /Iniciada \{quando\(a\.created_at\)\} · última alteração \{quando\(a\.updated_at\)\}/);
});

test("a mesma avaliação não aparece três vezes em Meu dia", () => {
  // Paciente de hoje já tem o botão na linha da agenda (e no cartão do topo).
  assert.match(tela, /const outrasAbertas = retomar\.filter\(\(a\) => !pacientesDeHoje\.has\(a\.patient_id\)\)/);
  assert.doesNotMatch(tela, /retomar\.map\(\(a\) =>/);
});

test("o cartão do topo diz a etapa, e não chama de próximo quem já está em atendimento", () => {
  assert.match(tela, /<span className="medProximoRotulo">\{destaque\.rotulo\}<\/span>/);
  assert.match(tela, /destaque\.depois &&/);
  const css = ler("app/globals.css");
  assert.match(css, /\.medProximo>\.medAcaoCaixa\{grid-column:1\/-1/, "a regra precisa mirar o filho da grade, e não o botão");
  assert.doesNotMatch(css, /\.medProximo\{[^}]*border-left:4px/, "a faixa lateral voltou");
});

test("só o botão tocado diz Abrindo…, e cada botão diz de quem é", () => {
  assert.doesNotMatch(tela, /\{ocupado \? "Abrindo…"/, "todos os botões trocavam de texto juntos");
  assert.match(tela, /\{abrindo \? "Abrindo…" : rotulo\}/);
  assert.match(tela, /aria-label=\{`\$\{rotulo\} de \$\{nome\}`\}/);
});

test("no celular: abas em grade, cartões viram faixa de etapas e alvos de 44px", () => {
  const css = ler("app/globals.css");
  assert.match(css, /\.medAbas\{display:grid;grid-template-columns:1fr 1fr/);
  assert.match(css, /\.medResumo\{display:none\}/);
  assert.match(css, /\.medMain\{--alt-botao-compacto:44px\}/);
  assert.match(css, /\.receptionMain\{--alt-botao-compacto:44px\}/);
  assert.doesNotMatch(css, /\.medConsulta\.fora\{opacity/, "opacidade apagava o texto abaixo de 4,5:1");
  assert.doesNotMatch(css, /\.recLinha\.etapa-faltou\{opacity/);
});

test("quem inicia a avaliação vira o médico da consulta, e a troca fica no histórico", () => {
  assert.match(painel, /const assume=\(perfil\.atuacao_medica \?\? perfil\.role==="medico"\)\?\{medico_id:perfil\.id\}:\{\}/);
  assert.match(painel, /\.update\(\{avaliacao_id:data\.id,\.\.\.assume,/);
  const mig = ler("supabase/migrations/202610100001_troca_de_medico_no_historico.sql");
  assert.match(mig, /new\.medico_id is distinct from old\.medico_id/);
  assert.match(mig, /then 'assumiu' else 'indicado'/);
  assert.match(recepcao, /e\.origem === "medico"/);
});

test("o menu Mais fecha ao tocar fora, e o Esc devolve o foco ao botão", () => {
  assert.match(recepcao, /document\.addEventListener\("pointerdown", fora\)/);
  assert.match(recepcao, /querySelector<HTMLButtonElement>\(`\[data-menu-botao="\$\{id\}"\]`\)\?\.focus\(\)/);
  assert.doesNotMatch(recepcao, /\?\? "Médico" : null/, "o nome que faltava saía como \"Médico: Médico\"");
});

test("sem CPF completo nem horário inventado na listagem", () => {
  assert.match(tela, /cpfMascarado\(p\?\.cpf\)/);
  assert.doesNotMatch(tela, /\{p\??\.cpf\}/);
  assert.doesNotMatch(tela + painel, /8 ?\+ ?index/);
});

test("abrir avaliação não duplica, e consulta nova de paciente antigo começa nova versão", () => {
  assert.match(painel, /if \(abrindoRef\.current\) return;/);
  assert.match(painel, /existing\.status === "concluida" && !\(appointmentId && !assessmentId\)/);
});

test("salvamento: sessão expirada e conexão caída ditas como tal; sair com alteração pergunta", () => {
  assert.match(form, /Sua sessão expirou\./);
  assert.match(form, /Sem conexão com a internet\./);
  assert.match(form, /window\.addEventListener\("beforeunload", aoSair\)/);
  assert.match(form, /\.eq\("lock_version",expectedLockVersion\)/, "o controle de versão contra sobrescrita sumiu");
});

test("falha de carregamento vira aviso, e não lista vazia", () => {
  assert.match(ler("app/dashboard/page.tsx"), /falhasDeCarga=\{\[erroAvaliacoes \? "as avaliações" : null, erroAgendamentos \? "a agenda" : null\]/);
  assert.match(tela, /Não foi possível carregar \{falhasDeCarga\.join\(" e "\)\} agora/);
});

test("agenda vazia não repete Nova avaliação nem Retomar — já estão na tela", () => {
  assert.doesNotMatch(tela, />Iniciar nova avaliação</);
  assert.doesNotMatch(tela, /Retomar avaliação \(\{retomar\.length\}\)/);
  assert.match(tela, /Ver próximos agendamentos/);
});

test("avaliação no celular: Voltar ao painel e o estado do salvamento não somem", () => {
  const css = ler("app/globals.css");
  assert.match(css, /@media\(max-width:1100px\)\{\.evalRoleNav button\.evalVoltar\{display:inline-flex\}\}/,
    "o Voltar volta a perder para `.evalRoleNav button:not(.active)` e some abaixo de 1100px");
  const fim = css.slice(css.indexOf("Avaliação: o estado do salvamento também no celular"));
  assert.match(fim, /\.evalSave\{display:flex;/, "o estado do salvamento voltou a ser escondido no celular");
  assert.match(form, /setSaveError\(\(atual\) => atual \|\| motivoDaFalha\(error\?\.message\)\)/,
    "o motivo legível voltou a ser trocado pela mensagem técnica");
});

test("topo no celular: alinhado à esquerda, sem local repetido e sem cartões apagados", () => {
  const css = ler("app/globals.css");
  assert.match(css, /@media\(min-width:681px\)\{\.medTopo\{align-items:center\}\}/, "centralizar o topo só vale no computador");
  assert.match(css, /@media\(min-width:681px\)\{\.recTopo\{align-items:center\}\}/);
  assert.doesNotMatch(tela, /Nenhum local escolhido/, "o local já está na barra do topo");
  assert.match(css, /\.medCartao:disabled\{cursor:default;opacity:1;color:inherit\}/);
});

test("cada médico entra nos pacientes dele: sem seletor de recorte, médico indicado pela recepção", () => {
  assert.doesNotMatch(tela, /Meus atendimentos|aria-label="De onde"|className="medEscopo"/, "o painel de recorte voltou a poluir a tela");
  assert.match(tela, /useState<Escopo\["pessoa"\]>\(perfilEhMedico \? "meus" : "equipe"\)/, "médico abre nos pacientes dele");
  assert.match(tela, />Meus pacientes<\/button>[\s\S]{0,300}>Equipe<\/button>/, "a equipe fica a um toque");
  assert.match(painel, /perfilEhMedico=\{perfil\.atuacao_medica \?\? perfil\.role==="medico"\}/);
  assert.match(ler("app/dashboard/page.tsx"), /pausada_motivo, atuacao_medica"\)/);
  const rec = ler("components/recepcao.tsx");
  assert.match(rec, /Escolha o médico que vai atender\./);
  assert.match(rec, /"Trocar médico…" : "Indicar médico…"/);
  assert.match(painel, /<select name="medico_id" key=\{medicos\.length\} required=\{medicos\.length>0\}/);
});
