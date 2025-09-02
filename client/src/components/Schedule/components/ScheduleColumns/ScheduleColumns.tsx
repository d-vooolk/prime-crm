import React from "react";
import styles from "./ScheduleColumns.module.scss";
import ScheduleCard from "../ScheduleCard/ScheduleCard";
import cn from 'classnames';
import {useRecordsStore} from "../../../../store/recordsStore/recordsStore";

const ScheduleColumns = () => {
    const records = useRecordsStore((state: any) => state.records);

    return (
        <div className={styles.scheduleColumnsWrapper}>
            <div className={styles.scheduleColumn}>
                <div className={cn(styles.scheduleColumnHeader, styles.inWork)}>В работе</div>
                {/*<ScheduleCard status="success" />*/}
                {/*<ScheduleCard status="inProgress" />*/}
            </div>

            <div className={styles.scheduleColumn}>
                <div className={cn(styles.scheduleColumnHeader, styles.today)}>Сегодня</div>

                {
                    records?.map((record: any) => (
                        <ScheduleCard key={record.id} cardData={record} />
                    ))
                }
            </div>
        </div>
    )
}

export default ScheduleColumns;
