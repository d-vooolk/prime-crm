import React, {useState} from "react";
import styles from './Schedule.module.scss';
import ScheduleHeader from "./components/ScheduleHeader";
import ScheduleColumns from "./components/ScheduleColumns/ScheduleColumns";
import ScheduleModal from "./components/ScheduleModal/ScheduleModal";
import {FormDataInterface} from "./components/ScheduleModal/types";

const Schedule = () => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [defaultFormData, setDefaultFormData] = useState<FormDataInterface | undefined>(undefined);

    const closeModal = () => setIsOpen(false);
    const openModal = () => setIsOpen(true);

    return (
        <div className={styles.scheduleContainer}>
            <ScheduleHeader
                openModal={openModal}
            />
            <ScheduleColumns
                setDefaultFormData={setDefaultFormData}
                setIsModalOpen={setIsOpen}
            />

            <ScheduleModal
                isOpen={isOpen}
                closeModal={closeModal}
                defaultFormData={defaultFormData}
            />
        </div>
    )
}

export default Schedule;