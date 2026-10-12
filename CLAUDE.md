# CLAUDE.md — Prime CRM

Архитектурные решения, соглашения и правила для разработки.
Этот файл обязателен к прочтению перед любыми изменениями в проекте.

---

## Обзор проекта

**Prime CRM** — система управления записями для автосервиса.
Деплой на выделенный Linux-сервер. Клиент и сервер работают в Docker-контейнерах.

---

## Стек технологий

### Frontend
- **React 19 + TypeScript** — UI
- **Webpack** — сборка
- **Ant Design 5** — UI-компоненты (уже настроен, локаль ru_RU)
- **Zustand** — глобальный стейт
- **React Router v6** — навигация между страницами
- **SCSS-модули** — стилизация компонентов
- **dayjs** — работа с датами (поставляется с antd)

### Backend
- **Node.js + TypeScript**
- **Express 5** — HTTP-сервер
- **Prisma ORM** — работа с базой данных
- **PostgreSQL** — база данных (production-ready, выделенный сервер)
- **Zod** — валидация входящих данных
- **cors, helmet** — безопасность
- **multer** — загрузка файлов (если потребуется)

### Инфраструктура
- **Docker + docker-compose** — контейнеризация
- **Nginx** — reverse proxy (клиент + проксирование к API)
- **PostgreSQL** в отдельном контейнере

---

## Структура проекта

```
prime-crm/
├── client/                        # React-приложение
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── api/                   # Функции запросов к серверу
│   │   │   ├── clients.api.ts
│   │   │   ├── records.api.ts
│   │   │   ├── services.api.ts
│   │   │   ├── analytics.api.ts
│   │   │   └── http.ts            # Базовый fetch/axios инстанс
│   │   ├── components/            # Переиспользуемые компоненты
│   │   │   ├── Layout/            # Основной layout (sidebar + content)
│   │   │   ├── Calendar/          # Виджет-календарь (слева)
│   │   │   ├── RecordCard/        # Карточка записи
│   │   │   ├── RecordModal/       # Модал создания/редактирования записи
│   │   │   │   ├── steps/
│   │   │   │   │   ├── Step1Client.tsx    # Данные клиента и авто
│   │   │   │   │   ├── Step2Services.tsx  # Список услуг и стоимость
│   │   │   │   │   └── Step3Summary.tsx   # Итог + печать заявки
│   │   │   │   └── RecordModal.tsx
│   │   │   ├── CloseRecordModal/   # Модал закрытия сделки
│   │   │   ├── PrintTemplates/     # Шаблоны для печати
│   │   │   │   ├── WorkOrderPrint.tsx    # Заявка на работы
│   │   │   │   └── CompletionActPrint.tsx # Акт выполненных работ
│   │   │   └── Shared/             # Базовые UI-компоненты
│   │   │       ├── Button/
│   │   │       ├── StatusBadge/
│   │   │       └── PageHeader/
│   │   ├── pages/                  # Страницы (роуты)
│   │   │   ├── SchedulePage/       # Расписание (главная)
│   │   │   ├── DashboardPage/      # Дашборд с аналитикой
│   │   │   ├── ClientsPage/        # Список клиентов
│   │   │   ├── ServicesPage/       # Управление услугами
│   │   │   └── SettingsPage/       # Настройки
│   │   ├── store/                  # Zustand-сторы
│   │   │   ├── recordsStore.ts
│   │   │   ├── uiStore.ts          # тема, боковое меню и т.д.
│   │   │   └── settingsStore.ts
│   │   ├── hooks/                  # Кастомные хуки
│   │   │   ├── useRecords.ts
│   │   │   ├── useClients.ts
│   │   │   └── useServices.ts
│   │   ├── types/                  # Общие TypeScript-типы
│   │   │   ├── record.types.ts
│   │   │   ├── client.types.ts
│   │   │   └── service.types.ts
│   │   ├── utils/                  # Вспомогательные функции
│   │   │   ├── formatters.ts       # Форматирование дат, сумм
│   │   │   └── print.ts            # Утилиты печати
│   │   ├── styles/
│   │   │   ├── _variables.scss     # CSS-переменные (цвета, отступы)
│   │   │   ├── _theme.scss         # Светлая/тёмная тема
│   │   │   └── global.scss
│   │   ├── config/
│   │   │   └── antd.theme.ts       # Конфиг темы Ant Design
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── webpack.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── server/                         # Express API
│   ├── src/
│   │   ├── routes/                 # Маршруты
│   │   │   ├── clients.routes.ts
│   │   │   ├── records.routes.ts
│   │   │   ├── services.routes.ts
│   │   │   ├── equipment.routes.ts
│   │   │   └── analytics.routes.ts
│   │   ├── controllers/            # Обработчики запросов
│   │   │   ├── clients.controller.ts
│   │   │   ├── records.controller.ts
│   │   │   ├── services.controller.ts
│   │   │   └── analytics.controller.ts
│   │   ├── services/               # Бизнес-логика
│   │   │   ├── clients.service.ts
│   │   │   ├── records.service.ts
│   │   │   └── analytics.service.ts
│   │   ├── middleware/
│   │   │   ├── errorHandler.ts     # Глобальный обработчик ошибок
│   │   │   └── validate.ts         # Zod-валидация
│   │   ├── prisma/
│   │   │   └── client.ts           # Singleton Prisma-клиент
│   │   └── index.ts                # Точка входа
│   ├── prisma/
│   │   ├── schema.prisma           # Схема БД
│   │   └── seed.ts                 # Сиды (начальные данные)
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml
├── docker-compose.prod.yml
└── CLAUDE.md
```

