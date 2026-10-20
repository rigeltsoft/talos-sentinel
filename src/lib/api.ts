import type { BizConfig, Order, Rider, PromoSubscriber, PromoHistoryItem, Refund, RefundItem, CWConversation, CWMessage } from '@/types'
import { demoOrders, demoRiders, demoSubscribers, demoPromoHistory, demoAnalytics, demoInsight } from '@/lib/demo'

// Adjunto que el dashboard envía a Chatwoot (leído del <input type="file"> como base64).
export interface ChatAttachment {
  name: string
  mime: string
  data_base64: string
}

// Datos del análisis de ventas (webhook /dashboard/analytics).
export interface AnalyticsData {
  products: Array<{ nombre: string; cantidad: number; ingresos: number }>
  byDay: Array<{ dow: number; pedidos: number; ventas: number }>
  byHour: Array<{ hora: number; pedidos: number; ventas: number }>
  byZone: Array<{ zona: string; pedidos: number }>
}

// Cliente API hacia los webhooks n8n del negocio.
// liveMode=false → datos demo. liveMode=true → API real del tenant;
// si falla (Cloudflare Access / CORS / red) cae a demo para no bloquear la UI.

export interface ApiResult<T> {
  data: T
  live: boolean
  // true cuando liveMode estaba activo pero la API no respondio
  // (CORS, Cloudflare Access, n8n apagado, URL mal configurada)
  error?: boolean
}

