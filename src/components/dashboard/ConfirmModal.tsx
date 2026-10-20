import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TriangleAlert, X } from 'lucide-react'
import Spinner from './Spinner'

interface Props {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

// Modal de confirmación con la identidad del dashboard (tokens + animación).
// Sin dependencias externas → seguro en navegador, tablet y WebView Android.
// El cierre con Escape/clic fuera NO ejecuta la acción: solo onConfirm la ejecuta.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
    } catch {
      /* el manejador ya notifica el error */
    } finally {
      setBusy(false)
    }
  }

  // Monta el modal DENTRO del contenedor temático (.tsen) para heredar los
  // tokens de color; si no existe, cae al body.
  const host =
    (typeof document !== 'undefined' && document.querySelector<HTMLElement>('.tsen')) || document.body

  return createPortal(
    <div
      className="cm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="cm-card">
        <div className="cm-head">
          <span className={`cm-ico ${danger ? 'danger' : ''}`}>
            {danger ? <TriangleAlert size={22} /> : <X size={22} />}
          </span>
          <h3 className="cm-title">{title}</h3>
          <button className="cm-x" onClick={onClose} disabled={busy} title="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="cm-body">{message}</div>
        <div className="cm-foot">
          <button className="btn ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'danger' : ''}`}
            onClick={handleConfirm}
            disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {busy ? <Spinner size={15} /> : null}
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    host,
  )
}
