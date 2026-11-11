"use client";

import { useState } from "react";
import { Janela } from "@/components/janela";
import {
  jaPreenchido, mesmoPaciente, preencherAFolha, propostaDaFicha, valorNaFolha, type CampoProposto, type ChaveDaProposta, type FichaDoHospital,
} from "@/lib/evolucao/ficha-do-hospital";

// A ficha pré-anestésica do hospital, pela foto (11/11/2026).
//
// Fotografa a folha impressa do sistema do hospital, lê no aparelho
// (lib/evolucao/foto-da-ficha.ts) e mostra campo a campo o que iria para a
// ficha anestésica. O médico corrige o que o OCR errou e confirma. O campo
// que a ficha já tem fica como está: a foto só preenche o vazio.
//
// Duas portas: de dentro da ficha aberta ("Preencher pela ficha do
// hospital") e da tela de abrir ficha, quando o paciente ainda nem está no
// sistema — aí a janela mostra também o nome, o nascimento e o sexo, para o
// cadastro.

export type PacienteDaFoto = { nome: string; nascimento: string; sexo: string; convenio: string };
export type FichaConferida = { ficha: FichaDoHospital; campos: Array<{ chave: ChaveDaProposta; valor: string }>; paciente: PacienteDaFoto };

export function JanelaFichaDoHospital({ dados = {}, pacienteDaFolha, comPaciente = false, confirmar, ocupado = false, erroDeFora = "", onConfirmar, onFechar }: {
  /** A ficha como está: o que já tem não é trocado. Na abertura, vazia. */
  dados?: Record<string, unknown>;
  /** O paciente da ficha aberta, para conferir que a foto é dele. */
  pacienteDaFolha?: { nome: string };
  /** Na tela de abrir ficha: nome, nascimento, sexo e convênio para o cadastro. */
  comPaciente?: boolean;
  confirmar: string;
  ocupado?: boolean;
  erroDeFora?: string;
  onConfirmar: (r: FichaConferida) => void;
  onFechar: () => void;
}) {
  const [ficha, setFicha] = useState<FichaDoHospital | null>(null);
  const [campos, setCampos] = useState<CampoProposto[]>([]);
  const [paciente, setPaciente] = useState<PacienteDaFoto>({ nome: "", nascimento: "", sexo: "", convenio: "" });
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState("");

  async function ler(arquivo?: File) {
    if (!arquivo) return;
    setLendo(true); setErro(""); setProgresso(0);
    try {
      const { lerFotoDaFicha } = await import("@/lib/evolucao/foto-da-ficha");
      const f = await lerFotoDaFicha(arquivo, setProgresso);
      const proposta = propostaDaFicha(f);
      if (proposta.length < 3) {
        setErro("Li pouca coisa nesta foto. Tente de novo: a folha inteira, de frente, bem iluminada e sem sombra da mão.");
      }
      setFicha(f);
      setCampos(proposta);
      setPaciente({ nome: f.paciente.nome, nascimento: f.paciente.nascimento, sexo: f.paciente.sexo, convenio: f.paciente.convenio });
    } catch {
      setErro("Não consegui ler este arquivo. Envie uma foto da ficha pré-anestésica impressa (ou o PDF do sistema do hospital).");
    } finally {
      setLendo(false);
    }
  }

  const mudar = (chave: ChaveDaProposta, valor: string) => setCampos((cs) => cs.map((c) => (c.chave === chave ? { ...c, valor } : c)));
  const entram = campos.filter((c) => c.valor.trim() && !jaPreenchido(dados, c.chave));
  const outroPaciente = !comPaciente && ficha && pacienteDaFolha && ficha.paciente.nome
    && !mesmoPaciente(pacienteDaFolha.nome, ficha.paciente.nome);
  const pronto = ficha && (comPaciente ? paciente.nome.trim().length > 2 : entram.length > 0);

  return (
    <Janela titulo="Ficha pré-anestésica do hospital" largura="larga" onFechar={onFechar}
      subtitulo="Fotografe a avaliação impressa do sistema do hospital: os dados vêm para a ficha anestésica, para você conferir."
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="button" className="evoBotao" disabled={!pronto || ocupado || lendo}
          onClick={() => ficha && onConfirmar({ ficha, campos: entram.map(({ chave, valor }) => ({ chave, valor })), paciente })}>
          {ocupado ? "Abrindo…" : confirmar}
        </button>
      </>}>
      <div className="evoForm">
        <label className={`evoFotoMonitor${lendo ? " lendo" : ""}`}>
          <b>{lendo ? `Lendo a ficha… ${Math.round(progresso * 100)}%` : ficha ? "Ler outra foto" : "Fotografar a ficha do hospital"}</b>
          <span>A folha inteira, de frente, sem sombra. Também aceita o PDF do sistema do hospital.</span>
          <input type="file" accept="image/*,.pdf" disabled={lendo}
            onChange={(e) => { void ler(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <p className="evoNota">A foto é lida neste aparelho e não é enviada nem guardada. Confira cada campo com a folha: a leitura pode trocar letras.</p>
        {erro && <p className="evoNota atencao" role="alert">{erro}</p>}
        {outroPaciente && (
          <p className="evoNota atencao" role="alert">
            O nome na foto ({ficha.paciente.nome}) não é o desta ficha ({pacienteDaFolha.nome}). Confira se é a folha certa antes de preencher.
          </p>
        )}

        {ficha && comPaciente && (
          <fieldset className="evoFHGrupo">
            <legend>Paciente</legend>
            <div className="evoGradeCampos">
              <label className="evoCampo evoFHNome"><span>Nome</span>
                <input value={paciente.nome} onChange={(e) => setPaciente({ ...paciente, nome: e.target.value })} autoComplete="off" />
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
            <legend>Avaliação pré-anestésica</legend>
            <div className="evoFHCampos">
              {campos.map((c) => {
                const ja = jaPreenchido(dados, c.chave);
                const longo = c.valor.length > 60;
                return (
                  <label key={c.chave} className={`evoCampo evoFHCampo${ja ? " ja" : ""}`}>
                    <span>{c.rotulo}{ja && <em> · fica o que já está na ficha: {valorNaFolha(dados, c.chave)}</em>}</span>
                    {longo
                      ? <textarea rows={Math.min(5, Math.ceil(c.valor.length / 70))} value={c.valor} disabled={ja} onChange={(e) => mudar(c.chave, e.target.value)} />
                      : <input value={c.valor} disabled={ja} onChange={(e) => mudar(c.chave, e.target.value)} />}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {ficha && !comPaciente && !entram.length && campos.length > 0 && (
          <p className="evoNota">Todos estes campos já estão preenchidos na ficha: nada a trazer.</p>
        )}
        {erroDeFora && <p className="evoNota atencao" role="alert">{erroDeFora}</p>}
      </div>
    </Janela>
  );
}

/** O botão de dentro da ficha aberta: lê a foto e preenche só os campos vazios. */
export function PreencherPelaFichaDoHospital({ dados, paciente, onMudar }: {
  dados: Record<string, unknown>;
  paciente: { nome: string };
  onMudar: (m: Record<string, unknown>) => void;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" className="evoBotao pequeno secundario evoFHBotao" onClick={() => setAberta(true)}>
        Preencher pela ficha do hospital (foto)
      </button>
      {aberta && (
        <JanelaFichaDoHospital dados={dados} pacienteDaFolha={paciente} confirmar="Preencher os campos vazios"
          onFechar={() => setAberta(false)}
          onConfirmar={({ ficha, campos }) => {
            const parcial = preencherAFolha(dados, campos, new Date(), ficha);
            if (Object.keys(parcial).length) onMudar(parcial);
            setAberta(false);
          }} />
      )}
    </>
  );
}
