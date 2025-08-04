import React from "react";
import styles from './Schedule.module.scss';

const Schedule = () => {
    return (
        <div className={styles.scheduleContainer}>
            <ul className={styles.list}>
                <li>Руслан</li>
                <li>Паша</li>
                <li>Макс</li>
                <li>Арина</li>
            </ul>
            <ul className={styles.list}>
                <li>BMW f30</li>
                <li>AUDI A6 C6</li>
                <li>Dodge Grand Caravan</li>
                <li>BMW G30</li>
            </ul>
        </div>
    )
}

export default Schedule;