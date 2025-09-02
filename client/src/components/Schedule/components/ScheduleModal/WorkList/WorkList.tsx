import React from "react";
import styles from "../ScheduleModal.module.scss";
import {Card, Form, InputNumber, List, Select, Typography} from "antd";
import cn from "classnames";
import {JobOption} from "../types";

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

const WorkList = ({ works, firstPrice, setFormData }) => {
    const handleJobsChange = (selectedValues: string[]) => {
        const selectedJobs = jobsList.filter(job => selectedValues.includes(job.value));
        const totalPrice = selectedJobs.reduce((sum, job) => sum + job.price, 0);

        setFormData(prev => ({
            ...prev,
            works: selectedJobs,
            firstPrice: totalPrice
        }));
    };

    const handlePriceChange = (jobId: number, newPrice: number | null) => {
        if (newPrice === null) return;
        const updatedWorks = works?.map(job =>
            job.id === jobId ? {...job, price: newPrice} : job
        );
        const totalPrice = updatedWorks?.reduce((sum, job) => sum + job.price, 0) || 0;

        setFormData(prev => ({
            ...prev,
            works: updatedWorks,
            firstPrice: totalPrice
        }));
    };

    return (
        <div className={styles.flexColumn}>
            <Card className={styles.modalCardContent}>
                <Form className={styles.formWrapper}>
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
                    dataSource={works}
                    renderItem={
                        (item) =>
                            <List.Item className={styles.listItemRender}>
                                <span>{item?.label}</span>
                                <InputNumber
                                    controls={false}
                                    value={item?.price}
                                    onChange={(value) => handlePriceChange(item.id, value)}
                                />
                            </List.Item>
                    }
                />

                <div className={cn(styles.flexRow, styles.listPriceText)}>
                    <Typography className={styles.darkText}>ИТОГО:</Typography>
                    <Typography className={styles.darkText}>{firstPrice} руб.</Typography>
                </div>
            </Card>
        </div>
    )
}

export default WorkList;