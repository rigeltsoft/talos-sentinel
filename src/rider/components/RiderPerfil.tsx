import { useState } from 'react'
import { Hash, Store, Lock, BellRing, Smartphone, LocateFixed, Bike } from 'lucide-react'
import { useRider } from '../RiderContext'
import { riderLocation, riderUpdateToken } from '../lib/riderApi'
import { setLastPosition, useLastPosition } from '../lib/lastPosition'
import { isSoundEnabled, setSoundEnabled, primeAudio } from '@/lib/notify'
import { canPush, pushPermission, requestWebPushToken } from '@/lib/fcm'
import { initials } from './format'

// /rider/perfil — perfil del domiciliario (UI v2): identidad, negocio, estado
// de la cuenta, sonidos, ubicación manual y cierre de sesión.
export default function RiderPerfil() {
  const { session, logout } = useRider()
  const [locMsg, setLocMsg] = useState('')
  const [soundOn, setSoundOn] = useState(isSoundEnabled())
  const [pushMsg, setPushMsg] = useState('')
  const [pushBusy, setPushBusy] = useState(false)
  const lastPos = useLastPosition()
  // Dentro del WebView Android (Restaurante DemoRider) las notificaciones son NATIVAS
  // (window.AndroidBridge / window._fcmToken): no se ofrece push web.
  const isNativeApp =
    typeof window !== 'undefined' && !!(window as unknown as { AndroidBridge?: unknown }).AndroidBridge

  // Activa las notificaciones del SISTEMA (navegador/tablet/PC vía FCM web).
  // En el WebView Android el token nativo se registra solo (bridge AndroidBridge).
  async function activateSystemPush() {
    if (pushBusy || !session) return
    setPushBusy(true)
    setPushMsg('')
    const res = await requestWebPushToken()
    if (res.token) {
      try {
        await riderUpdateToken(session.rider.id, res.token)
        setPushMsg('✅ Notificaciones del sistema activadas: llegarán avisos aunque cierres la app.')
      } catch {
        setPushMsg('No se pudo guardar el token en el servidor.')
      }
    } else {
      setPushMsg(res.error || 'No se pudo activar.')
    }
    setPushBusy(false)
  }

  if (!session) return null

  const { rider, tenant } = session

  // Reporte manual de ubicación (útil si el GPS automático fue denegado o
  // quieres aparecer al instante en el mapa del panel)
  function shareLocation() {
    if (!('geolocation' in navigator)) {
      setLocMsg('Tu dispositivo no tiene GPS.')
      return
    }
    setLocMsg('Buscando tu ubicación…')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await riderLocation(rider.id, pos.coords.latitude, pos.coords.longitude)
          setLastPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setLocMsg('✅ Ubicación enviada: ya apareces en el mapa del panel.')
        } catch {
          setLocMsg('No se pudo enviar la ubicación.')
        }
      },
      () => setLocMsg('Permiso denegado: activa la ubicación en el navegador e inténtalo otra vez.'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    )
  }

  return (
    <div className="rider-page">
      <div className="profile-hero">
        <div className="profile-avatar">{initials(rider.name)}</div>
        <div className="profile-name">{rider.name}</div>
        <div className="profile-tenant">{tenant.name}</div>
        <span className={`profile-status ${rider.is_active ? '' : 'off'}`}>
          <span
            className="dot-live"
            style={{ background: rider.is_active ? '#22c55e' : '#ef4444' }}
          />
          {rider.is_active ? 'Disponible para entregas' : 'Inactivo — contacta a tu negocio'}
        </span>
      </div>

      <div className="info-card">
        <div className="info-card-title">Mi cuenta</div>
        <div className="info-row">
          <div className="info-icon"><Hash size={17} /></div>
          <div>
            <div className="info-label">ID de domiciliario</div>
            <div className="info-value">#{rider.id}</div>
          </div>
        </div>
        <div className="info-row">
          <div className="info-icon"><Store size={17} /></div>
          <div>
            <div className="info-label">Negocio</div>
            <div className="info-value">{tenant.name}</div>
          </div>
        </div>
        <div className="info-row">
          <div className="info-icon"><Lock size={17} /></div>
          <div>
            <div className="info-label">PIN de acceso</div>
            <div className="info-value">
              Lo administra tu negocio desde el panel (Domiciliarios). Si olvidaste el PIN,
              pídelo a tu encargado.
            </div>
          </div>
        </div>
      </div>

      {/* Sonido de notificaciones */}
      <div className="info-card">
        <div className="info-card-title">Notificaciones</div>
        <div className="info-row">
          <div className="info-icon"><BellRing size={17} /></div>
          <div style={{ flex: 1 }}>
            <div className="info-label">Sonido de pedido asignado</div>
            <div className="info-value" style={{ fontWeight: 600 }}>
              {soundOn ? 'Activado' : 'Silenciado'}
            </div>
          </div>
          <button
            className="rbtn"
            onClick={() => {
              primeAudio()
              setSoundEnabled(!soundOn)
              setSoundOn(!soundOn)
            }}
            style={{ padding: '7px 12px', fontSize: 12 }}
          >
            {soundOn ? 'Silenciar' : 'Activar'}
          </button>
        </div>
        {!isNativeApp && canPush() ? (
          <div className="info-row">
            <div className="info-icon"><Smartphone size={17} /></div>
            <div style={{ flex: 1 }}>
              <div className="info-label">Notificaciones del sistema (push)</div>
              <div className="info-value" style={{ fontWeight: 400, fontSize: 12.5 }}>
                {pushMsg ||
                  (pushPermission() === 'denied'
                    ? 'Permiso denegado en el navegador: actívalo en la configuración del sitio para este dispositivo.'
                    : 'Recibe el aviso del pedido asignado aunque cierres o minimices la app (navegador / tablet / PC).')}
              </div>
            </div>
            <button
              className="rbtn"
              disabled={pushBusy || pushPermission() === 'denied'}
              onClick={activateSystemPush}
              style={{ padding: '7px 12px', fontSize: 12 }}
            >
              {pushBusy ? '…' : 'Activar'}
            </button>
          </div>
        ) : (
          <div className="info-row">
            <div className="info-icon"><Smartphone size={17} /></div>
            <div>
              <div className="info-label">Notificaciones push</div>
              <div className="info-value" style={{ fontWeight: 400, fontSize: 12.5 }}>
                Activas automáticamente por la app nativa (Firebase): recibirás el aviso del pedido asignado aunque la app esté cerrada.
              </div>
            </div>
          </div>
        )}
      </div>

      <button className="rbtn profile-locate" onClick={shareLocation}>
        <LocateFixed size={16} /> Compartir mi ubicación ahora
      </button>
      {locMsg && <p className="profile-loc-msg">{locMsg}</p>}
      {lastPos && (
        <p className="profile-loc-msg" style={{ marginTop: 4 }}>
          Última reportada: {lastPos.lat.toFixed(6)}, {lastPos.lng.toFixed(6)}
        </p>
      )}

      <button className="rbtn rbtn-danger profile-logout" onClick={logout}>
        Cerrar sesión
      </button>

      <p className="profile-foot"><Bike size={13} /> Talos Sentinel · App de domiciliarios</p>
    </div>
  )
}
