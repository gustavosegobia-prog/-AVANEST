import type { Metadata } from "next";
import Link from "next/link";
import { exigirAcessoAEvolucao } from "@/lib/evolucao/acesso";
import { NovaFolha } from "./nova-folha";

export const metadata: Metadata = {
  title: "Evolução anestésica | AVANEST",
  robots: { index: false, follow: false },
};

export default async function EvolucoesPage() {
  const { supabase, perfil } = await exigirAcessoAEvolucao();
  const { data: folhas, error } = await supabase
    .from("evolucoes_anestesicas")
    .select("id, status, versao, created_at, dados, pacientes(nome)")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <main className="evoInicio">
      <header className="evoInicioTopo">
        <Link href="/dashboard" className="evoVoltar">← Painel</Link>
        <div>
          <h1>Evolução anestésica</h1>
          <p>Em teste: visível só para o super-admin até ser liberada para todos.</p>
        </div>
      </header>

      <NovaFolha institutionId={perfil.institution_id as string} />

      <section className="evoInicioFolhas" aria-labelledby="evo-recentes">
        <h2 id="evo-recentes">Folhas recentes</h2>
        {error ? (
          <p className="evoFaixa atencao">
            O banco da evolução anestésica ainda não está instalado. Rode a migração
            <code> 202610100004_evolucao_anestesica.sql</code> no Supabase.
          </p>
        ) : !folhas?.length ? (
          <p className="evoVazio">Nenhuma folha ainda. Busque o paciente acima para abrir a primeira.</p>
        ) : (
          <ul>
            {folhas.map((f) => {
              const paciente = (Array.isArray(f.pacientes) ? f.pacientes[0] : f.pacientes) as { nome?: string } | null;
              const dados = (f.dados ?? {}) as Record<string, unknown>;
              return (
                <li key={f.id}>
                  <Link href={`/evolucao/${f.id}`}>
                    <strong>{paciente?.nome ?? "Paciente"}</strong>
                    <span>{String(dados.procedimento || "Procedimento não informado")}</span>
                    <span className="evoInicioData">
                      {new Date(f.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
                      })}
                    </span>
                    <span className={`evoSituacao ${f.status}`}>
                      {f.status === "aberta" ? "Aberta" : `Encerrada · v${f.versao}`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
