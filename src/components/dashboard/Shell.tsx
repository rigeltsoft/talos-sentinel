import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  ShieldCheck, LayoutDashboard, ShoppingCart, Bike, Megaphone, Settings,
  BadgeDollarSign, BarChart3,
  Menu, Search, LogOut, Briefcase, Palette, TriangleAlert, MessageCircle,
  Bell, BellOff, BellRing,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'
import { DashboardProvider, useBusinessMutations, useDashboard } from '@/components/dashboard/DashboardContext'
import { isSoundEnabled, setSoundEnabled, primeAudio } from '@/lib/notify'
import { canPush, pushPermission, requestPushToken, nativePushToken, unsubscribeWebPush, isAndroidApp } from '@/lib/fcm'
import { updateManagerToken } from '@/lib/api'
import { THEME_OPTIONS, type ThemeId, type BizConfig } from '@/types'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { to: '/conversaciones', label: 'Conversaciones', icon: MessageCircle },
  { to: '/domiciliarios', label: 'Domiciliarios', icon: Bike },
  { to: '/promociones', label: 'Promociones', icon: Megaphone },
  { to: '/ventas', label: 'Ventas e Historial', icon: BadgeDollarSign },
  { to: '/analisis', label: 'Análisis', icon: BarChart3 },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

interface FrameProps {
  biz: BizConfig
  userName: string
  userEmail?: string | null
  userAvatar?: string | null
  userRole?: string
  onLogout: () => void
  onThemeChange: (t: ThemeId) => void
}

// Aviso visible cuando el negocio esta en modo en vivo pero la API no responde
function ApiErrorBanner() {
  const { apiError, biz } = useDashboard()
  if (!apiError || !biz.liveMode) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, margin: '12px 20px 0',
      padding: '10px 14px', borderRadius: 12, fontSize: 13,
      background: 'rgba(233,177,10,0.12)', border: '1px solid rgba(233,177,10,0.45)',
      color: 'var(--ink)',
    }}>
      <TriangleAlert size={17} style={{ color: '#e9b10a', flexShrink: 0 }} />
      <span>
        No se pudo conectar con la API de n8n — ves datos de ejemplo.
        Revisa la <Link to="/configuracion" style={{ color: 'inherit', fontWeight: 700 }}>URL en Configuración</Link> o Cloudflare Access.
      </span>
    </div>
  )
}

export function ShellFrame({ biz, userName, userEmail, userAvatar, userRole, onLogout, onThemeChange }: FrameProps) {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useIsMobile()
  const rootRef = useRef<HTMLDivElement>(null)

  // El fondo del <body> debe seguir al tema activo: sin esto, la franja de la
  // barra de scroll vertical (gutter, ~15px) muestra el fondo oscuro del body
  // en el borde derecho cuando la página hace scroll.
  useEffect(() => {
    const el = rootRef.current
    if (el) {
      document.body.style.backgroundColor =
        getComputedStyle(el).getPropertyValue('--bg').trim() || '#f5f6fa'
    }
  }, [biz.theme])

  return (
    <div
      ref={rootRef}
      className={`tsen theme-${biz.theme}`}
      key={biz.theme}
      style={{ width: '100%', minHeight: '100vh', background: 'var(--bg)' }}
    >
            {/* Overlay oscuro en móvil cuando el menú está abierto */}
      {isMobile && collapsed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 999,
          }}
          onClick={() => setCollapsed(false)}
        />
      )}
      <div className="container" style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg)' }}>
        <div className={`navigation ${collapsed ? 'active' : ''}`}>
          <ul>
            <li className="brand-item">
              <a>
                <span className="icon"><ShieldCheck /></span>
                <span className="title" style={{ fontWeight: 700 }}>{biz.name}</span>
              </a>
            </li>
            {NAV.map((item) => {
              const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
              return (
                <li key={item.to} className={active ? 'hovered' : ''}>
                  <Link
                    to={item.to}
                    onClick={() => {
                      if (isMobile && collapsed) setCollapsed(false)
                    }}
                  >
                    <span className="icon"><item.icon /></span>
                    <span className="title">{item.label}</span>
                  </Link>
                </li>
              )
            })}
            {userRole === 'admin' && (
              <li className={location.pathname.startsWith('/admin') ? 'hovered' : ''}>
                <Link
                  to="/admin"
                  onClick={() => {
                    if (isMobile && collapsed) setCollapsed(false)
                  }}
                >
                  <span className="icon"><Briefcase /></span>
                  <span className="title">Usuarios</span>
                </Link>
              </li>
            )}
          </ul>
        </div>

        <div className={`main ${collapsed ? 'active' : ''}`} style={{ background: 'var(--bg)', minHeight: '100vh', flex: 1 }}>
          <DashboardProvider biz={biz}>
            <Topbar
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              biz={biz}
              onToggle={() => setCollapsed((v) => !v)}
              collapsed={collapsed}
              onLogout={onLogout}
              onThemeChange={onThemeChange}
            />
            <ApiErrorBanner />
            <Outlet />
          </DashboardProvider>
        </div>
      </div>
    </div>
  )
}

