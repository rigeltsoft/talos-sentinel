// Resolución del "meta" del negocio (nombre + tema) a partir del tenant del rider.
// Fuente PRIMARIA: endpoint público del panel (MySQL businesses.theme), para que
// la app del rider use EXACTAMENTE el mismo tema que el dashboard del negocio
// (si el panel es azul, el rider también). Respaldo: GET /rider/businesses de n8n
// (mapa estático) y, por último, el mapa local espejo.

import type { TenantMeta } from '../types/rider'
import { riderBusinesses } from './riderApi'
import type { ThemeId } from '@/types'

const THEMES: ThemeId[] = ['purpura', 'oscuro', 'talos', 'calido']

// Espejo local del mapa de n8n (último recurso).
const FALLBACK: Record<number, { name: string; theme: ThemeId }> = {
  1: { name: 'Restaurante Demo - Sabor Autentico', theme: 'purpura' },
  3: { name: 'Talos Sentinel', theme: 'talos' },
}

export const DEFAULT_THEME: ThemeId = 'purpura'

let bizCache: Record<number, { name: string; theme: ThemeId }> | null = null

// 1) Tema real desde el panel (misma BD MySQL que el dashboard)
async function fetchTenantMeta(id: number): Promise<{ name: string; theme: ThemeId } | null> {
  try {
    const res = await fetch(`/api/public/business/${id}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const d = await res.json()
    if (d && THEMES.includes(d.theme) && typeof d.name === 'string') {
      return { name: d.name, theme: d.theme as ThemeId }
    }
  } catch {
    /* sin conexión al panel: se usa el respaldo */
  }
  return null
}

// 2) Mapa estático de n8n (GET /rider/businesses)
async function loadBusinesses(): Promise<Record<number, { name: string; theme: ThemeId }>> {
  try {
    const list = await riderBusinesses()
    if (list.length === 0) return {}
    const map: Record<number, { name: string; theme: ThemeId }> = {}
    for (const b of list) {
      map[b.id] = { name: b.name, theme: b.theme || FALLBACK[b.id]?.theme || DEFAULT_THEME }
    }
    return map
  } catch {
    return {}
  }
}

export async function resolveTenantMeta(tenantId: number): Promise<TenantMeta> {
  // Fuente primaria: MySQL del panel (consistencia de tema con el dashboard)
  const direct = await fetchTenantMeta(tenantId)
  if (direct) return { id: tenantId, ...direct }

  if (!bizCache) {
    bizCache = await loadBusinesses()
  }
  const fromBiz = bizCache?.[tenantId] || FALLBACK[tenantId]
  return {
    id: tenantId,
    name: fromBiz?.name || 'Domiciliarios',
    theme: fromBiz?.theme || DEFAULT_THEME,
  }
}

export function resetTenantMetaCache(): void {
  bizCache = null
}
