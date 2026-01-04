# ---------- STAGE 1: BUILD ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar TODAS las dependencias (dev + prod)
COPY package*.json ./
RUN npm ci

# Copiar el código
COPY . .

# Compilar TypeScript
RUN npm run build

# ---------- STAGE 2: RUN ----------
FROM node:20-alpine
WORKDIR /app

# Copiar solo las dependencias de producción
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# Copiar el código ya compilado desde el builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