---

## Схема базы данных (Prisma)

```prisma
// Клиент
model Client {
  id        String   @id @default(cuid())
  name      String
  phone     String   @unique
  notes     String?
  createdAt DateTime @default(now())
  records   Record[]
  cars      Car[]
}

// Автомобиль клиента
model Car {
  id             String   @id @default(cuid())
  clientId       String
  brand          String
  model          String
  generation     String?
  generationName String?
  year           String
  plateNumber    String?
  mileage        String?
  client         Client   @relation(fields: [clientId], references: [id])
  records        Record[]
}

// Запись (визит)
model Record {
  id          String       @id @default(cuid())
  clientId    String
  carId       String
  date        String       // DD.MM.YYYY
  time        String       // HH:mm
  serviceman  String
  notes       String?      // Примечание (только внутри системы)
  status      RecordStatus @default(ACTIVE)
  createdAt   DateTime     @default(now())
  client      Client       @relation(fields: [clientId], references: [id])
  car         Car          @relation(fields: [carId], references: [id])
  items       RecordItem[]
  deal        Deal?
}

enum RecordStatus {
  ACTIVE     // Активная запись
  CLOSED     // Сделка закрыта
  CANCELLED  // Отменена
}

// Услуга в записи (позиция)
model RecordItem {
  id        String  @id @default(cuid())
  recordId  String
  serviceId String
  price     Float   // Цена может отличаться от стандартной
  quantity  Int     @default(1)
  record    Record  @relation(fields: [recordId], references: [id])
  service   Service @relation(fields: [serviceId], references: [id])
}

// Справочник услуг
model Service {
  id            String       @id @default(cuid())
  name          String
  categoryId    String
  standardPrice Float
  estimatedTime Int          // В минутах
  category      Category     @relation(fields: [categoryId], references: [id])
  recordItems   RecordItem[]
}

// Категория услуг
model Category {
  id       String    @id @default(cuid())
  name     String
  services Service[]
}

// Закрытая сделка
model Deal {
  id                  String          @id @default(cuid())
  recordId            String          @unique
  finalPrice          Float
  priceIncreaseReason String?
  warranty            String?
  closedAt            DateTime        @default(now())
  record              Record          @relation(fields: [recordId], references: [id])
  equipment           DealEquipment[]
}

// Оборудование установленное в авто (в сделке)
model DealEquipment {
  id          String    @id @default(cuid())
  dealId      String
  equipmentId String
  deal        Deal      @relation(fields: [dealId], references: [id])
  equipment   Equipment @relation(fields: [equipmentId], references: [id])
}

// Справочник оборудования/деталей
model Equipment {
  id    String          @id @default(cuid())
  name  String
  deals DealEquipment[]
}
```

