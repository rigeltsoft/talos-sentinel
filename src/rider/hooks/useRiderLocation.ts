import { useEffect, useRef, useState } from 'react'
import { riderLocation } from '../lib/riderApi'
import { setLastPosition } from '../lib/lastPosition'

export type LocationStatus = 'off' | 'waiting' | 'active' | 'denied'

const SEND_INTERVAL_MS = 15_000
const MAX_CONSECUTIVE_FAILURES = 3

// GPS en vivo: watchPosition (alta precisión) + envío a POST /rider/location con
// throttle de ~15 s. Se detiene al desactivarse, al cerrar sesión o al desmontar.
// Nunca muestra errores al usuario: el mapa del dashboard es quien consume los datos.
export function useRiderLocation(enabled: boolean, riderId: number | null) {
  const [status, setStatus] = useState<LocationStatus>('off')
  const riderIdRef = useRef(riderId)
  riderIdRef.current = riderId

  useEffect(() => {
    if (!enabled || !riderIdRef.current) return
    if (!('geolocation' in navigator)) return

    let watchId: number | null = null
    let cancelled = false
    let lastSent = 0
    let failures = 0

    const send = (lat: number, lng: number) => {
      const now = Date.now()
      if (now - lastSent < SEND_INTERVAL_MS) return
      const id = riderIdRef.current
      if (!id) return
      lastSent = now
      setStatus('active')
      // Guarda la posición local para dibujar la ruta en el detalle del pedido
      setLastPosition({ lat, lng })
      riderLocation(id, lat, lng).then(() => {
        failures = 0
      }).catch(() => {
        failures += 1
        // Si el endpoint no existe (workflow viejo) o la red falla 3 veces
        // seguidas, paramos el GPS para no gastar batería ni datos.
        if (failures >= MAX_CONSECUTIVE_FAILURES && !cancelled && watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
          setStatus('off')
        }
      })
    }

    const onPosition = (p: GeolocationPosition) =>
      send(p.coords.latitude, p.coords.longitude)
    const onError = () => setStatus('denied')

    // Primera lectura inmediata y luego el watcher
    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 15_000,
    })
    watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 15_000,
    })
    setStatus('waiting')

    return () => {
      cancelled = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled])

  return { status }
}
