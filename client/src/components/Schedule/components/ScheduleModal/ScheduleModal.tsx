import React, {useState} from 'react';
import {
    Button,
    Card,
    DatePicker,
    Divider,
    Form,
    Input,
    Modal,
    Steps,
    TimePicker,
    ConfigProvider,
    Typography, Select, List
} from "antd";
import styles from "./ScheduleModal.module.scss";
import dayjs from "dayjs";
import TextArea from "antd/es/input/TextArea";
import {useForm} from "antd/lib/form/Form";
import {useRecordsStore} from "../../../../store/recordsStore/recordsStore";
import cn from "classnames";


const timeFormat = "HH:mm";
const defaultTime = '09:00';

interface JobOption {
    id: number;
    label: string;
    value: string;
    price: number;
}

const jobsList: JobOption[] = [
    {
        id: 1,
        label: "Установка билед модулей",
        value: "Установка билед модулей",
        price: 1200,
    },
    {
        id: 2,
        label: "Полировка фар",
        value: "Полировка фар",
        price: 100,
    },
    {
        id: 3,
        label: "Оклейка фар",
        value: "Оклейка фар",
        price: 150,
    },
    {
        id: 4,
        label: "Снятие бампера",
        value: "Снятие бампера",
        price: 100,
    },
];

const ScheduleModal = ({isOpen, closeModal}: { isOpen: boolean, closeModal: () => void }) => {
    const [step, setStep] = useState({
        currentStep: 0,
        minCount: 0,
        maxCount: 2,
        percent: 100 / 3,
    });

    const records = useRecordsStore((state: any) => state.records);
    const addRecord = useRecordsStore((state: any) => state.addRecord);

    const [recordForm] = useForm();
    const [jobsForm] = useForm();
    const [fullClientDataForm] = useForm();
    const [finishClientDataForm] = useForm();

    const [formData, setFormData] = useState({
        date: "",
        time: "",
        clientName: "",
        phone: "",
        car: "",
        carYear: "",
        comment: "",
        works: [] as JobOption[],
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

    const stepHandler = (direction: string) => {
        setStep(
            (prevState) => direction === "next"
                ? ({...step, currentStep: prevState.currentStep + 1, percent: prevState.percent + 100 / 3})
                : ({...step, currentStep: prevState.currentStep - 1, percent: prevState.percent - 100 / 3}))
    }

    const createRecord = (continueWork?: boolean) => {
        // create record functionality

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

    const handleChange = (value: string[]) => {
        console.log(`selected ${value}`);
    };

    const handleJobsChange = (selectedValues: string[]) => {
        const selectedJobs = jobsList.filter(job => selectedValues.includes(job.value));
        const totalPrice = selectedJobs.reduce((sum, job) => sum + job.price, 0);
        
        setFormData(prev => ({
            ...prev,
            works: selectedJobs,
            firstPrice: totalPrice
        }));
    };

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

                {step.currentStep === 0 && (
                    <div className={styles.modalContent}>
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
                                            minuteStep={5}
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

                        <div className={styles.flexColumn}>
                            <Card className={styles.modalCardContent}>
                                <Form className={styles.formWrapper} form={jobsForm}>
                                    <Form.Item
                                        label="Перечень работ"
                                        name="works"
                                        layout="vertical"
                                    >
                                        <Select
                                            mode="multiple"
                                            allowClear
                                            style={{width: '100%'}}
                                            placeholder="Выбрать услугу"
                                            onChange={handleJobsChange}
                                            options={jobsList}
                                        />
                                    </Form.Item>
                                </Form>
                            </Card>

                            <Card className={styles.modalCardContent}>
                                <List
                                    size="large"
                                    dataSource={formData.works}
                                    renderItem={
                                        (item) =>
                                            <List.Item className={styles.listItemRender}>
                                                <span>{item?.label}</span>
                                                <span>{item?.price} руб.</span>
                                            </List.Item>
                                    }
                                />

                                <div className={cn(styles.flexRow, styles.listPriceText)}>
                                    <Typography className={styles.darkText}>ИТОГО:</Typography>
                                    <Typography className={styles.darkText}>{ formData?.firstPrice } руб.</Typography>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {step.currentStep === 1 && (
                    <div className={styles.flexRow}>
                        <div className={styles.flexColumn}>
                            <Card className={styles.modalCardContent}>
                                <div className={styles.flexTextContainer}>
                                    <div className={styles.flexRow}>
                                        <div>
                                            <Typography className={styles.underText}>Дата</Typography>
                                            <Typography className={styles.dataText}>09.09.2025</Typography>
                                        </div>

                                        <div>
                                            <Typography className={styles.underText}>Время</Typography>
                                            <Typography className={styles.dataText}>09:10</Typography>
                                        </div>
                                    </div>

                                    <div>
                                        <Typography className={styles.underText}>ФИО</Typography>
                                        <Typography className={styles.dataText}>Волк Дмитрий Иванович</Typography>
                                    </div>

                                    <div>
                                        <Typography className={styles.underText}>Телефон</Typography>
                                        <Typography className={styles.dataText}>+375 (29) 820-62-46</Typography>
                                    </div>

                                    <div className={styles.flexRow}>
                                        <div>
                                            <Typography className={styles.underText}>Автомобиль</Typography>
                                            <Typography className={styles.dataText}>BMW 5 E39 1999</Typography>
                                        </div>

                                        <div>
                                            <Typography className={styles.underText}>Год выпуска</Typography>
                                            <Typography className={styles.dataText}>1999</Typography>
                                        </div>
                                    </div>

                                    <div>
                                        <Typography className={styles.underText}>Комментарий</Typography>
                                        <Typography className={styles.dataText}>По безналу</Typography>
                                    </div>
                                </div>
                            </Card>

                            <Card className={styles.modalCardContent}>
                                <div>
                                    <Typography className={styles.underText}>Перечень работ</Typography>
                                    <Typography className={styles.dataText}>
                                        С/у бампера 100р <br/>
                                        установка билед 1200р <br/>
                                        полировка фар 100р <br/>
                                        оклейка фар полиуретановой плёнкой 150р <br/>
                                    </Typography>
                                    <Typography className={styles.underText}>Итого</Typography>
                                    <Typography className={styles.dataText}>1550р</Typography>
                                </div>
                            </Card>
                        </div>

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