"use client";

import { useEffect, useRef, useState } from "react";
import { Icone } from "@/components/icone";
import { Janela } from "@/components/janela";
import { propostaDaFicha, type CampoProposto, type ChaveDaProposta, type FichaDoHospital } from "@/lib/evolucao/ficha-do-hospital";

// Abrir a ficha anestésica pela foto da avaliação de outro serviço (11/11/2026).
//
// A avaliação pré-anestésica que outro médico fez, impressa no sistema do
// hospital: a foto é lida no aparelho (lib/evolucao/foto-da-ficha.ts), e
// dela vêm só os DADOS DO PACIENTE — nome, nascimento, sexo e convênio para
// o cadastro; cirurgia proposta, peso, altura, alergias e medicação em uso
// para o cabeçalho da ficha. O médico confere, corrige o que a leitura
// trocou e abre a ficha. A ficha anestésica não muda em nada.

export type PacienteDaFoto = { nome: string; nascimento: string; sexo: string; convenio: string };
export type FichaConferida = { ficha: FichaDoHospital; campos: Array<{ chave: ChaveDaProposta; valor: string }>; paciente: PacienteDaFoto };

/**
 * O botão que já abre a câmera (ou a galeria, ou o PDF): escolhida a foto, a
 * janela abre lendo. Um toque a menos do que abrir a janela e depois escolher.
 */
export function BotaoFotoDaAvaliacao({ rotulo, className = "fcAtalho", onArquivo }: {
  rotulo: string; className?: string; onArquivo: (f: File) => void;
}) {
  return (
    <label className={`${className} evoFHEscolher`}>
      <Icone nome="camera" tamanho={16} /> {rotulo}
      <input type="file" accept="image/*,.pdf" className="evoFHArquivo"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onArquivo(f); }} />
    </label>
  );
}

export function JanelaFichaDoHospital({ arquivoInicial, ocupado = false, erroDeFora = "", onConfirmar, onFechar }: {
  /** A foto escolhida no botão: a janela já abre lendo. */
  arquivoInicial?: File;
  ocupado?: boolean;
  erroDeFora?: string;
  onConfirmar: (r: FichaConferida) => void;
  onFechar: () => void;
}) {
  const [ficha, setFicha] = useState<FichaDoHospital | null>(null);
  const [campos, setCampos] = useState<CampoProposto[]>([]);
  const [paciente, setPaciente] = useState<PacienteDaFoto>({ nome: "", nascimento: "", sexo: "", convenio: "" });
  const [lendo, setLendo] = useState(Boolean(arquivoInicial));
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");

  async function ler(arquivo?: File) {
    if (!arquivo) return;
    setLendo(true); setErro(""); setProgresso(0);
    try {
      const { lerFotoDaFicha } = await import("@/lib/evolucao/foto-da-ficha");
      const f = await lerFotoDaFicha(arquivo, setProgresso);
      const proposta = propostaDaFicha(f);
      if (!f.paciente.nome && proposta.length < 2) {
        setErro("Li pouca coisa nesta foto. Tente de novo: a folha inteira, de frente, bem iluminada e sem sombra da mão.");
      }
      setFicha(f);
      setCampos(proposta);
      setPaciente({ nome: f.paciente.nome, nascimento: f.paciente.nascimento, sexo: f.paciente.sexo, convenio: f.paciente.convenio });
    } catch {
      setErro("Não consegui ler este arquivo. Envie uma foto da avaliação pré-anestésica impressa (ou o PDF do sistema do hospital).");
    } finally {
      setLendo(false);
    }
  }

  // A leitura da foto do botão começa sozinha, uma vez só (o modo de
  // desenvolvimento roda o efeito duas vezes).
  const comecou = useRef(false);
  useEffect(() => {
    if (!arquivoInicial || comecou.current) return;
    comecou.current = true;
    void ler(arquivoInicial);
  }, [arquivoInicial]);

  const mudar = (chave: ChaveDaProposta, valor: string) => setCampos((cs) => cs.map((c) => (c.chave === chave ? { ...c, valor } : c)));
  const pronto = ficha && paciente.nome.trim().length > 2;
  const confirmar = () => {
    if (!ficha) return;
    const entram = campos.filter((c) => c.valor.trim()).map(({ chave, valor }) => ({ chave, valor }));
    if (paciente.convenio.trim()) entram.push({ chave: "papel_convenio", valor: paciente.convenio.trim() });
    onConfirmar({ ficha, campos: entram, paciente });
  };

  return (
    <Janela titulo="Abrir a ficha pela foto da avaliação" largura="larga" onFechar={onFechar}
      subtitulo="A avaliação pré-anestésica impressa, de outro hospital ou serviço: o AVANEST lê os dados do paciente, cadastra quem não está no sistema e abre a ficha anestésica."
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="button" className="evoBotao" disabled={!pronto || ocupado || lendo} onClick={confirmar}>
          {ocupado ? "Abrindo…" : "Abrir a ficha anestésica"}
        </button>
      </>}>
      <div className="evoForm">
        <label className={`evoFotoMonitor${lendo ? " lendo" : ""}`}>
          <b>{lendo ? `Lendo a foto… ${Math.round(progresso * 100)}%` : ficha ? "Ler outra foto" : "Fotografar a avaliação"}</b>
          <span>A folha inteira, de frente, sem sombra. Também aceita o PDF do sistema do hospital.</span>
          <input type="file" accept="image/*,.pdf" disabled={lendo}
            onChange={(e) => { void ler(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <p className="evoNota">A foto é lida neste aparelho e não é enviada nem guardada. Confira cada campo com a folha: a leitura pode trocar letras.</p>
        {erro && <p className="evoNota atencao" role="alert">{erro}</p>}

        {ficha && (
          <fieldset className="evoFHGrupo">
            <legend>Paciente</legend>
            <div className="evoGradeCampos">
              <label className="evoCampo evoFHNome"><span>Nome</span>
                <input value={paciente.nome} onChange={(e) => setPaciente({ ...paciente, nome: e.target.value })} autoComplete="off" />
                {!paciente.nome.trim() && <small>Não deu para ler o nome nesta foto: escreva aqui, ou tente outra foto mais de perto.</small>}
              </label>
              <label className="evoCampo"><span>Nascimento</span>
                <input type="date" value={paciente.nascimento} onChange={(e) => setPaciente({ ...paciente, nascimento: e.target.value })} />
              </label>
              <label className="evoCampo"><span>Sexo</span>
                <select value={paciente.sexo} onChange={(e) => setPaciente({ ...paciente, sexo: e.target.value })}>
                  <option value="">—</option><option>Feminino</option><option>Masculino</option>
                </select>
              </label>
              <label className="evoCampo"><span>Convênio</span>
                <input value={paciente.convenio} onChange={(e) => setPaciente({ ...paciente, convenio: e.target.value })} />
              </label>
            </div>
          </fieldset>
        )}

        {campos.length > 0 && (
          <fieldset className="evoFHGrupo">
            <legend>Para o cabeçalho da ficha</legend>
            <div className="evoFHCampos">
              {campos.map((c) => (
                <label key={c.chave} className="evoCampo evoFHCampo">
                  <span>{c.rotulo}</span>
                  {c.valor.length > 60
                    ? <textarea rows={Math.min(4, Math.ceil(c.valor.length / 70))} value={c.valor} onChange={(e) => mudar(c.chave, e.target.value)} />
                    : <input value={c.valor} onChange={(e) => mudar(c.chave, e.target.value)} />}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {erroDeFora && <p className="evoNota atencao" role="alert">{erroDeFora}</p>}
      </div>
    </Janela>
  );
}
