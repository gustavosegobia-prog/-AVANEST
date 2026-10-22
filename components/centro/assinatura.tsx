import { BrandMark } from "@/components/brand-mark";
import estilos from "./assinatura.module.css";

/**
 * A assinatura do AVANEST no canto inferior direito do mapa, da TV e do
 * relatório (pedido de 22/10/2026): a marca e "Gestão em Anestesiologia",
 * discreta, sem receber toque — o clique atravessa. A marca d'água do hospital
 * continua no meio; esta diz de quem é o sistema.
 */
export function AssinaturaAvanest({ naTv = false }: { naTv?: boolean }) {
  return (
    <div className={`${estilos.assinatura} ${naTv ? estilos.naTv : ""}`} aria-hidden="true">
      <BrandMark className={estilos.simbolo} gradiente="-assinatura" />
      <span className={estilos.texto}>
        <strong><span className={estilos.av}>AV</span><span className={estilos.a}>A</span><span className={estilos.nest}>NEST</span></strong>
        <small>Gestão em Anestesiologia</small>
      </span>
    </div>
  );
}
