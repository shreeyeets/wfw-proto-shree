'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  uc1ProtectSlotsSystem,
  UC1_LIGHT_DAY_SYSTEM,
  UC1_LIGHT_DAY_TASKS_SYSTEM,
  UC1_TRIAGE_SYSTEM,
  UC1_CLOSE_SYSTEM,
  CALENDAR_EVENT_TITLE_SYSTEM,
  UC1_ASSIGN_TASK_REFRAME_SYSTEM,
  uc1ProtectConfirmSystem,
  uc1AssignConfirmSystem,
  uc1AssignTaskReframeSystem,
  calendarEventTitleSystem,
  uc1LightDayTasksPrompt,
  uc2StepSystem,
  uc2ResolutionSystem,
  UC2_BUTTONS_SYSTEM,
  UC2_TOOL_EXPLAIN_SYSTEM,
  UC2_DEFER_TOOL_SYSTEM,
  uc2ButtonsUserPrompt,
  uc2ToolExplainPrompt,
} from '@/lib/prompts';
import { PURPLE } from '@/components/teams-shell/constants';
import { Avatar } from '@/components/teams-shell/Avatar';
import { TypingDots } from '@/components/teams-shell/TypingDots';
import { Message } from '@/components/teams-shell/Message';
import { QRButton } from '@/components/teams-shell/QRButton';
import { TeamsTop } from '@/components/teams-shell/TeamsTop';
import { ChatMessage, QuickReply, WysaTool } from '@/components/teams-shell/types';
import { callAI } from '@/lib/callAI';

