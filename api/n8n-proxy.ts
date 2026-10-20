import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { authenticateRequest } from "./kimi/session";

// ============================================================================
// PROXY del panel hacia n8n  (cierra el hallazgo S1 — 14/10/2026)
// ----------------------------------------------------------------------------
// ANTES: el navegador llamaba DIRECTO a https://api.talos.example.com/webhook/*
//        → esos endpoints estaban publicados sin autenticación y devolvían pedidos,
//          clientes, conversaciones y domiciliarios de TODOS los negocios.
// AHORA: el navegador llama a  /api/n8n/*  (mismo origen, con la cookie de sesión)
//        y este proxy:
//          1) exige una SESIÓN VÁLIDA del panel (si no, 401)
//          2) reenvía la petición a n8n agregando el secreto  x-talos-proxy
//        El secreto vive SOLO aquí (servidor). Nunca llega al navegador.
//
// En Cloudflare se debe bloquear el acceso público a /webhook/dashboard/*,
// /webhook/manager/* y /webhook/chatwoot-* salvo que traigan ese encabezado.
// ============================================================================

// Se puede rotar sin tocar código definiendo N8N_PROXY_SECRET en el entorno.
const SECRETO =
  process.env.N8N_PROXY_SECRET ??
  "CAMBIAR_SECRETO_PROXY";

const DESTINO = (process.env.N8N_PUBLIC_URL ?? "https://api.talos.example.com").replace(/\/+$/, "");

// ── Token del domiciliario (Fase 3) ────────────────────────────────────────
// Se firma con HMAC-SHA256 usando un secreto COMPARTIDO con n8n (el login del
// domiciliario lo emite; este proxy lo verifica). El secreto vive en el servidor.
const SECRETO_RIDER =
  process.env.RIDER_TOKEN_SECRET ?? "CAMBIAR_SECRETO_RIDER";

// ⚠️ Cambiar a true SOLO cuando todos los domiciliarios hayan entrado con el
// token (basta con que abran la app y pongan su PIN). Con false se comporta
// igual que hoy: deja pasar aunque no venga token (compatibilidad).
// ENCENDIDO el 15/10/2026 (Fase 3 · Paso 4): sin token válido, el proxy responde
// 401 y la app del domiciliario pide el PIN otra vez (auto-recuperable).
// Para apagarlo sin desplegar: RIDER_MODO_ESTRICTO=false en el entorno.
const MODO_ESTRICTO_RIDER = process.env.RIDER_MODO_ESTRICTO
  ? process.env.RIDER_MODO_ESTRICTO === "true"
  : true;

/** Verifica el token del domiciliario y devuelve su identidad {r: rider_id, t: tenant_id}. */
function verificarTokenRider(token: string | undefined): { r: number; t: number } | null {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes;
  const esperada = createHmac("sha256", SECRETO_RIDER).update(cuerpo).digest("base64url");
  try {
    if (esperada.length !== firma.length) return null;
    if (!timingSafeEqual(Buffer.from(esperada), Buffer.from(firma))) return null;
    const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    if (!datos?.r || !datos?.exp) return null;
    if (Number(datos.exp) < Math.floor(Date.now() / 1000)) return null; // vencido
    return { r: Number(datos.r), t: Number(datos.t) };
  } catch {
    return null;
  }
}

const CABECERAS_QUE_PASAN = ["content-type", "accept", "accept-language", "x-rider-token"];

