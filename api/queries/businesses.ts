import { getDb } from "./connection";
import { businesses, users } from "@db/schema";
import { eq } from "drizzle-orm";

export async function findBusinessByUser(userId: number) {
  const row = await getDb().query.businesses.findFirst({
    where: eq(businesses.userId, userId),
  });
  // React Query no acepta undefined: null = "este usuario aun no tiene negocio"
  return row ?? null;
}

export async function createBusiness(data: {
  userId: number;
  name: string;
  type: "restaurante" | "farmacia" | "negocio";
  phoneNumberId?: string;
}) {
  const [{ id }] = await getDb().insert(businesses).values(data).$returningId();
  return getDb().query.businesses.findFirst({ where: eq(businesses.id, id) });
}

export async function updateBusiness(
  userId: number,
  data: Partial<{
    name: string;
    type: "restaurante" | "farmacia" | "negocio";
    theme: "purpura" | "oscuro" | "talos" | "calido";
    phoneNumberId: string;
    apiBase: string;
    liveMode: boolean;
    chatwootBaseUrl: string | null;
    chatwootAccountId: number | null;
    chatwootInboxId: number | null;
    promoTemplate: string | null;
  }>,
) {
  await getDb()
    .update(businesses)
    .set(data)
    .where(eq(businesses.userId, userId));
  return findBusinessByUser(userId);
}

export async function listAllBusinesses() {
  const db = getDb();
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      type: businesses.type,
      theme: businesses.theme,
      phoneNumberId: businesses.phoneNumberId,
      liveMode: businesses.liveMode,
      createdAt: businesses.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(businesses)
    .leftJoin(users, eq(businesses.userId, users.id));
  return rows;
}
