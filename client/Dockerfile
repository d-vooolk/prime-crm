# Базовый образ
FROM node:20-alpine

# Рабочая директория внутри контейнера
WORKDIR /app

# Копируем package.json и lock-файл
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код
COPY . .

# Сборка проекта
RUN npm run build

# Используем утилиту serve для раздачи статики
RUN npm install -g serve

# Запускаем фронт
CMD ["serve", "-s", "dist", "-l", "3000"]
