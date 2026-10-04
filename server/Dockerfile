FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN node_modules/.bin/prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY migrate.js ./migrate.js
EXPOSE 3001
# Сначала миграции (prisma migrate deploy — без молчаливого удаления данных), потом сервер
CMD ["sh", "-c", "node migrate.js && exec node dist/index.js"]
