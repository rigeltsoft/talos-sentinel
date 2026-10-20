import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Eye, ShoppingCart, ShieldAlert, Banknote, Bike } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { StatusBadge, fmt, timeAgo, productsText } from '@/components/dashboard/bits'
import type { Order } from '@/types'

const PIE_COLORS = ['#2a9d8f', '#e9b10a', '#1795ce', '#b5179e', '#f3722c']

function filterOrders(orders: Order[], search: string) {
  if (!search.trim()) return orders
  const q = search.toLowerCase()
  return orders.filter((o) =>
    [o.customer_name, o.customer_phone, String(o.id), productsText(o.products)]
      .join(' ').toLowerCase().includes(q),
  )
}

export default function Resumen() {
  const { orders, riders, search, setSearch } = useDashboard()
  const navigate = useNavigate()
  const visible = filterOrders(orders, search)

  // Click en una fila de pedido → abre Pedidos filtrado por ese # de orden
  function goToOrder(id: number) {
    setSearch(String(id))
    navigate('/pedidos')
  }

  const cardLink = { textDecoration: 'none', color: 'inherit', cursor: 'pointer' } as const

  const stats = useMemo(() => {
    const active = visible.filter((o) => !['delivered', 'cancelled'].includes(o.status))
    const toVerify = visible.filter((o) => o.status === 'awaiting_verification')
    const sales = visible.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0) + Number(o.shipping_cost || 0), 0)
    const activeRiders = riders.filter((r) => r.is_active).length
    return { active: active.length, toVerify: toVerify.length, sales, activeRiders }
  }, [visible, riders])

  const salesByDay = useMemo(() => {
    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      days[d.toLocaleDateString('es-CO', { weekday: 'short' })] = 0
    }
    visible.filter((o) => o.status !== 'cancelled').forEach((o) => {
      const k = new Date(o.created_at).toLocaleDateString('es-CO', { weekday: 'short' })
      if (k in days) days[k] += Number(o.total || 0) + Number(o.shipping_cost || 0)
    })
    return Object.entries(days).map(([dia, ventas]) => ({ dia, ventas }))
  }, [visible])

  const paymentShare = useMemo(() => {
    const acc: Record<string, number> = {}
    visible.filter((o) => o.status !== 'cancelled').forEach((o) => {
      acc[o.payment_method] = (acc[o.payment_method] ?? 0) + 1
    })
    return Object.entries(acc).map(([name, value]) => ({ name, value }))
  }, [visible])

  const customers = useMemo(() => {
    const seen = new Map<string, Order>()
    ;[...visible].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).forEach((o) => {
      if (!seen.has(o.customer_phone)) seen.set(o.customer_phone, o)
    })
    return [...seen.values()].slice(0, 8)
  }, [visible])

  return (
    <>
      <div className="cardBox">
        <Link to="/pedidos?f=activos" className="card" style={cardLink}>
          <div>
            <div className="numbers">{stats.active}</div>
            <div className="cardName">Pedidos activos</div>
          </div>
          <div className="iconBx"><ShoppingCart /></div>
        </Link>
        <Link to="/pedidos?f=verificar" className="card" style={cardLink}>
          <div>
            <div className="numbers">{stats.toVerify}</div>
            <div className="cardName">Pagos por verificar</div>
          </div>
          <div className="iconBx"><ShieldAlert /></div>
        </Link>
        <Link to="/ventas" className="card" style={cardLink}>
          <div>
            <div className="numbers">{fmt(stats.sales)}</div>
            <div className="cardName">Ventas del día</div>
          </div>
          <div className="iconBx"><Banknote /></div>
        </Link>
        <Link to="/domiciliarios" className="card" style={cardLink}>
          <div>
            <div className="numbers">{stats.activeRiders}</div>
            <div className="cardName">Domiciliarios activos</div>
          </div>
          <div className="iconBx"><Bike /></div>
        </Link>
      </div>

      <div className="chartsBx">
        <div className="chart-card">
          <h3>Métodos de pago</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={paymentShare} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {paymentShare.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Ventas últimos 7 días</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={salesByDay}>
              <XAxis dataKey="dia" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => fmt(Number(v))} />
              <Bar dataKey="ventas" fill="#2a2185" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="details">
        <div className="panel">
          <div className="cardHeader">
            <h2>Pedidos recientes</h2>
            <Link to="/pedidos" className="btn">Ver todos</Link>
          </div>
          <table>
            <thead>
              <tr>
                <td>Cliente</td>
                <td>Productos</td>
                <td style={{ textAlign: 'end' }}>Total</td>
                <td style={{ textAlign: 'center' }}>Pago</td>
                <td style={{ textAlign: 'end' }}>Estado</td>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 10).map((o) => (
                <tr key={o.id} onClick={() => goToOrder(o.id)} style={{ cursor: 'pointer' }} title="Ver pedido">
                  <td>
                    #{o.id} · {o.customer_name}
                    <br />
                    <span className="muted">{timeAgo(o.created_at)}</span>
                  </td>
                  <td>{productsText(o.products)}</td>
                  <td style={{ textAlign: 'end' }}>{fmt(Number(o.total || 0) + Number(o.shipping_cost || 0))}</td>
                  <td style={{ textAlign: 'center' }}>{o.payment_method}</td>
                  <td style={{ textAlign: 'end' }}><StatusBadge status={o.status} /></td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center' }}><span className="muted">Sin pedidos</span></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="cardHeader"><h2>Clientes recientes</h2></div>
          <table>
            <tbody>
              {customers.map((o) => (
                <tr key={o.customer_phone}>
                  <td width="52px">
                    <div className="user" style={{ width: 40, height: 40, cursor: 'default' }}>
                      {o.customer_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                  </td>
                  <td>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
                      {o.customer_name}
                      <br />
                      <span className="muted"><Eye style={{ width: 11, height: 11, display: 'inline' }} /> {o.customer_phone}</span>
                    </h4>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td><span className="muted">Sin clientes aún</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
