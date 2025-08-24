import React from "react";
import styles from "./ScheduleCard.module.scss";
import {Card, Image} from "antd";

const ScheduleCard = () => {
    return (
        <Card
            variant="borderless"
            className={styles.cardWrapper}
        >
            <Image
                className={styles.cardImage}
                preview={false}
                src="https://avatars.mds.yandex.net/get-verba/1535139/2a0000018f72dd19977950ae68175db58495/auto_main"
            />
            <div>hello</div>
        </Card>
    )
}

export default ScheduleCard;