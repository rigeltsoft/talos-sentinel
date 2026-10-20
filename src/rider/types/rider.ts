// Tipos de la app del domiciliario (rider) — React.
// Los nombres de campo difieren del dashboard (grand_total, delivery_status…),
// por eso viven en su propio módulo en lugar de src/types/index.ts.

import type { ThemeId } from '@/types'

// ─── Sesión ───

export interface RiderInfo {
  id: number
  name: string
  is_active: boolean
  tenant_id: number
  /** Token firmado que emite /rider/login (identidad del domiciliario). */
  token?: string
}

export interface TenantMeta {
  id: number
  name: string
  theme: ThemeId
}

export interface RiderSession {
  rider: RiderInfo
  tenant: TenantMeta
  savedAt: string
}

// Respuesta de GET /rider/businesses (el workflow devuelve {id, name, theme}).
export interface RiderBusiness {
  id: number
  name: string
  theme?: ThemeId
}

// ─── Pedidos (GET /rider/orders) ───

export interface RiderOrderProduct {
  nombre: string
  precio: number
  cantidad?: number
  notas?: string
}

export interface RiderOrder {
  id: number
  customer_name: string
  customer_phone: string
  delivery_address: string | null
  payment_method: string
  total: number
  shipping_cost: number
  products: RiderOrderProduct[]
  latitude: number | null
  longitude: number | null
  status: string
  // Cuándo el domiciliario aceptó el pedido (null = pendiente de aceptar/rechazar)
  rider_accepted_at?: string | null
}

// ─── Historial (GET /rider/history) ───

export type RiderDeliveryStatus = 'delivered' | 'no_answer' | 'problem'

export interface RiderHistoryItem {
  id: number
  customer_name: string
  delivery_address: string | null
  payment_method: string
  total: number
  shipping_cost: number
  grand_total: number
  delivery_status: RiderDeliveryStatus
  delivery_notes: string | null
  delivered_at: string
  delivered_at_formatted: string
}

// ─── API ───

export interface RiderLoginResult {
  success: boolean
  rider?: RiderInfo
  error?: string
}

export interface RiderDeliverPayload {
  order_id: number
  rider_id: number
  tenant_id: number
  delivery_status: RiderDeliveryStatus
  photo_data?: string | null
  notes?: string | null
}
