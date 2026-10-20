import { useEffect, useRef, useState } from 'react'
import { MAPBOX_TOKEN, MAPBOX_CONFIGURADO, loadMapboxGL } from '@/lib/mapbox'
import { geocodeAddress } from '@/lib/geocode'
import { fetchDirections } from '@/lib/directions'
import { useLastPosition } from '../lib/lastPosition'
import type { DirectionsResult } from '@/lib/directions'

interface Props {
  lat?: number | null
  lng?: number | null
  address?: string | null
  label?: string
}

// (0,0) está en el mar → coordenada inválida
function validPair(lat: unknown, lng: unknown): lat is number {
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') return false
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return !(a === 0 && b === 0)
}

// Mini-mapa del destino con RUTA (Mapbox Directions): muestra la ubicación
// actual del domiciliario (🛵 azul, reportada por su GPS) y la ruta hasta la
// dirección del cliente (📍 rojo), con distancia y tiempo estimado.
// Si el pedido no trae coordenadas, intenta geocodificar la dirección.
export default function MapaDestino({ lat, lng, address, label = 'Destino del pedido' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [geo, setGeo] = useState<[number, number] | null>(null)
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [route, setRoute] = useState<DirectionsResult | null>(null)
  const [routeState, setRouteState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const origin = useLastPosition()

  const hasCoords = validPair(lat, lng)
  const destLat: number | null = hasCoords ? Number(lat) : (geo?.[0] ?? null)
  const destLng: number | null = hasCoords ? Number(lng) : (geo?.[1] ?? null)
  const destValid = destLat !== null && destLng !== null && !(destLat === 0 && destLng === 0)
  const originKey = origin ? `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}` : ''
  const destKey = destValid ? `${destLat},${destLng}` : ''

  // Geocodificar la dirección si el pedido no trae coordenadas (una vez)
  useEffect(() => {
    if (hasCoords || geoState !== 'idle') return
    const addr = (address || '').trim()
    if (!addr) {
      setGeoState('fail')
      return
    }
    setGeoState('loading')
    let cancelled = false
    geocodeAddress(addr).then((c) => {
      if (cancelled) return
      if (c) {
        setGeo(c)
        setGeoState('ok')
      } else {
        setGeoState('fail')
      }
    })
    return () => {
      cancelled = true
    }
  }, [hasCoords, address, geoState])

  // Inicializar el mapa una vez
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!MAPBOX_CONFIGURADO) return
      const ok = await loadMapboxGL()
      if (cancelled || !ok || !containerRef.current || !(window as any).mapboxgl) return
      const mapboxgl = (window as any).mapboxgl
      try {
        mapboxgl.accessToken = MAPBOX_TOKEN
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [-75.8814, 8.7479], // Montería
          zoom: 12,
          attributionControl: false,
          performanceMetricsCollection: false,
        })
        mapRef.current = map
        map.on('load', () => setReady(true))
        setTimeout(() => setReady(true), 3000)
      } catch {
        setError('No se pudo cargar el mapa.')
      }
    })()
    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Pedir la ruta cuando hay origen (GPS) y destino
  useEffect(() => {
    if (!ready || !origin || !destValid) {
      setRoute(null)
      setRouteState('idle')
      return
    }
    setRouteState('loading')
    let cancelled = false
    fetchDirections([origin.lat, origin.lng], [destLat as number, destLng as number]).then((r) => {
      if (cancelled) return
      setRoute(r)
      setRouteState(r ? 'ok' : 'fail')
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, originKey, destKey])

  // Dibujar marcadores + ruta
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !(window as any).mapboxgl) return
    const mapboxgl = (window as any).mapboxgl

    try {
      if (map.getLayer('ruta')) map.removeLayer('ruta')
      if (map.getSource('ruta')) map.removeSource('ruta')
      if (map.getLayer('ruta-fallback')) map.removeLayer('ruta-fallback')
      if (map.getSource('ruta-fallback')) map.removeSource('ruta-fallback')
    } catch { /* sin capas previas */ }
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const bounds = new mapboxgl.LngLatBounds()
    let puntos = 0
    const draw = (o: { lat: number; lng: number }, color: string, text: string, popup: string) => {
      const el = document.createElement('div')
      el.style.cssText = `
        width: 30px; height: 30px; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
        background: ${color}; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
        display:flex; align-items:center; justify-content:center; font-size: 14px;`
      el.textContent = text
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([o.lng, o.lat])
        .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(popup))
        .addTo(map)
      markersRef.current.push(m)
      bounds.extend([o.lng, o.lat])
      puntos += 1
    }

    if (origin) draw(origin, '#1d4ed8', '🛵', '<strong>Tu ubicación</strong><br/>actualizada por tu GPS')
    if (destValid) draw({ lat: destLat as number, lng: destLng as number }, '#dc2626', '📍', `<strong>${address || label}</strong>`)

    // Ruta real o línea recta de respaldo
    if (origin && destValid) {
      const lineData = route
        ? {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: route.path },
          }
        : {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [origin.lng, origin.lat],
                [destLng as number, destLat as number],
              ],
            },
          }
      const sourceId = route ? 'ruta' : 'ruta-fallback'
      map.addSource(sourceId, { type: 'geojson', data: lineData } as any)
      map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: route
          ? { 'line-color': '#1d4ed8', 'line-width': 5, 'line-opacity': 0.9 }
          : { 'line-color': '#94a3b8', 'line-width': 3, 'line-dasharray': [3, 2], 'line-opacity': 0.8 },
      } as any)
    }

    if (puntos > 0) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 15 })
    }
  }, [ready, originKey, destKey, route, destValid, address, label, origin])

  const mensajeDestino = hasCoords
    ? null
    : geoState === 'loading'
      ? 'Buscando la dirección en el mapa…'
      : geoState === 'ok'
        ? 'Destino aproximado (geocodificado con Mapbox). Confírmalo con el cliente.'
        : geoState === 'fail' && !destValid
          ? 'No se pudo ubicar la dirección: usa "Abrir en Google Maps".'
          : null

  const km = route ? (route.distanceM / 1000).toFixed(1) : null
  const min = route ? Math.max(1, Math.round(route.durationMin)) : null

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', height: 210, borderRadius: 14, overflow: 'hidden' }} />
      {error && <p style={{ color: '#e11d48', fontSize: 12, margin: '6px 0 0' }}>⚠️ {error}</p>}
      {route && km !== null && min !== null && (
        <div className="ruta-chip">
          <span>🛵 {km} km</span>
          <span>⏱️ ~{min} min</span>
          <span>🗺️ Ruta por calles</span>
        </div>
      )}
      {routeState === 'loading' && <p className="rider-subtitle" style={{ marginTop: 6, marginBottom: 0 }}>Calculando la ruta…</p>}
      {routeState === 'fail' && origin && destValid && (
        <p className="rider-subtitle" style={{ marginTop: 6, marginBottom: 0 }}>
          No se pudo calcular la ruta por calles (línea recta de referencia).
        </p>
      )}
      {mensajeDestino && <p className="rider-subtitle" style={{ marginTop: 6, marginBottom: 0 }}>{mensajeDestino}</p>}
      {!origin && destValid && (
        <p className="rider-subtitle" style={{ marginTop: 6, marginBottom: 0 }}>
          Activa tu ubicación (botón 📡 en Perfil) para ver tu ruta hasta el cliente.
        </p>
      )}
    </div>
  )
}
