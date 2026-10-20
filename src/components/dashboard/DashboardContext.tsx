import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { trpc } from '@/providers/trpc'
import { fetchOrders, fetchRiders, fetchSubscribers, fetchPromoHistory } from '@/lib/api'
import { playNewOrderSound, primeAudio } from '@/lib/notify'
import type { BizConfig, Order, Rider, PromoSubscriber, PromoHistoryItem } from '@/types'

interface DashboardData {
  biz: BizConfig
  orders: Order[]
  riders: Rider[]
  subscribers: PromoSubscriber[]
  promoHistory: PromoHistoryItem[]
  live: boolean
  apiError: boolean
  loading: boolean
  search: string
  setSearch: (s: string) => void
  reload: () => void
}

const Ctx = createContext<DashboardData | null>(null)

export function useDashboard() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDashboard fuera del provider')
  return v
}

interface Props {
  biz: BizConfig
  children: ReactNode
}

export function DashboardProvider({ biz, children }: Props) {
  const [orders, setOrders] = useState<Order[]>([])
  const [riders, setRiders] = useState<Rider[]>([])
  const [subscribers, setSubscribers] = useState<PromoSubscriber[]>([])
  const [promoHistory, setPromoHistory] = useState<PromoHistoryItem[]>([])
  const [live, setLive] = useState(false)
  const [apiError, setApiError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Detección de pedidos nuevos para el sonido de notificación.
  // Solo suena en modo en vivo y a partir de la segunda carga (evita el "ding" inicial).
  const knownOrderIds = useRef<Set<number>>(new Set())
  const detectionReady = useRef(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const [o, r, s, h] = await Promise.all([
      fetchOrders(biz), fetchRiders(biz), fetchSubscribers(biz), fetchPromoHistory(biz),
    ])
    setOrders(o.data); setRiders(r.data)
    setSubscribers(s.data); setPromoHistory(h.data)
    setLive(o.live)
    setApiError(!!(o.error || r.error || s.error || h.error))
    setLoading(false)

    // Sonido: pedido pendiente/por verificar que no existía antes
    if (o.live && detectionReady.current) {
      const nuevos = (o.data || []).filter(
        (ord) =>
          (ord.status === 'pending' || ord.status === 'awaiting_verification') &&
          !knownOrderIds.current.has(ord.id),
      )
      if (nuevos.length > 0) playNewOrderSound()
    }
    ;(o.data || []).forEach((ord) => knownOrderIds.current.add(ord.id))
    detectionReady.current = true
  }, [biz])

  useEffect(() => { reload() }, [reload])

  // Refresco cada 15s como el dashboard original de Restaurante Demo
  useEffect(() => {
    const t = setInterval(reload, 15000)
    return () => clearInterval(t)
  }, [reload])

  // Los navegadores exigen un gesto del usuario para permitir audio:
  // al primer clic/tecla del usuario se crea y activa el contexto de audio.
  useEffect(() => {
    const prime = () => primeAudio()
    document.addEventListener('pointerdown', prime, { once: true })
    document.addEventListener('keydown', prime, { once: true })
    return () => {
      document.removeEventListener('pointerdown', prime)
      document.removeEventListener('keydown', prime)
    }
  }, [])

  const value = useMemo(
    () => ({ biz, orders, riders, subscribers, promoHistory, live, apiError, loading, search, setSearch, reload }),
    [biz, orders, riders, subscribers, promoHistory, live, apiError, loading, search, reload],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// Hook para mutaciones tRPC del negocio con refresco automatico
export function useBusinessMutations() {
  const utils = trpc.useUtils()
  const setTheme = trpc.business.setTheme.useMutation({
    onSuccess: () => utils.business.mine.invalidate(),
  })
  const update = trpc.business.update.useMutation({
    onSuccess: () => utils.business.mine.invalidate(),
  })
  const create = trpc.business.create.useMutation({
    onSuccess: () => utils.business.mine.invalidate(),
  })
  return { setTheme, update, create }
}
