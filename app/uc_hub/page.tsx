'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TypingDots } from '@/components/teams-shell/TypingDots';
import { Message } from '@/components/teams-shell/Message';
import { QRButton } from '@/components/teams-shell/QRButton';
import { TeamsTop } from '@/components/teams-shell/TeamsTop';
import { PURPLE } from '@/components/teams-shell/constants';
import { ChatMessage, QuickReply } from '@/components/teams-shell/types';
import { callAI } from '@/lib/callAI';
import { ucHubSystem, UC_HUB_BUTTONS_SYSTEM, ucHubButtonsUserPrompt } from '@/lib/prompts';

const BASE = 'https://dev-widget.wysa.io/wrapper/accenturementalwellbeing/?tool=';

const HUB_RESOURCES: Record<string, { title: string; description: string; link: string; color: string }> = {
  wysa: { title: 'Personal Well-being Coach', description: 'Talk about how you are feeling and get support at your own pace.', link: `${BASE}wysa`, color: '#EDE8FD' },
  rethink_care_coaching: { title: '1:1 Professional Coaching Support', description: 'One-on-one coaching for work challenges, leadership, and growth.', link: `${BASE}rethink_care_coaching`, color: '#E8F4FD' },
  rethink_care_parenting: { title: '1:1 Parenting Coaching', description: "Get practical help with your child's behaviour and routines.", link: `${BASE}rethink_care_parenting`, color: '#E8F4FD' },
  rethink_care_neuro: { title: '1:1 Neurodiversity Coaching', description: 'Support for focus, routines, and navigating work your way.', link: `${BASE}rethink_care_neuro`, color: '#EDE8FD' },
  calm_mindfulness: { title: 'Mindfulness & Meditation', description: 'Quick resets to slow things down during the day.', link: `${BASE}calm_mindfulness`, color: '#FDE8F4' },
  sober_sidekick: { title: 'Sobriety Peer Support', description: 'Support if drinking or habits are starting to feel off.', link: `${BASE}sober_sidekick`, color: '#F4E8FD' },
  uptime: { title: '5 Minute Knowledge Hacks', description: 'Quick ideas and insights to get unstuck or think differently.', link: `${BASE}uptime`, color: '#E8FDFD' },
  eap: { title: 'Connect with your local EAP', description: 'Confidential help from trained professionals.', link: `${BASE}eap`, color: '#F0F0F0' },
  mental_health_ally: { title: 'Find a Mental Health Ally', description: 'Connect with someone who understands work challenges.', link: `${BASE}mental_health_ally`, color: '#FDE8E8' },
  nudge: { title: 'Financial Well-being', description: 'Get clarity on money, spending, and planning ahead.', link: `${BASE}nudge`, color: '#E8FDF0' },
};

const HUB_RESOURCE_KEYS = Object.keys(HUB_RESOURCES);

type HubPhase = 'exploration' | 'depth' | 'resource' | 'post_resource' | 'crisis' | 'closed';

interface HubMessage extends ChatMessage {
  resourceKeys?: string[];
  isGrid?: boolean;
  exerciseText?: string;
}

interface HubLLMResponse {
  msg: string;
  care_type: 'NA' | 'specific_resource' | 'crisis' | 'venting' | 'exploratory' | 'therapeutic';
  specific_resource_redirected: string | null;
  specific_resource_handoff: boolean;
}

const HUB_RESOURCE_ICON: Record<string, string> = {
  wysa: '/assets/wysa.png',
  rethink_care_coaching: '/assets/rethink_care.png',
  rethink_care_parenting: '/assets/rethink_care.png',
  rethink_care_neuro: '/assets/rethink_care.png',
  calm_mindfulness: '/assets/calm.png',
  sober_sidekick: '/assets/sobrierty.png',
  uptime: '/assets/uptime.png',
  eap: '/assets/eap.png',
  mental_health_ally: '/assets/mhs.png',
  nudge: '/assets/nudge.png',
};

