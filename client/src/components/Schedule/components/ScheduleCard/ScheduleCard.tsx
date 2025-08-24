import React from "react";
import styles from "./ScheduleCard.module.scss";
import {Card, Divider, Image, Typography} from "antd";

const ScheduleCard = () => {
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
                    <Typography className={styles.cardText}>BMW 5-er G30 2019-2023</Typography>
                    <Divider className={styles.divider} />
                    <Typography className={styles.cardText}>18:00</Typography>
                    <Typography className={styles.cardText}>Константин</Typography>
                    <Typography className={styles.cardText}>+375 (29) 820-62-46</Typography>
                    <Typography className={styles.cardText}>Установка Bi-Led модулей, полировка фар, оклейка фар, новые стёкла</Typography>
                </div>
            </div>
        </Card>
    )
}

export default ScheduleCard;