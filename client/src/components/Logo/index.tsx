import React from 'react';

interface Props {
  className?: string;
  style?: React.CSSProperties;
}

export const Logo: React.FC<Props> = ({ className, style }) => (
  <svg
    viewBox="0 0 172 44"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    role="img"
    aria-label="Prime CRM"
  >
    {/* P lettermark — thin stroke, geometric */}
    <path
      d="M 1.5 40 L 1.5 4 L 20 4 C 30 4 30 25.5 20 25.5 L 1.5 25.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Thin vertical separator */}
    <line
      x1="39" y1="10"
      x2="39" y2="34"
      stroke="currentColor"
      strokeWidth="0.75"
      strokeLinecap="round"
      opacity="0.2"
    />

    {/* PRIME wordmark */}
    <text
      x="48"
      y="27"
      fill="currentColor"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
      fontSize="19"
      fontWeight="700"
      letterSpacing="4"
    >
      PRIME
    </text>

    {/* CRM subtitle */}
    <text
      x="50"
      y="40"
      fill="currentColor"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
      fontSize="9.5"
      fontWeight="300"
      letterSpacing="6"
      opacity="0.4"
    >
      CRM
    </text>
  </svg>
);
