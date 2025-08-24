import React from "react";

export interface PrimeButtonProps {
    children: React.ReactElement | string,
    type: "primary" | "default",
    onClick?: () => void
}