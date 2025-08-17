import React from "react";
import styles from './Schedule.module.scss';
import ScheduleHeader from "../ScheduleHeader";

const Schedule = () => {
    return (
        <div className={styles.scheduleContainer}>
            <ScheduleHeader />
        </div>
    )
}

export default Schedule;