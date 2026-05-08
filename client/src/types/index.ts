export interface Client {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
  cars: Car[];
  _count?: { records: number };
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
  username: string;
  password: string;
  onCreateTemplate: string;
  reminderTemplate: string;
  carReadyTemplate: string;
  reviewRequestTemplate: string;
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
  service: Service & { category: Category };
}

export interface Deal {
  id: string;
  recordId: string;
  finalPrice: number;
  defects?: string;
  warranty?: string;
  priceIncreaseReason?: string;
  isPaidByBankTransfer: boolean;
  splitCashAmount?: number | null;
  splitCardAmount?: number | null;
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
  createdAt: string;
}

export interface CapitalTransaction {
  id: string;
  type: CapitalTransactionType;
  date: string;
  amountByn?: number;
  amountUsd?: number;
  description?: string;
  person?: string;
  createdAt: string;
}

export interface Record {
  id: string;
  clientId: string;
  carId: string;
  scheduledAt: string;
  serviceman: string;
  receptionist?: string;
  notes?: string;
  documentNumber?: string;
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
  password?: string;
  plainPassword?: string | null;
  photoUrl?: string;
  isDismissed: boolean;
  isReceptionist: boolean;
  isDefault: boolean;
  profitPercent: number;
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

export type NotePriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type NoteRepeat = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Note {
  id: string;
  servicemanId: string;
  text: string;
  date?: string | null;
  allDay: boolean;
  time?: string | null;
  repeat?: NoteRepeat | null;
  priority: NotePriority;
  isDone: boolean;
  doneAt?: string | null;
  createdAt: string;
  updatedAt: string;
  serviceman?: { id: string; name: string };
}

// Cars API
export interface CarBrand {
  id: string;
  name: string;
  logo?: string | null;
}

export interface CarModel {
  id: string;
  name: string;
  brandId: string;
}

export interface CarGeneration {
  id: string;
  name: string;
  modelId: string;
  year_from: number;
  year_to: number;
  photo?: string | null;
}
