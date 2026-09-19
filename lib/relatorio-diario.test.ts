import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DIAS_PARA_APARECER_PARADO, DIAS_PARA_PAUSAR, assuntoDoRelatorio, diasParado, dominioDoEmail,
  montarRelatorio, sinaisDeAtencao, textoDoRelatorio, type UsuarioDoUso,
} from "./relatorio-diario.ts";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const AGORA = new Date("2026-09-16T12:00:00Z");
const u = (extra: Partial<UsuarioDoUso> & { nome: string }): UsuarioDoUso => {
  const cheio = {
    email: "alguem@gmail.com", crm: "12345/PR", organizacao: "Org", plano: "trial",
    origem: "direct", conta_criada: "2026-09-15T12:00:00Z",
    ultimo_acesso: "2026-09-16T09:00:00Z", ultima_atividade: null as string | null,
    teste_ate: "2026-11-30T23:59:59Z",
    pacientes: 0, avaliacoes: 0, avaliacoes_concluidas: 0, plantoes: 0,
    aparelhos: 0, ativo_nas_24h: false, ...extra,
  };
  // Por padrão a atividade ACOMPANHA o último acesso — é o caso comum, e é o
  // que os testes escritos antes desta coluna existir assumiam. Quem quer
  // provar a diferença entre os dois passa `ultima_atividade` na mão; o `in`
  // (e não `??`) é para um `null` explícito continuar valendo como resposta.
  return "ultima_atividade" in extra
    ? cheio
    : { ...cheio, ultima_atividade: cheio.ultimo_acesso };
};

test("dias parados contam do último acesso, e da criação de quem nunca entrou", () => {
  assert.equal(diasParado(u({ nome: "A", ultimo_acesso: "2026-09-13T12:00:00Z" }), AGORA), 3);
  assert.equal(diasParado(u({ nome: "B", ultimo_acesso: null,
    conta_criada: "2026-09-11T12:00:00Z" }), AGORA), 5);
});

test("o relatório separa quem entrou, quem usou e quem parou", () => {
  const r = montarRelatorio([
    u({ nome: "Nova", conta_criada: "2026-09-16T08:00:00Z" }),
    u({ nome: "Usando", ativo_nas_24h: true, conta_criada: "2026-09-01T12:00:00Z" }),
    u({ nome: "Parada", conta_criada: "2026-09-01T12:00:00Z",
        ultimo_acesso: "2026-09-10T12:00:00Z" }),
  ], AGORA);
  assert.deepEqual(r.novos.map((x) => x.nome), ["Nova"]);
  assert.deepEqual(r.ativos.map((x) => x.nome), ["Usando"]);
  assert.deepEqual(r.parados.map((x) => x.nome), ["Parada"]);
  assert.equal(r.parados[0].dias, 6);
});

test("os parados vêm do mais parado para o menos", () => {
  // Quem está há mais tempo sumido é quem o dono precisa decidir primeiro.
  const r = montarRelatorio([
    u({ nome: "Cinco dias", ultimo_acesso: "2026-09-11T12:00:00Z" }),
    u({ nome: "Vinte dias", ultimo_acesso: "2026-08-27T12:00:00Z" }),
  ], AGORA);
  assert.deepEqual(r.parados.map((x) => x.nome), ["Vinte dias", "Cinco dias"]);
});

test("o teste que acaba primeiro aparece primeiro", () => {
  const r = montarRelatorio([
    u({ nome: "Sobra muito", teste_ate: "2026-11-30T23:59:59Z" }),
    u({ nome: "Acabando", teste_ate: "2026-09-20T23:59:59Z" }),
  ], AGORA);
  assert.deepEqual(r.emTeste.map((x) => x.nome), ["Acabando", "Sobra muito"]);
  assert.equal(r.emTeste[0].faltam, 5);
});

