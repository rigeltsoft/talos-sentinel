import { Routes, Route, Navigate } from 'react-router'
import Shell from './components/dashboard/Shell'
import Resumen from './pages/Resumen'
import Pedidos from './pages/Pedidos'
import Conversaciones from '@/pages/Conversaciones'
import Ventas from './pages/Ventas'
import Analisis from './pages/Analisis'
import Domiciliarios from './pages/Domiciliarios'
import Promociones from './pages/Promociones'
import Configuracion from './pages/Configuracion'
import Onboarding from './pages/Onboarding'
import Admin from './pages/Admin'
import Login from "./pages/Login"
import NotFound from "./pages/NotFound"
import { RiderProvider } from './rider/RiderContext'
import RiderLogin from './rider/components/RiderLogin'
import RiderShell from './rider/components/RiderShell'
import RiderPedidos from './rider/components/RiderPedidos'
import RiderPedido from './rider/components/RiderPedido'
import RiderHistorial from './rider/components/RiderHistorial'
import RiderPerfil from './rider/components/RiderPerfil'

export default function App() {
  return (
    <RiderProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Shell />}>
          <Route path="/" element={<Resumen />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/conversaciones" element={<Conversaciones />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/analisis" element={<Analisis />} />
          <Route path="/domiciliarios" element={<Domiciliarios />} />
          <Route path="/promociones" element={<Promociones />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

        {/* ─── App del domiciliario (login solo-PIN, fuera del shell del dashboard) ─── */}
        <Route
          path="/rider/login"
          element={
            <div className="tsen theme-talos rider-app">
              <RiderLogin />
            </div>
          }
        />
        <Route element={<RiderShell />}>
          <Route path="/rider" element={<Navigate to="/rider/pedidos" replace />} />
          <Route path="/rider/pedidos" element={<RiderPedidos />} />
          <Route path="/rider/pedido/:id" element={<RiderPedido />} />
          <Route path="/rider/historial" element={<RiderHistorial />} />
          <Route path="/rider/perfil" element={<RiderPerfil />} />
        </Route>
        <Route path="/rider/*" element={<Navigate to="/rider/login" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </RiderProvider>
  )
}
