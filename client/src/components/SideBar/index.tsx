import React from "react";
import styles from './SideBar.module.scss';

const SideBar = () => {
    return (
        <div className={styles.sideBarWrapper}>
            <ul className={styles.list}>
                <li>1</li>
                <li>2</li>
                <li>3</li>
                <li>4</li>
            </ul>
        </div>
    )
}

export default SideBar;