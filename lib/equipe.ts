// A equipe como conceitos separados, e não como uma etiqueta só.
//
// A tela antiga mostrava numa mesma fileira de etiquetas a função no sistema
// ("Anestesiologista", que é role = medico), a área extra, o escalista, o
// "Sem acesso" e o "Ativo" — e a mesma pessoa aparecia "Ativo" e "Sem acesso"
// sem nada dizendo que uma coisa é o vínculo com a equipe e a outra é o login.
// Aqui cada pergunta tem a sua resposta:
//
//   profissão ........ atua como médico? (perfis.atuacao_medica, CRM, função)
//   função ........... o que faz no sistema (perfis.role)
//   responsabilidade . monta a escala? está na escala?
//   vínculo .......... faz parte da equipe (status)
//   acesso ........... entra no sistema? (sem_acesso, status, convite aceito)
//   áreas ............ o que pode fazer em cada parte do sistema
//
// Nada aqui é deduzido do NOME de um perfil. Tudo sai de colunas do banco, e
// as capacidades descritas são as que as políticas do banco aplicam de fato
// (conferidas em pg_policies ao escrever este arquivo) — não o que a tela
// gostaria que fosse.

export type Pessoa = {
  id: string;
  nome: string;
  email: string | null;
  role: string;
  status: string;
  crm: string | null;
  rqe: string | null;
  permissoes: string[] | null;
  sem_acesso?: boolean;
  na_escala?: boolean;
  escalista?: boolean;
  atuacao_medica?: boolean | null;
  pausada_motivo?: string | null;
  created_at?: string;
};

/** O que situacao_de_acesso_da_equipe() devolve para cada pessoa. */
export type Login = {
  convidado_em: string | null;
  confirmado_em: string | null;
  ultimo_acesso: string | null;
};

export type ConviteDeLink = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

const DIA = 86_400_000;
const dias = (de: string, ate: string) =>
  Math.floor((Date.parse(ate) - Date.parse(de)) / DIA);
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// ── Função no sistema ─────────────────────────────────────────────────────

/**
 * O que cada função faz, em linguagem de quem administra.
 *
 * "medico" é a função CLÍNICA no sistema — e não a profissão. Por isso o
 * rótulo é "Área médica", e não "Médico" nem "Anestesiologista": um médico
 * pode ter a função Administrador e continua sendo médico (ver profissão).
 */
export const FUNCOES: Record<string, { rotulo: string; resumo: string }> = {
  owner: {
    rotulo: "Proprietário",
    resumo: "Responde pela organização: faz tudo o que o administrador faz e é o único que altera ou transfere a propriedade.",
  },
  admin: {
    rotulo: "Administrador",
    resumo: "Gerencia equipe, convites, locais, termo e dados da organização, e usa todas as áreas contratadas.",
  },
  medico: {
    rotulo: "Área médica",
    resumo: "Faz avaliações pré-anestésicas, atende pacientes e agenda, e participa da escala.",
  },
  recepcao: {
    rotulo: "Recepção",
    resumo: "Cadastra pacientes e cuida da agenda de consultas.",
  },
  financeiro: {
    rotulo: "Financeiro",
    resumo: "Cuida do faturamento, recebimentos e fechamento do mês, sem acesso ao conteúdo clínico.",
  },
};

export const rotuloDaFuncao = (role: string) => FUNCOES[role]?.rotulo ?? role;

/** As áreas que podem ser concedidas além da função. */
export const AREAS_CONCEDIVEIS = ["recepcao", "medico", "financeiro"] as const;
export const NOME_DA_AREA_EXTRA: Record<string, string> = {
  recepcao: "Recepção", medico: "Área médica", financeiro: "Financeiro",
};

// ── Profissão ─────────────────────────────────────────────────────────────

export type Profissao = {
  tipo: "medico" | "nao_medico" | "nao_informada";
  rotulo: string;
  /** De onde veio a resposta — para a tela não afirmar mais do que sabe. */
  fonte: "informada" | "crm" | "funcao" | "nenhuma";
};