// detectTool is UC2-specific — lives here since it references local WYSA_TOOLS
function detectTool(text: string): WysaTool | null {
  const lower = text.toLowerCase();
  for (const t of WYSA_TOOLS) if (t.triggers.some(k => lower.includes(k))) return t;
  return null;
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function InsightCard() {
  const rows = [
    { label: 'Meetings', val: '5 meetings · 3h 45m', warn: true, ok: false },
    { label: 'back-to-back meetings', val: '11:00–12:30 · 3:00–4:30', warn: true, ok: false },
    { label: 'Longest free block', val: '10:00–11:00 (60 min)', warn: false, ok: true },
    { label: 'Other free slots', val: '12:30–1:30 · 4:30–5:00', warn: false, ok: false },
  ];
  return (
    <div style={{ background: '#f8f8ff', border: '1px solid #ddd', borderLeft: `3px solid ${PURPLE}`, borderRadius: 8, padding: '11px 13px', fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: PURPLE, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your day at a glance</div>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee', fontSize: 12 }}>
          <span style={{ color: '#888' }}>{r.label}</span>
          <span style={{ fontWeight: 500, color: r.warn ? '#B45309' : r.ok ? '#2E7D32' : '#1a1a1a' }}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

const SLOT_ORDER = ['10:00–11:00', '12:30–1:30', '4:30–5:00'];
const SLOT_NOTES: Record<string, string> = {
  '10:00–11:00': '10:00–11:00 — freshest hour, nothing before it. Best for anything needing real thinking.',
  '12:30–1:30': '12:30–1:30 — right after 2 back-to-back meetings end. Give it 5 min before diving in.',
  '4:30–5:00': '4:30–5:00 — tight 30 min. Wrap up loose ends only, don\'t start anything new.',
};

const WYSA_TOOLS: WysaTool[] = [
  { name: 'CBT to Beat Stress', triggers: ['stressed', 'anxious', 'overwhelmed', 'panic', "can't think", 'head is full', 'too much', 'spiralling', 'stress', 'anxiety'], url: 'https://dev-widget.wysa.io/wrapper/accenture/' },
  { name: 'Planning a Difficult Conversation', triggers: ['conversation', 'talk to', 'manager', 'feedback', 'confrontation', 'difficult', 'awkward', 'colleague'], url: 'https://dev-widget.wysa.io/wrapper/accenture/' },
  { name: 'Finding Your Strengths', triggers: ['meaning', 'lost', 'purpose', 'identity', 'what am i doing', 'not sure anymore'], url: 'https://dev-widget.wysa.io/wrapper/accenture/' },
  { name: 'Progressive Relaxation', triggers: ['tense', 'tight', "can't relax", 'wound up', 'physical', 'body'], url: 'https://dev-widget.wysa.io/wrapper/accenture/' },
];

const CLOSING_MSG = "I'll check in later in the day — come back if you need anything before then.";

interface FlowState {
  slotSelectMode?: boolean;
  protectedSlots?: string[];
  assignMode?: boolean;
  assignSlots?: string[];
  assignIdx?: number;
  assignedTasks?: string[];
  triageMode?: boolean;
  triageHistory?: Array<{ role: string; content: string }>;
  uc2History?: Array<{ role: string; content: string }>;
  uc2Step?: number;
  uc2WaitInput?: boolean;
  lightDayInputMode?: boolean;
}

export default function App() {
  const [screen, setScreen] = useState<'landing' | 'teams' | 'chat'>('landing');
  const [uc, setUc] = useState<'uc1' | 'uc2' | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [, setFsState] = useState<FlowState>({});
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const fsRef = useRef<FlowState>({});

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const updateFs = (updates: Partial<FlowState>) => {
    fsRef.current = { ...fsRef.current, ...updates };
    setFsState(s => ({ ...s, ...updates }));
  };

  function googleCalendarLink(title: string, startHour: number, startMin: number, durationMins: number, daysOffset = 0): string {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysOffset);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${targetDate.getFullYear()}${pad(targetDate.getMonth() + 1)}${pad(targetDate.getDate())}`;
    const start = `${dateStr}T${pad(startHour)}${pad(startMin)}00`;
    const endDate = new Date(targetDate);
    endDate.setHours(startHour, startMin + durationMins);
    const endStr = `${dateStr}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${endStr}`;
  }

  const SLOT_MAP: Record<string, { h: number, m: number, d: number, offset: number }> = {
    "10:00": { h: 10, m: 0, d: 60, offset: 0 },
    "12:30": { h: 12, m: 30, d: 60, offset: 0 },
    "4:30": { h: 16, m: 30, d: 30, offset: 0 },
    "9:30": { h: 9, m: 30, d: 90, offset: 1 },
    "2:00": { h: 14, m: 0, d: 60, offset: 1 },
  };

  const getCalendarBtn = (text: string, forcedTitle?: string): QuickReply | null => {
    for (const [key, data] of Object.entries(SLOT_MAP)) {
      if (text.includes(key)) {
        return {
          label: "Block it in Calendar →",
          action: () => window.open(googleCalendarLink(forcedTitle || "Deep Work", data.h, data.m, data.d, data.offset), '_blank')
        };
      }
    }
    return null;
  };

  const notifText = uc === 'uc1'
    ? "Your 10am window is your only clean hour today. After that it's back-to-back meetings until 4:30."
    : "You've had meetings stacked since 11am. If things are piling up, I can help cut through it in under 2 minutes.";

  const addMsg = useCallback((from: 'user' | 'wysa', text: string, extra: Partial<ChatMessage> = {}): Promise<void> => {
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

  const addSplitMsg = async (text: string, extra: Partial<ChatMessage> = {}) => {
    const sentences = text.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
    for (let i = 0; i < sentences.length; i++) {
      if (i > 0) {
        setTyping(true);
        await delay(600);
        setTyping(false);
      }
      await addMsg('wysa', sentences[i], i === sentences.length - 1 ? extra : {});
    }
  };

  // ── UC1 ──────────────────────────────────────────────────────────────────────

  const initUC1 = useCallback(async () => {
    setQuickReplies([]);
    await addMsg('wysa', "Your 10am window is your only clean hour today. After that it's back-to-back meetings until 4:30.", { card: true });
    await delay(1000);
    await addMsg('wysa', "How would you like to handle your day today?");
    await delay(400);
    setQuickReplies([
      { label: 'Block time for focused work', action: () => uc1ProtectSlots() },
      { label: "It's a light-work day, I'll adjust", action: () => uc1LightDay() },
      { label: 'I also have deadlines', action: () => uc1StartTriage() },
    ]);
  }, [addMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  const uc1ProtectSlots = async () => {
    setQuickReplies([]);
    await addMsg('user', 'Block time for focused work');
    await delay(500);
    await addMsg('wysa', 'Which ones?');
    await delay(600);
    updateFs({ slotSelectMode: true });
    setQuickReplies([{ type: 'slotpicker' }]);
  };

  const uc1SlotsConfirmed = async (selected: Set<string>) => {
    setQuickReplies([]);
    updateFs({ slotSelectMode: false });
    if (selected.size === 0) {
      await addMsg('user', 'Done');
      await delay(400);
      await addMsg('wysa', "Nothing selected — what do you actually need time for today?");
      await delay(600);
      setQuickReplies([
        { label: 'I also have deadlines', action: () => uc1StartTriage() },
        { label: "It's a light-work day", action: () => uc1LightDay() },
      ]);
      return;
    }
    const sorted = SLOT_ORDER.filter(s => selected.has(s));
    await addMsg('user', `Protect ${sorted.join(' and ')}`);
    await delay(400);
    const noteLines = sorted.map(s => SLOT_NOTES[s]).join('\n\n');
    await addMsg('wysa', noteLines);
    setTyping(true);
    try {
      const btnReply = await callAI(
        uc1ProtectSlotsSystem(sorted),
        [{ role: 'user', content: `Protected: ${sorted.join(', ')}` }]
      );
      setTyping(false);
      let btns: string[];
      try { btns = JSON.parse(btnReply.trim().replace(/```json|```/g, '')); } catch { btns = ['Assign tasks to these slots', "I'll figure it out", 'I have a deadline — help me triage']; }
      updateFs({ protectedSlots: sorted });
      setQuickReplies([
        { label: btns[0], action: () => uc1AssignTasks(sorted) },
        { label: btns[1], action: () => uc1DecideLater() },
        { label: btns[2], action: () => uc1StartTriage() },
      ]);
    } catch {
      setTyping(false);
      updateFs({ protectedSlots: sorted });
      setQuickReplies([
        { label: 'Assign tasks to these slots', action: () => uc1AssignTasks(sorted) },
        { label: "I'll figure it out", action: () => uc1DecideLater() },
        { label: 'I also have deadlines', action: () => uc1StartTriage() },
      ]);
    }
  };

  const uc1AssignTasks = async (slots: string[]) => {
    setQuickReplies([]);
    await addMsg('user', 'Assign tasks to these slots');
    updateFs({ assignMode: true, assignSlots: slots, assignIdx: 0, assignedTasks: [] });
    await delay(400);
    await addMsg('wysa', `What's going in ${slots[0]}?`);
  };

  const uc1HandleAssign = async (val: string) => {
    const { assignSlots = [], assignIdx = 0, assignedTasks = [] } = fsRef.current;
    const slot = assignSlots[assignIdx];
    await addMsg('user', val);
    
    setTyping(true);
    let scopedTask = val;
    let calTitle = "Deep Work";
    try {
      const duration = SLOT_MAP[slot.split('–')[0]]?.d || 60;
      const [reframe, title] = await Promise.all([
        callAI(uc1AssignTaskReframeSystem(val, duration), [{ role: 'user', content: val }]),
        callAI(calendarEventTitleSystem(val), [{ role: 'user', content: val }])
      ]);
      scopedTask = reframe.trim();
      calTitle = title.trim();
    } catch { /* fallback to original val and generic title */ }
    setTyping(false);

    const newTasks = [...assignedTasks, scopedTask];
    updateFs({ assignedTasks: newTasks });
    await delay(400);
    await addMsg('wysa', `${slot} — locked in for: ${scopedTask}`);
    const nextIdx = assignIdx + 1;
    updateFs({ assignIdx: nextIdx });
    await delay(500);
    if (nextIdx < assignSlots.length) {
      await addMsg('wysa', `What's going in ${assignSlots[nextIdx]}?`);
    } else {
      updateFs({ assignMode: false });
      setTyping(true);
      try {
        const slots = assignSlots || [];
        const tasks = newTasks || [];
        const reply = await callAI(uc1AssignConfirmSystem(tasks, slots), [{ role: 'user', content: 'Tasks assigned' }]);
        setTyping(false);
        await addSplitMsg(reply);
        await delay(600);
        // Use the last generated calTitle for the completion button
        const calBtn = getCalendarBtn(reply, calTitle);
        setQuickReplies([
          { label: 'Good to go', action: () => uc1Close('Good to go') },
          { label: 'I also have a deadline', action: () => uc1StartTriage() },
          ...(calBtn ? [calBtn] : []),
        ]);
      } catch {
        setTyping(false);
        await addMsg('wysa', 'All set — those slots are locked.');
        await delay(600);
        setQuickReplies([
          { label: 'Good to go', action: () => uc1Close('Good to go') },
          { label: 'I also have a deadline', action: () => uc1StartTriage() },
        ]);
      }
    }
  };

  const uc1DecideLater = async () => {
    setQuickReplies([]);
    await addMsg('user', "I'll figure it out");
    setTyping(true);
    try {
      const slots = fsRef.current.protectedSlots || [];
      const reply = await callAI(uc1ProtectConfirmSystem(slots), [{ role: 'user', content: "I'll figure it out" }]);
      setTyping(false);
      await addSplitMsg(reply);
      await delay(600);

      let calTitle = "Deep Work";
      try {
        const titleRes = await callAI(calendarEventTitleSystem(reply), [{ role: 'user', content: 'Deciding later' }]);
        calTitle = titleRes.trim();
      } catch {}

      const calBtn = getCalendarBtn(reply, calTitle);
      setQuickReplies([
        { label: 'Works for me', action: () => uc1Close('Works for me') },
        ...(calBtn ? [calBtn] : []),
      ]);
    } catch {
      setTyping(false);
      await addMsg('wysa', "Slots are protected. I'll check in when each one is coming up so you're not caught off guard.");
      await delay(600);
      setQuickReplies([{ label: 'Works for me', action: () => uc1Close('Works for me') }]);
    }
  };

  const uc1LightDay = async () => {
    setQuickReplies([]);
    await addMsg('user', "It's a light-work day, I'll adjust");
    setTyping(true);
    try {
      const reply = await callAI(
        UC1_LIGHT_DAY_SYSTEM,
        [{ role: 'user', content: "It's a light-work day, I'll adjust" }]
      );
      setTyping(false);
      await addSplitMsg(reply);
      updateFs({ lightDayInputMode: true });
      await delay(500);
      setQuickReplies([]);
    } catch {
      setTyping(false);
      await addMsg('wysa', 'Right call. Use the 60-min slots for async — messages, reviews. Save real work for tomorrow.');
      await delay(600);
      setQuickReplies([{ label: 'Makes sense', action: () => uc1Close('Makes sense') }]);
    }
  };

  const uc1StartTriage = async () => {
    setQuickReplies([]);
    await addMsg('user', 'I also have deadlines');
    await delay(500);
    await addMsg('wysa', "What are the deadlines, and roughly how much bandwidth will they consume?");
    updateFs({ triageMode: true, assignMode: false });
  };

  const uc1Triage = async (val: string) => {
    await addMsg('user', val);
    const triageHist = [...(fsRef.current.triageHistory || []), { role: 'user', content: val }];
    updateFs({ triageHistory: triageHist });
    setTyping(true);
    try {
      const reply = await callAI(UC1_TRIAGE_SYSTEM, triageHist.map(h => ({ role: h.role, content: h.content })));
      const newHist = [...triageHist, { role: 'assistant', content: reply }];
      updateFs({ triageHistory: newHist });
      setTyping(false);
      await addSplitMsg(reply);
      await delay(500);
      
      let calTitle = "Deep Work";
      try {
        const titleRes = await callAI(calendarEventTitleSystem(val), [{ role: 'user', content: val }]);
        calTitle = titleRes.trim();
      } catch {}

      const calBtn = getCalendarBtn(reply, calTitle);
      setQuickReplies([
        {
          label: "Got it — I'll take that slot",
          action: () => {
            updateFs({ triageMode: false });
            uc1Close("Got it — I'll take that slot");
          }
        },
        {
          label: "That doesn't work, I need to rethink",
          action: async () => {
            setQuickReplies([]);
            await addMsg('user', "That doesn't work, I need to rethink");
            await delay(400);
            await addMsg('wysa', "What's the actual constraint — the deadline or the time?");
            // triageMode stays true
          },
        },
        ...(calBtn ? [calBtn] : []),
      ]);
    } catch {
      setTyping(false);
      await addMsg('wysa', "Couldn't reach the server — try again.");
    }
  };

  const uc1Close = async (userMsg: string) => {
    setQuickReplies([]);
    if (userMsg) await addMsg('user', userMsg);
    setTyping(true);
    try {
      const hist = [...(fsRef.current.triageHistory || []), { role: 'user', content: userMsg }];
      const reply = await callAI(UC1_CLOSE_SYSTEM, hist.map(h => ({ role: h.role, content: h.content })));
      setTyping(false);
      await addSplitMsg(reply);
    } catch {
      setTyping(false);
      await addMsg('wysa', CLOSING_MSG);
    }
  };

  // ── UC2 ──────────────────────────────────────────────────────────────────────

  const initUC2 = useCallback(async () => {
    setQuickReplies([]);
    await addMsg('wysa', "You've had meetings stacked since 11am. If things are piling up, I can help cut through it in under 2 minutes.");
    await delay(1000);
    await addMsg('wysa', 'Is it the back-to-back meetings, or something else?');
    await delay(400);
    setQuickReplies([
      { label: 'The meetings have wrecked my head', action: () => uc2Reply('The meetings have wrecked my head') },
      {
        label: 'Something else',
        action: async () => {
          setQuickReplies([]);
          await addMsg('user', 'Something else');
          await delay(500);
          await addMsg('wysa', "What's going on?");
          updateFs({ uc2WaitInput: true });
        },
      },
    ]);
  }, [addMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (screen === 'chat' && messages.length === 0) {
      if (uc === 'uc1') initUC1();
      else if (uc === 'uc2') initUC2();
    }
  }, [screen, uc, messages.length, initUC1, initUC2]); // eslint-disable-line react-hooks/exhaustive-deps

  const uc2Reply = async (userText: string) => {
    setQuickReplies([]);
    await addMsg('user', userText);
    const hist = [...(fsRef.current.uc2History || []), { role: 'user', content: userText }];
    updateFs({ uc2History: hist, uc2WaitInput: false });
    const detectedTool = detectTool(userText);
    const step = fsRef.current.uc2Step || 0;
    const isDone = step >= 2;
    const toolCtx = detectedTool ? `\nTool available: "${detectedTool.name}" — mention it naturally if the conversation warrants it, don't force it.` : '';
    const system = isDone ? uc2ResolutionSystem(toolCtx) : uc2StepSystem();
    setTyping(true);
    try {
      const raw = await callAI(system, hist.map(h => ({ role: h.role, content: h.content })));
      let replyText: string;
      let inlineOptions: string[] = [];
      if (!isDone) {
        try {
          const cleaned = raw.trim().replace(/```json|```/g, '').trim();
          let parsed;
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const match = cleaned.match(/\{[^{}]*"msg"[^{}]*\}/);
            parsed = match ? JSON.parse(match[0]) : null;
          }
          replyText = parsed?.msg ?? raw;
          inlineOptions = Array.isArray(parsed?.options) ? parsed.options : [];
        } catch {
          replyText = raw;
          inlineOptions = [];
        }
      } else { replyText = raw; }
      const newHist = [...hist, { role: 'assistant', content: replyText }];
      updateFs({ uc2History: newHist, uc2Step: step + 1 });
      const mentionedTool = isDone
        ? WYSA_TOOLS.find(t => replyText.toLowerCase().includes(t.name.toLowerCase()))
        : undefined;
      const toolToOffer = mentionedTool || (detectedTool && (replyText.toLowerCase().includes(detectedTool.name.split(' ')[0].toLowerCase()) || replyText.toLowerCase().includes('reset') || replyText.toLowerCase().includes('toolkit')) ? detectedTool : undefined);
      setTyping(false);
      await addSplitMsg(replyText, toolToOffer ? { widget: toolToOffer } : {});
      
      if (toolToOffer) {
        setQuickReplies([
          { label: `Open ${toolToOffer.name}`, action: () => uc2OpenTool(toolToOffer) },
          { label: 'Tell me more first', action: () => uc2HandleBtn('Tell me more first', toolToOffer) },
          { label: "I'll try it later", action: () => uc2DeferTool() }
        ]);
      } else if (!isDone && inlineOptions.length > 0) {
        setQuickReplies(inlineOptions.map(opt => ({ label: opt, action: () => uc2Reply(opt) })));
      } else {
        await uc2GenButtons(newHist, toolToOffer);
      }
    } catch {
      setTyping(false);
      await addMsg('wysa', "Something went wrong — type what's on your mind.");
      updateFs({ uc2WaitInput: true });
    }
  };

  const uc2GenButtons = async (hist: Array<{ role: string; content: string }>, detectedTool: WysaTool | undefined) => {
    try {
      const history = hist.map(h => `${h.role === 'user' ? 'User' : 'Bot'}: ${h.content}`).join('\n');
      const lastBot = hist.filter(h => h.role === 'assistant').slice(-1)[0]?.content || '';
      const toolHint = detectedTool ? `One button may offer "${detectedTool.name}" — only if conversation warrants it.` : '';
      const btnReply = await callAI(UC2_BUTTONS_SYSTEM, [{ role: 'user', content: uc2ButtonsUserPrompt(history, lastBot, toolHint) }]);
      let btns: string[] | null;
      try { btns = JSON.parse(btnReply.trim().replace(/```json|```/g, '')); } catch { btns = null; }
      if (!btns || !Array.isArray(btns) || btns.length === 0) { updateFs({ uc2WaitInput: true }); setQuickReplies([]); return; }
      setQuickReplies(btns.map(label => ({ label, action: () => uc2HandleBtn(label, detectedTool) })));
    } catch {
      updateFs({ uc2WaitInput: true });
      setQuickReplies([]);
    }
  };

  const uc2HandleBtn = async (label: string, detectedTool: WysaTool | undefined) => {
    setQuickReplies([]);

    // Tool explain route — must come first
    const isExplainRequest = /tell me more|more first|what is|how does|explain/i.test(label);
    const lastOfferedTool = WYSA_TOOLS.find(t =>
      messages.slice().reverse().find(m => m.widget?.name === t.name)
    );

    if (isExplainRequest && lastOfferedTool) {
      await addMsg('user', label);
      setTyping(true);
      const system = UC2_TOOL_EXPLAIN_SYSTEM.replace('{{toolName}}', lastOfferedTool.name);
      const hist = fsRef.current.uc2History || [];
      try {
        const reply = await callAI(system, hist.map(h => ({ role: h.role, content: h.content })));
        setTyping(false);
        await addSplitMsg(reply, { widget: lastOfferedTool });
        setQuickReplies([
          { label: `Open ${lastOfferedTool.name}`, action: () => uc2OpenTool(lastOfferedTool) },
          {
            label: "I'll try it later",
            action: () => uc2DeferTool()
          },
        ]);
      } catch {
        setTyping(false);
        await addMsg('wysa', "Something went wrong — try again.");
      }
      return;
    }

    if (detectedTool && label.toLowerCase().includes(detectedTool.name.split(' ')[0].toLowerCase())) {
      await addMsg('user', label);
      await uc2OpenTool(detectedTool);
      return;
    }
    const isClosing = /good now|satisfied|know what to do|on it now|makes sense|all good/i.test(label);
    const isDefer = /\blater\b|after my|not now|when it comes/i.test(label);
    if (isClosing) { await addMsg('user', label); await delay(400); await addMsg('wysa', CLOSING_MSG); return; }
    if (isDefer) { await addMsg('user', label); await delay(400); await addMsg('wysa', "Saved. I'll bring it back before you close out — don't carry it home."); return; }
    await uc2Reply(label);
  };

  const uc2OpenTool = async (tool: WysaTool) => {
    const lastMsgHasWidget = messages.slice().reverse().find(m => m.from === 'wysa')?.widget;
    if (!lastMsgHasWidget) {
      await addMsg('wysa', "4–5 minutes. Come back after — I'll check in on how it went.", { widget: tool });
    }
    await delay(600);
    setQuickReplies([
      { label: 'Done — back from the tool', action: async () => { setQuickReplies([]); await addMsg('user', 'Done — back from the tool'); await delay(400); await addMsg('wysa', CLOSING_MSG); } },
      { label: "I'll try it later", action: () => uc2DeferTool() },
    ]);
  };

  const uc2DeferTool = async () => {
    setQuickReplies([]);
    await addMsg('user', "I'll try it later");
    setTyping(true);
    const hist = fsRef.current.uc2History || [];
    const lastBot = hist.filter(h => h.role === 'assistant').slice(-1)[0]?.content || '';
    try {
      const reply = await callAI(
        UC2_DEFER_TOOL_SYSTEM,
        [
          ...hist.map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: `I'll try it later` },
          { role: 'system', content: `Last thing you said was: "${lastBot}". Pick up from here, don't restart.` }
        ]
      );
      setTyping(false);
      await addSplitMsg(reply);
      updateFs({ uc2WaitInput: true });
    } catch {
      setTyping(false);
      await addMsg('wysa', "No worries — what would feel more useful right now?");
      updateFs({ uc2WaitInput: true });
    }
  };

  // ── INPUT SEND ────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const val = inputVal.trim();
    if (!val) return;
    setInputVal('');
    if (uc === 'uc1') {
      if (fsRef.current.assignMode) { await uc1HandleAssign(val); }
      else if (fsRef.current.triageMode) { await uc1Triage(val); }
      else if (fsRef.current.lightDayInputMode) {
        updateFs({ lightDayInputMode: false });
        await addMsg('user', val);
        setTyping(true);
        try {
          const reply = await callAI(UC1_LIGHT_DAY_TASKS_SYSTEM, [{ role: 'user', content: uc1LightDayTasksPrompt(val) }]);
          setTyping(false);
          await addSplitMsg(reply);
          await delay(500);

          let calTitle = "Deep Work";
          try {
            const titleRes = await callAI(calendarEventTitleSystem(val), [{ role: 'user', content: val }]);
            calTitle = titleRes.trim();
          } catch {}

          const calBtn = getCalendarBtn(reply, calTitle);
          setQuickReplies([
            { label: 'All good', action: () => uc1Close('All good') },
            ...(calBtn ? [calBtn] : []),
          ]);
        } catch {
          setTyping(false);
          await addMsg('wysa', "That works. Stick to low-energy tasks today and clear the deck for a stronger push tomorrow.");
          await delay(500);
          setQuickReplies([{ label: 'All good', action: () => uc1Close('All good') }]);
        }
      }
      else {
        // UC1 check-in is complete — gently acknowledge free-text
        await addMsg('user', val);
        await delay(400);
        await addMsg('wysa', "The check-in is wrapped up for now. Come back if something else comes up.");
      }
    } else if (uc === 'uc2') {
      updateFs({ uc2WaitInput: false });
      await uc2Reply(val);
    }
  };

  // ── SLOT PICKER ───────────────────────────────────────────────────────────────

  const SlotPicker = () => {
    const [sel, setSel] = useState(new Set<string>());
    const toggle = (slot: string) => setSel(prev => { const n = new Set(prev); n.has(slot) ? n.delete(slot) : n.add(slot); return n; });
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
        {SLOT_ORDER.map(slot => (
          <button key={slot} onClick={() => toggle(slot)}
            style={{ background: sel.has(slot) ? PURPLE : '#fff', border: `1px solid ${PURPLE}`, color: sel.has(slot) ? '#fff' : PURPLE, borderRadius: 20, padding: '5px 13px', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
            {slot}
          </button>
        ))}
        <button onClick={() => uc1SlotsConfirmed(sel)}
          style={{ background: '#fff', border: '1px solid #237B4B', color: '#237B4B', borderRadius: 20, padding: '5px 13px', fontSize: 12, cursor: 'pointer' }}>
          Done
        </button>
      </div>
    );
  };

  // ── SCREEN: LANDING ───────────────────────────────────────────────────────────

  if (screen === 'landing') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: '100%', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, padding: '60px 40px', minHeight: '100vh' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: PURPLE, letterSpacing: 1.5, textTransform: 'uppercase' }}>Wysa for Teams</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 1000 }}>
          {[
            { id: 'uc1' as const, label: 'Morning check-in' },
            { id: 'uc2' as const, label: "I'm overwhelmed" },
            { id: 'uc3' as const, label: "UC3 · Team digest" },
            { id: 'uc_hub' as const, label: 'Wellbeing Toolkit' },
          ].map(c => (
            <div key={c.id} onClick={() => {
              if (c.id === 'uc3') window.location.href = '/uc3';
              else if (c.id === 'uc_hub') window.location.href = '/uc_hub';
              else { setUc(c.id as 'uc1' | 'uc2'); setScreen('teams'); }
            }}
              style={{ flex: 1, minWidth: 280, border: '2px solid #e0e0e0', borderRadius: 16, padding: '48px 32px', cursor: 'pointer', background: '#fff', transition: 'border-color 0.15s, transform 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = PURPLE; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.transform = 'scale(1)'; }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', background: PURPLE, borderRadius: 6, padding: '4px 12px', display: 'inline-block', marginBottom: 16, letterSpacing: '0.5px' }}>{c.id.toUpperCase()}</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#1a1a1a' }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── SCREEN: TEAMS NOTIF ───────────────────────────────────────────────────────

  if (screen === 'teams') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f0f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: '100%', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100vh' }}>
        <TeamsTop activeTab="Teams" />
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ width: 200, background: '#f3f2f1', borderRight: '1px solid #e0e0e0', padding: '12px 0', flexShrink: 0 }}>
            {['Apps', 'Bots'].map(sec => (
              <div key={sec}>
                <div style={{ fontSize: 10, color: '#888', padding: '8px 16px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{sec}</div>
                {sec === 'Apps'
                  ? ['General', 'Announcements'].map(i => <div key={i} style={{ padding: '7px 16px', fontSize: 13, color: '#555' }}>{i}</div>)
                  : <div style={{ padding: '7px 16px', fontSize: 13, color: '#1a1a1a', fontWeight: 600, background: '#e0dede', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 7, height: 7, background: PURPLE, borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                    Wysa for Teams
                  </div>}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', position: 'relative', minHeight: 420 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#aaa' }}>Your workspace</span>
            </div>
            <div
              onClick={() => {
                setMessages([]);
                setQuickReplies([]);
                updateFs({ triageMode: false, assignMode: false, uc2History: [], triageHistory: [], uc2Step: 0, uc2WaitInput: false, slotSelectMode: false, lightDayInputMode: false });
                setScreen('chat');
              }}
              style={{ position: 'absolute', bottom: 20, right: 20, width: 300, background: '#fff', border: '1px solid #ddd', borderLeft: `3px solid ${PURPLE}`, borderRadius: 10, padding: 14, cursor: 'pointer', boxShadow: '0 2px 16px rgba(0,0,0,0.1)', animation: 'slideIn 0.4s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 26, height: 26, background: PURPLE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600 }}>W</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>Wysa for Teams</span>
                <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>now</span>
              </div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{notifText}</div>
              <div style={{ fontSize: 11, color: PURPLE, marginTop: 8, fontWeight: 500 }}>Click to open →</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );

  // ── SCREEN: CHAT ──────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f0f0', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: '100%', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <TeamsTop activeTab="Chat" />
        <div style={{ fontSize: 12, color: PURPLE, cursor: 'pointer', padding: '8px 16px', borderBottom: '1px solid #eee', background: '#fafafa' }}
          onClick={() => { setScreen('landing'); setMessages([]); setQuickReplies([]); }}>
          ← back to prototype picker
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: PURPLE, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 600 }}>W</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Wysa for Teams</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>Bot · always active</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map(m => <Message key={m.id} msg={m}>{m.card && <InsightCard />}</Message>)}
          {typing && <TypingDots />}
          <div ref={msgsEndRef} />
        </div>
        {quickReplies.length > 0 && quickReplies[0]?.type === 'slotpicker'
          ? <SlotPicker />
          : quickReplies.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px', borderTop: '1px solid #f0f0f0', alignItems: 'center' }}>
              {quickReplies.map((qr, i) => qr.label && qr.action && <QRButton key={i} label={qr.label} onClick={qr.action} />)}
            </div>
          )}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..." style={{ flex: 1, padding: '8px 14px', borderRadius: 20, border: '1px solid #ddd', fontSize: 13, background: '#fafafa', color: '#1a1a1a', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={handleSend} style={{ background: PURPLE, color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
        </div>
      </div>
      <style>{`@keyframes tdot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}
