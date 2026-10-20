import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { Bike } from 'lucide-react'
import { useRider } from '../RiderContext'

// Login solo-PIN (Opción A): el PIN es globalmente único en la plataforma, no
// hay selector de negocio. Tras 4 dígitos se valida; con sesión previa se va
// directo a /rider/pedidos.
export default function RiderLogin() {
  const { session, ready, busy, error, login } = useRider()
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const pinRef = useRef(pin)
  pinRef.current = pin

  // Al completar 4 dígitos se dispara el login automáticamente
  useEffect(() => {
    if (pin.length === 4 && !busy) {
      const value = pin
      const t = setTimeout(() => login(value), 220)
      return () => clearTimeout(t)
    }
  }, [pin, busy, login])

  // Limpia el PIN y anima el error cuando el login falla
  useEffect(() => {
    if (error) {
      setShake(true)
      const t1 = setTimeout(() => {
        setPin('')
        setShake(false)
      }, 700)
      return () => clearTimeout(t1)
    }
  }, [error])

  if (ready && session) return <Navigate to="/rider/pedidos" replace />

  function press(d: string) {
    if (pinRef.current.length >= 4 || busy) return
    setPin(pinRef.current + d)
  }
  function backspace() {
    setPin(pinRef.current.slice(0, -1))
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="rlogin">
      <div className="rlogin-header">
        <div className="rlogin-logo"><Bike size={46} strokeWidth={1.3} /></div>
        <div className="rlogin-title">Domiciliarios</div>
        <div className="rlogin-subtitle">Plataforma Talos Sentinel</div>
        <div className="rlogin-brand-name">Ingresa tu PIN para continuar</div>
      </div>

      <div className="rlogin-body">
        <div className="rlogin-label">Tu PIN es personal y único</div>
        <div className="rlogin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`rlogin-dot ${i < pin.length ? 'filled' : ''} ${shake && i === 0 ? 'error' : ''}`}
            />
          ))}
        </div>

        <div className="rlogin-keypad">
          {keys.map((k) => (
            <button key={k} className="rkey" onClick={() => press(k)} disabled={busy}>
              {k}
            </button>
          ))}
          <button className="rkey del" onClick={() => setPin('')} disabled={busy}>
            ⌫
          </button>
          <button className="rkey" onClick={() => press('0')} disabled={busy}>
            0
          </button>
          <button className="rkey del" onClick={backspace} disabled={busy}>
            ⌫
          </button>
        </div>

        <div className="rlogin-error">{busy ? 'Validando PIN…' : error}</div>
      </div>
    </div>
  )
}
