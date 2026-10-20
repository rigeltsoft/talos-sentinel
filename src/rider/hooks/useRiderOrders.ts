import { useCallback, useEffect, useRef, useState } from 'react'
import { riderOrders } from '../lib/riderApi'
import type { RiderOrder } from '../types/rider'

const POLL_MS = 15_000

// Pedidos asignados del rider (status 'delivering') con polling de 15 s,
// mismo patrón que DashboardContext. Expone reload para refrescar tras una entrega.
export function useRiderOrders(riderId: number | null) {
  const [orders, setOrders] = useState<RiderOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const riderIdRef = useRef(riderId)
  riderIdRef.current = riderId

  const reload = useCallback(async () => {
    const id = riderIdRef.current
    if (!id) return
    try {
      const data = await riderOrders(id)
      setOrders(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!riderIdRef.current) return
    reload()
    const t = setInterval(reload, POLL_MS)
    return () => clearInterval(t)
  }, [reload])

  return { orders, loading, error, reload }
}
