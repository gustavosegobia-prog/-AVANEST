"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { useEstadoDoPush } from "@/components/ativar-notificacoes";
import {
  PADRAO, ROTULOS, comPadrao, paraGravar, type PreferenciasDeAviso,
} from "@/lib/preferencias-de-aviso";

// Minha conta → Preferências de notificações.
//
// Antes disto havia um interruptor só, no menu do perfil: notificação ligada ou
// desligada, tudo junto. Quem se incomodava com um aviso desligava todos —
// inclusive o pedido de troca da sexta, que é o que ninguém quer perder.
//
// AS PREFERÊNCIAS SÃO DA CONTA, E NÃO DO APARELHO. Ficam no banco, e não no
// localStorage: quem desligou o som no celular desligou no tablet, e quem troca
// de telefone não recomeça do zero. É também a única forma de funcionarem de
// verdade — quem manda a notificação é o servidor, de madrugada, com o
// aplicativo fechado, e ele não tem como ler nada guardado no aparelho.
//
// A PERMISSÃO DO APARELHO É OUTRA COISA, e por isso fica numa linha à parte,
// com outro tipo de botão. Ela é DESTE telefone, o navegador é quem manda nela,
// e nenhuma preferência daqui adianta enquanto ela não for dada.

const GRUPOS: Array<{ id: "escala" | "plantao" | "geral"; titulo: string }> = [
  { id: "escala", titulo: "Notificações de escala" },
  { id: "plantao", titulo: "Alterações de plantão" },
  { id: "geral", titulo: "Preferências gerais" },
];

export function PreferenciasDeAvisoPainel({
  chavePublica, guardado,
}: {
  chavePublica: string;
  /** O que está no banco hoje. Nulo é o normal: quer dizer "tudo ligado". */
  guardado: unknown;
}) {
  // Lido uma vez, na montagem. O modal de Minha conta é montado e desmontado a
  // cada abertura, então "uma vez" já é "toda vez que a pessoa abre" — e um
  // efeito sincronizando o estado com a propriedade criaria uma segunda fonte
  // da verdade para a mesma informação.
  const inicial = useMemo(() => comPadrao(guardado), [guardado]);
  const [escolhas, setEscolhas] = useState<PreferenciasDeAviso>(inicial);
  const [gravado, setGravado] = useState<PreferenciasDeAviso>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState("");
  const [erro, setErro] = useState("");
  const { estado, ocupado, erro: erroDaPermissao, ligar, desligar } = useEstadoDoPush(chavePublica);

  const mudou = ROTULOS.some((r) => escolhas[r.chave] !== gravado[r.chave]);

  async function salvar() {
    setSalvando(true); setRecado(""); setErro("");
    const { error } = await createClient()
      .rpc("salvar_preferencias_de_aviso", { p_preferencias: paraGravar(escolhas) });
    setSalvando(false);
    if (error) { setErro(`Não foi possível salvar: ${error.message}`); return; }
    setGravado(escolhas);
    setRecado("Preferências salvas. Valem para todos os seus aparelhos.");
  }

  return (
    <section className="prefAvisos">
      <div className="prefCabeca">
        <strong>Preferências de notificações</strong>
        <span>Valem para todos os seus aparelhos, não só para este.</span>
      </div>

      {/* A PERMISSÃO VEM PRIMEIRO, e antes dos interruptores, porque sem ela
          nenhum deles produz efeito nenhum. Um painel que começasse pelas
          escolhas deixaria a pessoa configurar sete linhas com cuidado e não
          receber nada — sem nunca entender por quê. */}
      <div className={`prefPermissao ${estado === "ligado" ? "ok" : "pendente"}`}>
        <span className="prefPermissaoSino" aria-hidden="true"><Icone nome="sino" tamanho={18}/></span>
        <div>
          <strong>
            {estado === "ligado" ? "Notificações permitidas neste aparelho"
              : estado === "instalar-ios" ? "No iPhone, instale o AVANEST primeiro"
              : estado === "bloqueado" ? "Notificações bloqueadas neste aparelho"
              : estado === "indisponivel" ? "Este navegador não entrega notificações"
              : estado === "carregando" ? "Verificando..."
              : "Notificações desligadas neste aparelho"}
          </strong>
          <p>
            {estado === "ligado" ? "Você recebe os avisos marcados abaixo mesmo com o aplicativo fechado."
              : estado === "instalar-ios" ? "O Safari só entrega aviso com o site na tela de início. Toque em Compartilhar e depois em “Adicionar à Tela de Início”."
              : estado === "bloqueado" ? "Você recusou antes, e o navegador não pergunta de novo. Abra as configurações deste site no navegador e permita notificações."
              : estado === "indisponivel" ? "As escolhas abaixo continuam valendo nos seus outros aparelhos."
              : "Enquanto estiver desligado, nada abaixo chega a este aparelho."}
          </p>
          {erroDaPermissao && <p className="prefErro">{erroDaPermissao}</p>}
        </div>
        {/* Botão só quando há o que fazer. Em "bloqueado" quem resolve é a
            configuração do navegador, e um botão aqui pareceria quebrado. */}
        {estado === "desligado" && (
          <button type="button" className="primaryClinical compact" disabled={ocupado}
            onClick={() => void ligar()}>{ocupado ? "Permitindo..." : "Permitir"}</button>
        )}
        {estado === "ligado" && (
          <button type="button" className="outlineClinical compact" disabled={ocupado}
            onClick={() => void desligar()}>{ocupado ? "..." : "Desligar aqui"}</button>
        )}
      </div>

      {GRUPOS.map((grupo) => (
        <div className="prefGrupo" key={grupo.id}>
          <h4>{grupo.titulo}</h4>
          {ROTULOS.filter((r) => r.grupo === grupo.id).map((r) => (
            <label className="prefLinha" key={r.chave}>
              <span>
                <strong>{r.titulo}</strong>
                <small>{r.detalhe}</small>
              </span>
              {/* Caixa de marcar, e não um botão deslizante feito à mão: o
                  leitor de tela anuncia o estado sozinho, e o toque do
                  telefone acerta a área certa sem CSS nenhum. */}
              <input type="checkbox" checked={escolhas[r.chave] !== false}
                onChange={(e) => {
                  setEscolhas((v) => ({ ...v, [r.chave]: e.target.checked }));
                  setRecado(""); setErro("");
                }}/>
            </label>
          ))}
        </div>
      ))}

      {/* O que NÃO tem interruptor, dito em vez de escondido. Quem abre esta
          tela e não encontra "mensagem da equipe" conclui que ela está
          desligada — e a conclusão errada custa uma pergunta ao suporte. */}
      <p className="prefNota">
        Resposta do suporte e mensagem na sala da equipe chegam sempre: a primeira responde a algo
        que você pediu, e a segunda você silencia saindo da conversa.
      </p>

      {recado && <p className="financeSuccess">{recado}</p>}
      {erro && <p className="clinicalError">{erro}</p>}

      <div className="prefAcoes">
        <button type="button" className="outlineClinical compact"
          disabled={salvando || !ROTULOS.some((r) => escolhas[r.chave] === false)}
          onClick={() => { setEscolhas(PADRAO); setRecado(""); setErro(""); }}>
          Ligar todas
        </button>
        <button type="button" className="primaryClinical compact"
          disabled={salvando || !mudou} onClick={() => void salvar()}>
          {salvando ? "Salvando..." : "Salvar preferências"}
        </button>
      </div>
    </section>
  );
}
