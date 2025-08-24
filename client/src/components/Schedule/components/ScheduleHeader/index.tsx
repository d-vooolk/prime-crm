import React from "react";
import styles from "./ScheduleHeader.module.scss";
import PrimeButton from "../../../Shared/PrimeButton";

const ScheduleHeader = () => {
    return (
        <div className={styles.scheduleHeaderWrapper}>
            <PrimeButton type="default">ДОБАВИТЬ ЗАПИСЬ</PrimeButton>
        </div>
    )
}

export default ScheduleHeader;