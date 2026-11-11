"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/utils/supabase/client";
import { Dialogo } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { lerDinheiro } from "@/lib/dinheiro";
import { whatsappDoPaciente } from "@/lib/questionario-pre";
import {
  codigoPix, FORMAS_DE_PAGAMENTO, mensagemDoPix, resumoDoPix, txidDaConsulta,
  type PixDaOrganizacao, type TipoDeChave,
} from "@/lib/pix";

// O pagamento da consulta na agenda da recepção (migração 202611110002).
//
// "Registrar pagamento": quem cobrou na maquininha (cartão ou Pix), em
// dinheiro ou por transferência diz aqui que a consulta foi paga, e o valor
// entra no Financeiro. "Cobrar por Pix": para cobrar à distância, antes da
// consulta, com o código Pix do grupo mandado pelo WhatsApp.

type Consulta = { id: string; patient_id: string };
type Paciente = { id: string; nome: string; telefone: string | null };
export type PixComOrganizacao = PixDaOrganizacao & { organizacao: string };

/**
 * O Pix cadastrado no Admin (nulo quando o grupo ainda não cadastrou), e se o
 * banco já tem a migração 202611110002. Sem ela, a agenda não oferece nada de
 * pagamento: os botões dariam erro.
 */
export function usePixDaOrganizacao(ligado: boolean) {
  const [pix, setPix] = useState<PixComOrganizacao | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    void createClient().rpc("pix_da_organizacao").then(({ data, error }) => {
      if (!vivo) return;
      setPronto(!error);
      if (error) return;
      const linha = (Array.isArray(data) ? data[0] : data) as Record<string, string> | undefined;
      if (linha?.chave) {
        setPix({ tipo: linha.tipo as TipoDeChave, chave: linha.chave, nome: linha.nome, cidade: linha.cidade, organizacao: linha.organizacao });
      }
    });
    return () => { vivo = false; };
  }, [ligado]);
  return { pix, pronto };
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function registrar(consulta: Consulta, valor: number, metodo: string, referencia: string | null) {
  const { error } = await createClient().rpc("receber_consulta", {
    p_agendamento_id: consulta.id, p_valor: valor, p_metodo: metodo, p_referencia: referencia,
  });
  return error ? error.message : "";
}

export type Pagamento = { pago_em: string; pago_valor: number; pago_metodo: string; pago_referencia: string | null };

export function RegistrarPagamento({ consulta, paciente, onFechar, onRegistrou }: {
  consulta: Consulta; paciente: Paciente; onFechar: () => void; onRegistrou: (p: Pagamento) => void;
}) {
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState(FORMAS_DE_PAGAMENTO[0].id);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function confirmar() {
    const v = lerDinheiro(valor);
    if (!v) { setErro("Informe o valor recebido."); return; }
    const f = FORMAS_DE_PAGAMENTO.find((x) => x.id === forma)!;
    setSalvando(true);
    const falha = await registrar(consulta, v, f.metodo, f.referencia ?? null);
    setSalvando(false);
    if (falha) { setErro(falha); return; }
    onRegistrou({ pago_em: new Date().toISOString(), pago_valor: v, pago_metodo: f.metodo, pago_referencia: f.referencia ?? null });
  }

  return (
    <Dialogo titulo="Registrar pagamento" confirmar="Registrar pagamento" confirmando="Registrando…" cancelar="Fechar"
      ocupado={salvando} erro={erro} onCancelar={onFechar} onConfirmar={() => void confirmar()}>
      <p>Consulta de <b>{paciente.nome}</b>. O valor entra no Financeiro como recebido hoje.</p>
      <label className="clinicalField pagValor">
        <span>Valor recebido</span>
        <input inputMode="decimal" placeholder="Ex.: 250,00" value={valor} autoFocus
          onChange={(e) => { setValor(e.target.value); setErro(""); }} />
      </label>
      <fieldset className="pagFormas">
        <legend>Forma de pagamento</legend>
        {FORMAS_DE_PAGAMENTO.map((f) => (
          <label key={f.id} className={forma === f.id ? "ativa" : ""}>
            <input type="radio" name="forma" value={f.id} checked={forma === f.id} onChange={() => setForma(f.id)} />
            {f.rotulo}
          </label>
        ))}
      </fieldset>
      <p className="pagNota">Pix e cartão na maquininha entram aqui: a maquininha confirma o pagamento, e você só registra.</p>
    </Dialogo>
  );
}

