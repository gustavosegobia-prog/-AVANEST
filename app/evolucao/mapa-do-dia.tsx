"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import {
  cadastroDoMapa, dataBR, doMapaParaAFicha, type CadastroSugerido, type CasoComCadastro,
} from "@/lib/evolucao/mapa-do-dia";
import type { HorarioDaFicha } from "@/lib/evolucao/folha";
import { abrirFicha } from "./abrir-ficha";

const DIA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" });
const CAMPOS_DO_CADASTRO = "id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento";

const hora = (h: string | null) => (h ? h.slice(0, 5) : "A seguir");

/** A avaliação que vai para o topo da ficha, numa linha. */
function LinhaDaAvaliacao({ cadastro }: { cadastro: CadastroSugerido }) {
  const a = cadastro.avaliacao;
  return (
    <span className={`fcPre${a ? "" : " vazia"}`}>
      <Icone nome={a ? "confirmado" : "nota"} tamanho={15} />
      {a
        ? [`Avaliação pré-anestésica${a.rascunho ? " (rascunho)" : ""} de ${DIA.format(new Date(a.em))}`, a.cirurgia].filter(Boolean).join(" · ")
        : "Sem avaliação pré-anestésica: a ficha abre com o que o mapa trouxe"}
    </span>
  );
}

/** O que o cadastro diz de quem é: a data de nascimento, quando há; senão a idade. */
const idadeDoCadastro = (c: CadastroSugerido) =>
  (c.data_nascimento ? `nasc. ${dataBR(c.data_nascimento)}` : c.idade_anos != null ? `${c.idade_anos} anos` : null);

