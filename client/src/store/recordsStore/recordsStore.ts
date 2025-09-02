import {create} from "zustand";
import {UseRecordsStoreInterface, NewRecordData, Record} from "./types";

const testRecords: Record[] = [
    {
        id: 0,
        date: "09.09.2025",
        time: "10:00",
        clientName: "Волк Дмитрий Иванович",
        phone: ["+375 (29) 820-62-46"],
        car: {
            brand: "BMW",
            model: "E39",
            generation: "5123123",
            year: "1999",
            generationName: "5",
            otherData: "",
        },
        comment: "nothing",
        works: [
            {
                id: 1,
                label: "Установка билед модулей",
                value: "Установка билед модулей",
                price: 1200,
            },
            {
                id: 2,
                label: "Полировка фар",
                value: "Полировка фар",
                price: 100,
            }
        ],
        firstPrice: 1200,
        carNumber: "9250 MB-1",
        carMileage: "303056",
        serviceman: "Волк Дмитрий Иванович",
        wrongDetails: "Негерметичность крышек",
        whyAddPrice: "Оклейка фар плёнкой",
        dateOfWorkDone: "10.09.2025",
        warranty: "1 год",
        modulesModel: "Sanvi F50",
        resultPrice: 1350
    },
    {
        id: 1,
        date: "09.09.2025",
        time: "10:00",
        clientName: "Волк Дмитрий Иванович",
        phone: ["+375 (29) 820-62-48"],
        car: {
            brand: "BMW",
            model: "E39",
            generation: "5123123",
            year: "1999",
            generationName: "5",
            otherData: "",
        },
        comment: "nothing",
        works: [
            {
                id: 1,
                label: "Установка билед модулей",
                value: "Установка билед модулей",
                price: 1200,
            },
            {
                id: 2,
                label: "Полировка фар",
                value: "Полировка фар",
                price: 100,
            }
        ],
        firstPrice: 1200,
        carNumber: "9250 MB-1",
        carMileage: "303056",
        serviceman: "Волк Дмитрий Иванович",
        wrongDetails: "Негерметичность крышек",
        whyAddPrice: "Оклейка фар плёнкой",
        dateOfWorkDone: "10.09.2025",
        warranty: "1 год",
        modulesModel: "Sanvi F50",
        resultPrice: 1350
    },
];

export const useRecordsStore = create<UseRecordsStoreInterface>((set) => ({
    records: testRecords,
    addRecord: (recordData: NewRecordData) => set((state) => ({
        records: [
            ...state.records,
            {
                id: Date.now(),
                ...recordData
            }
        ]
    })),
}));