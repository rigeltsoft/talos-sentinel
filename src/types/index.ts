// Tipos del dominio Talos Sentinel (multi-negocio)

export type BusinessType = 'restaurante' | 'farmacia' | 'negocio'
export type ThemeId = 'purpura' | 'oscuro' | 'talos' | 'calido'

export interface BizConfig {
  id: number
  name: string
  type: BusinessType
  theme: ThemeId
  phoneNumberId: string | null
  apiBase: string
  liveMode: boolean
  //  Modulos de Chatwoot (el token de API vive en el proxy n8n)
  chatwootBaseUrl?: string
  chatwootAccountId?: number
  chatwootInboxId?: number
  promoTemplate?: string | null
}

export type OrderStatus =
  | 'pending'
  | 'awaiting_verification'
  | 'confirmed'
  | 'preparing'
  | 'ready_pickup'
  | 'delivering'
  | 'delivered'
  | 'cancelled'

export interface OrderProduct {
  nombre: string
  precio: number
  cantidad?: number
  categoria?: string
  notas?: string
}

export interface Order {
  id: number
  customer_name: string
  customer_phone: string
  order_type: 'Domicilio' | 'Recoger'
  products: OrderProduct[]
  total: number
  shipping_cost: number
  delivery_address: string | null
  latitude: number | null
  longitude: number | null
  payment_method: string
  status: OrderStatus
  rider_id: number | null
  rider_name?: string | null
  created_at: string
  updated_at: string
}

export interface Rider {
  id: number
  name: string
  // Teléfono / WhatsApp de contacto del domiciliario (lo usa el encargado)
  phone?: string | null
  is_active: boolean
  created_at: string
  active_orders: number
  total_delivered: number
  // Ubicación en vivo (la app del domiciliario la reporta cada ~15 s)
  last_lat?: number | null
  last_lng?: number | null
  last_seen_at?: string | null
}

export interface PromoSubscriber {
  phone_number: string
  customer_name: string
  opted_in_at: string
}

export interface PromoHistoryItem {
  // id (promo_history.id) lo expone el workflow desde 2026-09-04 (para borrar)
  id?: number
  title: string
  description: string
  sent_count: number
  sent_at: string
}

// Devolución parcial de un pedido (registrada para facturación).
export interface RefundItem {
  nombre: string
  cantidad: number
  monto: number
}

export interface Refund {
  id: number
  order_id: number
  tenant_id: number
  items: RefundItem[]
  amount: number
  reason: string | null
  status: string
  created_by: string | null
  created_at: string
  customer_name?: string | null
  customer_phone?: string | null
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  awaiting_verification: 'Verificar pago',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  ready_pickup: 'Listo p/ recoger',
  delivering: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  awaiting_verification: [],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['delivering', 'ready_pickup', 'cancelled'],
  ready_pickup: ['delivered'],
  delivering: ['delivered'],
  delivered: [],
  cancelled: [],
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurante: 'Restaurante',
  farmacia: 'Farmacia',
  negocio: 'Negocio',
}

// ─── Chatwoot ───
export interface CWConversation {
  id: number
  status: 'open' | 'resolved' | 'pending'
  inbox_id?: number
  meta: {
    sender: {
      name: string
      phone_number?: string
      thumbnail?: string
    }
  }
  last_non_activity_message?: {
    content: string | null
    created_at: number
    message_type?: number
  }
}

export interface CWMessage {
  id: number
  content: string | null
  message_type: number   // 0 = cliente, 1 = agente/bot
  created_at: number
  sender_type: string
  sender?: {
    name: string
    avatar_url?: string
  }
  attachments?: Array<{
    file_type: string
    data_url: string
  }>
}

export const THEME_OPTIONS: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'purpura', label: 'Blanco morado (clásico)', swatch: '#2a2185' },
  { id: 'talos', label: 'Azul Talos Sentinel', swatch: '#1e40af' },
  { id: 'calido', label: 'Cálido restaurante', swatch: '#c2410c' },
  { id: 'oscuro', label: 'Oscuro', swatch: '#151a23' },
]
