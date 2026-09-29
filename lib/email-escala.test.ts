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
  // No HTML a linha é quebrada em três pedaços — dia, horário e hospital —,
  // mas os três precisam estar lá.
  for (const pedaco of ["Sábado, 03/10", "07:00–19:00", "FUNDHOSPAR"]) {
    assert.ok(m.html.includes(pedaco), `sumiu "${pedaco}" da escala no HTML`);
  }
  // Plantão sem lugar cadastrado não vira " · " solto no fim da linha.
  assert.equal(linhaDoPlantao(PLANTOES[1]), "Sábado, 17/10 · 19:00–07:00");
  // O cumprimento é tratamento, não cadastro.
  assert.match(m.texto, /^Olá, Dra\. Marcelli!/);
  // O título pedido, palavra por palavra.
  assert.match(m.html, /Sua escala de outubro de 2026 foi publicada/);
  assert.match(m.texto, /A escala do FUNDHOSPAR já está disponível na AVANEST/);
});

test("quem montou a escala é nomeado onde a pessoa vai precisar dele", () => {
  // "Fale com o responsável" sem dizer quem é o responsável manda perguntar no
  // grupo quem montou a escala — que é o trabalho que este sistema tira.
  const m = escalaPublicadaEmail({
    organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES, autor: "João Paulo",
  });
  assert.match(m.texto,
    /Caso identifique alguma informação incorreta na escala, entre em contato com o responsável pela elaboração da escala \(João Paulo\)\./);
  // Sem autor único, a frase fica exatamente como foi pedida — sem parêntese
  // vazio. Com dois autores, citar um deles seria dar crédito errado.
  const semAutor = escalaPublicadaEmail({
    organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES,
  });
  assert.match(semAutor.texto,
    /entre em contato com o responsável pela elaboração da escala\./);
  assert.ok(!/\(\)/.test(semAutor.texto), "sobrou um parêntese vazio");
});

test("os dois botões existem, e o de instalar vem primeiro", () => {
  // Sem o AVANEST na tela de início o iPhone não entrega notificação nenhuma:
  // lembrete de plantão, aviso de troca e escala publicada ficam invisíveis. É
  // por isso que instalar é o botão cheio, e não o secundário.
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  const app = m.html.indexOf("Baixar o app AVANEST");
  const escala = m.html.indexOf("Acessar minha escala");
  assert.ok(app > 0 && escala > 0, "sumiu um dos dois botões");
  assert.ok(app < escala, "o botão de instalar deixou de vir primeiro");
  // E cada um aponta para o seu lugar.
  assert.match(m.html, /href="https:\/\/www\.avanest\.com\.br\/app"/);
  assert.match(m.html, /href="https:\/\/www\.avanest\.com\.br\/dashboard\?area=plantoes"/);
  // O texto puro também leva os dois endereços: quem lê num cliente sem HTML
  // não pode ficar sem o caminho.
  assert.match(m.texto, /Instalar o AVANEST: https/);
  assert.match(m.texto, /Acessar minha escala: https/);
});

test("a seção que apresenta o resto do sistema", () => {
  // Este é o único e-mail que um anestesiologista do grupo recebe com certeza.
  // Se ele só entregar a lista, a pessoa nunca descobre que pode pedir troca
  // ou oferecer um plantão.
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  assert.match(m.html, /Gerencie seus plantões pela AVANEST/);
  for (const tema of [/troca de plantão/i, /Oferecer um plantão/, /lembretes/i, /celular/]) {
    assert.match(m.html, tema);
  }
  assert.match(m.html, /Sua escala\. Seus plantões\. Tudo em um só lugar\./);
});

test("sem nome, o cumprimento não fica pela metade", () => {
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  assert.match(m.texto, /^Olá!\n/);
  assert.ok(!/Olá, !/.test(m.texto), "sobrou um cumprimento vazio");
});

test("o HTML sobrevive ao Outlook", () => {
  // O Outlook do Windows renderiza e-mail com o motor do Word: `flex`, `grid`
  // e folha de estilo em <style> não existem para ele. Um layout que fica
  // bonito no Gmail e desmonta no Outlook do administrador do hospital é um
  // layout quebrado.
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  assert.ok(!/display:\s*flex|display:\s*grid/.test(m.html), "entrou flex ou grid no e-mail");
  // O <style> existe, e tem UM trabalho só: desligar os atalhos que o iOS
  // injeta na data e na hora. Isso não tem equivalente inline — os atalhos são
  // criados no cliente, depois, e só se alcançam por seletor. Nenhuma regra de
  // LAYOUT pode morar lá: o Gmail descarta a folha e desmontaria a mensagem.
  const folha = m.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  assert.ok(folha.includes("x-apple-data-detectors"),
    "sumiu a regra que impede o iPhone de virar a escala em links");
  for (const layout of ["padding", "width", "border-radius", "background"]) {
    assert.ok(!folha.includes(layout),
      `regra de layout (${layout}) foi parar no <style>, que o Gmail descarta`);
  }
  assert.ok(!/@media/.test(m.html), "a responsividade aqui é por max-width, não por media query");
  // Largura máxima com corpo fluido: é o que faz caber no telefone sem media
  // query nenhuma.
  assert.match(m.html, /max-width:600px/);
});

test("o valor do plantão NUNCA entra no e-mail", () => {
  // Mesma regra do push, e por um motivo mais forte: e-mail é encaminhado,
  // impresso e lido por cima do ombro. Quanto um anestesista recebe por
  // plantão não é assunto de quem estiver por perto.
  const fonte = fs.readFileSync(new URL("./email-escala.ts", import.meta.url), "utf8");
  assert.ok(!/\bvalor\b/.test(fonte.replace(/\/\/.*$/gm, "")),
    "alguém começou a mandar o valor do plantão por e-mail");
});

test("o iPhone não transforma a escala em links", () => {
  // O Mail do iOS reconhece data e hora no texto e as converte em atalhos
  // tocáveis. "Quinta, 01/10" e "19:00–07:00" viravam azul sublinhado, um em
  // cada linha — a lista parecia cheia de links quebrados, e um toque
  // acidental abria o Calendário em vez de deixar ler o plantão.
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  assert.match(m.html, /format-detection[^>]*date=no/,
    "voltou a deixar o iOS converter as datas da escala");
  // E o modo escuro do Mail invertia a faixa da marca — o azul-escuro virava
  // claro e o logo branco escurecia. Declarar o esquema é o que faz ele parar.
  assert.match(m.html, /name="color-scheme" content="light"/,
    "sem declarar o esquema, o Mail escuro inverte a faixa da marca por conta própria");
});

test("a faixa traz o logo, e diz a marca mesmo com imagem bloqueada", () => {
  // Metade dos clientes bloqueia imagem até a pessoa mandar carregar, e uma
  // faixa vazia no alto faz a mensagem parecer de origem duvidosa — o
  // contrário do que ela precisa parecer.
  const m = escalaPublicadaEmail({ organizacao: "FUNDHOSPAR", mes: "2026-10", plantoes: PLANTOES });
  assert.match(m.html, /<img src="https:\/\/www\.avanest\.com\.br\/avanest-email\.png"[^>]*alt="AVANEST"/,
    "o logo da faixa sumiu, ou ficou sem o alt que o substitui");
  // O fundo da faixa é o fundo do próprio arquivo do logo. A arte veio sem
  // transparência: em faixa de outra cor, o retângulo dela aparece recortado
  // em volta do logo.
  assert.ok(m.html.includes('bgcolor="#071c30"'),
    "a faixa deixou de usar o fundo da própria arte, e o logo vai aparecer recortado");
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