function HubResourceCard({ resourceKey }: { resourceKey: string }) {
  const resource = HUB_RESOURCES[resourceKey];
  if (!resource) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e4e4', borderRadius: 8, padding: '12px 14px', marginTop: 6 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: resource.color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
        <img src={HUB_RESOURCE_ICON[resourceKey]} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{resource.title}</div>
      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, marginBottom: 10 }}>{resource.description}</div>
      <div style={{ height: '0.5px', background: '#eee', marginBottom: 10 }} />
      <button
        onClick={() => window.open(resource.link, '_blank')}
        style={{ width: '100%', background: '#fff', color: PURPLE, border: `1px solid ${PURPLE}`, borderRadius: 4, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f8'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
      >Open →</button>
    </div>
  );
}

function HubResourceTile({ resourceKey }: { resourceKey: string }) {
  const resource = HUB_RESOURCES[resourceKey];
  if (!resource) return null;
  return (
    <div
      onClick={() => window.open(resource.link, '_blank')}
      style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 110, transition: 'border-color 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = PURPLE; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e8'; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: resource.color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 10 }}>
        <img src={HUB_RESOURCE_ICON[resourceKey]} alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4, maxWidth: '80%' }}>{resource.title}</div>
        <span style={{ fontSize: 14, color: PURPLE, flexShrink: 0 }}>→</span>
      </div>
    </div>
  );
}

function HubResourceGrid({ resourceKeys }: { resourceKeys: string[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6, maxWidth: 420 }}>
      {resourceKeys.map(key => <HubResourceTile key={key} resourceKey={key} />)}
    </div>
  );
}