test("o número vai no ASSUNTO, não só no corpo", () => {
  // Num e-mail que chega todo dia, o assunto é a única parte que se lê sempre.
  // "Relatório diário" sozinho ensina a arquivar sem abrir.
  const cheio = montarRelatorio([
    u({ nome: "Nova", conta_criada: "2026-09-16T08:00:00Z" }),
    // Conta velha, para ela contar como ativa e NÃO como nova: o padrão da
    // fixture nasce há exatamente 24h, que ainda entra no corte de "nova".
    u({ nome: "Ativa", ativo_nas_24h: true, conta_criada: "2026-08-01T12:00:00Z" }),
  ], AGORA);
  assert.equal(assuntoDoRelatorio(cheio), "AVANEST 16/09/2026 — 1 nova, 1 ativo");
  assert.match(assuntoDoRelatorio(montarRelatorio([], AGORA)), /nenhum movimento/);
});

test("domínio próprio vira sinal; provedor comum, não", () => {
  // Não é acusação: metade dos hospitais dá e-mail à equipe. É só o que faz um
  // nome merecer dois segundos de atenção de quem conhece o mercado.
  assert.deepEqual(sinaisDeAtencao(u({ nome: "A", email: "x@gmail.com" }), AGORA), []);
  assert.match(sinaisDeAtencao(u({ nome: "B", email: "x@escritorioadvogados.com.br" }), AGORA).join(),
    /domínio próprio \(escritorioadvogados\.com\.br\)/);
  assert.equal(dominioDoEmail("Fulano@Hotmail.com"), "hotmail.com");
});

test("falta de CRM é sinal, e quem entrou uma vez só também", () => {
  assert.match(sinaisDeAtencao(u({ nome: "A", crm: null }), AGORA).join(), /sem CRM/);
  const passou = u({ nome: "B", conta_criada: "2026-09-13T12:00:00Z",
                     ultimo_acesso: "2026-09-13T12:00:10Z" });
  assert.match(sinaisDeAtencao(passou, AGORA).join(), /entrou uma vez só/);
});

test("o relatório diz que sinal não é acusação", () => {
  // Uma lista de nomes sob um título vago vira suspeita onde não há nada. E o
  // sistema NÃO tem como saber se alguém é concorrente — dizer isso no próprio
  // e-mail evita que a lista seja lida como se soubesse.
  const r = montarRelatorio([u({ nome: "Fulano", crm: null })], AGORA);
  const texto = textoDoRelatorio(r);
  assert.match(texto, /sinais, não acusações/);
  assert.match(texto, /o sistema não sabe quem é concorrente/);
});

test("o e-mail mostra quem foi pausado hoje", () => {
  // Quem pausa é quem conta: separadas, o dono descobriria pelo relatório de
  // amanhã uma conta pausada ontem — ou pelo cliente reclamando.
  const r = montarRelatorio([u({ nome: "Fulano" })], AGORA,
    { totalGeral: 19, pausados: [{ nome: "Sicrano", email: "s@x.com", dias: 4 }] });
  const texto = textoDoRelatorio(r);
  assert.match(texto, /PAUSADAS HOJE POR INATIVIDADE/);
  assert.match(texto, /Sicrano \(s@x\.com\) — 4 dias/);
  // E o recorte fica claro: 1 da campanha, 19 no sistema.
  assert.match(texto, /1 conta\(s\) vinda\(s\) da campanha · 19 usuários ativos/);
});

test("a pausa alcança SÓ conta de campanha, e a trava está no banco", () => {
  // Escrita só na rota, bastaria um parâmetro errado para pausar a equipe da
  // casa. A função do banco exige origem preenchida, plano em teste e dono da
  // própria organização — e é ela que a rota chama.
  const sql = ler("supabase/migrations/202609160002_pausa_por_inatividade.sql");
  assert.match(sql, /raw_user_meta_data->>'origem','\?*'\)? <> ''|raw_user_meta_data->>'origem'/);
  assert.match(sql, /i\.plano = 'trial'/);
  assert.match(sql, /p\.role = 'owner'/);
  assert.match(sql, /p\.pausada_em is null/);
  // E nem anônimo nem usuário logado podem chamá-la.
  assert.match(sql, /revoke execute on function public\.pausar_inativos_da_campanha\(int\) from public, anon, authenticated/);
  const rota = ler("app/api/admin/relatorio-diario/route.ts");
  assert.match(rota, /rpc\("pausar_inativos_da_campanha"/);
});

