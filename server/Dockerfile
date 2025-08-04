FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Собираем TypeScript в JS (если используешь TS)
RUN npm run build

# Запускаем сервер (предположим, он лежит в `dist/index.js`)
CMD ["node", "dist/index.js"]