function Sidebar({ pulsing }: { pulsing?: boolean }) {
  return (
    <div style={{ width: 200, background: '#f3f2f1', borderRight: '1px solid #e0e0e0', padding: '12px 0', flexShrink: 0 }}>
      {['Apps', 'Bots'].map(sec => (
        <div key={sec}>
          <div style={{ fontSize: 10, color: '#888', padding: '8px 16px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{sec}</div>
          {sec === 'Apps'
            ? ['General', 'Announcements'].map(item => <div key={item} style={{ padding: '7px 16px', fontSize: 13, color: '#555' }}>{item}</div>)
            : <div style={{ padding: '7px 16px', fontSize: 13, color: '#1a1a1a', fontWeight: 600, background: '#e0dede', display: 'flex', alignItems: 'center', gap: 8 }}>
              {pulsing && <div style={{ width: 7, height: 7, background: PURPLE, borderRadius: '50%', animation: 'pulse 2s infinite' }} />}
              Wysa for Teams
            </div>}
        </div>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

function NotificationToast({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ position: 'absolute', bottom: 20, right: 20, width: 308, background: '#fff', border: '1px solid #ddd', borderLeft: `3px solid ${PURPLE}`, borderRadius: 10, padding: 14, cursor: 'pointer', boxShadow: '0 2px 16px rgba(0,0,0,0.1)', animation: 'slideIn 0.4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 26, height: 26, background: PURPLE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600 }}>W</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>Wysa for Teams</span>
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>now</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f5f3ff', borderRadius: 6, padding: '5px 9px', marginBottom: 9 }}>
        <span style={{ fontSize: 11, color: PURPLE }}>📅</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: PURPLE }}>5 meetings today · back-to-backs 11:00–4:30</span>
      </div>
      <div style={{ fontSize: 12, color: '#444', lineHeight: 1.55, marginBottom: 10 }}>
        When days stack up like this, it's not just the schedule that takes the hit. I'm here if you need to clear more than your to-do list.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 11, color: '#555' }}>2 min check-in</span>
        </div>
        <span style={{ fontSize: 11, color: PURPLE, fontWeight: 600 }}>Open →</span>
      </div>
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

function ExerciseCard({ text }: { text: string }) {
  const raw = text
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  // Merge fragments under 5 words into the previous step
  const steps: string[] = [];
  for (const s of raw) {
    const wordCount = s.split(/\s+/).length;
    if (wordCount < 5 && steps.length > 0) {
      steps[steps.length - 1] = steps[steps.length - 1] + ' ' + s;
    } else {
      steps.push(s);
    }
  }

  const final = steps.slice(0, 6); // max 6 steps

  return (
    <div style={{ background: '#f5f3ff', border: `1px solid ${PURPLE}22`, borderLeft: `3px solid ${PURPLE}`, borderRadius: 8, padding: '14px 16px', marginTop: 6, maxWidth: '75%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: PURPLE }}>✦</span>
        <div style={{ fontSize: 12, fontWeight: 600, color: PURPLE }}>Guided exercise</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {final.map((step, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            opacity: 0,
            animation: `fadeStep 0.4s ease forwards`,
            animationDelay: `${i * 0.15}s`,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: `${PURPLE}18`, color: PURPLE,
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 2,
            }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 13, color: '#2a2a2a', lineHeight: 1.6 }}>
              {step}
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fadeStep {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function HubMessageRenderer({ msg }: { msg: HubMessage }) {
  const hasCards = msg.resourceKeys && msg.resourceKeys.length > 0;

  if (msg.exerciseText) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', opacity: msg.visible ? 1 : 0, transform: msg.visible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600, flexShrink: 0, marginTop: 2 }}>W</div>
        <div style={{ maxWidth: '88%' }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>Wysa for Teams</div>
          <ExerciseCard text={msg.exerciseText} />
        </div>
      </div>
    );
  }

  if (!msg.text && hasCards) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', opacity: msg.visible ? 1 : 0, transform: msg.visible ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600, flexShrink: 0, marginTop: 2 }}>W</div>
        <div style={{ flex: 1, maxWidth: '75%' }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>Wysa for Teams</div>
          {msg.isGrid ? <HubResourceGrid resourceKeys={msg.resourceKeys!} /> : msg.resourceKeys!.map(key => <HubResourceCard key={key} resourceKey={key} />)}
        </div>
      </div>
    );
  }
  return (
    <Message msg={msg}>
      {hasCards && (msg.isGrid ? <HubResourceGrid resourceKeys={msg.resourceKeys!} /> : msg.resourceKeys!.map(key => <HubResourceCard key={key} resourceKey={key} />))}
      {msg.resourceKeys?.includes('eap')}
    </Message>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function UCHubPage() {
  const [screen, setScreen] = useState<'notification' | 'chat'>('notification');
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [phase, setPhaseState] = useState<HubPhase>('exploration');

  const phaseRef = useRef<HubPhase>('exploration');
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const lastResourceKeyRef = useRef<string | null>(null);
  const inAppTurnsRef = useRef(0);
  const msgsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const updatePhase = (p: HubPhase) => { phaseRef.current = p; setPhaseState(p); };
  const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  const addMsg = useCallback((from: 'user' | 'wysa', text: string, extra: Partial<HubMessage> = {}): Promise<void> => {
    return new Promise(resolve => {
      const id = Date.now() + Math.random();
      setMessages(prev => [...prev, { id, from, text, visible: false, ...extra }]);
      setTimeout(() => { setMessages(prev => prev.map(m => m.id === id ? { ...m, visible: true } : m)); resolve(); }, 50);
    });
  }, []);

  const addSplitMsg = async (text: string, extra: Partial<HubMessage> = {}) => {
    // Split on sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+["']?\s*/g)?.map(s => s.trim()).filter(Boolean) ?? [text];

    if (sentences.length <= 1) {
      await addMsg('wysa', text, extra);
      return;
    }

    // First sentence — no extra (cards go on last message)
    for (let i = 0; i < sentences.length; i++) {
      if (i > 0) {
        setTyping(true);
        await delay(500);
        setTyping(false);
      }
      const isLast = i === sentences.length - 1;
      await addMsg('wysa', sentences[i], isLast ? extra : {});
    }
  };

  const addExerciseCard = async (text: string) => {
    return new Promise<void>(resolve => {
      const id = Date.now() + Math.random();
      setMessages(prev => [...prev, { id, from: 'wysa' as const, text: '', visible: false, exerciseText: text }]);
      setTimeout(() => { setMessages(prev => prev.map(m => m.id === id ? { ...m, visible: true } : m)); resolve(); }, 50);
    });
  };

  // ── LLM call ─────────────────────────────────────────────────────────────

  const callHub = async (): Promise<HubLLMResponse> => {
    const raw = await callAI(ucHubSystem(), historyRef.current);

    // Safety Fallback: detect crisis or specific resources on RAW response immediately.
    // This catches malformed JSON or plain text responses.
    const isCrisisByMsg = /this sounds serious|make sure you are okay|make sure you're okay|connect you with a professional|reach out to your eap|trained professionals available|more support than i can/i.test(raw);

    let inferredKey: string | null = null;
    const lowerRaw = raw.toLowerCase();
    if (isCrisisByMsg) inferredKey = 'eap';
    else if (/parenting|child behaviour/i.test(lowerRaw)) inferredKey = 'rethink_care_parenting';
    else if (/neurodiversity|adhd|autism/i.test(lowerRaw)) inferredKey = 'rethink_care_neuro';
    else if (/professional coaching|leadership|career growth|work challenges/i.test(lowerRaw)) inferredKey = 'rethink_care_coaching';
    else if (/financial|money|budgeting/i.test(lowerRaw)) inferredKey = 'nudge';
    else if (/meditation|mindfulness|resets/i.test(lowerRaw)) inferredKey = 'calm_mindfulness';
    else if (/well-being coach|wysa|feelings|check-in/i.test(lowerRaw)) inferredKey = 'wysa';
    else if (/drinking|substance|sobriety/i.test(lowerRaw)) inferredKey = 'sober_sidekick';
    else if (/knowledge hack|insights|uptime/i.test(lowerRaw)) inferredKey = 'uptime';
    else if (/peer support|talk to someone|actually been through/i.test(lowerRaw)) inferredKey = 'mental_health_ally';

    try {
      const cleaned = raw.trim().replace(/```json|```/g, '').trim();
      let parsed: Partial<HubLLMResponse> | null = null;
      try { parsed = JSON.parse(cleaned); } catch {
        const match = cleaned.match(/\{[\s\S]*?"msg"[\s\S]*?\}/);
        if (match) { try { parsed = JSON.parse(match[0]); } catch { /* leave null */ } }
      }

      const msg = parsed?.msg ?? raw;
      const resourceKey = parsed?.specific_resource_redirected || inferredKey;
      const finalKey = resourceKey && (HUB_RESOURCE_KEYS.includes(resourceKey) || resourceKey === 'in_app_self_care') ? resourceKey : null;

      const baseCareType = (['NA', 'specific_resource', 'crisis', 'venting', 'exploratory', 'therapeutic'] as const)
        .includes(parsed?.care_type as never) ? parsed?.care_type as HubLLMResponse['care_type'] : 'NA';

      const finalCareType = isCrisisByMsg ? 'crisis' : (finalKey && finalKey !== 'in_app_self_care' ? 'specific_resource' : baseCareType);
      const isManualHandoff = /when you are ready|come back here after/i.test(msg);
      const finalHandoff = isCrisisByMsg || parsed?.specific_resource_handoff === true || isManualHandoff;

      return {
        msg,
        care_type: finalCareType,
        specific_resource_redirected: finalKey,
        specific_resource_handoff: finalHandoff,
      };
    } catch {
      return {
        msg: raw,
        care_type: inferredKey === 'eap' ? 'crisis' : (inferredKey ? 'specific_resource' : 'NA'),
        specific_resource_redirected: inferredKey,
        specific_resource_handoff: !!inferredKey
      };
    }
  };// ── Button generation ─────────────────────────────────────────────────────

  const genHubButtons = useCallback(async () => {
    // Fall through to AI button generation
    const currentPhase = phaseRef.current;
    if (currentPhase === 'depth' || currentPhase === 'crisis' || currentPhase === 'closed') { setQuickReplies([]); return; }

    try {
      const hist = historyRef.current;
      const lastBot = hist.filter(h => h.role === 'assistant').slice(-1)[0]?.content ?? '';
      const histStr = hist.map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.content}`).join('\n');
      const raw = await callAI(UC_HUB_BUTTONS_SYSTEM, [{ role: 'user', content: ucHubButtonsUserPrompt(histStr, lastBot) }]);
      let btns: string[] = [];
      try { btns = JSON.parse(raw.trim().replace(/```json|```/g, '')); } catch { /* leave empty */ }
      if (!Array.isArray(btns) || btns.length === 0) { setQuickReplies([]); return; }
      setQuickReplies(btns.map(label => ({ label, action: () => hubReply(label) })));
    } catch { setQuickReplies([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMsg, messages]);

  // ── Resource render helper ────────────────────────────────────────────────

  const renderResourceCard = async (msg: string, key: string, immediate = false) => {
    inAppTurnsRef.current = 0;
    updatePhase('resource');
    lastResourceKeyRef.current = key;
    if (immediate) {
      await addMsg('wysa', msg, { resourceKeys: [key] });
    } else {
      await addSplitMsg(msg);
    }
    historyRef.current = [...historyRef.current, { role: 'assistant', content: msg }];
    await delay(400);
    await genHubButtons();
  };

  const renderCrisis = async (customMsg?: string) => {
    // Set phase FIRST before any await — this ensures hubReply 
    // hard gate blocks any user input that arrives during rendering
    phaseRef.current = 'crisis';
    setPhaseState('crisis');
    setQuickReplies([]);
    setInputVal(''); // clear input immediately

    // Single message with card attached — never two separate messages
    const crisisMsg = customMsg ?? "This sounds serious. I want to make sure you're okay.";
    await addMsg('wysa', crisisMsg, { resourceKeys: ['eap'] });
    historyRef.current = [...historyRef.current, { role: 'assistant', content: crisisMsg }];
  };

  const hubClose = async (felt: 'helped' | 'neutral') => {
    updatePhase('closed');
    setQuickReplies([]);
    const closeMsg = felt === 'helped' ? "Really glad that helped. Come back any time — I'm here." : "Take your time. I'm here whenever you need it.";
    await addMsg('wysa', closeMsg);
    historyRef.current = [...historyRef.current, { role: 'assistant', content: closeMsg }];
  };

  // ── Core reply loop ───────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function hubReply(userText: string) {
    // Hard gate — crisis and closed phases never process new input
    if (phaseRef.current === 'crisis' || phaseRef.current === 'closed') return;

    setQuickReplies([]);
    await addMsg('user', userText);
    historyRef.current = [...historyRef.current, { role: 'user', content: userText }];

    const currentPhase = phaseRef.current;
    const lower = userText.toLowerCase().trim();

    if (currentPhase === 'resource' || currentPhase === 'post_resource') {
      if (/^(sure|ok+|okay|yes+|yeah+|sounds good|alright|go ahead|open it|let's go|i'll try it)[.!?\s]*$/i.test(lower) || /how.*open|open.*how|where.*open|how.*access/i.test(lower)) {
        const key = lastResourceKeyRef.current;
        if (key && HUB_RESOURCES[key]) {
          setTyping(true); await delay(500); setTyping(false);
          const confirmMsg = /how.*open|open.*how|where.*open|how.*access/i.test(lower) ? "Click the button below — opens directly in your browser." : "Open it when you're ready — come back here after.";
          await addMsg('wysa', confirmMsg, { resourceKeys: [key] });
          historyRef.current = [...historyRef.current, { role: 'assistant', content: confirmMsg }];
          updatePhase('post_resource');
          setQuickReplies([
            { label: 'That helped', action: () => hubReply('That helped') },
            { label: 'Not really', action: () => hubReply('Not really') },
            { label: "Didn't try it", action: () => hubReply("Didn't try it") },
          ]);
          return;
        }
      }

      if (/tell me more|more about|what is it|how does it work|explain|what does it do/i.test(lower)) {
        const key = lastResourceKeyRef.current;
        const resource = key ? HUB_RESOURCES[key] : null;
        setTyping(true); await delay(600); setTyping(false);
        const explainMsg = resource ? `${resource.title} — ${resource.description} Takes about 5 minutes. Open it when you have a moment and come back here after.` : "Open it when you're ready — it's short and you can come back here after.";
        await addMsg('wysa', explainMsg);
        historyRef.current = [...historyRef.current, { role: 'assistant', content: explainMsg }];
        await genHubButtons();
        return;
      }

      if (/helped|thank|great|feel better|good now|better now|perfect|awesome|it worked/i.test(lower)) { await hubClose('helped'); return; }

      if (/not really|didn't help|didn't work|wasn't useful|no.*help|not helpful/i.test(lower)) {
        updatePhase('exploration');
        setTyping(true);
        try {
          const response = await callHub();
          setTyping(false);
          if (response.care_type === 'crisis') { await renderCrisis(); return; }
          const key = response.specific_resource_redirected;
          if (key && HUB_RESOURCES[key]) { await renderResourceCard(response.msg, key); }
          else { await addSplitMsg(response.msg); historyRef.current = [...historyRef.current, { role: 'assistant', content: response.msg }]; await genHubButtons(); }
        } catch { setTyping(false); await addMsg('wysa', "Let me think of something else that might fit better."); }
        return;
      }

      if (/didn't try|not now|not right now|something else|later|not yet|maybe later/i.test(lower)) {
        updatePhase('exploration');
        setQuickReplies([]);
        setTyping(true);
        const nextPrompt = lower.includes('something else') ? "Fair enough. What would you like to talk about instead?" : "No problem — it's here if you change your mind. What else is on your mind?";
        await addMsg('wysa', nextPrompt);
        historyRef.current = [...historyRef.current, { role: 'assistant', content: nextPrompt }];
        setTyping(false);
        return;
      }
    }

    setTyping(true);
    try {
      const response = await callHub();
      setTyping(false);

      if (response.care_type === 'crisis') { await renderCrisis(response.msg); return; }

      // EAP always treated as crisis-adjacent — show card immediately, no confirmation step
      if (response.specific_resource_redirected === 'eap') {
        await renderCrisis(response.msg);
        return;
      }

      const isSelfCare = response.specific_resource_redirected === 'in_app_self_care' || /\b(inhale|exhale|hold)\b/i.test(response.msg) || /\b(breath|breathe)\s+(in|out|slowly|deeply)\b/i.test(response.msg);

      if (isSelfCare) {
        inAppTurnsRef.current += 1;

        if (inAppTurnsRef.current >= 2) {
          // Force exit to a real resource
          inAppTurnsRef.current = 0;
          const exitResponse = await callHub();
          if (exitResponse.specific_resource_redirected && HUB_RESOURCES[exitResponse.specific_resource_redirected]) {
            await renderResourceCard(exitResponse.msg, exitResponse.specific_resource_redirected);
          } else {
            await renderResourceCard("There are tools built specifically for moments like this — structured support, not just advice.", 'calm_mindfulness');
          }
          return;
        }

        // First in-app turn — render as exercise card, not split messages
        await addExerciseCard(response.msg);
        historyRef.current = [...historyRef.current, { role: 'assistant', content: response.msg }];
        await genHubButtons();
        return;
      }

      if (response.care_type === 'specific_resource' && response.specific_resource_redirected && HUB_RESOURCES[response.specific_resource_redirected]) {
        const key = response.specific_resource_redirected;

        if (response.specific_resource_handoff) {
          setTyping(true); await delay(400); setTyping(false);
          const confirmMsg = key === lastResourceKeyRef.current ? "Open it when you're ready — come back here after." : response.msg;
          await addSplitMsg(confirmMsg, { resourceKeys: [key] });
          historyRef.current = [...historyRef.current, { role: 'assistant', content: confirmMsg }];
          lastResourceKeyRef.current = key;
          updatePhase('post_resource');
          setQuickReplies([
            { label: 'That helped', action: () => hubReply('That helped') },
            { label: 'Not really', action: () => hubReply('Not really') },
            { label: "Didn't try it", action: () => hubReply("Didn't try it") },
          ]);
          return;
        }

        if (key === lastResourceKeyRef.current && currentPhase === 'resource') {
          setTyping(true); await delay(400); setTyping(false);
          await addMsg('wysa', "Open it when you're ready — come back here after.", { resourceKeys: [key] });
          historyRef.current = [...historyRef.current, { role: 'assistant', content: "Open it when you're ready — come back here after." }];
          updatePhase('post_resource');
          setQuickReplies([
            { label: 'That helped', action: () => hubReply('That helped') },
            { label: 'Not really', action: () => hubReply('Not really') },
            { label: "Didn't try it", action: () => hubReply("Didn't try it") },
          ]);
          return;
        }

        const isDirectRequest = /^(yes|yeah|sure|ok+|okay|let's go|go ahead|give me|show me|open it)[.!?\s]*$/i.test(lower) || /do you have|any tools|what can help|show me something|give me a tool/i.test(lower);
        await renderResourceCard(response.msg, key, isDirectRequest);
        return;
      }

      const userTurns = historyRef.current.filter(h => h.role === 'user').length;
      if (userTurns >= 3 && currentPhase === 'exploration') updatePhase('depth');

      await addSplitMsg(response.msg);
      historyRef.current = [...historyRef.current, { role: 'assistant', content: response.msg }];
      await genHubButtons();

    } catch {
      setTyping(false);
      await addMsg('wysa', "Something went wrong — type what's on your mind and I'll respond.");
      setQuickReplies([]);
    }
  } // ← hubReply ends here

  // ── Show all resources ────────────────────────────────────────────────────

  const showAllResources = async () => {
    setQuickReplies([]);
    await addMsg('user', 'Show me resources');
    historyRef.current = [...historyRef.current, { role: 'user', content: 'Show me resources' }];
    setTyping(true); await delay(500); setTyping(false);
    const intro = "Here's the full toolkit. Take what fits.";
    await addMsg('wysa', intro);
    historyRef.current = [...historyRef.current, { role: 'assistant', content: intro }];
    setTyping(true); await delay(300); setTyping(false);
    await addMsg('wysa', '', { resourceKeys: HUB_RESOURCE_KEYS, isGrid: true });
    await delay(400);
    await addMsg('wysa', "Anything here feel relevant, or want to talk through what's going on first?");
    historyRef.current = [...historyRef.current, { role: 'assistant', content: "Anything here feel relevant, or want to talk through what's going on first?" }];
    setQuickReplies([{ label: "Let's talk", action: () => hubReply("Let's talk") }]);
  };

  // ── Chat initialization ───────────────────────────────────────────────────

  const initHubChat = async () => {
    setScreen('chat');
    setMessages([]);
    historyRef.current = [];
    lastResourceKeyRef.current = null;
    inAppTurnsRef.current = 0;
    updatePhase('exploration');
    setTyping(true); await delay(650); setTyping(false);
    const msg1 = "Looks like work's been a bit heavy. If it's affecting more than just your schedule, I'm here.";
    await addMsg('wysa', msg1);
    historyRef.current = [{ role: 'assistant', content: msg1 }];
    setTyping(true); await delay(750); setTyping(false);
    const msg2 = "What's been making work feel off lately?";
    await addMsg('wysa', msg2);
    historyRef.current = [...historyRef.current, { role: 'assistant', content: msg2 }];
    await delay(200);
    setQuickReplies([
      { label: 'Too many meetings', action: () => hubReply('Too many meetings') },
      { label: "Can't focus", action: () => hubReply("Can't focus") },
      { label: 'Feeling overwhelmed', action: () => hubReply('Feeling overwhelmed') },
      { label: 'Show me resources', action: () => showAllResources() },
    ]);
  };

  // ── Input handler ─────────────────────────────────────────────────────────

  const handleSend = () => {
    const val = inputVal.trim();
    if (!val) return;
    if (phaseRef.current === 'crisis' || phaseRef.current === 'closed') return;
    setInputVal('');
    hubReply(val);
  };

  const inputDisabled = phase === 'crisis' || phase === 'closed';

  // ── Render: Notification ──────────────────────────────────────────────────

  if (screen === 'notification') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f0f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <TeamsTop activeTab="Teams" />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar pulsing />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', position: 'relative' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: '#aaa' }}>Your workspace</span>
          </div>
          <NotificationToast onClick={initHubChat} />
        </div>
      </div>
    </div>
  );

  // ── Render: Chat ──────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: '100%', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <TeamsTop activeTab="Chat" />
        <div style={{ fontSize: 12, color: PURPLE, cursor: 'pointer', padding: '8px 16px', borderBottom: '1px solid #eee', background: '#fafafa' }} onClick={() => window.location.href = '/'}>
          ← back to prototype picker
        </div>
        <ChatHeader />
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(m => <HubMessageRenderer key={m.id} msg={m} />)}
          {typing && <TypingDots />}
          <div ref={msgsEndRef} />
        </div>
        {quickReplies.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
            {quickReplies.map((qr, i) => qr.label && qr.action && <QRButton key={i} label={qr.label} onClick={qr.action} />)}
          </div>
        )}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={inputDisabled ? 'Conversation complete.' : 'Type a message...'}
            disabled={inputDisabled}
            style={{ flex: 1, padding: '8px 14px', borderRadius: 20, border: '1px solid #ddd', fontSize: 13, background: inputDisabled ? '#f5f5f5' : '#fafafa', color: inputDisabled ? '#aaa' : '#1a1a1a', outline: 'none', fontFamily: 'inherit', cursor: inputDisabled ? 'not-allowed' : 'text' }}
          />
          <button onClick={handleSend} disabled={inputDisabled}
            style={{ background: inputDisabled ? '#ccc' : PURPLE, color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: inputDisabled ? 'not-allowed' : 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ›
          </button>
        </div>
      </div>
      <style>{`@keyframes tdot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}