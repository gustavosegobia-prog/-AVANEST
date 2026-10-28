"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";
import { ladrilhoDaMarca, textoDaMarca, type QuemUsa } from "@/lib/marca-do-usuario";

/**
 * A marca d'água com o nome, o CRM, a data e a hora de quem está logado,
 * repetida bem clarinha sobre a tela inteira. Ver lib/marca-do-usuario.ts.
 *
 * Vai nas telas que valem um print: os protocolos de crise e a calculadora de
 * doses (o sistema) e a avaliação, a ficha anestésica e o financeiro (os dados
 * dos pacientes). Fica presa à janela, e não ao conteúdo: em qualquer ponto da
 * rolagem o print sai com ela. Não pega toque nem clique.
 *
 * `naImpressao`: sai também no papel. Só o protocolo de crise e a calculadora
 * pedem isso — o PDF do protocolo leva o nome de quem o tirou. A ficha e os
 * documentos do paciente saem limpos, como vão para o prontuário.
 *
 * Duas telas marcadas abertas juntas (a crise por cima da ficha) desenham uma
 * marca só: duas camadas somadas ficariam com o dobro da força.
 */

// Uma busca por pessoa, e não uma por marca. A chave é o id, para a troca de
// conta na mesma aba não herdar o nome de quem saiu.
const perfis = new Map<string, Promise<QuemUsa | null>>();

async function quemEstaLogado(): Promise<QuemUsa | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const usuario = session?.user;
  if (!usuario) return null;
  let busca = perfis.get(usuario.id);
  if (!busca) {
    busca = Promise.resolve(
      supabase.from("perfis").select("nome, crm").eq("id", usuario.id).maybeSingle(),
    ).then(({ data }) => ({ nome: data?.nome || usuario.email || "", crm: data?.crm ?? null }))
      .catch(() => ({ nome: usuario.email || "", crm: null }));
    perfis.set(usuario.id, busca);
  }
  return busca;
}

// As marcas montadas, na ordem em que entraram. Só a primeira desenha.
type Montada = { id: string; naImpressao: boolean };
let montadas: Montada[] = [];
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const ouvir = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export function MarcaDaguaDoUsuario({ naImpressao = false }: { naImpressao?: boolean }) {
  const id = useId();
  const [quem, setQuem] = useState<QuemUsa | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    montadas = [...montadas, { id, naImpressao }];
    avisar();
    return () => { montadas = montadas.filter((m) => m.id !== id); avisar(); };
  }, [id, naImpressao]);
  const desenha = useSyncExternalStore(ouvir, () => montadas[0]?.id === id, () => false);
  const imprime = useSyncExternalStore(ouvir, () => montadas.some((m) => m.naImpressao), () => false);

  useEffect(() => {
    let vivo = true;
    quemEstaLogado().then((q) => { if (vivo) setQuem(q); }, () => {});
    return () => { vivo = false; };
  }, []);

  // A hora anda: o print mostra quando foi tirado. Antes de imprimir, acerta
  // na hora, para o PDF não sair com o minuto em que a tela abriu.
  useEffect(() => {
    const acertar = () => setAgora(new Date());
    const relogio = setInterval(acertar, 60_000);
    window.addEventListener("beforeprint", acertar);
    return () => { clearInterval(relogio); window.removeEventListener("beforeprint", acertar); };
  }, []);

  const ladrilho = useMemo(() => (quem?.nome ? ladrilhoDaMarca(textoDaMarca(quem, agora)) : null), [quem, agora]);
  if (!desenha || !ladrilho) return null;
  return (
    <div className={`marcaDoUsuario${imprime ? " naImpressao" : ""}`} aria-hidden="true" style={{
      ["--marca-do-usuario" as string]: `url("${ladrilho.url}")`,
      ["--marca-do-usuario-tamanho" as string]: `${ladrilho.largura}px ${ladrilho.altura}px`,
    }} />
  );
}