---

## API-эндпоинты

### Клиенты
```
GET    /api/clients              — список (с пагинацией, поиском)
GET    /api/clients/search?phone= — поиск по телефону (для автодополнения)
GET    /api/clients/:id          — клиент + все его записи
POST   /api/clients              — создать клиента
PATCH  /api/clients/:id          — обновить клиента
```

### Записи
```
GET    /api/records?date=        — записи на дату
GET    /api/records/incomplete   — незавершённые за прошлые дни
GET    /api/records/:id          — одна запись
POST   /api/records              — создать запись
PATCH  /api/records/:id          — обновить запись
POST   /api/records/:id/close    — закрыть сделку
```

### Услуги
```
GET    /api/services             — все услуги (с категориями)
GET    /api/categories           — все категории
POST   /api/services             — создать услугу
PATCH  /api/services/:id         — обновить услугу
DELETE /api/services/:id         — удалить услугу
POST   /api/categories           — создать категорию
PATCH  /api/categories/:id       — обновить категорию
DELETE /api/categories/:id       — удалить категорию
```

### Оборудование
```
GET    /api/equipment            — список
POST   /api/equipment            — добавить
PATCH  /api/equipment/:id        — обновить
DELETE /api/equipment/:id        — удалить
```

### Аналитика
```
GET    /api/analytics/summary?period=day|week|month|quarter|year
GET    /api/analytics/revenue?from=&to=
```

---

## UI-страницы и их поведение

### Расписание (`/schedule`) — главная страница
**Десктоп:** слева — календарь (фиксированный), справа — два столбца:
- «Сегодня» — активные записи выбранного дня
- «Не завершены» — записи прошлых дней со статусом ACTIVE

**Мобильный:** нижняя навигация, календарь сворачивается, столбцы стекаются в один список.

### Дашборд (`/dashboard`)
Карточки с цифрами (закрытые сделки, выручка) + графики (antd Charts или recharts).
Периоды: день / неделя / месяц / квартал / год.

### Клиенты (`/clients`)
Таблица: ФИО, телефон, автомобили, кол-во визитов.
Клик → боковая панель или страница с полной историей.

### Услуги (`/services`)
Список категорий и услуг. Кнопки добавить/редактировать/удалить.

### Настройки (`/settings`)
- Светлая / тёмная тема
- Список мастеров-приёмщиков (добавить / удалить)
- Название компании и реквизиты (для печатных документов)
- Список оборудования

---

## Правила разработки

### Общие
- Всегда TypeScript, без `any` (исключение — явно помечается комментарием `// TODO: type`)
- Все запросы к серверу — через функции в `client/src/api/`
- Zustand — только для глобального UI-стейта и кеша данных; серверные данные получаются через хуки
- Бизнес-логика — в `server/src/services/`, контроллеры только принимают/отдают данные
- Валидация входных данных на сервере — всегда через Zod

