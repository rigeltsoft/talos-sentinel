import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'

// Campo de contraseña con botón "ojito" para mostrar/ocultar lo escrito.
// Acepta todas las props de un <input> normal (autoComplete, value, onChange,
// placeholder, required…) y aplica type password/text según el toggle.
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export default function PasswordField(props: Props) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-field">
      <input type={show ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="pw-eye"
        tabIndex={-1}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
