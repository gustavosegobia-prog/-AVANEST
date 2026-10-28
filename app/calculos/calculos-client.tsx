"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import estilos from "./calculos.module.css";
import { type Compartilhado } from "./modulos-extras";
import { Doses } from "./modulo-doses";
import { MarcaDaguaDoUsuario } from "@/components/marca-dagua-do-usuario";

// A aba é só a calculadora de doses: o que o manejo de crises usa. As outras
// calculadoras (gasometria, eletrólitos, gap osmolar, débito cardíaco, PCA e
// ROTEM) saíram — nenhum protocolo dependia delas.

export function CalculosClient() {
  /** Idade, peso, altura e sexo: ficam na tela, editáveis, e não vão para o prontuário. */
  const [dados, setDados] = useState<Compartilhado>({});
  const set = (chave: string, valor: string) => setDados((d) => ({ ...d, [chave]: valor }));

  return (
    <main className={estilos.tela}>
      <header className={estilos.topo}>
        <Link className={estilos.marca} href="/dashboard">
          <BrandMark className={estilos.marcaIcone} />
          <span><strong>AVANEST</strong><small>Calculadora de doses</small></span>
        </Link>
        <Link className={estilos.voltar} href="/dashboard">← Voltar ao painel</Link>
      </header>

      <div className={estilos.conteudo}>
        <Doses dados={dados} set={set} />
      </div>
      <MarcaDaguaDoUsuario naImpressao />
    </main>
  );
}
