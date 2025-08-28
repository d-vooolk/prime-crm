import {create} from "zustand/react";

interface UseRecordsStoreInterface {
    records: [],
    addRecord: () => void,
}

export interface AddRecordInterface {
    records: [];
    date: any;
    time: any;
    name: any;
    phone: any;
    carMark: any;
    carModel: any;
    carGeneration: any;
    carYear: any;
    comment: any;
    jobs: any;
    carNumber: any;
    carMileage: any;
    firstPrice: any;
    serviceman: any;
    discoveredFlaws: any;
    priceJustification: any;
    resultPrice: any;
    finishDate: any;
    warranty: any;
    moduleModel: any;
}

export const useRecordsStore = create<UseRecordsStoreInterface>((set) => (
    {
        records: [],
        addRecord: () => set((state: AddRecordInterface) => ({
            records: [
                ...state.records,
                {
                    id: Date.now(),
                    date: state.date,
                    time: state.time,
                    name: state.name,
                    phone: state.phone,
                    carMark: state.carMark,
                    carModel: state.carModel,
                    carGeneration: state.carGeneration,
                    carYear: state.carYear,
                    comment: state.comment,
                    jobs: state.jobs,
                    carNumber: state.carNumber,
                    carMileage: state.carMileage,
                    firstPrice: state.firstPrice,
                    serviceMan: state.serviceman,
                    discoveredFlaws: state.discoveredFlaws,
                    priceJustification: state.priceJustification,
                    resultPrice: state.resultPrice,
                    finishDate: state.finishDate,
                    warranty: state.warranty,
                    moduleModel: state.moduleModel,
                }
            ]
        })),
    }
));