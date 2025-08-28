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
            theme={{
                ...themeConfig,
                components: {
                    ...(themeConfig as any)?.components,
                    Steps: {
                        colorPrimary: '#0f2231',
                        colorText: '#0f2231',
                        colorTextDescription: '#0f2231',
                        colorSplit: 'rgba(15, 34, 49, 0.2)',
                        colorTextQuaternary: 'rgba(15, 34, 49, 0.5)',
                        lineHeight: '28px',
                    }
                }
            }}
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
