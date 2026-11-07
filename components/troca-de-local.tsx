"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icone } from "@/components/icone";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";

// TROCAR DE HOSPITAL SEM SAIR DA TELA (07/11/2026: "quando clicar, podia abrir
// já embaixo as outras opções, sem necessidade de voltar à página do início").
// O selo do local na barra abre a lista dos hospitais da pessoa logo abaixo; a
// escolha passa pela mesma porta da tela de locais (/api/local, que confere no
// banco se o local é dela) e a página se refaz com o hospital novo, na mesma
// área. A tela inteira de locais continua no fim da lista, para quem tem muitos.
export function TrocaDeLocal({ ativo, locais }: { ativo: LocalDisponivel; locais: LocalDisponivel[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  // O de agora primeiro; depois os usados por último; depois pelo nome.
  const lista = useMemo(() => {
    const outros = locais.filter((l) => l.ativo && l.id !== ativo.id)
      .sort((a, b) => String(b.usado_em ?? "").localeCompare(String(a.usado_em ?? ""))
        || nomeDoLocal(a).localeCompare(nomeDoLocal(b), "pt-BR"));
    return [ativo, ...outros];
  }, [ativo, locais]);

  async function escolher(id: string) {
    if (id === ativo.id) { setAberto(false); return; }
    setErro("");
    setOcupado(id);
    try {
      const resposta = await fetch("/api/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId: id }),
      });
      const corpo = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro(corpo?.error ?? "Não foi possível trocar de local agora.");
        return;
      }
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setOcupado("");
    }
  }

  const onde = (l: LocalDisponivel) => [l.cidade, l.estado].filter(Boolean).join("/");

  return (
    <div className="localTroca">
      <button
        type="button" className="orgBadge localAtivoBadge" aria-haspopup="menu" aria-expanded={aberto}
        title={`Atendendo em ${nomeDoLocal(ativo)}. Clique para trocar.`}
        onClick={() => { setErro(""); setAberto((a) => !a); }}
      >
        <span aria-hidden="true">📍</span>
        <strong>{nomeDoLocal(ativo)}</strong>
        <span className="localSeta" aria-hidden="true">▾</span>
        <span className="visuallyHidden">Trocar local de atendimento</span>
      </button>
      {aberto && (
        <>
          {/* Clique fora fecha, como no menu da conta. */}
          <button type="button" className="userMenuFundo" aria-label="Fechar a lista de locais" onClick={() => setAberto(false)} />
          <div className="userMenuLista localTrocaLista" role="menu" aria-label="Trocar local de atendimento">
            {lista.map((l) => {
              const atual = l.id === ativo.id;
              return (
                <button key={l.id} type="button" role="menuitemradio" aria-checked={atual}
                  className={atual ? "atual" : undefined} disabled={Boolean(ocupado)} onClick={() => void escolher(l.id)}>
                  <span className="localTrocaNome">
                    <strong>{nomeDoLocal(l)}</strong>
                    {onde(l) && <small>{onde(l)}</small>}
                  </span>
                  {ocupado === l.id ? <small className="localTrocaMarca">Trocando…</small>
                    : atual ? <Icone nome="confirmado" tamanho={16} className="localTrocaMarca" /> : null}
                </button>
              );
            })}
            {erro && <p className="localTrocaErro" role="alert">{erro}</p>}
            <hr />
            <Link role="menuitem" href="/locais?trocar=1" onClick={() => setAberto(false)}>
              <Icone nome="predio" /> Ver todos os locais
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
