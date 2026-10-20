import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBusinessMutations } from '@/components/dashboard/DashboardContext'
import { BUSINESS_TYPE_LABELS, type BusinessType } from '@/types'

export default function Onboarding() {
  const { user } = useAuth({ redirectOnUnauthenticated: true })
  const { create } = useBusinessMutations()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [type, setType] = useState<BusinessType>('restaurante')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [error, setError] = useState('')

  async function handleCreate() {
    if (name.trim().length < 2) {
      setError('Escribe el nombre de tu negocio')
      return
    }
    try {
      await create.mutateAsync({ name: name.trim(), type, phoneNumberId: phoneNumberId || undefined })
      navigate('/', { replace: true })
    } catch {
      setError('No se pudo crear el negocio. Intenta de nuevo.')
    }
  }

  return (
    <div className="tsen theme-purpura">
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'left', maxWidth: 480 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="login-logo"><ShieldCheck size={30} /></div>
            <h1>Bienvenido{user?.name ? `, ${user.name}` : ''}</h1>
            <p>Crea el espacio de tu negocio en Talos Sentinel. Luego podrás cambiar la apariencia del dashboard.</p>
          </div>
          <div className="field">
            <label>Nombre del negocio</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Restaurante Demo — Sabor Auténtico" />
          </div>
          <div className="field">
            <label>Tipo de negocio</label>
            <select value={type} onChange={(e) => setType(e.target.value as BusinessType)}>
              {Object.entries(BUSINESS_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Phone Number ID de WhatsApp (opcional, lo configuras después)</label>
            <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Ej: 1004464636088971" />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
          <button className="btn" style={{ width: '100%', padding: 12, fontSize: 16 }} onClick={handleCreate} disabled={create.isPending}>
            Crear mi dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