/**
 * Atua como médico?
 *
 * A resposta informada (perfis.atuacao_medica) manda. Sem ela, só duas
 * evidências contam: CRM cadastrado, ou a função clínica. Proprietário ou
 * administrador sem nenhuma das duas fica "não informada" — pode ser médico,
 * pode ser o gestor da clínica, e chutar seria inventar profissão.
 */
export function profissao(p: Pessoa): Profissao {
  if (p.atuacao_medica === true) return { tipo: "medico", rotulo: "Médico(a)", fonte: "informada" };
  if (p.atuacao_medica === false) return { tipo: "nao_medico", rotulo: "Outra profissão", fonte: "informada" };
  if ((p.crm ?? "").trim()) return { tipo: "medico", rotulo: "Médico(a)", fonte: "crm" };
  if (p.role === "medico") return { tipo: "medico", rotulo: "Médico(a)", fonte: "funcao" };
  return { tipo: "nao_informada", rotulo: "Não informada", fonte: "nenhuma" };
}

export const atuaComoMedico = (p: Pessoa) => profissao(p).tipo === "medico";

/**
 * CRM e RQE aparecem para quem atua como médico — inclusive administrador e
 * proprietário — e para quem já tem CRM gravado: esconder um dado existente
 * seria o jeito mais fácil de ele ser apagado sem ninguém ver.
 */
export const mostraRegistroMedico = (p: Pessoa) =>
  atuaComoMedico(p) || Boolean((p.crm ?? "").trim()) || Boolean((p.rqe ?? "").trim());

// ── CRM/UF ────────────────────────────────────────────────────────────────

const UFS = new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);

/**
 * Lê o CRM como foi digitado ("60593/PR", "CRM-PR 60.593", "60593 pr") e
 * devolve número e UF. Só lê — o valor gravado nunca é reescrito por isto.
 */
export function lerCRM(crm: string | null | undefined): { numero: string; uf: string | null } | null {
  const texto = (crm ?? "").toUpperCase();
  const numero = texto.replace(/\D/g, "");
  if (!numero) return null;
  const uf = (texto.match(/\b[A-Z]{2}\b/g) ?? []).find((s) => UFS.has(s)) ?? null;
  return { numero: numero.replace(/^0+(?=\d)/, ""), uf };
}

/** "CRM 60593/PR" para exibir; o texto original quando não dá para ler. */
export function formatarCRM(crm: string | null | undefined): string {
  const lido = lerCRM(crm);
  if (!lido) return (crm ?? "").trim();
  return lido.uf ? `CRM ${lido.numero}/${lido.uf}` : `CRM ${lido.numero} (UF não informada)`;
}

// ── Acesso e vínculo ──────────────────────────────────────────────────────

export type EstadoDoAcesso = "habilitado" | "convite_pendente" | "sem_conta" | "desativado" | "pausado";

export const ROTULO_DO_ACESSO: Record<EstadoDoAcesso, string> = {
  habilitado: "Acesso habilitado",
  convite_pendente: "Convite pendente",
  sem_conta: "Sem conta",
  desativado: "Acesso desativado",
  pausado: "Acesso pausado",
};

/**
 * Entra no sistema?
 *
 * "Convite pendente" só aparece quando se SABE: login lido de
 * situacao_de_acesso_da_equipe() mostrando que a pessoa nunca confirmou nem
 * entrou. Sem essa leitura (falha de carregamento), a conta existe e está
 * ativa — e isso é "habilitado", que é verdade; a tela avisa à parte que
 * não conseguiu conferir quem já aceitou.
 */
export function estadoDoAcesso(p: Pessoa, login?: Login | null): EstadoDoAcesso {
  if (p.sem_acesso) return "sem_conta";
  if (p.status !== "ativo") return p.pausada_motivo === "inatividade" ? "pausado" : "desativado";
  if (login && !login.confirmado_em && !login.ultimo_acesso) return "convite_pendente";
  return "habilitado";
}

