import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Bike } from 'lucide-react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { StatusBadge, fmt, timeAgo, productsText } from '@/components/dashboard/bits'
import { NEXT_STATUS, STATUS_LABELS, type Order, type OrderStatus } from '@/types'
import { advanceOrder, verifyPayment, assignRider, createRefund } from '@/lib/api'
import InfoTip from '@/components/dashboard/InfoTip'

// Filtros por grupo de estado (llegan desde las tarjetas del Resumen: ?f=…)
const FILTERS = {
  todos: { label: 'Todos', match: () => true },
  activos: {
    label: 'Activos',
    match: (o: Order) => !['delivered', 'cancelled'].includes(o.status),
  },
  verificar: {
    label: 'Por verificar',
    match: (o: Order) => o.status === 'awaiting_verification',
  },
  completados: {
    label: 'Completados',
    match: (o: Order) => ['delivered', 'cancelled'].includes(o.status),
  },
} as const

type FilterKey = keyof typeof FILTERS

export default function Pedidos() {
  const { orders, riders, search, setSearch, biz, reload } = useDashboard()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [params, setParams] = useSearchParams()
  // Fila cuyo selector de asignación de domiciliario está abierto
  const [assignOpen, setAssignOpen] = useState<number | null>(null)

  // ─── Devolución parcial ───
  const [refundOrder, setRefundOrder] = useState<Order | null>(null)
  const [refundQtys, setRefundQtys] = useState<number[]>([])
  const [refundReason, setRefundReason] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)
  const [refundMsg, setRefundMsg] = useState('')

  function openRefund(o: Order) {
    setRefundOrder(o)
    setRefundQtys((o.products || []).map(() => 0))
    setRefundReason('')
    setRefundMsg('')
  }

  const refundAmount = refundOrder
    ? (refundOrder.products || []).reduce(
        (s, p, i) => s + Number(p.precio || 0) * (refundQtys[i] || 0), 0)
    : 0

  async function handleRefund() {
    if (!refundOrder) return
    const items = (refundOrder.products || [])
      .map((p, i) => ({ nombre: p.nombre, cantidad: refundQtys[i] || 0, monto: Number(p.precio || 0) * (refundQtys[i] || 0) }))
      .filter((it) => it.cantidad > 0)
    if (items.length === 0) { setRefundMsg('Selecciona al menos un producto con cantidad'); return }
    setRefundBusy(true); setRefundMsg('')
    try {
      await createRefund(biz, refundOrder.id, items, refundAmount, refundReason)
      setRefundOrder(null)
      reload()
      setMsg('Devolución registrada para facturación')
    } catch {
      setRefundMsg('La API no respondió. Verifica n8n / Cloudflare Access.')
    } finally {
      setRefundBusy(false)
    }
  }

  const rawFilter = params.get('f') ?? 'todos'
  const filter: FilterKey = rawFilter in FILTERS ? (rawFilter as FilterKey) : 'todos'

  const q = search.toLowerCase().trim()
  const visible = orders.filter(
    (o) =>
      FILTERS[filter].match(o) &&
      (!q || [o.customer_name, o.customer_phone, String(o.id), productsText(o.products)]
        .join(' ').toLowerCase().includes(q)),
  )

  async function run(orderId: number, fn: () => Promise<unknown>, okMsg: string) {
    setBusyId(orderId); setMsg('')
    try {
      await fn()
      setMsg(okMsg)
      reload()
    } catch {
      setMsg('La API no respondió. Verifica n8n / Cloudflare Access.')
    } finally {
      setBusyId(null)
    }
  }

  function Actions({ o }: { o: Order }) {
    const busy = busyId === o.id
    if (o.status === 'cancelled') return null
    if (o.status === 'delivered') {
      return (
        <button className="btn sm ghost" onClick={() => openRefund(o)} title="Registrar devolución parcial (para facturación)">
          Devolución
        </button>
      )
    }
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {o.status === 'awaiting_verification' && (
          <>
            <button className="btn sm" disabled={busy}
              onClick={() => run(o.id, () => verifyPayment(biz, o.id, 'approved', 'Comprobante válido'), 'Pago aprobado — cliente notificado por WhatsApp')}>
              Aprobar pago
            </button>
            <button className="btn sm danger" disabled={busy}
              onClick={() => run(o.id, () => verifyPayment(biz, o.id, 'rejected', 'Comprobante ilegible'), 'Pago rechazado — se pidió nuevo comprobante')}>
              Rechazar
            </button>
          </>
        )}
        {NEXT_STATUS[o.status].map((s: OrderStatus) => (
          <button key={s} className={`btn sm ${s === 'cancelled' ? 'danger' : 'ghost'}`} disabled={busy}
            onClick={() => run(o.id, () => advanceOrder(biz, o.id, s), `Pedido → ${STATUS_LABELS[s]}`)}>
            → {STATUS_LABELS[s]}
          </button>
        ))}
        {o.order_type === 'Domicilio' && !o.rider_id && riders.some((r) => r.is_active) && (
          <span className="assign-wrap">
            <button
              type="button"
              className="btn sm ghost"
              disabled={busy}
              onClick={() => setAssignOpen(assignOpen === o.id ? null : o.id)}
            >
              <Bike size={14} /> {assignOpen === o.id ? 'Cancelar' : 'Asignar domiciliario'}
            </button>
            {assignOpen === o.id && (
              <span className="assign-list">
                {riders.filter((r) => r.is_active).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() => {
                      setAssignOpen(null)
                      run(
                        o.id,
                        () => assignRider(biz, o.id, r.id),
                        `Domiciliario "${r.name}" asignado — push FCM enviado`,
                      )
                    }}
                  >
                    {r.name} ({r.active_orders} en ruta)
                  </button>
                ))}
              </span>
            )}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="details full">
      <div className="panel">
        {/* Encabezado + filtros fijos mientras la lista de pedidos hace scroll */}
        <div style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, paddingBottom: 6 }}>
          <div className="cardHeader">
            <h2>
              Pedidos ({visible.length})
              <InfoTip text="Pedidos recibidos por WhatsApp. Avanza cada pedido con los botones según su estado (confirmar, preparando, en camino, entregado). El botón Actualizar recarga la lista cada vez que quieras." />
            </h2>
            <button className="btn" onClick={reload}>Actualizar</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <InfoTip text="Todos: todos los pedidos. Activos: pendientes por atender. Por verificar: pagos digitales esperando aprobación del comprobante. Completados: entregados o cancelados." />
            </span>
            {(Object.keys(FILTERS) as FilterKey[]).map((k) => (
              <button
                key={k}
                className={`btn sm ${filter === k ? '' : 'ghost'}`}
                onClick={() => setParams(k === 'todos' ? {} : { f: k })}
              >
                {FILTERS[k].label}
              </button>
            ))}
            {q && (
              <button className="btn sm ghost" onClick={() => setSearch('')}>
                ✕ Limpiar búsqueda “{search}”
              </button>
            )}
          </div>
        </div>
        {msg && <p className="muted" style={{ margin: '8px 0 0' }}>{msg}</p>}
        <table>
          <thead>
            <tr>
              <td>Pedido</td>
              <td>Cliente</td>
              <td>Productos</td>
              <td>Entrega</td>
              <td style={{ textAlign: 'end' }}>Total</td>
              <td style={{ textAlign: 'center' }}>Pago</td>
              <td style={{ textAlign: 'center' }}>Estado</td>
              <td>Acciones</td>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>#{o.id}</strong>
                  <br /><span className="muted">{timeAgo(o.created_at)}</span>
                </td>
                <td>
                  {o.customer_name}
                  <br /><span className="muted">{o.customer_phone}</span>
                </td>
                <td>{productsText(o.products)}</td>
                <td>
                  {o.order_type}
                  {o.delivery_address && <><br /><span className="muted">{o.delivery_address}</span></>}
                  {o.rider_name && <><br /><span className="muted">Domiciliario: {o.rider_name}</span></>}
                </td>
                <td style={{ textAlign: 'end' }}>{fmt(Number(o.total || 0) + Number(o.shipping_cost || 0))}</td>
                <td style={{ textAlign: 'center' }}>{o.payment_method}</td>
                <td style={{ textAlign: 'center' }}><StatusBadge status={o.status} /></td>
                <td><Actions o={o} /></td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center' }}><span className="muted">Sin pedidos que coincidan</span></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Modal: Devolución parcial ─── */}
      {refundOrder && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(10,16,35,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => !refundBusy && setRefundOrder(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,.4)',
            maxWidth: 520, width: '100%', padding: 24, maxHeight: '90vh', overflowY: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>
              ↩️ Devolución parcial — Pedido #{refundOrder.id}
            </h3>
            <p className="muted" style={{ margin: '0 0 14px' }}>
              {refundOrder.customer_name} · {fmt(Number(refundOrder.total || 0) + Number(refundOrder.shipping_cost || 0))}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <td style={{ fontWeight: 600, padding: '4px 6px' }}>Producto</td>
                  <td style={{ fontWeight: 600, padding: '4px 6px', textAlign: 'center' }}>Devuelve</td>
                  <td style={{ fontWeight: 600, padding: '4px 6px', textAlign: 'end' }}>Monto</td>
                </tr>
              </thead>
              <tbody>
                {(refundOrder.products || []).map((p, i) => {
                  const max = p.cantidad && p.cantidad > 0 ? p.cantidad : 1
                  return (
                    <tr key={i}>
                      <td style={{ padding: '6px', fontSize: 13 }}>{p.nombre}</td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>
                        <input
                          type="number" min={0} max={max}
                          value={refundQtys[i] || 0}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(max, Number(e.target.value) || 0))
                            setRefundQtys((prev) => prev.map((q, j) => (j === i ? v : q)))
                          }}
                          style={{ width: 64, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 13 }}
                        />
                      </td>
                      <td style={{ padding: '6px', textAlign: 'end', fontSize: 13 }}>
                        {fmt(Number(p.precio || 0) * (refundQtys[i] || 0))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
              <span className="muted">Total a devolver</span>
              <strong style={{ fontSize: 16 }}>{fmt(refundAmount)}</strong>
            </div>
            <div className="field">
              <label>Motivo de la devolución</label>
              <textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Ej: el cliente no pidió el jugo de mora…" style={{ fontFamily: 'inherit', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--line)', width: '100%', background: 'var(--bg)', color: 'var(--ink)' }} />
            </div>
            {refundMsg && <p style={{ margin: '8px 0 0', fontSize: 13, color: '#e11d48' }}>⚠️ {refundMsg}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setRefundOrder(null)} disabled={refundBusy}>Cancelar</button>
              <button className="btn" onClick={handleRefund} disabled={refundBusy || refundAmount <= 0}>
                {refundBusy ? 'Registrando…' : 'Registrar devolución'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
