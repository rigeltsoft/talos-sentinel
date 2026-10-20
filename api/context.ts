import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { authenticateRequest } from "./kimi/session";
import { ensureSeedAdmin } from "./lib/seed";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  // Garantiza que exista el administrador inicial (correo + contraseña).
  // Corre una sola vez por proceso; si la BD aun no esta lista, reintenta
  // en la siguiente peticion.
  await ensureSeedAdmin();

  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // Authentication is optional here
  }
  return ctx;
}