test("quem é pausado descobre por quê, e como voltar", () => {
  // Antes, conta inativa era devolvida ao login em silêncio: a pessoa tentava
  // de novo, em círculo. Uma porta que fecha calada vira chamado com raiva.
  assert.match(ler("app/dashboard/page.tsx"), /conta=pausada/);
  const login = ler("app/login/page.tsx");
  assert.match(login, /query\.conta === "pausada"/);
  assert.match(login, /Nada foi apagado/);
  assert.match(login, /wa\.me\/5541997870810/);
});

test("o agendador chama o relatório uma vez por dia", () => {
  const vercel = JSON.parse(ler("vercel.json")) as { crons: { path: string; schedule: string }[] };
  const cron = vercel.crons.find((c) => c.path === "/api/admin/relatorio-diario");
  assert.ok(cron, "o cron do relatório sumiu do vercel.json");
  // 11:00 UTC são 08:00 em Brasília: chega antes do primeiro café, e não de
  // madrugada junto com o resto do lixo da caixa de entrada.
  assert.equal(cron!.schedule, "0 11 * * *");
});

test("avisar e pausar têm prazos DIFERENTES, e isso é de propósito", () => {
  // Aparecer na lista é AVISO; ser pausado é AÇÃO. Se a lista só mostrasse quem
  // já passou de catorze dias, o dono veria o nome da pessoa no mesmo e-mail em
  // que a conta dela foi desligada — tarde demais para a mensagem que evitaria
  // isso.
  assert.equal(DIAS_PARA_APARECER_PARADO, 3);
  assert.equal(DIAS_PARA_PAUSAR, 14);
  assert.ok(DIAS_PARA_APARECER_PARADO < DIAS_PARA_PAUSAR);
  // E é o prazo da ROTA que governa: o default do banco existe só para a função
  // nunca rodar sem prazo nenhum.
  assert.match(ler("app/api/admin/relatorio-diario/route.ts"),
    /const DIAS_PARA_PAUSAR = 14;/);
  assert.match(ler("supabase/migrations/202609160002_pausa_por_inatividade.sql"),
    /p_dias int default 14/);
});

test("a lista de parados diz quanto falta para a pausa", () => {
  // Sem isso a lista é só um número: "5 dias sem entrar" não diz se é hora de
  // mandar mensagem ou se ainda sobra semana.
  const r = montarRelatorio([
    u({ nome: "Quase la", ultimo_acesso: "2026-09-04T12:00:00Z" }),
    u({ nome: "Passou", ultimo_acesso: "2026-08-20T12:00:00Z" }),
  ], AGORA);
  const texto = textoDoRelatorio(r);
  assert.match(texto, /Quase la — 12 dias sem entrar \(trial\) · pausa em 2 dia\(s\)/);
  assert.match(texto, /Passou — 27 dias sem entrar \(trial\) · será pausada/);
});

test("PARADO É QUEM NÃO FEZ NADA, e não quem não digitou a senha de novo", () => {
  // O caso real que obrigou a correção: o cadastro da campanha que mais usa o
  // produto lançou sete plantões em três sessões ao longo de dois dias e não
  // relogou nenhuma vez. Pelo login ele aparecia parado; de verdade, estava
  // fechando o mês dele dentro do sistema.
  const usando = u({
    nome: "Pedro", ultimo_acesso: "2026-09-01T12:00:00Z",
    ultima_atividade: "2026-09-15T18:00:00Z",
  });
  // Zero, e não 1: de 15/09 18:00 a 16/09 12:00 vão 18 horas, e a conta é de
  // DIAS INTEIROS. O que o teste trava é o contraste com os 15 dias que o
  // último login devolveria.
  assert.equal(diasParado(usando, AGORA), 0, "quem mexeu ontem não está parado há 15 dias");
  assert.equal(
    diasParado({ ...usando, ultima_atividade: null }, AGORA), 15,
    "e sem a coluna nova seria exatamente o número errado que motivou a correção",
  );

  const sumido = u({
    nome: "Reniel", ultimo_acesso: "2026-09-01T12:00:00Z",
    ultima_atividade: "2026-09-01T12:00:00Z",
  });
  assert.equal(diasParado(sumido, AGORA), 15, "quem não fez nada continua parado");
});

