import React from 'react';
import { Avatar } from './Avatar';

export function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <Avatar type="wysa" initial="W" />
      <div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Wysa for Teams</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '10px 13px', background: '#f4f4f4', borderRadius: 12, border: '1px solid #ebebeb' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#aaa', animation: `tdot 1.2s ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
