import type { Metadata } from "next";
import Link from "next/link";
import { paginaPublica } from "@/lib/metadados";
import { comoJson, migalhas } from "@/lib/schema";
import { AppLogo } from "@/components/app-logo";
import { RodapePublico } from "@/components/rodape-publico";
import { ENCARREGADO, MEDIDAS_DE_SEGURANCA } from "@/lib/seguranca";

// A SEGURANÇA DOS DADOS, EM UMA PÁGINA.
//
// Quem lê esta página é o hospital, a cooperativa ou o grupo que precisa
// responder, antes de contratar, à pergunta "onde ficam os dados dos nossos
// pacientes e quem pode vê-los?" — muitas vezes alguém de TI ou do jurídico,
// e não o anestesiologista. A página não vende: resume.
//
// Nada aqui é escrito à mão. As medidas e o encarregado saem de
// lib/seguranca.ts, a mesma lista da Política de Privacidade e do /recursos.
// Promessa que só esta página fizesse seria, para quem a lê, a promessa do
// contrato.

const CAMINHO = "/seguranca";
const TRILHA = [{ nome: "Início", caminho: "/" }, { nome: "Segurança dos dados", caminho: CAMINHO }];

export const metadata: Metadata = paginaPublica({
  titulo: "Segurança dos dados para hospitais e cooperativas | AVANEST",
  descricao: "Como o AVANEST protege os dados dos pacientes: isolamento por organização no banco, "
    + "perfis de acesso, auditoria, HTTPS, cifragem em repouso, backup e DPO.",
  caminho: CAMINHO,
});

const WHATSAPP = "https://wa.me/5541997870810?text="
  + encodeURIComponent("Olá! Quero conversar sobre a segurança dos dados do AVANEST para a minha instituição.");

export default function SegurancaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(migalhas(TRILHA)) }}
      />
      <main className="avnLanding">
        <header className="avnNav">
          <Link href="/" aria-label="AVANEST"><AppLogo /></Link>
          <nav aria-label="Principal">
            <a className="avnLogin" href="/recursos">
              <span className="avnSoLargo">O que o sistema faz</span>
              <span className="avnSoEstreito">Recursos</span>
            </a>
            <a className="avnPrimary" href="/planos">Ver planos</a>
          </nav>
        </header>

        <section className="recHero">
          <p className="avnEyebrow">SEGURANÇA DOS DADOS</p>
          <h1>Como o AVANEST protege os dados dos pacientes</h1>
          <p className="avnLead">
            Um resumo para hospitais, cooperativas e grupos de anestesia: como os dados ficam
            separados entre as organizações, quem pode ver o quê e o que fica registrado.
          </p>
        </section>

        <section className="recBloco" aria-labelledby="seg-medidas">
          <h2 id="seg-medidas">O que protege os dados</h2>
          <div className="recGrade">
            {MEDIDAS_DE_SEGURANCA.map((m) => (
              <article key={m.id} id={m.id}>
                <h3>{m.titulo}</h3>
                <p>{m.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="recBloco" aria-labelledby="seg-dpo">
          <h2 id="seg-dpo">Encarregado de dados (DPO)</h2>
          <p>
            Encargo exercido por {ENCARREGADO.quem}, CNPJ {ENCARREGADO.cnpj}. Contato para assuntos de
            proteção de dados: <a href={`mailto:${ENCARREGADO.email}`}>{ENCARREGADO.email}</a>.
          </p>
        </section>

        <section className="recBloco" aria-labelledby="seg-documentos">
          <h2 id="seg-documentos">Os documentos completos</h2>
          <p>
            A <Link href="/privacidade">Política de Privacidade</Link> traz o restante: quem é
            controlador e quem é operador, onde os dados ficam, por quanto tempo e os direitos dos
            titulares. As condições do serviço estão nos <Link href="/termos">Termos de Uso</Link>.
          </p>
        </section>

        <section className="recFim">
          <h2>Precisa de mais detalhes para a sua instituição?</h2>
          <p>Fale com a gente pelo WhatsApp ou pelo e-mail {ENCARREGADO.email}.</p>
          <div className="avnActions">
            <a className="avnPrimary" href={WHATSAPP} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
            <a className="avnSecondary" href="/planos">Ver planos</a>
          </div>
        </section>

        <RodapePublico />
      </main>
    </>
  );
}
