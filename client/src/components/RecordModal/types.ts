export interface SelectedService {
  serviceId: string;
  serviceName: string;
  categoryName: string;
  price: number;
  quantity: number;
  estimatedTime: number;
}

export interface RecordFormData {
  // Клиент
  clientId?: string;
  clientName: string;
  clientPhone: string;
  clientNotes?: string;
  // Авто
  carBrandId: string;
  carBrand: string;
  carModelId: string;
  carModel: string;
  carGenerationId?: string;
  carGenerationName?: string;
  carYear: string;
  carPlate?: string;
  // Запись
  date: string;
  time: string;
  serviceman: string;
  // Услуги
  services: SelectedService[];
}

export const emptyFormData: RecordFormData = {
  clientName: '',
  clientPhone: '',
  clientNotes: '',
  carBrandId: '',
  carBrand: '',
  carModelId: '',
  carModel: '',
  carGenerationId: '',
  carGenerationName: '',
  carYear: '',
  carPlate: '',
  date: '',
  time: '',
  serviceman: '',
  services: [],
};
