import React from 'react';
import { PURPLE } from './constants';

export function Avatar({ type, initial }: { type: 'wysa' | 'user'; initial: string }) {
  const bg = type === 'wysa' ? PURPLE : '#237B4B';
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
      {initial}
    </div>
  );
}
