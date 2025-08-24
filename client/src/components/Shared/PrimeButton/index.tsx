import React from 'react';
import {Button} from "antd";
import styles from './PrimeButton.module.scss';
import {PrimeButtonProps} from "./types";

const PrimeButton = ({children, type, onClick}: PrimeButtonProps) => {
    return (
        <Button
            className={
                type === 'primary'
                    ? styles.primary
                    : styles.default
            }
            onClick={onClick}
        >
            { children }
        </Button>
    )
}

export default PrimeButton;