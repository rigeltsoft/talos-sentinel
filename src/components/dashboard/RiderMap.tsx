import { useEffect, useRef, useState } from 'react'
import { MAPBOX_TOKEN, MAPBOX_CONFIGURADO, loadMapboxGL } from '@/lib/mapbox'
import { geocodeAddress } from '@/lib/geocode'
import type { Rider, Order } from '@/types'

interface Props {
  riders: Rider[]
  // Pedidos en ruta (delivering) con rider asignado: sus coordenadas son los
  // "destinos". Si el pedido no trae coordenadas (pedido por WhatsApp en texto)
  // se intenta geocodificar la dirección para poder pintar el destino igual.
  orders?: Order[]
}

// Centro de Colombia (vista país cuando aún no hay datos de nadie)
const COLOMBIA: [number, number] = [-74.2973, 4.5709]
const COLOMBIA_ZOOM = 4.8

// Convierte a número válido; null/''/undefined → null. Nunca devuelve 0 por un null.
function pt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// (0,0) está en el mar (Golfo de Guinea): se considera coordenada inválida
function validPair(lat: number | null, lng: number | null): lat is number {
  return lat !== null && lng !== null && !(lat === 0 && lng === 0)
}

// Caché de geocodificación por dirección (evita repetir llamadas en cada poll)
const geoCache: Record<string, [number, number]> = {}
const geoPromises: Record<string, Promise<[number, number] | null>> = {}

