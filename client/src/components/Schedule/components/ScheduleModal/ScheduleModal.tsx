import React, {useState} from 'react';
import {
    Button,
    Card,
    DatePicker,
    Divider,
    Form,
    Input,
    Modal,
    TimePicker,
    ConfigProvider,
} from "antd";
import styles from "./ScheduleModal.module.scss";
import dayjs from "dayjs";
import TextArea from "antd/es/input/TextArea";
import {useRecordsStore} from "../../../../store/recordsStore/recordsStore";
import ModalInfoCard from "./components/ModalInfoCard/ModalInfoCard";
import {FormDataInterface} from "./types";
import PhoneField from "./components/PhoneField/PhoneField";
import ModalSteps from "./components/ModalSteps/ModalSteps";
import WorkList from "./components/WorkList/WorkList";


const timeFormat = "HH:mm";
const defaultTime = '09:00';

const ScheduleModal = ({isOpen, closeModal}: { isOpen: boolean, closeModal: () => void }) => {
    const [step, setStep] = useState({
        currentStep: 0,
        minCount: 0,
        maxCount: 2,
        percent: 100 / 3,
    });

    const records = useRecordsStore((state: any) => state.records);
    const addRecord = useRecordsStore((state: any) => state.addRecord);

    const [formData, setFormData] = useState<FormDataInterface>({
        date: "",
        time: "",
        clientName: "",
        phone: [""],
        car: "",
        carYear: "",
        comment: "",
        works: [],
        firstPrice: 0,
        carNumber: "",
        carMileage: "",
        serviceman: "",
        wrongDetails: "",
        whyAddPrice: "",
        dateOfWorkDone: "",
        warranty: "",
        modulesModel: "",
    });

    const stepHandler = (direction: string) => {
        setStep(
            (prevState) => direction === "next"
                ? ({...step, currentStep: prevState.currentStep + 1, percent: prevState.percent + 100 / 3})
                : ({...step, currentStep: prevState.currentStep - 1, percent: prevState.percent - 100 / 3}))
    }

    const createRecord = (continueWork?: boolean) => {
        console.log("formData", formData);

        if (continueWork) {
            setStep(
                (prevState) =>
                    ({
                        ...step,
                        currentStep: prevState.currentStep + 1,
                        percent: prevState.percent + 100 / 3
                    })
            )
        } else {
            closeModal();
        }
    }

    const clientRegistration = () => {
        // save form data
        closeModal();
    }

    const setFormDataHandler = (key: any, value: any) => {
        setFormData((prevState) => ({...prevState, [key]: value}))
    }


    return (
        <Modal
            open={isOpen}
            onCancel={closeModal}
            className={styles.modalWrapper}
            width={1200}
            okButtonProps={{hidden: true}}
            cancelButtonProps={{hidden: true}}
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

                <ModalSteps step={step}/>

                <Divider/>

                {step.currentStep === 0 && (
                    <div className={styles.modalContent}>
                        <Card className={styles.modalCardContent}>
                            <Form className={styles.formWrapper}>
                                <div className={styles.dateTimeWrapper}>
                                    <Form.Item
                                        label="Дата записи"
                                        name="date"
                                        layout="vertical"
                                    >
                                        <DatePicker
                                            onChange={(e) => setFormDataHandler("date", e.toDate().toLocaleDateString())}
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        label="Время записи"
                                        name="time"
                                        layout="vertical"
                                    >
                                        <TimePicker
                                            defaultValue={dayjs(defaultTime, timeFormat)}
                                            format={timeFormat}
                                            minuteStep={5}
                                            disabledHours={() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 21, 22, 23]}
                                            hideDisabledOptions
                                            onChange={(e) => setFormDataHandler("time", e.toDate().toLocaleTimeString())}
                                        />
                                    </Form.Item>
                                </div>

                                <Form.Item
                                    label="ФИО"
                                    name="clientName"
                                    layout="vertical"
                                >
                                    <Input
                                        placeholder="Волк Дмитрий Иванович"
                                        onChange={(e) => setFormDataHandler("clientName", e.target.value)}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Телефон"
                                    name="phone"
                                    layout="vertical"
                                >
                                    <PhoneField
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Автомобиль"
                                    name="car"
                                    layout="vertical"
                                >
                                    <Input
                                        placeholder="BMW 5-er E60"
                                        onChange={(e) => setFormDataHandler("car", e.target.value)}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Год выпуска"
                                    name="carYear"
                                    layout="vertical"
                                >
                                    <Input
                                        placeholder="2020"
                                        onChange={(e) => setFormDataHandler("carYear", e.target.value)}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Комментарий"
                                    name="comment"
                                    layout="vertical"
                                >
                                    <TextArea
                                        rows={4}
                                        placeholder="Особенности заказа"
                                        onChange={(e) => setFormDataHandler("comment", e.target.value)}
                                    />
                                </Form.Item>
                            </Form>
                        </Card>

                        <WorkList
                            works={formData.works}
                            firstPrice={formData.firstPrice}
                            setFormData={setFormData}
                        />
                    </div>
                )}

                {step.currentStep === 1 && (
                    <div className={styles.flexRow}>
                        <ModalInfoCard formData={formData}/>

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
                                    label="Пробег"
                                    name="carMilleage"
                                    layout="vertical"
                                >
                                    <Input placeholder="300 000"/>
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
                    </div>
                )}

                {step.currentStep === 2 && (
                    <Card className={styles.modalCardContent}>
                        <Form className={styles.formWrapper}>
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
                )}

                <div className={styles.printButtons}>
                    {
                        step.currentStep === 2 && (
                            <Button>Печать акта</Button>
                        )
                    }


                    {
                        step.currentStep === 0 && (
                            <div className={styles.navButtonWrapper}>
                                <Button onClick={() => createRecord(true)}>
                                    Создать запись и продолжить
                                </Button>
                                <Button onClick={() => createRecord(false)}>
                                    Создать запись
                                </Button>
                            </div>
                        )
                    }

                    {
                        step.currentStep === 1 && (
                            <div className={styles.navButtonWrapper}>
                                <Button onClick={() => stepHandler("prev")}>
                                    Редактировать запись
                                </Button>
                                <Button>Печать заявки</Button>
                                <Button onClick={() => clientRegistration()}>Завершить оформление клиента</Button>
                            </div>
                        )
                    }

                    {
                        step.currentStep === 2 && (
                            <div className={styles.navButtonWrapper}>
                                <Button onClick={() => createRecord(true)}>
                                    Редактировать запись
                                </Button>
                                <Button>Печать акта</Button>
                            </div>
                        )
                    }
                </div>
            </ConfigProvider>
        </Modal>
    )
}

export default ScheduleModal;