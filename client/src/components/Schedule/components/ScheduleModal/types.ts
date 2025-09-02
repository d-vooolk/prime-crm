export interface JobOption {
    id: number;
    label: string;
    value: string;
    price: number;
}

export interface FormDataInterface {
    date: string,
    time: string,
    clientName?: string,
    phone: string,
    car: string,
    carYear?: string | number,
    comment?: string,
    works?: JobOption[],
    firstPrice: number,
    carNumber?: string,
    carMileage?: string | number,
    serviceman: string,
    wrongDetails?: string,
    whyAddPrice?: string,
    dateOfWorkDone: string,
    warranty?: string,
    modulesModel?: string,
}