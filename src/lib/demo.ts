import type { BusinessType, Order, Rider, PromoSubscriber, PromoHistoryItem } from '@/types'

const now = Date.now()
const min = (m: number) => new Date(now - m * 60000).toISOString()
const hours = (h: number) => new Date(now - h * 3600000).toISOString()

// Datos demo por tipo de negocio: permiten inspeccionar el dashboard
// antes de conectar la API real (liveMode).
export function demoOrders(type: BusinessType): Order[] {
  if (type === 'farmacia') {
    return [
      { id: 501, customer_name: 'María Fernanda', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Acetaminofén 500mg x20', precio: 8500 }, { nombre: 'Vitamina C 1g x10', precio: 12000 }], total: 20500, shipping_cost: 4000, delivery_address: 'Cra 4 #12-30', latitude: null, longitude: null, payment_method: 'Nequi', status: 'awaiting_verification', rider_id: null, created_at: min(12), updated_at: min(12) },
      { id: 502, customer_name: 'Jorge López', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Losartán 50mg x30', precio: 15000 }], total: 15000, shipping_cost: 4000, delivery_address: 'Calle 30 #8-15', latitude: null, longitude: null, payment_method: 'Efectivo', status: 'preparing', rider_id: null, created_at: hours(3), updated_at: min(20) },
      { id: 503, customer_name: 'Ana Ruiz', customer_phone: '573000000000', order_type: 'Recoger', products: [{ nombre: 'Protector solar FPS50', precio: 42000 }], total: 42000, shipping_cost: 0, delivery_address: null, latitude: null, longitude: null, payment_method: 'Daviplata', status: 'ready_pickup', rider_id: null, created_at: hours(5), updated_at: min(30) },
      { id: 500, customer_name: 'Luis Peña', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Dolex gripa x12', precio: 9800 }], total: 9800, shipping_cost: 4000, delivery_address: 'Calle 15 #3-21', latitude: null, longitude: null, payment_method: 'Efectivo', status: 'delivered', rider_id: 1, rider_name: 'Mensajero 1', created_at: hours(8), updated_at: hours(6) },
    ]
  }
  if (type === 'negocio') {
    return [
      { id: 601, customer_name: 'Carlos Mena', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Arroz 5kg', precio: 21000 }, { nombre: 'Aceite 1L', precio: 14500 }], total: 35500, shipping_cost: 5000, delivery_address: 'Barrio Centro Mz 3 Casa 12', latitude: null, longitude: null, payment_method: 'Transferencia', status: 'delivering', rider_id: 1, rider_name: 'Mensajero 1', created_at: min(50), updated_at: min(10) },
      { id: 602, customer_name: 'Luisa Páez', customer_phone: '573000000000', order_type: 'Recoger', products: [{ nombre: 'Canasta familiar', precio: 68000 }], total: 68000, shipping_cost: 0, delivery_address: null, latitude: null, longitude: null, payment_method: 'Efectivo', status: 'confirmed', rider_id: null, created_at: min(25), updated_at: min(25) },
      { id: 600, customer_name: 'Rosa Díaz', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Café 500g', precio: 18000 }], total: 18000, shipping_cost: 5000, delivery_address: 'Cra 7 #20-08', latitude: null, longitude: null, payment_method: 'Nequi', status: 'delivered', rider_id: 1, rider_name: 'Mensajero 1', created_at: hours(9), updated_at: hours(7) },
    ]
  }
  // restaurante
  return [
    { id: 247, customer_name: 'Pedro Castro', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Pizza Hawaiana', precio: 35000 }, { nombre: 'Gaseosa 1.5L', precio: 9000, notas: 'Bien fría' }], total: 44000, shipping_cost: 5000, delivery_address: 'Calle 10 #5-20, La Castellana', latitude: 8.7479, longitude: -75.8814, payment_method: 'Nequi', status: 'awaiting_verification', rider_id: null, created_at: min(8), updated_at: min(8) },
    { id: 246, customer_name: 'Diana Mercado', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Bandeja paisa', precio: 28000 }, { nombre: 'Limonada natural', precio: 7000 }], total: 35000, shipping_cost: 5000, delivery_address: 'Cra 2 #18-44, Centro', latitude: null, longitude: null, payment_method: 'Efectivo', status: 'preparing', rider_id: null, created_at: min(35), updated_at: min(15) },
    { id: 245, customer_name: 'Andrés Soto', customer_phone: '573000000000', order_type: 'Recoger', products: [{ nombre: 'Hamburguesa doble', precio: 24000, notas: 'Sin cebolla' }], total: 24000, shipping_cost: 0, delivery_address: null, latitude: null, longitude: null, payment_method: 'Daviplata', status: 'ready_pickup', rider_id: null, created_at: min(70), updated_at: min(25) },
    { id: 244, customer_name: 'Camila Ríos', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Sushi roll x12', precio: 38000 }], total: 38000, shipping_cost: 5000, delivery_address: 'Calle 29 #1-55, Riberas del Sinú', latitude: null, longitude: null, payment_method: 'Transferencia', status: 'delivering', rider_id: 1, rider_name: 'Juan Reyes', created_at: min(55), updated_at: min(6) },
    { id: 243, customer_name: 'Felipe Guerra', customer_phone: '573000000000', order_type: 'Domicilio', products: [{ nombre: 'Pizza Hawaiana', precio: 35000 }], total: 35000, shipping_cost: 5000, delivery_address: 'Cra 6 #22-10', latitude: null, longitude: null, payment_method: 'Nequi', status: 'delivered', rider_id: 1, rider_name: 'Juan Reyes', created_at: hours(3), updated_at: hours(2) },
    { id: 242, customer_name: 'Sara Núñez', customer_phone: '573000000000', order_type: 'Recoger', products: [{ nombre: 'Wrap de pollo', precio: 19000 }], total: 19000, shipping_cost: 0, delivery_address: null, latitude: null, longitude: null, payment_method: 'Efectivo', status: 'cancelled', rider_id: null, created_at: hours(5), updated_at: hours(4) },
  ]
}

export function demoRiders(type: BusinessType): Rider[] {
  if (type === 'restaurante') {
    return [
      { id: 1, name: 'Juan Reyes', is_active: true, created_at: hours(720), active_orders: 1, total_delivered: 7 },
      { id: 2, name: 'Carlos Domicilios', is_active: true, created_at: hours(1440), active_orders: 0, total_delivered: 3 },
      { id: 3, name: 'Moto Express', is_active: false, created_at: hours(2880), active_orders: 0, total_delivered: 0 },
    ]
  }
  return [
    { id: 1, name: 'Mensajero 1', is_active: true, created_at: hours(720), active_orders: 1, total_delivered: 4 },
    { id: 2, name: 'Mensajero 2', is_active: false, created_at: hours(1440), active_orders: 0, total_delivered: 0 },
  ]
}

export function demoSubscribers(): PromoSubscriber[] {
  return [
    { phone_number: '573000000000', customer_name: 'Juan', opted_in_at: hours(48) },
    { phone_number: '573000000000', customer_name: 'Diana', opted_in_at: hours(96) },
    { phone_number: '573000000000', customer_name: 'Pedro', opted_in_at: hours(168) },
  ]
}

export function demoPromoHistory(): PromoHistoryItem[] {
  return [
    { title: '2x1 en Pizzas', description: 'Este fin de semana todas las pizzas al 2x1. Válido sábado y domingo.', sent_count: 42, sent_at: hours(72) },
    { title: 'Domicilio gratis', description: 'Hoy domicilio gratis en pedidos desde $30.000.', sent_count: 38, sent_at: hours(240) },
  ]
}

export function demoAnalytics() {
  return {
    products: [
      { nombre: 'Pizza Hawaiana', cantidad: 34, ingresos: 1020000 },
      { nombre: 'Hamburguesa Clásica', cantidad: 27, ingresos: 540000 },
      { nombre: 'Perro Americano', cantidad: 19, ingresos: 285000 },
      { nombre: 'Limonada Natural', cantidad: 15, ingresos: 105000 },
      { nombre: 'Alitas BBQ', cantidad: 11, ingresos: 220000 },
    ],
    byDay: [
      { dow: 1, pedidos: 8, ventas: 320000 }, { dow: 2, pedidos: 6, ventas: 240000 },
      { dow: 3, pedidos: 9, ventas: 360000 }, { dow: 4, pedidos: 7, ventas: 280000 },
      { dow: 5, pedidos: 14, ventas: 560000 }, { dow: 6, pedidos: 22, ventas: 880000 },
      { dow: 7, pedidos: 18, ventas: 720000 },
    ],
    byHour: [
      { hora: 11, pedidos: 4, ventas: 160000 }, { hora: 12, pedidos: 9, ventas: 360000 },
      { hora: 13, pedidos: 8, ventas: 320000 }, { hora: 18, pedidos: 6, ventas: 240000 },
      { hora: 19, pedidos: 10, ventas: 400000 }, { hora: 20, pedidos: 12, ventas: 480000 },
      { hora: 21, pedidos: 7, ventas: 280000 },
    ],
    byZone: [
      { zona: 'centro', pedidos: 25 }, { zona: 'la castellana', pedidos: 18 },
      { zona: 'universidad', pedidos: 14 }, { zona: 'buenos aires', pedidos: 9 },
    ],
  }
}

export function demoInsight(): string {
  return `📊 **Insight de los últimos 30 días**

• ⭐ **Producto estrella:** Pizza Hawaiana (34 unidades). Es tu mejor margen por pedido: conviene destacarla en el menú.

• ⚠️ **Bajo rendimiento:** Alitas BBQ (11 unidades). Una promo "2x1 en alitas los jueves" podría reactivarla.

• 🕐 **Mejor momento para promos:** Sábado ~20:00 (pico de 22 pedidos). Envía la promo el **viernes a las 18:00** para capturar el fin de semana.

• 📍 **Zona fuerte:** Centro (25 pedidos). La zona "La Castellana" crece: considera ampliar la cobertura o una alianza con un domiciliario fijo ahí.

_Análisis de ejemplo (modo demo). En vivo lo genera la IA con tus datos reales._`
}
