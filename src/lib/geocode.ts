import { MAPBOX_TOKEN } from './mapbox'

// Centro por defecto de Montería (tenant Restaurante Demo): sesga la geocodificación hacia
// la ciudad del negocio cuando la dirección es ambigua. Para otro tenant con
// otra ciudad, pasar proximity=[lng, lat] desde el llamador.
const DEFAULT_PROXIMITY: [number, number] = [-75.8814, 8.7479]

// Geocodificación directa (forward) con Mapbox: convierte una dirección de
// texto ("Cra 5 #27-40, Centro, Montería") en coordenadas [lat, lng].
// Útil porque los pedidos llegan por WhatsApp como texto libre, sin coordenadas.
// El token público pk… soporta geocoding con límite de uso; country=co enfoca
// a Colombia. Devuelve null si no hay resultado o falla la red.
export async function geocodeAddress(
  query: string,
  proximity?: [number, number],
): Promise<[number, number] | null> {
  // Sin token configurado no se llama a la API: el mapa simplemente no pinta
  // los destinos que solo tienen dirección escrita.
  if (!MAPBOX_TOKEN) return null
  try {
    const q = encodeURIComponent(query.trim())
    const prox = proximity || DEFAULT_PROXIMITY
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json` +
      `?country=co&language=es&limit=1&proximity=${prox[0]},${prox[1]}&access_token=${MAPBOX_TOKEN}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const feature = data?.features?.[0]
    if (!feature?.center) return null
    // Mapbox devuelve [lng, lat]
    return [feature.center[1], feature.center[0]]
  } catch {
    return null
  }
}
