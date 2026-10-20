import { useEffect, useState } from 'react'
import { useRider } from '../RiderContext'
import { riderHistory } from '../lib/riderApi'
import { cop, currentMonthLabel } from './format'
import { CheckCircle2, DoorClosed, TriangleAlert, MapPin } from 'lucide-react'
import type { RiderHistoryItem } from '../types/rider'

const STATUS_COLOR: Record<string, string> = {
  delivered: '#10b981',
  no_answer: '#f59e0b',
  problem: '#ef4444',
}
const STATUS_ICON: Record<string, React.ReactNode> = {
  delivered: <CheckCircle2 size={20} color="#16a34a" strokeWidth={2} />,
  no_answer: <DoorClosed size={20} color="#d97706" strokeWidth={2} />,
  problem: <TriangleAlert size={20} color="#dc2626" strokeWidth={2} />,
}

// /rider/historial — entregas del mes (KPIs + lista), como en rider.html.
export default function RiderHistorial() {
  const { session } = useRider()
  const [items, setItems] = useState<RiderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    riderHistory(session.rider.id)
      .then((data) => {
        if (!cancelled) {
          setItems(data)
          setFailed(false)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  if (!session) return null

  const delivered = items.filter((i) => i.delivery_status === 'delivered')
  const issues = items.filter((i) => i.delivery_status !== 'delivered')
  const total = delivered.reduce((sum, i) => sum + (i.grand_total || 0), 0)

  return (
    <div className="rider-page">
      <div className="rider-section-title">MI HISTORIAL</div>
      <div className="rider-subtitle">{currentMonthLabel()}</div>

      {!loading && (
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-num">{delivered.length}</div>
            <div className="kpi-label">Entregados</div>
          </div>
          <div className="kpi">
            <div className="kpi-num" style={{ fontSize: 14 }}>{cop(total)}</div>
            <div className="kpi-label">Ganancias</div>
          </div>
          <div className="kpi">
            <div className="kpi-num" style={{ color: '#f59e0b' }}>{issues.length}</div>
            <div className="kpi-label">Novedades</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <div className="empty-title">Cargando historial…</div>
        </div>
      )}

      {!loading && failed && (
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <div className="empty-title">Error cargando historial</div>
          <div className="empty-sub">No se pudo conectar con el servidor.</div>
        </div>
      )}

      {!loading && !failed && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">Sin pedidos este mes</div>
          <div className="empty-sub">Las entregas registradas desde tu app aparecerán aquí.</div>
        </div>
      )}

      {!loading && !failed && items.map((o) => {
        const icon = STATUS_ICON[o.delivery_status] || '•'
        const color = STATUS_COLOR[o.delivery_status] || 'var(--muted)'
        const isIssue = o.delivery_status !== 'delivered'
        return (
          <div className="order-card" key={`${o.id}-${o.delivered_at}`}>
            <div className="order-top">
              <div>
                <div className="order-id" style={{ fontSize: 15 }}>Pedido #{o.id}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {o.delivered_at_formatted}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="order-total" style={{ fontSize: 15 }}>{cop(o.grand_total)}</div>
                <div style={{ fontSize: 18 }}>{icon}</div>
              </div>
            </div>
            <div className="order-customer" style={{ margin: '6px 0 2px' }}>{o.customer_name}</div>
            <div className="order-address"><MapPin size={13} className="ic-muted" /><span>{o.delivery_address || 'Sin dirección'}</span></div>
            {o.delivery_notes && (
              <div className="hist-note" style={{ color }}>
                {o.delivery_notes}
              </div>
            )}
            {isIssue && (
              <div className="hist-note" style={{ color }}>
                {o.delivery_status === 'no_answer' ? 'No abrieron la puerta' : 'Se reportó un problema'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
