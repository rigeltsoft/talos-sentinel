import { useEffect, useMemo, useState } from 'react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { fetchAnalytics, fetchInsight, type AnalyticsData } from '@/lib/api'
import InfoTip from '@/components/dashboard/InfoTip'
import { fmt } from '@/components/dashboard/bits'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

const DOW_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const BLUE = '#1e40af'
const LIGHT = '#93c5fd'
const AMBER = '#f59e0b'

// Cache por tenant: el insight NO se regenera al volver a la página (ahorra tokens).
const insightCache = new Map<number, string>()

export default function Analisis() {
  const { biz } = useDashboard()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [insight, setInsight] = useState<string | null>(() => insightCache.get(biz.id) ?? null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState('')

  const load = () => {
    setLoading(true)
    fetchAnalytics(biz).then((res) => {
      setData(res.data)
      setError(res.error ? 'No se pudo cargar el análisis. Verifica n8n / Cloudflare Access.' : '')
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [biz]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadInsight = () => {
    setInsightLoading(true)
    setInsightError('')
    fetchInsight(biz).then((res) => {
      if (res.error && !res.data) {
        setInsightError('No se pudo generar el análisis. Inténtalo de nuevo en unos segundos.')
      } else {
        setInsight(res.data)
        insightCache.set(biz.id, res.data)
      }
      setInsightLoading(false)
    })
  }

  const summary = useMemo(() => {
    if (!data) return null
    const totalPedidos = data.byDay.reduce((s, d) => s + (d.pedidos || 0), 0)
    const top = [...data.products].sort((a, b) => b.cantidad - a.cantidad)[0]
    const mejorDia = [...data.byDay].sort((a, b) => b.pedidos - a.pedidos)[0]
    const mejorHora = [...data.byHour].sort((a, b) => b.pedidos - a.pedidos)[0]
    const baja = [...data.products].sort((a, b) => a.cantidad - b.cantidad).slice(0, 3)
    return { totalPedidos, top, mejorDia, mejorHora, baja }
  }, [data])

  if (loading && !data) {
    return (
      <div className="details full">
        <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
          <div className="muted">Cargando análisis…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="details full">
      <div className="panel">
        <div className="cardHeader">
          <h2>
            Análisis de ventas
            <InfoTip text="Análisis de los últimos 30 días: productos más vendidos, días y horas de mayor demanda, y zonas que más piden. Útil para decidir qué promociones enviar y cuándo." />
          </h2>
          <button className="btn" onClick={load}>Actualizar</button>
        </div>

        {error && <p style={{ margin: '12px 0', fontSize: 13, color: '#e11d48' }}>⚠️ {error}</p>}

        {/* Insight IA */}
        <div style={{
          marginTop: 14,
          padding: '16px 20px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #1e3a8a, #1e40af)',
          color: '#fff',
          boxShadow: '0 10px 30px rgba(30,64,175,.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              🤖 Analiza tu negocio con IA
              <InfoTip text="Genera un análisis automático de tus ventas de los últimos 30 días: qué se vende más, qué producto necesita un empujón, qué promoción conviene lanzar y en qué día/hora. Como tener un asesor comercial." />
            </h3>
            <button
              className="btn"
              style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.4)' }}
              onClick={loadInsight}
              disabled={insightLoading}
            >
              {insightLoading ? 'Analizando…' : insight ? '↻ Analizar de nuevo' : '🤖 Analizar mi negocio'}
            </button>
          </div>
          {insightLoading && !insight ? (
            <div style={{ fontSize: 13, opacity: .85 }}>Analizando tus ventas con IA…</div>
          ) : insight ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {insight.split('\n').map((line, i) => {
                const parts = line.split(/\*\*(.+?)\*\*/g)
                return (
                  <div key={i}>
                    {parts.map((part, j) =>
                      j % 2 === 1 ? <strong key={j} style={{ color: '#bfdbfe' }}>{part}</strong> : <span key={j}>{part}</span>,
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#fecaca' }}>{insightError || 'Aún no hay análisis. Presiona el botón para generarlo con IA.'}</div>
          )}
        </div>

        {summary && (
          <>
            {/* Resumen */}
            <div className="cardBox" style={{ marginTop: 16, marginBottom: 16 }}>
              <div className="card">
                <div><div className="numbers">{summary.totalPedidos}</div><div className="cardName">Pedidos (30 días)</div></div>
                <div className="iconBx">📦</div>
              </div>
              <div className="card">
                <div><div className="numbers" style={{ fontSize: 15 }}>{summary.top?.nombre || '—'}</div><div className="cardName">Producto estrella</div></div>
                <div className="iconBx">⭐</div>
              </div>
              <div className="card">
                <div><div className="numbers">{summary.mejorDia ? DOW_LABELS[summary.mejorDia.dow - 1] : '—'}</div><div className="cardName">Día de mayor demanda</div></div>
                <div className="iconBx">📅</div>
              </div>
              <div className="card">
                <div><div className="numbers">{summary.mejorHora ? `${summary.mejorHora.hora}:00` : '—'}</div><div className="cardName">Hora pico</div></div>
                <div className="iconBx">🕐</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Top productos */}
              <div className="chart-card">
                <h3>Top productos vendidos</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.products} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | string) => String(v)} />
                    <Bar dataKey="cantidad" name="Unidades" fill={BLUE} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Por día */}
              <div className="chart-card">
                <h3>Pedidos por día de la semana</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.byDay.map((d) => ({ ...d, label: DOW_LABELS[d.dow - 1] }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | string) => String(v)} />
                    <Bar dataKey="pedidos" name="Pedidos" fill={BLUE} radius={[6, 6, 0, 0]}>
                      {data?.byDay.map((d, i) => (
                        <Cell key={i} fill={d.pedidos === summary.mejorDia?.pedidos ? AMBER : BLUE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Por hora */}
              <div className="chart-card">
                <h3>Pedidos por hora</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.byHour.map((h) => ({ ...h, label: `${h.hora}:00` }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | string) => String(v)} />
                    <Bar dataKey="pedidos" name="Pedidos" fill={BLUE} radius={[6, 6, 0, 0]}>
                      {data?.byHour.map((h, i) => (
                        <Cell key={i} fill={h.hora === summary.mejorHora?.hora ? AMBER : BLUE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Por zona */}
              <div className="chart-card">
                <h3>Zonas que más piden</h3>
                {data && data.byZone.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.byZone} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="zona" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip formatter={(v: number | string) => String(v)} />
                      <Bar dataKey="pedidos" name="Pedidos" fill={LIGHT} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="muted" style={{ padding: 30, textAlign: 'center' }}>Sin domicilios registrados en el período</p>
                )}
              </div>
            </div>

            {/* Bajo rendimiento */}
            <div className="chart-card" style={{ marginTop: 20 }}>
              <h3 style={{ color: AMBER }}>⚠️ Productos de bajo rendimiento</h3>
              {summary.baja.length > 0 ? (
                <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--ink)', fontSize: 14, lineHeight: 1.9 }}>
                  {summary.baja.map((p) => (
                    <li key={p.nombre}>
                      <strong>{p.nombre}</strong> — solo {p.cantidad} unidad{p.cantidad !== 1 ? 'es' : ''} ({fmt(p.ingresos)}). Considera una promo o revisa su demanda.
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ margin: '8px 0 0' }}>Sin datos</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
