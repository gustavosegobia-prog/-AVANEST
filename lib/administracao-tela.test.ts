import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A ADMINISTRAÇÃO — as decisões que só existem na tela e no servidor.
 *
 * As regras de equipe (profissão, acesso, permissões efetivas, resumo de
 * mudança, duplicidades, pendências) são testadas em equipe.test.ts. Aqui
 * ficam presas as ligações: quem chama o quê, o que o banco garante e o que
 * não pode voltar.
 */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const tela = ler("app/dashboard/dashboard-client.tsx");
const pessoa = ler("components/admin-pessoa.tsx");
const equipe = ler("components/admin-equipe.tsx");
const ui = ler("components/admin-ui.tsx");
const locais = ler("components/locais-admin.tsx");
const auditoria = ler("components/admin-auditoria.tsx");
const sql = ler("supabase/migrations/202609300014_equipe_e_acessos.sql");
const reenvio = ler("app/api/admin/users/reenviar/route.ts");

test("seis seções, e os endereços antigos continuam abrindo o lugar certo", () => {
  for (const s of ["Visão geral", "Equipe e acessos", "Organização e locais", "Documentos e termos", "Plano e cobrança", "Histórico de atividades"]) {
    assert.ok(tela.includes(`"${s}"]`) || tela.includes(`"${s}",`), `sumiu a seção ${s}`);
  }
  for (const [antigo, novo] of [["locais", "organizacao"], ["usuarios", "equipe"], ["convites", "equipe"], ["termo", "documentos"], ["auditoria", "historico"]]) {
    assert.match(tela, new RegExp(`case "${antigo}": return \\{secao:"${novo}"`), `o id antigo "${antigo}" deixou de abrir ${novo}`);
  }
  assert.match(tela, /Convites pendentes/, "sumiu o atalho direto para os convites pendentes");
});

test("nenhum indicador chama de 'usuários ativos' vínculo e acesso juntos", () => {
  assert.doesNotMatch(tela, /label="Usuários ativos"/);
  assert.doesNotMatch(ler("components/admin-visao-geral.tsx"), /Usuários ativos/);
});

test("o hospital do topo não filtra a Administração, e isso é dito", () => {
  assert.match(tela, /não filtra a Administração/);
  assert.match(tela, /localAtivo=\{localAtivo\} onRefresh/);
});

test("salvar passa pela função protegida, com profissão e concessões antigas", () => {
  assert.match(pessoa, /rpc\("admin_atualizar_perfil", \{/);
  assert.match(pessoa, /p_atuacao_medica: f\.atuacao !== inicial\.atuacao \? f\.atuacao : null/,
    "profissão só vai quando mudou — null é 'não mexa'");
  assert.match(pessoa, /p_manter_legado: f\.manterLegado/);
  assert.doesNotMatch(pessoa, /from\("perfis"\)\.update\(\{[^}]*(role|status|permissoes)/,
    "papel, situação e áreas não podem ser gravados por update direto");
});

test("mudança de acesso mostra o resumo antes de gravar; sair com alteração pergunta", () => {
  assert.match(pessoa, /if \(resumo\.temMudancaDeAcesso\) \{ setRevisando\(resumo\); return; \}/);
  assert.match(pessoa, /titulo="Confirme a mudança de acesso"/);
  assert.match(pessoa, /titulo="Descartar as alterações\?"/);
  assert.match(pessoa, /window\.addEventListener\("beforeunload"/);
});

test("desativar e excluir ficam separados das ações comuns, e excluir obedece ao banco", () => {
  assert.match(pessoa, /<div className="admZonaDeCuidado">/);
  assert.match(pessoa, /rpc\("excluir_usuario", \{ p_perfil_id: pessoa\.id \}\)/);
  assert.match(pessoa, /Com registros, o sistema recusa: use desativar\./);
});

test("cadastro novo: três passos, prévia das permissões e duplicidade sem mescla", () => {
  assert.match(pessoa, /\["Dados da pessoa", "Função e locais", "Revisão e forma de entrada"\]/);
  assert.match(pessoa, /<h3 className="admSubtitulo">Prévia das permissões<\/h3>/);
  assert.match(pessoa, /É outra pessoa, quero continuar/);
  assert.match(pessoa, /if \(enviando\.current\) return; \/\/ proteção contra clique duplo/);
  assert.match(pessoa, /participa dos processos permitidos, como a escala e o faturamento, mas não terá login/);
});

test("a lista preserva busca por nome, e-mail e CRM, tem limpar filtros e vira cartão no celular", () => {
  assert.match(equipe, /`\$\{p\.nome\} \$\{p\.email \?\? ""\} \$\{p\.crm \?\? ""\}`/);
  assert.match(equipe, /Limpar filtros/);
  for (const c of ["Nome", "Profissão", "Função", "Acesso", "Locais", "Ações"]) assert.match(equipe, new RegExp(`data-rotulo="${c}"`));
  assert.match(ler("app/globals.css"), /Celular: a tabela vira cartões, sem rolagem horizontal\./);
});

test("painel e diálogo: foco preso, Esc e foco devolvido", () => {
  assert.match(ui, /if \(e\.key === "Escape"\) \{ onEscRef\.current\(\); return; \}/);
  assert.match(ui, /anterior\?\.focus\?\.\(\)/);
  assert.match(ui, /role="dialog" aria-modal="true"/);
  assert.match(ui, /role="alertdialog" aria-modal="true"/);
});

test("locais: Editar em destaque, o resto num menu, e confirmação com os efeitos", () => {
  assert.match(locais, /aria-haspopup="menu"/);
  assert.match(locais, /<li><b>Escolha de local:<\/b>/);
  assert.match(locais, /<li><b>Escala:<\/b>/);
  assert.match(locais, /Aplica-se a este local, para toda a organização\./);
});

test("histórico: filtros no banco, total separado do que está carregado, paginação", () => {
  assert.match(auditoria, /\{ count: "exact" \}/);
  assert.match(auditoria, /\.range\(pagina \* POR_PAGINA/);
  assert.match(auditoria, /"eventos encontrados"\} com estes filtros · \$\{eventos\.length\} carregado/);
  assert.match(auditoria, /o histórico começa em/);
});

test("banco: papel, situação e áreas só mudam pela função; organização nunca fica sem proprietário", () => {
  assert.match(sql, /create trigger protege_papel_e_acesso\s+before insert or update on public\.perfis/);
  assert.match(sql, /if coalesce\(current_setting\('avanest\.admin_perfil', true\), ''\) = 'sim' then/);
  assert.match(sql, /A organização ficaria sem proprietário ativo\./);
  assert.match(sql, /where x <> all\(v_editaveis\)/, "concessões antigas deixaram de ser preservadas");
  assert.match(sql, /dados_anteriores, dados_novos/);
});

test("reenvio de convite: só para quem nunca entrou, e nunca duas vezes em dez minutos", () => {
  assert.match(reenvio, /if \(conta\.user\.email_confirmed_at \|\| conta\.user\.last_sign_in_at\)/);
  assert.match(reenvio, /const INTERVALO_MINIMO_MS = 10 \* 60_000;/);
  assert.match(reenvio, /!\["admin", "owner"\]\.includes\(actor\.role\)/);
  assert.match(reenvio, /alvo\.institution_id !== actor\.institution_id/);
});
