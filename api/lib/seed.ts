import { eq } from "drizzle-orm";
import { users } from "@db/schema";
import { getDb } from "../queries/connection";
import { hashPassword } from "./passwords";

// Siembra el administrador inicial (correo + contraseña) una vez por proceso.
// Si existe el usuario "local-dev" del antiguo modo bypass, lo MIGRA conservando
// su id (y por tanto sus negocios) y le asigna correo + contraseña.
//
// Configurable por entorno: ADMIN_EMAIL / ADMIN_PASSWORD.
// Por defecto: admin@talos.local / admin123  (cámbiala al primer ingreso).

let inflight: Promise<void> | null = null;

export function ensureSeedAdmin(): Promise<void> {
  if (!inflight) {
    inflight = seed().catch((err) => {
      console.error("[seed] no se pudo sembrar el admin (se reintenta):", err);
      inflight = null; // permite reintento en la siguiente petición
    });
  }
  return inflight;
}

async function seed() {
  const email = (process.env.ADMIN_EMAIL || "admin@talos.local")
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) return;

  const legacy = await db.query.users.findFirst({
    where: eq(users.unionId, "local-dev"),
  });
  if (legacy) {
    await db
      .update(users)
      .set({
        email,
        passwordHash: hashPassword(password),
        name: legacy.name ?? "Administrador",
        role: "admin",
      })
      .where(eq(users.id, legacy.id));
    console.log(`[seed] usuario local-dev migrado a admin: ${email}`);
    return;
  }

  await db.insert(users).values({
    unionId: `local:${email}`,
    name: "Administrador",
    email,
    passwordHash: hashPassword(password),
    role: "admin",
  });
  console.log(`[seed] administrador creado: ${email}`);
}
