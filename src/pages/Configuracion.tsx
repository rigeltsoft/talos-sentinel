import { useEffect, useState } from 'react'
import { useDashboard, useBusinessMutations } from '@/components/dashboard/DashboardContext'
import { THEME_OPTIONS, BUSINESS_TYPE_LABELS, type BusinessType, type ThemeId } from '@/types'
import { useAuth } from '@/hooks/useAuth'
import { trpc } from '@/providers/trpc'
import PasswordField from '@/components/dashboard/PasswordField'

function SeguridadPanel() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setOk(true)
      setMsg('Contraseña actualizada. Usa la nueva en tu próximo ingreso.')
      setCurrent(''); setNext(''); setConfirm('')
    },
    onError: (err) => { setOk(false); setMsg(err.message) },
  })

  function submit() {
    setMsg('')
    if (next !== confirm) { setOk(false); setMsg('La confirmación no coincide con la nueva contraseña'); return }
    changePassword.mutate({ currentPassword: current, newPassword: next })
  }

  const hasPassword = !!(user as { passwordHash?: string | null } | null)?.passwordHash

  return (
    <div className="panel">
      <div className="cardHeader"><h2>Seguridad de la cuenta</h2></div>
      <p className="muted" style={{ margin: '4px 0 14px' }}>
        Correo asociado: <strong style={{ color: 'var(--ink)' }}>{user?.email ?? 'sin correo'}</strong>.
        Si olvidas tu contraseña, el administrador puede restablecerla verificando este correo.
      </p>
      {!hasPassword && (
        <p className="muted" style={{ margin: '0 0 14px' }}>
          Tu cuenta aún no tiene contraseña local (cuenta antigua o migrada). Define una aquí para
          habilitar el ingreso con correo + contraseña — en ese caso el campo “actual” déjalo vacío solo esta vez.
        </p>
      )}
      {msg && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: ok ? '#2a9d8f' : '#e11d48' }}>{msg}</p>
      )}
      <div className="field">
        <label>Contraseña actual</label>
        <PasswordField autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="field">
        <label>Nueva contraseña (mínimo 6 caracteres)</label>
        <PasswordField autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="field">
        <label>Confirmar nueva contraseña</label>
        <PasswordField autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <button className="btn" onClick={submit} disabled={changePassword.isPending || !next}>
        Cambiar contraseña
      </button>
    </div>
  )
}

