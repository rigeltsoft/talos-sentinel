import { authRouter } from "./auth-router";
import { adminRouter } from "./admin-router";
import { businessRouter } from "./business-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  admin: adminRouter,
  business: businessRouter,
});

export type AppRouter = typeof appRouter;