// Lectura tolerante de las respuestas de n8n: un negocio NUEVO puede no tener
// filas, y n8n responde 200 con el cuerpo VACÍO (el nodo Respond no se ejecuta
// cuando la consulta no devuelve registros). Eso NO es un fallo de conexión: se
// traduce a "sin datos" para que el dashboard no muestre el aviso de API caída.
async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!text || !text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function postJson<T>(url: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(extraHeaders || {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json().catch(() => ({} as T))
}

// Base de las llamadas del panel al backend de n8n.
// IMPORTANTE (14/10/2026): NO es la URL pública de n8n. Apunta al proxy del propio
// backend del panel (/api/n8n), que exige sesión y agrega el secreto hacia n8n.
// Así los endpoints de dashboard/manager/chatwoot dejan de estar publicados.
const N8N = '/api/n8n'

function payload(biz: BizConfig, extra: Record<string, unknown>) {
  return { tenant_id: biz.id, phone_number_id: biz.phoneNumberId, business_name: biz.name, ...extra }
}

// Añade el scope de tenant a los GET: el backend n8n filtra pedidos/ventas/
// domiciliarios/promos por `tenant_id` (y registra `phone_number_id`).
function withTenant(url: string, biz: BizConfig): string {
  // La base del panel es RELATIVA ('/api/n8n'), y `new URL` SIN base lanza
  // "Invalid URL" → eso hacía que el panel cayera a datos demo con el aviso
  // "No se pudo conectar con la API de n8n". Se resuelve contra el origen actual.
  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  u.searchParams.set('tenant_id', String(biz.id))
  if (biz.phoneNumberId) u.searchParams.set('phone_number_id', biz.phoneNumberId)
  return u.toString()
}

export async function fetchOrders(biz: BizConfig): Promise<ApiResult<Order[]>> {
  if (!biz.liveMode) return { data: demoOrders(biz.type), live: false }
  try {
    const data = await getJson<Order[]>(withTenant(`${N8N}/dashboard/orders`, biz))
    return { data: Array.isArray(data) ? data : [], live: true }
  } catch {
    return { data: demoOrders(biz.type), live: false, error: true }
  }
}

export async function fetchRiders(biz: BizConfig): Promise<ApiResult<Rider[]>> {
  if (!biz.liveMode) return { data: demoRiders(biz.type), live: false }
  try {
    const data = await getJson<Rider[]>(withTenant(`${N8N}/dashboard/riders`, biz))
    return { data: Array.isArray(data) ? data : [], live: true }
  } catch {
    return { data: demoRiders(biz.type), live: false, error: true }
  }
}

// Registro de entrega/novedad reportado por la app del domiciliario
// (tabla delivery_evidence): notas + foto de evidencia por pedido.
export interface DeliveryEvidenceItem {
  order_id: number
  customer_name: string | null
  customer_phone: string | null
  delivery_address: string | null
  total: number | null
  shipping_cost: number | null
  order_status: string | null
  evidence_id: number
  delivery_status: string | null // delivered | no_answer | problem
  notes: string | null
  photo_data: string | null // base64 data-URL (foto de evidencia)
  delivered_at: string | null
  delivered_at_formatted: string | null
  rider_name: string | null
  rider_phone: string | null
}

// GET /dashboard/deliveries — entregas/novedades registradas (evidencia con notas y fotos).
export async function fetchDeliveries(biz: BizConfig): Promise<ApiResult<DeliveryEvidenceItem[]>> {
  if (!biz.liveMode) return { data: [], live: false }
  try {
    const data = await getJson<DeliveryEvidenceItem[]>(withTenant(`${N8N}/dashboard/deliveries`, biz))
    return { data: Array.isArray(data) ? data.filter((d) => d && d.evidence_id != null) : [], live: true }
  } catch {
    return { data: [], live: false, error: true }
  }
}

export async function fetchSubscribers(biz: BizConfig): Promise<ApiResult<PromoSubscriber[]>> {
  if (!biz.liveMode) return { data: demoSubscribers(), live: false }
  try {
    const data = await getJson<PromoSubscriber[]>(withTenant(`${N8N}/dashboard/promo-subscribers`, biz))
    return { data: Array.isArray(data) ? data.filter((s) => s && s.phone_number) : [], live: true }
  } catch {
    return { data: demoSubscribers(), live: false, error: true }
  }
}

export async function fetchPromoHistory(biz: BizConfig): Promise<ApiResult<PromoHistoryItem[]>> {
  if (!biz.liveMode) return { data: demoPromoHistory(), live: false }
  try {
    const data = await getJson<PromoHistoryItem[]>(withTenant(`${N8N}/dashboard/promo-history`, biz))
    // Un tenant sin historial devuelve un registro vacío ([{}]) → se descarta.
    return {
      data: Array.isArray(data) ? data.filter((p) => p && (p.id != null || p.title)) : [],
      live: true,
    }
  } catch {
    return { data: demoPromoHistory(), live: false, error: true }
  }
}

export async function fetchSalesHistory(biz: BizConfig): Promise<ApiResult<Order[]>> {
  if (!biz.liveMode) return { data: demoOrders(biz.type), live: false }
  try {
    const data = await getJson<Order[]>(withTenant(`${N8N}/dashboard/sales-history`, biz))
    return { data: Array.isArray(data) ? data.filter((o) => o && o.id != null) : [], live: true }
  } catch {
    return { data: demoOrders(biz.type), live: false, error: true }
  }
}

export async function fetchAnalytics(biz: BizConfig): Promise<ApiResult<AnalyticsData>> {
  if (!biz.liveMode) return { data: demoAnalytics() as AnalyticsData, live: false }
  try {
    const data = await getJson<AnalyticsData>(withTenant(`${N8N}/dashboard/analytics`, biz))
    return {
      data: {
        products: Array.isArray(data?.products) ? data.products : [],
        byDay: Array.isArray(data?.byDay) ? data.byDay : [],
        byHour: Array.isArray(data?.byHour) ? data.byHour : [],
        byZone: Array.isArray(data?.byZone) ? data.byZone : [],
      },
      live: true,
    }
  } catch {
    return { data: demoAnalytics() as AnalyticsData, live: false, error: true }
  }
}

// Insight IA (DeepSeek vía n8n): análisis "como un buen vendedor" de los datos.
export async function fetchInsight(biz: BizConfig): Promise<ApiResult<string>> {
  if (!biz.liveMode) return { data: demoInsight(), live: false }
  try {
    const data = await getJson<{ insight?: string }>(withTenant(`${N8N}/dashboard/insight`, biz))
    return { data: data?.insight || '', live: true }
  } catch {
    return { data: '', live: false, error: true }
  }
}

async function mutate(biz: BizConfig, path: string, extra: Record<string, unknown>) {
  if (!biz.liveMode) return { simulated: true }
  return postJson(`${N8N}${path}`, payload(biz, extra))
}

export const advanceOrder = (biz: BizConfig, orderId: number, newStatus: string) =>
  mutate(biz, '/dashboard/advance-order', { order_id: orderId, new_status: newStatus })

export const verifyPayment = (biz: BizConfig, orderId: number, action: 'approved' | 'rejected', notes: string) =>
  mutate(biz, '/dashboard/verify-payment', { order_id: orderId, verified_by: 'Dashboard Talos', action, notes })

export const assignRider = (biz: BizConfig, orderId: number, riderId: number) =>
  mutate(biz, '/dashboard/assign-rider', { order_id: orderId, rider_id: riderId })

export const sendPromo = (biz: BizConfig, title: string, description: string, template?: string) =>
  mutate(biz, '/dashboard/send-promo', {
    title,
    description,
    // Template de Meta configurado en el negocio (promoTemplate); fallback al de Restaurante Demo en el workflow
    ...((template || biz.promoTemplate) ? { template: template || biz.promoTemplate } : {}),
  })

// Da de baja (suave) a un suscriptor: no volverá a recibir promociones.
export const unsubscribeSubscriber = (biz: BizConfig, phoneNumber: string) =>
  mutate(biz, '/dashboard/promo-subscribers', { action: 'optout', phone_number: phoneNumber })

// Borra un registro del historial de promociones (solo del tenant del negocio).
export const deletePromoHistory = (biz: BizConfig, promoId: number) =>
  mutate(biz, '/dashboard/promo-history/delete', { id: promoId })

export const toggleRider = (biz: BizConfig, riderId: number, isActive: boolean) =>
  mutate(biz, '/dashboard/riders', { action: 'toggle', id: riderId, is_active: isActive })

export const createRider = (biz: BizConfig, name: string, pin: string, phone?: string) =>
  mutate(biz, '/dashboard/riders', { action: 'create', name, pin, ...(phone ? { phone } : {}) })

export const updateRider = (biz: BizConfig, riderId: number, name: string, pin?: string, phone?: string) =>
  mutate(biz, '/dashboard/riders', {
    action: 'update',
    id: riderId,
    name,
    ...(pin ? { pin } : {}),
    ...(phone !== undefined ? { phone } : {}),
  })

export const deleteRider = (biz: BizConfig, riderId: number) =>
  mutate(biz, '/dashboard/riders', { action: 'delete', id: riderId })

// Registra el token FCM del encargado (manager) para recibir push en el navegador.
export const updateManagerToken = (biz: BizConfig, fcmToken: string) =>
  mutate(biz, '/manager/update-token', { fcm_token: fcmToken })

// ─── Devoluciones parciales ───

export async function fetchRefunds(biz: BizConfig): Promise<ApiResult<Refund[]>> {
  if (!biz.liveMode) return { data: [], live: false }
  try {
    const data = await getJson<Refund[]>(withTenant(`${N8N}/dashboard/refunds`, biz))
    return { data: Array.isArray(data) ? data : [], live: true }
  } catch {
    return { data: [], live: false, error: true }
  }
}

export const createRefund = (
  biz: BizConfig,
  orderId: number,
  items: RefundItem[],
  amount: number,
  reason: string,
) =>
  mutate(biz, '/dashboard/refunds', {
    order_id: orderId,
    items,
    amount,
    reason: reason.trim() || null,
    created_by: 'Dashboard',
  })

// ─── Chatwoot via n8n Proxy ───

// Normaliza la URL base de Chatwoot: si el usuario pegó la URL de un inbox
// (https://host/app/accounts/1/inbox/1), se queda solo con el origen
// (https://host) para que el proxy n8n construya bien /api/v1/...
function chatwootOrigin(base: string): string {
  try {
    return new URL(base).origin
  } catch {
    return base
  }
}

export async function fetchCWConversations(biz: BizConfig): Promise<ApiResult<CWConversation[]>> {
  if (!biz.chatwootBaseUrl || !biz.chatwootAccountId || !biz.chatwootInboxId) {
    return { data: [], live: false, error: true }
  }
  try {
    const data = await getJson<any>(
      `${N8N}/chatwoot-conversations?base_url=${encodeURIComponent(chatwootOrigin(biz.chatwootBaseUrl))}&account_id=${biz.chatwootAccountId}&inbox_id=${biz.chatwootInboxId}`
    )
    const all: CWConversation[] = data?.data?.payload || data?.payload || []
    // Mitigación: el proxy ignora inbox_id; filtramos por el campo del payload
    const payload = all.filter((c) => !c.inbox_id || c.inbox_id === biz.chatwootInboxId)
    return { data: payload, live: true }
  } catch {
    return { data: [], live: false, error: true }
  }
}

export async function fetchCWMessages(biz: BizConfig, convId: number): Promise<ApiResult<CWMessage[]>> {
  if (!biz.chatwootBaseUrl || !biz.chatwootAccountId) {
    return { data: [], live: false, error: true }
  }
  try {
    const data = await getJson<any>(
      `${N8N}/chatwoot-messages?base_url=${encodeURIComponent(chatwootOrigin(biz.chatwootBaseUrl))}&account_id=${biz.chatwootAccountId}&conversation_id=${convId}`
    )
    return { data: Array.isArray(data) ? data : data.payload || [], live: true }
  } catch {
    return { data: [], live: false, error: true }
  }
}

export async function sendCWMessage(
  biz: BizConfig,
  convId: number,
  content: string,
  attachment?: ChatAttachment,
): Promise<void> {
  if (!biz.chatwootBaseUrl || !biz.chatwootAccountId) return
  await postJson(`${N8N}/chatwoot-send`, {
    base_url: chatwootOrigin(biz.chatwootBaseUrl),
    account_id: biz.chatwootAccountId,
    conversation_id: convId,
    content,
    ...(attachment ? { attachment } : {}),
  })
}
