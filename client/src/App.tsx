import React from 'react';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import Index from "./components/SideBar";
import Schedule from "./components/Schedule";
import styles from './App.module.scss';

const App = () => {
    return (
        <ConfigProvider 
            locale={ruRU}
            theme={{
                token: {
                    colorBgContainer: '#06131d', // borders & background color calendar
                    colorText: '#f2f2f2', // color active month text
                }
            }}
        >
            <div className={styles.app}>
                <Index/>
                <Schedule/>
            </div>
        </ConfigProvider>
    );
};

export default App;
