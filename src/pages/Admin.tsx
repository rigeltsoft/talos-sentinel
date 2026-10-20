import { useState } from 'react'
import { createPortal } from 'react-dom'
import { trpc } from '@/providers/trpc'
import { BUSINESS_TYPE_LABELS, type BusinessType } from '@/types'
import PasswordField from '@/components/dashboard/PasswordField'
import ConfirmModal from '@/components/dashboard/ConfirmModal'
import { useAuth } from '@/hooks/useAuth'

export interface EditableUser {
  id: number
  name: string | null
  email: string | null
  businessName: string | null
  businessType: BusinessType | null
  phoneNumberId?: string | null
}

// Modal de edición de un usuario: nombre, correo y datos del negocio.
function EditUserModal({ user, onClose, onSaved }: { user: EditableUser; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user.name ?? '')
  const [email, setEmail] = useState(user.email ?? '')
  const [businessName, setBusinessName] = useState(user.businessName ?? '')
  const [businessType, setBusinessType] = useState<BusinessType>(user.businessType ?? 'restaurante')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [msg, setMsg] = useState('')

  const updateUser = trpc.admin.updateUser.useMutation({
    onSuccess: () => { onSaved(); onClose() },
    onError: (err) => setMsg(err.message),
  })

  function save() {
    setMsg('')
    if (name.trim().length < 2) { setMsg('El nombre es obligatorio'); return }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setMsg('Correo inválido'); return }
    updateUser.mutate({
      userId: user.id,
      name: name.trim(),
      email: email.trim(),
      ...(businessName.trim().length >= 2 ? { businessName: businessName.trim(), businessType } : {}),
      ...(phoneNumberId.trim() ? { phoneNumberId: phoneNumberId.trim() } : {}),
    })
  }

  const host = (typeof document !== 'undefined' && document.querySelector<HTMLElement>('.tsen')) || document.body

  return createPortal(
    <div className="cm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true">
      <div className="cm-card" style={{ maxWidth: 480 }}>
        <div className="cm-head">
          <h3 className="cm-title">Editar usuario</h3>
          <button className="cm-x" onClick={onClose} title="Cerrar">✕</button>
        </div>
        <div className="cm-body">
          {msg && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#e11d48' }}>{msg}</p>}
          <div className="field">
            <label>Nombre del propietario</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Correo (usuario de ingreso)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Nombre del negocio</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="(sin negocio)" />
          </div>
          <div className="field">
            <label>Tipo de negocio</label>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType)}>
              {Object.entries(BUSINESS_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Phone Number ID de WhatsApp (opcional)</label>
            <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Dejar vacío para no cambiarlo" />
          </div>
        </div>
        <div className="cm-foot">
          <button className="btn ghost" onClick={onClose} disabled={updateUser.isPending}>Cancelar</button>
          <button className="btn" onClick={save} disabled={updateUser.isPending}>
            {updateUser.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>,
    host,
  )
}

function NuevoUsuarioPanel({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('restaurante')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)

  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      setOk(true)
      setMsg(`Usuario ${email} creado con su dashboard. Entrégale el correo y la contraseña temporal.`)
      setName(''); setEmail(''); setPassword(''); setBusinessName(''); setPhoneNumberId('')
      onCreated()
    },
    onError: (err) => { setOk(false); setMsg(err.message) },
  })

  function submit() {
    setMsg('')
    createUser.mutate({
      name: name.trim(),
      email: email.trim(),
      password,
      businessName: businessName.trim(),
      businessType,
      phoneNumberId: phoneNumberId.trim() || undefined,
    })
  }

  return (
    <div className="panel">
      <div className="cardHeader"><h2>Crear usuario + negocio</h2></div>
      <p className="muted" style={{ margin: '4px 0 14px' }}>
        El usuario ingresa con su correo y esta contraseña temporal, y verá únicamente
        el dashboard de su negocio (en modo en vivo contra la API de n8n).
      </p>
      {msg && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: ok ? '#2a9d8f' : '#e11d48' }}>{msg}</p>
      )}
      <div className="field">
        <label>Nombre del propietario</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: María López" />
      </div>
      <div className="field">
        <label>Correo electrónico (será su usuario de ingreso)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@surestaurante.com" />
      </div>
      <div className="field">
        <label>Contraseña temporal (mínimo 6 caracteres)</label>
        <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Se la puedes dictar o enviar por WhatsApp" autoComplete="new-password" />
      </div>
      <div className="field">
        <label>Nombre del negocio</label>
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ej: Pizzería La Esquina" />
      </div>
      <div className="field">
        <label>Tipo de negocio</label>
        <select value={businessType} onChange={(e) => setBusinessType(e.target.value as BusinessType)}>
          {Object.entries(BUSINESS_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Phone Number ID de WhatsApp (Meta) — opcional, lo puede configurar el usuario</label>
        <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Ej: 1004464636088971" />
      </div>
      <button className="btn" onClick={submit} disabled={createUser.isPending}>
        {createUser.isPending ? 'Creando…' : 'Crear usuario y negocio'}
      </button>
    </div>
  )
}

