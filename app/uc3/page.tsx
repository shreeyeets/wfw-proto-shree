'use client';

/**
 * UC3 — Weekly Team Health Digest for Managers
 *
 * Architecture:
 * - All prose responses come from LLM (team_query_system, team_summary_system, fix_offer_system)
 * - Structured data (names, badges, calendar event) stays hardcoded from lib/uc3-data.ts
 * - Buttons are LLM-generated after every bot response (same pattern as UC2)
 * - Cards render on the BOT side only — never attached to user messages
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TypingDots } from '@/components/teams-shell/TypingDots';
import { Message } from '@/components/teams-shell/Message';
import { QRButton } from '@/components/teams-shell/QRButton';
import { TeamsTop } from '@/components/teams-shell/TeamsTop';
import { PURPLE } from '@/components/teams-shell/constants';
import { ChatMessage, QuickReply } from '@/components/teams-shell/types';
import { TEAM_DATA, googleCalendarLink } from '@/lib/uc3-data';
import { callAI } from '@/lib/callAI';
import {
  uc3TeamQuerySystem,
  uc3TeamSummarySystem,
  UC3_BUTTONS_SYSTEM,
  uc3ButtonsUserPrompt,
  uc3FixOfferSystem,
} from '@/lib/prompts';

// ── TYPES ─────────────────────────────────────────────────────────────────────

type UC3Screen = 'notification' | 'chat';

/** Extended message type for UC3 — carries optional card payload. */
interface UC3Message extends ChatMessage {
  cardType?: 'team-summary' | 'fix' | 'reminder';
  fixText?: string; // LLM-generated fix prose
}

// ── SHARED CONTEXT BUILDERS ───────────────────────────────────────────────────

function buildTeamSummaryContext(): string {
  return TEAM_DATA.members
    .map(m => `${m.name}: ${m.status}`)
    .join('\n')
    + '\n\nCalendar patterns:\n'
    + TEAM_DATA.patterns.join('\n');
}

function buildAnonSignals(): string {
  return TEAM_DATA.anonymousSignals.join('\n');
}

// ── UI COMPONENTS ─────────────────────────────────────────────────────────────

