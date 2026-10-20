# Talos Sentinel — Automatización por WhatsApp con IA 

Plataforma para que **varios restaurantes o comercios atiendan pedidos por WhatsApp con un agente de IA**,
el encargado los gestione en un panel web y los domiciliarios los vean en su propia app — todo espejado en
Chatwoot para que una persona pueda intervenir cuando haga falta.

> **Estado:** en producción con negocios reales. Este repositorio es una **copia saneada** para portafolio:
> sin credenciales, sin datos de clientes y con datos de demostración ✅

---

## Qué hace

- 🗣️ **Atiende al cliente en WhatsApp con un agente de IA**: consulta el menú (Google Sheets), cotiza, arma el
  pedido y pide la confirmación.
- 📋 **Crea el pedido en el panel** en cuanto el cliente confirma o manda el
  comprobante de pago.
- 💳 **Valida pagos por transferencia** cruzando el comprobante con los avisos bancarios (monto exacto, ventana
  de tiempo, pago no reutilizado y firma DKIM/DMARC del correo), o deja el pago para que lo apruebe el
  encargado.
- 🚦 **Mueve el pedido por estados** y avisa al cliente
  en cada cambio.
- 🛵 **App del domiciliario** servida por el mismo panel (WebView): login con PIN, pedidos asignados, aceptación,
  recogida, entrega con evidencia y GPS.
- 💬 **Espejo en Chatwoot** de cada conversación, con reenvío de lo que escribe un humano hacia WhatsApp.
- 🧾 **Panel del encargado**: pedidos, ventas, análisis, domiciliarios, promociones, novedades y configuración.
- 🔔 **Notificaciones push** al encargado cuando entra un pedido.
- 🤖 **Recordatorios automáticos** a clientes que dejaron el pedido a medias (con límite de intentos).

## Flujo

```
WhatsApp (cliente)
      │  webhook de Meta
      ▼
 Router Maestro ──► Agente IA (menú, pedido, confirmación)
      │                    │
      │                    ├──► Panel del encargado  ──► estados del pedido
      │                    ├──► App del domiciliario ──► entrega + GPS
      │                    └──► Chatwoot (espejo)     ◄── respuestas del humano
      ▼
 Dashboard API (n8n webhooks) ──► PostgreSQL (pedidos, sesiones, pagos)
                                   MySQL (negocios, usuarios)
```

## Cómo está construido

| Pieza | Tecnología | Papel |
|---|---|---|
| **Panel** | Node + Hono + tRPC + React + Vite + Tailwind | Interfaz del encargado, API con sesión y proxy hacia n8n |
| **Orquestación** | n8n (2.x) | Agentes IA, router de mensajes, API del panel y espejo a Chatwoot |
| **Datos** | PostgreSQL  + MySQL  | Operación y catálogo de negocios |
| **IA** | Modelos de chat (DeepSeek / OpenAI) + LangChain dentro de n8n | Conversación, extracción estructurada del pedido |
| **Mensajería** | WhatsApp Cloud API (Meta) + Chatwoot | Canal del cliente y bandeja del equipo |
| **Infra** | Docker + Cloudflare (tunnels) | Despliegue y exposición de webhooks |

## Decisiones técnicas que se pueden defender

1. **Un estado explícito para el pago digital (`awaiting_verification`).** Un pedido en efectivo nace
   `confirmed`; uno pagado por transferencia **no** entra a cocina hasta que el dinero está verificado. Evita
   que un pedido fantasma llegue a preparación.
2. **El cruce de pagos es una sola consulta atómica.** Busca un aviso bancario que coincida en **monto
   exacto**, dentro de la ventana de tiempo, **no usado antes** (`usado_por_pedido IS NULL`) y con firma
   DKIM/DMARC válida; la marca de "usado" se hace en la misma sentencia (`UPDATE … RETURNING`), así que un pago
   **nunca** puede confirmar dos pedidos.
3. **Filtros calculados en la base, no en memoria.** La deduplicación de avisos usa una **huella calculada con
   los datos del aviso** (no con el ID del correo): un reenvío del mismo aviso entra con otro `Message-ID` y la
   base lo rechaza igual.
4. **`jsonb` para lo que el negocio inventa.** Productos y datos del pedido van en `jsonb` para no migrar el
   esquema cada vez que cambie un menú o un campo.
5. **Nodos que devuelven siempre los mismos ítems.** Varias consultas del flujo están escritas para devolver
   **una fila aunque no encuentren nada** (`pago_id` NULL): si devolvieran cero filas, el nodo siguiente no
   ejecutaría y el flujo moriría en silencio.
6. **Aislamiento multi-negocio desde la base.** `tenant_id NOT NULL` y sin valores por defecto; cada consulta
   filtra por negocio y la base rechaza escribir sin él.
