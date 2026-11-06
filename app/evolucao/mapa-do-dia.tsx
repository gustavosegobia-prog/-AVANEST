"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import {
  cadastroDoMapa, dataBR, doMapaParaAFicha, type CadastroSugerido, type CasoComCadastro,
} from "@/lib/evolucao/mapa-do-dia";
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

// O mapa cirúrgico de hoje, do hospital da sessão, no topo da ficha
// anestésica (lib/evolucao/mapa-do-dia.ts). Cada linha já traz o cadastro e a
// avaliação pré-anestésica, quando não há dúvida de quem é: o toque abre a
// ficha com eles. Na dúvida, o anestesista escolhe — ou cadastra um novo com o
// que o mapa trouxe. Depois de aberta, a linha leva à mesma ficha.
export function MapaDoDia({ institutionId, local, casos }: {
  institutionId: string;
  local: { id: string; nome: string } | null;
  casos: CasoComCadastro[];
}) {
  const router = useRouter();
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState<{ caso: string; texto: string } | null>(null);

  const ligar = async (casoId: string, fichaId: string) => {
    try { await createClient().rpc("ligar_caso_a_ficha", { p_caso: casoId, p_evolucao: fichaId }); } catch { /* a ficha abre igual */ }
  };

  async function abrirCom(caso: CasoComCadastro, cadastro: CadastroSugerido) {
    setErro(null);
    setAbrindo(caso.id);
    if (cadastro.aberta) {
      await ligar(caso.id, cadastro.aberta);
      router.push(`/evolucao/${cadastro.aberta}`);
      return;
    }
    const r = await abrirFicha({ institutionId, local, paciente: cadastro, doMapa: doMapaParaAFicha(caso) });
    if ("erro" in r) { setErro({ caso: caso.id, texto: r.erro }); setAbrindo(null); return; }
    await ligar(caso.id, r.id);
    router.push(`/evolucao/${r.id}`);
  }

  async function cadastrarEAbrir(caso: CasoComCadastro) {
    setErro(null);
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
    const r = await abrirFicha({ institutionId, local, paciente: data as CadastroSugerido, doMapa: doMapaParaAFicha(caso) });
    if ("erro" in r) { setErro({ caso: caso.id, texto: r.erro }); setAbrindo(null); return; }
    await ligar(caso.id, r.id);
    router.push(`/evolucao/${r.id}`);
  }

  const seus = casos.filter((c) => c.meu).length;

  return (
    <section className="fcMapa" aria-labelledby="fc-mapa">
      <h2 id="fc-mapa">
        Mapa de hoje{local ? ` · ${local.nome}` : ""} <span className="fcConta">{casos.length}</span>
      </h2>
      <p className="fcMapaDica">
        {seus ? `${seus === 1 ? "O seu paciente vem" : `Os seus ${seus} pacientes vêm`} primeiro. ` : ""}
        Toque para abrir a ficha: a avaliação pré-anestésica, quando houver, já vem no topo.
      </p>
      <ul className="fcMapaLista">
        {casos.map((c) => {
          const ocupado = abrindo !== null;
          const sobre = [c.idade != null && `${c.idade} anos`, c.nascimento && `nasc. ${dataBR(c.nascimento)}`, c.procedimento, c.cirurgiao, c.convenio].filter(Boolean).join(" · ");
          const aberto = escolhendo === c.id;
          return (
            <li key={c.id} className={`fcMapaCaso${c.meu ? " meu" : ""}`}>
              <div className="fcMapaTopo">
                <span className="fcMapaQuando">{hora(c.horario)}{c.sala ? ` · ${c.sala}` : ""}</span>
                {c.meu ? <span className="fcMapaSeu">Seu</span> : c.anestesista && <span className="fcMapaAnest">{c.anestesista}</span>}
              </div>
              <span className="fcQuem">
                <strong>{c.paciente}</strong>
                {sobre && <span>{sobre}</span>}
              </span>

              {c.ficha ? (
                <Link href={`/evolucao/${c.ficha.id}`} className="fcMapaIr">
                  {c.ficha.status === "aberta"
                    ? <><span className="fcJaAberta">Ficha aberta</span> Continuar</>
                    : <>Ficha encerrada · Ver</>}
                  <Icone nome="seta" className="fcSetaDireita" />
                </Link>
              ) : c.principal && !aberto ? (
                <>
                  {c.principal.nome !== c.paciente || idadeDoCadastro(c.principal) ? (
                    <span className="fcMapaCadastro">
                      Cadastro: {[c.principal.nome, idadeDoCadastro(c.principal)].filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                  <LinhaDaAvaliacao cadastro={c.principal} />
                  <div className="fcMapaAcoes">
                    <button type="button" className="evoBotao" disabled={ocupado} onClick={() => void abrirCom(c, c.principal!)}>
                      {abrindo === c.id ? "Abrindo…" : c.principal.aberta ? "Continuar a ficha" : "Abrir ficha"}
                    </button>
                    {!c.patientId && (
                      <button type="button" className="fcMapaOutro" disabled={ocupado} onClick={() => setEscolhendo(c.id)}>
                        Não é este paciente
                      </button>
                    )}
                  </div>
                </>
              ) : !aberto ? (
                <>
                  <span className="fcPre vazia">
                    <Icone nome="nota" tamanho={15} />
                    {c.sugestoes.length
                      ? `${c.sugestoes.length === 1 ? "1 cadastro parecido" : `${c.sugestoes.length} cadastros parecidos`}: confirme quem é`
                      : "Sem cadastro: a ficha abre com o que o mapa trouxe"}
                  </span>
                  <div className="fcMapaAcoes">
                    {c.sugestoes.length ? (
                      <button type="button" className="evoBotao" disabled={ocupado} onClick={() => setEscolhendo(c.id)}>
                        Confirmar o paciente
                      </button>
                    ) : (
                      <button type="button" className="evoBotao" disabled={ocupado} onClick={() => void cadastrarEAbrir(c)}>
                        {abrindo === c.id ? "Abrindo…" : "Cadastrar e abrir ficha"}
                      </button>
                    )}
                  </div>
                </>
              ) : null}

              {aberto && !c.ficha && (
                <div className="fcMapaEscolha" role="group" aria-label={`Quem é ${c.paciente}`}>
                  <p>Qual cadastro é o paciente do mapa?</p>
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
                            {abrindo === c.id ? "Abrindo…" : <>{s.aberta ? "Continuar" : "É este · Abrir ficha"} <Icone nome="seta" className="fcSetaDireita" /></>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="fcMapaAcoes">
                    <button type="button" className="evoBotao secundario" disabled={ocupado} onClick={() => void cadastrarEAbrir(c)}>
                      {c.sugestoes.length ? "Nenhum destes: cadastrar e abrir" : "Cadastrar e abrir ficha"}
                    </button>
                    <button type="button" className="fcMapaOutro" disabled={ocupado} onClick={() => setEscolhendo(null)}>Voltar</button>
                  </div>
                </div>
              )}
              {erro?.caso === c.id && <p className="fcErro" role="alert">{erro.texto}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
