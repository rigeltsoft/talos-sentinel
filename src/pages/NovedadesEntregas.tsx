import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { fetchDeliveries } from '@/lib/api'
import type { DeliveryEvidenceItem } from '@/lib/api'
import Spinner from '@/components/dashboard/Spinner'
import {
  CheckCircle2, TriangleAlert, Camera, Inbox, RefreshCw,
  MapPin, MessageCircle, Phone, X, ImageOff,
} from 'lucide-react'

const cop = (n: number | null | undefined) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n || 0)

function waDigits(phone?: string | null): string {
  const d = (phone || '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('57') ? d : '57' + d
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  delivered: { label: 'Entregado', color: '#16a34a' },
  no_answer: { label: 'No abrieron', color: '#d97706' },
  problem: { label: 'Problema', color: '#dc2626' },
}

type Filter = 'all' | 'issue' | 'ok'

// Pestaña "Novedades y evidencia" de Domiciliarios: entrega/novedad que registra
// cada domiciliario desde su app (nota + foto). Fuente: GET /dashboard/deliveries
// (delivery_evidence ⋈ orders ⋈ delivery_riders), filtrada por tenant.
export default function NovedadesEntregas() {
  const { biz } = useDashboard()
  const [items, setItems] = useState<DeliveryEvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [liveError, setLiveError] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [foto, setFoto] = useState<DeliveryEvidenceItem | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetchDeliveries(biz)
    setItems(res.data)
    setLiveError(!!res.error)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biz.id, biz.liveMode])

  const counts = useMemo(() => {
    const issue = items.filter((i) => i.delivery_status && i.delivery_status !== 'delivered').length
    const withPhoto = items.filter((i) => isUsablePhoto(i.photo_data)).length
    return { total: items.length, issue, withPhoto }
  }, [items])

  const visible = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'issue') return items.filter((i) => i.delivery_status && i.delivery_status !== 'delivered')
    return items.filter((i) => !i.delivery_status || i.delivery_status === 'delivered')
  }, [items, filter])

  const kpis = [
    { n: String(counts.total), l: 'Registros' },
    { n: String(counts.issue), l: 'Novedades', warn: counts.issue > 0 },
    { n: String(counts.withPhoto), l: 'Con foto' },
  ]

  return (
    <div className="panel nvl">
      <div className="cardHeader">
        <h2>
          Novedades y evidencia
          <span className="muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
            Notas y fotos que registran los domiciliarios al entregar
          </span>
        </h2>
        <button className="btn sm ghost" onClick={() => void load()} disabled={loading} title="Actualizar">
          <RefreshCw size={14} style={{ verticalAlign: 'middle' }} /> Actualizar
        </button>
      </div>

      {!biz.liveMode && (
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
          Activa el <strong>Modo en vivo</strong> en Configuración para ver las entregas registradas por tus domiciliarios.
        </p>
      )}
      {liveError && (
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13, color: '#b45309' }}>
          ⚠️ La API no respondió (¿n8n apagado, CORS o Cloudflare Access?). Mostrando lo último cargado.
        </p>
      )}

      <div className="nvl-kpis">
        {kpis.map((k) => (
          <div className="mon-kpi" key={k.l}>
            <div className="n" style={k.warn ? { color: '#b45309' } : undefined}>{k.n}</div>
            <div className="l">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="nvl-filters">
        {([
          ['all', `Todas (${counts.total})`],
          ['issue', `Con novedad (${counts.issue})`],
          ['ok', 'Entregadas'],
        ] as Array<[Filter, string]>).map(([f, label]) => (
          <button key={f} className={`nvl-chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 && <Spinner center label="Cargando entregas…" />}

      {!loading && items.length === 0 && (
        <div className="empty-state" style={{ padding: '28px 12px' }}>
          <Inbox size={34} className="ic-muted" />
          <div className="empty-title">Sin registros todavía</div>
          <div className="empty-sub">
            Cuando un domiciliario registra una entrega o novedad (con nota o foto) desde su app, aparece aquí.
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <div className="nvl-grid">
          {visible.map((ev) => {
            const meta = STATUS_META[ev.delivery_status || ''] || { label: ev.delivery_status || '—', color: '#6b7280' }
            const digits = waDigits(ev.customer_phone)
            const total = cop((ev.total || 0) + (ev.shipping_cost || 0))
            const photoOk = isUsablePhoto(ev.photo_data)
            return (
              <div className="nvl-card" key={`${ev.evidence_id}-${ev.delivered_at}`}>
                <div className="nvl-top">
                  <span className="nvl-id">Pedido #{ev.order_id}</span>
                  <span className="nvl-status" style={{ color: meta.color, borderColor: meta.color }}>
                    {meta.label}
                  </span>
                </div>
                <div className="nvl-cust">{ev.customer_name || 'Cliente'}</div>
                <div className="nvl-meta">
                  {ev.rider_name && <span className="il"><CheckCircle2 size={12} /> {ev.rider_name}</span>}
                  <span className="il muted">{ev.delivered_at_formatted || ev.delivered_at || ''}</span>
                </div>
                <div className="nvl-addr"><MapPin size={12} /> {ev.delivery_address || 'Sin dirección'}</div>
                <div className="nvl-total muted">{total}</div>

                {ev.notes && (
                  <div className="nvl-note">
                    <span className="nvl-note-lbl"><TriangleAlert size={12} /> Nota del domiciliario</span>
                    <span className="nvl-note-txt">{ev.notes}</span>
                  </div>
                )}

                <div className="nvl-bottom">
                  {photoOk ? (
                    <button className="nvl-photo" onClick={() => setFoto(ev)} title="Ver foto de evidencia">
                      <img src={ev.photo_data as string} alt={`Evidencia pedido ${ev.order_id}`} loading="lazy" />
                      <span className="nvl-photo-cap"><Camera size={12} /> Ver foto</span>
                    </button>
                  ) : ev.photo_data ? (
                    <span className="nvl-photo-broken" title="Foto guardada incompleta (bug de truncado anterior al 2026-09-05)">
                      <ImageOff size={14} /> Foto no disponible
                    </span>
                  ) : null}

                  {digits && (
                    <span className="nvl-contact">
                      <a className="btn sm ghost" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" title="Escribir al cliente por WhatsApp">
                        <MessageCircle size={14} style={{ verticalAlign: 'middle' }} />
                      </a>
                      <a className="btn sm ghost" href={`tel:${digits}`} title="Llamar al cliente"><Phone size={14} style={{ verticalAlign: 'middle' }} /></a>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && items.length > 0 && visible.length === 0 && (
        <p className="muted" style={{ margin: '12px 2px 0' }}>Sin resultados con este filtro.</p>
      )}

      {foto && (
        <div className="nvl-lightbox" onClick={() => setFoto(null)} role="dialog" aria-modal="true">
          <div className="nvl-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="nvl-lightbox-head">
              <span>
                Evidencia · Pedido #{foto.order_id} · {foto.customer_name || ''}
                {foto.rider_name ? ` · ${foto.rider_name}` : ''}
              </span>
              <button className="btn sm ghost" onClick={() => setFoto(null)} aria-label="Cerrar">
                <X size={16} style={{ verticalAlign: 'middle' }} />
              </button>
            </div>
            <img src={foto.photo_data as string} alt={`Evidencia pedido ${foto.order_id}`} />
            {foto.notes && <p className="nvl-lightbox-note">{foto.notes}</p>}
            <p className="nvl-lightbox-meta muted">{foto.delivered_at_formatted || foto.delivered_at || ''}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function isUsablePhoto(photo: string | null | undefined): boolean {
  if (!photo) return false
  // data-URL completo de imagen: empieza por data:image y tiene suficiente longitud.
  return photo.startsWith('data:image') && photo.length > 100
}
