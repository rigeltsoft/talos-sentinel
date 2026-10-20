import type { CookieOptions } from "hono/utils/cookie";

// Cookie segura SOLO cuando la peticion llega por HTTPS.
// Detras de un proxy (Cloudflare Tunnel) el header
// x-forwarded-proto dice la verdad; en acceso directo (localhost,
// IP Tailscale http://100.x.x.x) no hay header -> la cookie va sin
// Secure, porque el navegador descarta cookies Secure en HTTP.
export function getSessionCookieOptions(headers: Headers): CookieOptions {
  const proto = headers.get("x-forwarded-proto");
  const secure = proto === "https";

  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "None" : "Lax",
    secure,
  };
}
