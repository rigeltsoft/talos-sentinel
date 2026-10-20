import { CheckCircle2, DoorClosed, TriangleAlert, ArrowLeft, Bike } from 'lucide-react'
import type { RiderDeliveryStatus } from '../types/rider'

// 'picked_up' no es un estado de entrega: es la confirmación de que el domiciliario
// salió con el pedido (preparing → delivering). Usa la misma pantalla de éxito.
export type RiderSuccessKind = RiderDeliveryStatus | 'picked_up'

const ICONS: Record<RiderSuccessKind, React.ReactNode> = {
  picked_up: <Bike size={72} strokeWidth={1.3} color="#2563eb" />,
  delivered: <CheckCircle2 size={72} strokeWidth={1.3} color="#16a34a" />,
  no_answer: <DoorClosed size={72} strokeWidth={1.3} color="#d97706" />,
  problem: <TriangleAlert size={72} strokeWidth={1.3} color="#dc2626" />,
}
const TITLES: Record<RiderSuccessKind, string> = {
  picked_up: '¡En camino!',
  delivered: '¡Entrega registrada!',
  no_answer: 'Reporte enviado',
  problem: 'Problema reportado',
}
const SUBS: Record<RiderSuccessKind, string> = {
  picked_up: 'El cliente fue notificado por WhatsApp. ¡Buen viaje!',
  delivered: 'El cliente fue notificado por WhatsApp',
  no_answer: 'El encargado fue notificado',
  problem: 'El encargado fue notificado del problema',
}

export default function SuccessView({ status, onBack }: { status: RiderSuccessKind; onBack: () => void }) {
  return (
    <div className="rsuccess">
      <div className="rsuccess-icon">{ICONS[status]}</div>
      <div className="rsuccess-title">{TITLES[status]}</div>
      <div className="rsuccess-sub">{SUBS[status]}</div>
      <button className="rbtn rbtn-primary" style={{ padding: '13px 30px', fontSize: 14 }} onClick={onBack}>
        <ArrowLeft size={16} /> Volver a mis pedidos
      </button>
    </div>
  )
}
