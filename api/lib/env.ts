import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
};

// En producción, un APP_SECRET débil o corto es fallo fatal: no arrancar.
if (env.isProduction) {
  const weakSecrets = [
    "",
    "local",
    "secret",
    "changeme",
    "local-secret-no-usado-en-login-local",
  ];
  if (weakSecrets.includes(env.appSecret) || env.appSecret.length < 32) {
    throw new Error(
      "APP_SECRET inválido para producción: usa una clave aleatoria de al menos 32 caracteres (genera una con: openssl rand -hex 32).",
    );
  }
}
