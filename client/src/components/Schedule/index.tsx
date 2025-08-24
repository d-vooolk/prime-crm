import React, {useState} from "react";
import styles from './Schedule.module.scss';
import ScheduleHeader from "./components/ScheduleHeader";
import ScheduleColumns from "./components/ScheduleColumns/ScheduleColumns";
import ScheduleModal from "./components/ScheduleModal/ScheduleModal";

const Schedule = () => {
    const [isOpen, setIsOpen] = useState(false);

    const closeModal = () => setIsOpen(false);
    const openModal = () => setIsOpen(true);

    return (
        <div className={styles.scheduleContainer}>
            <ScheduleHeader
                openModal={openModal}
            />
            <ScheduleColumns />

            <ScheduleModal
                isOpen={isOpen}
                closeModal={closeModal}
            />
        </div>
    )
}

export default Schedule;