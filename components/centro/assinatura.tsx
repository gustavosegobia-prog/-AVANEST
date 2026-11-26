import { BrandMark } from "@/components/brand-mark";
import estilos from "./assinatura.module.css";

/**
 * A assinatura do AVANEST no canto inferior direito do Modo TV: a marca e
 * "Gestão em Anestesiologia", discreta, sem receber toque. A marca d'água do
 * hospital continua no meio; esta diz de quem é o sistema.
 *
 * Desde 26/11/2026 ela aparece SÓ na TV: no mapa do celular ela flutuava por
 * cima dos cartões. E a frase termina junto com o nome, como no site.
 */
export function AssinaturaAvanest() {
  return (
    <div className={estilos.assinatura} aria-hidden="true">
      <BrandMark className={estilos.simbolo} gradiente="-assinatura" />
      <span className={estilos.texto}>
        <strong><span className={estilos.av}>AV</span><span className={estilos.a}>A</span><span className={estilos.nest}>NEST</span></strong>
        <small>Gestão em Anestesiologia</small>
      </span>
    </div>
  );
}
