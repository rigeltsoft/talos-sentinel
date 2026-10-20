import { STATUS_LABELS, type OrderStatus } from '@/types'

export const fmt = (n: number) => '$' + Number(n).toLocaleString('es-CO')

export function timeAgo(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h ${m % 60}m`
  return new Date(iso).toLocaleDateString('es-CO')
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status ${status}`}>{STATUS_LABELS[status]}</span>
}

export function productsText(products: { nombre: string }[]) {
  return products.map((p) => p.nombre).join(', ')
}
