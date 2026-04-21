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

export interface RecordItem {
  id: string;
  serviceId: string;
  price: number;
  quantity: number;
  service: Service & { category: Category };
}

export interface Deal {
  id: string;
  recordId: string;
  finalPrice: number;
  defects?: string;
  warranty?: string;
  closedAt: string;
  equipment: Array<{ equipment: Equipment }>;
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
  services: Service[];
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  standardPrice: number;
  estimatedTime: number;
  isActive: boolean;
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
  photoUrl?: string;
  isDismissed: boolean;
  isReceptionist: boolean;
  isDefault: boolean;
}

export interface CompanySettings {
  id: string;
  name: string;
  directorName?: string;
  directorNameGenitive?: string;
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
