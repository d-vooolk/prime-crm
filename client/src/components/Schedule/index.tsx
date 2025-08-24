import React from "react";
import styles from './Schedule.module.scss';
import ScheduleHeader from "./components/ScheduleHeader";
import ScheduleColumns from "./components/ScheduleColumns/ScheduleColumns";

const Schedule = () => {
    return (
        <div className={styles.scheduleContainer}>
            <ScheduleHeader />
            <ScheduleColumns />
        </div>
    )
}

export default Schedule;