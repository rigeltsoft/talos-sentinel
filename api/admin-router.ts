import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { businesses, users } from "@db/schema";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { findUserByEmail, setUserPassword } from "./queries/users";
import { hashPassword } from "./lib/passwords";
// Panel del dueño de la plataforma (Talos Sentinel):
// crea usuarios con su negocio, lista cuentas y restablece contraseñas.
export const adminRouter = createRouter({
  listUsers: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        hasPassword: sql<boolean>`${users.passwordHash} IS NOT NULL`,
        lastSignInAt: users.lastSignInAt,
        createdAt: users.createdAt,
        businessId: businesses.id,
        businessName: businesses.name,
        businessType: businesses.type,
        phoneNumberId: businesses.phoneNumberId,
      })
      .from(users)
      .leftJoin(businesses, eq(businesses.userId, users.id))
      .orderBy(desc(users.createdAt));
  }),

  // Crea un usuario (rol user) junto con su negocio, listo para entregar.
  createUser: adminQuery
    .input(
      z.object({
        name: z.string().min(2, "Nombre requerido"),
        email: z.string().email("Correo inválido"),
        password: z.string().min(6, "Mínimo 6 caracteres"),
        businessName: z.string().min(2, "Nombre del negocio requerido"),
        businessType: z.enum(["restaurante", "farmacia", "negocio"]),
        phoneNumberId: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const email = input.email.toLowerCase().trim();
      const existing = await findUserByEmail(email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ya existe un usuario con ese correo",
        });
      }

      const db = getDb();
      const [{ id }] = await db
        .insert(users)
        .values({
          unionId: `local:${email}`,
          name: input.name,
          email,
          passwordHash: hashPassword(input.password),
          role: "user",
        })
        .$returningId();

      // El negocio nace en modo en vivo: apunta a la API real de n8n
      await db.insert(businesses).values({
        userId: id,
        name: input.businessName,
        type: input.businessType,
        phoneNumberId: input.phoneNumberId || null,
        liveMode: true,
      });

      return { success: true, userId: id };
    }),

  // Editar datos del usuario (nombre y correo) y, si tiene negocio, sus datos
  // básicos (nombre, tipo y Phone Number ID de WhatsApp).
  updateUser: adminQuery
    .input(
      z.object({
        userId: z.number(),
        name: z.string().min(2, "Nombre requerido"),
        email: z.string().email("Correo inválido"),
        businessName: z.string().min(2, "Nombre del negocio requerido").optional(),
        businessType: z.enum(["restaurante", "farmacia", "negocio"]).optional(),
        phoneNumberId: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const email = input.email.toLowerCase().trim();

      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });

      const sameEmail = await findUserByEmail(email);
      if (sameEmail && sameEmail.id !== input.userId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ese correo ya lo usa otro usuario",
        });
      }

      await db
        .update(users)
        .set({
          name: input.name.trim(),
          email,
          unionId: `local:${email}`,
        })
        .where(eq(users.id, input.userId));

      if (input.businessName) {
        await db
          .update(businesses)
          .set({
            name: input.businessName.trim(),
            ...(input.businessType ? { type: input.businessType } : {}),
            phoneNumberId: input.phoneNumberId?.trim() || null,
          })
          .where(eq(businesses.userId, input.userId));
      }

      return { success: true };
    }),

  // Restablecer contraseña de un usuario (recuperación asistida por admin,
  // usando el correo asociado como verificación de identidad)
  resetPassword: adminQuery
    .input(
      z.object({
        userId: z.number(),
        newPassword: z.string().min(6, "Mínimo 6 caracteres"),
      }),
    )
    .mutation(async ({ input }) => {
      await setUserPassword(input.userId, hashPassword(input.newPassword));
      return { success: true };
    }),

  // Cambiar el rol de un usuario (admin = dueño de la plataforma / user = negocio).
  // Protecciones: no quitarte tu propio admin y no dejar la plataforma sin admins.
  setUserRole: adminQuery
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true, email: true, role: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });

      if (target.id === ctx.user!.id && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes quitarte a ti mismo el rol de administrador.",
        });
      }

      if (target.role === "admin" && input.role === "user") {
        const [{ total }] = await db
          .select({ total: sql<number>`COUNT(*)` })
          .from(users)
          .where(eq(users.role, "admin"));
        if (Number(total) <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Debe existir al menos un administrador de la plataforma.",
          });
        }
      }

      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Eliminar usuario. Si tiene negocio, se elimina también su registro de negocio
  // (los pedidos históricos de ese tenant permanecen en la base).
  deleteUser: adminQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { id: true, email: true, role: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });

      if (target.id === ctx.user!.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes eliminar tu propia cuenta de administrador.",
        });
      }

      if (target.role === "admin") {
        const [{ total }] = await db
          .select({ total: sql<number>`COUNT(*)` })
          .from(users)
          .where(eq(users.role, "admin"));
        if (Number(total) <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No puedes eliminar al último administrador de la plataforma.",
          });
        }
      }

      await db.delete(businesses).where(eq(businesses.userId, target.id));
      await db.delete(users).where(eq(users.id, target.id));
      return { success: true };
    }),
});
