import React from 'react';
import {SVGImageInterface} from "./types";

const SvgImage = ({ src, className, alt, onClick }: SVGImageInterface) => {
    return (
        <img
            src={src}
            className={className}
            alt={alt}
            onClick={onClick}
        />
    )
}

export default SvgImage;