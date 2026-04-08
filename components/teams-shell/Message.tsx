import React from 'react';
import { Avatar } from './Avatar';
import { ChatMessage } from './types';
import { PURPLE } from './constants';

interface MessageProps {
  msg: ChatMessage;
  children?: React.ReactNode;
}

export function Message({ msg, children }: MessageProps) {
  const isUser = msg.from === 'user';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row', opacity: msg.visible ? 1 : 0, transform: msg.visible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease,transform 0.3s ease' }}>
      <Avatar type={isUser ? 'user' : 'wysa'} initial={isUser ? 'S' : 'W'} />
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
        {!isUser && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Wysa for Teams</div>}
        <div style={{ padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, color: isUser ? '#fff' : '#1a1a1a', background: isUser ? PURPLE : '#f4f4f4', border: isUser ? 'none' : '1px solid #ebebeb', whiteSpace: 'pre-wrap' }}>
          {msg.text}
          {children}
          {msg.widget && (
            <div>
              <br />
              <a href={msg.widget.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 4, background: PURPLE, color: '#fff', padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                Open: {msg.widget.name} →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
