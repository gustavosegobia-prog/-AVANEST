"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { money, plural } from "@/lib/escala";
import { OlhoValores, useValoresOcultos } from "@/components/olho-valores";
import { AVISO_FICHA, ROTULO_CAMPO, lerFichaDeInternacao } from "@/lib/ficha-internacao";
import { hoje as hojeLocal, ultimoDiaDoMes } from "@/lib/data-local";

// Produção do dia: o caderninho do bolso do pijama.
//
// No fim do plantão o anestesista anota nome, convênio e cirurgia de cada
// paciente, e é dessa lista que sai a cobrança do mês. O que a tela precisa
// entregar é velocidade: se anotar oito pacientes custar mais que rabiscar
// num papel, a pessoa rabisca no papel — e aí o dado não existe.
//
// Por isso o formulário é uma linha só, o foco volta para o nome depois de
// salvar, e o único campo obrigatório é o nome. Valor e procedimento entram
// depois, com calma, quando for faturar.

export type Producao = {
  /** Preenchido quando a anotação foi enviada ao Financeiro. */
  enviado_em?: string | null;
  id: string; data: string; paciente: string; convenio: string;
  procedimento: string | null; valor: number; situacao: string;
  observacoes: string | null; plantao_id: string | null;
  /** Hospital do ato. Vem do plantão quando o dia tem um só, e é corrigível. */
  local_id?: string | null;
  /** Quem paga este ato. Nulo enquanto não se decidiu — ver PAGADORES. */
  pagador?: string | null;
  /** O dia em que o dinheiro caiu. Nulo enquanto não foi recebido. */
  recebido_em?: string | null;
};

const SITUACOES: Array<[string, string]> = [
  ["a_cobrar", "A cobrar"],
  ["faturado", "Faturado"],
  ["recebido", "Recebido"],
  ["glosado", "Glosado"],
];

/**
 * Quem paga o ato anestésico.
 *
 * Três respostas porque são três notas diferentes, contra três tomadores
 * diferentes — e a resposta muda de paciente para paciente dentro do mesmo
 * hospital. Convênio é outra coluna e continua existindo: o paciente pode ser
 * "Unimed" e mesmo assim pagar direto, quando o combinado foi esse.
 *
 * Os rótulos são o TOMADOR, não a ação: "Paciente", e não "Recebo direto". A
 * pergunta acima do campo é "Quem paga?", e a resposta a uma pergunta de quem
 * é um nome. Escritos como frase, os três ficavam com comprimentos diferentes
 * e obrigavam a ler até o fim para descobrir de quem se tratava.
 *
 * Não há quarta opção "ainda não sei", e é de propósito: o não decidido é a
 * ausência de escolha, e ele já aparece à parte na folha. Uma opção com esse
 * nome viraria uma decisão tomada de não decidir.
 */
export const PAGADORES: Array<[string, string]> = [
  ["direto", "Paciente"],
  ["hospital", "Hospital"],
  ["convenio", "Convênio"],
];

/**
 * O recado certo quando a gravação é recusada.
 *
 * Coluna que não existe é o caso de quem atualizou o site e ainda não rodou o
 * SQL, e "não foi possível salvar" mandaria essa pessoa procurar defeito na
 * internet. O PostgREST devolve PGRST204 quando não acha a coluna no cache do
 * esquema, e o Postgres 42703 quando a consulta chega ao banco.
 */
function erroDeColuna(erro: { code?: string; message?: string }): string {
  const some = erro.code === "PGRST204" || erro.code === "42703"
    || /pagador|local_id/.test(erro.message ?? "");
  return some
    ? "As colunas de hospital e de quem paga ainda não existem no banco. Rode a migração 202608260007_faturamento_por_hospital.sql."
    : "Não foi possível salvar a alteração.";
}

