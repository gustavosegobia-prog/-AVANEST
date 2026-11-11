"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/utils/supabase/client";
import { codigoPix, NOME_DO_TIPO, normalizarChave, textoDoPix, type TipoDeChave } from "@/lib/pix";

// O Pix do grupo, no Admin → Dados da organização (migração 202611110002).
//
// É com esta chave que a recepção gera o código Pix da consulta. O nome e a
// cidade aparecem no app do banco de quem paga, por isso vão sem acento e no
// tamanho do padrão (25 e 15 letras). O "Testar" gera um Pix de R$ 1,00 para o
// administrador pagar do próprio celular e conferir que cai na conta certa.

const TIPOS = Object.keys(NOME_DO_TIPO) as TipoDeChave[];

export function PixDaOrganizacao({ podeAdministrar, nomeDaOrganizacao }: { podeAdministrar: boolean; nomeDaOrganizacao: string }) {
  const [tipo, setTipo] = useState<TipoDeChave>("cnpj");
  const [chave, setChave] = useState("");
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [salvo, setSalvo] = useState<{ chave: string; nome: string; cidade: string } | null>(null);
  const [disponivel, setDisponivel] = useState(true);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [teste, setTeste] = useState("");

  useEffect(() => {
    let vivo = true;
    void createClient().rpc("pix_da_organizacao").then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setDisponivel(false); return; }
      const l = (Array.isArray(data) ? data[0] : data) as Record<string, string> | undefined;
      if (l?.chave) {
        setTipo(l.tipo as TipoDeChave); setChave(l.chave); setNome(l.nome); setCidade(l.cidade);
        setSalvo({ chave: l.chave, nome: l.nome, cidade: l.cidade });
      } else {
        setNome(textoDoPix(nomeDaOrganizacao, 25));
      }
    });
    return () => { vivo = false; };
  }, [nomeDaOrganizacao]);

  async function salvar(remover = false) {
    setErro(""); setMsg(""); setTeste("");
    let final = "";
    if (!remover) {
      const n = normalizarChave(tipo, chave);
      if (!n.ok) { setErro(n.erro); return; }
      final = n.chave;
      if (!textoDoPix(nome, 25)) { setErro("Informe o nome de quem recebe."); return; }
      if (!textoDoPix(cidade, 15)) { setErro("Informe a cidade."); return; }
    }
    setSalvando(true);
    const { error } = await createClient().rpc("definir_pix_da_organizacao", {
      p_tipo: remover ? null : tipo, p_chave: remover ? null : final,
      p_nome: remover ? null : textoDoPix(nome, 25), p_cidade: remover ? null : textoDoPix(cidade, 15),
    });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    if (remover) {
      setChave(""); setSalvo(null); setMsg("Pix removido. A recepção não oferece mais “Cobrar por Pix”.");
    } else {
      setChave(final); setNome(textoDoPix(nome, 25)); setCidade(textoDoPix(cidade, 15));
      setSalvo({ chave: final, nome: textoDoPix(nome, 25), cidade: textoDoPix(cidade, 15) });
      setMsg("Pix salvo. A recepção já pode cobrar consultas por Pix.");
    }
  }

  async function testar() {
    if (!salvo) return;
    const codigo = codigoPix({ chave: salvo.chave, nome: salvo.nome, cidade: salvo.cidade, valor: 1, txid: "TESTEAVANEST" });
    setTeste(await QRCode.toDataURL(codigo, { margin: 1, width: 200 }));
  }

  if (!disponivel) return null;

  return (
    <div className="admCartao pixOrg">
      <h3>Pix para cobrar consultas</h3>
      <p className="pixOrgAjuda">A recepção usa esta chave para mandar o Pix da consulta pelo WhatsApp. O nome e a cidade aparecem no banco de quem paga.</p>
      {msg && <p className="financeSuccess" role="status">{msg}</p>}
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
      <div className="orgCampos">
        <label className="clinicalField"><span>Tipo de chave</span>
          <select value={tipo} disabled={!podeAdministrar} onChange={(e) => setTipo(e.target.value as TipoDeChave)}>
            {TIPOS.map((t) => <option key={t} value={t}>{NOME_DO_TIPO[t]}</option>)}
          </select>
        </label>
        <label className="clinicalField"><span>Chave Pix</span>
          <input value={chave} disabled={!podeAdministrar} onChange={(e) => setChave(e.target.value)}
            placeholder={tipo === "celular" ? "(44) 99999-0000" : tipo === "email" ? "financeiro@grupo.com.br" : ""} />
        </label>
        <label className="clinicalField"><span>Nome de quem recebe (até 25)</span>
          <input value={nome} maxLength={25} disabled={!podeAdministrar} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="clinicalField"><span>Cidade (até 15)</span>
          <input value={cidade} maxLength={15} disabled={!podeAdministrar} onChange={(e) => setCidade(e.target.value)} placeholder="Campo Mourao" />
        </label>
      </div>
      {podeAdministrar && (
        <div className="orgAcoes">
          {salvo ? <button type="button" className="outlineClinical" onClick={() => void testar()}>Testar com R$ 1,00</button> : <span />}
          <span className="pixOrgBotoes">
            {salvo && <button type="button" className="outlineClinical" disabled={salvando} onClick={() => void salvar(true)}>Remover</button>}
            <button type="button" className="primaryClinical compact" disabled={salvando} onClick={() => void salvar()}>
              {salvando ? "Salvando…" : "Salvar Pix"}
            </button>
          </span>
        </div>
      )}
      {teste && (
        <div className="pixOrgTeste">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR Code gerado na hora (data:) */}
          <img src={teste} alt="QR Code de teste de R$ 1,00" width={160} height={160} />
          <p>Pague este Pix de <b>R$ 1,00</b> pelo app do seu banco e confira se o nome e a conta estão certos.</p>
        </div>
      )}
    </div>
  );
}