function Topbar({ userName, userEmail, userAvatar, biz, onToggle, collapsed, onLogout, onThemeChange }: {
  userName: string
  userEmail?: string | null
  userAvatar?: string | null
  biz: BizConfig
  onToggle: () => void
  collapsed: boolean
  onLogout: () => void
  onThemeChange: (t: ThemeId) => void
}) {
  const { live, apiError, search, setSearch } = useDashboard()
  const [menuOpen, setMenuOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [pushOn, setPushOn] = useState(() => localStorage.getItem('talos:push-manager') === '1')
  const [pushBusy, setPushBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // ── Notificaciones del encargado ───────────────────────────────────────────
  // En la app Android (WebView) el token que sirve es el NATIVO que expone el
  // bridge; en navegador/PC es el de push web. `requestPushToken()` elige bien.
  // El token se guarda por NEGOCIO en `/manager/update-token` (tenant_id del
  // usuario logueado), así que dos negocios no se pisan entre sí.
  useEffect(() => {
    // Registra el token del encargado al abrir el panel.
    // · App Android (WebView): el token NATIVO es la vía correcta y la app ya
    //   pidió el permiso de notificaciones al instalar → se registra siempre,
    //   sin depender del interruptor (el WebView no soporta push web y el botón
    //   ni se muestra ahí). Así el servidor siempre tiene el token vigente.
    // · Navegador/PC: no hay token nativo; lo registra el interruptor.
    if (!biz.liveMode) return
    let cancelado = false
    let intentos = 0
    const registrar = () => {
      if (cancelado) return
      const token = nativePushToken()
      if (token) {
        void updateManagerToken(biz, token).catch(() => undefined)
        // Refleja el estado en el interruptor (informativo).
        if (!pushOn) {
          localStorage.setItem('talos:push-manager', '1')
          setPushOn(true)
        }
        return
      }
      // El bridge puede tardar un instante en inyectar el token: reintentamos.
      if (++intentos < 10) window.setTimeout(registrar, 1500)
    }
    registrar()
    return () => {
      cancelado = true
    }
  }, [pushOn, biz])

  // Activa/desactiva las notificaciones push del sistema (app Android / navegador).
  // El token del encargado se registra vía POST /manager/update-token.
  async function togglePush() {
    if (pushBusy) return
    setPushBusy(true)
    try {
      if (pushOn) {
        // Al apagar: si el token era de push web lo borramos; el nativo lo
        // regenera la app sola, así que no se toca desde aquí.
        if (!nativePushToken()) await unsubscribeWebPush()
        localStorage.removeItem('talos:push-manager')
        setPushOn(false)
      } else {
        const res = await requestPushToken()
        if (res.token) {
          await updateManagerToken(biz, res.token)
          localStorage.setItem('talos:push-manager', '1')
          setPushOn(true)
          if (biz.liveMode) primeAudio()
        } else if (res.error) {
          window.alert(res.error)
        }
      }
    } catch {
      window.alert('No se pudo activar las notificaciones del sistema.')
    } finally {
      setPushBusy(false)
    }
  }

  const initials = (userName || biz.name || 'U')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  // El buscador filtra pedidos y lleva directo a la lista al escribir
  function handleSearch(value: string) {
    setSearch(value)
    if (value.trim() && location.pathname !== '/pedidos') {
      navigate('/pedidos')
    }
  }

  return (
    <div className="topbar">
      <div className="toggle" onClick={onToggle} title={collapsed ? 'Expandir menú' : 'Contraer menú'}>
        <Menu />
      </div>

      <div className="search">
        <label>
          <input
            type="text"
            placeholder="Buscar pedido, cliente, teléfono… (Enter para ver)"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && location.pathname !== '/pedidos') navigate('/pedidos')
            }}
          />
          <Search />
        </label>
      </div>

      <div className="topbar-right">
        <span className="live-pill" title={apiError && biz.liveMode ? 'La API no responde' : ''}>
          <span className={`dot ${live ? 'on' : 'off'}`} />
          {live ? 'API en vivo' : apiError && biz.liveMode ? 'API sin conexión' : 'Modo demo'}
        </span>

        {/* Sonido de notificación de pedidos nuevos */}
        <button
          onClick={() => {
            primeAudio()
            setSoundEnabled(!soundOn)
            setSoundOn(!soundOn)
          }}
          title={soundOn ? 'Silenciar notificaciones' : 'Activar sonido de pedidos nuevos'}
          style={{
            width: 38,
            height: 38,
            padding: 0,
            borderRadius: '50%',
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: soundOn ? 'var(--brand)' : 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {soundOn ? <Bell size={16} /> : <BellOff size={16} />}
        </button>

        {/* Notificaciones push del NAVEGADOR. En la app Android NO se muestra:
            allí las maneja Android (FCM nativo, permiso pedido al instalar) y el
            panel registra el token solo, así que un botón aquí solo confundiría
            (y el WebView no soporta push web: daba "push service error"). */}
        {!isAndroidApp() && canPush() && (
          <button
            onClick={togglePush}
            disabled={pushBusy}
            title={
              nativePushToken()
                ? 'Notificaciones de la app activadas (las gestiona Android)'
                : pushOn
                  ? 'Notificaciones del sistema activadas (clic para desactivar)'
                  : pushPermission() === 'denied'
                    ? 'Permiso denegado en el navegador: actívalo en la configuración del sitio'
                    : 'Activar notificaciones del sistema (recibe avisos aunque no tengas la app abierta)'
            }
            style={{
              width: 38,
              height: 38,
              padding: 0,
              borderRadius: '50%',
              border: '1px solid var(--line)',
              background: 'var(--surface)',
              color: (pushOn || nativePushToken()) ? 'var(--brand)' : pushPermission() === 'denied' ? '#e11d48' : 'var(--muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              opacity: pushBusy ? 0.6 : 1,
            }}
          >
            <BellRing size={16} />
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <div className="user" onClick={() => { setMenuOpen((v) => !v); setThemeOpen(false) }}>
            {userAvatar ? <img src={userAvatar} alt="" /> : initials}
          </div>
          {menuOpen && (
            <div className="menu-pop" onMouseLeave={() => setMenuOpen(false)}>
              <div className="menu-title">
                {userName} · {biz.name}
                {userEmail && <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.75 }}>{userEmail}</div>}
              </div>
              <div className="menu-item" onClick={() => setThemeOpen((v) => !v)}>
                <Palette /> Apariencia del dashboard
              </div>
              {themeOpen && (
                <div className="theme-row">
                  {THEME_OPTIONS.map((t) => (
                    <div
                      key={t.id}
                      title={t.label}
                      className={`theme-dot ${biz.theme === t.id ? 'selected' : ''}`}
                      style={{ background: t.swatch }}
                      onClick={() => onThemeChange(t.id as ThemeId)}
                    />
                  ))}
                </div>
              )}
              <div className="menu-item" onClick={onLogout}>
                <LogOut /> Cerrar sesión
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Shell() {
  const { user, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true })
  const bizQuery = trpc.business.mine.useQuery(undefined, { enabled: !!user, retry: false })
  const { setTheme } = useBusinessMutations()

  const biz = bizQuery.data as BizConfig | null | undefined

  if (isLoading || (user && bizQuery.isLoading)) {
    return (
      <div className="tsen theme-purpura" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Cargando tu espacio de trabajo…</p>
      </div>
    )
  }

  if (user && !biz) {
    // Super usuario (role admin) sin negocio propio: entra directo a la
    // consola de administración (Usuarios/negocios) en vez de forzar Onboarding.
    if (user.role === 'admin') return <AdminFrame userName={user.name} userEmail={user.email} onLogout={logout} />
    return <Navigate to="/onboarding" replace />
  }
  if (!biz) return null

  return (
    <ShellFrame
      biz={biz}
      userName={user?.name ?? 'Usuario'}
      userEmail={user?.email}
      userAvatar={user?.avatar}
      userRole={user?.role}
      onLogout={logout}
      onThemeChange={(t) => setTheme.mutate({ theme: t })}
    />
  )
}

// Consola del super usuario (rol admin) cuando aún no tiene un negocio asignado:
// topbar + barra lateral colapsable (móvil) con "Usuarios y negocios" y cierre de
// sesión, sin exigir tenant. Solo existe la ruta /admin dentro de este marco.
function AdminFrame({ userName, userEmail, onLogout }: { userName?: string | null; userEmail?: string | null; onLogout: () => void }) {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(!isMobile)

  useEffect(() => { setOpen(!isMobile) }, [isMobile])

  if (location.pathname !== '/admin') return <Navigate to="/admin" replace />

  const initials = (userName || userEmail || 'A')
    .split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="tsen theme-talos" style={{ width: '100%', minHeight: '100vh', background: 'var(--bg)' }}>
      {isMobile && open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999 }}
          onClick={() => setOpen(false)}
        />
      )}
      <div className="container" style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg)' }}>
        <div className={`navigation ${isMobile && open ? 'active' : ''}`}>
          <ul>
            <li className="brand-item">
              <a>
                <span className="icon"><ShieldCheck /></span>
                <span className="title" style={{ fontWeight: 700 }}>Talos Sentinel · Admin</span>
              </a>
            </li>
            <li className={location.pathname === '/admin' ? 'hovered' : ''}>
              <Link to="/admin" onClick={() => { if (isMobile) setOpen(false) }}>
                <span className="icon"><Briefcase /></span>
                <span className="title">Usuarios y negocios</span>
              </Link>
            </li>
            <li>
              <a style={{ cursor: 'pointer' }} onClick={onLogout}>
                <span className="icon"><LogOut /></span>
                <span className="title">Cerrar sesión</span>
              </a>
            </li>
          </ul>
        </div>

        <div className="main" style={{ flex: 1, minWidth: 0, minHeight: '100vh', background: 'var(--bg)' }}>
          <div className="topbar">
            <div className="toggle" onClick={() => setOpen((v) => !v)} title={open ? 'Ocultar menú' : 'Mostrar menú'}>
              <Menu />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Administración de la plataforma
            </div>
            <div className="topbar-right">
              <div className="user" title={`${userName ?? ''}${userEmail ? ` · ${userEmail}` : ''}`}>{initials}</div>
            </div>
          </div>
          <div style={{ padding: '16px 18px 28px' }}>
            <p className="muted" style={{ margin: '0 0 14px', fontSize: 13 }}>
              Sesión de administración: <strong style={{ color: 'var(--ink)' }}>{userEmail ?? 'sin correo'}</strong>
              {' · '}Los módulos de pedidos, ventas y domiciliarios aparecen cuando la cuenta tiene un negocio asignado.
            </p>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
