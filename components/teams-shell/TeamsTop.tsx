import React from 'react';
import { TEAMS_PURPLE } from './constants';

export function TeamsTop({ activeTab }: { activeTab: string }) {
  return (
    <div style={{ background: TEAMS_PURPLE, padding: '0 16px', height: 44, display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
      <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Microsoft Teams</div>
      <div style={{ display: 'flex', gap: 20 }}>
        {['Activity', 'Chat', 'Teams', 'Calendar'].map(t => (
          <span key={t} style={{ color: t === activeTab ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 12, borderBottom: t === activeTab ? '2px solid #fff' : 'none', paddingBottom: 2 }}>{t}</span>
        ))}
      </div>
    </div>
  );
}
