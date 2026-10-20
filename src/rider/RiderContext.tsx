import { createContext, useCallback, useContext, useMemo, useState, useEffect} from 'react'
import type { ReactNode } from 'react'
import { riderLogin, riderUpdateToken, setRiderToken } from './lib/riderApi'
import { resolveTenantMeta } from './lib/riderMeta'
import type { RiderSession } from './types/rider'

const STORAGE_KEY = 'talos.rider.session'

interface RiderContextValue {
  session: RiderSession | null
  ready: boolean
  busy: boolean
  error: string
  login: (pin: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<RiderContextValue | null>(null)

export function useRider() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useRider debe usarse dentro de <RiderProvider>')
  return v
}

function loadSession(): RiderSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RiderSession
    if (!parsed?.rider?.id || !parsed?.tenant?.id) return null
    // Restaura la identidad: sin esto, tras cerrar y abrir la app el token
    // quedaría vacío y (en modo estricto) el domiciliario no podría trabajar.
    if (parsed.rider.token) setRiderToken(parsed.rider.token)
    return parsed
  } catch {
    return null
  }
}

function persist(session: RiderSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else {
      localStorage.removeItem(STORAGE_KEY)
      setRiderToken(null) // al cerrar sesión se olvida la identidad
    }
  } catch {
    /* almacenamiento no disponible: sesión solo en memoria */
  }
}

// Registro FCM del WebView Android (best-effort, mismo contrato que rider.html)
function registerFcm(riderId: number) {
  const token =
    (window as unknown as { _fcmToken?: string })._fcmToken ??
    (window as unknown as { AndroidBridge?: { getFCMToken?: () => string } })
      .AndroidBridge?.getFCMToken?.()
  if (token) {
    riderUpdateToken(riderId, token).catch(() => {})
  }
}

export function RiderProvider({ children }: { children: ReactNode }) {
  // Si alguna llamada recibe 401 (token ausente o vencido) se cierra la sesión:
  // el domiciliario vuelve a la pantalla del PIN y obtiene un token nuevo.
  useEffect(() => {
    const alPerder = () => setSession(null)
    window.addEventListener('talos:rider-401', alPerder)
    return () => window.removeEventListener('talos:rider-401', alPerder)
  }, [])

  const [session, setSession] = useState<RiderSession | null>(() => loadSession())
  const [ready] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const login = useCallback(async (pin: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await riderLogin(pin)
      if (!res.success || !res.rider) {
        setError(res.error || 'PIN incorrecto. Intenta de nuevo.')
        return
      }
      const rider = res.rider
      const tenant = await resolveTenantMeta(rider.tenant_id)
      const next: RiderSession = { rider, tenant, savedAt: new Date().toISOString() }
      setSession(next)
      persist(next)
      registerFcm(rider.id)
    } catch {
      setError('No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
    persist(null)
  }, [])

  const value = useMemo(
    () => ({ session, ready, busy, error, login, logout }),
    [session, ready, busy, error, login, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
