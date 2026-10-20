import { useMemo, useRef, useState } from 'react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import {
  toggleRider, createRider, updateRider, deleteRider, assignRider,
} from '@/lib/api'
import type { Rider, Order } from '@/types'
import InfoTip from '@/components/dashboard/InfoTip'
import Spinner from '@/components/dashboard/Spinner'
import ConfirmModal from '@/components/dashboard/ConfirmModal'
import AlertModal from '@/components/dashboard/AlertModal'
import { Wallet, Smartphone, Bike, Phone, MessageCircle, Clock, TriangleAlert, Copy, Check, ClipboardList, Radio } from 'lucide-react'
import RiderMap from '@/components/dashboard/RiderMap'
import NovedadesEntregas from '@/pages/NovedadesEntregas'

const cop = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)

// Normaliza un teléfono para WhatsApp/llamadas: agrega el prefijo Colombia 57
// si el número es nacional (10 dígitos) y no lo trae ya.
function waDigits(phone?: string | null): string {
  const d = (phone || '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('57') ? d : '57' + d
}

// Minutos transcurridos desde una fecha ISO (Infinity si no hay fecha)
function minAgo(iso?: string | null): number {
  if (!iso) return Infinity
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return Infinity
  return Math.max(0, (Date.now() - t) / 60000)
}

function agoLabel(iso?: string | null): string {
  const m = minAgo(iso)
  if (!Number.isFinite(m)) return ''
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${Math.round(m)} min`
  const h = Math.floor(m / 60)
  return `hace ${h} h ${Math.round(m % 60)} min`
}

const MIN_RETRASO = 45 // minutos en ruta antes de marcar posible retraso
const MAX_SIN_SENAL = 5 // minutos sin reportar GPS para considerar señal perdida

export default function Domiciliarios() {
  const { riders, orders, biz, reload, loading } = useDashboard()
  const [tab, setTab] = useState<'monitoreo' | 'novedades'>('monitoreo')
  const [editing, setEditing] = useState<Rider | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [asignarA, setAsignarA] = useState<Record<number, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<Rider | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)

  // ── Monitoreo: métricas del momento ──
  const delivering = useMemo(() => orders.filter((o) => o.status === 'delivering'), [orders])
  const riderById = useMemo(() => {
    const m = new Map<number, Rider>()
    riders.forEach((r) => m.set(r.id, r))
    return m
  }, [riders])

  const activos = riders.filter((r) => r.is_active)
  const enRuta = riders.filter((r) => (r.active_orders || 0) > 0)
  const conSenal = riders.filter((r) => r.last_seen_at && minAgo(r.last_seen_at) <= MAX_SIN_SENAL)
  const entregados24h = riders.reduce((a, r) => a + (r.total_delivered || 0), 0)
  const sinRider = delivering.filter((o) => !o.rider_id)
  const retrasados = delivering.filter((o) => minAgo(o.created_at) >= MIN_RETRASO)
  const sinSenal = enRuta.filter((r) => !r.last_seen_at || minAgo(r.last_seen_at) > MAX_SIN_SENAL)

  const kpis = [
    { n: String(delivering.length), l: 'En ruta ahora', extra: sinRider.length ? `${sinRider.length} sin asignar` : '' },
    { n: String(enRuta.length), l: 'Domiciliarios con entrega' },
    { n: String(activos.length), l: 'Activos', extra: conSenal.length ? `${conSenal.length} con señal` : 'sin señal GPS' },
    { n: String(entregados24h), l: 'Entregados 24 h' },
  ]

  const alerts: string[] = []
  if (sinRider.length) alerts.push(`${sinRider.length} pedido(s) en ruta SIN domiciliario asignado.`)
  if (sinSenal.length) alerts.push(`${sinSenal.length} domiciliario(s) con entregas llevan +${MAX_SIN_SENAL} min sin reportar GPS (revisa su app).`)
  if (retrasados.length) alerts.push(`${retrasados.length} pedido(s) llevan +${MIN_RETRASO} min en ruta.`)

  // ── CRUD domiciliarios (igual que antes) ──
  function startEdit(r: Rider) {
    setEditing(r)
    setName(r.name)
    setPhone(r.phone || '')
    setPin('')
    setMsg('')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  function cancelEdit() {
    setEditing(null)
    setName(''); setPhone(''); setPin('')
  }
  async function handleSave() {
    if (!name.trim()) { setMsg('Nombre requerido'); return }
    if (!editing && !/^\d{4}$/.test(pin)) { setMsg('PIN de 4 dígitos requerido'); return }
    if (editing && pin && !/^\d{4}$/.test(pin)) { setMsg('El PIN debe tener 4 dígitos'); return }
    setBusy(true); setMsg('')
    try {
      const res = editing
        ? await updateRider(biz, editing.id, name.trim(), pin || undefined, phone.trim() || undefined)
        : await createRider(biz, name.trim(), pin, phone.trim() || undefined)
      // El servidor puede responder success:false (p. ej. PIN ya en uso por otro negocio)
      if (res && (res as { success?: boolean }).success === false) {
        const e = (res as { error?: string }).error || 'No se pudo guardar. Verifica los datos.'
        setAlertMsg(e)
        setMsg('')
        return
      }
      setMsg(editing ? 'Domiciliario actualizado' : 'Domiciliario creado')
      cancelEdit()
      reload()
    } catch {
      setMsg('La API no respondió')
    } finally {
      setBusy(false)
    }
  }
  async function handleToggle(id: number, isActive: boolean) {
    try {
      const res = await toggleRider(biz, id, !isActive)
      if (res && (res as { success?: boolean }).success === false) {
        setMsg((res as { error?: string }).error || 'No se pudo cambiar el estado')
        return
      }
      reload()
    } catch {
      setMsg('La API no respondió')
    }
  }
  function askDelete(r: Rider) {
    setDeleteTarget(r)
  }

  // Copia el enlace de WhatsApp del domiciliario (wa.me/<número>)
  async function copyWaLink(r: Rider) {
    const digits = waDigits(r.phone)
    if (!digits) return
    try {
      await navigator.clipboard.writeText(`https://wa.me/${digits}`)
      setCopied(r.id)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      setMsg('No se pudo copiar el enlace')
    }
  }

  // Asignación rápida desde el tablero de pedidos en ruta
  async function handleAssign(order: Order) {
    const riderId = Number(asignarA[order.id])
    if (!riderId) return
    setMsg('')
    try {
      await assignRider(biz, order.id, riderId)
      setAsignarA((p) => ({ ...p, [order.id]: '' }))
      setMsg(`Pedido #${order.id} asignado`)
      reload()
    } catch {
      setMsg('No se pudo asignar el domiciliario')
    }
  }

  const sortedDelivering = [...delivering].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  return (
    <div className="details full">
      <div className="dom-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'monitoreo'}
          className={`dom-tab ${tab === 'monitoreo' ? 'on' : ''}`}
          onClick={() => setTab('monitoreo')}
        >
          <Radio size={15} /> Monitoreo en vivo
        </button>
        <button
          role="tab"
          aria-selected={tab === 'novedades'}
          className={`dom-tab ${tab === 'novedades' ? 'on' : ''}`}
          onClick={() => setTab('novedades')}
        >
          <ClipboardList size={15} /> Novedades y evidencia
        </button>
      </div>

      {tab === 'monitoreo' && (
        <>
      {/* KPIs del momento */}
      <div className="panel">
                <div className="cardHeader">
          <h2>Monitoreo en vivo<InfoTip text="Actualización automática cada 15 s con los datos de la app del domiciliario." /></h2>
        </div>
        {loading && riders.length === 0 && <Spinner center label="Cargando monitoreo…" />}
        <div className="mon-kpis">
          {kpis.map((k) => (
            <div className="mon-kpi" key={k.l}>
              <div className="n">{k.n}</div>
              <div className="l">{k.l}</div>
              {k.extra && <div className={`x ${k.extra.includes('sin asignar') || k.extra.includes('sin señal') ? 'warn' : ''}`}>{k.extra}</div>}
            </div>
          ))}
        </div>

        {/* Alertas consolidadas */}
        {alerts.length > 0 ? (
          <div className="mon-alerts">
            {alerts.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <TriangleAlert size={15} style={{ flexShrink: 0, color: '#b45309' }} />
                <span>{a}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: '10px 2px 0', fontSize: 13 }}>
            ✅ Todo en orden: cada pedido en ruta tiene domiciliario con señal GPS reciente.
          </p>
        )}
      </div>

      {/* Mapa en vivo */}
      <div className="panel">
        <div className="cardHeader">
          <h2>
            Mapa en vivo
            <InfoTip text="🛵 azul = domiciliario con su app abierta (reporta su posición cada ~15 s). 📍 rojo = destino de un pedido en ruta asignado. La línea punteada conecta cada domiciliario con sus destinos. Sin nadie reportando se muestra Colombia como referencia." />
          </h2>
        </div>
        <RiderMap riders={riders} orders={orders} />
      </div>

      {/* Tablero de pedidos en ruta */}
      <div className="panel">
        <div className="cardHeader">
          <h2>
            Pedidos en ruta ahora ({delivering.length})
            <InfoTip text="Ordenados del más antiguo al más reciente. El tiempo transcurrido ayuda a detectar retrasos; si un pedido no tiene domiciliario puedes asignarlo aquí mismo." />
          </h2>
        </div>
        {delivering.length === 0 && <p className="muted" style={{ margin: '4px 0 0' }}>Sin pedidos en ruta en este momento.</p>}
        {sortedDelivering.map((o) => {
          const rider = o.rider_id != null ? riderById.get(o.rider_id) : undefined
          const mins = minAgo(o.created_at)
          const late = mins >= MIN_RETRASO
          const isCash = o.payment_method === 'Efectivo'
          const total = cop(Number(o.total || 0) + Number(o.shipping_cost || 0))
          return (
            <div className={`inroute-card ${late ? 'late' : ''}`} key={o.id}>
              <div className="inroute-top">
                <span className="inroute-id">Pedido #{o.id}</span>
                <span className={`inroute-pay ${isCash ? 'cash' : 'digital'}`}>
                  {isCash ? (<span className="il"><Wallet size={12} />{total}</span>) : (<span className="il"><Smartphone size={12} />Ya pagó</span>)}
                </span>
              </div>
              <div className="inroute-cust">{o.customer_name}</div>
              <div className="inroute-addr">📍 {o.delivery_address || 'Sin dirección'}</div>
              <div className="inroute-meta">
                <span className={`il ${late ? 'late-txt' : ''}`}><Clock size={13} />{agoLabel(o.created_at)}{late && ' · posible retraso'}</span>
                {rider
                  ? <span className="il"><Bike size={13} />{rider.name}{!rider.is_active && ' (inactivo)'}</span>
                  : <span className="warn-txt"><TriangleAlert size={13} /> Sin domiciliario</span>}
              </div>
              {!rider && (
                <div className="inroute-assign">
                  <select
                    value={asignarA[o.id] || ''}
                    onChange={(e) => setAsignarA((p) => ({ ...p, [o.id]: e.target.value }))}
                  >
                    <option value="">Asignar a…</option>
                    {activos.filter((r) => (r.active_orders || 0) < 4).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.active_orders} en ruta)
                      </option>
                    ))}
                  </select>
                  <button className="btn sm" disabled={!asignarA[o.id]} onClick={() => handleAssign(o)}>
                    Asignar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lista de domiciliarios con señal */}
      <div className="panel">
        <div className="cardHeader">
          <h2>
            Domiciliarios
            <InfoTip text="Repartidores de tu negocio. 'Última señal' es cuándo reportó su GPS la última vez: si está en ruta y pasa de 5 min sin señal, revisa su app. Editar cambia nombre/PIN; Desactivar lo saca de rotación; Eliminar lo borra (sus pedidos en curso quedan sin rider)." />
          </h2>
        </div>
        {msg && <p className="muted" style={{ margin: '8px 0 0' }}>{msg}</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <td>Nombre</td>
                <td style={{ textAlign: 'center' }}>Contacto</td>
                <td style={{ textAlign: 'center' }}>En camino</td>
                <td style={{ textAlign: 'center' }}>Entregados 24 h</td>
                <td style={{ textAlign: 'center' }}>Última señal</td>
                <td style={{ textAlign: 'center' }}>Estado</td>
                <td style={{ textAlign: 'end' }}>Acción</td>
              </tr>
            </thead>
            <tbody>
              {riders.map((r) => {
                const onRoute = (r.active_orders || 0) > 0
                const stale = onRoute && (!r.last_seen_at || minAgo(r.last_seen_at) > MAX_SIN_SENAL)
                const digits = waDigits(r.phone)
                return (
                  <tr key={r.id}>
                    <td>{r.name}{!r.is_active && <span className="muted" style={{ fontSize: 11 }}> · inactivo</span>}
                      {r.phone && <span className="muted" style={{ fontSize: 11 }}><br />{r.phone}</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {digits ? (
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <a
                            className="btn sm"
                            href={`https://wa.me/${digits}`}
                            target="_blank"
                            rel="noreferrer"
                            title={`Escribir por WhatsApp a ${r.name}`}
                          ><MessageCircle size={14} style={{ verticalAlign: 'middle' }} /></a>
                          <a className="btn sm ghost" href={`tel:${digits}`} title={`Llamar a ${r.name}`}><Phone size={14} style={{ verticalAlign: 'middle' }} /></a>
                          <button
                            className={`btn sm ${copied === r.id ? '' : 'ghost'}`}
                            onClick={() => copyWaLink(r)}
                            title="Copiar enlace de WhatsApp (wa.me) para contactarlo fácil"
                          >
                            {copied === r.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </span>
                      ) : (
                        <button
                          className="btn sm ghost"
                          title="Agregar teléfono para poder contactar a este domiciliario"
                          onClick={() => {
                            startEdit(r)
                            setTimeout(() => phoneInputRef.current?.focus(), 200)
                          }}
                        >
                          + Tel
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>{r.active_orders}</td>
                    <td style={{ textAlign: 'center' }}>{r.total_delivered}</td>
                    <td style={{ textAlign: 'center' }}>
                      {r.last_seen_at
                        ? <span style={{ color: stale ? '#d97706' : 'var(--muted)', fontWeight: 600 }}>{agoLabel(r.last_seen_at)}</span>
                        : onRoute
                          ? <span style={{ color: '#d97706', fontWeight: 700 }}>⚠️ sin señal</span>
                          : <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status ${r.is_active ? 'delivered' : 'cancelled'}`}>
                        {r.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'end' }}>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn sm ghost" onClick={() => startEdit(r)}>Editar</button>
                        <button className={`btn sm ${r.is_active ? 'danger' : ''}`} onClick={() => handleToggle(r.id, r.is_active)}>
                          {r.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="btn sm danger" onClick={() => askDelete(r)}>Eliminar</button>
                      </span>
                    </td>
                  </tr>
                )
              })}
              {riders.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center' }}><span className="muted">Sin domiciliarios registrados</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" ref={formRef}>
        <div className="cardHeader"><h2>{editing ? `Editar: ${editing.name}` : 'Nuevo domiciliario'}</h2></div>
        <p className="muted" style={{ margin: '4px 0 14px' }}>
          El PIN se usa en el login de la app del rider (React /rider · Android).
          {editing && ' Deja el PIN vacío para conservar el actual.'}
        </p>
        <div className="field">
          <label>Nombre completo</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Juan Reyes" />
        </div>
        <div className="field">
          <label>Teléfono / WhatsApp (contacto del encargado)</label>
          <input
            ref={phoneInputRef}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ej: 3001234567"
            inputMode="tel"
          />
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Con este número el encargado podrá escribirle (💬 WhatsApp) y llamarle (📞) desde Domiciliarios.
          </p>
        </div>
        <div className="field">
          <label>PIN (4 dígitos)</label>
          <input value={pin} maxLength={4} inputMode="numeric" placeholder="1234"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleSave} disabled={busy}>
            {editing ? 'Guardar cambios' : 'Crear domiciliario'}
          </button>
          {editing && (
            <button className="btn ghost" onClick={cancelEdit}>Cancelar</button>
          )}
        </div>
      </div>

      <AlertModal
        open={!!alertMsg}
        title="Aviso"
        message={alertMsg}
        onClose={() => setAlertMsg(null)}
      />

      <ConfirmModal
        open={!!deleteTarget}
        danger
        title="Eliminar domiciliario"
        confirmLabel="Sí, eliminar"
        message={
          deleteTarget ? (
            <>¿Eliminar a <strong>{deleteTarget.name}</strong>? Sus pedidos en curso quedarán sin domiciliario asignado.</>
          ) : null
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const r = deleteTarget
          if (!r) return
          try {
            const res = await deleteRider(biz, r.id)
            if (res && (res as { success?: boolean }).success === false) {
              setMsg((res as { error?: string }).error || 'No se pudo eliminar')
              return
            }
            if (editing?.id === r.id) cancelEdit()
            reload()
            setMsg('Domiciliario eliminado')
          } catch {
            setMsg('La API no respondió')
          } finally {
            setDeleteTarget(null)
          }
        }}
      />
        </>
      )}

      {tab === 'novedades' && <NovedadesEntregas />}
    </div>
  )
}
