import { useState, useEffect, useMemo } from 'react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { StatusBadge, fmt, timeAgo, productsText } from '@/components/dashboard/bits'
import { fetchSalesHistory, fetchRefunds } from '@/lib/api'
import InfoTip from '@/components/dashboard/InfoTip'
import Spinner from '@/components/dashboard/Spinner'
import { Wallet, PackageCheck, ReceiptText, XCircle, RotateCcw } from 'lucide-react'
import type { Order, Refund } from '@/types'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

type Period = 'week' | 'month' | 'all'
type Tab = 'orders' | 'products' | 'refunds'

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  fontSize: 12,
}

// Carga el logo como dataURL para incrustarlo en el PDF
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/iconos/OriginalTALOS.png')
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export default function Ventas() {
  const { biz } = useDashboard()
  const [history, setHistory] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>('week')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [tab, setTab] = useState<Tab>('orders')
  const [refunds, setRefunds] = useState<Refund[]>([])

  // Historial de ventas: respeta liveMode (demo → datos de ejemplo; live → API n8n)
  useEffect(() => {
    let cancelled = false
    fetchSalesHistory(biz).then((res) => {
      if (cancelled) return
      setHistory(res.data)
      setError(res.error ? 'No se pudo cargar el historial. Verifica n8n / Cloudflare Access.' : '')
      setLoading(false)
    })
    fetchRefunds(biz).then((res) => {
      if (!cancelled) setRefunds(res.data)
    })
    return () => { cancelled = true }
  }, [biz])

  // Filtros: rango de fechas personalizado (si está) o período rápido
  const filtered = useMemo(() => {
    const now = new Date()
    let start: Date
    let end: Date
    if (fromDate || toDate) {
      start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date(0)
      end = toDate ? new Date(`${toDate}T23:59:59`) : new Date(8640000000000000)
    } else {
      if (period === 'week') start = new Date(now.getTime() - 7 * 86400000)
      else if (period === 'month') start = new Date(now.getTime() - 30 * 86400000)
      else start = new Date(0)
      end = new Date()
    }
    return history.filter((o) => {
      const orderDate = new Date(o.created_at)
      const inPeriod = orderDate >= start && orderDate <= end
      const inStatus = statusFilter === 'all' || o.status === statusFilter
      const inPayment = paymentFilter === 'all' || o.payment_method === paymentFilter
      return inPeriod && inStatus && inPayment
    })
  }, [history, period, statusFilter, paymentFilter, fromDate, toDate])

  const stats = useMemo(() => {
    const delivered = filtered.filter((o) => o.status === 'delivered')
    const total = delivered.reduce((s, o) => s + Number(o.total || 0) + Number(o.shipping_cost || 0), 0)
    const avgTicket = delivered.length > 0 ? total / delivered.length : 0
    return {
      total,
      count: delivered.length,
      cancelled: filtered.filter((o) => o.status === 'cancelled').length,
      avgTicket,
    }
  }, [filtered])

  // Ranking de productos: usa cantidad si el pedido la registra (los nuevos
  // pedidos del Agente_IA incluyen cantidad y categoria); si no, cuenta 1.
  const productStats = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; cancelled: number }>()
    for (const o of filtered) {
      for (const p of o.products || []) {
        const nombre = (p.nombre || 'Sin nombre').trim()
        const cant = p.cantidad && p.cantidad > 0 ? p.cantidad : 1
        const cur = map.get(nombre) || { count: 0, revenue: 0, cancelled: 0 }
        cur.count += cant
        cur.revenue += Number(p.precio || 0) * cant
        if (o.status === 'cancelled') cur.cancelled += cant
        map.set(nombre, cur)
      }
    }
    return [...map.entries()]
      .map(([nombre, s]) => ({ nombre, ...s }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
  }, [filtered])

  const refundsTotal = useMemo(
    () => refunds.reduce((s, r) => s + Number(r.amount || 0), 0),
    [refunds],
  )

  const rangeLabel = useMemo(() => {
    if (fromDate || toDate) return `${fromDate || 'inicio'} → ${toDate || 'hoy'}`
    if (period === 'week') return 'Última semana'
    if (period === 'month') return 'Este mes'
    return 'Todo el historial'
  }, [period, fromDate, toDate])

  const exportOrdersCSV = () => {
    const headers = ['#Pedido', 'Cliente', 'Telefono', 'Tipo', 'Productos', 'Subtotal', 'Envio', 'Total', 'Pago', 'Estado', 'Fecha']
    const rows = filtered.map((o) => {
      const products = (o.products || []).map((p: { nombre: string }) => p.nombre).join('; ')
      return [
        o.id, o.customer_name, o.customer_phone, o.order_type,
        products, o.total, o.shipping_cost,
        Number(o.total || 0) + Number(o.shipping_cost || 0),
        o.payment_method, o.status,
        new Date(o.created_at).toLocaleString('es-CO'),
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas-pedidos-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportProductsCSV = () => {
    const headers = ['Producto', 'Veces pedido', 'Ingresos', 'En pedidos cancelados']
    const rows = productStats.map((p) => [p.nombre, p.count, p.revenue, p.cancelled].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas-productos-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    const blue: [number, number, number] = [30, 64, 175]

    const logo = await loadLogo()
    if (logo) doc.addImage(logo, 'PNG', 14, 10, 60, 40)

    doc.setFontSize(18); doc.setTextColor(...blue); doc.setFont('helvetica', 'bold')
    doc.text('Reporte de Ventas', 84, 22)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90)
    doc.text(`Negocio: ${biz.name}`, 84, 29)
    doc.text(`Período: ${rangeLabel}`, 84, 35)
    doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 84, 41)

    // KPIs
    doc.setFontSize(10); doc.setTextColor(30)
    doc.text(
      `Total facturado: ${fmt(stats.total)}   ·   Pedidos entregados: ${stats.count}   ·   Cancelados: ${stats.cancelled}   ·   Valor por pedido: ${fmt(stats.avgTicket)}`,
      14, 54,
    )

    // Ranking de productos
    autoTable(doc, {
      startY: 62,
      head: [['#', 'Producto', 'Veces pedido', 'Ingresos', 'En cancelados']],
      body: productStats.map((p, i) => [i + 1, p.nombre, p.count, fmt(p.revenue), p.cancelled]),
      headStyles: { fillColor: blue, fontSize: 10 },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })

    // Detalle de pedidos
    const yAfter = (doc as any).lastAutoTable?.finalY ?? 70
    autoTable(doc, {
      startY: yAfter + 10,
      head: [['#', 'Cliente', 'Productos', 'Total', 'Pago', 'Estado', 'Fecha']],
      body: filtered.map((o) => [
        `#${o.id}`,
        `${o.customer_name} ${o.customer_phone ? '· ' + o.customer_phone : ''}`,
        productsText(o.products),
        fmt(Number(o.total || 0) + Number(o.shipping_cost || 0)),
        o.payment_method,
        o.status,
        new Date(o.created_at).toLocaleString('es-CO'),
      ]),
      headStyles: { fillColor: blue, fontSize: 10 },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    })

    // Pie de página
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFontSize(8); doc.setTextColor(150)
      doc.text(`Talos Sentinel · Reporte de Ventas · Página ${i} de ${pages}`, 14, doc.internal.pageSize.getHeight() - 8)
    }

    doc.save(`reporte-ventas-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) {
    return (
      <div className="details full">
        <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
          <Spinner center label="Cargando historial de ventas…" />
        </div>
      </div>
    )
  }

  return (
    <div className="details full">
      <div className="panel">
        <div className="cardHeader">
          <h2>
            Ventas e Historial
            <InfoTip text="Pedidos entregados y cancelados. Filtra por período o rango de fechas y por estado/pago. Al final de la página, la sección 'Exportar / Descargar informes' genera los archivos del rango filtrado." />
          </h2>
        </div>

        {error && (
          <p style={{ margin: '12px 0', fontSize: 13, color: '#e11d48' }}>
            ⚠️ {error}
          </p>
        )}

        {/* KPIs */}
        <div className="cardBox" style={{ marginTop: 16, marginBottom: 16 }}>
          <div className="card">
            <div>
              <div className="numbers">{fmt(stats.total)}</div>
              <div className="cardName">Total Facturado</div>
            </div>
            <div className="iconBx"><Wallet size={26} /></div>
          </div>
          <div className="card">
            <div>
              <div className="numbers">{stats.count}</div>
              <div className="cardName">Pedidos Entregados</div>
            </div>
            <div className="iconBx"><PackageCheck size={26} /></div>
          </div>
          <div className="card">
            <div>
              <div className="numbers">{fmt(stats.avgTicket)}</div>
              <div className="cardName">Valor por pedido</div>
            </div>
            <div className="iconBx"><ReceiptText size={26} /></div>
          </div>
          <div className="card">
            <div>
              <div className="numbers">{stats.cancelled}</div>
              <div className="cardName">Cancelados</div>
            </div>
            <div className="iconBx"><XCircle size={26} /></div>
          </div>
          <div className="card">
            <div>
              <div className="numbers">{fmt(refundsTotal)}</div>
              <div className="cardName">Devoluciones</div>
            </div>
            <div className="iconBx"><RotateCcw size={26} /></div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
          {([
            { k: 'week' as Period, label: 'Última Semana' },
            { k: 'month' as Period, label: 'Este Mes' },
            { k: 'all' as Period, label: 'Todo el Historial' },
          ]).map((p) => (
            <button
              key={p.k}
              className={`btn sm ${period === p.k && !fromDate && !toDate ? '' : 'ghost'}`}
              onClick={() => { setPeriod(p.k); setFromDate(''); setToDate('') }}
            >
              {p.label}
            </button>
          ))}
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Desde <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPeriod('all') }} style={inputStyle} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Hasta <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPeriod('all') }} style={inputStyle} />
          </label>
          <select
            className="btn sm ghost"
            style={{ padding: '4px 8px', fontFamily: 'Ubuntu, sans-serif', fontSize: 12 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="delivered">Entregados</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <select
            className="btn sm ghost"
            style={{ padding: '4px 8px', fontFamily: 'Ubuntu, sans-serif', fontSize: 12 }}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="all">Todos los pagos</option>
            <option value="Nequi">Nequi</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Daviplata">Daviplata</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </div>

        {/* Pestañas */}
        <div style={{ display: 'flex', gap: 8, margin: '14px 0 4px', flexWrap: 'wrap' }}>
          <button className={`btn sm ${tab === 'orders' ? '' : 'ghost'}`} onClick={() => setTab('orders')}>
            Pedidos ({filtered.length})
          </button>
          <button className={`btn sm ${tab === 'products' ? '' : 'ghost'}`} onClick={() => setTab('products')}>
            Productos ({productStats.length})
          </button>
          <button className={`btn sm ${tab === 'refunds' ? '' : 'ghost'}`} onClick={() => setTab('refunds')}>
            Devoluciones ({refunds.length})
          </button>
        </div>

        {tab === 'orders' ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <td>#</td>
                  <td>Cliente</td>
                  <td>Productos</td>
                  <td style={{ textAlign: 'end' }}>Total</td>
                  <td style={{ textAlign: 'center' }}>Pago</td>
                  <td style={{ textAlign: 'center' }}>Estado</td>
                  <td style={{ textAlign: 'end' }}>Fecha</td>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !error && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center' }}>
                      <span className="muted">Sin pedidos en este período</span>
                    </td>
                  </tr>
                )}
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.id}</strong>
                    </td>
                    <td>
                      {o.customer_name}
                      <br />
                      <span className="muted">{o.customer_phone}</span>
                    </td>
                    <td>{productsText(o.products)}</td>
                    <td style={{ textAlign: 'end' }}>
                      {fmt(Number(o.total || 0) + Number(o.shipping_cost || 0))}
                    </td>
                    <td style={{ textAlign: 'center' }}>{o.payment_method}</td>
                    <td style={{ textAlign: 'center' }}>
                      <StatusBadge status={o.status} />
                    </td>
                    <td style={{ textAlign: 'end' }}>
                      <span className="muted">{timeAgo(o.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'products' ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <td style={{ textAlign: 'center' }}>#</td>
                  <td>Producto</td>
                  <td style={{ textAlign: 'center' }}>Veces pedido</td>
                  <td style={{ textAlign: 'end' }}>Ingresos</td>
                  <td style={{ textAlign: 'center' }}>En cancelados</td>
                </tr>
              </thead>
              <tbody>
                {productStats.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>
                      <span className="muted">Sin productos en este período</span>
                    </td>
                  </tr>
                )}
                {productStats.map((p, i) => (
                  <tr key={p.nombre}>
                    <td style={{ textAlign: 'center' }}><strong>{i + 1}</strong></td>
                    <td>{p.nombre}</td>
                    <td style={{ textAlign: 'center' }}>{p.count}</td>
                    <td style={{ textAlign: 'end' }}>{fmt(p.revenue)}</td>
                    <td style={{ textAlign: 'center' }}>{p.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              * Los pedidos nuevos del Agente_IA registran cantidad y categoría por producto; los anteriores cuentan 1 por aparición. "En cancelados" indica unidades en pedidos cancelados.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <td>#</td>
                  <td>Pedido</td>
                  <td>Cliente</td>
                  <td>Productos devueltos</td>
                  <td style={{ textAlign: 'end' }}>Monto</td>
                  <td>Motivo</td>
                  <td style={{ textAlign: 'end' }}>Fecha</td>
                </tr>
              </thead>
              <tbody>
                {refunds.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center' }}><span className="muted">Sin devoluciones registradas</span></td></tr>
                )}
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td><strong>#{r.id}</strong></td>
                    <td><strong>#{r.order_id}</strong></td>
                    <td>{r.customer_name || '—'}<br /><span className="muted">{r.customer_phone || ''}</span></td>
                    <td>{(r.items || []).map((it) => `${it.cantidad}x ${it.nombre}`).join('; ')}</td>
                    <td style={{ textAlign: 'end' }}>{fmt(r.amount)}</td>
                    <td>{r.reason || '—'}</td>
                    <td style={{ textAlign: 'end' }}><span className="muted">{new Date(r.created_at).toLocaleString('es-CO')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {refunds.length > 0 && (
              <p className="muted" style={{ margin: '8px 0 0' }}>
                Total devuelto en el período: <strong>{fmt(refundsTotal)}</strong>. Las devoluciones quedan registradas para facturación.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── Exportar / Descargar informes ─── */}
      <div className="panel">
        <div className="cardHeader">
          <h2>📥 Exportar / Descargar informes</h2>
        </div>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Genera los archivos con la información del filtro actual (<strong>{rangeLabel}</strong>
          {statusFilter !== 'all' ? ` · ${statusFilter === 'delivered' ? 'entregados' : 'cancelados'}` : ''}).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button
            className="btn"
            disabled={filtered.length === 0}
            onClick={exportOrdersCSV}
            title="Descarga los pedidos del período en formato CSV"
          >
            Pedidos (CSV)
          </button>
          <button
            className="btn"
            disabled={productStats.length === 0}
            onClick={exportProductsCSV}
            title="Descarga el ranking de productos del período en formato CSV"
          >
            Productos (CSV)
          </button>
          <button
            className="btn"
            disabled={filtered.length === 0}
            onClick={exportPDF}
            title="Genera el informe completo con logo del negocio en PDF"
          >
            Informe completo (PDF)
          </button>
        </div>
      </div>
    </div>
  )
}
