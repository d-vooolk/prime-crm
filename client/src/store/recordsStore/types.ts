// Интерфейс для записи
export interface Record {
    id: number;
    date: string;
    time: string;
    name: string;
    phone: string;
    carMark: string;
    carModel: string;
    carGeneration: string;
    carYear: string;
    comment: string;
    jobs: string;
    carNumber: string;
    carMileage: string;
    firstPrice: string;
    serviceMan: string;
    discoveredFlaws: string;
    priceJustification: string;
    resultPrice: string;
    finishDate: string;
    warranty: string;
    moduleModel: string;
}

// Интерфейс для данных новой записи
export interface NewRecordData {
    date: string;
    time: string;
    name: string;
    phone: string;
    carMark: string;
    carModel: string;
    carGeneration: string;
    carYear: string;
    comment: string;
    jobs: string;
    carNumber: string;
    carMileage: string;
    firstPrice: string;
    serviceMan: string;
    discoveredFlaws: string;
    priceJustification: string;
    resultPrice: string;
    finishDate: string;
    warranty: string;
    moduleModel: string;
}

// Интерфейс для store
export interface UseRecordsStoreInterface {
    records: Record[];
    addRecord: (recordData: NewRecordData) => void;
}