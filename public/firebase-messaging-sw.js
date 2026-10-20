// Service worker de Firebase Cloud Messaging (web push) — versión clásica
// (importScripts) para máxima compatibilidad de registro en navegadores.
// Recibe notificaciones en segundo plano; al hacer clic enfoca la app y navega
// a data.url si el envío lo incluye.
// La config es pública (idéntica a src/lib/firebase.ts).

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'TU_FIREBASE_API_KEY',
  authDomain: 'talos-sentinel.firebaseapp.com',
  projectId: 'talos-sentinel',
  storageBucket: 'talos-sentinel.firebasestorage.app',
  messagingSenderId: '34443127222',
  appId: '1:34443127222:web:174b039ad0b99568b43917',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = typeof data === 'string' ? data : data.url;
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url && client.url.startsWith(self.location.origin)) {
          await client.focus();
          if (url && client.navigate) {
            await client.navigate(url).catch(() => {});
          }
          return;
        }
      }
      await self.clients.openWindow(url || '/');
    })(),
  );
});
