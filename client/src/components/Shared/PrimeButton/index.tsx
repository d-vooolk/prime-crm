import React from 'react';
import {Button} from "antd";
import styles from './PrimeButton.module.scss';
import {PrimeButtonProps} from "./types";

const PrimeButton = ({ children, type }: PrimeButtonProps) => {
    return (
        <Button
            className={
                type === 'primary'
                    ? styles.primary
                    : styles.default
            }
        >
            { children }
        </Button>
    )
}

export default PrimeButton;