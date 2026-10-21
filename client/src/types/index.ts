/** Текущий пользователь — как его отдают /auth/login и /auth/me */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  isMaster: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
  cars: Car[];
  _count?: { records: number };
  /** Записи, подошедшие под фильтр «услуга / период» в списке клиентов */
  matchedRecords?: Array<{ id: string; scheduledAt: string; status: RecordStatus; car: Car }>;
}

/** Что отдаёт GET /clients/:id — клиент вместе со всей историей визитов */
export interface ClientWithRecords extends Client {
  records: Record[];
}

export interface Car {
  id: string;
  clientId: string;
  brand: string;
  brandId: string;
  model: string;
  modelId: string;
  generation?: string;
  generationId?: string;
  generationName?: string;
  year: string;
  plateNumber?: string;
  mileage?: string;
  photoUrl?: string;
}

export type RecordStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export type SmsType = 'ON_CREATE' | 'REMINDER' | 'CAR_READY' | 'REVIEW_REQUEST';

export interface SmsLog {
  id: string;
  recordId: string;
  type: SmsType;
  phone: string;
  message: string;
  status: string;
  externalId?: string | null;
  error?: string | null;
  sentAt: string;
}

export interface SmsSettings {
  id: string;
  enabled: boolean;
  /** Сервер токен не отдаёт (всегда пусто). Пустой токен при сохранении — «оставить прежний» */
  token: string;
  /** Последние символы сохранённого токена, например «••••a1b2»; пусто — токен не задан */
  tokenMask?: string;
  alphanameId: string;
  alphaname: string;
  onCreateTemplate: string;
  reminderTemplate: string;
  carReadyTemplate: string;
  reviewRequestTemplate: string;
}

export interface SmsAlphaname {
  id: string;
  name: string;
}

export interface SmsConnectionInfo {
  balance: number;
  currency: string;
  alphanames: SmsAlphaname[];
}

export interface ServicemanSplitEntry {
  name: string;
  amount: number;
}

export interface RecordItem {
  id: string;
  serviceId: string;
  price: number;
  quantity: number;
  netProfit?: number;
  servicemanName?: string | null;
  servicemanSplit?: ServicemanSplitEntry[] | null;
  equipmentId?: string | null;
  equipment?: Equipment | null;
  prepaidAmount?: number;
  prepaidByCard?: boolean;
  prepaidCurrency?: ForeignCurrency | null;
  prepaidCurrencyAmount?: number | null;
  prepaidRate?: number | null;
  service: Service & { category: Category };
}

export interface Deal {
  id: string;
  recordId: string;
  finalPrice: number;
  recommendations?: string;
  warranty?: string;
  priceIncreaseReason?: string;
  isPaidByBankTransfer: boolean;
  splitCashAmount?: number | null;
  splitCardAmount?: number | null;
  currencyPayments?: CurrencyPart[] | null;
  closedAt: string;
  salaryDate?: string | null;
  equipment: Array<{ equipment: Equipment }>;
}

export type CashTransactionType = 'INCOME' | 'INCOME_RS' | 'EXPENSE' | 'MANUAL_INCOME';
export type CapitalTransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface CashTransaction {
  id: string;
  type: CashTransactionType;
  date: string;
  amount: number;
  clientName?: string;
  clientPhone?: string;
  carInfo?: string;
  description?: string;
  person?: string;
  recordId?: string;
  isPrepayment?: boolean;
  /** Приход в валюте: amount — сумма в BYN по курсу currencyRate */
  currency?: ForeignCurrency | null;
  currencyAmount?: number | null;
  currencyRate?: number | null;
  createdAt: string;
  // Категория затрат расхода (у системных расходов — пусто)
  expenseCategoryId?: string | null;
  expenseCategory?: { id: string; name: string } | null;
  // Признаки системного расхода: ЗП учредителя, выплата ЗП, отчисление в капитал, погашение долга
  founderSalary?: { id: string } | null;
  salaryPayment?: { id: string } | null;
  capitalTransfer?: { id: string } | null;
  // Погашение долга: категория берётся из долга
  debtPayment?: { id: string; debt?: { expenseCategory?: { id: string; name: string } | null } } | null;
}

export interface CapitalTransaction {
  id: string;
  type: CapitalTransactionType;
  date: string;
  amountByn?: number;
  amountUsd?: number;
  amountEur?: number;
  /** Курс BYN за единицу валюты, если пополнение пришло через конвертацию */
  rate?: number | null;
  description?: string;
  person?: string;
  createdAt: string;
  /** Пополнение из кассы — расход «Отчисление в капитал» */
  cashTransactionId?: string | null;
}

export type ForeignCurrency = 'USD' | 'EUR';
export type Currency = 'BYN' | ForeignCurrency;