export default function Configuracion() {
  const { biz } = useDashboard()
  const { update, setTheme } = useBusinessMutations()
  const [name, setName] = useState(biz.name)
  const [type, setType] = useState<BusinessType>(biz.type)
  const [phoneNumberId, setPhoneNumberId] = useState(biz.phoneNumberId ?? '')
  const [apiBase, setApiBase] = useState(biz.apiBase)
  const [liveMode, setLiveMode] = useState(biz.liveMode)
  const [chatwootBaseUrl, setChatwootBaseUrl] = useState(biz.chatwootBaseUrl ?? '')
  const [chatwootAccountId, setChatwootAccountId] = useState(biz.chatwootAccountId ? String(biz.chatwootAccountId) : '')
  const [chatwootInboxId, setChatwootInboxId] = useState(biz.chatwootInboxId ? String(biz.chatwootInboxId) : '')
  const [promoTemplate, setPromoTemplate] = useState(biz.promoTemplate ?? '')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setName(biz.name); setType(biz.type)
    setPhoneNumberId(biz.phoneNumberId ?? '')
    setApiBase(biz.apiBase); setLiveMode(biz.liveMode)
    setChatwootBaseUrl(biz.chatwootBaseUrl ?? '')
    setChatwootAccountId(biz.chatwootAccountId ? String(biz.chatwootAccountId) : '')
    setChatwootInboxId(biz.chatwootInboxId ? String(biz.chatwootInboxId) : '')
    setPromoTemplate(biz.promoTemplate ?? '')
  }, [biz])

  async function save() {
    setMsg('')
    try {
      await update.mutateAsync({
        name, type,
        phoneNumberId: phoneNumberId || undefined,
        apiBase, liveMode,
        chatwootBaseUrl: chatwootBaseUrl.trim() || undefined,
        chatwootAccountId: chatwootAccountId ? Number(chatwootAccountId) : undefined,
        chatwootInboxId: chatwootInboxId ? Number(chatwootInboxId) : undefined,
        promoTemplate: promoTemplate.trim() || undefined,
      })
      setMsg('Configuración guardada')
    } catch {
      setMsg('No se pudo guardar')
    }
  }

  return (
    <div className="details">
      <div className="panel">
        <div className="cardHeader"><h2>Datos del negocio</h2></div>
        {msg && <p className="muted" style={{ margin: '8px 0 0' }}>{msg}</p>}
        <div className="field">
          <label>Nombre del negocio</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Tipo de negocio</label>
          <select value={type} onChange={(e) => setType(e.target.value as BusinessType)}>
            {Object.entries(BUSINESS_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Phone Number ID (WhatsApp Cloud API — Meta)</label>
          <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Ej: 1004464636088971" />
        </div>
        <div className="field">
          <label>Base URL de la API (webhooks n8n)</label>
          <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} />
        </div>
        <div className="field">
          <label>Chatwoot — Base URL</label>
          <input value={chatwootBaseUrl} onChange={(e) => setChatwootBaseUrl(e.target.value)}
            placeholder="https://chat.talos.example.com" />
        </div>
        <div className="field">
          <label>Chatwoot — Account ID</label>
          <input value={chatwootAccountId} onChange={(e) => setChatwootAccountId(e.target.value.replace(/\D/g, ''))}
            placeholder="1" inputMode="numeric" />
        </div>
        <div className="field">
          <label>Chatwoot — Inbox ID</label>
          <input value={chatwootInboxId} onChange={(e) => setChatwootInboxId(e.target.value.replace(/\D/g, ''))}
            placeholder="2" inputMode="numeric" />
        </div>
        <div className="field">
          <label>Template de promociones (Meta)</label>
          <input value={promoTemplate} onChange={(e) => setPromoTemplate(e.target.value)}
            placeholder="promocion_informativa_niche|es_CO" />
        </div>
        <p className="muted" style={{ margin: '-4px 0 12px' }}>
          Nombre del template aprobado en Meta que se usa al enviar promociones por WhatsApp.
          Formato: nombre|idioma_region (ej: promocion_informativa_niche|es_CO).
          Cada negocio debe tener su propio template aprobado con su marca.
        </p>
        <p className="muted" style={{ margin: '-4px 0 12px' }}>
          El token de la API de Chatwoot vive en el proxy de n8n; aquí solo se guardan la URL,
          la cuenta y el inbox que usa la página Conversaciones. La URL debe ser la base de la
          API (p. ej. https://chat.talos.example.com), sin el camino /app/accounts/...
        </p>
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={liveMode} onChange={(e) => setLiveMode(e.target.checked)} />
            Modo en vivo (consumir la API real; si está apagado, se muestran datos demo)
          </label>
        </div>
        <button className="btn" onClick={save} disabled={update.isPending}>Guardar cambios</button>
      </div>

      <div className="panel">
        <div className="cardHeader"><h2>Apariencia del dashboard</h2></div>
        <p className="muted" style={{ margin: '4px 0 14px' }}>
          El tema se guarda en tu negocio y aplica en todos tus dispositivos.
          Para restaurantes recomendamos el tema cálido: los tonos naranja y rojo
          estimulan el apetito y la urgencia de compra.
        </p>
        {THEME_OPTIONS.map((t) => (
          <div
            key={t.id}
            onClick={() => setTheme.mutate({ theme: t.id as ThemeId })}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
              borderRadius: 12, cursor: 'pointer', marginBottom: 8,
              border: biz.theme === t.id ? '2px solid var(--hover-ink)' : '1px solid var(--line)',
              background: 'var(--bg)',
            }}
          >
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: t.swatch, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{t.label}</div>
              {biz.theme === t.id && <span className="muted">Tema actual</span>}
            </div>
          </div>
        ))}
      </div>

      <SeguridadPanel />
    </div>
  )
}
