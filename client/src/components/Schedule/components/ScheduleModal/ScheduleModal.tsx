import React from 'react';
import {Card, Form, Input, Modal} from "antd";
import styles from "./ScheduleModal.module.scss";
import Calendar from "../../../Calendar";

const ScheduleModal = ({ isOpen, closeModal }: {isOpen: boolean, closeModal: () => void}) => {
    return (
        <Modal
            open={isOpen}
            onCancel={closeModal}
            onOk={closeModal}
            className={styles.modalWrapper}
            width={1000}
        >
            <div className={styles.modalContent}>
                <div className={styles.modalCalendar}>
                    <Calendar />
                </div>
                <div className={styles.modalCardContentWrapper}>
                    <Card className={styles.modalCardContent}>
                        <Form>
                            <Form.Item
                                label="Имя"
                                name="clientName"
                                labelCol={{ span: 4 }}
                                wrapperCol={{ span: 20 }}
                            >
                                <Input />
                            </Form.Item>
                        </Form>
                    </Card>
                </div>
            </div>
        </Modal>
    )
}

export default ScheduleModal;