/** Часть оплаты в валюте: в BYN = amount × rate */
export interface CurrencyPart {
  currency: ForeignCurrency;
  amount: number;
  rate: number;
}

/** Курсы BYN за единицу валюты с myfin.by */
export interface CurrencyRate {
  /** Лучший курс покупки банками («сдать») */
  buy: number | null;
  /** Лучший курс продажи банками («купить») */
  sell: number | null;
  nbrb: number | null;
}

export interface CurrencyRates {
  rates: { [C in ForeignCurrency]: CurrencyRate };
  source: 'myfin' | 'nbrb';
  fetchedAt: string;
}

/** Откуда пришёл клиент — справочник в настройках (поле записи, необязательное) */
export interface ClientSource {
  id: string;
  name: string;
  sortOrder: number | null;
  /** false — скрыт из списка, но остался в старых записях */
  isActive: boolean;
  /** Сколько записей с этим источником */
  usageCount: number;
}

export interface Record {
  id: string;
  clientId: string;
  carId: string;
  scheduledAt: string;
  /** null — мастер не указан */
  serviceman: string | null;
  receptionist?: string | null;
  notes?: string;
  /** Обнаруженные недостатки — пишет любая роль в карточке записи, печатаются в акте */
  defects?: string | null;
  /** Задан — запись перенесена из старой программы: только история, без сделки, не правится */
  importKey?: string | null;
  clientSourceId?: string | null;
  clientSource?: { id: string; name: string } | null;
  /** Сколько фото/видео прикреплено к записи */
  _count?: { media: number };
  documentNumber?: string;
  /** Код страницы записи для клиента: <publicRecordUrl>/<код> */
  publicToken?: string | null;
  status: RecordStatus;
  isLegalEntity?: boolean;
  legalCompanyName?: string;
  legalAddress?: string;
  legalActualAddress?: string;
  legalPostalAddress?: string;
  legalBankDetails?: string;
  legalBic?: string;
  legalUnp?: string;
  legalOkpo?: string;
  legalPhone?: string;
  legalEmail?: string;
  legalRepresentativePosition?: string;
  legalRepresentativePositionGenitive?: string;
  legalRepresentative?: string;
  legalRepresentativeGenitive?: string;
  legalBasis?: string;
  legalVin?: string;
  legalEndDate?: string;
  executorSignatoryName?: string;
  executorSignatoryNameGenitive?: string;
  executorSignatoryPosition?: string;
  executorSignatoryPositionGenitive?: string;
  executorSignatoryBasis?: string;
  createdAt: string;
  client: Client;
  car: Car;
  items: RecordItem[];
  deal?: Deal;
  smsLogs?: SmsLog[];
}

export interface Category {
  id: string;
  name: string;
  color?: string | null;
  customPercent?: number | null;
  services: Service[];
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  standardPrice: number;
  estimatedTime: number;
  isActive: boolean;
  hasEquipment?: boolean;
  isProduct?: boolean;
  customPercent?: number | null;
  /** Тип ремонта — блок на странице записи для клиента */
  repairTypeId?: string | null;
  /** Не предлагать в «Открытых возможностях» (Настройки → Открытые возможности) */
  excludeFromOpportunities?: boolean;
  /** Сколько раз услугу добавляли в записи — для сортировки по популярности */
  usageCount?: number;
  category?: Category;
}

export interface Equipment {
  id: string;
  name: string;
  warranty?: string;
  wholesalePrice?: number;
  retailPrice?: number;
  isActive?: boolean;
}

export interface Serviceman {
  id: string;
  name: string;
  position?: string;
  role?: string;
  email?: string;
  photoUrl?: string;
  isDismissed: boolean;
  isReceptionist: boolean;
  isDefault: boolean;
  /** Показывается в списке исполнителей работ */
  isPerformer?: boolean | null;
  /** Участвует в дашборде; лишних скрывают в настройках */
  showInDashboard?: boolean;
  /** Учитывать в «Зарплатном фонде» бухгалтерии */
  inSalaryFund?: boolean;
  profitPercent: number;
  /** Оклад текущего расчётного периода */
  baseSalary?: number;
  birthday?: string | null;
}

export interface AuthorizedPerson {
  nameNominative: string;
  nameGenitive: string;
  positionNominative: string;
  positionGenitive: string;
  basis: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  /** Адрес страниц записи для клиента (только чтение, из .env сервера) */
  publicRecordUrl?: string;
  directorName?: string;
  directorNameGenitive?: string;
  directorPosition?: string;
  directorPositionGenitive?: string;
  directorBasis?: string;
  authorizedPersons?: AuthorizedPerson[];
  legalAddress?: string;
  actualAddress?: string;
  postalAddress?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  bic?: string;
  okpo?: string;
  bankDetails?: string;
  documentPrefix?: string;
  nextDocumentNumber?: number;
  /** Памятка клиенту в акте. null — текст по умолчанию, пустая строка — не печатать */
  actMemo?: string | null;
  /** Памятка блоками с условиями по услугам. null — ещё не настраивали, берётся actMemo */
  actMemoBlocks?: ActMemoBlock[] | null;
}

