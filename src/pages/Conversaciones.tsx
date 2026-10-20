import { useState, useEffect, useCallback, useRef } from 'react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { Send, User, MessageCircle, Paperclip, X, ArrowLeft } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import type { CWConversation, CWMessage } from '@/types'
import { fetchCWConversations, fetchCWMessages, sendCWMessage, type ChatAttachment } from '@/lib/api'
import InfoTip from '@/components/dashboard/InfoTip'
import Spinner from '@/components/dashboard/Spinner'

const MAX_ATTACHMENT_MB = 16
// Las imágenes se redimensionan en el navegador (foto de cámara → ~300 KB)
// para no exceder el límite del webhook n8n ni el de WhatsApp Cloud API.
const RESIZE_IF_BIGGER_MB = 1.5
const MAX_IMAGE_DIMENSION = 1600

export default function Conversaciones() {
  const { biz } = useDashboard()
  const isMobile = useIsMobile()
  const [conversations, setConversations] = useState<CWConversation[]>([])
  const [activeConv, setActiveConv] = useState<number | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [messages, setMessages] = useState<CWMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [convLoading, setConvLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [demoMsg, setDemoMsg] = useState('')
  const [pendingAtt, setPendingAtt] = useState<ChatAttachment & { previewUrl?: string } | null>(null)
  const [attError, setAttError] = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)
  const shownConvRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Solo necesitamos baseUrl, accountId e inboxId. El token vive en n8n.
  const hasConfig = !!(biz.chatwootBaseUrl && biz.chatwootAccountId && biz.chatwootInboxId)

  const loadConversations = useCallback(async () => {
    if (!hasConfig) return
    setConvLoading(true)
    const res = await fetchCWConversations(biz)
    if (res.error && res.data.length === 0) {
      setError('Error conectando con el servidor de chats. Revisa la configuración.')
    } else {
      setConversations(res.data)
      setError('')
    }
    setConvLoading(false)
  }, [biz, hasConfig])

  const loadMessages = useCallback(async (convId: number) => {
    if (!hasConfig) return
    // Al cambiar de chat, limpiar para mostrar el skeleton de carga
    if (shownConvRef.current !== convId) {
      setMessages([])
      shownConvRef.current = convId
    }
    setLoading(true)
    const res = await fetchCWMessages(biz, convId)
    setMessages(res.data)
    setLoading(false)
  }, [biz, hasConfig])

  const readBase64 = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      setPendingAtt({
        name: file.name,
        mime: file.type || 'application/octet-stream',
        data_base64: base64,
        previewUrl: dataUrl,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleFileSelect = (file: File | null) => {
    setAttError('')
    if (!file) return
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setAttError(`El archivo supera ${MAX_ATTACHMENT_MB} MB (WhatsApp no acepta más).`)
      return
    }

    // Imágenes (estáticas) grandes: redimensionar en el navegador antes de subir.
    const isStaticImage =
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
      file.size > RESIZE_IF_BIGGER_MB * 1024 * 1024
    if (isStaticImage) {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        let { width, height } = img
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const scale = MAX_IMAGE_DIMENSION / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { readBase64(file); return }
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        setPendingAtt({
          name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
          mime: 'image/jpeg',
          data_base64: dataUrl.split(',')[1],
          previewUrl: dataUrl,
        })
      }
      img.onerror = () => { URL.revokeObjectURL(url); readBase64(file) }
      img.src = url
      return
    }

    readBase64(file)
  }

  const selectConversation = (id: number) => {
    setActiveConv(id)
    setMessages([])
    shownConvRef.current = id
    if (isMobile) setMobileView('chat')
  }

  const handleSend = async () => {
    const content = input.trim()
    if ((!content && !pendingAtt) || !activeConv) return
    setSending(true)
    setError('')
    setDemoMsg('')
    setAttError('')

    // Optimistic update: el mensaje aparece al instante como mensaje del agente
    const temp: CWMessage = {
      id: -Date.now(),
      content: content || null,
      message_type: 1,
      created_at: Math.floor(Date.now() / 1000),
      sender_type: 'User',
      sender: { name: 'Agente' },
      attachments: pendingAtt ? [{ file_type: pendingAtt.mime.startsWith('image/') ? 'image' : pendingAtt.mime.startsWith('video/') ? 'video' : pendingAtt.mime.startsWith('audio/') ? 'audio' : 'file', data_url: pendingAtt.previewUrl || '' }] : undefined,
    }
    const att = pendingAtt
    setMessages((prev) => [...prev, temp])
    setInput('')
    setPendingAtt(null)

    if (!biz.liveMode) {
      setDemoMsg('Modo demo: el envío es simulado. Activa el modo en vivo para enviar de verdad.')
      setSending(false)
      return
    }

    try {
      await sendCWMessage(biz, activeConv, content, att || undefined)
      await loadMessages(activeConv)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== temp.id))
      setError('No se pudo enviar el mensaje. Verifica el endpoint chatwoot-send en n8n.')
    } finally {
      setSending(false)
    }
  }

   // Cargar conversaciones UNA SOLA VEZ al entrar
  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Polling mensajes cuando hay conversación activa
  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv)
      const t = setInterval(() => loadMessages(activeConv), 30000)
      return () => clearInterval(t)
    }
  }, [activeConv, loadMessages])

  // Auto-scroll al último mensaje
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeData = conversations.find(c => c.id === activeConv)

  // Si no hay configuración, mostrar aviso
  if (!hasConfig) {
    return (
      <div className="details full">
        <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
          <MessageCircle size={48} style={{ color: 'var(--muted)', marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px' }}>Conversaciones no configuradas</h3>
          <p className="muted">
            Ve a <strong>Configuración → Datos del negocio</strong> y completa los datos de Chatwoot
            (Base URL, Account ID e Inbox ID) para habilitar las conversaciones.
          </p>
        </div>
      </div>
    )
  }

  const showList = !isMobile || mobileView === 'list'
  const showChat = !isMobile || mobileView === 'chat'

  return (
    <div className="details full">
      <div className="panel" style={{ display: 'flex', padding: 0, minHeight: 'calc(100vh - 180px)', flexDirection: isMobile ? 'column' : 'row' }}>

        {/* ─── Lista de chats ─── */}
        {showList && (
          <div style={{
            width: isMobile ? '100%' : 300,
            borderRight: isMobile ? 'none' : '1px solid var(--line)',
            borderBottom: isMobile ? '1px solid var(--line)' : 'none',
            overflowY: 'auto',
            flexShrink: 0,
            maxHeight: isMobile ? 'calc(100vh - 240px)' : undefined,
          }}>
            <div className="cardHeader" style={{ borderBottom: '1px solid var(--line)' }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Chats ({conversations.length})<InfoTip text="Conversaciones de WhatsApp de tu negocio. Toca un chat para responder al cliente directamente; el mensaje sale por el número de tu negocio. Puedes adjuntar imagen, video o audio." /></h2>
            </div>
            {conversations.map(c => (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--line)',
                  background: activeConv === c.id ? 'var(--hover)' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.meta.sender.name || 'Sin nombre'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {c.meta.sender.phone_number || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.last_non_activity_message?.content || (c.last_non_activity_message?.message_type === 1 ? '📎 Adjunto' : 'Sin mensajes')}
                </div>
              </div>
            ))}
            {convLoading && conversations.length === 0 ? (
              <div style={{ padding: '6px 16px 16px' }}>
                <Spinner center label="Cargando chats…" />
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ padding: '12px 0' }}>
                    <div className="skel-line w-60" style={{ marginBottom: 6 }} />
                    <div className="skel-line w-35" />
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>
                No hay conversaciones activas
              </div>
            )}
          </div>
        )}

        {/* ─── Panel de mensajes ─── */}
        {showChat && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
            {activeConv && activeData ? (
              <>
                {/* Header del chat */}
                <div className="cardHeader" style={{ borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isMobile && (
                    <button
                      onClick={() => setMobileView('list')}
                      title="Volver a la lista"
                      style={{
                        width: 36, height: 36, padding: 0, flexShrink: 0,
                        borderRadius: '50%', border: '1px solid var(--line)',
                        background: 'var(--bg)', color: 'var(--ink)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <div className="user" style={{ width: 36, height: 36 }}><User size={16} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{activeData.meta.sender.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{activeData.meta.sender.phone_number}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    {loading && messages.length > 0 && <Spinner size={13} />}
                    <span className={`status ${activeData.status === 'open' ? 'delivering' : 'cancelled'}`}>
                      {activeData.status === 'open' ? 'Abierto' : 'Cerrado'}
                    </span>
                  </span>
                </div>

                {/* Área de mensajes */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)' }}>
                  {loading && messages.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                      <Spinner center label="Cargando mensajes…" />
                      <div className="skel-bubble in" style={{ width: '72%' }} />
                      <div className="skel-bubble in" style={{ width: '55%' }} />
                      <div className="skel-bubble out" style={{ width: '60%' }} />
                      <div className="skel-bubble in" style={{ width: '64%' }} />
                    </div>
                  ) : (
                    messages.map(m => {
                      const isOutgoing = m.message_type === 1 || m.sender_type === 'User'
                      return (
                        <div key={m.id} style={{
                          alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          background: isOutgoing ? 'var(--brand)' : 'var(--bg)',
                          color: isOutgoing ? 'var(--brand-ink)' : 'var(--ink)',
                          padding: '10px 14px',
                          borderRadius: isOutgoing ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          fontSize: 14,
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                          border: isOutgoing ? 'none' : '1px solid var(--line)',
                        }}>
                          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>
                            {isOutgoing ? (m.sender?.name || 'Agente') : 'Cliente'} · {' '}
                            {new Date(m.created_at * 1000).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {m.content && <div>{m.content}</div>}
                          {!m.content && m.attachments?.length ? <div>📎 Adjunto</div> : (!m.content && <div>—</div>)}
                          {m.attachments?.map((att, i) => (
                            <div key={i} style={{ marginTop: 6 }}>
                              {att.file_type === 'image' && <img src={att.data_url} alt="" style={{ maxWidth: 200, borderRadius: 6 }} />}
                              {att.file_type === 'audio' && <audio controls src={att.data_url} style={{ maxWidth: 220 }} />}
                              {att.file_type === 'video' && <video controls src={att.data_url} style={{ maxWidth: 200, borderRadius: 6 }} />}
                            </div>
                          ))}
                        </div>
                      )
                    })
                  )}
                  <div ref={msgEndRef} style={{ height: 0, margin: 0, padding: 0 }} />
                </div>

                {/* Preview del adjunto pendiente */}
                {pendingAtt && (
                  <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      position: 'relative',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'var(--bg)',
                    }}>
                      {pendingAtt.previewUrl && pendingAtt.mime.startsWith('image/') && (
                        <img src={pendingAtt.previewUrl} alt="" style={{ maxWidth: 160, maxHeight: 90, display: 'block' }} />
                      )}
                      {!pendingAtt.mime.startsWith('image/') && (
                        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--ink)', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📎 {pendingAtt.name}
                        </div>
                      )}
                      <button
                        onClick={() => setPendingAtt(null)}
                        title="Quitar adjunto"
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          width: 20, height: 20, padding: 0,
                          borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: 'rgba(0,0,0,.55)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {pendingAtt.mime.startsWith('audio/') ? '🎵 Audio' : pendingAtt.mime.startsWith('video/') ? '🎬 Video' : 'Imagen'} · {Math.round((pendingAtt.data_base64.length * 3) / 4 / 1024)} KB
                    </span>
                  </div>
                )}
                {attError && <p style={{ margin: '8px 16px 0', fontSize: 12, color: '#e11d48' }}>⚠️ {attError}</p>}

                {/* Input de respuesta */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    style={{ display: 'none' }}
                    onChange={e => { handleFileSelect(e.target.files?.[0] || null); e.target.value = '' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar imagen, video o audio"
                    disabled={sending}
                    style={{
                      width: 40, height: 40, padding: 0, flexShrink: 0,
                      borderRadius: '50%', border: '1px solid var(--line)',
                      background: 'var(--bg)', color: 'var(--muted)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Escribe un mensaje…"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 20,
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--ink)',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <button
                    className="btn"
                    onClick={handleSend}
                    disabled={sending || (!input.trim() && !pendingAtt)}
                    style={{ borderRadius: '50%', width: 42, height: 42, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {sending ? <Spinner size={15} /> : <Send size={16} />}
                  </button>
                </div>
                {demoMsg && (
                  <p style={{ margin: '8px 16px 0', fontSize: 12, color: 'var(--muted)' }}>ℹ️ {demoMsg}</p>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                {isMobile ? 'Selecciona un chat' : 'Selecciona una conversación para ver los mensajes'}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p style={{ margin: '10px 20px', fontSize: 13, color: '#e11d48' }}>⚠️ {error}</p>}
    </div>
  )
}