export function explicacaoDoAcesso(estado: EstadoDoAcesso, login?: Login | null): string {
  switch (estado) {
    case "sem_conta":
      return "Participa da escala e do faturamento, sem login: não há e-mail, senha nem convite.";
    case "desativado":
      return "Não entra no sistema e sai da escala. O cadastro e todo o histórico continuam.";
    case "pausado":
      return "Pausado por falta de uso no teste gratuito. O cadastro e o histórico continuam.";
    case "convite_pendente":
      return login?.convidado_em
        ? `Convite enviado em ${dataBr(login.convidado_em)}; a pessoa ainda não criou a senha.`
        : "A pessoa ainda não criou a senha.";
    default:
      return login?.ultimo_acesso ? `Último acesso em ${dataBr(login.ultimo_acesso)}.` : "Pode entrar no sistema.";
  }
}

/** O vínculo com a equipe — separado do login: quem não tem conta continua na equipe. */
export const vinculoAtivo = (p: Pessoa) => p.status === "ativo";

// ── Permissões efetivas ───────────────────────────────────────────────────

export type Nivel = "Visualizar" | "Cadastrar" | "Editar" | "Aprovar" | "Administrar";

export type AreaEfetiva = {
  id: "pacientes" | "avaliacoes" | "escala" | "financeiro" | "administracao";
  nome: string;
  niveis: Nivel[];
  /** O que cada nível quer dizer nesta área, na ordem dos níveis. */
  descricao: string;
  /** Por que a pessoa tem esta área. */
  origem: "funcao" | "area_extra" | "legado";
  /** A organização não contratou o módulo: a permissão existe, a área não abre. */
  foraDoPlano?: boolean;
};

export type Contexto = {
  /** Módulos contratados pela organização; null = todos. */
  modulos?: readonly string[] | null;
  /** Há escalista eleito e ativo na organização? */
  temEscalista?: boolean;
};

const temModulo = (ctx: Contexto, m: string) => !ctx.modulos || ctx.modulos.includes(m);

/**
 * O que a pessoa pode fazer, área por área — a soma da função, das áreas
 * extras e das concessões antigas. Espelha as políticas do banco:
 *
 *   pacientes/agendamentos: recepcao, medico, admin, owner (+ extra recepcao/medico)
 *   avaliacoes:             medico, admin, owner (+ extra medico)
 *   plantoes:               o próprio plantão; a escala do grupo com pode_montar_escala()
 *   financeiro_*:           current_has_permission('financeiro') + módulo
 *   perfis/convites/locais/termo: admin, owner
 *
 * Quem está sem conta ou com o acesso desativado não usa nenhuma área — a
 * lista sai vazia, e a tela explica por quê.
 */
