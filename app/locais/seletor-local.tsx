"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AppLogo } from "@/components/app-logo";
import { Icone } from "@/components/icone";
import {
  TIPOS_DE_LOCAL,
  nomeDoLocal,
  rotuloDoTipo,
  type LocalDisponivel,
} from "@/lib/local-ativo";

// A escolha do local, logo depois do login.
//
// O que se pede aqui é um toque, não uma leitura: quem abre esta tela está de
// jaleco, muitas vezes no celular, e já sabe onde vai atender. Por isso os
// recentes vêm primeiro e o cartão inteiro é o botão — alvo grande é o que faz
// diferença num iPad segurado com uma mão.

/** Sem acento e sem caixa: quem digita "sao" no celular quer achar "São". */
const normalizar = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function SeletorDeLocal({
  nome,
  locais,
  ativo,
  podeCadastrarCompartilhado,
}: {
  nome: string;
  locais: LocalDisponivel[];
  ativo: string | null;
  podeCadastrarCompartilhado: boolean;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  const [cadastrando, setCadastrando] = useState(false);

  const { recentes, todos } = useMemo(() => {
    const termo = normalizar(busca);
    const visiveis = locais.filter((local) => {
      if (!local.ativo) return false;
      if (!termo) return true;
      return [local.nome, local.nome_fantasia, local.cidade, local.grupo_anestesia]
        .some((campo) => campo && normalizar(campo).includes(termo));
    });
    // Recentes só quando não há busca: procurando, o que se quer é a lista
    // inteira filtrada, e separar em dois blocos esconderia metade do resultado.
    if (termo) return { recentes: [] as LocalDisponivel[], todos: visiveis };
    const usados = visiveis.filter((l) => l.usado_em).slice(0, 3);
    const ids = new Set(usados.map((l) => l.id));
    return { recentes: usados, todos: visiveis.filter((l) => !ids.has(l.id)) };
  }, [locais, busca]);

  async function escolher(id: string) {
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
        setErro(corpo?.error ?? "Não foi possível selecionar este local.");
        setOcupado("");
        return;
      }
      // replace, e não push: voltar para a escolha depois de já ter entrado
      // seria voltar para uma tela que vai redirecionar de novo.
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
      setOcupado("");
    }
  }

  return (
    <main className="localMain">
      <header className="localTopo">
        <AppLogo />
      </header>

      <section className="localCabecalho">
        <h1>Olá, {nome.split(" ").slice(0, 2).join(" ")}!</h1>
        <p>Onde você vai atender hoje?</p>
      </section>

      {erro && <p className="clinicalError localErro">{erro}</p>}

      {locais.length > 3 && (
        <label className="localBusca">
          <Icone nome="busca" tamanho={17} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar instituição"
            aria-label="Buscar instituição"
            autoComplete="off"
          />
        </label>
      )}

      {locais.length === 0 ? (
        <div className="localVazio">
          <strong>Você ainda não tem um local de atendimento cadastrado.</strong>
          <p>
            Cadastre o hospital, a clínica ou o consultório onde você atende. Ele passa a
            sair automaticamente nas fichas, nos termos e nas orientações.
          </p>
          <button className="primaryClinical" onClick={() => setCadastrando(true)}>
            + Cadastrar primeiro local
          </button>
        </div>
      ) : (
        <>
          {recentes.length > 0 && (
            <>
              <h2 className="localSecao">Recentes</h2>
              <ul className="localGrade">
                {recentes.map((local) => (
                  <CartaoLocal
                    key={local.id} local={local} ativo={ativo === local.id}
                    ocupado={ocupado === local.id} onEscolher={escolher}
                  />
                ))}
              </ul>
            </>
          )}

          {todos.length > 0 && (
            <>
              <h2 className="localSecao">
                {recentes.length ? "Meus locais de trabalho" : busca ? "Resultados" : "Meus locais de trabalho"}
              </h2>
              <ul className="localGrade">
                {todos.map((local) => (
                  <CartaoLocal
                    key={local.id} local={local} ativo={ativo === local.id}
                    ocupado={ocupado === local.id} onEscolher={escolher}
                  />
                ))}
              </ul>
            </>
          )}

          {todos.length === 0 && recentes.length === 0 && (
            <div className="emptyClinical">Nenhum local encontrado para “{busca}”.</div>
          )}

          <button className="outlineClinical localNovo" onClick={() => setCadastrando(true)}>
            + Cadastrar local de trabalho
          </button>
        </>
      )}

      {cadastrando && (
        <FormularioDeLocal
          podeCadastrarCompartilhado={podeCadastrarCompartilhado}
          onFechar={() => setCadastrando(false)}
          onSalvo={() => { setCadastrando(false); router.refresh(); }}
        />
      )}
    </main>
  );
}

