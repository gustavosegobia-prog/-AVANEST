"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { quantosPedemResposta, type Aviso } from "@/lib/avisos";
import { Icone } from "@/components/icone";

// A caixa de avisos: o sino da barra do topo.
//
// Ela fica no TOPO, e não dentro da Escala, porque o aviso que importa nasce
// numa área e é lido em outra. Um plantão oferecido às 6 da manhã por quem
// passou mal precisa alcançar quem está na Recepção cadastrando paciente — e
// quem está na Recepção não tem motivo nenhum para abrir a Escala.
//
// Não há tabela de notificações por trás disto. Os avisos são derivados do que
// já é verdade nas tabelas de troca, chat e suporte: uma troca pendente é um
// aviso porque está pendente, e para de ser no instante em que alguém responde.
// O motivo inteiro está em lib/avisos.ts.

// Um ícone por origem do aviso, todos do mesmo conjunto de traços do resto da
// interface. Eram emoji, e emoji não é ilustração confiável: cada sistema
// desenha o seu, e a mesma lista saía com um traço diferente no iPhone, no
// Android e no Windows — num painel clínico isso parece defeito, não estilo.
//
// Os três de dinheiro continuam distintos entre si: o que falta cobrar, o que
// falta receber e o plantão que falta ser pago são ações diferentes, e o mesmo
// símbolo nos três obrigaria a abrir para descobrir qual é.
const ICONE = {
  troca_pedida: "troca", troca_resolvida: "confirmado", chat: "conversa",
  suporte: "boia", a_faturar: "nota", a_receber: "ampulheta",
  plantao_a_receber: "dinheiro", a_confirmar: "confirmado",
} as const;

/**
 * "há 2 h", "ontem", "12/08". Relógio do navegador, que é o do usuário.
 *
 * Lembrete de dinheiro não leva carimbo de tempo: ele não ACONTECEU numa hora,
 * é um saldo que continua parado. O título já diz de que mês se trata, e um
 * "28/07" ao lado de "pacientes de julho sem cobrança" só faria a pessoa
 * procurar que evento foi aquele.
 */
const SEM_RELOGIO = new Set(["a_faturar", "a_receber", "plantao_a_receber", "a_confirmar"]);

function quandoFoi(iso: string, agora = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const min = Math.floor((agora - t) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  if (h < 48) return "ontem";
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CaixaDeAvisos({
  avisos, onIr,
}: {
  avisos: Aviso[];
  /** Leva para a área do aviso. O clique tem de RESOLVER, não só informar. */
  onIr: (aviso: Aviso) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [lidos, setLidos] = useState(false);
  const caixa = useRef<HTMLDivElement | null>(null);

  const pedemResposta = quantosPedemResposta(avisos);
  // O número vermelho conta só o que espera resposta SUA. Contar notícia junto
  // faria o contador não zerar nunca — e um contador que não zera é um contador
  // que a pessoa aprende a ignorar, inclusive no dia em que ele estiver certo.
  //
  // O ponto sem número existe para as notícias: some ao abrir, e não pede nada.
  const temNoticia = avisos.length > pedemResposta && !lidos;

  /**
   * Abrir a caixa carimba a leitura das NOTÍCIAS.
   *
   * Só delas. O plantão que espera resposta continua ali depois de fechada:
   * abrir a caixa não é aceitar nem recusar, e fazer o aviso sumir ao ser
   * olhado é a forma mais rápida de perder um turno descoberto.
   *
   * O erro é engolido: um carimbo que não gravou faz a notícia aparecer de
   * novo na próxima abertura — chato, e nada além disso. Interromper a pessoa
   * com uma mensagem de erro por causa de um marcador seria pior que o defeito.
   */
  async function abrir() {
    setAberta((estava) => !estava);
    if (aberta || lidos) return;
    setLidos(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("avisos_leitura")
      .upsert({ perfil_id: user.id, lido_em: new Date().toISOString() });
  }

  // Esc fecha, como todo menu desta barra. Sem isto a caixa fica presa aberta
  // para quem navega por teclado — o clique fora não é alcançável por Tab.
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(false); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberta]);

  return (
    <div className="avisosWrap" ref={caixa}>
      <button
        type="button"
        className={`avisosSino${pedemResposta > 0 ? " pede" : ""}`}
        onClick={() => void abrir()}
        aria-expanded={aberta}
        aria-haspopup="menu"
        aria-label={pedemResposta > 0
          ? `Avisos: ${pedemResposta} esperando resposta sua`
          : avisos.length > 0 ? `Avisos: ${avisos.length}` : "Avisos: nada novo"}
      >
        <Icone nome="sino" tamanho={20} />
        {pedemResposta > 0
          ? <b className="avisosContador">{pedemResposta}</b>
          : temNoticia && <b className="avisosPonto" aria-hidden="true" />}
      </button>

      {aberta && <>
        <button className="userMenuFundo" aria-label="Fechar avisos" onClick={() => setAberta(false)} />
        <div className="avisosLista" role="menu">
          <div className="avisosTopo">
            <strong>Avisos</strong>
            {pedemResposta > 0 && <span>{pedemResposta} esperando você</span>}
          </div>
          {avisos.length === 0
            /* O vazio diz o que significa. "Nenhum aviso" deixa a dúvida de se
               a caixa está funcionando ou se ninguém mexeu em nada. */
            ? <p className="avisosVazio">Nada esperando você. Aparecem aqui: plantão oferecido, resposta do suporte, mensagem da equipe, e o que ficou para trás no faturamento e no recebimento.</p>
            : avisos.map((a) => (
              <button
                key={`${a.tipo}-${a.id}`} role="menuitem"
                className={`avisoItem${a.acao ? " pede" : ""}`}
                onClick={() => { setAberta(false); onIr(a); }}
              >
                <span className="avisoIcone" aria-hidden="true"><Icone nome={ICONE[a.tipo] ?? "conversa"} tamanho={17} /></span>
                <span className="avisoTexto">
                  <strong>{a.titulo}</strong>
                  <small>{a.detalhe}</small>
                </span>
                <span className="avisoQuando">{SEM_RELOGIO.has(a.tipo) ? "" : quandoFoi(a.quando)}</span>
              </button>
            ))}
        </div>
      </>}
    </div>
  );
}