export function CobrarPix({ consulta, paciente, pix, onFechar, onRegistrou }: {
  consulta: Consulta; paciente: Paciente; pix: PixComOrganizacao; onFechar: () => void; onRegistrou: (p: Pagamento) => void;
}) {
  const [valorTexto, setValorTexto] = useState("");
  const [qr, setQr] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const valor = lerDinheiro(valorTexto);
  const txid = txidDaConsulta(consulta.id);
  const codigo = valor ? codigoPix({ chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valor, txid }) : "";

  useEffect(() => {
    let vivo = true;
    if (!codigo) return;
    void QRCode.toDataURL(codigo, { margin: 1, width: 220, errorCorrectionLevel: "M" }).then((url) => { if (vivo) setQr(url); });
    return () => { vivo = false; };
  }, [codigo]);

  async function recebido() {
    if (!valor) { setErro("Informe o valor."); return; }
    setSalvando(true);
    const falha = await registrar(consulta, valor, "PIX", txid);
    setSalvando(false);
    if (falha) { setErro(falha); return; }
    onRegistrou({ pago_em: new Date().toISOString(), pago_valor: valor, pago_metodo: "PIX", pago_referencia: txid });
  }

  return (
    <Dialogo titulo="Cobrar por Pix" confirmar="Pix recebido" confirmando="Registrando…" cancelar="Fechar"
      ocupado={salvando} erro={erro} onCancelar={onFechar} onConfirmar={() => void recebido()}>
      <p>Consulta de <b>{paciente.nome}</b>. Mande o Pix pelo WhatsApp e, quando o dinheiro cair na conta, toque em <b>Pix recebido</b>.</p>
      <label className="clinicalField pagValor">
        <span>Valor da consulta</span>
        <input inputMode="decimal" placeholder="Ex.: 250,00" value={valorTexto} autoFocus
          onChange={(e) => { setValorTexto(e.target.value); setErro(""); setCopiado(false); }} />
      </label>
      {codigo ? (
        <div className="pagPix">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR Code gerado na hora (data:) */}
          {qr && codigo && <img src={qr} alt={`QR Code do Pix de ${reais(valor)}`} width={180} height={180} />}
          <div>
            <small>{resumoDoPix(pix, valor)}</small>
            <code>{codigo}</code>
            <div className="pagPixAcoes">
              <button type="button" className="outlineClinical" onClick={() => {
                void navigator.clipboard?.writeText(codigo).then(() => setCopiado(true));
              }}>
                <Icone nome={copiado ? "confirmado" : "copiar"} tamanho={14} /> {copiado ? "Código copiado" : "Copiar código"}
              </button>
              <a className="outlineClinical" target="_blank" rel="noopener"
                href={whatsappDoPaciente(paciente.telefone, mensagemDoPix({ paciente: paciente.nome, organizacao: pix.organizacao, valor }))}>
                <Icone nome="whatsapp" tamanho={14} /> 1. Mandar o valor
              </a>
              <a className="outlineClinical" target="_blank" rel="noopener" href={whatsappDoPaciente(paciente.telefone, codigo)}>
                <Icone nome="whatsapp" tamanho={14} /> 2. Mandar o código Pix
              </a>
            </div>
          </div>
        </div>
      ) : (
        <p className="pagNota">Digite o valor para gerar o QR Code e o código “copia e cola”.</p>
      )}
      <p className="pagNota">O código vai sozinho na segunda mensagem, para o paciente copiar inteiro e colar no app do banco.</p>
    </Dialogo>
  );
}