/** "1.100,00" ou "1100" -> 1100. Aceita o jeito que a pessoa digitar. */
export function lerValor(bruto: string): number {
  const v = Number(String(bruto ?? "").replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Preparar a foto antes de reconhecer.
 *
 * Entregar o arquivo do celular direto ao leitor é o motivo mais comum de não
 * sair texto nenhum. Três coisas atrapalham, e as três se resolvem aqui:
 *
 * TAMANHO. Um retrato de 4032×3024 leva quase um minuto e não lê melhor: o
 * motor foi treinado em digitalização de 300 dpi, e resolução muito acima
 * disso confunde a separação das letras. Foto pequena demais tem o problema
 * oposto — letra com menos de uns 20 pixels de altura não se reconhece —,
 * então imagem pequena é ampliada.
 *
 * COR. A ficha é preta sobre branco; a cor só carrega ruído do papel amarelado
 * e da sombra azulada da luz do centro cirúrgico.
 *
 * CONTRASTE. Foto de papel na mão pega sombra de um lado e brilho do outro, e
 * o cinza fica todo espremido no meio da escala. O alongamento usa o 2º e o 98º
 * percentil em vez do mínimo e do máximo: um único pixel preto de borda ou um
 * reflexo estourado fixaria os extremos e a correção não faria nada.
 *
 * Sem binarizar. Preto e branco puro decide por pixel o que é letra, e numa
 * foto com sombra ele apaga a metade escura da ficha inteira.
 */
/**
 * A mesma imagem, girada.
 *
 * Devolve a própria fonte quando o giro é zero: girar por girar custa uma
 * cópia do quadro inteiro, e a maioria das fotos já está em pé.
 */
function girar(fonte: HTMLCanvasElement, graus: 90 | 270): HTMLCanvasElement | null {
  const tela = document.createElement("canvas");
  // Trocadas de propósito: girar um quarto de volta troca largura por altura.
  tela.width = fonte.height; tela.height = fonte.width;
  const pincel = tela.getContext("2d");
  if (!pincel) return null;
  pincel.translate(tela.width / 2, tela.height / 2);
  pincel.rotate((graus * Math.PI) / 180);
  pincel.drawImage(fonte, -fonte.width / 2, -fonte.height / 2);
  return tela;
}

/**
 * Quanto texto de verdade saiu de uma leitura.
 *
 * Conta LETRAS, e não caracteres. Texto girado 90° não devolve pouca coisa —
 * devolve muita sujeira: traços de tabela viram "|", "l", "1", "—" aos montes.
 * Um placar por comprimento escolheria justamente a leitura errada; um placar
 * por letras escolhe a que tem palavras.
 */
const quantoTexto = (t: string) => (t.match(/\p{L}/gu) ?? []).length;

/**
 * Reconhecer a ficha, tentando as orientações possíveis.
 *
 * Em pé primeiro, porque é o caso comum e quase sempre encerra a busca: se a
 * primeira leitura já traz texto de sobra, as outras duas nem rodam e a espera
 * é a de antes.
 *
 * As outras duas existem por causa da guia larga fotografada sobre a mesa: quem
 * fotografa vira o celular, não o papel, e o EXIF guarda a rotação da câmera —
 * não a do documento. A foto sai "em pé" com o texto deitado, e texto deitado
 * não se reconhece.
 */
async function melhorLeitura(
  // O tipo vem da própria biblioteca, por import type: escrever a assinatura à
  // mão aqui obrigaria a manter duas versões dela em dia.
  Tesseract: { recognize: typeof import("tesseract.js").recognize },
  preparada: HTMLCanvasElement | File,
) {
  const primeira = await Tesseract.recognize(preparada, "por");
  // 240 letras é mais ou menos o que uma guia preenchida rende quando foi lida
  // de verdade. Abaixo disso, vale gastar os segundos das outras tentativas.
  if (!(preparada instanceof HTMLCanvasElement)
      || quantoTexto(primeira.data.text) >= 240) return primeira;

  let melhor = primeira;
  for (const graus of [90, 270] as const) {
    const virada = girar(preparada, graus);
    if (!virada) continue;
    try {
      const tentativa = await Tesseract.recognize(virada, "por");
      if (quantoTexto(tentativa.data.text) > quantoTexto(melhor.data.text)) melhor = tentativa;
    } catch { /* uma orientação que falha não derruba as outras */ }
  }
  return melhor;
}

async function prepararFoto(arquivo: File): Promise<HTMLCanvasElement | File> {
  try {
    // imageOrientation não é detalhe: o celular grava a foto deitada e põe no
    // EXIF a instrução de girar. O canvas ignora essa instrução por padrão, e
    // o leitor recebia a ficha de lado — texto girado 90° não se reconhece.
    // Medido nesta ficha: deitada saem 601 letras de lixo, na orientação certa
    // saem 1724 de texto de verdade.
    const imagem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    const maior = Math.max(imagem.width, imagem.height);
    // Teto de 2200 e piso de 1500: a faixa onde a letra de uma ficha impressa
    // fica com altura suficiente para ser lida sem virar mancha.
    const escala = maior > 2200 ? 2200 / maior : maior < 1500 ? Math.min(2, 1500 / maior) : 1;
    const largura = Math.round(imagem.width * escala);
    const altura = Math.round(imagem.height * escala);

    const tela = document.createElement("canvas");
    tela.width = largura; tela.height = altura;
    const pincel = tela.getContext("2d", { willReadFrequently: true });
    if (!pincel) return arquivo;
    pincel.drawImage(imagem, 0, 0, largura, altura);
    imagem.close();

    const quadro = pincel.getImageData(0, 0, largura, altura);
    const px = quadro.data;

    // Luminância pelos pesos da percepção humana: 0,299/0,587/0,114. A média
    // simples escurece o vermelho do carimbo até ele virar letra.
    const histograma = new Uint32Array(256);
    const cinza = new Uint8ClampedArray(px.length / 4);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const c = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
      cinza[j] = c;
      histograma[c | 0]++;
    }

    const total = cinza.length;
    const percentil = (fracao: number) => {
      let acumulado = 0;
      const alvo = total * fracao;
      for (let v = 0; v < 256; v++) {
        acumulado += histograma[v];
        if (acumulado >= alvo) return v;
      }
      return 255;
    };
    const baixo = percentil(0.02);
    const alto = percentil(0.98);
    // Faixa estreita demais é papel liso sem texto, ou foto totalmente
    // estourada: alongar aí só amplifica o ruído do sensor.
    const amplitude = alto - baixo;
    const alonga = amplitude >= 25;

    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const v = alonga
        ? Math.max(0, Math.min(255, ((cinza[j] - baixo) * 255) / amplitude))
        : cinza[j];
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }
    pincel.putImageData(quadro, 0, 0);
    return tela;
  } catch {
    // Navegador sem createImageBitmap, imagem que não decodifica, memória
    // curta: segue com o arquivo original em vez de não ler nada.
    return arquivo;
  }
}