7. **Tokens firmados para el domiciliario.** El login por PIN devuelve un token HMAC-SHA256 con `rider_id`,
   `tenant_id` y vencimiento; los endpoints del domiciliario leen el `rider_id` **del token**, no del cliente.
8. **Un secreto compartido entre el panel y n8n.** El navegador nunca conoce las URLs internas: el backend del
   panel hace de proxy y añade la cabecera con el secreto; Cloudflare bloquea esas rutas sin ella.

## Resultados (medidos en el repositorio)

- **15.328 líneas** de TypeScript en el panel (**129 archivos**), **13 páginas** y **62 componentes**.
- **3 workflows de n8n** incluidos: router (**8 nodos**), agente IA de restaurante (**95 nodos**) y API del
  panel (**147 nodos**, 31 endpoints).
- **7 tablas** en PostgreSQL + **3** en MySQL (esquema completo en `db/`).
- App del domiciliario con **19 archivos** (login por PIN, pedidos, entrega con evidencia, GPS).
- **2 negocios reales** en producción con el sistema (no se incluyen sus datos ✅).

## Limitaciones y qué no hace

- **La validación automática de pagos depende de que el banco mande un correo**: Nequi solo cuando entra por
  Bre-B y Davivienda sí; **Nequi→Nequi y Daviplata no mandan correo**, así que para esos casos la validación
  es manual o se necesita otro canal lector de notificaciones del celular o una pasarela de pago.
- **Los menús viven en Google Sheets**, no en la base: es cómodo para el dueño del negocio, pero no es lo que
  haría para 50 clientes.
- **La autorización por PIN de 4 dígitos** es débil por diseño se compensa con el token firmado y el bloqueo
  en el borde, pero un PIN de 4 dígitos no es una contraseña, tambien se puede mejorar con cloudflared.
- **Es un proyecto colombiano**: las integraciones Bre-B, Nequi, los precios en COP están atadas a los rieles
  de pago locales.
- **No es una pasarela de pagos ni un ERP**: no mueve dinero ni gestiona inventario.

## Experiencia adquirida 

- Los **fallos más caros son los silenciosos**: un webhook bloqueado, un `status` que nunca coincide, un correo
  que llega con otro formato. Casi todo mi trabajo terminó siendo observabilidad y *fail-safe*: ante la duda,
  el sistema **no** confirma nada y avisa a una persona.
- **No se puede confiar en que el modelo emita una marca oculta** solo porque se la pides en un párrafo: si
  algo tiene que ser infalible, se hace **con nodos y consultas**, no con el prompt.
- En flujos con ramas paralelas, **un nodo sin manejo de error tumba toda la ejecución**: conviene que cada
  nodo que manda un mensaje o lee un servicio externo pueda fallar solo.
- Lo haría distinto: empezar por **un solo negocio real** y no por el multi-negocio; y escribir las pruebas de
  integración del flujo completo **antes** de añadir funciones.

## Cómo reproducirlo 

```bash
# 1) Base de datos de demostración (PostgreSQL)
psql -h localhost -U talos -d restaurante_menu -f db/schema_postgres.sql
psql -h localhost -U talos -d restaurante_menu -f db/seed_demo_postgres.sql

# 2) Usuario y negocio demo (MySQL/MariaDB)
mysql -u talos -p talos_dashboard < db/seed_demo_mysql.sql

# 3) Panel (Node 20+)
cd app && cp .env.example .env   # ajusta DATABASE_URL y las credenciales del demo
npm install && npm run dev
```

O con todo en contenedores:

```bash
docker compose -f demo/docker-compose.demo.yml up
```

**Credenciales del demo:** `demo@talos.example` / `demo1234` .

## Estructura del repositorio

```
api/            API del panel (Hono + tRPC): sesión, proxy a n8n, rutas de negocio
src/            Panel React (13 páginas) + app del domiciliario (src/rider)
public/         HTML del panel del encargado y del domiciliario
contracts/      Tipos y contratos compartidos
db/             Modelo de datos (drizzle) + esquema PostgreSQL + datos de demo
n8n/            3 workflows exportados y saneados (imputables en n8n)
demo/           docker-compose de demostración y variables de ejemplo
```

## Licencia y contacto

MIT — ver [LICENSE](LICENSE).

**Luis Guillermo Reyes Luna** · Montería, Colombia
· Tecnólogo en Análisis y Desarrollo de Software 
· `guillermoreyes@talossentinel.com` · +57 302 394 8191

> *Parte del código se escribió con apoyo de asistentes de IA; los requisitos, el modelo de datos, las
> decisiones, el despliegue y la operación son míos.*
