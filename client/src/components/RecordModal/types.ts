export interface SelectedService {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  price: number;
  quantity: number;
  estimatedTime: number;
  hasEquipment?: boolean;
  equipmentId?: string;
}

export interface RecordFormData {
  // Клиент
  clientId?: string;
  clientName: string;
  clientPhone: string;
  clientNotes?: string;
  // Авто
  carId?: string;
  carBrandId: string;
  carBrand: string;
  carModelId: string;
  carModel: string;
  carGenerationId?: string;
  carGenerationName?: string;
  carYear: string;
  carPlateNumber?: string;
  carMileage?: string;
  // Запись
  date: string;
  time: string;
  serviceman: string;
  receptionist?: string;
  // Юр. лицо
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
  // Услуги
  services: SelectedService[];
}

export const emptyFormData: RecordFormData = {
  clientName: '',
  clientPhone: '+375 ',
  clientNotes: '',
  carBrandId: '',
  carBrand: '',
  carModelId: '',
  carModel: '',
  carGenerationId: '',
  carGenerationName: '',
  carYear: '',
  date: '',
  time: '',
  serviceman: '',
  receptionist: '',
  isLegalEntity: false,
  services: [],
};