export function ProducaoDoDia({
  dia, perfilId, institutionId, plantaoId, localId, conveniosConhecidos,
}: {
  dia: string;
  perfilId: string;
  institutionId: string;
  /** O plantão do dia, quando há um só. Serve para ligar a anotação ao turno. */
  plantaoId: string | null;
  /**
   * O hospital do dia, quando os plantões do dia são todos do mesmo lugar.
   * É o que separa a nota de um hospital da do outro no fim do mês, e por isso
   * é gravado já na anotação: perguntar depois, com trinta pacientes na tela,
   * é perguntar quando ninguém mais lembra.
   */
  localId: string | null;
  /** Convênios já usados na organização, para não redigitar "Unimed". */
  conveniosConhecidos: string[];
}) {
  const [itens, setItens] = useState<Producao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const vazio = { paciente: "", convenio: "Particular", procedimento: "", valor: "" };
  const [novo, setNovo] = useState(vazio);
  const [lendoFoto, setLendoFoto] = useState(false);
  const [avisoFoto, setAvisoFoto] = useState("");
  // O texto que saiu da foto, guardado só quando algum campo não foi achado.
  // Fica na memória da aba e some ao recarregar: é material de conserto, não
  // registro — e traz nome de paciente, que não tem por que ser gravado.
  const [textoLido, setTextoLido] = useState("");

  /**
   * Ler a ficha de internação por foto.
   *
   * A imagem é reconhecida no próprio aparelho e descartada ao fim: a ficha
   * traz nome, convênio e diagnóstico de um paciente, e mandar isso para um
   * servidor — ainda que nosso — seria transportar dado de saúde por um
   * caminho que esta funcionalidade não precisa ter.
   *
   * O que é reconhecido cai nos campos do formulário e fica lá para ser
   * conferido: nada é salvo sozinho. O motor entra por import dinâmico, então
   * quem nunca usar a câmera não carrega esses megabytes.
   *
   * Quando não sai nada, o problema é de um de dois tipos, e a tela precisa
   * dizer qual: ou a foto não gerou texto — e o conserto é fotografar de
   * novo — ou gerou texto e os campos não foram achados, e aí o conserto é
   * meu, no reconhecimento dos rótulos. Uma frase só para os dois casos manda
   * a pessoa repetir uma foto que já estava boa.
   */
  async function lerFicha(arquivo?: File) {
    if (!arquivo) return;
    setLendoFoto(true); setErro(""); setAvisoFoto(""); setTextoLido("");
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const preparada = await prepararFoto(arquivo);

      // Tenta a foto em pé e deitada, e fica com a leitura que rendeu mais.
      //
      // A guia de internação é uma folha larga, e quem a fotografa sobre a
      // mesa vira o CELULAR, não o papel. O EXIF registra a rotação da câmera,
      // não a do documento — então `imageOrientation: "from-image"` endireita
      // a foto e o texto continua deitado. Texto girado 90° não se reconhece:
      // sai um punhado de letras soltas, e foi o que aconteceu com a guia da
      // Unimed que o Gustavo mandou.
      //
      // O custo é rodar o reconhecimento até três vezes. Vale: uma foto que
      // não lê custa a anotação inteira, digitada à mão ou esquecida.
      const { data } = await melhorLeitura(Tesseract, preparada);
      const { dados, naoEncontrados, modelo } = lerFichaDeInternacao(data.text);

      if (!dados.paciente && !dados.convenio && !dados.procedimento) {
        // Conta letras, e não caracteres: foto ruim devolve pontuação e
        // pedaços de borda, que enchem o texto sem serem leitura nenhuma.
        const letras = (data.text.match(/\p{L}/gu) ?? []).length;
        if (letras < 25) {
          setErro("A foto não gerou texto legível. Tente mais perto, com a ficha plana, sem sombra e sem reflexo — a luz da janela costuma resolver.");
        } else {
          setErro("Li o texto da ficha, mas não achei os campos. Digite abaixo — e, se puder, me mande o texto lido: é com ele que eu ensino o sistema a ler esta ficha.");
          setTextoLido(data.text.trim());
        }
        return;
      }
      setNovo({
        ...novo,
        paciente: dados.paciente ?? novo.paciente,
        convenio: dados.convenio ?? novo.convenio,
        procedimento: dados.procedimento ?? novo.procedimento,
      });
      // Dizer QUE ficha foi reconhecida não é enfeite: é o que permite saber,
      // olhando a tela, se o erro foi de leitura ou de modelo desconhecido. Sem
      // isso, "não achei o convênio" tem duas causas possíveis e nenhuma pista
      // de qual delas é.
      const qual = modelo ? `Reconheci: ${modelo.nome}.` : "Ficha de modelo novo para mim.";
      setAvisoFoto(naoEncontrados.length
        ? `${qual} ${AVISO_FICHA} Não achei: ${naoEncontrados.map((c) => ROTULO_CAMPO[c]).join(", ")}.`
        : `${qual} ${AVISO_FICHA}`);
      // Mesmo com acerto parcial o texto fica guardado: é o que permite
      // descobrir por que o campo que faltou não foi achado.
      if (naoEncontrados.length) setTextoLido(data.text.trim());
    } catch {
      setErro("Não consegui carregar o leitor de imagem. Digite os campos.");
    } finally {
      setLendoFoto(false);
    }
  }

  const carregar = useCallback(async () => {
    const { data, error } = await createClient()
      .from("producao_do_dia").select("*")
      .eq("data", dia).order("created_at");
    setCarregando(false);
    // A tabela pode não existir ainda se o SQL não tiver sido rodado. A tela
    // avisa o que fazer em vez de mostrar uma lista vazia que mente.
    if (error) {
      setErro(error.code === "42P01"
        ? "A tabela da produção ainda não foi criada no banco. Rode a migração 202608240003_producao_do_dia.sql."
        : "Não foi possível carregar a produção do dia.");
      return;
    }
    setErro("");
    setItens((data ?? []) as Producao[]);
  }, [dia]);

  useEffect(() => { void carregar(); }, [carregar]);

  const total = useMemo(() => itens.reduce((s, i) => s + Number(i.valor), 0), [itens]);
  const aCobrar = useMemo(
    () => itens.filter((i) => i.situacao === "a_cobrar" || i.situacao === "faturado")
      .reduce((s, i) => s + Number(i.valor), 0),
    [itens],
  );

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const paciente = novo.paciente.trim();
    if (!paciente) return;
    setSalvando(true); setErro("");
    const { error } = await createClient().from("producao_do_dia").insert({
      institution_id: institutionId, perfil_id: perfilId, plantao_id: plantaoId,
      local_id: localId,
      data: dia, paciente,
      convenio: novo.convenio.trim() || "Particular",
      procedimento: novo.procedimento.trim() || null,
      valor: lerValor(novo.valor),
    });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar a anotação."); return; }
    // Convênio e procedimento ficam: numa sala de cirurgia o caso seguinte
    // costuma ser do mesmo convênio, e limpar tudo obrigaria a redigitar.
    setNovo({ ...novo, paciente: "", valor: "" });
    setAvisoFoto("");
    void carregar();
    document.getElementById("producao-paciente")?.focus();
  }

  async function mudar(id: string, campos: Partial<Producao>) {
    setErro("");
    const { error } = await createClient()
      .from("producao_do_dia").update(campos).eq("id", id);
    if (error) { setErro("Não foi possível salvar a alteração."); return; }
    void carregar();
  }

  async function remover(id: string, paciente: string) {
    if (!confirm(`Apagar a anotação de ${paciente}?`)) return;
    // O erro é olhado. Sem isso, uma recusa do banco voltava calada: a lista
    // recarregava, a anotação continuava lá, e a pessoa apagava de novo
    // achando que o clique não tinha pegado.
    const { error } = await createClient().from("producao_do_dia").delete().eq("id", id);
    if (error) { setErro(error.message || "Não foi possível apagar a anotação."); return; }
    setErro("");
    void carregar();
  }

  return (
    <div className="producaoBloco">
      <div className="producaoCabeca">
        <div>
          <strong>Produção do dia</strong>
          <span>só você vê esta lista</span>
        </div>
        <div className="producaoAcoes">
          {itens.length > 0 && (
            <div className="producaoTotais">
              <span><b>{money(total)}</b> no dia</span>
              {aCobrar > 0 && <span className="aberto"><b>{money(aCobrar)}</b> a receber</span>}
            </div>
          )}
          <label className="producaoFoto">
            {lendoFoto ? "Lendo a ficha…" : "Fotografar ficha"}
            <input type="file" accept="image/*" capture="environment" disabled={lendoFoto}
              aria-label="Fotografar a ficha de internação"
              onChange={(e) => { void lerFicha(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {erro && <p className="clinicalError">{erro}</p>}

      {carregando
        ? <div className="emptyClinical compactEmpty">Carregando…</div>
        : itens.length === 0
          // Lista vazia não precisa de texto: o formulário logo abaixo já é a
          // instrução, e um parágrafo explicando o óbvio só afasta o campo do
          // dedo de quem está com pressa.
          ? null
          : (
            <ul className="producaoLista">
              {itens.map((i) => (
                <li key={i.id} className={`producaoItem sit-${i.situacao}`}>
                  <input
                    className="producaoNome" defaultValue={i.paciente} aria-label="Paciente"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== i.paciente) void mudar(i.id, { paciente: v });
                      else e.target.value = i.paciente;
                    }}
                  />
                  <input
                    className="producaoConvenio" defaultValue={i.convenio} aria-label="Convênio"
                    list="producao-convenios"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || "Particular";
                      if (v !== i.convenio) void mudar(i.id, { convenio: v });
                    }}
                  />
                  <input
                    className="producaoProc" defaultValue={i.procedimento ?? ""}
                    placeholder="Cirurgia" aria-label="Procedimento"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== i.procedimento) void mudar(i.id, { procedimento: v });
                    }}
                  />
                  <input
                    className="producaoValor" defaultValue={Number(i.valor) || ""}
                    placeholder="R$ 0,00" inputMode="decimal" aria-label="Valor"
                    onBlur={(e) => {
                      const v = lerValor(e.target.value);
                      if (v !== Number(i.valor)) void mudar(i.id, { valor: v });
                    }}
                  />
                  <select value={i.situacao} aria-label="Situação"
                    onChange={(e) => void mudar(i.id, { situacao: e.target.value })}>
                    {SITUACOES.map(([id, rot]) => <option key={id} value={id}>{rot}</option>)}
                  </select>
                  <button type="button" className="producaoApagar"
                    onClick={() => void remover(i.id, i.paciente)}
                    aria-label={`Apagar ${i.paciente}`} title="Apagar">×</button>
                </li>
              ))}
            </ul>
          )}

      {/* O datalist deixa "Unimed" vir sozinho depois da primeira vez, sem
          prender a pessoa a uma lista fechada: convênio novo se digita. */}
      <datalist id="producao-convenios">
        {conveniosConhecidos.map((c) => <option key={c} value={c} />)}
      </datalist>

      {avisoFoto && <p className="producaoConfira" role="status">{avisoFoto}</p>}

      {/* O texto que saiu da foto, fechado.
          Ele é a única forma de descobrir por que uma ficha não foi lida: sem
          ver o que o reconhecimento entendeu, o conserto vira adivinhação. Fica
          fechado porque é material de conserto e não faz parte do trabalho de
          anotar, e some sozinho ao recarregar a página. */}
      {textoLido && (
        <details className="producaoTextoLido">
          <summary>Ver o texto que saiu da foto</summary>
          <p>
            Isto é o que o leitor entendeu da imagem. Se os campos estão aí e
            não foram preenchidos, o erro é meu: copie e me mande que eu ensino
            o sistema a ler esta ficha.
          </p>
          <textarea readOnly value={textoLido} rows={10}
            aria-label="Texto reconhecido na foto"
            onFocus={(e) => e.currentTarget.select()} />
        </details>
      )}

      <form className="producaoNovo" onSubmit={adicionar}>
        <input
          id="producao-paciente" className="producaoNome" value={novo.paciente}
          placeholder="Nome do paciente" aria-label="Nome do paciente"
          onChange={(e) => setNovo({ ...novo, paciente: e.target.value })}
        />
        <input
          className="producaoConvenio" value={novo.convenio} list="producao-convenios"
          placeholder="Convênio" aria-label="Convênio"
          onChange={(e) => setNovo({ ...novo, convenio: e.target.value })}
        />
        <input
          className="producaoProc" value={novo.procedimento}
          placeholder="Cirurgia" aria-label="Procedimento"
          onChange={(e) => setNovo({ ...novo, procedimento: e.target.value })}
        />
        <input
          className="producaoValor" value={novo.valor} inputMode="decimal"
          placeholder="R$ 0,00" aria-label="Valor"
          onChange={(e) => setNovo({ ...novo, valor: e.target.value })}
        />
        <button className="primaryClinical compact" disabled={salvando || !novo.paciente.trim()}>
          {salvando ? "Salvando…" : "+ Anotar"}
        </button>
      </form>
    </div>
  );
}

