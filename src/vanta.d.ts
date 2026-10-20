// Tipado mínimo para Vanta DOTS (sin tipos oficiales en el paquete).
// three se pasa a Vanta solo como referencia (no usamos su API directamente).
declare module "three";

declare module "vanta/dist/vanta.dots.min" {
  interface VantaDotsOptions {
    el: HTMLElement | null;
    THREE: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    backgroundColor?: number;
    size?: number;
    spacing?: number;
    showLines?: boolean;
  }
  interface VantaEffect {
    destroy: () => void;
  }
  const DOTS: (options: VantaDotsOptions) => VantaEffect;
  export default DOTS;
}
