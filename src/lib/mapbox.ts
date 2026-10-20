// Token público de Mapbox (solo lectura). Se configura en .env como
// VITE_MAPBOX_TOKEN. Aunque un token pk.… está pensado para ir en el cliente,
// restringelo por URL en tu cuenta de Mapbox antes de usarlo en producción.
export const MAPBOX_TOKEN = (import.meta.env?.VITE_MAPBOX_TOKEN as string) || ''

/** Indica si hay token configurado; sin él los mapas se degradan. */
export const MAPBOX_CONFIGURADO = MAPBOX_TOKEN.length > 0

// Carga el script/CSS de Mapbox GL la primera vez (compartido entre el mapa
// del dashboard y el mapa de destino de la app del rider). Resuelve true si
// mapboxgl quedó disponible.
let loadPromise: Promise<boolean> | null = null

export function loadMapboxGL(): Promise<boolean> {
  if (loadPromise) return loadPromise
  loadPromise = new Promise<boolean>((resolve) => {
    try {
      if ((window as any).mapboxgl) return resolve(true)
      if (!document.querySelector('#mapbox-gl-css')) {
        const link = document.createElement('link')
        link.id = 'mapbox-gl-css'
        link.rel = 'stylesheet'
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css'
        document.head.appendChild(link)
      }
      const script = document.createElement('script')
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    } catch {
      resolve(false)
    }
  })
  return loadPromise
}
