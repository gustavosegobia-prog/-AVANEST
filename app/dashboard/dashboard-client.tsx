"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppLogo } from "@/components/app-logo";

type Perfil = { id: string; institution_id: string; nome: string; role: string; must_reset: boolean };
type Paciente = { id: string; nome: string; cpf: string | null; data_nascimento: string | null; telefone: string | null; email: string | null; created_at: string };
type Avaliacao = { id: string; patient_id: string; status: string; updated_at: string; created_at: string };

export function DashboardClient({ perfil, pacientes, avaliacoes }: { perfil: Perfil; pacientes: Paciente[]; avaliacoes: Avaliacao[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = useMemo(() => pacientes.filter((p) => `${p.nome} ${p.cpf ?? ""}`.toLowerCase().includes(search.toLowerCase())), [pacientes, search]);
  const currentByPatient = new Map(avaliacoes.map((a) => [a.patient_id, a]));

  async function createPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const fd = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("pacientes").insert({
      institution_id: perfil.institution_id,
      nome: String(fd.get("nome") ?? ""),
      cpf: String(fd.get("cpf") ?? "") || null,
      data_nascimento: String(fd.get("data_nascimento") ?? "") || null,
      telefone: String(fd.get("telefone") ?? "") || null,
      email: String(fd.get("email") ?? "") || null,
      created_by: perfil.id,
    });
    if (insertError) { setError(`Não foi possível salvar: ${insertError.message}`); setBusy(false); return; }
    setOpen(false); router.refresh();
  }

  async function openAssessment(patientId: string) {
    const existing = currentByPatient.get(patientId);
    if (existing && existing.status === "rascunho") {
      router.push(`/avaliacoes/${existing.id}`); return;
    }
    setBusy(true); setError("");
    const supabase = createClient();
    const { data, error: createError } = await supabase.from("avaliacoes").insert({
      institution_id: perfil.institution_id,
      patient_id: patientId,
      created_by: perfil.id,
      status: "rascunho",
    }).select("id").single();
    if (createError || !data) { setError(createError?.message ?? "Falha ao iniciar avaliação."); setBusy(false); return; }
    router.push(`/avaliacoes/${data.id}`);
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login"); router.refresh();
  }

  return (
    <main className="avnShell">
      <header className="avnTopbar">
        <AppLogo />
        <div className="avnTopbarMeta"><span>{perfil.nome}</span><span className="avnRole">{perfil.role}</span><button className="avnButton secondary" onClick={logout}>Sair</button></div>
      </header>
      <div className="avnMain">
        <section className="avnWelcome">
          <div><h1>Olá, {perfil.nome.split(" ")[0]}.</h1><p>Organize pacientes e avaliações pré-anestésicas em um único fluxo.</p></div>
          <button className="avnButton" onClick={() => setOpen(true)}>+ Novo paciente</button>
        </section>
        {perfil.must_reset && <p className="avnError">Por segurança, configure a troca de senha inicial antes do uso clínico.</p>}
        {error && <p className="avnError">{error}</p>}
        <section className="avnStats">
          <div className="avnStat"><small>Pacientes</small><strong>{pacientes.length}</strong></div>
          <div className="avnStat"><small>Em andamento</small><strong>{avaliacoes.filter(a => a.status === "rascunho").length}</strong></div>
          <div className="avnStat"><small>Concluídas</small><strong>{avaliacoes.filter(a => a.status === "concluida").length}</strong></div>
          <div className="avnStat"><small>Alertas</small><strong>0</strong></div>
        </section>
        <section className="avnPanel">
          <div className="avnPanelHead"><h2>Pacientes</h2><input className="avnSearch" placeholder="Buscar por nome ou CPF" value={search} onChange={e => setSearch(e.target.value)} /></div>
          {filtered.length ? (
            <table className="avnTable"><thead><tr><th>Paciente</th><th>Nascimento</th><th>Contato</th><th>Situação</th><th></th></tr></thead>
              <tbody>{filtered.map(p => { const a=currentByPatient.get(p.id); return <tr key={p.id}><td><strong>{p.nome}</strong><br/><small>{p.cpf || "CPF não informado"}</small></td><td>{p.data_nascimento ? new Date(`${p.data_nascimento}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td><td>{p.telefone || p.email || "—"}</td><td><span className="avnStatus">{a?.status ?? "sem avaliação"}</span></td><td><button className="avnButton" disabled={busy} onClick={() => openAssessment(p.id)}>{a?.status === "rascunho" ? "Continuar" : "Iniciar avaliação"}</button></td></tr> })}</tbody>
            </table>
          ) : <div className="avnEmpty">Nenhum paciente encontrado.</div>}
        </section>
      </div>
      {open && <div className="avnModalBackdrop"><form className="avnModal" onSubmit={createPatient}><div className="avnModalHead"><h2>Novo paciente</h2><button type="button" className="avnClose" onClick={() => setOpen(false)}>×</button></div>
        <div className="avnFormGrid"><div className="avnField full"><label>Nome completo *</label><input name="nome" required /></div><div className="avnField"><label>CPF</label><input name="cpf" /></div><div className="avnField"><label>Data de nascimento</label><input name="data_nascimento" type="date" /></div><div className="avnField"><label>Telefone</label><input name="telefone" /></div><div className="avnField"><label>E-mail</label><input name="email" type="email" /></div></div>
        {error && <p className="avnError">{error}</p>}<div className="avnActionsRow"><button type="button" className="avnButton secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="avnButton" disabled={busy}>{busy ? "Salvando..." : "Salvar paciente"}</button></div>
      </form></div>}
    </main>
  );
}
