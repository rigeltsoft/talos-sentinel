import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  // El HTML NUNCA se cachea en el navegador: así cada despliegue se ve al
  // instante. Los assets sí pueden cachearse porque llevan hash en el nombre.
  // (Sin esto, tras desplegar el panel seguía sirviendo el bundle viejo hasta
  //  4 horas después — causa del aviso "No se pudo conectar con la API de n8n".)
  app.use("*", async (c, next) => {
    await next();
    const tipo = c.res.headers.get("content-type") ?? "";
    if (tipo.includes("text/html")) {
      c.res.headers.set("Cache-Control", "no-store, must-revalidate");
      c.res.headers.set("Pragma", "no-cache");
    }
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });
}