function Sidebar({ pulsing }: { pulsing?: boolean }) {
  return (
    <div style={{ width: 200, background: '#f3f2f1', borderRight: '1px solid #e0e0e0', padding: '12px 0', flexShrink: 0 }}>
      {['Apps', 'Bots'].map(sec => (
        <div key={sec}>
          <div style={{ fontSize: 10, color: '#888', padding: '8px 16px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{sec}</div>
          {sec === 'Apps'
            ? ['General', 'Announcements'].map(item => (
                <div key={item} style={{ padding: '7px 16px', fontSize: 13, color: '#555' }}>{item}</div>
              ))
            : (
              <div style={{ padding: '7px 16px', fontSize: 13, color: '#1a1a1a', fontWeight: 600, background: '#e0dede', display: 'flex', alignItems: 'center', gap: 8 }}>
                {pulsing && <div style={{ width: 7, height: 7, background: PURPLE, borderRadius: '50%', animation: 'pulse 2s infinite' }} />}
                Wysa for Teams
              </div>
            )}
        </div>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

function NotificationToast({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ position: 'absolute', bottom: 20, right: 20, width: 300, background: '#fff', border: '1px solid #ddd', borderLeft: `3px solid ${PURPLE}`, borderRadius: 10, padding: 14, cursor: 'pointer', boxShadow: '0 2px 16px rgba(0,0,0,0.1)', animation: 'slideIn 0.4s ease' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, background: PURPLE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600 }}>W</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>Wysa for Teams</span>
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>now</span>
      </div>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>
        {TEAM_DATA.manager} — 4 of your reportees had no clean focus block on Tuesday or Wednesday. One small change could give them back ~6 hours next week.
      </div>
      <div style={{ fontSize: 11, color: PURPLE, marginTop: 8, fontWeight: 500 }}>Click to open →</div>
      <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}

function ChatHeader() {
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{ width: 30, height: 30, background: PURPLE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 600 }}>W</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Wysa for Teams</div>
        <div style={{ fontSize: 11, color: '#aaa' }}>Bot · always active</div>
      </div>
    </div>
  );
}

/** Team summary fact-set card — data only, no LLM prose. Always bot-side. */
function TeamSummaryCard() {
  const getBadgeColor = (status: string) => {
    if (status === 'fragmented' || status === 'overloaded') return '#D32F2F';
    if (status === 'stretched') return '#F59E0B';
    return '#2E7D32';
  };
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '14px', marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Your team's week, {TEAM_DATA.manager}</div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>{TEAM_DATA.week} · From internal calendar data</div>
      <div style={{ height: 1, background: '#eee', marginBottom: 12 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TEAM_DATA.members.map(m => (
          <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#1a1a1a' }}>{m.name}</span>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#fff', background: getBadgeColor(m.status), padding: '2px 8px', borderRadius: 12, letterSpacing: '0.3px' }}>
              {m.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Fix card — LLM prose + hardcoded calendar deep link.
 * prose comes from fix_offer_system; the calendar URL is computed from uc3-data.
 */
function FixCard({ fixText, onReminder, onNotThisWeek }: { fixText: string; onReminder: () => void; onNotThisWeek: () => void }) {
  const calUrl = googleCalendarLink(TEAM_DATA.suggestedFix.calendarEvent);
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '14px', marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
        {TEAM_DATA.suggestedFix.title}
      </div>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 14 }}>{fixText}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => window.open(calUrl, '_blank')}
          style={{ width: '100%', background: PURPLE, color: '#fff', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Move it in Google Calendar →
        </button>
        <button
          onClick={onReminder}
          style={{ width: '100%', background: '#fff', color: PURPLE, border: `1px solid ${PURPLE}`, borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Remind me Monday
        </button>
        <button
          onClick={onNotThisWeek}
          style={{ width: '100%', background: 'transparent', color: '#888', border: 'none', fontSize: 11, textDecoration: 'underline', cursor: 'pointer', padding: '4px' }}
        >
          Not this week
        </button>
      </div>
    </div>
  );
}

function ReminderCard() {
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '14px', marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>Reminder set for Monday 9am</div>
      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.4 }}>
        I'll check in next Friday's digest to see if the pattern repeated.
      </div>
    </div>
  );
}

// ── MESSAGE RENDERER ─────────────────────────────────────────────────────────

/** Wraps each message — attaches the right card on the bot side only. */
function UC3MessageRenderer({
  msg,
  onReminder,
  onNotThisWeek,
}: {
  msg: UC3Message;
  onReminder: () => void;
  onNotThisWeek: () => void;
}) {
  return (
    <Message msg={msg}>
      {msg.cardType === 'team-summary' && <TeamSummaryCard />}
      {msg.cardType === 'fix' && msg.fixText && (
        <FixCard fixText={msg.fixText} onReminder={onReminder} onNotThisWeek={onNotThisWeek} />
      )}
      {msg.cardType === 'reminder' && <ReminderCard />}
    </Message>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function UC3Page() {
  const [screen, setScreen] = useState<UC3Screen>('notification');
  const [messages, setMessages] = useState<UC3Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [waitInput, setWaitInput] = useState(false);

  // Conversation history — kept in a ref so closures always see latest value
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const msgsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // ── Message helpers ────────────────────────────────────────────────────────

  const addMsg = useCallback((
    from: 'user' | 'wysa',
    text: string,
    extra: Partial<UC3Message> = {},
  ): Promise<void> => {
    return new Promise(resolve => {
      const id = Date.now() + Math.random();
      setMessages(prev => [...prev, { id, from, text, visible: false, ...extra }]);
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, visible: true } : m));
        resolve();
      }, 50);
    });
  }, []);

  const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  // ── Button generator (same pattern as UC2) ─────────────────────────────────

  const genButtons = async () => {
    const hist = historyRef.current;
    const lastBot = hist.filter(h => h.role === 'assistant').slice(-1)[0]?.content ?? '';
    const histStr = hist.map(h => `${h.role === 'user' ? 'Manager' : 'Bot'}: ${h.content}`).join('\n');
    try {
      const raw = await callAI(UC3_BUTTONS_SYSTEM, [{
        role: 'user',
        content: uc3ButtonsUserPrompt(histStr, lastBot),
      }]);
      const btns: string[] = JSON.parse(raw.trim().replace(/```json|```/g, ''));
      if (!btns || btns.length === 0) { setWaitInput(true); return; }
      setQuickReplies(btns.map(label => ({ label, action: () => uc3Reply(label) })));
    } catch {
      setWaitInput(true);
    }
  };

  // ── Core reply loop (same pattern as UC2) ─────────────────────────────────

  const uc3Reply = async (userText: string) => {
    setQuickReplies([]);
    setWaitInput(false);
    // 1. User bubble first
    await addMsg('user', userText);
    historyRef.current = [...historyRef.current, { role: 'user', content: userText }];

    // 2. Typing indicator → LLM call
    setTyping(true);
    const teamSummary = buildTeamSummaryContext();
    const anonSignals = buildAnonSignals();
    const system = uc3TeamQuerySystem(TEAM_DATA.manager, TEAM_DATA.week, teamSummary, anonSignals);
    try {
      const reply = await callAI(system, historyRef.current);
      setTyping(false);
      // 3. Bot bubble
      await addMsg('wysa', reply);
      historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];
      // 4. Generate smart buttons
      await genButtons();
    } catch {
      setTyping(false);
      await addMsg('wysa', "Sorry, I can't reach the server right now. Try again in a moment.");
      setWaitInput(true);
    }
  };

  // ── Special actions ────────────────────────────────────────────────────────

  /**
   * Triggered when the manager clicks "What's the fix?" (or types something similar).
   * Shows a bot bubble with LLM-generated text + the hardcoded FixCard.
   */
  const showFix = async () => {
    setQuickReplies([]);
    await addMsg('user', "What's the fix?");
    historyRef.current = [...historyRef.current, { role: 'user', content: "What's the fix?" }];

    setTyping(true);
    const teamSummary = buildTeamSummaryContext();
    try {
      const fixProse = await callAI(uc3FixOfferSystem(teamSummary), historyRef.current);
      setTyping(false);
      // Bot bubble with FixCard attached
      await addMsg('wysa', '', { cardType: 'fix', fixText: fixProse });
      historyRef.current = [...historyRef.current, { role: 'assistant', content: fixProse }];
      // No generic buttons after fix — the card has its own action buttons
    } catch {
      setTyping(false);
      await addMsg('wysa', "I can't pull the suggestion right now — try again in a moment.");
      setWaitInput(true);
    }
  };

  const showReminder = async () => {
    setQuickReplies([]);
    await addMsg('wysa', '', { cardType: 'reminder' });
  };

  const goBack = () => {
    window.location.href = '/';
  };

  // ── Input handler ─────────────────────────────────────────────────────────

  function handleSend() {
    const val = inputVal.trim();
    if (!val) return;
    setInputVal('');
    // "What's the fix?" detected in free text routes to showFix
    if (/fix|suggest a change|what (should|can) (i|we) do|action this/i.test(val)) {
      showFix();
    } else {
      uc3Reply(val);
    }
  }

  const initChat = async () => {
    setScreen('chat');
    setMessages([]);
    historyRef.current = [];
    setWaitInput(false);

    // Bot turn 1: team summary card + LLM-generated opening hook
    setTyping(true);
    const teamSummary = buildTeamSummaryContext();
    const anonSignals = buildAnonSignals();

    // Give the data explicitly in the user turn too — model must not miss it
    const userTurn = `Here is the team data for the week of ${TEAM_DATA.week}:\n\n${teamSummary}\n\nAnonymous signals:\n${anonSignals}\n\nGive me one opening observation.`;

    try {
      const hook = await callAI(
        uc3TeamSummarySystem(teamSummary),
        [{ role: 'user', content: userTurn }],
      );

      // Detect polite refusals — fall through to deterministic fallback
      const isRefusal = /sorry|can't|don't have|no data|no context|provide/i.test(hook.slice(0, 80));
      const hookText = isRefusal
        ? `${TEAM_DATA.members.filter(m => m.status === 'fragmented' || m.status === 'overloaded').map(m => m.name).join(' and ')} had the roughest week — heavily fragmented calendars with almost no clean focus time.`
        : hook;

      setTyping(false);
      await addMsg('wysa', hookText, { cardType: 'team-summary' });
      historyRef.current = [{ role: 'assistant', content: hookText }];
      await genButtons();
    } catch {
      setTyping(false);
      // Deterministic fallback — always a sensible opening
      const fragmented = TEAM_DATA.members.filter(m => m.status === 'fragmented' || m.status === 'overloaded').map(m => m.name);
      const hookText = `${fragmented.join(' and ')} had the roughest week — heavily fragmented calendars with almost no clean focus time.`;
      await addMsg('wysa', hookText, { cardType: 'team-summary' });
      historyRef.current = [{ role: 'assistant', content: hookText }];
      setQuickReplies([
        { label: "What's causing this?", action: () => uc3Reply("What's causing this?") },
        { label: 'Tell me about Pratik', action: () => uc3Reply('Tell me about Pratik') },
        { label: "What's the fix?", action: () => showFix() },
      ]);
    }
  };

  // ── Render: Notification screen ───────────────────────────────────────────

  if (screen === 'notification') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f0f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
        <TeamsTop activeTab="Teams" />
        <div style={{ display: 'flex', flex: 1 }}>
          <Sidebar pulsing />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', position: 'relative' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#aaa' }}>Your workspace</span>
            </div>
            <NotificationToast onClick={initChat} />
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Chat screen ───────────────────────────────────────────────────

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: '100%', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <TeamsTop activeTab="Chat" />

        {/* Back strip */}
        <div
          style={{ fontSize: 12, color: PURPLE, cursor: 'pointer', padding: '8px 16px', borderBottom: '1px solid #eee', background: '#fafafa' }}
          onClick={goBack}
        >
          ← back to prototype picker
        </div>

        <ChatHeader />

        {/* Message list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(m => (
            <UC3MessageRenderer
              key={m.id}
              msg={m}
              onReminder={showReminder}
              onNotThisWeek={() => {
                setScreen('notification');
                setMessages([]);
                historyRef.current = [];
              }}
            />
          ))}
          {typing && <TypingDots />}
          <div ref={msgsEndRef} />
        </div>

        {/* Quick replies */}
        {quickReplies.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
            {quickReplies.map((qr, i) => {
              if (!qr.label) return null;
              // "What's the fix?" routes through showFix, not the generic uc3Reply loop
              if (/fix|suggest|do about it|action/i.test(qr.label)) {
                return <QRButton key={i} label={qr.label} onClick={showFix} />;
              }
              return <QRButton key={i} label={qr.label} onClick={qr.action!} />;
            })}
          </div>
        )}

        {/* Input bar — always visible */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything about your team's week..."
            style={{ flex: 1, padding: '8px 14px', borderRadius: 20, border: '1px solid #ddd', fontSize: 13, background: '#fafafa', color: '#1a1a1a', outline: 'none', fontFamily: 'inherit' }}
          />
          <button
            onClick={handleSend}
            style={{ background: PURPLE, color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ›
          </button>
        </div>
      </div>
      <style>{`@keyframes tdot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}
