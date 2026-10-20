import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { Bike, ClipboardList, UserRound } from 'lucide-react'
import { useRider } from '../RiderContext'
import { RiderDataProvider, useRiderData } from '../RiderDataContext'
import { useRiderLocation } from '../hooks/useRiderLocation'
import { primeAudio } from '@/lib/notify'
import { initials } from './format'

// Chip de estado en el header: "Disponible" o "En reparto · n"
function RiderHeaderChip() {
  const { orders, loading } = useRiderData()
  const n = loading ? 0 : orders.length
  return (
    <span className={`rchip ${n > 0 ? 'busy' : ''}`}>
      <span className="rchip-dot" />
      {n > 0 ? `En reparto · ${n}` : 'Disponible'}
    </span>
  )
}

// Pestañas inferiores (leen el badge del contexto de pedidos compartido)
function RiderTabs() {
  const { orders, loading } = useRiderData()
  const active = loading ? 0 : orders.length
  return (
    <nav className="rider-tabs">
      <NavLink to="/rider/pedidos" className={({ isActive }) => `rider-tab ${isActive ? 'active' : ''}`}>
        <span className="rider-tab-icon">
          <Bike size={21} />
          {active > 0 && <em className="rider-tab-count">{active}</em>}
        </span>
        Pedidos
      </NavLink>
      <NavLink to="/rider/historial" className={({ isActive }) => `rider-tab ${isActive ? 'active' : ''}`}>
        <span className="rider-tab-icon">
          <ClipboardList size={21} />
        </span>
        Historial
      </NavLink>
      <NavLink to="/rider/perfil" className={({ isActive }) => `rider-tab ${isActive ? 'active' : ''}`}>
        <span className="rider-tab-icon">
          <UserRound size={21} />
        </span>
        Perfil
      </NavLink>
    </nav>
  )
}

// Layout móvil de la app del rider (UI v2): header con gradiente del tema del
// negocio, GPS en vivo y 3 pestañas inferiores (Pedidos / Historial / Perfil).
// Sin sesión válida redirige al login solo-PIN.
export default function RiderShell() {
  const { session } = useRider()
  const location = useLocation()

  // GPS en vivo mientras haya sesión (lo consume el mapa del dashboard).
  useRiderLocation(!!session, session?.rider.id ?? null)

  // Despierta el audio en el primer gesto del usuario (permite los sonidos)
  useEffect(() => {
    const prime = () => primeAudio()
    document.addEventListener('pointerdown', prime, { once: true })
    document.addEventListener('keydown', prime, { once: true })
    return () => {
      document.removeEventListener('pointerdown', prime)
      document.removeEventListener('keydown', prime)
    }
  }, [])

  // En el detalle de un pedido no se muestran las pestañas inferiores: la
  // barra de acciones ("Marcar como entregado") ocupa todo el ancho inferior.
  const hideTabs = location.pathname.startsWith('/rider/pedido/')

  // El fondo del <body> debe seguir el tema activo (igual que ShellFrame).
  useEffect(() => {
    if (!session) return
    const root = document.querySelector<HTMLElement>('.rider-app')
    document.body.style.backgroundColor =
      root ? getComputedStyle(root).getPropertyValue('--bg').trim() : '#f5f6fa'
    return () => {
      document.body.style.backgroundColor = ''
    }
  }, [session?.tenant.theme, session])

  if (!session) return <Navigate to="/rider/login" replace />

  const { rider, tenant } = session

  return (
    <div className={`tsen theme-${tenant.theme} rider-app`} key={tenant.theme}>
      <RiderDataProvider riderId={rider.id}>
        <header className="rider-header">
          <div className="rider-header-info">
            <div className="rider-avatar">{initials(rider.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="rider-header-name">{rider.name}</div>
              <div className="rider-header-sub">{tenant.name}</div>
            </div>
          </div>
          <RiderHeaderChip />
        </header>

        <div className="rider-frame">
          <Outlet />
        </div>

        {!hideTabs && <RiderTabs />}
      </RiderDataProvider>
    </div>
  )
}
