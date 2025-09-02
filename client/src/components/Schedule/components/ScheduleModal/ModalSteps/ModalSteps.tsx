import React from 'react';
import styles from "../ScheduleModal.module.scss";
import {Steps} from "antd";

const ModalSteps = ({ step }: { step: number }) => {
    return (
        <Steps
            className={styles.steps}
            current={step.currentStep}
            percent={step.percent}
            items={[
                {
                    title: 'Запись',
                },
                {
                    title: 'Оформление',
                },
                {
                    title: 'Закрытие',
                },
            ]}
        />
    )
}

export default ModalSteps;