function CartaoLocal({
  local, ativo, ocupado, onEscolher,
}: {
  local: LocalDisponivel;
  ativo: boolean;
  ocupado: boolean;
  onEscolher: (id: string) => void;
}) {
  const iniciais = nomeDoLocal(local)
    .split(/\s+/).filter((p) => p.length > 2).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "").join("");

  return (
    <li>
      <button
        type="button"
        className={`localCartao${ativo ? " ativo" : ""}`}
        disabled={ocupado}
        onClick={() => onEscolher(local.id)}
      >
        <span className="localMarca" aria-hidden="true">
          {local.logo_url
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={local.logo_url} alt="" />
            : <b>{iniciais || "•"}</b>}
        </span>
        <span className="localTexto">
          <strong>{nomeDoLocal(local)}</strong>
          <small>
            {rotuloDoTipo(local.tipo)}
            {local.cidade ? ` · ${local.cidade}${local.estado ? `/${local.estado}` : ""}` : ""}
          </small>
          {local.grupo_anestesia && <small className="localGrupo">{local.grupo_anestesia}</small>}
        </span>
        {local.particular && <span className="statusChip paused">Particular</span>}
        {ocupado && <span className="localCarregando">entrando…</span>}
      </button>
    </li>
  );
}

/**
 * Cadastro rápido.
 *
 * Só o que é preciso para o local existir e aparecer no documento. Endereço,
 * CNPJ e logos entram na tela de gerenciamento — pedir tudo isso aqui faria a
 * pessoa preencher um formulário longo quando o que ela queria era começar a
 * atender.
 */
function FormularioDeLocal({
  podeCadastrarCompartilhado, onFechar, onSalvo,
}: {
  podeCadastrarCompartilhado: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [form, setForm] = useState({
    nome: "", tipo: "hospital", cidade: "", estado: "", grupo_anestesia: "",
  });
  const [compartilhado, setCompartilhado] = useState(podeCadastrarCompartilhado);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!form.nome.trim()) { setErro("Informe o nome do local."); return; }
    setSalvando(true); setErro("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: perfil } = await supabase
      .from("perfis").select("institution_id").eq("id", user?.id ?? "").maybeSingle();
    if (!perfil) { setErro("Não foi possível identificar sua organização."); setSalvando(false); return; }

    const { error } = await supabase.from("locais_atendimento").insert({
      institution_id: perfil.institution_id,
      // Null é o local do grupo; preenchido é particular. Quem não pode criar
      // compartilhado cria o próprio, e o RLS recusaria o contrário de todo jeito.
      owner_id: compartilhado && podeCadastrarCompartilhado ? null : user?.id,
      nome: form.nome.trim(),
      tipo: form.tipo,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim().toUpperCase() || null,
      grupo_anestesia: form.grupo_anestesia.trim() || null,
      created_by: user?.id ?? null,
    });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505"
        ? "Já existe um local com esse nome."
        : "Não foi possível salvar. Tente de novo.");
      return;
    }
    onSalvo();
  }

  return (
    <div className="patientModalBackdrop" role="presentation">
      <section className="localModal" role="dialog" aria-modal="true" aria-labelledby="novo-local">
        <div className="patientModalHead">
          <div>
            <h2 id="novo-local">Novo local de atendimento</h2>
            <p>O essencial agora. O resto você completa depois, em Admin.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        {erro && <p className="clinicalError">{erro}</p>}

        <form onSubmit={salvar}>
          <div className="localFormGrade">
            <label className="clinicalField wide">
              <span>Nome do local *</span>
              <input
                value={form.nome} autoFocus
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Santa Casa de Misericórdia de Campo Mourão"
              />
            </label>
            <label className="clinicalField">
              <span>Tipo</span>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_DE_LOCAL.map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>{rotulo}</option>
                ))}
              </select>
            </label>
            <label className="clinicalField">
              <span>Cidade</span>
              <input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </label>
            <label className="clinicalField">
              <span>UF</span>
              <input
                value={form.estado} maxLength={2}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                placeholder="PR"
              />
            </label>
            <label className="clinicalField wide">
              <span>Grupo de anestesia</span>
              <input
                value={form.grupo_anestesia}
                onChange={(e) => setForm({ ...form, grupo_anestesia: e.target.value })}
                placeholder="Ex.: Grupo Inovanest"
              />
            </label>
          </div>

          {podeCadastrarCompartilhado && (
            <label className="localCompartilhar">
              <input
                type="checkbox" checked={compartilhado}
                onChange={(e) => setCompartilhado(e.target.checked)}
              />
              <span>
                <strong>Compartilhar com a equipe</strong>
                <small>Todos da organização poderão escolher este local. Desmarque para deixá-lo só seu.</small>
              </span>
            </label>
          )}

          <div className="modalActions">
            <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="primaryClinical compact" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar local"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
