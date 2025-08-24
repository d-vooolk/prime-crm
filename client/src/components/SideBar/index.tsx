import React from "react";
import styles from './SideBar.module.scss';
import logo from '../../assets/crm-logo.png';
import Calendar from "../Calendar";
import SideBarItem from "./components/SideBarItem/SideBarItem";

const SideBar = () => {
    return (
        <div className={styles.sideBarWrapper}>
            <div className={styles.sideBarHeader}>
                <div>
                    <img
                        src={logo}
                        alt="logo"
                        className={styles.sideBarLogo}
                    />
                </div>
                <div><span className={styles.greenText}>Prime</span> CRM</div>
            </div>

            <Calendar />

            <SideBarItem>Отчёты</SideBarItem>
            <SideBarItem>Клиенты</SideBarItem>
            <SideBarItem>Услуги</SideBarItem>
            <SideBarItem>Настройки</SideBarItem>
        </div>
    )
}

export default SideBar;