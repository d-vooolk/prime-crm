import React from "react";
import styles from "../../ScheduleModal.module.scss";
import {Card, List, Typography} from "antd";
import {FormDataInterface} from "../../types";

const emptyData = "-";

const ModalInfoCard = ({formData}: { formData: FormDataInterface }) => {
    return (
        <div className={styles.flexColumn}>
            <Card className={styles.modalCardContent}>
                <div className={styles.flexTextContainer}>
                    <div className={styles.flexRow}>
                        <div>
                            <Typography className={styles.underText}>Дата</Typography>
                            <Typography className={styles.dataText}>{formData.date || emptyData}</Typography>
                        </div>

                        <div>
                            <Typography className={styles.underText}>Время</Typography>
                            <Typography className={styles.dataText}>{formData.time || emptyData}</Typography>
                        </div>
                    </div>

                    <div>
                        <Typography className={styles.underText}>ФИО</Typography>
                        <Typography className={styles.dataText}>{formData.clientName || emptyData}</Typography>
                    </div>

                    <div>
                        <Typography className={styles.underText}>Телефон</Typography>
                        {
                            formData.phone.map(
                                phone => <Typography className={styles.dataText}>{phone}</Typography>
                            ) || emptyData
                        }
                    </div>

                    <div className={styles.flexRow}>
                        <div>
                            <Typography className={styles.underText}>Автомобиль</Typography>
                            <Typography className={styles.dataText}>
                                {
                                    formData.car.brand
                                        ? `${formData.car.brand} ${formData.car.model} ${formData.car.generationName}`
                                        : formData.car.otherData
                                }
                            </Typography>
                        </div>

                        <div>
                            <Typography className={styles.underText}>Год выпуска</Typography>
                            <Typography className={styles.dataText}>{formData.car.year || emptyData}</Typography>
                        </div>
                    </div>

                    <div>
                        <Typography className={styles.underText}>Комментарий</Typography>
                        <Typography className={styles.dataText}>{formData.comment || emptyData}</Typography>
                    </div>
                </div>
            </Card>

            <Card className={styles.modalCardContent}>
                <div>
                    <Typography className={styles.underText}>Перечень работ</Typography>
                    <List>
                        {formData.works?.map(
                            (work) =>
                                <List.Item>
                                    <span>{work.label}</span>
                                    <span>{work.price} р.</span>
                                </List.Item>
                        )}
                        <List.Item>
                            <span className={styles.boldText}>Итого</span>
                            <span className={styles.boldText}>{formData.firstPrice} р.</span>
                        </List.Item>
                    </List>
                </div>
            </Card>
        </div>
    )
}

export default ModalInfoCard;