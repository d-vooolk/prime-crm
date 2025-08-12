import React from "react";
import styles from './SideBar.module.scss';
import logo from '../../assets/crm-logo.png';
import Calendar from "../Calendar";

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
        </div>
    )
}

export default SideBar;