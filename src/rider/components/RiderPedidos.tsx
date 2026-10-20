import { useNavigate } from 'react-router'
import { useRiderData } from '../RiderDataContext'
import OrderCard from './OrderCard'
import type { RiderOrder } from '../types/rider'

function SkeletonCard() {
  return (
    <div className="order-card" aria-busy="true">
      <div className="skel skel-line w-40" />
      <div className="skel skel-line w-70" style={{ marginTop: 10 }} />
      <div className="skel skel-line w-90" style={{ marginTop: 6 }} />
      <div className="skel skel-line w-55" style={{ marginTop: 10 }} />
    </div>
  )
}

// /rider/pedidos — pedidos asignados al domiciliario, en dos secciones:
//  · "Por recoger" → status 'preparing'  (ya asignado, todavía en cocina)
//  · "En camino"   → status 'delivering' (ya salió con el pedido)
export default function RiderPedidos() {
  const navigate = useNavigate()
  const { orders, loading, error } = useRiderData()

  const porRecoger = orders.filter((o) => o.status === 'preparing')
  const enCamino = orders.filter((o) => o.status !== 'preparing')

  function openDetail(order: RiderOrder) {
    navigate(`/rider/pedido/${order.id}`)
  }

  return (
    <div className="rider-page">
      <div className="rider-section-title">
        Mis pedidos
        {!loading && orders.length > 0 && <span className="rider-count-pill">{orders.length}</span>}
      </div>
      <div className="rider-subtitle">
        {loading
          ? 'Cargando tus entregas…'
          : orders.length === 0
            ? 'Cuando te asignen un pedido aparecerá aquí en segundos.'
            : 'Toca un pedido para ver el detalle y registrar la entrega.'}
      </div>

      {error && !loading && (
        <p style={{ color: '#ef4444', fontSize: 12.5, margin: '0 0 10px' }}>
          ⚠️ No se pudo actualizar la lista; se reintenta automáticamente.
        </p>
      )}

      {loading && orders.length === 0 && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {!loading && orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon-bubble">🎉</div>
          <div className="empty-title">Todo entregado</div>
          <div className="empty-sub">
            {error
              ? 'No pudimos conectar con el servidor. Verifica tu conexión.'
              : 'No tienes pedidos pendientes. Cuando llegue uno nuevo te llegará una notificación y aparecerá aquí.'}
          </div>
        </div>
      )}

      {porRecoger.length > 0 && (
        <>
          <div className="rider-group-title">
            Por recoger <span className="rider-count-pill">{porRecoger.length}</span>
          </div>
          {porRecoger.map((o) => (
            <OrderCard key={o.id} order={o} onOpen={openDetail} />
          ))}
        </>
      )}

      {enCamino.length > 0 && (
        <>
          <div className="rider-group-title">
            En camino <span className="rider-count-pill">{enCamino.length}</span>
          </div>
          {enCamino.map((o) => (
            <OrderCard key={o.id} order={o} onOpen={openDetail} />
          ))}
        </>
      )}
    </div>
  )
}