export function areasEfetivas(p: Pessoa, ctx: Contexto = {}): AreaEfetiva[] {
  if (p.sem_acesso || p.status !== "ativo") return [];
  const extras = (p.permissoes ?? []).filter((x) => x !== p.role);
  const todos = extras.includes("todos");
  const administra = p.role === "admin" || p.role === "owner";
  const origem = (porFuncao: boolean, extra: string): AreaEfetiva["origem"] =>
    porFuncao ? "funcao" : extras.includes(extra) ? "area_extra" : "legado";
  const lista: AreaEfetiva[] = [];

  const pacFuncao = administra || p.role === "recepcao" || p.role === "medico";
  if (pacFuncao || extras.includes("recepcao") || extras.includes("medico") || todos) {
    lista.push({
      id: "pacientes", nome: "Pacientes e agenda",
      niveis: ["Visualizar", "Cadastrar", "Editar"],
      descricao: "Vê, cadastra e edita pacientes e agendamentos da organização.",
      origem: origem(pacFuncao, extras.includes("recepcao") ? "recepcao" : "medico"),
      foraDoPlano: !temModulo(ctx, "recepcao") && !temModulo(ctx, "medico"),
    });
  }

  const avFuncao = administra || p.role === "medico";
  if (avFuncao || extras.includes("medico") || todos) {
    lista.push({
      id: "avaliacoes", nome: "Avaliações pré-anestésicas",
      niveis: ["Visualizar", "Cadastrar", "Editar"],
      descricao: "Vê, registra e edita avaliações, fichas e termos.",
      origem: origem(avFuncao, "medico"),
      foraDoPlano: !temModulo(ctx, "medico"),
    });
  }

  if (avFuncao || extras.includes("medico") || todos) {
    const monta = p.role === "owner" || p.escalista === true || (p.role === "admin" && !ctx.temEscalista);
    lista.push({
      id: "escala", nome: "Escala e plantões",
      niveis: monta ? ["Visualizar", "Cadastrar", "Administrar"] : ["Visualizar", "Cadastrar"],
      descricao: monta
        ? "Vê a escala, lança os próprios plantões e monta a escala do grupo."
        : "Vê a escala e lança os próprios plantões. Não monta a escala do grupo.",
      origem: origem(avFuncao, "medico"),
      foraDoPlano: !temModulo(ctx, "plantoes"),
    });
  }

  const finFuncao = administra || p.role === "financeiro";
  if (finFuncao || extras.includes("financeiro") || todos) {
    lista.push({
      id: "financeiro", nome: "Financeiro",
      niveis: ["Visualizar", "Cadastrar", "Editar", "Aprovar"],
      descricao: "Vê e lança atendimentos, recebimentos e despesas, e confere e fecha o mês.",
      origem: origem(finFuncao, "financeiro"),
      foraDoPlano: !temModulo(ctx, "financeiro"),
    });
  }

  if (administra) {
    lista.push({
      id: "administracao", nome: "Administração",
      niveis: ["Administrar"],
      descricao: p.role === "owner"
        ? "Equipe, convites, locais, termo, dados da organização e assinatura; altera e transfere a propriedade."
        : "Equipe, convites, locais, termo e dados da organização. Não altera proprietários.",
      origem: "funcao",
    });
  }
  return lista;
}

/**
 * Concessões que não são nenhuma das três áreas — gravadas por fora da tela,
 * antes dela. Aparecem para quem administra, e não somem sozinhas.
 */
export function concessoesLegadas(p: Pessoa): { valor: string; efeito: string }[] {
  return (p.permissoes ?? [])
    .filter((x) => !(AREAS_CONCEDIVEIS as readonly string[]).includes(x))
    .map((valor) => ({
      valor,
      efeito: valor === "todos"
        ? "Concessão antiga de acesso a todas as áreas (Recepção, Área médica e Financeiro). Não dá poderes de administração."
        : valor === "clinico"
          ? "Concessão antiga \"clinico\": não tem efeito no sistema atual."
          : `Concessão "${valor}" desconhecida: não tem efeito no sistema atual.`,
    }));
}

// ── O resumo antes de salvar ──────────────────────────────────────────────

export type ResumoDaMudanca = {
  passaAPermitir: string[];
  deixaDePermitir: string[];
  /** Mudanças que não são de área: login, escala, proprietário. */
  outras: string[];
  /** Onde a mudança vale. */
  escopo: string;
  temMudancaDeAcesso: boolean;
};

const chavesDe = (areas: AreaEfetiva[]) =>
  new Map(areas.flatMap((a) => a.niveis.map((n) => [`${a.nome}: ${n.toLowerCase()}`, a] as const)));

/**
 * O que muda de acesso entre o cadastro atual e o editado — para mostrar ANTES
 * de salvar. O acesso no AVANEST não é limitado por local: toda mudança vale
 * em todos os locais da organização, e o resumo diz isso com essas palavras.
 */
