import React from 'react';
import {Button, Card, DatePicker, Form, Input, Modal, TimePicker} from "antd";
import styles from "./ScheduleModal.module.scss";
import dayjs from "dayjs";
import TextArea from "antd/es/input/TextArea";

const timeFormat = "HH:mm";
const defaultTime = '09:00';

const ScheduleModal = ({isOpen, closeModal}: { isOpen: boolean, closeModal: () => void }) => {

    return (
        <Modal
            open={isOpen}
            onCancel={closeModal}
            onOk={closeModal}
            className={styles.modalWrapper}
            width={1200}
            okText="Сохранить"
            cancelText="Отменить"
        >
            <div className={styles.modalContent}>
                <Card className={styles.modalCardContent}>
                    <Form className={styles.formWrapper}>
                        <div className={styles.dateTimeWrapper}>
                            <Form.Item
                                label="Дата записи"
                                name="date"
                                layout="vertical"
                            >
                                <DatePicker/>
                            </Form.Item>

                            <Form.Item
                                label="Время записи"
                                name="time"
                                layout="vertical"
                            >
                                <TimePicker defaultValue={dayjs(defaultTime, timeFormat)} format={timeFormat}/>
                            </Form.Item>
                        </div>

                        <Form.Item
                            label="ФИО"
                            name="clientName"
                            layout="vertical"
                        >
                            <Input placeholder="Волк Дмитрий Иванович"/>
                        </Form.Item>

                        <Form.Item
                            label="Телефон"
                            name="phone"
                            layout="vertical"
                        >
                            <Input placeholder="+375 (29) 999-99-99"/>
                        </Form.Item>

                        <Form.Item
                            label="Автомобиль"
                            name="car"
                            layout="vertical"
                        >
                            <Input placeholder="BMW 5-er E60"/>
                        </Form.Item>

                        <Form.Item
                            label="Комментарий"
                            name="comment"
                            layout="vertical"
                        >
                            <TextArea rows={4} placeholder="Особенности заказа"/>
                        </Form.Item>
                    </Form>
                </Card>

                <Card className={styles.modalCardContent}>
                    <Form className={styles.formWrapper}>
                        <Form.Item
                            label="Перечень работ"
                            name="works"
                            layout="vertical"
                        >
                            <Input placeholder="Установка Bi-Led модулей"/>
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
                            <Input placeholder="1111 MB-1"/>
                        </Form.Item>

                        <Form.Item
                            label="Год выпуска"
                            name="carYear"
                            layout="vertical"
                        >
                            <Input placeholder="2020"/>
                        </Form.Item>

                        <Form.Item
                            label="Пробег"
                            name="carMilleage"
                            layout="vertical"
                        >
                            <Input placeholder="300 000"/>
                        </Form.Item>

                        <Form.Item
                            label="Предв. стоимость"
                            name="firstPrice"
                            layout="vertical"
                        >
                            <Input placeholder="100"/>
                        </Form.Item>

                        <Form.Item
                            label="Мастер-приёмщик"
                            name="serviceMan"
                            layout="vertical"
                        >
                            <Input placeholder="Волк Дмитрий Иванович"/>
                        </Form.Item>

                        <Form.Item
                            label="Обнаруженные недостатки"
                            name="wrongDetails"
                            layout="vertical"
                        >
                            <TextArea rows={4} placeholder="Негерметичность пыльников"/>
                        </Form.Item>

                        <Form.Item
                            label="Обоснование доб. стоимости"
                            name="whyAddPrice"
                            layout="vertical"
                        >
                            <TextArea rows={4} placeholder="Герметизация корпуса"/>
                        </Form.Item>

                        <Form.Item
                            label="Итоговая стоимость"
                            name="fullPrice"
                            layout="vertical"
                        >
                            <Input placeholder="100"/>
                        </Form.Item>

                        <Form.Item
                            label="Дата окончания работ"
                            name="dateOfWorkDone"
                            layout="vertical"
                        >
                            <Input placeholder="30.04.1998"/>
                        </Form.Item>

                        <Form.Item
                            label="Гарантия"
                            name="warranty"
                            layout="vertical"
                        >
                            <Input placeholder="1 год"/>
                        </Form.Item>

                        <Form.Item
                            label="Модель модулей"
                            name="modulesModel"
                            layout="vertical"
                        >
                            <Input placeholder="Sanvi F50"/>
                        </Form.Item>
                    </Form>
                </Card>
            </div>

            <div className={styles.printButtons}>
                <Button>Печать заявки</Button>
                <Button>Печать акта</Button>
            </div>
        </Modal>
    )
}

export default ScheduleModal;