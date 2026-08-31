"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { DIAS_ADIADO, chaveDoAviso, podeAdiar, quantosPedemResposta, type Aviso } from "@/lib/avisos";
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
  escala_publicada: "calendario",
} as const;

/**
 * "há 2 h", "ontem", "12/08". Relógio do navegador, que é o do usuário.
 *
 * Lembrete de dinheiro não leva carimbo de tempo: ele não ACONTECEU numa hora,
 * é um saldo que continua parado. O título já diz de que mês se trata, e um
 * "28/07" ao lado de "pacientes de julho sem cobrança" só faria a pessoa
 * procurar que evento foi aquele.
 */
/** O quanto o dedo precisa andar para o adiar valer. */
const LIMITE_ARRASTO = 90;

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
  avisos, onIr, onResponderTroca, onAdiar,
}: {
  avisos: Aviso[];
  /** Leva para a área do aviso. O clique tem de RESOLVER, não só informar. */
  onIr: (aviso: Aviso) => void;
  /**
   * Assumir ou recusar o plantão SEM sair do sino.
   *
   * Não é um jeito de apagar o aviso — é fazer a coisa. A troca deixa de estar
   * pendente e o aviso some sozinho, porque ele é derivado da pendência e não
   * guardado numa tabela. Um botão de "apagar" seria mentira: no recarregamento
   * seguinte a pendência continuaria lá e o aviso voltaria.
   *
   * Opcional: sem ele o item continua funcionando como antes, levando para a
   * aba de Trocas.
   */
  onResponderTroca?: (trocaId: string, acao: "aceitar_troca" | "recusar_troca") => Promise<void>;
  /**
   * Adiar o lembrete por alguns dias.
   *
   * NÃO é apagar, e a diferença não é filosófica: o aviso é derivado da
   * pendência, então apagá-lo faria voltar no recarregamento seguinte. Adiar
   * grava a decisão — a pendência continua, o lembrete cala pelo prazo, e volta.
   */
  onAdiar?: (aviso: Aviso) => Promise<void>;
}) {
  const [aberta, setAberta] = useState(false);
  const [lidos, setLidos] = useState(false);
  /** Qual troca está sendo respondida agora, para travar os dois botões dela. */
  const [respondendo, setRespondendo] = useState("");
  /**
   * O quanto cada aviso foi arrastado para a esquerda, em pixels.
   *
   * Só o toque arrasta. No computador não existe o gesto, e por isso há também
   * um botão — recurso que só funciona no celular é recurso que metade da
   * equipe nunca descobre.
   */
  const [arrasto, setArrasto] = useState<Record<string, number>>({});
  const inicioDoToque = useRef<Record<string, number>>({});
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
            ? <p className="avisosVazio">Nada esperando você. Aparecem aqui: a escala do mês quando ela entra, plantão oferecido por um colega, resposta do suporte, mensagem da equipe, e o que ficou para trás no faturamento e no recebimento.</p>
            : avisos.map((a) => (
              <div
                key={`${a.tipo}-${a.id}`}
                className={`avisoItem${a.acao ? " pede" : ""}${podeAdiar(a) && onAdiar ? " adiavel" : ""}`}
                style={arrasto[chaveDoAviso(a)]
                  ? { transform: `translateX(-${arrasto[chaveDoAviso(a)]}px)` }
                  : undefined}
                // O arrasto só existe onde o dedo existe. `passive` fica no
                // padrão: não chamamos preventDefault, então a rolagem da lista
                // continua funcionando enquanto o dedo se move — arrastar um
                // aviso não pode prender a lista inteira.
                onTouchStart={podeAdiar(a) && onAdiar
                  ? (e) => { inicioDoToque.current[chaveDoAviso(a)] = e.touches[0].clientX; }
                  : undefined}
                onTouchMove={podeAdiar(a) && onAdiar
                  ? (e) => {
                      const de = inicioDoToque.current[chaveDoAviso(a)];
                      if (de === undefined) return;
                      // Só para a esquerda, e no máximo o limite: puxar para a
                      // direita não significa nada aqui, e deixar o item voar
                      // para fora da caixa faria o gesto parecer um erro.
                      const andou = Math.min(Math.max(de - e.touches[0].clientX, 0), LIMITE_ARRASTO);
                      setArrasto((antes) => ({ ...antes, [chaveDoAviso(a)]: andou }));
                    }
                  : undefined}
                onTouchEnd={podeAdiar(a) && onAdiar
                  ? async () => {
                      const chave = chaveDoAviso(a);
                      const andou = arrasto[chave] ?? 0;
                      delete inicioDoToque.current[chave];
                      setArrasto((antes) => ({ ...antes, [chave]: 0 }));
                      // Passou do meio do caminho, adia. Aquém disso volta ao
                      // lugar — arrastar dois dedos sem querer não pode sumir
                      // com um lembrete de dinheiro.
                      if (andou >= LIMITE_ARRASTO * 0.6) await onAdiar(a);
                    }
                  : undefined}
              >
                <button
                  type="button" role="menuitem" className="avisoAbrir"
                  onClick={() => { setAberta(false); onIr(a); }}
                >
                  <span className="avisoIcone" aria-hidden="true"><Icone nome={ICONE[a.tipo] ?? "conversa"} tamanho={17} /></span>
                  <span className="avisoTexto">
                    <strong>{a.titulo}</strong>
                    <small>{a.detalhe}</small>
                  </span>
                  <span className="avisoQuando">{SEM_RELOGIO.has(a.tipo) ? "" : quandoFoi(a.quando)}</span>
                </button>
                {/* Só a troca ganha botões aqui. Os lembretes de dinheiro e de
                    confirmação pedem uma tela — marcar catorze plantões como
                    confirmados não cabe num menu suspenso, e um botão que abre
                    outra coisa seria pior do que o item inteiro levar para lá. */}
                {/* O mesmo adiar, para quem não tem dedo na tela. Um recurso
                    que só funciona no celular é um recurso que metade da equipe
                    nunca descobre. */}
                {podeAdiar(a) && onAdiar && (
                  <button
                    type="button" className="avisoAdiar"
                    title={`Adiar por ${DIAS_ADIADO} dias`}
                    aria-label={`Adiar "${a.titulo}" por ${DIAS_ADIADO} dias`}
                    onClick={() => void onAdiar(a)}
                  >Adiar {DIAS_ADIADO} dias</button>
                )}
                {a.tipo === "troca_pedida" && onResponderTroca && (
                  <div className="avisoAcoes">
                    <button
                      type="button" className="assumir" disabled={respondendo === a.id}
                      onClick={async () => {
                        setRespondendo(a.id);
                        try { await onResponderTroca(a.id, "aceitar_troca"); }
                        finally { setRespondendo(""); }
                      }}
                    >{respondendo === a.id ? "Assumindo..." : "Assumir"}</button>
                    <button
                      type="button" className="recusar" disabled={respondendo === a.id}
                      onClick={async () => {
                        setRespondendo(a.id);
                        try { await onResponderTroca(a.id, "recusar_troca"); }
                        finally { setRespondendo(""); }
                      }}
                    >Recusar</button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </>}
    </div>
  );
}
