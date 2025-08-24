import React from 'react';
import styles from './SideBarItem.module.scss';
import {RightOutlined} from "@ant-design/icons";

const SideBarItem = ({ children }: {children: React.ReactElement | string}) => {
    return (
        <div className={styles.sidebarItemWrapper}>
            { children } <RightOutlined style={{ fontSize: "12px" }} />
        </div>
    )
}

export default SideBarItem;