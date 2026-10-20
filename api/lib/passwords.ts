import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Hash de contraseñas con scrypt (nativo de Node, sin dependencias).
// Formato almacenado: "s1:<salt_hex>:<hash_hex>"

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `s1:${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) return false;
  const [version, salt, hash] = stored.split(":");
  if (version !== "s1" || !salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return test.length === expected.length && timingSafeEqual(test, expected);
}
