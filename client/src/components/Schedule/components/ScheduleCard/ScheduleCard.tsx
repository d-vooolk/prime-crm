import React from "react";
import styles from "./ScheduleCard.module.scss";
import {Card, Divider, Image, Tag, Typography} from "antd";
import {
    CheckCircleOutlined,
    SyncOutlined,
} from "@ant-design/icons";
import {FormDataInterface} from "../ScheduleModal/types";
import {FaCalendarAlt, FaCar, FaClock, FaList, FaPhoneAlt} from "react-icons/fa";
import {IoPeopleSharp} from "react-icons/io5";

const ScheduleCard = ({ status, cardData, ...rest }: { status?: string; cardData: FormDataInterface, onClick?: (e?: any) => void }) => {
    return (
        <Card
            variant="borderless"
            className={styles.cardWrapper}
            {...rest}
        >
            <div className={styles.cardContent}>
                <Image
                    className={styles.cardImage}
                    preview={false}
                    src="https://avatars.mds.yandex.net/get-verba/1535139/2a0000018f72dd19977950ae68175db58495/auto_main"
                />
                <div className={styles.cardTextContent}>
                    <Typography className={styles.cardText}>
                        <FaCar />
                        <div>
                            { cardData.car.brand } { cardData.car.model } { cardData.car.generationName } {cardData.car.year}
                        </div>
                    </Typography>

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
                        <div className={styles.cardText}>
                            <FaCalendarAlt/>
                            <div>{cardData.date}</div>
                        </div>
                        <div className={styles.cardText}>
                            <FaClock/>
                            <div>{cardData.time}</div>
                        </div>
                    </Typography>

                    <Typography className={styles.cardText}>
                        <IoPeopleSharp />
                        <div>{cardData.clientName}</div>
                    </Typography>

                    <Typography className={styles.cardText}>
                        <FaPhoneAlt />
                        <div>{cardData.phone[0]}</div>
                    </Typography>

                    <Typography className={styles.cardTextWorks}>
                        <FaList />
                        <div>
                            { cardData.works?.map((work) => <div>{ work.label }</div>) }
                        </div>
                    </Typography>
                </div>
            </div>
        </Card>
    )
}

export default ScheduleCard;