// Helpers de formato para la app del rider (COP, tel:, Google Maps, iniciales).

export function cop(n: number | null | undefined): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n || 0)
}

export function telHref(phone?: string | null): string {
  return `tel:+${(phone || '').replace(/\D/g, '')}`
}

export function initials(name?: string | null): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function mapsHref(o: {
  latitude?: number | null
  longitude?: number | null
  delivery_address?: string | null
}): string {
  if (o.latitude && o.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.delivery_address || '')}`
}

// Navegación paso a paso en Waze (alternativa a Google Maps).
export function wazeHref(o: {
  latitude?: number | null
  longitude?: number | null
  delivery_address?: string | null
}): string {
  if (o.latitude && o.longitude) {
    return `https://waze.com/ul?ll=${o.latitude},${o.longitude}&navigate=yes`
  }
  return `https://waze.com/ul?q=${encodeURIComponent(o.delivery_address || '')}&navigate=yes`
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function currentMonthLabel(): string {
  const now = new Date()
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
}
