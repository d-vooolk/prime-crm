import React from 'react';
import Index from "./components/SideBar";
import Schedule from "./components/Schedule";
import styles from './App.module.scss';

const App = () => {
    return (
        <div className={styles?.app}>
            <Index/>
            <Schedule/>
        </div>
    );
};

export default App;
