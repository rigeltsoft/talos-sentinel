// Spinner reutilizable (CSS puro, colores del tema). Bajo riesgo: solo reemplaza
// textos de carga y no altera el layout.
interface Props {
  size?: number
  label?: string
  center?: boolean
}

export default function Spinner({ size = 18, label, center = false }: Props) {
  return (
    <span className={`ts-spin-wrap ${center ? 'center' : ''}`}>
      <span className="ts-spinner" style={{ width: size, height: size }} />
      {label && <span>{label}</span>}
    </span>
  )
}