/**
 * A produção do mês, para faturar.
 *
 * A anotação do dia serve para não esquecer; esta tela serve para cobrar.
 * São dois momentos diferentes — um no fim do plantão, com pressa, outro no
 * fim do mês, sentado — e por isso são duas telas e não uma.
 */
export function ProducaoDoMes({
  mes, nomeMes, ano, locais, lugarPeloPlantao, onMudarMes, onEscolherMes,
  onImprimir, onImprimirFaturamento, onPlanilhaConvenio, onImprimirPlantoes,
  onPlanilhaPlantoes, onPlanilhaFaturamento,
}: {
  mes: string; nomeMes: string; ano: number;
  /**
   * Trocar de mês sem sair da aba.
   *
   * A seta do mês morava só dentro do calendário, na aba Escala. Quem abria
   * Produção via o mês corrente zerado — porque a produção do mês ainda não
   * começou — e não tinha como voltar ao mês que quer faturar. A tela dizia
   * "nada anotado" sobre um mês que a pessoa nem escolheu.
   */
  onMudarMes: (passo: number) => void;
  /** Pular direto para um mês qualquer, sem contar cliques na seta. */
  onEscolherMes?: (mes: string) => void;
  /** Os hospitais da organização, para dizer de onde é cada ato. */
  locais: Array<{ id: string; nome: string }>;
  /**
   * O lugar escrito à mão no plantão de onde a anotação saiu, quando ele não
   * é hospital cadastrado — sedação em consultório, cobertura particular. Vazio
   * quando não há plantão ou quando o plantão também não diz onde foi.
   */
  lugarPeloPlantao: (plantaoId: string | null) => string;
  onImprimir: (itens: Producao[]) => void;
  /** A nota do ato anestésico, por hospital e por quem paga. */
  onImprimirFaturamento: (itens: Producao[]) => void;
  onPlanilhaConvenio: (itens: Producao[]) => void;
  /** A nota da hora à disposição. Sai dos plantões, não desta lista. */
  onImprimirPlantoes: () => void;
  /**
   * As mesmas duas notas, em planilha.
   *
   * A folha impressa serve para levar papel ao hospital. Quem emite a nota
   * fiscal trabalha no computador, e não redigita PDF — para esse caminho vai
   * a planilha, que ele abre no Excel e soma sozinho.
   */
  onPlanilhaPlantoes: () => void;
  onPlanilhaFaturamento: (itens: Producao[]) => void;
}) {
  const [itens, setItens] = useState<Producao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recado, setRecado] = useState("");
  const [recarregar, setRecarregar] = useState(0);
  const { oculto, alternar, mascara } = useValoresOcultos();

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const ultimo = ultimoDiaDoMes(mes);
      const { data, error } = await createClient()
        .from("producao_do_dia").select("*")
        .gte("data", `${mes}-01`).lte("data", ultimo)
        .order("data").order("created_at");
      if (!vivo) return;
      setCarregando(false);
      if (error) {
        setErro(error.code === "42P01"
          ? "A tabela da produção ainda não foi criada no banco. Rode a migração 202608240003_producao_do_dia.sql."
          : "Não foi possível carregar a produção do mês.");
        return;
      }
      setErro("");
      setItens((data ?? []) as Producao[]);
    })();
    return () => { vivo = false; };
  }, [mes, recarregar]);

  // Por convênio é como se fatura: cada operadora recebe a sua remessa, e o
  // particular é cobrado paciente a paciente.
  const porConvenio = useMemo(() => {
    const m = new Map<string, { n: number; total: number; aberto: number }>();
    for (const i of itens) {
      const k = i.convenio || "Particular";
      const t = m.get(k) ?? { n: 0, total: 0, aberto: 0 };
      t.n += 1; t.total += Number(i.valor);
      if (i.situacao !== "recebido" && i.situacao !== "glosado") t.aberto += Number(i.valor);
      m.set(k, t);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [itens]);

  // O que ainda não foi ao Financeiro. Enviar de novo não duplica nada — a
  // função ignora o que já tem data —, mas o botão precisa dizer se há algo a
  // enviar, senão vira um clique sem efeito e sem explicação.
  const aEnviar = itens.filter((i) => !i.enviado_em).length;
  const jaEnviados = itens.length - aEnviar;

  /**
   * Enviar ao Financeiro.
   *
   * Até este clique a lista é estritamente sua: nem o administrador enxerga.
   * O que for enviado passa a ser legível por quem fatura — e só o deste mês,
   * e só o que já estava anotado. O resto continua invisível.
   */
  async function enviar(desfazer = false) {
    setEnviando(true); setErro(""); setRecado("");
    const { data, error } = await createClient()
      .rpc(desfazer ? "desfazer_envio_producao" : "enviar_producao_ao_financeiro", { p_mes: mes });
    setEnviando(false);
    if (error) {
      setErro(error.code === "42883"
        ? "O envio ao financeiro ainda não existe no banco. Rode a migração 202608240004_enviar_producao_financeiro.sql."
        : "Não foi possível enviar agora.");
      return;
    }
    const n = Number(data) || 0;
    setRecado(desfazer
      ? n > 0 ? `Envio desfeito. O financeiro deixou de ver ${plural(n, "anotação", "anotações")}.`
              : "Não havia nada enviado neste mês."
      : n > 0 ? `${plural(n, "anotação foi enviada", "anotações foram enviadas")} ao financeiro.`
              : "Tudo deste mês já tinha sido enviado.");
    setRecarregar((x) => x + 1);
  }

  /**
   * Guardar o hospital ou quem paga de um paciente.
   *
   * A lista muda na tela antes do banco responder, e de propósito: são
   * dezenas de pacientes num mês, e recarregar o mês inteiro a cada escolha
   * faria a lista piscar e perder a posição da rolagem a cada clique. Se o
   * banco recusar, o mês é recarregado — a tela não pode ficar mostrando uma
   * escolha que não foi gravada, porque é dela que sai a nota.
   */
  async function definir(id: string, campos: Partial<Producao>) {
    setErro("");
    setItens((antes) => antes.map((i) => (i.id === id ? { ...i, ...campos } : i)));
    const { error } = await createClient()
      .from("producao_do_dia").update(campos).eq("id", id);
    if (error) { setErro(erroDeColuna(error)); setRecarregar((x) => x + 1); }
  }

  /**
   * Resolver de uma vez os que ainda não têm pagador.
   *
   * Quase todo mês tem um padrão — num hospital o combinado é receber direto,
   * noutro a conta vai para o hospital — e as exceções são poucas. Marcar
   * trinta pacientes um a um para depois corrigir dois é trabalho que o
   * sistema pode poupar.
   *
   * Só toca no que está em branco, e isso é dito duas vezes: na lista de ids e
   * no `is("pagador", null)` da consulta. A segunda existe porque entre carregar
   * a tela e clicar aqui pode ter havido uma escolha noutro aparelho, e este
   * botão não pode desfazer uma decisão já tomada.
   */
  async function decidirOsQueFaltam(quem: string) {
    const alvos = itens.filter((i) => !i.pagador).map((i) => i.id);
    if (alvos.length === 0) return;
    setErro("");
    setItens((antes) => antes.map((i) => (i.pagador ? i : { ...i, pagador: quem })));
    const { error } = await createClient().from("producao_do_dia")
      .update({ pagador: quem }).in("id", alvos).is("pagador", null);
    if (error) { setErro(erroDeColuna(error)); setRecarregar((x) => x + 1); }
  }

  const total = itens.reduce((s, i) => s + Number(i.valor), 0);
  const recebido = itens.filter((i) => i.situacao === "recebido")
    .reduce((s, i) => s + Number(i.valor), 0);

  // O que trava a emissão da nota, e por isso é dito antes dos botões.
  //
  // Sem hospital de verdade é quem não tem nem o cadastro nem o texto do
  // plantão. O paciente anestesiado num plantão de fora já sai com o lugar
  // escrito na folha, e contá-lo aqui mandaria a pessoa procurar uma pendência
  // que não existe.
  const semPagador = itens.filter((i) => !i.pagador);
  const semLocal = itens.filter((i) => !i.local_id && !lugarPeloPlantao(i.plantao_id));
  const pendente = semPagador.reduce((s, i) => s + Number(i.valor), 0);

  if (carregando) return <div className="emptyClinical">Carregando produção…</div>;

  return (
    <>
      {erro && <p className="clinicalError">{erro}</p>}

      {recado && <p className="financeSuccess" role="status">{recado}</p>}

      {/* O mês, e as setas para trocá-lo, no alto de tudo. Faturar é sempre
          olhar para trás: quem abre esta tela no dia 3 quer o mês passado, não
          este. */}
      <section className="clinicalPanel producaoMesBarra">
        <div className="plantaoMesNav">
          <button className="outlineClinical" onClick={() => onMudarMes(-1)}
            aria-label="Mês anterior">‹</button>
          <strong>{nomeMes} de {ano}</strong>
          <button className="outlineClinical" onClick={() => onMudarMes(1)}
            aria-label="Próximo mês">›</button>
          {/* As setas resolvem "o mês passado", que é o caso de quase todo dia.
              Não resolvem "março": seriam cinco cliques, e a folha impressa
              sai do mês em que a tela estiver. O seletor direto fica ao lado,
              e não no lugar delas — quem quer o anterior continua com um
              toque. */}
          {onEscolherMes && (
            <input type="month" className="producaoMesEscolha" value={mes}
              aria-label="Escolher o mês" onChange={(e) => {
                if (e.target.value) onEscolherMes(e.target.value);
              }}/>
          )}
        </div>
      </section>

      <section className="metricGrid plantaoMetrics">
        <div className="metricCard"><strong>{mascara(String(itens.length))}</strong><span>Pacientes no mês</span></div>
        <div className="metricCard"><strong className="blue">{mascara(money(total))}</strong><span>Total anotado</span></div>
        <div className="metricCard"><strong className="green">{mascara(money(recebido))}</strong><span>Recebido</span></div>
        <div className="metricCard">
          <strong className="amber">{mascara(money(total - recebido))}</strong><span>A receber</span>
          <OlhoValores oculto={oculto} onAlternar={alternar} />
        </div>
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>O que você anotou</strong>
          <div className="producaoAcoesMes">
            {/* Só o envio mora aqui. As três impressões foram para o painel de
                baixo: um "Imprimir" solto ao lado de "Enviar ao financeiro"
                fazia parecer que os dois eram o mesmo caminho, e a tela tinha
                três botões de imprimir espalhados por dois painéis. */}
            <button className="primaryClinical compact" disabled={aEnviar === 0 || enviando}
              onClick={() => void enviar()}
              title={aEnviar === 0 ? "Nada novo para enviar neste mês"
                                   : "O financeiro passa a ver estas anotações"}>
              {enviando ? "Enviando…"
                : aEnviar === 0 ? "Enviado ao financeiro"
                : `Enviar ao financeiro (${aEnviar})`}
            </button>
            {jaEnviados > 0 && (
              <button className="outlineClinical" disabled={enviando}
                onClick={() => void enviar(true)}
                title="O financeiro deixa de ver o que foi enviado neste mês">
                Desfazer envio
              </button>
            )}
          </div>
        </div>
        {porConvenio.length === 0
          ? <div className="emptyClinical compactEmpty">
              Nada anotado neste mês. A anotação é feita no dia: toque num dia da
              sua escala e use “Produção do dia”.
            </div>
          : porConvenio.map(([convenio, t]) => (
            <div className="plantaoLinha" key={convenio}>
              <span className="plantaoOnde">
                <strong>{convenio}</strong>
                <small>{plural(t.n, "paciente", "pacientes")}</small>
              </span>
              <b>{money(t.total)}</b>
              {t.aberto > 0 && <span className="statusChip waiting">{money(t.aberto)} em aberto</span>}
            </div>
          ))}
      </section>

      {/* Tudo o que se imprime, num lugar só.
          Antes havia três botões de imprimir espalhados por dois painéis, com
          nomes que não diziam o que sairia do papel. Aqui cada folha é uma
          linha, com o nome e a frase que explica para que ela serve — a
          escolha se faz lendo, e não abrindo as três para descobrir. */}
      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Imprimir</strong>
        </div>

        {/* A linha de baixo diz só a QUEBRA de cada folha, que é a única coisa
            que as distingue na hora de escolher. O resto — por que são duas
            notas, contra quem cada uma é emitida — está no papel que sai, e
            repetido aqui virava parágrafo numa tela que se abre para agir. */}
        <div className="producaoFolha">
          <span>
            <strong>Nota de plantões</strong>
            <small>Por hospital</small>
          </span>
          {/* Imprimir é para levar ao hospital; planilha é para mandar a quem
              emite a nota. São dois destinos diferentes do mesmo mês, e por
              isso os dois botões ficam lado a lado em vez de um substituir o
              outro. */}
          <button className="outlineClinical" onClick={onPlanilhaPlantoes}>Planilha</button>
          <button className="outlineClinical" onClick={onImprimirPlantoes}>Imprimir</button>
        </div>

        <div className="producaoFolha">
          <span>
            <strong>Nota de faturamento</strong>
            <small>Por hospital e por quem paga</small>
          </span>
          <button className="outlineClinical" disabled={itens.length === 0}
            onClick={() => onPlanilhaFaturamento(itens)}>Planilha</button>
          <button className="outlineClinical"
            disabled={itens.length === 0} onClick={() => onImprimirFaturamento(itens)}>
            Imprimir
          </button>
        </div>

        <div className="producaoFolha">
          <span>
            <strong>Lista por convênio</strong>
            <small>Por operadora</small>
          </span>
          <button className="outlineClinical" disabled={itens.length === 0}
            onClick={() => onPlanilhaConvenio(itens)}>Planilha</button>
          <button className="outlineClinical"
            disabled={itens.length === 0} onClick={() => onImprimir(itens)}>
            Imprimir
          </button>
        </div>

        {semPagador.length > 0 && (
          <div className="producaoPendencia">
            {/* A consequência em meia linha. Dizer que o valor "sai numa parte
                à parte da folha e não entra em nota nenhuma enquanto não for
                decidido" era explicar o mecanismo; o que a pessoa precisa saber
                é que aquele dinheiro está fora. */}
            <p>
              <b>{plural(semPagador.length, "paciente", "pacientes")}</b> sem quem
              paga · <b>{money(pendente)}</b> fora das notas
            </p>
            {/* Um mês costuma ter um padrão e duas exceções. Isto resolve o
                padrão de uma vez; as exceções se corrigem na lista abaixo. */}
            <div className="producaoPendenciaAcoes">
              <span>Marcar todos como:</span>
              {PAGADORES.map(([id, rotulo]) => (
                <button key={id} type="button" className="outlineClinical compact"
                  onClick={() => void decidirOsQueFaltam(id)}>
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {semLocal.length > 0 && (
          <p className="producaoPendencia semHospital">
            {plural(semLocal.length, "paciente", "pacientes")} sem hospital
          </p>
        )}
      </section>

      {itens.length > 0 && (
        <section className="clinicalPanel">
          <div className="panelTitle">
            {/* Sem legenda. Os dois seletores da linha já se anunciam pelo
                que trazem escrito, e a frase repetia em palavras o que a
                própria tabela mostra logo abaixo. */}
            <strong>Produção do mês</strong>
          </div>
          {itens.map((i) => {
            // O lugar que o plantão já sabe, para quem veio de plantão de
            // fora. Ele preenche a opção vazia em vez de "Sem hospital": o
            // paciente da sedação no consultório não está sem lugar — o lugar
            // dele só não é hospital cadastrado, e vai para a folha assim.
            const doPlantao = i.local_id ? "" : lugarPeloPlantao(i.plantao_id);
            return (
            <div className="producaoNotaLinha" key={i.id}>
              <span className="producaoNotaDia">
                {Number(i.data.slice(8, 10))}/{i.data.slice(5, 7)}
              </span>
              <span className="producaoNotaQuem">
                <strong>{i.paciente}</strong>
                <small>
                  {i.convenio}{i.procedimento ? ` · ${i.procedimento}` : ""}
                </small>
              </span>
              <select value={i.local_id ?? ""} aria-label={`Hospital de ${i.paciente}`}
                className={i.local_id || doPlantao ? undefined : "faltando"}
                onChange={(e) => void definir(i.id, { local_id: e.target.value || null })}>
                <option value="">{doPlantao ? `${doPlantao} (do plantão)` : "Sem hospital"}</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
              <select value={i.pagador ?? ""} aria-label={`Quem paga ${i.paciente}`}
                className={i.pagador ? undefined : "faltando"}
                onChange={(e) => void definir(i.id, { pagador: e.target.value || null })}>
                <option value="">Quem paga?</option>
                {PAGADORES.map(([id, rotulo]) => (
                  <option key={id} value={id}>{rotulo}</option>
                ))}
              </select>
              {/* A BAIXA DA PRODUÇÃO.
                  A coluna `situacao` existia desde o começo e o total de
                  recebido já era somado — só faltava por onde marcar, e o
                  dinheiro que caía na conta não tinha como ser registrado.
                  Fica na linha, junto do resto, porque é onde a pessoa está
                  olhando quando confere o extrato contra a lista. */}
              <select value={i.situacao} aria-label={`Situação de ${i.paciente}`}
                className={`producaoSituacao s-${i.situacao}`}
                onChange={(e) => void definir(i.id, {
                  situacao: e.target.value,
                  // A data do recebimento entra AQUI, que é onde ela existe: o
                  // dia em que se apertou o botão é o dia em que o dinheiro
                  // caiu. Sem ela o fechamento não sabe em que mês somar — o
                  // mesmo defeito que a Escala já teve com o `pago_em`.
                  recebido_em: e.target.value === "recebido"
                    ? (i.recebido_em ?? hojeLocal()) : null,
                })}>
                {SITUACOES.map(([id, rotulo]) => (
                  <option key={id} value={id}>{rotulo}</option>
                ))}
              </select>
              <b>{money(Number(i.valor))}</b>
            </div>
            );
          })}
        </section>
      )}
    </>
  );
}

/**
 * O que a equipe enviou para o Financeiro.
 *
 * Chega aqui só o que cada anestesista mandou, mês a mês, clicando em "Enviar
 * ao financeiro" na produção dele. O que ninguém enviou continua invisível —
 * a lista de pacientes que alguém atendeu não é informação de gestão até que
 * a própria pessoa a entregue para faturar.
 *
 * Vem agrupado por convênio porque é assim que se fatura: uma remessa por
 * operadora. E traz o nome de quem enviou, que é o que separa duas guias da
 * mesma cirurgia cobradas por anestesistas diferentes.
 */
export function ProducaoRecebida({ mes, nomeMes, ano }: {
  mes: string; nomeMes: string; ano: number;
}) {
  type Linha = {
    id: string; data: string; paciente: string; convenio: string;
    procedimento: string | null; valor: number; situacao: string;
    profissional: string; enviado_em: string;
  };
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const { oculto, alternar, mascara } = useValoresOcultos();

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data, error } = await createClient().rpc("producao_recebida", { p_mes: mes });
      if (!vivo) return;
      setCarregando(false);
      if (error) {
        setErro(error.code === "42883"
          ? "A produção enviada ainda não existe no banco. Rode a migração 202608240004_enviar_producao_financeiro.sql."
          : "Não foi possível carregar a produção enviada.");
        return;
      }
      setErro("");
      setLinhas((data ?? []) as Linha[]);
    })();
    return () => { vivo = false; };
  }, [mes]);

  const porConvenio = useMemo(() => {
    const m = new Map<string, Linha[]>();
    for (const l of linhas) {
      const k = l.convenio || "Particular";
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [linhas]);

  const total = linhas.reduce((s, l) => s + Number(l.valor), 0);
  const quantos = new Set(linhas.map((l) => l.profissional)).size;

  if (carregando) return <div className="emptyClinical">Carregando produção enviada…</div>;

  return (
    <>
      {erro && <p className="clinicalError">{erro}</p>}

      <section className="metricGrid financeMetrics">
        <div className="metricCard"><strong>{mascara(String(linhas.length))}</strong><span>Anotações recebidas</span></div>
        <div className="metricCard"><strong>{mascara(String(quantos))}</strong><span>Profissionais</span></div>
        <div className="metricCard">
          <strong className="blue">{mascara(money(total))}</strong><span>Total a faturar</span>
          <OlhoValores oculto={oculto} onAlternar={alternar} />
        </div>
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Produção da equipe em {nomeMes} de {ano}</strong>
        </div>
        {linhas.length === 0
          ? <div className="emptyClinical">
              Ninguém enviou produção deste mês ainda. Cada anestesiologista envia a
              dele em Escala → Produção.
            </div>
          : porConvenio.map(([convenio, doConvenio]) => (
            <div key={convenio}>
              <div className="financeGroupHead">
                <strong>{convenio}</strong>
                <span>{plural(doConvenio.length, "anotação", "anotações")}</span>
                <b>{mascara(money(doConvenio.reduce((s, l) => s + Number(l.valor), 0)))}</b>
              </div>
              {doConvenio.map((l) => (
                <div className="producaoRecebidaLinha" key={l.id}>
                  <span><strong>{l.paciente}</strong>
                    <small>{l.procedimento || "procedimento não informado"}</small></span>
                  <span className="producaoQuem">{l.profissional}</span>
                  <span className="producaoQuando">
                    {Number(l.data.slice(8, 10))}/{l.data.slice(5, 7)}
                  </span>
                  <b>{mascara(money(Number(l.valor)))}</b>
                </div>
              ))}
            </div>
          ))}
      </section>
    </>
  );
}
