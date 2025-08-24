import React from 'react';
import {Card, Form, Input, Modal, TimePicker} from "antd";
import styles from "./ScheduleModal.module.scss";
import Calendar from "../../../Calendar";
import dayjs from "dayjs";

const timeFormat = "HH:mm";

const ScheduleModal = ({isOpen, closeModal}: { isOpen: boolean, closeModal: () => void }) => {
    return (
        <Modal
            open={isOpen}
            onCancel={closeModal}
            onOk={closeModal}
            className={styles.modalWrapper}
            width={1200}
        >
            <div className={styles.modalContent}>
                <div className={styles.modalCalendar}>
                    <Calendar/>
                </div>
                <Card className={styles.modalCardContent}>
                    <Form className={styles.formWrapper}>
                        <Form.Item
                            label="Время записи"
                            name="time"
                            layout="vertical"
                        >
                            <TimePicker defaultValue={dayjs('09:00', timeFormat)} format={timeFormat} />
                        </Form.Item>
                        <Form.Item
                            label="ФИО"
                            name="clientName"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Телефон"
                            name="phone"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Автомобиль"
                            name="car"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Перечень работ"
                            name="works"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>
                    </Form>
                </Card>

                <Card className={styles.modalCardContent}>
                    <Form className={styles.formWrapper}>
                        <Form.Item
                            label="Рег знак"
                            name="carNumber"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Год выпуска"
                            name="carYear"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Пробег"
                            name="carMilleage"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Предв. стоимость"
                            name="firstPrice"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Мастер-приёмщик"
                            name="serviceMan"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Обнаруженные недостатки"
                            name="wrongDetails"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Обоснование доб. стоимости"
                            name="whyAddPrice"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Итоговая стоимость"
                            name="fullPrice"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Дата окончания работ"
                            name="dateOfWorkDone"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Гарантия"
                            name="warranty"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>

                        <Form.Item
                            label="Модель модулей"
                            name="modulesModel"
                            layout="vertical"
                        >
                            <Input/>
                        </Form.Item>
                    </Form>
                </Card>
            </div>
        </Modal>
    )
}

export default ScheduleModal;