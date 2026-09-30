"use client";

import { CabecalhoDeSecao } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import type { Indicadores, Pendencia } from "@/lib/equipe";
import { autorDoEvento, rotuloDaAcao, sobreOEvento, type EventoDeAuditoria } from "@/lib/auditoria";

// A porta de entrada da Administração.
//
// Quatro números, e cada um diz exatamente o que conta — "usuários ativos"
// saiu porque misturava duas coisas: fazer parte da equipe (vínculo) e entrar
// no sistema (acesso). Um profissional sem conta está na equipe e não entra.
// Clicar no número abre a lista com o filtro que produz aquele número.

export type DestinoDoIndicador =
  | { tipo: "equipe"; acesso?: "habilitado" | "todos" }
  | { tipo: "convites" }
  | { tipo: "pendencias" };

export function VisaoGeralDaAdministracao({
  ind, pendencias, ultimas, nomes, podeAdministrar, carregandoLogins, onIr, onAcaoDaPendencia,
  onAdicionarPessoa, onCadastrarLocal, onRevisarAcessos, onVerHistorico,
}: {
  ind: Indicadores;
  pendencias: Pendencia[];
  ultimas: EventoDeAuditoria[];
  nomes: Map<string, string>;
  podeAdministrar: boolean;
  carregandoLogins: boolean;
  onIr: (d: DestinoDoIndicador) => void;
  onAcaoDaPendencia: (p: Pendencia) => void;
  onAdicionarPessoa: () => void;
  onCadastrarLocal: () => void;
  onRevisarAcessos: () => void;
  onVerHistorico: () => void;
}) {
  const cartoes: { rotulo: string; valor: number | string; definicao: string; destino: DestinoDoIndicador; estado?: string }[] = [
    {
      rotulo: "Profissionais cadastrados", valor: ind.profissionais,
      definicao: `Pessoas com vínculo ativo, com ou sem login. ${ind.medicos} médicos${ind.medicosQueAdministram ? ` (${ind.medicosQueAdministram} também administram)` : ""}; ${ind.semConta} sem conta.`,
      destino: { tipo: "equipe", acesso: "todos" },
    },
    {
      rotulo: "Pessoas com acesso habilitado", valor: carregandoLogins ? "…" : ind.acessoHabilitado,
      definicao: "Podem entrar no sistema agora: conta ativa e senha já criada.",
      destino: { tipo: "equipe", acesso: "habilitado" },
    },
    {
      rotulo: "Convites pendentes", valor: carregandoLogins ? "…" : ind.convitesPendentes,
      definicao: ind.convitesExpirados
        ? `Aguardando a pessoa criar a senha. Além disso, ${ind.convitesExpirados} convite(s) por link expirado(s).`
        : "Aguardando a pessoa criar a senha, por e-mail ou por link.",
      destino: { tipo: "convites" },
      estado: ind.convitesExpirados ? "atencao" : undefined,
    },
    {
      rotulo: "Pendências de configuração", valor: pendencias.length,
      definicao: pendencias.length ? "Itens com motivo e ação, listados abaixo." : "Nada pedindo ajuste agora.",
      destino: { tipo: "pendencias" },
      estado: pendencias.length ? "atencao" : "ok",
    },
  ];

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Visão geral" descricao="Quem está na equipe, quem entra no sistema e o que precisa de atenção." escopo="organizacao" />

      <div className="admIndicadores">
        {cartoes.map((c) => (
          <button type="button" key={c.rotulo} className={`admIndicador ${c.estado ?? ""}`} onClick={() => onIr(c.destino)}>
            <span>{c.rotulo}</span>
            <strong>{c.valor}</strong>
            <small>{c.definicao}</small>
          </button>
        ))}
      </div>

      {podeAdministrar && <div className="admAcoesRapidas" aria-label="Ações rápidas">
        <button type="button" className="primaryClinical compact" onClick={onAdicionarPessoa}>+ Adicionar pessoa</button>
        <button type="button" className="outlineClinical" onClick={onCadastrarLocal}><Icone nome="calendario" tamanho={15} /> Cadastrar local</button>
        <button type="button" className="outlineClinical" onClick={onRevisarAcessos}><Icone nome="cadeado" tamanho={15} /> Revisar acessos</button>
      </div>}

      <div className="admDuasColunas">
        <section className="admCartao" id="adm-pendencias" aria-labelledby="adm-pendencias-t" tabIndex={-1}>
          <h3 id="adm-pendencias-t">Pendências</h3>
          {pendencias.length === 0
            ? <p className="admNota"><Icone nome="confirmado" tamanho={14} /> Nenhuma pendência verificável agora. Campos opcionais em branco não contam.</p>
            : <ul className="admPendencias">
                {pendencias.map((p) => (
                  <li key={p.chave}>
                    <span>
                      <strong>{p.titulo}</strong>
                      <small>{p.motivo}</small>
                      <small className="admEvidencia">Evidência: {p.evidencia}</small>
                    </span>
                    {podeAdministrar && <button type="button" className="outlineClinical" onClick={() => onAcaoDaPendencia(p)}>{p.acao.rotulo}</button>}
                  </li>
                ))}
              </ul>}
          <p className="admNota">Sugestões por regra, conferíveis. Nenhuma delas muda acesso sozinha.</p>
        </section>

        <section className="admCartao" aria-labelledby="adm-ultimas-t">
          <h3 id="adm-ultimas-t">Últimas alterações administrativas</h3>
          {ultimas.length === 0
            ? <p className="admNota">Nenhuma alteração administrativa registrada ainda.</p>
            : <ol className="admUltimas">
                {ultimas.map((e) => (
                  <li key={e.id}>
                    <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
                    <span><strong>{rotuloDaAcao(e)}</strong><small>{sobreOEvento(e, nomes)} · por {autorDoEvento(e, nomes)}</small></span>
                  </li>
                ))}
              </ol>}
          <button type="button" className="admLinkBotao" onClick={onVerHistorico}>Ver histórico completo →</button>
        </section>
      </div>
    </section>
  );
}
