"use client";

import { useState } from "react";
import Link from "next/link";
import { comDesconto, descreverCupom, normalizarCupom, type Cupom } from "@/lib/pagamentos/cupom";

// Abre o checkout do provedor de pagamento. Vai daqui qual plano se quer, o aceite dos
// documentos e o CÓDIGO do cupom, nunca quanto custa: o preço é decidido e congelado no
// banco, e o desconto é conferido de novo no servidor antes de cobrar.
//
// O botão só acende com a caixa marcada, mas quem recusa de verdade é o
// servidor — a trava da tela é conveniência, não garantia.
export function AssinarButton({
  plano,
  rotulo,
  valorMensal,
}: {
  plano: string;
  rotulo: string;
  /** O preço já calculado pelo servidor, para mostrar quanto o cupom abate. */
  valorMensal: number;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aceite, setAceite] = useState(false);

  // O campo do cupom começa escondido de propósito. Um campo "cupom de
  // desconto" aberto na tela faz quem NÃO tem cupom sair para procurar um — e
  // uma parte dessa gente não volta.
  const [mostrarCupom, setMostrarCupom] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [cupom, setCupom] = useState<Cupom | null>(null);
  const [erroCupom, setErroCupom] = useState("");
  const [conferindo, setConferindo] = useState(false);

  async function conferirCupom() {
    const codigo = normalizarCupom(digitado);
    if (!codigo) return;
    setConferindo(true);
    setErroCupom("");
    try {
      const resposta = await fetch("/api/assinatura/cupom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cupom: codigo }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setCupom(null);
        setErroCupom(dados?.error ?? "Não foi possível conferir o cupom.");
        return;
      }
      // O `id` do cupom no gateway não vem para cá, e não faz falta: o que vai
      // no checkout é o código, e quem procura o cupom é o servidor.
      setCupom({ id: "", ...dados });
    } catch {
      setErroCupom("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setConferindo(false);
    }
  }

  function tirarCupom() {
    setCupom(null);
    setDigitado("");
    setErroCupom("");
  }

  async function assinar() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/assinatura/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, aceite, cupom: cupom?.codigo ?? "" }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok || !dados?.url) {
        setErro(dados?.error ?? "Não foi possível abrir o pagamento agora.");
        setCarregando(false);
        return;
      }
      window.location.href = dados.url;
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <>
      {erro && <p className="clinicalError" role="alert">{erro}</p>}

      {cupom ? (
        <div className="avnCupomAplicado">
          <div>
            <strong>{cupom.codigo}</strong>
            {/* A mesma frase do e-mail de boas-vindas, montada pela mesma
                função: quanto abate, quanto fica e por quanto tempo. */}
            <small>{descreverCupom(valorMensal, cupom)}</small>
          </div>
          <button type="button" onClick={tirarCupom} aria-label={`Tirar o cupom ${cupom.codigo}`}>
            Tirar
          </button>
        </div>
      ) : mostrarCupom ? (
        <div className="avnCupomCampo">
          <input
            value={digitado}
            onChange={(e) => { setDigitado(e.target.value); setErroCupom(""); }}
            // O checkout aceita o código sem ligar para maiúscula, mas ver o
            // que se digita virar maiúscula na hora dá a confirmação de que o
            // campo entendeu.
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void conferirCupom(); } }}
            placeholder="Código do cupom"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Código do cupom"
          />
          <button type="button" onClick={conferirCupom} disabled={conferindo || !normalizarCupom(digitado)}>
            {conferindo ? "Conferindo..." : "Aplicar"}
          </button>
        </div>
      ) : (
        <button type="button" className="avnCupomLink" onClick={() => setMostrarCupom(true)}>
          Tenho um cupom de desconto
        </button>
      )}
      {erroCupom && <p className="clinicalError" role="alert">{erroCupom}</p>}

      <label className="aceiteTermos">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(evento) => { setAceite(evento.target.checked); setErro(""); }}
        />
        <span>
          Li e concordo com os <Link href="/termos" target="_blank">Termos de Uso</Link> e a{" "}
          <Link href="/privacidade" target="_blank">Política de Privacidade</Link>.
        </span>
      </label>
      <button className="avnLoginSubmit" onClick={assinar} disabled={carregando || !aceite}>
        {carregando ? "Abrindo o pagamento..." : rotulo}
      </button>
      {/* Quem aplicou cupom precisa ler o valor final ao lado do botão que
          cobra, e não só lá em cima no resumo do plano. */}
      {cupom && (
        <p className="avnCupomTotal">
          Total com desconto:{" "}
          <strong>
            {comDesconto(valorMensal, cupom).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </strong>
          /mês
        </p>
      )}
    </>
  );
}
