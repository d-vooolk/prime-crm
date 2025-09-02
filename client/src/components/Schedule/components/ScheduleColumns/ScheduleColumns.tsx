import React from "react";
import styles from "./ScheduleColumns.module.scss";
import ScheduleCard from "../ScheduleCard/ScheduleCard";
import cn from 'classnames';
import {useRecordsStore} from "../../../../store/recordsStore/recordsStore";
import {Record} from "../../../../store/recordsStore/types";

import {FormDataInterface} from "../ScheduleModal/types";

interface ScheduleColumnsProps {
    setDefaultFormData: (data: FormDataInterface) => void;
    setIsModalOpen: (isOpen: boolean) => void;
}

const ScheduleColumns: React.FC<ScheduleColumnsProps> = ({setDefaultFormData, setIsModalOpen}) => {
    const records = useRecordsStore((state: any) => state.records);

    const convertRecordToFormData = (record: Record): FormDataInterface => {
        return {
            date: record.date,
            time: record.time,
            clientName: record.clientName || "",
            phone: record.phone,
            car: record.car,
            comment: record.comment || "",
            works: record.works,
            firstPrice: typeof record.firstPrice === 'string' ? parseInt(record.firstPrice) || 0 : record.firstPrice,
            resultPrice: typeof record.resultPrice === 'string' ? parseInt(record.resultPrice) || 0 : record.resultPrice,
            carNumber: record.carNumber || "",
            carMileage: record.carMileage || "",
            serviceman: record.serviceman,
            wrongDetails: record.wrongDetails || "",
            whyAddPrice: record.whyAddPrice || "",
            dateOfWorkDone: record.dateOfWorkDone,
            warranty: record.warranty || "",
            modulesModel: record.modulesModel || "",
        };
    };

    const handleCardClick = (record: Record) => {
        const convertedData = convertRecordToFormData(record);
        setDefaultFormData(convertedData);
        setIsModalOpen(true);
    }

    return (
        <div className={styles.scheduleColumnsWrapper}>
            <div className={styles.scheduleColumn}>
                <div className={cn(styles.scheduleColumnHeader, styles.inWork)}>В работе</div>
            </div>

            <div className={styles.scheduleColumn}>
                <div className={cn(styles.scheduleColumnHeader, styles.today)}>Сегодня</div>

                {
                    records?.map((record: any) => (
                        <ScheduleCard
                            key={`${Math.random() * record.id}`}
                            cardData={record}
                            onClick={() => handleCardClick(record)}
                        />
                    ))
                }
            </div>
        </div>
    )
}

export default ScheduleColumns;
