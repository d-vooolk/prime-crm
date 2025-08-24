import React from "react";
import styles from "./ScheduleColumns.module.scss";

const ScheduleColumns = () => {
    return (
        <div className={styles.scheduleCardsWrapper}>
            <div className={styles.scheduleColumn}>В работе</div>
            <div className={styles.scheduleColumn}>Сегодня</div>
        </div>
    )
}

export default ScheduleColumns;
