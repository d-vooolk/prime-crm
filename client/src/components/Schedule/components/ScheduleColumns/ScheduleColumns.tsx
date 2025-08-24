import React from "react";
import styles from "./ScheduleColumns.module.scss";
import ScheduleCard from "../ScheduleCard/ScheduleCard";
import cn from 'classnames';

const ScheduleColumns = () => {
    return (
        <div className={styles.scheduleColumnsWrapper}>
            <div className={styles.scheduleColumn}>
                <div className={cn(styles.scheduleColumnHeader, styles.inWork)}>В работе</div>
                <ScheduleCard />
                <ScheduleCard />
            </div>

            <div className={styles.scheduleColumn}>
                <div className={cn(styles.scheduleColumnHeader, styles.today)}>Сегодня</div>
                <ScheduleCard />
            </div>
        </div>
    )
}

export default ScheduleColumns;
