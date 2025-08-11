import {SyntheticEvent} from "react";

export interface SVGImageInterface {
    src: string;
    className?: string;
    alt?: string;
    onClick?: (e: SyntheticEvent) => void;
}