export default function RiderMap({ riders, orders = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  // Destinos resueltos por geocodificación: orderId → [lat, lng]
  const [geocoded, setGeocoded] = useState<Record<number, [number, number]>>({})

  // Geocodificar pedidos en ruta sin coordenadas (una llamada por dirección;
  // el resultado aplica a todos los pedidos de esa dirección)
  useEffect(() => {
    let cancelled = false
    const porDireccion = new Map<string, Order[]>()
    orders
      .filter((o) => o.status === 'delivering' && o.rider_id && o.delivery_address)
      .forEach((o) => {
        if (validPair(pt(o.latitude), pt(o.longitude))) return
        if (o.id in geocoded) return
        if (geoCache[(o.delivery_address || '').trim()]) return
        const addr = (o.delivery_address || '').trim()
        if (!addr) return
        const list = porDireccion.get(addr) || []
        list.push(o)
        porDireccion.set(addr, list)
      })
    porDireccion.forEach((list, addr) => {
      if (!geoPromises[addr]) {
        geoPromises[addr] = geocodeAddress(addr)
      }
      geoPromises[addr].then((c) => {
        if (cancelled) return
        if (!c) return
        geoCache[addr] = c
        const next: Record<number, [number, number]> = {}
        list.forEach((o) => { next[o.id] = c })
        setGeocoded((prev) => ({ ...prev, ...next }))
      })
    })
    return () => {
      cancelled = true
    }
  }, [orders, geocoded])

  // Inicializar el mapa una vez (vista Colombia por defecto)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!MAPBOX_CONFIGURADO) {
        setError('Mapa no configurado: falta VITE_MAPBOX_TOKEN en el archivo .env')
        return
      }
      const ok = await loadMapboxGL()
      if (cancelled || !ok || !containerRef.current || !(window as any).mapboxgl) return
      const mapboxgl = (window as any).mapboxgl
      try {
        mapboxgl.accessToken = MAPBOX_TOKEN
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: COLOMBIA,
          zoom: COLOMBIA_ZOOM,
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

  // Marcadores: domiciliarios en vivo + destinos (coordenadas o geocodificados)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !(window as any).mapboxgl) return
    const mapboxgl = (window as any).mapboxgl

    try {
      if (map.getLayer('rider-lines')) map.removeLayer('rider-lines')
      if (map.getSource('rider-lines')) map.removeSource('rider-lines')
    } catch { /* sin capa previa */ }
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const located = riders
      .map((r) => ({ rider: r, lat: pt(r.last_lat), lng: pt(r.last_lng) }))
      .filter((r) => validPair(r.lat, r.lng)) as Array<{ rider: Rider; lat: number; lng: number }>

    const dests = orders
      .filter((o) => o.status === 'delivering' && o.rider_id)
      .map((o) => {
        const ownLat = pt(o.latitude)
        const ownLng = pt(o.longitude)
        if (validPair(ownLat, ownLng)) return { order: o, lat: ownLat as number, lng: ownLng as number, approx: false }
        const gc = geocoded[o.id]
        if (gc) return { order: o, lat: gc[0], lng: gc[1], approx: true }
        return null
      })
      .filter((d): d is { order: Order; lat: number; lng: number; approx: boolean } => d !== null && validPair(d.lat, d.lng))

    const bounds = new mapboxgl.LngLatBounds()

    located.forEach(({ rider: r, lat, lng }) => {
      const el = document.createElement('div')
      el.style.cssText = `
        width: 30px; height: 30px; border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
        background: ${r.is_active ? '#1d4ed8' : '#9ca3af'};
        border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
        display: flex; align-items: center; justify-content: center;`
      const destsOf = dests.filter((d) => d.order.rider_id === r.id)
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 16 }).setHTML(
            `<strong>${r.name}</strong><br/>🛵 ${r.active_orders} en camino · ${r.total_delivered} hoy` +
              (destsOf.length ? `<br/>📍 ${destsOf.length} destino(s)` : ''),
          ),
        )
        .addTo(map)
      markersRef.current.push(marker)
      bounds.extend([lng, lat])
    })

    dests.forEach(({ order: d, lat, lng, approx }) => {
      const el = document.createElement('div')
      el.style.cssText = `
        width: 26px; height: 26px; border-radius: 50%;
        background: #dc2626; border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,.35);
        display: flex; align-items: center; justify-content: center;
        font-size: 12px;`
      el.textContent = '📍'
      const riderName = riders.find((r) => r.id === d.rider_id)?.name || `#${d.rider_id}`
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 14 }).setHTML(
            `<strong>Destino · Pedido #${d.id}${approx ? ' (aprox.)' : ''}</strong><br/>${d.customer_name}<br/>📍 ${d.delivery_address || ''}<br/>🛵 ${riderName}`,
          ),
        )
        .addTo(map)
      markersRef.current.push(marker)
      bounds.extend([lng, lat])
    })

    const lineCoords: number[][] = []
    located.forEach(({ rider: r, lat, lng }) => {
      dests.filter((d) => d.order.rider_id === r.id).forEach((d) => {
        lineCoords.push([lng, lat], [d.lng, d.lat])
      })
    })
    if (lineCoords.length >= 4) {
      map.addSource('rider-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: Array.from({ length: lineCoords.length / 2 }, (_, i) => ({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [lineCoords[i * 2], lineCoords[i * 2 + 1]],
            },
          })),
        },
      })
      map.addLayer({
        id: 'rider-lines',
        type: 'line',
        source: 'rider-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 2.5,
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.75,
        },
      })
    }

    if (located.length || dests.length) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 })
    }
  }, [riders, orders, geocoded, ready])

  const locatedCount = riders.filter((r) => validPair(pt(r.last_lat), pt(r.last_lng))).length
  const destCount = orders.filter(
    (o) =>
      o.status === 'delivering' &&
      o.rider_id &&
      (validPair(pt(o.latitude), pt(o.longitude)) || (o.id in geocoded)),
  ).length

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', height: 340, borderRadius: 14, overflow: 'hidden' }} />
      {error && <p style={{ color: '#e11d48', fontSize: 12, margin: '6px 0 0' }}>⚠️ {error}</p>}
      <div className="muted" style={{ fontSize: 12, margin: '8px 0 0', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="map-legend"><span className="legend-dot" style={{ background: '#1d4ed8' }} /> {locatedCount} domiciliario(s) en vivo de {riders.length}</span>
        <span className="map-legend"><span className="legend-dot" style={{ background: '#dc2626' }} /> {destCount} destino(s) en ruta</span>
        <span>Se actualiza cada ~15 s con la app del domiciliario abierta.</span>
      </div>
    </div>
  )
}