// O mapa cirúrgico de hoje, do hospital da sessão, dentro da caixa de abrir a
// ficha (nova-folha.tsx): sem nada escrito, a lista inteira; com um nome, só
// quem casa (lib/evolucao/entrada.ts). Cada linha é um toque só: abre a ficha
// com o cadastro e a avaliação pré-anestésica, quando não há dúvida de quem é
// (lib/evolucao/mapa-do-dia.ts, principalDoCaso); na dúvida, o toque abre a
// escolha; sem cadastro, cadastra com o que o mapa trouxe e abre. Depois de
// aberta, a linha leva à mesma ficha.
export function MapaDoDia({ institutionId, local, casos, filtrado = false, lerHorario, abrindo, setAbrindo }: {
  institutionId: string;
  local: { id: string; nome: string } | null;
  casos: CasoComCadastro[];
  /** A lista já vem filtrada pelo nome digitado: sem grupos, só quem casa. */
  filtrado?: boolean;
  /** "Agora" (nulo) ou o outro dia e horário escolhido na caixa, conferido na hora do toque. */
  lerHorario: () => HorarioDaFicha | null;
  /** Um toque de cada vez, na caixa inteira (a busca e o mapa). */
  abrindo: string | null;
  setAbrindo: (id: string | null) => void;
}) {
  const router = useRouter();
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const [erro, setErro] = useState<{ caso: string; texto: string } | null>(null);

  if (!casos.length) return null;

  // O paciente do mapa do hospital (outra organização) não se liga: aquele
  // mapa é só leitura (centro_compartilhamentos).
  const ligar = async (casoId: string, fichaId: string) => {
    if (casos.find((c) => c.id === casoId)?.doHospital) return;
    try { await createClient().rpc("ligar_caso_a_ficha", { p_caso: casoId, p_evolucao: fichaId }); } catch { /* a ficha abre igual */ }
  };

  /** O horário da caixa, ou o erro dele na linha do paciente. */
  function horarioOuErro(casoId: string) {
    const h = lerHorario();
    if (h && !h.ok) { setErro({ caso: casoId, texto: h.erro }); return undefined; }
    return h?.ok ? h : null;
  }

  async function abrirCom(caso: CasoComCadastro, cadastro: CadastroSugerido) {
    setErro(null);
    if (cadastro.aberta) {
      setAbrindo(caso.id);
      await ligar(caso.id, cadastro.aberta);
      router.push(`/evolucao/${cadastro.aberta}`);
      return;
    }
    const horario = horarioOuErro(caso.id);
    if (horario === undefined) return;
    setAbrindo(caso.id);
    const r = await abrirFicha({ institutionId, local, paciente: cadastro, horario, doMapa: doMapaParaAFicha(caso) });
    if ("erro" in r) { setErro({ caso: caso.id, texto: r.erro }); setAbrindo(null); return; }
    await ligar(caso.id, r.id);
    router.push(`/evolucao/${r.id}`);
  }

  async function cadastrarEAbrir(caso: CasoComCadastro) {
    setErro(null);
    const horario = horarioOuErro(caso.id);
    if (horario === undefined) return;
    setAbrindo(caso.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("pacientes")
      .insert({ institution_id: institutionId, created_by: user?.id ?? null, ...cadastroDoMapa(caso) })
      .select(CAMPOS_DO_CADASTRO).single();
    if (error || !data) {
      setErro({ caso: caso.id, texto: "Não foi possível cadastrar o paciente. Confira a conexão e tente de novo." });
      setAbrindo(null);
      return;
    }
    const r = await abrirFicha({ institutionId, local, paciente: data as CadastroSugerido, horario, doMapa: doMapaParaAFicha(caso) });
    if ("erro" in r) { setErro({ caso: caso.id, texto: r.erro }); setAbrindo(null); return; }
    await ligar(caso.id, r.id);
    router.push(`/evolucao/${r.id}`);
  }

  const ocupado = abrindo !== null;

  // Uma linha do mapa (uma função, não um componente: o estado é o da lista).
  const caso = (c: CasoComCadastro) => {
    const sobre = [c.idade != null && `${c.idade} anos`, c.nascimento && `nasc. ${dataBR(c.nascimento)}`].filter(Boolean).join(" · ");
    const cirurgia = [c.procedimento, c.cirurgiao, c.convenio].filter(Boolean).join(" · ");
    const escolhaAberta = escolhendo === c.id;
    const p = c.ficha ? null : c.principal;
    const quando = (
      <span className="fcDiaHora">
        <strong className={c.horario ? undefined : "seguir"}>{hora(c.horario)}</strong>
        {c.sala && <span>{c.sala}</span>}
      </span>
    );
    const quem = (
      <span className="fcDiaQuem">
        <span className="fcDiaNome"><strong>{c.paciente}</strong>{sobre && <span>{sobre}</span>}</span>
        {cirurgia && <span className="fcDiaCirurgia">{cirurgia}</span>}
        {!c.meu && c.anestesista && <span className="fcDiaAnest">Anestesista do mapa: {c.anestesista}</span>}
        {c.ficha ? null : p ? (
          <>
            {p.nome !== c.paciente || idadeDoCadastro(p) ? (
              <span className="fcDiaCadastro">Cadastro: {[p.nome, idadeDoCadastro(p)].filter(Boolean).join(" · ")}</span>
            ) : null}
            <LinhaDaAvaliacao cadastro={p} />
          </>
        ) : (
          <span className="fcPre vazia">
            <Icone nome="nota" tamanho={15} />
            {c.sugestoes.length
              ? `${c.sugestoes.length === 1 ? "1 cadastro parecido" : `${c.sugestoes.length} cadastros parecidos`}: confirme quem é`
              : "Sem cadastro: a ficha abre com o que o mapa trouxe"}
          </span>
        )}
      </span>
    );
    const seta = <Icone nome="seta" className="fcSetaDireita" />;

    let linha;
    if (c.ficha) {
      linha = (
        <Link href={`/evolucao/${c.ficha.id}`} className={`fcDiaLinha${c.ficha.status === "encerrada" ? " encerrada" : ""}`}>
          {quando}{quem}
          <span className="fcDiaAcao">
            {c.ficha.status === "aberta" ? <><span className="fcJaAberta">Ficha aberta</span> Continuar</> : <>Ficha encerrada · Ver</>}
            {seta}
          </span>
        </Link>
      );
    } else {
      const acao = abrindo === c.id ? "Abrindo…"
        : p ? (p.aberta ? "Continuar a ficha" : "Abrir ficha")
          : c.sugestoes.length ? (escolhaAberta ? "Fechar" : "Confirmar paciente")
            : "Cadastrar e abrir";
      const tocar = () => {
        if (p) void abrirCom(c, p);
        else if (c.sugestoes.length) setEscolhendo(escolhaAberta ? null : c.id);
        else void cadastrarEAbrir(c);
      };
      linha = (
        <button type="button" className="fcDiaLinha" disabled={ocupado} onClick={tocar}
          aria-expanded={!p && c.sugestoes.length ? escolhaAberta : undefined}>
          {quando}{quem}
          <span className={`fcDiaAcao${p ? " forte" : ""}`}>{acao}{abrindo !== c.id && acao !== "Fechar" && seta}</span>
        </button>
      );
    }

    return (
      <li key={c.id} className="fcDia">
        {linha}
        {p && !c.patientId && !escolhaAberta && (
          <button type="button" className="fcDiaOutro" disabled={ocupado} onClick={() => setEscolhendo(c.id)}>
            Não é este paciente
          </button>
        )}
        {escolhaAberta && !c.ficha && (
          <div className="fcMapaEscolha" role="group" aria-label={`Quem é ${c.paciente}`}>
            <p>{c.sugestoes.length ? "Qual cadastro é o paciente do mapa?" : "Nenhum cadastro parecido."}</p>
            {c.sugestoes.length > 0 && (
              <ul>
                {c.sugestoes.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="fcAchado" disabled={ocupado} onClick={() => void abrirCom(c, s)}>
                      <span className="fcQuem">
                        <strong>{s.nome}</strong>
                        <span>{[idadeDoCadastro(s), s.comparacao.texto].filter(Boolean).join(" · ")}</span>
                      </span>
                      <LinhaDaAvaliacao cadastro={s} />
                      <span className="fcIr">
                        {abrindo === c.id ? "Abrindo…" : <>{s.aberta ? "Continuar" : "É este · Abrir ficha"} {seta}</>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="fcMapaAcoes">
              <button type="button" className="evoBotao secundario" disabled={ocupado} onClick={() => void cadastrarEAbrir(c)}>
                {c.sugestoes.length ? "Nenhum destes: cadastrar e abrir" : "Cadastrar e abrir ficha"}
              </button>
              <button type="button" className="fcMapaOutro" disabled={ocupado} onClick={() => setEscolhendo(null)}>Voltar</button>
            </div>
          </div>
        )}
        {erro?.caso === c.id && <p className="fcErro fcDiaErro" role="alert">{erro.texto}</p>}
      </li>
    );
  };

  const seus = casos.filter((c) => c.meu);
  const outros = casos.filter((c) => !c.meu);
  // Os do anestesista logado em cima, com título, quando há os dois grupos.
  const grupos = filtrado || !seus.length || !outros.length
    ? [{ titulo: null, lista: casos }]
    : [{ titulo: `Seus pacientes`, lista: seus }, { titulo: "Demais do mapa", lista: outros }];
  // De onde vem a lista, quando parte dela é o mapa do centro cirúrgico do hospital.
  const hospitais = [...new Set(casos.map((c) => c.doHospital).filter((h): h is string => Boolean(h)))];

  return (
    <div className="fcGrupo" role="group" aria-labelledby="fc-mapa">
      <h3 id="fc-mapa" className="fcGrupoTitulo">
        {filtrado ? "No mapa de hoje" : "Mapa de hoje"} <span className="fcConta">{casos.length}</span>
      </h3>
      {hospitais.length > 0 && !filtrado && (
        <p className="fcSubgrupo fcOrigem">Do mapa do centro cirúrgico: {hospitais.join(", ")}</p>
      )}
      {grupos.map((g) => (
        <div key={g.titulo ?? "todos"}>
          {g.titulo && <p className="fcSubgrupo">{g.titulo} · {g.lista.length}</p>}
          <ul className="fcDias">
            {g.lista.map(caso)}
          </ul>
        </div>
      ))}
    </div>
  );
}
