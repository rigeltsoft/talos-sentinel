import { useState } from 'react'
import { Megaphone, Users, History, Trash2, Send } from 'lucide-react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { sendPromo, deletePromoHistory, unsubscribeSubscriber } from '@/lib/api'
import InfoTip from '@/components/dashboard/InfoTip'
import Spinner from '@/components/dashboard/Spinner'
import ConfirmModal from '@/components/dashboard/ConfirmModal'
import type { PromoHistoryItem } from '@/types'

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n || 0)

export default function Promociones() {
  const { subscribers, promoHistory, biz, reload, loading } = useDashboard()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [delTarget, setDelTarget] = useState<PromoHistoryItem | null>(null)
  const [bajaTarget, setBajaTarget] = useState<{ phone: string; name: string } | null>(null)

  async function handleSend() {
    if (!title.trim() || !description.trim()) {
      setMsg('Título y descripción son requeridos')
      return
    }
    setBusy(true); setMsg('')
    try {
      await sendPromo(biz, title.trim(), description.trim())
      setMsg(`Promoción enviada en lotes de 10 a ${fmtNum(subscribers.length)} suscriptores`)
      setTitle(''); setDescription('')
      reload()
    } catch {
      setMsg('La API no respondió')
    } finally {
      setBusy(false)
    }
  }

  function askDelete(h: PromoHistoryItem) {
    if (h.id == null) return
    setDelTarget(h)
  }

  const lastSent = promoHistory[0]?.sent_at
  const stats = [
    { icon: <Users size={22} />, n: fmtNum(subscribers.length), l: 'Suscriptores activos' },
    { icon: <Megaphone size={22} />, n: fmtNum(promoHistory.length), l: 'Promos enviadas' },
    {
      icon: <History size={22} />,
      n: lastSent ? new Date(lastSent).toLocaleDateString('es-CO') : '—',
      l: 'Último envío',
    },
  ]

  return (
    <>
      {/* Resumen */}
      <div className="panel">
        <div className="cardHeader"><h2>Promociones<InfoTip text="Envía ofertas por WhatsApp a tus suscriptores (quienes aceptaron promociones) usando el template aprobado en Meta. El historial guarda tus envíos y puedes depurarlo." /></h2></div>
        <div className="mon-kpis" style={{ marginTop: 4 }}>
          {stats.map((s) => (
            <div className="mon-kpi" key={s.l}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: 'var(--brand)' }}>{s.icon}</span>
                <div>
                  <div className="n">{s.n}</div>
                  <div className="l">{s.l}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 1. Nueva promoción */}
      <div className="panel">
        <div className="cardHeader">
          <h2><span style={{ display: 'inline-flex', gap: 6, verticalAlign: 'middle' }}><Send size={18} /> Nueva promoción</span><InfoTip text="Crea el mensaje y se envía por WhatsApp a tus suscriptores en lotes de 10 con el template aprobado (campaña de marketing)." /></h2>
        </div>
        <p className="muted" style={{ margin: '4px 0 14px' }}>
          Se envía por WhatsApp con el template aprobado en Meta, en lotes de 10.
        </p>
        <div className="field">
          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: 2x1 en Pizzas" />
        </div>
        <div className="field">
          <label>Descripción</label>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Este fin de semana todas las pizzas al 2x1…" />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleSend} disabled={busy || subscribers.length === 0} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            {busy ? <Spinner size={15} /> : <Send size={15} />}
            {busy ? 'Enviando…' : `Enviar a ${fmtNum(subscribers.length)} suscriptores`}
          </button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </div>

      {/* 2. Suscriptores */}
      <div className="panel">
        <div className="cardHeader"><h2><Users size={18} /> Suscriptores activos ({fmtNum(subscribers.length)})<InfoTip text="Clientes que pidieron un pedido y aceptaron recibir promociones por WhatsApp." /></h2></div>
        {loading && subscribers.length === 0 ? (
          <Spinner center label="Cargando suscriptores…" />
        ) : subscribers.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-icon">👥</div>
            <div className="empty-title">Sin suscriptores aún</div>
            <div className="empty-sub">Aparecerán aquí los clientes que acepten recibir promociones.</div>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <td>Nombre</td>
                  <td>Teléfono</td>
                  <td style={{ textAlign: 'end' }}>Suscripción</td>
                  <td style={{ textAlign: 'end' }}>Acción</td>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.phone_number}>
                    <td>{s.customer_name}</td>
                    <td>{s.phone_number}</td>
                    <td style={{ textAlign: 'end' }}><span className="muted">{new Date(s.opted_in_at).toLocaleDateString('es-CO')}</span></td>
                    <td style={{ textAlign: 'end' }}>
                      <button
                        className="btn sm danger"
                        title="Dar de baja: dejará de recibir promociones"
                        onClick={() => setBajaTarget({ phone: s.phone_number, name: s.customer_name })}
                      >
                        Dar de baja
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Historial */}
      <div className="panel">
        <div className="cardHeader"><h2><History size={18} /> Historial de promociones ({fmtNum(promoHistory.length)})<InfoTip text="Registro de tus envíos. Puedes eliminar una fila para depurar el listado (no revoca el WhatsApp ya enviado)." /></h2></div>
        {loading && promoHistory.length === 0 ? (
          <Spinner center label="Cargando historial…" />
        ) : promoHistory.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-icon">📭</div>
            <div className="empty-title">Sin promociones enviadas</div>
            <div className="empty-sub">Tus campañas aparecerán aquí.</div>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <td>Título</td>
                  <td>Descripción</td>
                  <td style={{ textAlign: 'center' }}>Enviados</td>
                  <td style={{ textAlign: 'end' }}>Fecha</td>
                  <td style={{ textAlign: 'end' }}>Acción</td>
                </tr>
              </thead>
              <tbody>
                {promoHistory.map((h) => (
                  <tr key={h.id ?? `${h.title}-${h.sent_at}`}>
                    <td><strong>{h.title}</strong></td>
                    <td><span className="muted">{h.description}</span></td>
                    <td style={{ textAlign: 'center' }}>{fmtNum(h.sent_count)}</td>
                    <td style={{ textAlign: 'end' }}><span className="muted">{new Date(h.sent_at).toLocaleString('es-CO')}</span></td>
                    <td style={{ textAlign: 'end' }}>
                      {h.id != null && (
                        <button
                          className="btn sm danger"
                          disabled={deleting === h.id}
                          onClick={() => askDelete(h)}
                          title="Eliminar del historial"
                        >
                          {deleting === h.id ? <Spinner size={13} /> : <Trash2 size={13} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!bajaTarget}
        danger
        title="Dar de baja suscriptor"
        confirmLabel="Sí, dar de baja"
        message={
          bajaTarget ? (
            <>¿Dar de baja a <strong>{bajaTarget.name}</strong> ({bajaTarget.phone})? Dejará de recibir promociones por WhatsApp.</>
          ) : null
        }
        onClose={() => setBajaTarget(null)}
        onConfirm={async () => {
          const t = bajaTarget
          if (!t) return
          try {
            await unsubscribeSubscriber(biz, t.phone)
            setMsg('Suscriptor dado de baja')
            reload()
          } catch {
            setMsg('No se pudo dar de baja. Verifica n8n / Cloudflare Access.')
          } finally {
            setBajaTarget(null)
          }
        }}
      />

      <ConfirmModal
        open={!!delTarget}
        danger
        title="Eliminar del historial"
        confirmLabel="Sí, eliminar"
        message={
          delTarget ? (
            <>¿Eliminar del historial <strong>"{delTarget.title}"</strong>? Solo se borra el registro; el envío de WhatsApp ya ocurrió.</>
          ) : null
        }
        onClose={() => setDelTarget(null)}
        onConfirm={async () => {
          const h = delTarget
          if (!h || h.id == null) return
          setDeleting(h.id)
          try {
            await deletePromoHistory(biz, h.id)
            setMsg('Promoción eliminada del historial')
            reload()
          } catch {
            setMsg('No se pudo eliminar. Verifica n8n / Cloudflare Access.')
          } finally {
            setDeleting(null)
            setDelTarget(null)
          }
        }}
      />
    </>
  )
}
