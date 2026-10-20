// Cliente API de la app del domiciliario hacia los webhooks n8n (/rider/*).
// No depende de BizConfig ni del modo demo del dashboard: el rider entra con PIN
// global y TODOS los endpoints se acotan al tenant del rider en el workflow.
//
// ── Cambio del 14/10/2026 (Fase 3, cierre de S2) ────────────────────────────
// ANTES: se llamaba DIRECTO a https://api.talos.example.com/webhook/*
//        (ruta pública, sin autenticación → cualquiera podía suplantar a un
//         domiciliario enviando su rider_id).
// AHORA: se llama al MISMO ORIGEN que sirve esta página (panel.talos.example.com)
//        por la ruta /api/rider/* , que el backend del panel reenvía a n8n
//        agregando el secreto. Además se envía el TOKEN del domiciliario
//        (que entrega /rider/login) en el encabezado `x-rider-token`.
// El token es la identidad: sin él, un tercero no puede actuar en nombre del rider.

import type {
  RiderBusiness,
  RiderDeliverPayload,
  RiderHistoryItem,
  RiderLoginResult,
  RiderOrder,
} from '../types/rider'

export const RIDER_API_BASE =
  (import.meta.env?.VITE_RIDER_API_BASE as string | undefined) || '/api'

// ── Token del domiciliario (lo devuelve /rider/login) ───────────────────────
const TOKEN_KEY = 'talos:rider-token'
let riderToken: string | null =
  typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null

export function setRiderToken(token: string | null) {
  riderToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}

export function getRiderToken(): string | null {
  return riderToken
}

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(riderToken ? { 'x-rider-token': riderToken } : {}),
    ...extra,
  }
}

// Lectura tolerante: cuando el rider no tiene pedidos, n8n responde 200 con el
// cuerpo VACÍO (el nodo Respond no se ejecuta si la consulta no devuelve filas).
// Eso NO es un error de red: se traduce a "sin datos" para que la app muestre
// el estado vacío ("Todo entregado") en vez de quedarse en error.
// Cuando el servidor dice 401 (token ausente/vencido): se olvida la identidad y
// se avisa a la app para que vuelva a pedir el PIN. Así activar el modo estricto
// no deja a nadie bloqueado: quien tenga sesión vieja simplemente re-ingresa.
function manejarNoAutorizado(status: number) {
  if (status !== 401) return
  setRiderToken(null)
  try {
    window.dispatchEvent(new CustomEvent('talos:rider-401'))
  } catch {
    /* sin window */
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: cabeceras() })
  manejarNoAutorizado(res.status)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!text || !text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: cabeceras({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  manejarNoAutorizado(res.status)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json().catch(() => ({} as T))
}

// POST /rider/login — PIN globalmente único; el negocio se deriva del rider.
export async function riderLogin(pin: string): Promise<RiderLoginResult> {
  const res = await postJson<RiderLoginResult>(`${RIDER_API_BASE}/rider/login`, { pin })
  // n8n/PG puede devolver tenant_id como string ("1"): se normaliza a número
  if (res.rider) {
    res.rider.tenant_id = Number(res.rider.tenant_id)
    // El login entrega el TOKEN del domiciliario: se guarda para mandarlo en
    // cada llamada (es su identidad; sin él, en modo estricto no hay acceso).
    if (res.rider.token) setRiderToken(res.rider.token)
  }
  return res
}

// GET /rider/businesses — nombre + tema por negocio (para el branding del rider).
export async function riderBusinesses(): Promise<RiderBusiness[]> {
  const data = await getJson<RiderBusiness[] | { businesses?: RiderBusiness[] }>(
    `${RIDER_API_BASE}/rider/businesses`,
  )
  if (Array.isArray(data)) return data
  return Array.isArray(data?.businesses) ? data.businesses : []
}

// GET /rider/orders?rider_id= — pedidos en status 'delivering' asignados al rider.
export async function riderOrders(riderId: number): Promise<RiderOrder[]> {
  const data = await getJson<RiderOrder[]>(`${RIDER_API_BASE}/rider/orders?rider_id=${riderId}`)
  return Array.isArray(data) ? data : []
}

// POST /rider/deliver — registra la entrega / novedad (foto base64 opcional).
export async function riderDeliver(payload: RiderDeliverPayload): Promise<{ success?: boolean }> {
  return postJson<{ success?: boolean }>(`${RIDER_API_BASE}/rider/deliver`, payload)
}

// POST /rider/pickup — el domiciliario confirma que SALIÓ con el pedido:
// el pedido pasa de 'preparing' a 'delivering' y se notifica al cliente
// ("va en camino"). Antes esto lo hacía el encargado desde el dashboard.
export async function riderPickup(orderId: number, riderId: number): Promise<{ success?: boolean }> {
  return postJson<{ success?: boolean }>(`${RIDER_API_BASE}/rider/pickup`, {
    order_id: orderId,
    rider_id: riderId,
  })
}

// POST /rider/respond — el domiciliario ACEPTA o RECHAZA el pedido asignado.
// accept → queda aceptado (rider_accepted_at). reject → se libera del pedido y
// el encargado lo ve como "sin domiciliario" para reasignarlo.
export async function riderRespond(
  orderId: number,
  riderId: number,
  action: 'accept' | 'reject',
): Promise<{ success?: boolean; status?: string }> {
  return postJson<{ success?: boolean; status?: string }>(`${RIDER_API_BASE}/rider/respond`, {
    order_id: orderId,
    rider_id: riderId,
    action,
  })
}

// GET /rider/history?rider_id= — entregas del mes actual (zona Bogotá).
export async function riderHistory(riderId: number): Promise<RiderHistoryItem[]> {
  const data = await getJson<RiderHistoryItem[]>(`${RIDER_API_BASE}/rider/history?rider_id=${riderId}`)
  return Array.isArray(data) ? data : []
}

// POST /rider/update-token — registro FCM (WebView Android).
export async function riderUpdateToken(riderId: number, fcmToken: string): Promise<void> {
  await postJson(`${RIDER_API_BASE}/rider/update-token`, { rider_id: riderId, fcm_token: fcmToken })
}

// POST /rider/location — GPS en vivo para el mapa del dashboard (nunca lanza:
// si el endpoint no está (workflow viejo) o la red falla, se ignora en silencio).
export async function riderLocation(riderId: number, lat: number, lng: number): Promise<void> {
  try {
    await postJson(`${RIDER_API_BASE}/rider/location`, { rider_id: riderId, lat, lng })
  } catch {
    /* silencioso: el GPS es best-effort */
  }
}
