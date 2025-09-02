// Интерфейс для записи
export interface Record {
    id: number;
    date: string;
    time: string;
    clientName: string;
    phone: string[];
    car: {
        brand: string,
        model: string,
        generation: string,
        year: string,
        generationName: string,
        otherData: string,
    },
    comment: string;
    works: any[];
    carNumber: string;
    carMileage: string;
    firstPrice: string | number;
    serviceman: string;
    wrongDetails: string;
    whyAddPrice: string;
    resultPrice: string | number;
    dateOfWorkDone: string;
    warranty: string;
    modulesModel: string;
}

// Интерфейс для данных новой записи
export interface NewRecordData {
    date: string;
    time: string;
    clientName: string;
    phone: string[];
    car: {
        brand: string,
        model: string,
        generation: string,
        year: string,
        generationName: string,
        otherData: string,
    },
    comment: string;
    works: any[];
    carNumber: string;
    carMileage: string;
    firstPrice: string | number;
    serviceman: string;
    wrongDetails: string;
    whyAddPrice: string;
    resultPrice: string | number;
    dateOfWorkDone: string;
    warranty: string;
    modulesModel: string;
}

// Интерфейс для store
export interface UseRecordsStoreInterface {
    records: Record[];
    addRecord: (recordData: NewRecordData) => void;
}