/** Блок памятки: печатается, если в записи есть услуга из targets ('svc:<id>' или вся категория 'cat:<id>') */
export interface ActMemoBlock {
  id: string;
  title: string;
  /** Строки; строка с «- » — пункт списка */
  text: string;
  /** Пусто — печатать всегда */
  targets: string[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  isDefault: boolean;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteProject = 'CRM' | 'PRIME' | 'VDF';
export type NoteRepeat = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Note {
  id: string;
  servicemanId: string;
  text: string;
  date?: string | null;
  allDay: boolean;
  time?: string | null;
  repeat?: NoteRepeat | null;
  project: NoteProject;
  isDone: boolean;
  doneAt?: string | null;
  createdAt: string;
  updatedAt: string;
  serviceman?: { id: string; name: string };
}

// Cars API — справочник авто из своей БД.
// Поля в snake_case: форма унаследована от стороннего каталога, из которого
// данные были выкачаны, чтобы переезд не задел компоненты.
// source: SNAPSHOT — из каталога донора, MANUAL — заведено руками.
// Годы могут отсутствовать у записей, добавленных вручную.
export interface CarBrand {
  id: string;
  name: string;
  logo?: string | null;
  year_from?: number | null;
  year_to?: number | null;
  source?: 'SNAPSHOT' | 'MANUAL';
}

export interface CarModel {
  id: string;
  name: string;
  year_from?: number | null;
  year_to?: number | null;
  source?: 'SNAPSHOT' | 'MANUAL';
}

export interface CarGeneration {
  id: string;
  name: string;
  year_from?: number | null;
  year_to?: number | null;
  photo?: string | null;
  source?: 'SNAPSHOT' | 'MANUAL';
}

// Wiki по автомобилям. Ключ карточки — те же внешние id, что в Car.brandId/modelId/generationId.
export interface WikiKey {
  markId: string;
  modelId: string;
  generationId: string;
}

export type WikiMediaType = 'PHOTO' | 'VIDEO';

export interface WikiMedia {
  id: string;
  type: WikiMediaType;
  filename: string;
  originalName: string;
  size: number;
  uploadedByName?: string | null;
  /** Раздел карточки; null — «Общее» */
  sectionId?: string | null;
  createdAt: string;
  url: string;
  /** Сжатые варианты фото. null — вариантов нет (видео, HEIC, ещё не сжато), показываем оригинал. */
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  /** Крошечное размытое превью (data URL), показывается, пока грузится thumb */
  placeholder?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface WikiEntry extends WikiKey {
  id: string;
  markName: string;
  modelName: string;
  generationName?: string | null;
  content: string;
  updatedByName?: string | null;
  updatedAt: string;
  media: WikiMedia[];
  /** Тексты разделов; «Общее» — content */
  sections: WikiEntrySectionContent[];
  /** Товары vdf.by по разделам */
  products: WikiProduct[];
}

/** Товар магазина vdf.by в разделе карточки; sectionId null — «Общее» */
export interface WikiProduct {
  id: string;
  sectionId: string | null;
  productId: string;
  title: string;
  url: string;
  imageUrl: string | null;
  addedByName: string | null;
  createdAt: string;
}

export interface VdfCatalogProduct {
  id: string;
  slug: string;
  title: string;
  url: string;
  image: string | null;
  price: number;
  inStock: boolean;
  category: string;
  /** Машина переходной рамки — в списке рамок одного типа */
  car?: string;
}

export interface VdfCatalogCategory {
  id: string;
  name: string;
  parentId: string | null;
  count: number;
  /** Раздел переходных рамок: выбор через тип рамки и машину */
  frameTypes: boolean;
}

export interface VdfFrameType {
  type: string;
  count: number;
  /** Несколько марок для подсказки, какие машины у типа */
  marks: string[];
}

export interface VdfCatalogList {
  total: number;
  items: VdfCatalogProduct[];
}

export interface WikiEntrySectionContent {
  sectionId: string;
  content: string;
  updatedByName?: string | null;
  updatedAt: string;
}

/** Раздел карточки вики по виду работ. serviceIds — услуги, после которых раздел нужно заполнить */
export interface WikiSection {
  id: string;
  name: string;
  sortOrder: number;
  serviceIds: string[];
}

export interface WikiEntrySummary extends WikiKey {
  id: string;
  markName: string;
  modelName: string;
  generationName?: string | null;
  updatedAt: string;
  updatedByName?: string | null;
  mediaCount: number;
  hasText: boolean;
}

export interface WikiMediaRef {
  id: string;
  type: WikiMediaType;
  filename: string;
  originalName: string;
  url: string;
  // Варианты есть только у добавленных файлов, которые ещё лежат в вики
  thumbUrl?: string | null;
  mediumUrl?: string | null;
  placeholder?: string | null;
  width?: number | null;
  height?: number | null;
}

export type WikiRevisionStatus = 'PENDING' | 'REVIEWED' | 'REWARDED';

export interface WikiRevision {
  id: string;
  entryId: string;
  authorId: string;
  authorName: string;
  authorRole?: string | null;
  /** Раздел карточки; null — «Общее» */
  sectionId?: string | null;
  sectionName?: string | null;
  prevContent: string;
  newContent: string;
  addedMedia: WikiMediaRef[];
  removedMedia: WikiMediaRef[];
  status: WikiRevisionStatus;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  bonusAmount?: number | null;
  /** Размер премии из настроек на момент назначения — если больше bonusAmount, оплата частичная */
  bonusBaseAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  entry: WikiKey & { markName: string; modelName: string; generationName?: string | null };
}

export interface WikiSettings {
  id: string;
  bonusAmount: number;
}

// ─── Фото и видео записи ───────────────────────────

export interface RecordMedia {
  id: string;
  recordId: string;
  type: 'PHOTO' | 'VIDEO';
  filename: string;
  originalName: string;
  size: number;
  uploadedByName?: string | null;
  createdAt: string;
  /** Когда файл удалится с сервера (через год после загрузки) */
  expiresAt: string;
  url: string;
  /** Сжатое превью (фото) или кадр-обложка (видео); null — нет */
  thumbUrl?: string | null;
  /** Видео ещё сжимается на сервере — пока открывается оригинал */
  processing?: boolean;
}

// ─── Склад ─────────────────────────────────────────

export interface StockCategory {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number | null;
  childrenCount: number;
  itemsCount: number;
  lowStockCount: number;
}

export interface StockItem {
  id: string;
  categoryId: string;
  name: string;
  sku?: string | null;
  unit: string;
  quantity: number;
  /** Порог напоминания; null — не напоминать */
  minQuantity?: number | null;
  purchasePrice?: number | null;
  notes?: string | null;
  /** «Расходники / Плёнки / Глянец» */
  categoryPath: string;
  isLow: boolean;
}

export type StockMovementType = 'IN' | 'OUT' | 'ADJUST';

export interface StockMovement {
  id: string;
  itemId: string;
  type: StockMovementType;
  delta: number;
  quantityAfter: number;
  comment?: string | null;
  userName?: string | null;
  createdAt: string;
}

// ─── Каналы привлечения ────────────────────────────

export interface SourceStatsRow {
  /** id источника или NONE — не указан */
  source: string;
  name: string;
  records: number;
  cancelled: number;
  closed: number;
  /** Доля закрытых среди неотменённых, % */
  conversion: number;
  revenue: number;
  avgCheck: number;
  clients: number;
  newClients: number;
}

export interface SourceStats {
  from: string;
  to: string;
  sources: SourceStatsRow[];
  months: Array<{ month: string; counts: Partial<globalThis.Record<string, number>> }>;
  adExpenses: number;
  newClients: number;
  costPerNewClient: number | null;
}

// ─── Типы ремонта (страница записи для клиента) ─────

export interface RepairTypeFaqItem {
  question: string;
  answer: string;
}

export interface RepairTypeLink {
  title: string;
  url: string;
}

export interface RepairType {
  id: string;
  name: string;
  description: string;
  faq: RepairTypeFaqItem[];
  links: RepairTypeLink[];
  sortOrder: number | null;
  /** Сколько активных услуг с этим типом */
  servicesCount: number;
  photos: { id: string; url: string }[];
}

// ─── Почта ──────────────────────────────────────────

export interface MailListItem {
  id: string;
  fromName: string | null;
  fromAddress: string | null;
  subject: string | null;
  date: string;
  preview: string | null;
  isRead: boolean;
  attachmentsCount: number;
}

export interface MailAttachment {
  id: string;
  originalName: string;
  contentType: string;
  size: number;
  /** Картинка или PDF — можно открыть в браузере, остальное только скачать */
  viewable: boolean;
}

export interface MailMessage {
  id: string;
  fromName: string | null;
  fromAddress: string | null;
  to: string | null;
  subject: string | null;
  date: string;
  text: string | null;
  html: string | null;
  isRead: boolean;
  attachments: MailAttachment[];
}

export interface MailStatus {
  configured: boolean;
  connected: boolean;
  user: string | null;
  lastError: string | null;
  lastSyncAt: string | null;
}
