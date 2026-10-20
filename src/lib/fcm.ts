// Ayudantes de FCM para dashboard y app del rider.
// Firebase se importa de forma DINÁMICA para no inflar el bundle principal.
//
// ── Hay DOS caminos y antes se elegía mal (corregido el 2026-10-11) ──────────
// 1) WebView Android (app Zeus Manager): el WebView **no soporta la Push API**
//    (`PushManager` no existe) → `requestWebPushToken()` fallaba con "Este
//    navegador no soporta notificaciones push" y el token nunca llegaba al
//    servidor. La app SÍ tiene FCM nativo y expone su token por el bridge
//    (`window.AndroidBridge.getFCMToken()` / `window._fcmToken`): ese es el
//    token que hay que registrar.
// 2) Navegador / tablet / PC: no hay bridge → se usa push web (VAPID + SW).

import { FIREBASE_CONFIG, FIREBASE_VAPID_KEY, FCM_SW_PATH } from './firebase'

export interface PushResult {
  token?: string
  error?: string
  /** true cuando el token vino del FCM nativo de la app Android (no push web) */
  native?: boolean
}

type BridgeWindow = Window & {
  _fcmToken?: string
  AndroidBridge?: { getFCMToken?: () => string }
}

/**
 * Token FCM **nativo** que la app Android inyecta en el WebView.
 * Devuelve null si no estamos dentro de la app (navegador normal).
 */
export function nativePushToken(): string | null {
  if (typeof window === 'undefined') return null
  const w = window as BridgeWindow
  let token = ''
  try {
    token = w.AndroidBridge?.getFCMToken?.() || w._fcmToken || ''
  } catch {
    token = w._fcmToken || ''
  }
  // Un token FCM real ronda los 140 caracteres: descartamos vacíos o basura.
  return typeof token === 'string' && token.length > 20 ? token : null
}

/** ¿Estamos dentro de la app Android (WebView con bridge)? */
export function isAndroidApp(): boolean {
  return typeof window !== 'undefined' && !!(window as BridgeWindow).AndroidBridge
}

/**
 * Devuelve el token que corresponde a este cliente: el **nativo** si estamos en
 * la app Android y, si no, el de push web.
 */
export async function requestPushToken(): Promise<PushResult> {
  const native = nativePushToken()
  if (native) return { token: native, native: true }
  // Dentro de la app Android NO se intenta push web: el WebView no lo soporta y
  // el navegador lanza "Registration failed - push service error". El token
  // nativo lo inyecta la app (Android ya pidió el permiso al instalar).
  if (isAndroidApp()) {
    return {
      error:
        'Las notificaciones las maneja la propia aplicación (Android ya pidió el permiso). ' +
        'Si no llegan, revisa en Ajustes → Apps → Zeus Manager que las notificaciones estén permitidas.',
    }
  }
  return requestWebPushToken()
}

export function canPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  try {
    // Limpia cualquier registro previo roto del mismo service worker
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs
        .filter((r) => r.active?.scriptURL.includes('firebase-messaging-sw') || r.installing?.scriptURL.includes('firebase-messaging-sw'))
        .map((r) => r.unregister()),
    )
    // SW clásico (importScripts): registro sin type para máxima compatibilidad
    const reg = await navigator.serviceWorker.register(FCM_SW_PATH)
    await navigator.serviceWorker.ready
    return reg
  } catch (err) {
    console.warn('FCM: no se pudo registrar el service worker', err)
    return null
  }
}

async function getMessaging(): Promise<any> {
  const { initializeApp } = await import('firebase/app')
  const { getMessaging } = await import('firebase/messaging')
  const app = initializeApp(FIREBASE_CONFIG)
  return getMessaging(app)
}

// Pide permiso y obtiene el token web FCM (lo llama el usuario desde la UI).
export async function requestWebPushToken(): Promise<PushResult> {
  if (!canPush()) return { error: 'Este navegador no soporta notificaciones push.' }
  if (Notification.permission === 'denied') {
    return { error: 'Permiso denegado: actívalo en la configuración del navegador para este sitio.' }
  }
  const reg = await registerSW()
  if (!reg) return { error: 'No se pudo registrar el service worker de notificaciones.' }
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission()
    if (p !== 'granted') return { error: 'Permiso no concedido. Puedes activarlo más tarde.' }
  }
  try {
    const messaging = await getMessaging()
    const { getToken } = await import('firebase/messaging')
    const token = await getToken(messaging, { vapidKey: FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg })
    if (!token) return { error: 'No se pudo obtener el token de notificaciones.' }
    return { token }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error obteniendo el token FCM.' }
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  try {
    const messaging = await getMessaging()
    const { deleteToken } = await import('firebase/messaging')
    await deleteToken(messaging)
  } catch {
    /* sin token que eliminar */
  }
}
