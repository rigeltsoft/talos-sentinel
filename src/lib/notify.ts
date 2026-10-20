// Motor de sonido elegante de Talos Sentinel (compartido por el dashboard
// multi-negocio y la app del domiciliario).
// Genera melodías cortas con WebAudio (sin archivos): campanitas suaves de
// 2-3 notas con decaimiento natural, distintas por evento.
// Toggle persistido en localStorage ("talos:notif-sound"): 'on' | 'off'.

const KEY = "talos:notif-sound"

type Note = { f: number; t: number; d: number; g?: number }

// Melodías por evento (frecuencia Hz, inicio s, duración s, volumen)
const MELODIES: Record<string, Note[]> = {
  // 🛎️ Nuevo pedido recibido (dashboard): tres notas ascendentes tipo "campana"
  order: [
    { f: 659.25, t: 0, d: 0.5, g: 0.16 }, // E5
    { f: 783.99, t: 0.14, d: 0.5, g: 0.16 }, // G5
    { f: 987.77, t: 0.28, d: 0.7, g: 0.2 }, // B5
  ],
  // 🛵 Pedido asignado al domiciliario (app rider): saludo corto en dos notas
  assigned: [
    { f: 493.88, t: 0, d: 0.4, g: 0.16 }, // B4
    { f: 659.25, t: 0.16, d: 0.6, g: 0.2 }, // E5
  ],
  // 💳 Pago verificado / confirmación
  payment: [
    { f: 523.25, t: 0, d: 0.4, g: 0.14 }, // C5
    { f: 659.25, t: 0.12, d: 0.5, g: 0.16 }, // E5
  ],
  // 📦 Entrega registrada: arpegio corto ascendente
  delivered: [
    { f: 523.25, t: 0, d: 0.35, g: 0.13 },
    { f: 659.25, t: 0.12, d: 0.35, g: 0.14 },
    { f: 783.99, t: 0.24, d: 0.5, g: 0.17 },
  ],
  // ⚠️ Novedad (no abrieron / problema): dos notas graves, atentas
  issue: [
    { f: 392, t: 0, d: 0.5, g: 0.14 }, // G4
    { f: 293.66, t: 0.22, d: 0.6, g: 0.14 }, // D4
  ],
}

let enabled =
  typeof localStorage !== "undefined"
    ? localStorage.getItem(KEY) !== "off"
    : true

let ctx: AudioContext | null = null

// Crea el AudioContext SOLO desde primeAudio() (llamado tras un gesto del
// usuario). Si aún no existe, play() se silencia: evita el warning de autoplay.
let primed = false

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(value: boolean) {
  enabled = value
  try {
    localStorage.setItem(KEY, value ? "on" : "off")
  } catch {
    /* sin storage (modo privado) */
  }
}

// Crea/despierta el contexto de audio (debe llamarse tras un gesto del usuario).
export function primeAudio() {
  primed = true
  try {
    getCtx()
  } catch {
    /* audio no disponible */
  }
}

export type ChimeKind = keyof typeof MELODIES

function play(kind: ChimeKind) {
  // Sin gesto previo aún no existe el contexto (evita el warning de autoplay)
  if (!enabled || !primed) return
  const ac = ctx
  if (!ac) return
  if (ac.state === "suspended") {
    try {
      void ac.resume()
    } catch {
      /* sigue suspendido */
    }
  }
  const now = ac.currentTime
  for (const n of MELODIES[kind] || []) {
    try {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = "sine"
      osc.frequency.value = n.f
      const start = now + n.t
      const g = n.g ?? 0.15
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(g, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(start)
      osc.stop(start + n.d + 0.05)
    } catch {
      /* nota omitida */
    }
  }
}

// ── API usada por el dashboard (compat) ──
export function playNewOrderSound() {
  play("order")
}

// ── API de la app del domiciliario ──
export function playRiderAssignedSound() {
  play("assigned")
}

export function playChime(kind: ChimeKind) {
  play(kind)
}

// Vibración corta en móvil (si el navegador lo permite) junto al sonido.
export function buzz(pattern: number | number[] = 120) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* vibración no disponible */
  }
}
