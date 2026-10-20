// Configuración pública de Firebase para FCM web (dashboard + app del rider).
// Valores del proyecto "talos-sentinel" (datos PÚBLICOS, se pueden incrustar).
// Se pueden sobreescribir con variables VITE_FIREBASE_* en el .env si algún día
// se cambia de proyecto.

export const FIREBASE_CONFIG = {
  apiKey:
    (import.meta.env?.VITE_FIREBASE_API_KEY as string | undefined) ||
    'TU_FIREBASE_API_KEY',
  authDomain:
    (import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ||
    'talos-sentinel.firebaseapp.com',
  projectId:
    (import.meta.env?.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'talos-sentinel',
  storageBucket:
    (import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET as string | undefined) ||
    'talos-sentinel.firebasestorage.app',
  messagingSenderId:
    (import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) || '34443127222',
  appId:
    (import.meta.env?.VITE_FIREBASE_APP_ID as string | undefined) ||
    '1:34443127222:web:174b039ad0b99568b43917',
}

// Clave pública VAPID (Web Push certificate) — pública por diseño.
export const FIREBASE_VAPID_KEY =
  (import.meta.env?.VITE_FIREBASE_VAPID_KEY as string | undefined) ||
  'BK9NWEPPkj3AjiWMtPWd1WjZk6kOgCM7xeZPNkOBYIpm8bzgQ9xLMKQc9w81zDdRoLU-geGUQXw0oW4n0SVOUr0'

// Ruta del service worker de mensajería (se sirve desde public/)
export const FCM_SW_PATH = '/firebase-messaging-sw.js'
