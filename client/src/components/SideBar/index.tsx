import React from "react";
import styles from './SideBar.module.scss';
import logoWhite from '../../assets/logo-white.svg';
import SvgImage from "../SvgImage";

const SideBar = () => {
    return (
        <div className={styles.sideBarWrapper}>
            <div className={styles.sideBarHeader}>
                <div>
                    <SvgImage
                        src={logoWhite}
                        alt="logo"
                        className={styles.sideBarLogo}
                    />
                </div>
                <div><span className={styles.greenText}>Prime</span> Auto</div>
            </div>
        </div>
    )
}

export default SideBar;