export function resumoDaMudanca(antes: Pessoa, depois: Pessoa, ctx: Contexto = {}): ResumoDaMudanca {
  const a = chavesDe(areasEfetivas(antes, ctx));
  const d = chavesDe(areasEfetivas(depois, ctx));
  const passaAPermitir = [...d.keys()].filter((k) => !a.has(k));
  const deixaDePermitir = [...a.keys()].filter((k) => !d.has(k));
  const outras: string[] = [];
  if (antes.status === "ativo" && depois.status !== "ativo") {
    outras.push("Deixa de entrar no sistema e sai da escala. O cadastro, os plantões e o histórico continuam.");
  }
  if (antes.status !== "ativo" && depois.status === "ativo") {
    outras.push("Volta a entrar no sistema e a aparecer na escala.");
  }
  if (antes.role !== "owner" && depois.role === "owner") outras.push("Passa a ser proprietário da organização.");
  if (antes.role === "owner" && depois.role !== "owner") outras.push("Deixa de ser proprietário da organização.");
  if ((antes.escalista === true) !== (depois.escalista === true)) {
    outras.push(depois.escalista
      ? "Passa a montar a escala do grupo. Com um escalista definido, administradores deixam de montar."
      : "Deixa de montar a escala do grupo.");
  }
  const legadoAntes = concessoesLegadas(antes).map((c) => c.valor).join(",");
  const legadoDepois = concessoesLegadas(depois).map((c) => c.valor).join(",");
  if (legadoAntes !== legadoDepois) outras.push("Remove as concessões antigas feitas por fora desta tela.");
  const temMudancaDeAcesso = passaAPermitir.length > 0 || deixaDePermitir.length > 0 || outras.length > 0;
  return {
    passaAPermitir, deixaDePermitir, outras, temMudancaDeAcesso,
    escopo: "Vale para toda a organização, em todos os locais — o acesso no AVANEST não é separado por local.",
  };
}

// ── Duplicidades ──────────────────────────────────────────────────────────

export type Duplicidade = {
  motivo: "email" | "crm";
  evidencia: string;
  pessoas: Pessoa[];
};

const emailNormal = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

/** O mesmo CRM: número igual e UF igual — ou uma das duas sem UF. */
function mesmoCRM(x: string | null | undefined, y: string | null | undefined) {
  const a = lerCRM(x), b = lerCRM(y);
  if (!a || !b || a.numero !== b.numero) return false;
  return !a.uf || !b.uf || a.uf === b.uf;
}

/** Possíveis cadastros duplicados já existentes na equipe. Nunca mescla nada. */
export function duplicidadesNaEquipe(pessoas: Pessoa[]): Duplicidade[] {
  const achadas: Duplicidade[] = [];
  const porEmail = new Map<string, Pessoa[]>();
  for (const p of pessoas) {
    const e = emailNormal(p.email);
    if (e) porEmail.set(e, [...(porEmail.get(e) ?? []), p]);
  }
  for (const [e, lista] of porEmail) {
    if (lista.length > 1) achadas.push({ motivo: "email", evidencia: `mesmo e-mail (${e})`, pessoas: lista });
  }
  const vistos = new Set<string>();
  for (const p of pessoas) {
    if (!lerCRM(p.crm) || vistos.has(p.id)) continue;
    const iguais = pessoas.filter((q) => q.id !== p.id && mesmoCRM(p.crm, q.crm));
    if (!iguais.length) continue;
    const grupo = [p, ...iguais];
    grupo.forEach((q) => vistos.add(q.id));
    achadas.push({ motivo: "crm", evidencia: `mesmo CRM (${formatarCRM(p.crm)})`, pessoas: grupo });
  }
  return achadas;
}

/** Quem já existe com o e-mail ou o CRM de um cadastro novo. */
export function possiveisDuplicados(
  novo: { email?: string; crm?: string },
  pessoas: Pessoa[],
  convites: ConviteDeLink[] = [],
): { pessoa?: Pessoa; convite?: ConviteDeLink; motivo: string }[] {
  const e = emailNormal(novo.email);
  const achados: { pessoa?: Pessoa; convite?: ConviteDeLink; motivo: string }[] = [];
  for (const p of pessoas) {
    if (e && emailNormal(p.email) === e) achados.push({ pessoa: p, motivo: "mesmo e-mail" });
    else if (novo.crm && mesmoCRM(novo.crm, p.crm)) achados.push({ pessoa: p, motivo: `mesmo CRM (${formatarCRM(p.crm)})` });
  }
  for (const c of convites) {
    if (e && c.status === "pendente" && emailNormal(c.email) === e) {
      achados.push({ convite: c, motivo: "já existe um convite por link pendente para este e-mail" });
    }
  }
  return achados;
}

