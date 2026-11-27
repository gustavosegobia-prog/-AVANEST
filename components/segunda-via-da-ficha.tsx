"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { PainelRecolhivel } from "@/components/painel-recolhivel";
import { ImprimirFicha } from "@/components/evolucao/imprimir-ficha";
import { buscarPacientes, type PacienteBuscavel } from "@/lib/recepcao";

// SEGUNDA VIA DA FICHA ANESTÉSICA, NA RECEPÇÃO (27/11/2026).
//
// O paciente perdeu a ficha e volta ao balcão. A recepção acha a ficha pelo
// nome e imprime de novo — só a ENCERRADA, e só imprimir: não há link para
// abrir a ficha, e a regra do banco (pode_segunda_via) não devolve a aberta.
// Cada impressão fica na auditoria (a página de impressão registra).

type Linha = { id: string; patient_id: string; inicio_em: string; encerrada_em: string | null; procedimento: string | null };

const DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });
const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function SegundaViaDaFicha({ institutionId, pacientes }: { institutionId: string; pacientes: PacienteBuscavel[] }) {
  const [pode, setPode] = useState(false);
  const [termo, setTermo] = useState("");
  const [fichas, setFichas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState("");
  const nomePorId = useMemo(() => new Map(pacientes.map((p) => [p.id, p.nome])), [pacientes]);

  // Só aparece para quem pode (recepção, com a ficha anestésica liberada).
  useEffect(() => {
    let ativo = true;
    createClient().rpc("pode_segunda_via", { p_institution_id: institutionId })
      .then(({ data }) => { if (ativo) setPode(data === true); });
    return () => { ativo = false; };
  }, [institutionId]);

  // Sem nada escrito, as encerradas mais recentes; com um nome, as dele.
  useEffect(() => {
    if (!pode) return;
    let ativo = true;
    const espera = setTimeout(async () => {
      const t = termo.trim();
      let consulta = createClient().from("evolucoes_anestesicas")
        .select("id, patient_id, inicio_em, encerrada_em, procedimento:dados->>procedimento")
        .eq("status", "encerrada").order("inicio_em", { ascending: false }).limit(20);
      if (t.length >= 2) {
        const ids = buscarPacientes(pacientes, t, 100).map((p) => p.id);
        if (!ids.length) { if (ativo) { setFichas([]); setErro(""); } return; }
        consulta = consulta.in("patient_id", ids);
      }
      const { data, error } = await consulta;
      if (!ativo) return;
      if (error) { setErro("Não consegui buscar as fichas agora. Confira a conexão e tente de novo."); setFichas([]); return; }
      setErro("");
      setFichas((data ?? []) as Linha[]);
    }, 250);
    return () => { ativo = false; clearTimeout(espera); };
  }, [pode, termo, pacientes]);

  if (!pode) return null;
  const buscando = termo.trim().length >= 2;

  return (
    <PainelRecolhivel chave="recepcao-segunda-via" abrePadrao={false}
      titulo="Segunda via da ficha anestésica"
      legenda="fichas encerradas, para imprimir de novo">
      <div className="recSegundaVia">
        <label className="recBuscaCampo">
          <span className="sr-only">Nome do paciente</span>
          <Icone nome="busca" tamanho={18} />
          <input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome do paciente" autoComplete="off" />
        </label>
        <small className="recSegundaViaDica">
          Só a ficha encerrada, e só para imprimir. Cada segunda via fica registrada no histórico da organização.
        </small>
        {erro && <p className="clinicalError" role="alert">{erro}</p>}
        {fichas && fichas.length === 0 && !erro && (
          <p className="fcVazio">{buscando ? `Nenhuma ficha encerrada de “${termo.trim()}”.` : "Ainda não há ficha encerrada."}</p>
        )}
        {fichas && fichas.length > 0 && (
          <ul className="fcLista" aria-label={buscando ? "Fichas encontradas" : "Encerradas mais recentes"}>
            {fichas.map((f) => {
              const nome = nomePorId.get(f.patient_id) ?? "Paciente";
              const inicio = new Date(f.inicio_em);
              return (
                <li key={f.id} className="fcEncerrada">
                  <div className="fcLinha">
                    <span className="fcQuem">
                      <strong>{nome}</strong>
                      <span>{f.procedimento?.trim() || "Procedimento não informado"}</span>
                    </span>
                    <span className="fcQuando">
                      {DIA.format(inicio)} · {HORA.format(inicio)}{f.encerrada_em && `–${HORA.format(new Date(f.encerrada_em))}`}
                    </span>
                  </div>
                  <ImprimirFicha id={f.id} className="fcImprimir" rotulo={`Imprimir a segunda via da ficha de ${nome}`}>
                    <Icone nome="imprimir" tamanho={18} /> <span className="imprTexto">Imprimir</span>
                  </ImprimirFicha>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PainelRecolhivel>
  );
}
