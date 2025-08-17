import React from 'react';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import SideBar from "./components/SideBar";
import Schedule from "./components/Schedule";
import styles from './App.module.scss';
import {themeConfig} from "./config/themeConfig";

const App = () => {
    return (
        <ConfigProvider 
            locale={ruRU}
            theme={themeConfig}
        >
            <div className={styles.app}>
                <SideBar/>
                <div className={styles.mainContent}>
                    <Schedule/>
                </div>
            </div>
        </ConfigProvider>
    );
};

export default App;
