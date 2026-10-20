import { ShoppingBag, MapPin, Navigation, Phone, ChevronRight, Wallet, Smartphone } from 'lucide-react'
import type { RiderOrder } from '../types/rider'
import { cop, mapsHref, telHref } from './format'

interface Props {
  order: RiderOrder
  onOpen: (order: RiderOrder) => void
}

// Tarjeta de pedido activo (UI v2): resumen de productos con iconos del sistema
// (lucide, igual que el dashboard), total + método de pago destacados, dirección
// con enlace directo a Google Maps, y botones Llamar / Ver detalles.
export default function OrderCard({ order, onOpen }: Props) {
  const isCash = order.payment_method === 'Efectivo'
  const total = cop((order.total || 0) + (order.shipping_cost || 0))
  const products = order.products || []
  const phone = telHref(order.customer_phone)
  const maps = mapsHref(order)

  const resumen = products
    .slice(0, 3)
    .map((p) => `${p.cantidad && p.cantidad > 1 ? `${p.cantidad} × ` : ''}${p.nombre}`)
    .join(' · ')
  const ocultos = products.length > 3 ? products.length - 3 : 0

  return (
    <div className="order-card" onClick={() => onOpen(order)}>
      <div className="order-top">
        <div>
          <span className="oc-hash">Pedido #{order.id}</span>
          <div className="order-customer">{order.customer_name}</div>
        </div>
        <div className={`order-total ${isCash ? 'cash' : 'digital'}`}>{total}</div>
      </div>

      {products.length > 0 && (
        <div className="oc-products" title={products.map((p) => `${p.cantidad || 1} × ${p.nombre}`).join('\n')}>
          <span className="ic-line">
            <ShoppingBag size={14} />
            <span>
              {resumen}
              {ocultos > 0 && <span className="oc-more"> +{ocultos} más</span>}
            </span>
          </span>
        </div>
      )}

      <div className="order-address">
        <MapPin size={14} className="ic-muted" />
        <span>{order.delivery_address || 'Dirección no disponible'}</span>
      </div>
      <a
        className="oc-map-link"
        href={maps}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <Navigation size={12} />
        Ver ruta en Google Maps
      </a>

      <div className="order-badges">
        <span className={`obadge ${isCash ? 'obadge-cash' : 'obadge-digital'}`}>
          {isCash ? (
            <span className="ic-line"><Wallet size={12} /> Cobrar en efectivo</span>
          ) : (
            <span className="ic-line"><Smartphone size={12} /> Ya pagó ({order.payment_method})</span>
          )}
        </span>
      </div>

      <div className="order-actions">
        <a
          className="rbtn rbtn-call"
          href={phone}
          onClick={(e) => e.stopPropagation()}
          style={{ textDecoration: 'none' }}
        >
          <Phone size={14} /> Llamar
        </a>
        <button className="rbtn rbtn-primary" onClick={(e) => { e.stopPropagation(); onOpen(order) }}>
          Ver detalles <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
