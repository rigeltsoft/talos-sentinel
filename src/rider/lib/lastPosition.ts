import { useSyncExternalStore } from 'react'

// Última posición conocida del rider (la alimenta useRiderLocation cada ~15 s
// y el botón "Compartir mi ubicación" del Perfil). Persistida en localStorage
// para que la ruta se pueda dibujar incluso tras recargar la app.
export interface RiderPos {
  lat: number
  lng: number
}

const KEY = 'talos.rider.lastpos'

function read(): RiderPos | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return p && typeof p.lat === 'number' && typeof p.lng === 'number'
      ? { lat: p.lat, lng: p.lng }
      : null
  } catch {
    return null
  }
}

let current: RiderPos | null = read()
const subs = new Set<() => void>()

export function getLastPosition(): RiderPos | null {
  return current
}

export function setLastPosition(p: RiderPos): void {
  current = p
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* almacenamiento no disponible */
  }
  subs.forEach((f) => f())
}

export function subscribeLastPosition(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

// Hook reactivo: se re-renderiza cuando cambia la posición reportada.
export function useLastPosition(): RiderPos | null {
  return useSyncExternalStore(subscribeLastPosition, getLastPosition, getLastPosition)
}