function UsuariosPanel() {
  const { user: me } = useAuth()
  const listQuery = trpc.admin.listUsers.useQuery(undefined, { retry: false })
  const [resetFor, setResetFor] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [borrar, setBorrar] = useState<{ id: number; name: string | null; email: string | null; businessName: string | null } | null>(null)
  const [editar, setEditar] = useState<EditableUser | null>(null)
  const [q, setQ] = useState('')

  const resetPassword = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      setMsg('Contraseña restablecida. Entrégasela al usuario por un canal seguro.')
      setResetFor(null); setNewPassword('')
    },
    onError: (err) => setMsg(err.message),
  })

  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { setMsg('Rol actualizado.'); listQuery.refetch() },
    onError: (err) => { setMsg(err.message); listQuery.refetch() },
  })

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => { setMsg('Usuario eliminado.'); listQuery.refetch() },
    onError: (err) => setMsg(err.message),
  })

  if (listQuery.error) {
    return (
      <div className="panel">
        <div className="cardHeader"><h2>Usuarios de la plataforma</h2></div>
        <p className="muted" style={{ marginTop: 10 }}>
          Esta sección es exclusiva del administrador de Talos Sentinel.
        </p>
      </div>
    )
  }

  const allRows = listQuery.data ?? []
  const rows = q.trim()
    ? allRows.filter((u) => {
        const t = q.trim().toLowerCase()
        return (
          (u.name ?? '').toLowerCase().includes(t) ||
          (u.email ?? '').toLowerCase().includes(t) ||
          (u.businessName ?? '').toLowerCase().includes(t)
        )
      })
    : allRows

  return (
    <div className="panel">
      <div className="cardHeader">
        <h2>Usuarios registrados ({rows.length}{q ? ` de ${allRows.length}` : ''})</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="admin-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, correo o negocio…"
          />
          <button className="btn" onClick={() => listQuery.refetch()}>Actualizar</button>
        </div>
      </div>
      {msg && <p className="muted" style={{ margin: '8px 0 0' }}>{msg}</p>}
      <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <td>Usuario</td>
            <td>Correo</td>
            <td>Rol</td>
            <td>Negocio</td>
            <td style={{ textAlign: 'center' }}>Clave local</td>
            <td style={{ textAlign: 'end' }}>Último ingreso</td>
            <td style={{ textAlign: 'end' }}>Acción</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.name ?? '—'}</strong></td>
              <td>{u.email ?? <span className="muted">sin correo</span>}</td>
              <td>
                <select
                  className="role-select"
                  value={u.role ?? 'user'}
                  disabled={u.id === me?.id || setRole.isPending}
                  title={u.id === me?.id ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                  onChange={(e) => setRole.mutate({ userId: u.id, role: e.target.value as 'user' | 'admin' })}
                >
                  <option value="user">Usuario (negocio)</option>
                  <option value="admin">Admin (plataforma)</option>
                </select>
              </td>
              <td>
                {u.businessName ?? <span className="muted">sin negocio</span>}
                {u.businessType && (
                  <><br /><span className="muted">{BUSINESS_TYPE_LABELS[u.businessType]}</span></>
                )}
              </td>
              <td style={{ textAlign: 'center' }}>{u.hasPassword ? '✔' : '—'}</td>
              <td style={{ textAlign: 'end' }}>
                <span className="muted">{new Date(u.lastSignInAt).toLocaleDateString('es-CO')}</span>
              </td>
              <td style={{ textAlign: 'end' }}>
                {resetFor === u.id ? (
                  <span className="reset-row">
                    <PasswordField
                      style={{ width: 150, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12 }}
                      placeholder="Nueva clave"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <button className="btn sm" disabled={newPassword.length < 6 || resetPassword.isPending}
                      onClick={() => resetPassword.mutate({ userId: u.id, newPassword })}>
                      Guardar
                    </button>
                    <button className="btn sm ghost" onClick={() => { setResetFor(null); setNewPassword('') }}>
                      ✕
                    </button>
                  </span>
                ) : (
                  <span className="reset-row">
                    <button className="btn sm ghost" onClick={() => { setEditar({ id: u.id, name: u.name, email: u.email, businessName: u.businessName, businessType: u.businessType, phoneNumberId: u.phoneNumberId }); setMsg('') }}>
                      Editar
                    </button>
                    <button className="btn sm ghost" onClick={() => { setResetFor(u.id); setMsg('') }}>
                      Restablecer clave
                    </button>
                    <button
                      className="btn sm danger"
                      disabled={u.id === me?.id || deleteUser.isPending}
                      title={u.id === me?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                      onClick={() => setBorrar({ id: u.id, name: u.name, email: u.email, businessName: u.businessName })}
                    >
                      Eliminar
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && !listQuery.isLoading && (
            <tr><td colSpan={7} style={{ textAlign: 'center' }}><span className="muted">Aún no hay usuarios</span></td></tr>
          )}
        </tbody>
      </table>
      </div>

      {editar && (
        <EditUserModal
          user={editar}
          onClose={() => setEditar(null)}
          onSaved={() => { setMsg('Datos actualizados.'); listQuery.refetch() }}
        />
      )}

      <ConfirmModal
        open={!!borrar}
        danger
        title="Eliminar usuario"
        confirmLabel="Sí, eliminar"
        message={
          borrar ? (
            <>
              ¿Eliminar a <strong>{borrar.name ?? borrar.email}</strong>?
              {borrar.businessName
                ? <> También se eliminará su negocio <strong>{borrar.businessName}</strong> (los pedidos históricos quedan guardados).</>
                : ' No tiene negocio asociado.'}
            </>
          ) : null
        }
        onClose={() => setBorrar(null)}
        onConfirm={async () => {
          const target = borrar
          if (!target) return
          try {
            await deleteUser.mutateAsync({ userId: target.id })
          } finally {
            setBorrar(null)
          }
        }}
      />
    </div>
  )
}

// Cambio de la propia contraseña del super usuario (la consola admin no pasa
// por Configuración porque esa vive dentro del dashboard de un negocio).
function MiCuentaPanel() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setOk(true)
      setMsg('Contraseña actualizada. Úsala en tu próximo ingreso.')
      setCurrent(''); setNext(''); setConfirm('')
    },
    onError: (err) => { setOk(false); setMsg(err.message) },
  })

  function submit() {
    setMsg('')
    if (next.length < 6) { setOk(false); setMsg('La nueva contraseña debe tener al menos 6 caracteres'); return }
    if (next !== confirm) { setOk(false); setMsg('La confirmación no coincide'); return }
    changePassword.mutate({ currentPassword: current, newPassword: next })
  }

  return (
    <div className="panel">
      <div className="cardHeader"><h2>Mi contraseña</h2></div>
      <p className="muted" style={{ margin: '4px 0 14px' }}>
        Cuenta: <strong style={{ color: 'var(--ink)' }}>{user?.email ?? 'sin correo'}</strong>
      </p>
      {msg && <p style={{ margin: '0 0 12px', fontSize: 13, color: ok ? '#2a9d8f' : '#e11d48' }}>{msg}</p>}
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
        {changePassword.isPending ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </div>
  )
}

export default function Admin() {
  const utils = trpc.useUtils()
  return (
    <div className="details">
      <NuevoUsuarioPanel onCreated={() => utils.admin.listUsers.invalidate()} />
      <UsuariosPanel />
      <MiCuentaPanel />
    </div>
  )
}