// ── Convites ──────────────────────────────────────────────────────────────

export type EstadoDoConvite = "pendente" | "expirado" | "aceito" | "cancelado";

/** "revogado" no banco é "cancelado" na tela; "expirado" sai da data. */
export function estadoDoConvite(c: ConviteDeLink, agora: string): EstadoDoConvite {
  if (c.status === "aceito") return "aceito";
  if (c.status === "revogado") return "cancelado";
  return Date.parse(c.expires_at) <= Date.parse(agora) ? "expirado" : "pendente";
}

// ── Indicadores ───────────────────────────────────────────────────────────

export type Indicadores = {
  /** Vínculo ativo, com ou sem login. */
  profissionais: number;
  medicos: number;
  medicosQueAdministram: number;
  semConta: number;
  acessoHabilitado: number;
  convitesPendentes: number;
  convitesExpirados: number;
};

export function indicadores(
  pessoas: Pessoa[], logins: Map<string, Login> | null, convites: ConviteDeLink[], agora: string,
): Indicadores {
  const ativos = pessoas.filter(vinculoAtivo);
  const medicos = ativos.filter(atuaComoMedico);
  const estados = pessoas.map((p) => estadoDoAcesso(p, logins?.get(p.id)));
  const link = convites.map((c) => estadoDoConvite(c, agora));
  return {
    profissionais: ativos.length,
    medicos: medicos.length,
    medicosQueAdministram: medicos.filter((p) => p.role === "admin" || p.role === "owner").length,
    semConta: ativos.filter((p) => p.sem_acesso).length,
    acessoHabilitado: estados.filter((e) => e === "habilitado").length,
    convitesPendentes: estados.filter((e) => e === "convite_pendente").length + link.filter((e) => e === "pendente").length,
    convitesExpirados: link.filter((e) => e === "expirado").length,
  };
}

// ── Pendências ────────────────────────────────────────────────────────────

export type Pendencia = {
  chave: string;
  titulo: string;
  motivo: string;
  evidencia: string;
  acao: { rotulo: string; tipo: "pessoa" | "convites" | "locais" | "equipe"; id?: string };
};

export type EntradaDasPendencias = {
  pessoas: Pessoa[];
  logins: Map<string, Login> | null;
  convites: ConviteDeLink[];
  /** Locais compartilhados e ativos; null quando não foi possível carregar. */
  locaisCompartilhadosAtivos: number | null;
  agora: string;
};

/**
 * Pendências verificáveis — cada uma com o motivo, a evidência e uma ação.
 *
 * Campo opcional vazio NÃO é pendência. Só entra o que atrapalha uma
 * operação, o que parece erro de cadastro ou o que é acesso que merece
 * revisão. E nada aqui muda permissão: a ação sempre abre algo para a pessoa
 * decidir.
 */
