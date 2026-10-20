import { createPortal } from 'react-dom'
import { TriangleAlert, X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: React.ReactNode
  onClose: () => void
}

// Aviso modal (informativo, un solo botón). Reutiliza los estilos del ConfirmModal.
export default function AlertModal({ open, title, message, onClose }: Props) {
  if (!open) return null

  const host =
    (typeof document !== 'undefined' && document.querySelector<HTMLElement>('.tsen')) || document.body

  return createPortal(
    <div
      className="cm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="cm-card">
        <div className="cm-head">
          <span className="cm-ico danger">
            <TriangleAlert size={22} />
          </span>
          <h3 className="cm-title">{title}</h3>
          <button className="cm-x" onClick={onClose} title="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="cm-body">{message}</div>
        <div className="cm-foot">
          <button className="btn" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>,
    host,
  )
}
