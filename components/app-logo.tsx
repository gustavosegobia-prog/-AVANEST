import { BrandMark } from "@/components/brand-mark";

export function AppLogo() {
  return (
    <span className="avnBrand">
      <span className="avnMark"><BrandMark /></span>
      <span><strong><span className="brandBlue">AV</span><span className="brandMidA">A</span><span className="brandTeal">NEST</span></strong><small>AVALIAÇÃO PRÉ-ANESTÉSICA</small></span>
    </span>
  );
}
