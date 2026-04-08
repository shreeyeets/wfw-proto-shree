'use client';
import React, { useState } from 'react';
import { PURPLE } from './constants';

export function QRButton({ label, onClick, style = {} }: { label: string; onClick: () => void; style?: React.CSSProperties }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#f0f0f8' : '#fff',
        border: `1px solid ${PURPLE}`,
        color: PURPLE,
        borderRadius: 20,
        padding: '5px 13px',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'background 0.15s',
        ...style
      }}
    >
      {label}
    </button>
  );
}
