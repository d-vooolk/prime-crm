import React from "react";
import styles from "./ScheduleCard.module.scss";
import {Card, Divider, Image, Tag, Typography} from "antd";
import {
    CalendarOutlined, CarOutlined,
    CheckCircleOutlined, EditOutlined,
    FieldTimeOutlined,
    PhoneOutlined,
    SyncOutlined,
    UserOutlined
} from "@ant-design/icons";

const ScheduleCard = ({ status }: { status?: string }) => {
    return (
        <Card
            variant="borderless"
            className={styles.cardWrapper}
        >
            <div className={styles.cardContent}>
                <Image
                    className={styles.cardImage}
                    preview={false}
                    src="https://avatars.mds.yandex.net/get-verba/1535139/2a0000018f72dd19977950ae68175db58495/auto_main"
                />
                <div className={styles.cardTextContent}>
                    <Typography className={styles.cardText}><CarOutlined /> BMW 5-er G30 2019-2023</Typography>
                    <Divider className={styles.divider} />
                    {
                        status === "success" && (
                            <Tag icon={<CheckCircleOutlined />} color="success">
                                Завершено
                            </Tag>
                        )
                    }
                    {
                        status === "inProgress" && (
                            <Tag icon={<SyncOutlined spin />} color="processing">
                                В процессе
                            </Tag>
                        )
                    }
                    <Typography className={styles.cardText}>
                        <CalendarOutlined /> 19.09.2025
                        <FieldTimeOutlined /> 18:00
                    </Typography>
                    <Typography className={styles.cardText}><UserOutlined /> Константин</Typography>
                    <Typography className={styles.cardText}><PhoneOutlined />+375 (29) 820-62-46</Typography>
                    <Typography className={styles.cardText}><EditOutlined /> Установка Bi-Led модулей, полировка фар, оклейка фар, новые стёкла</Typography>
                </div>
            </div>
        </Card>
    )
}

export default ScheduleCard;