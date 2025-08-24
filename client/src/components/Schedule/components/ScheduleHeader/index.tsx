import React from "react";
import styles from "./ScheduleHeader.module.scss";
import PrimeButton from "../../../Shared/PrimeButton";

const ScheduleHeader = ({ openModal }: { openModal: () => void }) => {
    return (
        <div className={styles.scheduleHeaderWrapper}>
            <PrimeButton type="default" onClick={() => openModal()}>ДОБАВИТЬ ЗАПИСЬ</PrimeButton>
        </div>
    )
}

export default ScheduleHeader;