### Стили
- Только SCSS-модули, никаких inline-стилей
- Переменные цветов, отступов — только через CSS-переменные из `_variables.scss`
- Тёмная тема реализуется через `data-theme="dark"` на `<html>` + CSS-переменные
- Оформление — фирменный стиль prime-auto.by, как у страницы записи для клиента: графит, салатовый `--color-brand` (#A2DB00, текст на нём — `--color-on-accent`), Montserrat (`--font-display`: заголовки, цифры, кнопки, меню; файлы в `client/src/assets/fonts`), Inter — данные и поля. Тёмная тема по умолчанию. Значения antd дублируются в `config/antdTheme.ts`
- Дашборд «Сотрудники»: пьедестал (`/accounting/leaders`, всем ролям; суммы — от менеджера), упущенная премия за вики (`/accounting/missed-wiki`, логика — `missedWiki.logic.ts`: главный сотрудник закрытой сделки не заполнил карточку вики, которой до закрытия не было; период ЗП 25-е–24-е). Сотрудник видит в дашборде только пьедестал, свою карточку и упущенную прибыль. Скрыть сотрудника из дашборда — `Serviceman.showInDashboard`
- «Открытые возможности» (BETA) в карточке записи — `services/opportunities.logic.ts`: попутные работы из прошлых визитов той же модели/поколения, без причины визита и не дороже текущего заказа; только менеджер и выше
- Графики дашборда — неоновые серии `--color-chart-1..6` (тон `Tone` в `useChartColors.ts`), сила свечения — `--chart-glow-opacity`; игровая панель считается в `DashboardPage/gamification.ts`
- Брейкпоинты: mobile < 768px, tablet 768–1199px, desktop ≥ 1200px

### Компоненты
- Один компонент = одна папка с файлами: `index.tsx`, `*.module.scss`
- Пропсы описываются интерфейсом прямо в файле компонента (не выносить в отдельный `types.ts` без необходимости)
- Shared-компоненты — только то, что используется в 3+ местах

### Backend
- Каждый роут регистрируется через отдельный router в `routes/`
- Все ошибки выбрасываются через единый `AppError`, ловятся в `errorHandler`
- Prisma-клиент — синглтон, импортируется из `src/prisma/client.ts`
- ENV-переменные — только через `process.env` (секреты — через `src/config/env.ts`, без значений по умолчанию), все перечислены в `.env.example`
- Тело и query каждого запроса разбираются Zod-схемой через `parse()` из `middleware/validate.ts`. `req.body` никогда не передаётся в Prisma как есть
- Права — на сервере, а не только в интерфейсе: `requireRole(ROLES.MANAGER)` на маршруте (`middleware/requireRole.ts`, роли в `utils/roles.ts`). Матрица прав повторяет клиентский `client/src/utils/roles.ts`
- Несколько связанных записей в базу (особенно деньги) — в одной `prisma.$transaction(async tx => …)`. Функции, которые вызываются внутри транзакции, принимают `db: DbClient`
- Деньги в базе — `Decimal @db.Decimal(14, 2)`. Расширение в `src/prisma/client.ts` отдаёт их числами. Новое денежное поле нужно добавить и туда, иначе оно придёт в JSON строкой
- Хеш пароля скрыт глобально (`omit`). Где он нужен (вход), его запрашивают явно: `omit: { password: false }`
- Логи — только через `utils/logger.ts` (в проде JSON-строки, `docker compose logs server`). Изменения денег пишутся автоматически в таблицу `AuditLog` (`src/prisma/audit.ts`), в интерфейсе журнал не показывается
- Загрузка фото/видео — только через `utils/mediaUpload.ts`: формат проверяется по содержимому файла, а не по расширению
- Фото/видео карточки записи сжимаются (`utils/recordMediaOptimize.ts`): фото — сразу (JPEG до 2560 px + превью WebP), видео — в фоне через ffmpeg (H.264 MP4 до 1920, +faststart, обложка). Пока видео сжимается — `RecordMedia.processing`. Service worker видео не кеширует (Range-запросы)
- Тесты: `npm test` в `server/` и `client/` (vitest). Чистую логику выносить в отдельные функции и покрывать тестами

### База данных и миграции
- Схема меняется только миграциями: правка `schema.prisma` → `npx prisma migrate dev --name <что_меняем>` (нужна локальная база) или `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` и файл в новой папке `prisma/migrations/<дата>_<имя>/migration.sql`
- `prisma db push` в проде не используется. При старте контейнера `server/migrate.js` выполняет `prisma migrate deploy`, а базе без истории миграций один раз помечает применённой базовую миграцию `0_init`
- Миграцию, которая меняет данные, оборачивать в `BEGIN; … COMMIT;`
- Сотрудники связаны с записями и зарплатой по ФИО внешними ключами `ON UPDATE CASCADE`. Переименование переносит историю, удалить сотрудника с историей нельзя (только уволить)

### PWA
- Манифест и иконки — `client/public/` (копируются в сборку), service worker — `client/src/sw.ts` (workbox InjectManifest, только в продакшен-сборке; типы проверяет `tsconfig.sw.json`)
- Регистрация, обновление версии, установка и пуш-подписка — `client/src/pwa/index.ts`; настройки устройства — `components/AppDeviceSettings`
- Кеш: оболочка приложения — precache; `/api/uploads` — CacheFirst; GET `/api/*` — NetworkFirst (кеш только как запасной вариант без сети). При выходе из аккаунта кеш данных и пуш-подписка удаляются
- Пуши — `server/src/services/push.service.ts` (web-push, ключи VAPID в `.env`). Триггеры: новая запись → менеджерам, директорам, создателю и мастеру записи (кроме автора), сделка закрыта → каждому сотруднику его заработок с неё (`dealPayments` в `salaryCalc.ts`, кроме закрывшего), товар дошёл до порога → менеджерам, новое письмо → сотрудникам с ролью «Создатель» (`mail.service.ts`), напоминания заметок (`noteReminders.ts`, раз в минуту)
- `client/nginx.conf`: `sw.js`, `index.html` и манифест отдаются с `no-cache`, иначе телефоны застрянут на старой версии

### Страница записи для клиента
- `https://zapis.prime-auto.by/<код>`: код — `Record.publicToken` (12 случайных символов, создаётся при записи), ссылка в SMS — переменная `{{link}}`, в карточке записи — «Страница для клиента»
- HTML без скриптов собирается сервером при каждом открытии (`routes/publicPage.routes.ts` → `services/publicRecord.service.ts` → `utils/publicRecordPage.ts`), упор на телефоны. Запись закрыта или отменена — «страница недоступна» (410), отдельно ничего не хранится и не копится
- Оформление — фирменный стиль prime-auto.by: логотип и шрифт Montserrat в `server/assets/record-page` (отдаются по `/zapis/assets/…`), контакты и мессенджеры — `BRAND` в `utils/publicRecordPage.ts`. Нажатие на дату — событие на 1 час `/zapis/<код>/calendar.ics` (`utils/recordCalendar.ts`), рядом ссылка на Google Календарь. Страница отзывов (Яндекс и Google, без данных клиента) — `zapis.prime-auto.by/otzyv`, ссылки в `BRAND`
- Блоки страницы — типы ремонта (Справочник → «Типы ремонта»: описание, фото, вопросы-ответы, ссылки), тип назначается услуге. Фото сжимаются в WebP 1280px (`UPLOADS_DIR/repair-types`)
- Nginx поддомена — `.deploy/nginx-zapis.conf`: наружу только `/<код>`, `/api/cars/photo/` и `/api/uploads/repair-types/`. Адрес — `PUBLIC_RECORD_URL`

### Почта
- Ящик на beget по IMAP (`services/mail.service.ts`, imapflow + mailparser): постоянное соединение с IDLE, переподключение через минуту, контрольная проверка раз в 5 минут. Только «Входящие»: «прочитано» и удаление — только в CRM; ящик меняет лишь «В спам»
- Раздел «Почта» — только роль «Создатель» (и мастер-доступ), `requireRole(ROLES.CREATOR)`. Пуш о новом письме — только сотрудникам с ролью «Создатель» (`pushService.sendToCreators`), мастер-доступу не приходит
- «В спам» — перенос письма в папку \Junk ящика (у beget `INBOX.Junk`) отдельным коротким соединением с правом записи, затем удаление из CRM
- Вложения — `UPLOADS_DIR/mail`, статикой `/api/uploads` не раздаются (`isMailAttachmentPath`), только через `/api/mail/attachments/:id`. HTML письма показывается в iframe с sandbox и CSP без скриптов
- `MAIL_USER` / `MAIL_PASSWORD` в `.env`; пусто — приём выключен

### Камера офиса
- Раздел «Камера» — менеджер и выше (`canSeeCamera`, на сервере `requireRole(ROLES.MANAGER)`). Подробно и установка — `.deploy/README-camera.md`
- Компьютер в офисе (`.deploy/camera/office-camera.ps1`, задача планировщика при включении) перекодирует RTSP камеры в H.264 и шлёт по SRT с паролем `CAMERA_SRT_PASSPHRASE` в контейнер `mediamtx` (`.deploy/mediamtx.yml`, наружу только 8890/udp)
- Сервер отдаёт HLS из MediaMTX через `/api/camera/live/<токен>/…` (`services/camera.service.ts`): токен просмотра — `utils/cameraToken.ts` (только для камеры, 12 ч), роль и увольнение проверяются по базе. Маршрут подключён до `authMiddleware`. Service worker `/api/camera/` не кеширует
- Офис выключен на ночь — «Камера выключена — офис закрыт», страница сама проверяет раз в 15 секунд

### Бэкапы
- `.deploy/backup.sh` по cron на сервере каждый день в 03:30 UTC и перед каждым `deploy.sh`: дамп базы и снимок `data/uploads` в `/root/backups/prime-crm`
- Хранится 7 ежедневных, 5 еженедельных и 12 ежемесячных копий базы, файлы — 7 снимков на жёстких ссылках
- Внешнее хранилище подключается переменной `BACKUP_RCLONE_REMOTE` в `.env`

### Тревожная кнопка
- Настройки → «Протокол AID» (Менеджер и выше): 3 подтверждения + PIN → `server/src/services/panic.service.ts`. Подробно и восстановление — `.deploy/README-panic.md`
- Сначала `pg_dump` и `data/uploads` шифруются открытым ключом владельца (`utils/panicCrypto.ts`, X25519 + AES-256-GCM) в `data/panic`, затем `TRUNCATE` таблиц из `PANIC_WIPE_TABLES`, отзыв всех сессий (`SecurityState`, `utils/sessionRevocation.ts`) и удаление бэкапов. Не удалось зашифровать — ничего не удаляется
- **Новая таблица с клиентскими или денежными данными добавляется в `PANIC_WIPE_TABLES`.** TRUNCATE идёт без CASCADE: забытая таблица со ссылкой на очищаемую уронит очистку, а не удалит лишнее
- Приватного ключа на сервере нет. Ключ и хеш PIN создаются у владельца: `npm run panic:keygen`, `npm run panic:pin`; расшифровка — `npm run panic:decrypt`

---

## Переменные окружения

- **Продакшен:** `.env` рядом с `docker-compose.yml`, не в git, образец — `/.env.example`. В нём `POSTGRES_PASSWORD`, `JWT_SECRET`, `MASTER_EMAIL`, `MASTER_PASSWORD`, `CLIENT_URL`, `BACKUP_RCLONE_REMOTE`, `PANIC_PUBLIC_KEY`, `PANIC_PIN_HASH`, `VDF_INTEGRATION_KEY` (приём заказов сотрудников из магазина vdf.by: `POST /api/integrations/vdf/orders` с заголовком `x-integration-key`, вкладка «VDF» в бухгалтерии), `PUBLIC_RECORD_URL` (страница записи для клиента), `MAIL_IMAP_HOST`, `MAIL_IMAP_PORT`, `MAIL_USER`, `MAIL_PASSWORD` (почта beget), `CAMERA_SRT_PASSPHRASE` (видео камеры офиса, обязательна). Compose подставляет их в контейнеры; без обязательных переменных сервер не стартует.
- **Разработка:** `server/.env.development`, образец — `server/.env.example`.

---

## Docker

```yaml
# docker-compose.yml (development)
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: prime_crm
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  server:
    build: ./server
    ports: ["3001:3001"]
    depends_on: [postgres]

  client:
    build: ./client
    ports: ["3000:3000"]
```

В production — Nginx проксирует `/api/*` → сервер, всё остальное → статика клиента.

---

## Порядок разработки (этапы)

1. **База** — настройка Prisma + PostgreSQL, схема, сиды с тестовыми данными
2. **API** — все эндпоинты с валидацией
3. **Layout** — sidebar, роутинг, адаптив, темы
4. **Расписание** — главная страница, карточки записей
5. **Создание записи** — модал с 3 шагами, поиск клиента по телефону, выбор услуг
6. **Закрытие сделки** — модал, акт выполненных работ
7. **Печать** — шаблоны документов (заявка + акт)
8. **Клиенты** — список и детальная страница
9. **Дашборд** — аналитика и графики
10. **Услуги** — CRUD
11. **Настройки** — темы, мастера, реквизиты
12. **Тёмная тема** — финальная полировка
