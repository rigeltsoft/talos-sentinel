import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useRiderOrders } from './hooks/useRiderOrders'
import { playRiderAssignedSound, buzz } from '@/lib/notify'
import type { RiderOrder } from './types/rider'

// Datos compartidos del rider (polling 15 s una sola vez, en RiderShell):
// las páginas (Pedidos, Detalle) y el badge de la pestaña leen de aquí.
// Además detecta pedidos NUEVOS asignados y avisa con el sonido propio.
interface RiderDataValue {
  orders: RiderOrder[]
  loading: boolean
  error: boolean
  reload: () => void
}

const Ctx = createContext<RiderDataValue | null>(null)

export function RiderDataProvider({ riderId, children }: { riderId: number; children: ReactNode }) {
  const { orders, loading, error, reload } = useRiderOrders(riderId)
  const knownIds = useRef<Set<number>>(new Set())
  const detectionReady = useRef(false)

  // Sonido al llegar un pedido nuevo asignado (a partir de la segunda carga)
  useEffect(() => {
    if (loading) return
    const ids = new Set((orders || []).map((o) => o.id))
    if (detectionReady.current) {
      const nuevos = (orders || []).filter((o) => !knownIds.current.has(o.id))
      if (nuevos.length > 0) {
        playRiderAssignedSound()
        buzz([80, 40, 80])
      }
    } else {
      detectionReady.current = true
    }
    ids.forEach((x) => knownIds.current.add(x))
  }, [orders, loading])

  const value = useMemo(
    () => ({ orders, loading, error, reload }),
    [orders, loading, error, reload],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useRiderData(): RiderDataValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRiderData debe usarse dentro de <RiderDataProvider>')
  return v
}
