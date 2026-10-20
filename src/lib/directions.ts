import { MAPBOX_TOKEN } from './mapbox'

// Cliente de la API de Directions de Mapbox (ruta entre dos puntos).
// Documentación: https://docs.mapbox.com/api/navigation/directions/
// Perfil: mapbox/driving (carro/moto). geometries=geojson evita decodificar
// la polyline. El token pk… incluye Directions (cuota gratuita mensual).
export interface DirectionsResult {
  distanceM: number
  durationMin: number
  // Path en orden [lng, lat] (lo que consume Mapbox GL directamente)
  path: [number, number][]
}

const cache: Record<string, { t: number; res: DirectionsResult | null }> = {}
const TTL_MS = 10 * 60 * 1000

export async function fetchDirections(
  origin: [number, number], // [lat, lng]
  dest: [number, number], // [lat, lng]
): Promise<DirectionsResult | null> {
  const key = `${origin[0].toFixed(5)},${origin[1].toFixed(5)}>${dest[0].toFixed(5)},${dest[1].toFixed(5)}`
  const hit = cache[key]
  if (hit && Date.now() - hit.t < TTL_MS) return hit.res
  if (!MAPBOX_TOKEN) return null

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin[1]},${origin[0]};${dest[1]},${dest[0]}` +
    `?geometries=geojson&overview=full&steps=false&language=es&alternatives=false` +
    `&access_token=${MAPBOX_TOKEN}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      cache[key] = { t: Date.now(), res: null }
      return null
    }
    const data = await res.json()
    const route = data?.routes?.[0]
    const coords = route?.geometry?.coordinates
    if (!route || !Array.isArray(coords) || coords.length < 2) {
      cache[key] = { t: Date.now(), res: null }
      return null
    }
    const result: DirectionsResult = {
      distanceM: route.distance ?? 0,
      durationMin: (route.duration ?? 0) / 60,
      path: coords.map((c: number[]) => [Number(c[0]), Number(c[1])] as [number, number]),
    }
    cache[key] = { t: Date.now(), res: result }
    return result
  } catch {
    cache[key] = { t: Date.now(), res: null }
    return null
  }
}
