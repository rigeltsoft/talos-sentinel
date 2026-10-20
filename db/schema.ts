import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  int,
  text,
  timestamp,
  bigint,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  // Hash scrypt "s1:salt:hash" para login local con correo + contraseña.
  // Nulo en cuentas migradas que aún no definen contraseña local.
  passwordHash: varchar("passwordHash", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Negocios (tenants) de la plataforma Talos Sentinel.
// Cada usuario administra UN negocio con su propio dashboard independiente.
export const businesses = mysqlTable("businesses", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["restaurante", "farmacia", "negocio"])
    .default("restaurante")
    .notNull(),
  theme: mysqlEnum("theme", ["purpura", "oscuro", "talos", "calido"])
    .default("purpura")
    .notNull(),
  phoneNumberId: varchar("phoneNumberId", { length: 64 }),
  apiBase: varchar("apiBase", { length: 255 })
    .default("https://agentiapi.talos.example.com/webhook")
    .notNull(),
  liveMode: boolean("liveMode").default(false).notNull(),
  // Configuración de Chatwoot (el token de API vive en el proxy n8n)
  chatwootBaseUrl: varchar("chatwootBaseUrl", { length: 255 }),
  chatwootAccountId: int("chatwootAccountId"),
  chatwootInboxId: int("chatwootInboxId"),
  // Template de Meta para promociones (ej: promocion_informativa_niche|es_CO)
  promoTemplate: varchar("promoTemplate", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = typeof businesses.$inferInsert;

// TODO: Add your tables here. See docs/Database.md for schema examples and patterns.
//
// Example:
// export const posts = mysqlTable("posts", {
//   id: serial("id").primaryKey(),
//   title: varchar("title", { length: 255 }).notNull(),
//   content: text("content"),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
// });
//
// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()