// Reenvía una petición a n8n agregando el secreto. Devuelve la respuesta tal cual.
async function reenviarA_n8n(c: {
  req: { method: string; url: string; header: (n: string) => string | undefined; text: () => Promise<string> };
  camino: string;
  cabecerasExtra?: Record<string, string>;
}) {
  const url = new URL(c.req.url);
  const destino = `${DESTINO}/webhook/${c.camino}${url.search}`;

  const cabeceras: Record<string, string> = { "x-talos-proxy": SECRETO, ...(c.cabecerasExtra ?? {}) };
  for (const h of CABECERAS_QUE_PASAN) {
    const v = c.req.header(h);
    if (v) cabeceras[h] = v;
  }
  if (!cabeceras["content-type"] && !["GET", "HEAD"].includes(c.req.method)) {
    cabeceras["content-type"] = "application/json";
  }

  const cuerpo = ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.text();
  const corte = AbortSignal.timeout(120_000);
  try {
    const r = await fetch(destino, { method: c.req.method, headers: cabeceras, body: cuerpo, signal: corte });
    const texto = await r.text();
    return new Response(texto, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") ?? "application/json", "x-talos-proxy": "panel" },
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "error desconocido";
    return new Response(JSON.stringify({ error: `n8n no respondió: ${mensaje}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}


/** Prueba las 4 llamadas que hace el panel y devuelve solo el estado de cada una. */
async function probarLlamadasDelPanel(tenantId: string) {
  const rutas = [
    "dashboard/orders",
    "dashboard/riders",
    "dashboard/promo-subscribers",
    "dashboard/promo-history",
  ];
  const salida: Record<string, string> = {};
  for (const ruta of rutas) {
    try {
      const r = await fetch(`${DESTINO}/webhook/${ruta}?tenant_id=${tenantId}`, {
        headers: { "x-talos-proxy": SECRETO, accept: "application/json" },
        signal: AbortSignal.timeout(30000),
      });
      const texto = await r.text();
      let forma = "vacío";
      try {
        const j = JSON.parse(texto);
        forma = Array.isArray(j) ? `lista de ${j.length}` : `objeto(${Object.keys(j).slice(0, 3).join(",")})`;
      } catch {
        forma = `no-JSON: ${texto.slice(0, 40)}`;
      }
      salida[ruta] = `${r.status === 200 ? "✅" : "❌"} HTTP ${r.status} · ${forma}`;
    } catch (e) {
      salida[ruta] = "❌ " + (e instanceof Error ? e.message : "sin respuesta");
    }
  }
  return salida;
}

export function montarProxyN8n(app: Hono<{ Bindings: HttpBindings }>) {
  // ── Diagnóstico (14/10): abre esta URL estando logueado ────────────────────
  // No expone secretos ni datos: solo dice si llegó la cookie de sesión, si es
  // válida y si el backend alcanza n8n. Sirve para cerrar el incidente del
  // aviso "No se pudo conectar con la API de n8n".
  app.get("/api/diag", async (c) => {
    const cookieCruda = c.req.header("cookie") ?? "";
    const nombres = cookieCruda.split(";").map((p) => p.split("=")[0].trim()).filter(Boolean);

    let sesion = "sin cookie de sesión";
    let quien: { email?: string | null; rol?: string; negocio?: unknown } = {};
    try {
      const u = await authenticateRequest(c.req.raw.headers);
      sesion = "✅ válida";
      // Quién soy y a qué negocio resuelve mi sesión (para diagnosticar
      // "los dos negocios muestran lo mismo"). Solo con sesión válida.
      const { findBusinessByUser } = await import("./queries/businesses");
      const negocio = await findBusinessByUser(u.id);
      quien = {
        email: u.email ?? null,
        rol: u.role,
        negocio: negocio
          ? { id: negocio.id, nombre: negocio.name, phoneNumberId: negocio.phoneNumberId, inbox: negocio.chatwootInboxId, liveMode: negocio.liveMode }
          : "(este usuario NO tiene negocio)",
      };
    } catch (e) {
      sesion = "❌ " + (e instanceof Error ? e.message : "inválida");
    }

    let n8n = "";
    try {
      const r = await fetch(`${DESTINO}/webhook/rider/businesses`, {
        headers: { "x-talos-proxy": SECRETO },
        signal: AbortSignal.timeout(20000),
      });
      n8n = `✅ HTTP ${r.status}`;
    } catch (e) {
      n8n = "❌ " + (e instanceof Error ? e.message : "sin respuesta");
    }

    return c.json({
      panel: "proxy activo",
      cookies_recibidas: nombres.length ? nombres : "(ninguna)",
      sesion_del_panel: sesion,
      ...quien,
      alcance_a_n8n: n8n,
      destino_actual: DESTINO,
      modo_estricto_domiciliario: MODO_ESTRICTO_RIDER,
      version_proxy: "2026-10-14d",
      // Con ?probar=1&tenant_id=N se prueban las 4 llamadas del panel y se
      // informa el estado de cada una (sin exponer los datos).
      ...(c.req.query("probar")
        ? { pruebas: await probarLlamadasDelPanel(c.req.query("tenant_id") ?? "4") }
        : {}),
    });
  });

  // ── Rutas del DOMICILIARIO: /api/rider/<x>  →  /webhook/rider/<x> ──────────
  // No piden sesión de panel (el domiciliario no la tiene): la identidad la
  // valida n8n con el token del domiciliario. Se monta ANTES que /api/n8n y es
  // 100% aditivo: la app actual sigue usando la URL pública y no se entera.
  app.all("/api/rider/*", async (c) => {
    const camino = c.req.path.replace(/^\/api\//, ""); // "rider/orders" → /webhook/rider/orders
    if (!camino || camino.includes("..")) return c.json({ error: "ruta inválida" }, 400);

    // El login no lleva token (es justo donde se obtiene).
    if (!camino.startsWith("rider/login")) {
      const identidad = verificarTokenRider(c.req.header("x-rider-token"));
      if (!identidad && MODO_ESTRICTO_RIDER) {
        return c.json(
          { error: "Sesión de domiciliario inválida o vencida. Vuelve a entrar con tu PIN." },
          401,
        );
      }
      // Con identidad válida, se informa a n8n quién es de verdad (el rider_id
      // del token manda; así el que llega en la URL/cuerpo no puede suplantarlo).
      if (identidad) {
        return reenviarA_n8n({
          req: c.req,
          camino,
          cabecerasExtra: { "x-rider-id": String(identidad.r), "x-rider-tenant": String(identidad.t) },
        });
      }
    }
    return reenviarA_n8n({ req: c.req, camino });
  });

  app.all("/api/n8n/*", async (c) => {
    // 1) ¿Hay sesión válida del panel?
    try {
      await authenticateRequest(c.req.raw.headers);
    } catch {
      return c.json({ error: "No autorizado: inicia sesión en el panel" }, 401);
    }

    // 2) Reenviar a n8n con el secreto
    const resto = c.req.path.replace(/^\/api\/n8n\//, "");
    if (!resto || resto.includes("..")) return c.json({ error: "ruta inválida" }, 400);
    return reenviarA_n8n({ req: c.req, camino: resto });
  });
}
