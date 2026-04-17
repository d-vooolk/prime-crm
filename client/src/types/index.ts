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
  photoUrl?: string;
}

export type RecordStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED';

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
  priceIncreaseReason?: string;
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
  createdAt: string;
  client: Client;
  car: Car;
  items: RecordItem[];
  deal?: Deal;
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
  isActive?: boolean;
}

export interface Serviceman {
  id: string;
  name: string;
  position?: string;
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
  legalAddress?: string;
  actualAddress?: string;
  postalAddress?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  bic?: string;
  okpo?: string;
  bankDetails?: string;
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
