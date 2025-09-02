export interface JobOption {
    id: number;
    label: string;
    value: string;
    price: number;
}

export interface Car {
    brand: string;
    model: string;
    generation: string;
    year: number | string;
    generationName: string;
    otherData?: string;
}

export interface FormDataInterface {
    date: string,
    time: string,
    clientName?: string,
    phone: string[],
    car: Car,
    comment?: string,
    works?: JobOption[],
    firstPrice: number | string,
    resultPrice: number | string,
    carNumber?: string,
    carMileage?: string | number,
    serviceman: string,
    wrongDetails?: string,
    whyAddPrice?: string,
    dateOfWorkDone: string,
    warranty?: string,
    modulesModel?: string,
}