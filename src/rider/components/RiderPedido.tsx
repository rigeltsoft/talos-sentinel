import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {
  ChevronLeft, CheckCircle2, DoorClosed, TriangleAlert, Wallet, Smartphone,
  User, Phone, MapPin, Map, Bike, Clock, Check, X, Navigation,
} from 'lucide-react'
import { useRider } from '../RiderContext'
import { useRiderData } from '../RiderDataContext'
import { riderDeliver, riderPickup, riderRespond } from '../lib/riderApi'
import EvidenceSheet from './EvidenceSheet'
import SuccessView from './SuccessView'
import type { RiderSuccessKind } from './SuccessView'
import MapaDestino from './MapaDestino'
import { cop, mapsHref, telHref, wazeHref } from './format'
import type { RiderDeliveryStatus } from '../types/rider'

// /rider/pedido/:id — detalle del pedido asignado + registro de la entrega
// (modal de evidencia con estado/foto/nota) y pantalla de éxito.
export default function RiderPedido() {
  const { id } = useParams()
  const orderId = Number(id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useRider()
  const { orders, loading, reload } = useRiderData()

  const [sheetStatus, setSheetStatus] = useState<RiderDeliveryStatus | null>(null)
  const [done, setDone] = useState<RiderDeliveryStatus | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [responding, setResponding] = useState(false)
  const [rejected, setRejected] = useState(false)

  const order = orders.find((o) => o.id === orderId)

  // QA en dev: /rider/pedido/:id?qa=sheet abre el modal de registro automáticamente
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (searchParams.get('qa') !== 'sheet') return
    if (order && !done && !sheetStatus) setSheetStatus('delivered')
  }, [order, done, sheetStatus, searchParams])

  // QA en dev: ?qa=metrics mide si la última tarjeta queda oculta bajo la barra
  // de acciones y lo escribe en el <title> (para validar el scroll en headless)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (searchParams.get('qa') !== 'metrics') return
    const t = setTimeout(() => {
      const actions = document.querySelector<HTMLElement>('.rd-actions')
      const cards = document.querySelectorAll<HTMLElement>('.rd-body .info-card')
      const last = cards[cards.length - 1]
      if (!actions || !last) return
      window.scrollTo(0, document.documentElement.scrollHeight)
      requestAnimationFrame(() => {
        const ar = actions.getBoundingClientRect()
        const lb = last.getBoundingClientRect()
        document.title =
          `metrics|h=${window.innerHeight}|actTop=${Math.round(ar.top)}|pagoBottom=${Math.round(lb.bottom)}` +
          `|pagoTop=${Math.round(lb.top)}|ok=${lb.bottom <= ar.top + 1}`
      })
    }, 2000)
    return () => clearTimeout(t)
  }, [searchParams])

  if (!session) return null // RiderShell ya redirige al login
  const riderId = session.rider.id
  const tenantId = session.rider.tenant_id

  async function handleConfirm(status: RiderDeliveryStatus, photo: string | null, notes: string | null) {
    await riderDeliver({
      order_id: orderId,
      rider_id: riderId,
      tenant_id: tenantId,
      delivery_status: status,
      photo_data: photo,
      notes,
    })
    setDone(status)
    setSheetStatus(null)
    // Refresca la lista para que el pedido entregado desaparezca
    reload()
  }

  function goHome() {
    navigate('/rider/pedidos', { replace: true })
  }

  // El domiciliario confirma que SALIÓ con el pedido: pasa a 'delivering'
  // y el sistema notifica al cliente ("va en camino").
  async function handlePickup() {
    if (syncing) return
    setSyncing(true)
    try {
      await riderPickup(orderId, riderId)
      setDone('picked_up' as unknown as RiderDeliveryStatus)
      reload()
    } catch {
      setSyncing(false)
      window.alert('No se pudo marcar en camino. Revisa tu conexión e inténtalo de nuevo.')
    }
  }

  // El domiciliario acepta el pedido asignado (queda confirmado para él).
  async function handleAccept() {
    if (responding) return
    setResponding(true)
    try {
      await riderRespond(orderId, riderId, 'accept')
      reload()
    } catch {
      window.alert('No se pudo aceptar el pedido. Revisa tu conexión.')
    } finally {
      setResponding(false)
    }
  }

  // Rechaza el pedido: se libera y el encargado lo reasigna.
  async function handleReject() {
    if (responding) return
    if (!window.confirm('¿Rechazar este pedido? Se le avisará al encargado para reasignarlo.')) return
    setResponding(true)
    try {
      await riderRespond(orderId, riderId, 'reject')
      setRejected(true)
      reload()
    } catch {
      window.alert('No se pudo rechazar el pedido. Revisa tu conexión.')
    } finally {
      setResponding(false)
    }
  }

  // Tras una entrega (o al salir con el pedido) se muestra la pantalla de éxito
  if (done) {
    return <SuccessView status={done as unknown as RiderSuccessKind} onBack={goHome} />
  }

  if (rejected) {
    return (
      <div className="rider-page">
        <div className="empty-state">
          <div className="empty-icon-bubble">↩️</div>
          <div className="empty-title">Pedido rechazado</div>
          <div className="empty-sub">El encargado ya puede reasignarlo a otro domiciliario.</div>
        </div>
        <button className="rbtn rbtn-primary" style={{ width: '100%', marginTop: 14 }} onClick={goHome}>
          Volver a mis pedidos
        </button>
      </div>
    )
  }

  // Cargando o pedido no encontrado (p. ej. deep-link a uno ya entregado)
  if (!order) {
    return (
      <div className="rider-page">
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon-bubble">⏳</div>
            <div className="empty-title">Cargando pedido…</div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon-bubble">📭</div>
            <div className="empty-title">Pedido no activo</div>
            <div className="empty-sub">
              Este pedido ya no está asignado (pudo entregarse o reasignarse). Vuelve a tu lista.
            </div>
            <button className="rbtn rbtn-primary" style={{ marginTop: 18 }} onClick={goHome}>
              ← Mis pedidos
            </button>
          </div>
        )}
      </div>
    )
  }

  const isCash = order.payment_method === 'Efectivo'
  const total = cop((order.total || 0) + (order.shipping_cost || 0))
  const shipping = cop(order.shipping_cost || 0)
  const maps = mapsHref(order)
  const waze = wazeHref(order)
  const phone = telHref(order.customer_phone)
  const products = order.products || []

  return (
    <>
      <div className="rd-header">
        <button className="rd-back" onClick={goHome}><ChevronLeft size={15} /> Volver</button>
        <div className="rd-id">Pedido #{order.id}</div>
        <div className="rd-customer">{order.customer_name}</div>
      </div>

      <div className="rd-body">
        {/* Aviso de pago SIEMPRE visible al inicio: qué debe cobrar o no el rider */}
        <div className={`pay-banner ${isCash ? 'cash' : 'digital'}`}>
          <span className="pay-banner-ico">{isCash ? <Wallet size={18} /> : <Smartphone size={18} />}</span>
          <span>
            {isCash ? (
              <>
                Cobra <strong>{total}</strong> en efectivo
                <span className="pay-banner-sub">El cliente paga al recibir · incluye domicilio {shipping}</span>
              </>
            ) : (
              <>
                Ya pagó por <strong>{order.payment_method}</strong>
                <span className="pay-banner-sub">No cobres nada al cliente</span>
              </>
            )}
          </span>
        </div>

        <div className="info-card">
          <div className="info-card-title">Información del cliente</div>
          <div className="info-row">
            <div className="info-icon"><User size={17} /></div>
            <div>
              <div className="info-label">Nombre</div>
              <div className="info-value">{order.customer_name}</div>
            </div>
          </div>
          <div className="info-row">
            <div className="info-icon"><Phone size={17} /></div>
            <div>
              <div className="info-label">Teléfono</div>
              <div className="info-value">
                <a href={phone} style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
                  {order.customer_phone}
                </a>
              </div>
            </div>
          </div>
          <div className="info-row">
            <div className="info-icon"><MapPin size={17} /></div>
            <div>
              <div className="info-label">Dirección</div>
              <div className="info-value">{order.delivery_address || 'No disponible'}</div>
            </div>
          </div>
        </div>

        {/* Lo primero que el domiciliario necesita ver: qué va a entregar */}
        <div className="info-card">
          <div className="info-card-title">🧺 Pedido — {products.length} producto{products.length !== 1 ? 's' : ''}</div>
          {products.map((p, i) => (
            <div className="product-item" key={i}>
              <div>
                <div className="product-name">
                  <span className="product-qty">{p.cantidad && p.cantidad > 1 ? `${p.cantidad} × ` : ''}</span>
                  {p.nombre}
                </div>
                {p.notas && <div className="product-note"><TriangleAlert size={13} /> {p.notas}</div>}
              </div>
              <div className="product-price">{cop((p.precio || 0) * (p.cantidad || 1))}</div>
            </div>
          ))}
          {products.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sin productos detallados</div>
          )}

          {/* Resumen de valores (el método de pago ya se ve arriba en el banner) */}
          <div className="osum">
            {Number(order.shipping_cost || 0) > 0 && (
              <div className="osum-row">
                <span>🛵 Domicilio</span>
                <span>{shipping}</span>
              </div>
            )}
            <div className="osum-row osum-total">
              <span>{isCash ? 'Total a cobrar' : 'Total'}</span>
              <span>{total}</span>
            </div>
            {isCash && <div className="osum-note">El cliente paga en efectivo al recibir el pedido.</div>}
          </div>
        </div>

        <div className="info-card">
          <div className="info-card-title">Destino del pedido</div>
          <MapaDestino lat={order.latitude} lng={order.longitude} address={order.delivery_address} />
        </div>

        <div className="rd-nav-row">
          <a className="rd-maps-btn" href={maps} target="_blank" rel="noreferrer">
            <Navigation size={16} /> Navegar
          </a>
          <a className="rd-maps-btn ghost" href={waze} target="_blank" rel="noreferrer" title="Abrir la ruta en Waze">
            <Map size={16} /> Waze
          </a>
        </div>
      </div>

      {!order.rider_accepted_at ? (
        <div className="rd-actions">
          <div className="rd-actions-title">Nuevo pedido asignado</div>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>
            Confirma si puedes llevarlo. Si rechazas, el encargado lo reasignará a otro domiciliario.
          </p>
          <div className="rd-action-grid">
            <button className="rbtn rbtn-warn" onClick={handleReject} disabled={responding}>
              <X size={15} /> Rechazar
            </button>
            <button className="rbtn rbtn-primary" onClick={handleAccept} disabled={responding}>
              <Check size={15} /> {responding ? '…' : 'Aceptar'}
            </button>
          </div>
        </div>
      ) : order.status === 'preparing' ? (
        <div className="rd-actions">
          <div className="rd-actions-title">El pedido está en cocina</div>
          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>
            <Clock size={13} style={{ verticalAlign: 'middle' }} /> Puedes ir al restaurante. Cuando salgas
            con el pedido, márcalo aquí: el cliente recibe el aviso <strong>“va en camino”</strong>.
          </p>
          <button className="rbtn-delivered-big" disabled={syncing} onClick={handlePickup}>
            <Bike size={18} /> {syncing ? 'Marcando en camino…' : 'Salí con el pedido'}
          </button>
        </div>
      ) : (
        <div className="rd-actions">
          <div className="rd-actions-title">¿Qué ocurrió con este pedido?</div>
          <div className="rd-action-grid">
            <button className="rbtn rbtn-warn" onClick={() => setSheetStatus('no_answer')}>
              <DoorClosed size={15} /> No abrieron
            </button>
            <button className="rbtn rbtn-danger" onClick={() => setSheetStatus('problem')}>
              <TriangleAlert size={15} /> Problema
            </button>
          </div>
          <button className="rbtn-delivered-big" onClick={() => setSheetStatus('delivered')}>
            <CheckCircle2 size={18} /> Marcar como entregado
          </button>
        </div>
      )}

      {sheetStatus && (
        <EvidenceSheet
          order={order}
          defaultStatus={sheetStatus}
          onClose={() => setSheetStatus(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
