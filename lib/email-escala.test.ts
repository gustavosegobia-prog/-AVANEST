import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { escalaPublicadaEmail, linhaDoPlantao, mesPorExtenso } from "./email-escala.ts";

const PLANTOES = [
  { data: "2026-10-03", hora_inicio: "07:00:00", hora_fim: "19:00:00", local: "FUNDHOSPAR" },
  { data: "2026-10-17", hora_inicio: "19:00:00", hora_fim: "07:00:00", local: "" },
];

test("o assunto traz o número, porque é o que a caixa de entrada mostra", () => {
  // Metade das caixas do celular mostra só o assunto. "Escala de outubro
  // publicada" obriga a abrir para descobrir se são dois ou catorze plantões.
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  assert.equal(m.assunto, "Escala de outubro de 2026 — 2 plantões seus");
  const um = escalaPublicadaEmail({
    organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: [PLANTOES[0]],
  });
  assert.equal(um.assunto, "Escala de outubro de 2026 — 1 plantão seu");
});

test("o ano vai no mês, porque e-mail se lê meses depois", () => {
  // O push pode omitir o ano: ele é lido no minuto em que chega. O e-mail fica
  // na caixa, e "escala de janeiro" sem ano é uma dúvida real em dezembro.
  assert.equal(mesPorExtenso("2027-01"), "janeiro de 2027");
});

test("a escala vai DENTRO da mensagem, e não um convite para ir ver", () => {
  // "Entre para conferir" devolve à pessoa exatamente o trabalho que ela faria
  // sem e-mail nenhum.
  const m = escalaPublicadaEmail({
    nome: "Dra. MARCELLI DE SOUZA", organizacao: "FUNDHOSPAR",
    mes: "2026-10", plantoes: PLANTOES, autor: "João Paulo",
  });
  assert.match(m.texto, /Sábado, 03\/10 · 07:00–19:00 · FUNDHOSPAR/);
  assert.match(m.html, /Sábado, 03\/10 · 07:00–19:00 · FUNDHOSPAR/);
  // Plantão sem lugar cadastrado não vira " · " solto no fim da linha.
  assert.equal(linhaDoPlantao(PLANTOES[1]), "Sábado, 17/10 · 19:00–07:00");
  // O cumprimento é tratamento, não cadastro.
  assert.match(m.texto, /^Olá, Dra\. Marcelli\./);
  // Quem montou responde por um plantão trocado — no grupo pequeno, reclama-se
  // com uma pessoa.
  assert.match(m.texto, /montada por João Paulo/);
});

test("sem nome, o cumprimento não fica pela metade", () => {
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  assert.match(m.texto, /^Olá\.\n/);
  assert.ok(!/Olá, \./.test(m.texto), "sobrou um cumprimento vazio");
});

test("o valor do plantão NUNCA entra no e-mail", () => {
  // Mesma regra do push, e por um motivo mais forte: e-mail é encaminhado,
  // impresso e lido por cima do ombro. Quanto um anestesista recebe por
  // plantão não é assunto de quem estiver por perto.
  const fonte = fs.readFileSync(new URL("./email-escala.ts", import.meta.url), "utf8");
  assert.ok(!/\bvalor\b/.test(fonte.replace(/\/\/.*$/gm, "")),
    "alguém começou a mandar o valor do plantão por e-mail");
});

test("texto de banco não vira HTML", () => {
  // O nome do hospital e o da organização vêm de campo digitado. Sem escapar,
  // um "<" no cadastro quebra a mensagem — e um `<script>` viaja junto.
  const m = escalaPublicadaEmail({
    organizacao: '<script>alert(1)</script>', mes: "2026-10",
    plantoes: [{ ...PLANTOES[0], local: 'Santa "Casa" & Cia <b>' }],
  });
  assert.ok(!/<script>/.test(m.html), "o HTML do e-mail aceita marcação vinda do banco");
  assert.match(m.html, /&amp;/);
});

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("o botão da escala manda pelos dois canais", () => {
  const rota = ler("app/api/push/avisar/route.ts");
  assert.match(rota, /const emails = tipo === "escala" \? await mandarOsEmails\(\) : 0;/,
    "o e-mail da escala sumiu da rota");
  // SÓ NO AVISO DE ESCALA. Troca e alteração são assunto de minutos, e um
  // e-mail que chega depois da decisão é ruído.
  assert.ok(!/tipo === "troca"[\s\S]{0,400}enviarEmail/.test(rota),
    "o e-mail vazou para os avisos de troca");
  // A PREFERÊNCIA DE QUEM RECEBE vale nos dois canais: quem desligou o aviso
  // desligou o aviso, não o meio.
  assert.match(rota, /if \(!aceita\(preferencia, "escala"\)\) return false;/,
    "o e-mail passou a ignorar quem desligou o aviso de escala");
  // Membro só-nome tem endereço interno que não recebe nada; mandar para lá
  // devolve uma devolução por pessoa e derruba a reputação do domínio.
  assert.ok(/\.invalid\$/.test(rota), "o e-mail voltou a tentar os membros sem acesso");
});

test("a tela conta os dois canais separados", () => {
  const tela = ler("components/plantoes.tsx");
  assert.match(tela, /const caixas = Number\(dados\.emails \?\? 0\);/,
    "a tela deixou de contar os e-mails");
  // Somar os dois num número só esconderia se a equipe está recebendo pelo
  // aparelho ou se o sistema ainda depende do e-mail para ser lido.
  assert.match(tela, /partes\.join\(" e "\)/, "os dois canais voltaram a virar um número só");
  // E o zero por falta de configuração não pode mandar cobrar a equipe.
  assert.match(tela, /"sem-aparelho-nem-email"/,
    "sumiu a explicação do zero por serviço não configurado");
});
