import React, {useEffect, useState} from 'react';
import {Button, Card, DatePicker, Divider, Form, Input, Modal, Steps, TimePicker, ConfigProvider} from "antd";
import styles from "./ScheduleModal.module.scss";
import dayjs from "dayjs";
import TextArea from "antd/es/input/TextArea";
import {useForm} from "antd/lib/form/Form";

const timeFormat = "HH:mm";
const defaultTime = '09:00';

const ScheduleModal = ({isOpen, closeModal}: { isOpen: boolean, closeModal: () => void }) => {
    const [step, setStep] = useState({
        currentStep: 0,
        minCount: 0,
        maxCount: 2,
        percent: 100 / 3,
    });

    const [recordForm] = useForm();
    const [jobsForm] = useForm();
    const [fullClientDataForm] = useForm();
    const [finishClientDataForm] = useForm();

    // useEffect(() => {
    //     console.log('recordForm', recordForm.getFieldsValue());
    //     console.log('jobsForm', jobsForm.getFieldsValue());
    //     console.log('fullClientDataForm', fullClientDataForm.getFieldsValue());
    //     console.log('finishClientDataForm', finishClientDataForm.getFieldsValue());
    // }, [
    //     recordForm.getFieldsValue(),
    //     jobsForm.getFieldsValue(),
    //     fullClientDataForm.getFieldsValue(),
    //     finishClientDataForm.getFieldsValue()
    // ]);

    const [formData, setFormData] = useState();

    const stepHandler = (direction: string) => {
        // console.log('click form', recordForm.getFieldsValue());
        setStep(
            (prevState) => direction === "next"
                ? ({...step, currentStep: prevState.currentStep + 1, percent: prevState.percent + 100 / 3})
                : ({...step, currentStep: prevState.currentStep - 1, percent: prevState.percent - 100 / 3}))
    }

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
            <ConfigProvider
                theme={{
                    components: {
                        DatePicker: {
                            colorText: '#0f2231',
                            colorTextDescription: '#0f2231',
                            colorTextQuaternary: 'rgba(15, 34, 49, 0.5)',
                            colorSplit: 'rgba(15, 34, 49, 0.5)'
                        }
                    }
                }}
            >
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

                <Divider/>

                <div className={styles.modalContent}>
                {
                    step.currentStep === 0 && (
                        <Card className={styles.modalCardContent}>
                            <Form className={styles.formWrapper} form={recordForm}>
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
                                        <TimePicker
                                            defaultValue={dayjs(defaultTime, timeFormat)}
                                            format={timeFormat}
                                            minuteStep={10}
                                            disabledHours={() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23]}
                                            hideDisabledOptions
                                        />
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
                                    label="Год выпуска"
                                    name="carYear"
                                    layout="vertical"
                                >
                                    <Input placeholder="2020"/>
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
                    )
                }

                {
                    step.currentStep === 0 && (
                        <Card className={styles.modalCardContent}>
                            <Form className={styles.formWrapper} form={jobsForm}>
                                <Form.Item
                                    label="Перечень работ"
                                    name="works"
                                    layout="vertical"
                                >
                                    <Input placeholder="Установка Bi-Led модулей"/>
                                </Form.Item>
                            </Form>
                        </Card>
                    )
                }

                {
                    step.currentStep === 1 && (
                        <Card className={styles.modalCardContent}>
                            <Form className={styles.formWrapper} form={fullClientDataForm}>
                                <Form.Item
                                    label="Рег знак"
                                    name="carNumber"
                                    layout="vertical"
                                >
                                    <Input placeholder="1111 MB-1"/>
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
                            </Form>
                        </Card>
                    )
                }

                {
                    step.currentStep === 2 && (
                        <Card className={styles.modalCardContent}>
                            <Form className={styles.formWrapper} form={finishClientDataForm}>
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
                    )
                }
            </div>

            <div className={styles.printButtons}>
                {
                    step.currentStep === 1 && (
                        <Button>Печать заявки</Button>
                    )
                }

                {
                    step.currentStep === 2 && (
                        <Button>Печать акта</Button>
                    )
                }

                <div>
                    <Button
                        onClick={() => stepHandler('prev')}
                        disabled={step.currentStep <= step.minCount}
                    >
                        Назад
                    </Button>
                    <Button
                        onClick={() => stepHandler('next')}
                        disabled={step.currentStep >= step.maxCount}
                    >
                        Далее
                    </Button>
                </div>
            </div>
            </ConfigProvider>
        </Modal>
    )
}

export default ScheduleModal;