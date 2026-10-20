import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { eq } from "drizzle-orm";
import { businesses } from "../db/schema";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// Datos públicos de un negocio (id → nombre + tema) para que la app del
// domiciliario use el MISMO tema que el dashboard (businesses.theme en MySQL),
// sin depender del mapa manual de n8n. Solo datos de apariencia/marca.
app.get("/api/public/business/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
    const { getDb } = await import("./queries/connection");
    const row = await getDb().query.businesses.findFirst({
      where: eq(businesses.id, id),
      columns: { id: true, name: true, theme: true },
    });
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ id: row.id, name: row.name, theme: row.theme });
  } catch {
    return c.json({ error: "not found" }, 404);
  }
});

// Proxy hacia n8n: el navegador ya NO llama directo a la URL pública de n8n.
// Exige sesión del panel y agrega el secreto que Cloudflare valida (hallazgo S1).
const { montarProxyN8n } = await import("./n8n-proxy");
montarProxyN8n(app);

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  // Aplica las migraciones pendientes en segundo plano (idempotente).
  // No bloquea el arranque: si la BD no responde, el servidor sigue sirviendo.
  void (async () => {
    try {
      const { migrate } = await import("drizzle-orm/mysql2/migrator");
      const { getDb } = await import("./queries/connection");
      const path = await import("path");
      const fs = await import("fs");
      const candidates = [
        path.resolve(process.cwd(), "db/migrations"),
        path.resolve(process.cwd(), "../db/migrations"),
      ];
      const migrationsFolder = candidates.find((p) => fs.existsSync(p));
      if (migrationsFolder) {
        await migrate(getDb(), { migrationsFolder });
        console.log("Database migrations applied");
      } else {
        console.error("Migrations folder not found in:", candidates.join(", "));
      }
    } catch (err) {
      console.error("Database migration failed (server continues):", err);
    }
  })();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
