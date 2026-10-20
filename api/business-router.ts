import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import {
  findBusinessByUser,
  createBusiness,
  updateBusiness,
  listAllBusinesses,
} from "./queries/businesses";

const businessInput = z.object({
  name: z.string().min(2, "Nombre requerido").max(255),
  type: z.enum(["restaurante", "farmacia", "negocio"]),
  phoneNumberId: z.string().max(64).optional(),
  chatwootBaseUrl: z.string().url().max(255).optional(),
  chatwootAccountId: z.number().int().positive().optional(),
  chatwootInboxId: z.number().int().positive().optional(),
  promoTemplate: z.string().max(120).optional(),
});

export const businessRouter = createRouter({
  // Mi negocio (uno por usuario)
  mine: authedQuery.query(({ ctx }) => findBusinessByUser(ctx.user.id)),

  // Crear negocio (onboarding tras el primer login)
  create: authedQuery.input(businessInput).mutation(({ ctx, input }) =>
    createBusiness({
      userId: ctx.user.id,
      name: input.name,
      type: input.type,
      phoneNumberId: input.phoneNumberId,
    }),
  ),

  // Actualizar perfil del negocio
  update: authedQuery
    .input(
      businessInput.partial().extend({
        apiBase: z.string().url().max(255).optional(),
        liveMode: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => updateBusiness(ctx.user.id, input)),

  // Cambiar tema del dashboard (persistente por negocio)
  setTheme: authedQuery
    .input(z.object({ theme: z.enum(["purpura", "oscuro", "talos", "calido"]) }))
    .mutation(({ ctx, input }) =>
      updateBusiness(ctx.user.id, { theme: input.theme }),
    ),

  // Solo admin (dueño de la plataforma): todos los negocios
  listAll: adminQuery.query(() => listAllBusinesses()),
});
