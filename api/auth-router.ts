import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { signSessionToken } from "./kimi/session";
import { env } from "./lib/env";
import { findUserByEmail, setUserPassword, upsertUser } from "./queries/users";
import { hashPassword, verifyPassword } from "./lib/passwords";

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
        expires: new Date(0),
      }),
    );
    return { success: true };
  }),

  // Login local: correo + contraseña (multi-tenant, creado por el admin)
  loginWithPassword: publicQuery
    .input(
      z.object({
        email: z.string().email("Correo inválido"),
        password: z.string().min(1, "Contraseña requerida"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await findUserByEmail(input.email);
      if (!user || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Correo o contraseña incorrectos",
        });
      }

      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: env.appId,
      });

      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        }),
      );

      // Actualizar último ingreso (upsert por unionId, no toca otros campos)
      await upsertUser({ unionId: user.unionId, lastSignInAt: new Date() });

      return { success: true, name: user.name };
    }),

  // Cambio de contraseña del usuario autenticado (verifica la actual).
  // Si la cuenta aun no tiene contraseña local (cuenta migrada), permite
  // definirla sin clave actual.
  changePassword: authedQuery
    .input(
      z.object({
        currentPassword: z.string(),
        newPassword: z
          .string()
          .min(6, "La nueva contraseña debe tener mínimo 6 caracteres"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hasExisting = !!ctx.user.passwordHash;
      if (
        hasExisting &&
        !verifyPassword(input.currentPassword, ctx.user.passwordHash)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La contraseña actual no es correcta",
        });
      }
      await setUserPassword(ctx.user.id, hashPassword(input.newPassword));
      return { success: true };
    }),
});
