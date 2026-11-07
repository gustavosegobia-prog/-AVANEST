"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { JanelaDeImportar } from "@/components/centro/importar";
import { anestesistasDaEquipe, anestesistasDePlantao, noHospital, type PlantaoDaEscala, type Sala } from "@/lib/centro-cirurgico";
import { hoje, somarDias } from "@/lib/data-local";

type Pronto = {
  dia: string;
  salas: Sala[];
  anestesistas: Array<{ id: string; nome: string; apelido: string }>;
  plantoes: PlantaoDaEscala[];
};

// IMPORTAR O MAPA DE DENTRO DA FICHA ANESTÉSICA (07/11/2026: "pôr por dentro
// da ficha anestésica"). A mesma janela da tela do centro cirúrgico
// (components/centro/importar.tsx): a planilha, o PDF ou a foto do mapa, a
// conferência, e só então grava — no hospital desta sessão. As salas, a equipe
// e a escala só são buscadas no toque: quem só abre a ficha não paga por isso.
export function ImportarMapaNaFicha({ institutionId, localId, aoImportar }: {
  institutionId: string;
  localId: string | null;
  aoImportar: (data: string, quantos: number) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [erro, setErro] = useState("");

  async function abrir() {
    setErro("");
    setCarregando(true);
    const dia = hoje();
    const sb = createClient();
    const [salas, equipe, plantoes] = await Promise.all([
      noHospital(sb.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", institutionId), localId).order("ordem"),
      sb.from("perfis").select("id, nome, role, status, atuacao_medica").eq("institution_id", institutionId),
      // Ontem também: a cirurgia das 5h é do plantão de 24h que começou ontem às 7h.
      sb.from("plantoes").select("data, hora_inicio, hora_fim, perfil_id, situacao")
        .eq("institution_id", institutionId).eq("privado", false).gte("data", somarDias(dia, -1)).lte("data", dia),
    ]);
    setCarregando(false);
    if (salas.error || equipe.error) {
      setErro("Não deu para abrir a importação do mapa. Confira a conexão e tente de novo.");
      return;
    }
    setPronto({
      dia,
      salas: (salas.data ?? []) as Sala[],
      anestesistas: anestesistasDaEquipe((equipe.data ?? []) as Parameters<typeof anestesistasDaEquipe>[0]),
      plantoes: (plantoes.data ?? []) as PlantaoDaEscala[],
    });
  }

  return (
    <>
      <button type="button" className="fcAtalho" onClick={() => void abrir()} disabled={carregando} aria-busy={carregando}>
        <Icone nome="nota" tamanho={16} /> {carregando ? "Abrindo…" : "Importar mapa"}
      </button>
      {erro && <p className="fcErro fcAtalhoErro" role="alert">{erro}</p>}
      {pronto && (
        <JanelaDeImportar
          institutionId={institutionId} localId={localId} diaAberto={pronto.dia} salas={pronto.salas}
          anestesistas={pronto.anestesistas}
          dePlantao={(data, horario) => anestesistasDePlantao(pronto.plantoes, data, horario)}
          onFechar={() => setPronto(null)}
          onImportado={(data, quantos) => { setPronto(null); aoImportar(data, quantos); }}
        />
      )}
    </>
  );
}