export function pendencias(e: EntradaDasPendencias): Pendencia[] {
  const lista: Pendencia[] = [];

  for (const d of duplicidadesNaEquipe(e.pessoas)) {
    lista.push({
      chave: `dup-${d.motivo}-${d.pessoas.map((p) => p.id).join("-")}`,
      titulo: `Possível cadastro duplicado: ${d.pessoas.map((p) => p.nome).join(" e ")}`,
      motivo: "Duas fichas da mesma pessoa dividem plantões e registros entre elas.",
      evidencia: `Os cadastros têm ${d.evidencia}.`,
      acao: { rotulo: "Revisar cadastros", tipo: "pessoa", id: d.pessoas[0].id },
    });
  }

  for (const c of e.convites) {
    if (estadoDoConvite(c, e.agora) !== "expirado") continue;
    lista.push({
      chave: `convite-expirado-${c.id}`,
      titulo: `Convite expirado para ${c.email}`,
      motivo: "Enquanto ele continuar pendente, não é possível criar outro convite para este e-mail.",
      evidencia: `Venceu em ${dataBr(c.expires_at)}.`,
      acao: { rotulo: "Renovar ou cancelar", tipo: "convites" },
    });
  }

  for (const p of e.pessoas) {
    const login = e.logins?.get(p.id);
    if (estadoDoAcesso(p, login) === "convite_pendente" && login?.convidado_em
        && dias(login.convidado_em, e.agora) > 7) {
      lista.push({
        chave: `convite-parado-${p.id}`,
        titulo: `${p.nome} ainda não aceitou o convite`,
        motivo: "O convite por e-mail pode ter caído no spam ou expirado.",
        evidencia: `Enviado em ${dataBr(login.convidado_em)}, há ${dias(login.convidado_em, e.agora)} dias.`,
        acao: { rotulo: "Reenviar convite", tipo: "pessoa", id: p.id },
      });
    }

    if (!vinculoAtivo(p)) continue;
    const naEscala = p.na_escala !== false && p.role !== "recepcao" && p.role !== "financeiro";
    const crm = lerCRM(p.crm);
    if (naEscala && atuaComoMedico(p) && (!crm || !crm.uf)) {
      lista.push({
        chave: `crm-${p.id}`,
        titulo: crm ? `CRM de ${p.nome} sem UF` : `${p.nome} está na escala sem CRM`,
        motivo: "A escala é o documento de quem responde pelo ato; o registro faz parte dele.",
        evidencia: crm ? `CRM gravado: "${p.crm}".` : "Atua como médico e está na escala; o CRM está em branco.",
        acao: { rotulo: "Completar cadastro", tipo: "pessoa", id: p.id },
      });
    }
    if (naEscala && profissao(p).tipo === "nao_informada") {
      lista.push({
        chave: `profissao-${p.id}`,
        titulo: `Confirme se ${p.nome} atua como médico`,
        motivo: "A pessoa está na escala, mas não há CRM nem profissão informada no cadastro.",
        evidencia: `Função: ${rotuloDaFuncao(p.role)}; na escala; CRM em branco.`,
        acao: { rotulo: "Informar profissão", tipo: "pessoa", id: p.id },
      });
    }
    for (const c of concessoesLegadas(p)) {
      lista.push({
        chave: `legado-${p.id}-${c.valor}`,
        titulo: `Concessão antiga em ${p.nome}`,
        motivo: "Foi gravada por fora da tela de equipe e não aparecia em lugar nenhum.",
        evidencia: c.efeito,
        acao: { rotulo: "Revisar acesso", tipo: "pessoa", id: p.id },
      });
    }
    if ((p.role === "admin" || p.role === "owner") && !p.sem_acesso && login?.ultimo_acesso
        && dias(login.ultimo_acesso, e.agora) > 90) {
      lista.push({
        chave: `admin-parado-${p.id}`,
        titulo: `${p.nome} administra a organização e não entra há ${dias(login.ultimo_acesso, e.agora)} dias`,
        motivo: "Poder de administração numa conta sem uso é um risco se a senha vazar.",
        evidencia: `Último acesso em ${dataBr(login.ultimo_acesso)}.`,
        acao: { rotulo: "Revisar acesso", tipo: "pessoa", id: p.id },
      });
    }
  }

  if (e.locaisCompartilhadosAtivos === 0) {
    lista.push({
      chave: "sem-local",
      titulo: "Nenhum local de atendimento compartilhado com a equipe",
      motivo: "Sem local compartilhado, a equipe não tem onde escolher atender, e as fichas saem sem cabeçalho do hospital.",
      evidencia: "Nenhum local ativo está compartilhado com a equipe.",
      acao: { rotulo: "Cadastrar local", tipo: "locais" },
    });
  }
  return lista;
}

export { plural as pluralDaEquipe };
