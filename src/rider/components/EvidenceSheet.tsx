import { useRef, useState } from 'react'
import { CheckCircle2, Camera, DoorClosed, TriangleAlert } from 'lucide-react'
import type { RiderDeliveryStatus, RiderOrder } from '../types/rider'

interface Props {
  order: RiderOrder
  defaultStatus?: RiderDeliveryStatus
  onClose: () => void
  onConfirm: (status: RiderDeliveryStatus, photoData: string | null, notes: string | null) => Promise<void>
}

const STATUS_OPTIONS: Array<{ id: RiderDeliveryStatus; label: string; color?: 'amber' | 'red' }> = [
  { id: 'delivered', label: 'Entregado' },
  { id: 'no_answer', label: 'No abrieron', color: 'amber' },
  { id: 'problem', label: 'Problema', color: 'red' },
]

function StatusIcon({ id }: { id: RiderDeliveryStatus }) {
  if (id === 'delivered') return <CheckCircle2 size={24} strokeWidth={1.8} />
  if (id === 'no_answer') return <DoorClosed size={24} strokeWidth={1.8} />
  return <TriangleAlert size={24} strokeWidth={1.8} />
}

const TITLES: Record<RiderDeliveryStatus, string> = {
  delivered: 'Registrar entrega',
  no_answer: 'No abrieron la puerta',
  problem: 'Reportar problema',
}

// Bottom-sheet de evidencia: estado de la entrega + foto + nota. Misma
// información que registraba rider.html (POST /rider/deliver).
export default function EvidenceSheet({ order, defaultStatus = 'delivered', onClose, onConfirm }: Props) {
  const [status, setStatus] = useState<RiderDeliveryStatus>(defaultStatus)
  const [photo, setPhoto] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(status, photo, notes.trim() || null)
    } catch {
      setError('No se pudo registrar. Revisa tu conexión e inténtalo de nuevo.')
      setBusy(false)
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.onerror = () => setError('No se pudo leer la foto.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="rsheet-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="rsheet">
        <div className="rsheet-handle" />
        <div className="rsheet-header">
          <div className="rsheet-title">{TITLES[status]}</div>
          <div className="rsheet-subtitle">
            Pedido #{order.id} · {order.customer_name}
          </div>
        </div>
        <div className="rsheet-body">
          <div className="status-selector">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`status-opt ${status === opt.id ? `selected ${opt.color || ''}` : ''}`}
                onClick={() => setStatus(opt.id)}
              >
                <div className="status-opt-icon"><StatusIcon id={opt.id} /></div>
                <div className="status-opt-label">{opt.label}</div>
              </button>
            ))}
          </div>

          <div
            className={`photo-zone ${photo ? 'has-photo' : ''}`}
            onClick={() => fileRef.current?.click()}
          >
            {photo && <img src={photo} alt="Evidencia" className="photo-preview" />}
            {!photo && (
              <>
                <div className="photo-zone-icon"><Camera size={30} strokeWidth={1.5} /></div>
                <div className="photo-zone-text">Toca para tomar foto</div>
                <div className="photo-zone-sub">Evidencia de entrega (recomendada)</div>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <textarea
            className="notes-field"
            placeholder="Nota adicional (opcional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
          />

          {error && <p style={{ color: '#ef4444', fontSize: 12.5, margin: '0 0 8px' }}>{error}</p>}

          <button className="rbtn-confirm" onClick={confirm} disabled={busy}>
            {busy ? 'Registrando…' : 'Confirmar'}
          </button>
          <button className="rbtn-cancel-modal" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