test("quem só usa e nunca reloga NÃO entra na lista de parados", () => {
  const r = montarRelatorio([
    u({ nome: "Logado no celular", ultimo_acesso: "2026-08-01T12:00:00Z",
        ultima_atividade: "2026-09-16T08:00:00Z", conta_criada: "2026-07-01T12:00:00Z" }),
  ], AGORA);
  assert.deepEqual(r.parados.map((x) => x.nome), [],
    "46 dias pelo login, zero de verdade — este é o cliente que não se quer desligar");
});

test("sem a coluna do banco, cai no último acesso em vez de zerar", () => {
  // Uma rota antiga ou uma resposta sem a coluna nova não pode virar "parado há
  // zero dias": isso ESCONDERIA do relatório justamente quem sumiu.
  const semColuna = u({ nome: "Antiga", ultima_atividade: null,
    ultimo_acesso: "2026-09-06T12:00:00Z" });
  assert.equal(diasParado(semColuna, AGORA), 10);
});

test("o prazo da pausa conta pela atividade, e o e-mail mostra a mesma conta", () => {
  // O e-mail e o banco TÊM de contar a mesma história: a função
  // `ultima_atividade` do banco é a origem dos dois números.
  const quase = u({ nome: "Quase", ultimo_acesso: "2026-07-01T12:00:00Z",
    ultima_atividade: "2026-09-04T12:00:00Z", conta_criada: "2026-06-01T12:00:00Z" });
  const r = montarRelatorio([quase], AGORA);
  assert.equal(r.parados[0].dias, 12);
  const texto = textoDoRelatorio(r);
  assert.ok(texto.includes(`pausa em ${DIAS_PARA_PAUSAR - 12} dia(s)`), texto);
});

test("a pausa no BANCO não olha mais o último login", () => {
  // A trava tem de estar no SQL, e não só no TypeScript: é a função do banco
  // que decide desligar conta, e ela sobrevive a qualquer chamada nova feita
  // meses adiante por outro caminho.
  const sql = ler("supabase/migrations/202609180001_atividade_de_verdade.sql");
  assert.match(sql, /public\.ultima_atividade\(p\.id\) < now\(\) - make_interval/);
  // O campo antigo pode ser citado nos comentários que explicam a correção,
  // mas não pode mais aparecer decidindo a pausa.
  const semComentarios = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.ok(!/last_sign_in_at.*make_interval|coalesce\(u\.last_sign_in_at, u\.created_at\) </.test(semComentarios),
    "o último login voltou a decidir a pausa");
  // E as quatro travas continuam de pé. Aqui é `includes`, e não expressão
  // regular: o trecho tem aspas simples e parênteses, e uma regex sobre-escapada
  // reprova um SQL que está certo — foi o que aconteceu na primeira execução.
  assert.ok(semComentarios.includes(`coalesce(u.raw_user_meta_data->>'origem','') <> ''`),
    "a trava da origem saiu do SQL");
  assert.match(semComentarios, /i\.plano = 'trial'/);
  assert.match(semComentarios, /p\.role = 'owner'/);
  assert.match(semComentarios, /p\.pausada_em is null/);
  // A definição de atividade é PESSOAL: ficha e paciente filtrados por quem
  // fez. Pela organização, o trabalho de um manteria a equipe inteira "ativa".
  assert.match(semComentarios, /avaliacoes x where x\.created_by = p\.id/);
  assert.match(semComentarios, /pacientes x where x\.created_by = p\.id/);
  // E nem anônimo nem usuário logado alcançam a função nova.
  assert.match(sql, /revoke execute on function public\.ultima_atividade\(uuid\) from public, anon, authenticated/);
});
