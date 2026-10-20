# ===== Etapa 1: build =====
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ===== Etapa 2: runtime =====
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/db ./db

EXPOSE 3000

# Al arrancar, boot.ts aplica las migraciones de db/migrations sobre DATABASE_URL
# y crea el admin inicial (ADMIN_EMAIL / ADMIN_PASSWORD) si no existe.
CMD ["node", "dist/boot.js"]
