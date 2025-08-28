import {create} from "zustand";
import {UseRecordsStoreInterface, NewRecordData} from "./types";

export const useRecordsStore = create<UseRecordsStoreInterface>((set) => ({
    records: [],
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