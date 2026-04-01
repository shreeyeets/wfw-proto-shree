import { useState, useEffect, useRef, useCallback } from "react";

const PURPLE = "#6264A7";
const SLOT_ORDER = ["10:00–11:00", "12:30–1:30", "4:30–5:00"];
const SLOT_NOTES = {
  "10:00–11:00": "10:00–11:00 — freshest hour, nothing before it. Best for anything needing real thinking.",
  "12:30–1:30": "12:30–1:30 — right after 2 back-to-back meetings end. Give it 5 min before diving in.",
  "4:30–5:00": "4:30–5:00 — tight 30 min. Wrap up loose ends only, don't start anything new."
};
const WYSA_TOOLS = [
  { name: "CBT to Beat Stress", triggers: ["stressed", "anxious", "overwhelmed", "panic", "can't think", "head is full", "too much", "spiralling", "stress", "anxiety"], url: "https://dev-widget.wysa.io/wrapper/accenture/" },
  { name: "Planning a Difficult Conversation", triggers: ["conversation", "talk to", "manager", "feedback", "confrontation", "difficult", "awkward", "colleague"], url: "https://dev-widget.wysa.io/wrapper/accenture/" },
  { name: "Finding Your Strengths", triggers: ["meaning", "lost", "purpose", "identity", "what am i doing", "not sure anymore"], url: "https://dev-widget.wysa.io/wrapper/accenture/" },
  { name: "Progressive Relaxation", triggers: ["tense", "tight", "can't relax", "wound up", "physical", "body"], url: "https://dev-widget.wysa.io/wrapper/accenture/" }
];
const CAL = { dayType: "heavy fragmented — 5 meetings, back-to-back meetings at 11:00–12:30 and 3:00–4:30, free slots at 10:00–11:00 (60 min), 12:30–1:30 (60 min), 4:30–5:00 (30 min)" };
const CLOSING_MSG = "I'll check in later in the day — come back if you need anything before then.";

function detectTool(text) {
  const lower = text.toLowerCase();
  for (const t of WYSA_TOOLS) if (t.triggers.some(k => lower.includes(k))) return t;
  return null;
}

async function callClaude(system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, system, messages })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content.map(c => c.text || "").join("");
}

// ── COMPONENTS ────────────────────────────────────────────────────────────────

function Avatar({ type, initial }) {
  const bg = type === "wysa" ? PURPLE : "#237B4B";
  return (
    <div style={{ width: 26, height: 26, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
      {initial}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Avatar type="wysa" initial="W" />
      <div>
        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Wysa for Teams</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 13px", background: "#f4f4f4", borderRadius: 12, border: "1px solid #ebebeb" }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#aaa", animation: `tdot 1.2s ${i * 0.2}s infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightCard() {
  const rows = [
    { label: "Meetings", val: "5 meetings · 3h 45m", warn: true },
    { label: "Back-to-back meetings", val: "11:00–12:30 · 3:00–4:30", warn: true },
    { label: "Longest free block", val: "10:00–11:00 (60 min)", ok: true },
    { label: "Other free slots", val: "12:30–1:30 · 4:30–5:00" }
  ];
  return (
    <div style={{ background: "#f8f8ff", border: "1px solid #ddd", borderLeft: `3px solid ${PURPLE}`, borderRadius: 8, padding: "11px 13px", fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: PURPLE, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.5px" }}>Your day at a glance</div>
      {rows.map(r => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #eee", fontSize: 12 }}>
          <span style={{ color: "#888" }}>{r.label}</span>
          <span style={{ fontWeight: 500, color: r.warn ? "#B45309" : r.ok ? "#2E7D32" : "#1a1a1a" }}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.from === "user";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row", opacity: msg.visible ? 1 : 0, transform: msg.visible ? "translateY(0)" : "translateY(6px)", transition: "opacity 0.3s ease,transform 0.3s ease" }}>
      <Avatar type={isUser ? "user" : "wysa"} initial={isUser ? "S" : "W"} />
      <div style={{ maxWidth: "76%", display: "flex", flexDirection: "column" }}>
        {!isUser && <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>Wysa for Teams</div>}
        <div style={{ padding: "9px 13px", borderRadius: 12, fontSize: 13, lineHeight: 1.6, color: isUser ? "#fff" : "#1a1a1a", background: isUser ? PURPLE : "#f4f4f4", border: isUser ? "none" : "1px solid #ebebeb", whiteSpace: "pre-wrap" }}>
          {msg.text}
          {msg.card && <InsightCard />}
          {msg.widget && (
            <div>
              <br />
              <a href={msg.widget.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 4, background: PURPLE, color: "#fff", padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Open: {msg.widget.name} →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QRButton({ label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "#f0f0f8" : "#fff", border: `1px solid ${PURPLE}`, color: PURPLE, borderRadius: 20, padding: "5px 13px", fontSize: 12, cursor: "pointer", transition: "background 0.15s" }}>
      {label}
    </button>
  );
}

function TeamsTop({ activeTab }) {
  return (
    <div style={{ background: "#464775", padding: "0 16px", height: 44, display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
      <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Microsoft Teams</div>
      <div style={{ display: "flex", gap: 20 }}>
        {["Activity", "Chat", "Teams", "Calendar"].map(t => (
          <span key={t} style={{ color: t === activeTab ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 12, borderBottom: t === activeTab ? "2px solid #fff" : "none", paddingBottom: 2 }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState("landing"); // landing | teams | chat
  const [uc, setUc] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [fsState, setFsState] = useState({});
  const msgsEndRef = useRef(null);
  const fsRef = useRef({});

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const updateFs = (updates) => {
    fsRef.current = { ...fsRef.current, ...updates };
    setFsState(s => ({ ...s, ...updates }));
  };

  const notifText = uc === "uc1"
    ? "Your 10am window is your only clean hour today. After that it's back-to-back meetings until 4:30."
    : "You've had meetings stacked since 11am. If things are piling up, I can help cut through it in under 2 minutes.";

  const addMsg = useCallback((from, text, extra = {}) => {
    return new Promise(resolve => {
      const id = Date.now() + Math.random();
      setMessages(prev => [...prev, { id, from, text, visible: false, ...extra }]);
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, visible: true } : m));
        resolve();
      }, 50);
    });
  }, []);

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ── UC1 ────────────────────────────────────────────────────────────────────

  const initUC1 = useCallback(async () => {
    setQuickReplies([]);
    await addMsg("wysa", "Your 10am window is your only clean hour today. After that it's back-to-back meetings until 4:30.", { card: true });
    await delay(700);
    setQuickReplies([
      { label: "Protect the slots", action: () => uc1ProtectSlots() },
      { label: "It's a light-work day, I'll adjust", action: () => uc1LightDay() },
      { label: "I also have deadlines", action: () => uc1StartTriage() }
    ]);
  }, [addMsg]);

  const uc1ProtectSlots = async () => {
    setQuickReplies([]);
    await addMsg("user", "Protect the slots");
    await delay(500);
    await addMsg("wysa", "Which ones?");
    await delay(600);
    // Multi-select rendered as special state
    updateFs({ slotSelectMode: true, selectedSlots: new Set() });
    setQuickReplies([{ type: "slotpicker" }]);
  };

  const uc1SlotsConfirmed = async (selected) => {
    setQuickReplies([]);
    updateFs({ slotSelectMode: false });
    if (selected.size === 0) {
      await addMsg("user", "Done");
      await delay(400);
      await addMsg("wysa", "Nothing selected — what do you actually need time for today?");
      await delay(600);
      setQuickReplies([
        { label: "I also have deadlines", action: () => uc1StartTriage() },
        { label: "It's a light-work day", action: () => uc1LightDay() }
      ]);
      return;
    }
    const sorted = SLOT_ORDER.filter(s => selected.has(s));
    await addMsg("user", `Protect ${sorted.join(" and ")}`);
    await delay(400);
    const noteLines = sorted.map(s => SLOT_NOTES[s]).join("\n\n");
    await addMsg("wysa", noteLines);
    setTyping(true);
    try {
      const btnReply = await callClaude(
        `You are Wysa for Teams. User protected slots: ${sorted.join(", ")}.
Generate exactly 3 button labels (max 6 words each):
1. Assign tasks to the protected slots
2. Decide later / figure it out
3. I also have deadlines
Return ONLY a JSON array of 3 strings.`,
        [{ role: "user", content: `Protected: ${sorted.join(", ")}` }]
      );
      setTyping(false);
      let btns;
      try { btns = JSON.parse(btnReply.trim().replace(/```json|```/g, "")); } catch { btns = ["Assign tasks to these slots", "I'll figure it out", "I also have deadlines"]; }
      updateFs({ protectedSlots: sorted });
      setQuickReplies([
        { label: btns[0], action: () => uc1AssignTasks(sorted) },
        { label: btns[1], action: () => uc1DecideLater() },
        { label: btns[2], action: () => uc1StartTriage() }
      ]);
    } catch {
      setTyping(false);
      updateFs({ protectedSlots: sorted });
      setQuickReplies([
        { label: "Assign tasks to these slots", action: () => uc1AssignTasks(sorted) },
        { label: "I'll figure it out", action: () => uc1DecideLater() },
        { label: "I also have deadlines", action: () => uc1StartTriage() }
      ]);
    }
  };

  const uc1AssignTasks = async (slots) => {
    setQuickReplies([]);
    await addMsg("user", "Assign tasks to these slots");
    updateFs({ assignMode: true, assignSlots: slots, assignIdx: 0, assignedTasks: [] });
    await delay(400);
    await addMsg("wysa", `What's going in ${slots[0]}?`);
  };

  const uc1HandleAssign = async (val) => {
    const { assignSlots, assignIdx, assignedTasks } = fsRef.current;
    const slot = assignSlots[assignIdx];
    await addMsg("user", val);
    const newTasks = [...(assignedTasks || []), val];
    updateFs({ assignedTasks: newTasks });
    await delay(400);
    await addMsg("wysa", `${slot} — locked in for: ${val}`);
    const nextIdx = assignIdx + 1;
    updateFs({ assignIdx: nextIdx });
    await delay(500);
    if (nextIdx < assignSlots.length) {
      await addMsg("wysa", `What's going in ${assignSlots[nextIdx]}?`);
    } else {
      updateFs({ assignMode: false });
      await addMsg("wysa", "All set — those slots are locked.");
      await delay(600);
      setQuickReplies([
        { label: "Good to go", action: () => uc1Close("Good to go") },
        { label: "I also have a deadline", action: () => uc1StartTriage() }
      ]);
    }
  };

  const uc1DecideLater = async () => {
    setQuickReplies([]);
    await addMsg("user", "I'll figure it out");
    await delay(500);
    await addMsg("wysa", "Slots are protected. I'll check in when each one is coming up so you're not caught off guard.");
    await delay(600);
    setQuickReplies([{ label: "Works for me", action: () => uc1Close("Works for me") }]);
  };

  const uc1LightDay = async () => {
    setQuickReplies([]);
    await addMsg("user", "It's a light-work day, I'll adjust");
    setTyping(true);
    try {
      const reply = await callClaude(
        `You are Wysa for Teams. Concise, collegial. User has a heavy meeting day and is calling it a light-work day — smart call. Calendar free slots: 10:00–11:00, 12:30–1:30, 4:30–5:00. Validate in one sentence. Ask what they want in the slots so nothing slips — one sentence. Max 2 sentences. No wellness language.`,
        [{ role: "user", content: "It's a light-work day, I'll adjust" }]
      );
      setTyping(false);
      await addMsg("wysa", reply);
      await delay(500);
      setQuickReplies([
        { label: "Async catchup — emails and reviews", action: async () => { setQuickReplies([]); await addMsg("user", "Async catchup — emails and reviews"); await delay(400); await addMsg("wysa", "Perfect use for fragmented time."); await delay(600); setQuickReplies([{ label: "All good", action: () => uc1Close("All good") }]); } },
        { label: "I'll just see how it goes", action: () => uc1DecideLater() }
      ]);
    } catch {
      setTyping(false);
      await addMsg("wysa", "Right call. Use the 60-min slots for async — messages, reviews. Save real work for tomorrow.");
      await delay(600);
      setQuickReplies([{ label: "Makes sense", action: () => uc1Close("Makes sense") }]);
    }
  };

  const uc1StartTriage = async () => {
    setQuickReplies([]);
    await addMsg("user", "I also have deadlines");
    await delay(500);
    await addMsg("wysa", "What are the deadlines, and roughly how much bandwidth will they consume?");
    updateFs({ triageMode: true, assignMode: false });
  };

  const uc1Triage = async (val) => {
    updateFs({ triageMode: false });
    await addMsg("user", val);
    setTyping(true);
    try {
      const reply = await callClaude(
        `You are Wysa for Teams. Brutally concise — max 2 lines.
Free slots: 10:00–11:00 (60 min), 12:30–1:30 (60 min), 4:30–5:00 (30 min).
User told you their deadline and how long it takes.
Line 1: fits or doesn't — if fits, exactly which slot. If not, say "doesn't fit today."
Line 2: one specific instruction. "Start at X, close everything else." or "Push it / split it."
Nothing else.`,
        [{ role: "user", content: val }]
      );
      setTyping(false);
      await addMsg("wysa", reply);
      await delay(500);
      setQuickReplies([
        { label: "Got it — I'll take that slot", action: () => uc1Close("Got it — I'll take that slot") },
        { label: "That doesn't work, I need to rethink", action: async () => { setQuickReplies([]); await addMsg("user", "That doesn't work, I need to rethink"); await delay(400); await addMsg("wysa", "What's the actual constraint — the deadline or the time?"); updateFs({ triageMode: true }); } }
      ]);
    } catch {
      setTyping(false);
      await addMsg("wysa", "Couldn't reach the server — try again.");
      updateFs({ triageMode: true });
    }
  };

  const uc1Close = async (userMsg) => {
    setQuickReplies([]);
    if (userMsg) await addMsg("user", userMsg);
    await delay(400);
    await addMsg("wysa", CLOSING_MSG);
  };

  // ── UC2 ────────────────────────────────────────────────────────────────────

  const initUC2 = useCallback(async () => {
    setQuickReplies([]);
    await addMsg("wysa", "You've had meetings stacked since 11am. If things are piling up, I can help cut through it in under 2 minutes.");
    await delay(1000);
    await addMsg("wysa", "Is it the back-to-back meetings, or something else?");
    await delay(400);
    setQuickReplies([
      { label: "The meetings have wrecked my head", action: () => uc2Reply("The meetings have wrecked my head") },
      { label: "Something else", action: async () => { setQuickReplies([]); await addMsg("user", "Something else"); await delay(500); await addMsg("wysa", "What's going on?"); updateFs({ uc2WaitInput: true }); } }
    ]);
  }, [addMsg]);

  const uc2Reply = async (userText) => {
    setQuickReplies([]);
    await addMsg("user", userText);
    const hist = [...(fsRef.current.uc2History || []), { role: "user", content: userText }];
    updateFs({ uc2History: hist, uc2WaitInput: false });
    const detectedTool = detectTool(userText);
    const step = fsRef.current.uc2Step || 0;
    const isDone = step >= 2;
    const toolCtx = detectedTool ? `\nTool available: "${detectedTool.name}" — mention it naturally if the conversation warrants it, don't force it.` : "";
    const toolsDesc = `Available Wysa tools (only suggest if genuinely relevant):
- "CBT to Beat Stress": user is mentally overloaded, can't think straight, head full, spiralling, or stuck in a loop with no clear task to point to
- "Planning a Difficult Conversation": user mentions needing to talk to someone, a manager, a colleague, or a conflict
- "Finding Your Strengths": user feels lost, questions their purpose, meaning drained from work
- "Progressive Relaxation": user mentions physical tension, wound up, can't wind down`;
    const system = isDone
      ? `You are Wysa for Teams. Look at this conversation and decide:
1. If the user has given you enough to identify a concrete next TASK — give that. 1–2 sentences, specific to what they said. User should feel they arrived at it themselves.
2. If the user has been vague, circular, or can't identify what's wrong after 2–3 exchanges — don't force a task. Instead acknowledge that plainly and suggest ONE of the tools below that fits their state. Say what it is in one sentence (not therapy, not meditation — a 4–5 min reset). Name it exactly.
${toolsDesc}
No bullet points. No wellness language. Max 2 sentences.${toolCtx}`
      : `You are Wysa for Teams — sharp colleague, not a coach. Calendar: ${CAL.dayType}.
Your job: figure out what's blocking the user and either (a) get them to one clear next action, or (b) recognise early that this is a STATE problem not a TASK problem and offer a tool.

Available tools — offer one immediately if the signal is clear, don't wait:
- "CBT to Beat Stress": head full, spiralling, can't think, vague overwhelm with no task to point to, "I don't know", "just everything"
- "Planning a Difficult Conversation": needs to talk to someone, manager, conflict, awkward situation
- "Finding Your Strengths": lost, no meaning, questions purpose
- "Progressive Relaxation": physical tension, wound up, can't switch off

If a tool fits clearly based on what they've said — say so in one sentence and name it exactly. Don't ask another question.
If no tool fits yet — acknowledge what they said in one sharp sentence, then ask ONE focused question. Reference what they actually said.

Strict rules:
- MAX 2 sentences total. Never more.
- No paragraphs. No lists. No wellness language.
- Make them feel like they're doing the thinking.

Return JSON: {"msg":"your 1–2 sentence response","options":["short option 1","short option 2"]} if your question has clear options.
Return JSON: {"msg":"your response","options":[]} if free-text or you're offering a tool.
ALWAYS return valid JSON. Nothing else.`;
    setTyping(true);
    try {
      const raw = await callClaude(system, hist.map(h => ({ role: h.role, content: h.content })));
      let replyText, inlineOptions = [];
      if (!isDone) {
        try {
          const parsed = JSON.parse(raw.trim().replace(/```json|```/g, ""));
          replyText = parsed.msg || raw;
          inlineOptions = parsed.options || [];
        } catch { replyText = raw; inlineOptions = []; }
      } else { replyText = raw; }
      const newHist = [...hist, { role: "assistant", content: replyText }];
      updateFs({ uc2History: newHist, uc2Step: step + 1 });
      const mentionedTool = isDone
        ? WYSA_TOOLS.find(t => replyText.toLowerCase().includes(t.name.toLowerCase()))
        : null;
      const toolToOffer = mentionedTool || (detectedTool && (replyText.toLowerCase().includes(detectedTool.name.split(" ")[0].toLowerCase()) || replyText.toLowerCase().includes("reset") || replyText.toLowerCase().includes("toolkit")) ? detectedTool : null);
      setTyping(false);
      await addMsg("wysa", replyText, toolToOffer ? { widget: toolToOffer } : {});
      if (!isDone && inlineOptions.length > 0) {
        setQuickReplies(inlineOptions.map(opt => ({ label: opt, action: () => uc2Reply(opt) })));
      } else {
        await uc2GenButtons(newHist, toolToOffer);
      }
    } catch {
      setTyping(false);
      await addMsg("wysa", "Something went wrong — type what's on your mind.");
      updateFs({ uc2WaitInput: true });
    }
  };

  const uc2GenButtons = async (hist, detectedTool) => {
    try {
      const history = hist.map(h => `${h.role === "user" ? "User" : "Bot"}: ${h.content}`).join("\n");
      const lastBot = hist.filter(h => h.role === "assistant").slice(-1)[0]?.content || "";
      const toolHint = detectedTool ? `One button may offer "${detectedTool.name}" — only if conversation warrants it.` : "";
      const prompt = `Conversation:\n${history}\n\nLast bot message: "${lastBot}"\n\nDecide: does this message need quick-reply buttons or should user type?\n- Open question needing typed answer → return []\n- Concrete suggestion or resolved conversation → return 2–3 specific buttons\n- Buttons must fit THIS conversation specifically, not be generic\n- Never use "That helps, I know what to do" or "I'll get to this later" as defaults\n- ${toolHint}\n- Max 7 words per button\nReturn ONLY a JSON array (can be empty). No explanation.`;
      const btnReply = await callClaude("You decide if a chat message needs quick-reply buttons. Be precise and context-aware.", [{ role: "user", content: prompt }]);
      let btns;
      try { btns = JSON.parse(btnReply.trim().replace(/```json|```/g, "")); } catch { btns = null; }
      if (!btns || !Array.isArray(btns) || btns.length === 0) { updateFs({ uc2WaitInput: true }); setQuickReplies([]); return; }
      setQuickReplies(btns.map(label => ({ label, action: () => uc2HandleBtn(label, detectedTool) })));
    } catch {
      updateFs({ uc2WaitInput: true });
      setQuickReplies([]);
    }
  };

  const uc2HandleBtn = async (label, detectedTool) => {
    setQuickReplies([]);
    if (detectedTool && label.toLowerCase().includes(detectedTool.name.split(" ")[0].toLowerCase())) {
      await addMsg("user", label);
      await uc2OpenTool(detectedTool);
      return;
    }
    const isClosing = /good now|satisfied|know what to do|on it now|makes sense|all good/i.test(label);
    const isDefer = /\blater\b|after my|not now|when it comes/i.test(label);
    if (isClosing) { await addMsg("user", label); await delay(400); await addMsg("wysa", CLOSING_MSG); return; }
    if (isDefer) { await addMsg("user", label); await delay(400); await addMsg("wysa", "Saved. I'll bring it back before you close out — don't carry it home."); return; }
    await uc2Reply(label);
  };

  const uc2OpenTool = async (tool) => {
    await addMsg("wysa", `4–5 minutes. Come back after — I'll check in on how it went.`, { widget: tool });
    await delay(600);
    setQuickReplies([
      { label: "Done — back from the tool", action: async () => { setQuickReplies([]); await addMsg("user", "Done — back from the tool"); await delay(400); await addMsg("wysa", CLOSING_MSG); } },
      { label: "I'll try it later", action: async () => { setQuickReplies([]); await addMsg("user", "I'll try it later"); await delay(400); await addMsg("wysa", "No worries. I'll bring it back when you have a moment."); } }
    ]);
  };

  // ── INPUT SEND ──────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const val = inputVal.trim();
    if (!val) return;
    setInputVal("");
    if (uc === "uc1") {
      if (fsRef.current.assignMode) { await uc1HandleAssign(val); }
      else if (fsRef.current.triageMode) { await uc1Triage(val); }
    } else if (uc === "uc2") {
      updateFs({ uc2WaitInput: false });
      await uc2Reply(val);
    }
  };

  // ── SLOT PICKER COMPONENT ──────────────────────────────────────────────────

  const SlotPicker = () => {
    const [sel, setSel] = useState(new Set());
    const toggle = (slot) => setSel(prev => { const n = new Set(prev); n.has(slot) ? n.delete(slot) : n.add(slot); return n; });
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 16px", borderTop: "1px solid #f0f0f0", alignItems: "center" }}>
        {SLOT_ORDER.map(slot => (
          <button key={slot} onClick={() => toggle(slot)}
            style={{ background: sel.has(slot) ? PURPLE : "#fff", border: `1px solid ${PURPLE}`, color: sel.has(slot) ? "#fff" : PURPLE, borderRadius: 20, padding: "5px 13px", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>
            {slot}
          </button>
        ))}
        <button onClick={() => uc1SlotsConfirmed(sel)}
          style={{ background: "#fff", border: "1px solid #237B4B", color: "#237B4B", borderRadius: 20, padding: "5px 13px", fontSize: 12, cursor: "pointer" }}>
          Done
        </button>
      </div>
    );
  };

  // ── SCREEN: LANDING ────────────────────────────────────────────────────────

  if (screen === "landing") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", padding: 20, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 780, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "40px 32px", minHeight: 440 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: PURPLE, letterSpacing: 1, textTransform: "uppercase" }}>Wysa for Teams</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 520 }}>
          {[{ id: "uc1", label: "Morning check-in" }, { id: "uc2", label: "I'm overwhelmed" }].map(c => (
            <div key={c.id} onClick={() => { setUc(c.id); setScreen("teams"); }} style={{ flex: 1, minWidth: 200, border: "1.5px solid #e0e0e0", borderRadius: 10, padding: "20px 16px", cursor: "pointer", background: "#fff", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = PURPLE} onMouseLeave={e => e.currentTarget.style.borderColor = "#e0e0e0"}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: PURPLE, borderRadius: 4, padding: "2px 8px", display: "inline-block", marginBottom: 10, letterSpacing: "0.3px" }}>{c.id.toUpperCase()}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── SCREEN: TEAMS NOTIF ────────────────────────────────────────────────────

  if (screen === "teams") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", padding: 20, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 780, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
        <TeamsTop activeTab="Teams" />
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ width: 200, background: "#f3f2f1", borderRight: "1px solid #e0e0e0", padding: "12px 0", flexShrink: 0 }}>
            {["Apps", "Bots"].map(sec => (
              <div key={sec}>
                <div style={{ fontSize: 10, color: "#888", padding: "8px 16px 4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px" }}>{sec}</div>
                {sec === "Apps" ? ["General", "Announcements"].map(i => <div key={i} style={{ padding: "7px 16px", fontSize: 13, color: "#555" }}>{i}</div>)
                  : <div style={{ padding: "7px 16px", fontSize: 13, color: "#1a1a1a", fontWeight: 600, background: "#e0dede", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, background: PURPLE, borderRadius: "50%", animation: "pulse 2s infinite" }} />
                    Wysa for Teams
                  </div>}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", position: "relative", minHeight: 420 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, color: "#aaa" }}>Your workspace</span>
            </div>
            <div onClick={() => { setScreen("chat"); setMessages([]); setQuickReplies([]); updateFs({ triageMode: false, assignMode: false, uc2History: [], uc2Step: 0, uc2WaitInput: false, slotSelectMode: false }); setTimeout(() => uc === "uc1" ? initUC1() : initUC2(), 100); }}
              style={{ position: "absolute", bottom: 20, right: 20, width: 300, background: "#fff", border: "1px solid #ddd", borderLeft: `3px solid ${PURPLE}`, borderRadius: 10, padding: 14, cursor: "pointer", boxShadow: "0 2px 16px rgba(0,0,0,0.1)", animation: "slideIn 0.4s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 26, height: 26, background: PURPLE, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 600 }}>W</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>Wysa for Teams</span>
                <span style={{ fontSize: 11, color: "#aaa", marginLeft: "auto" }}>now</span>
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>{notifText}</div>
              <div style={{ fontSize: 11, color: PURPLE, marginTop: 8, fontWeight: 500 }}>Click to open →</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );

  // ── SCREEN: CHAT ───────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f0f0", padding: 20, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 780, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", minHeight: 520 }}>
        <TeamsTop activeTab="Chat" />
        <div style={{ fontSize: 12, color: PURPLE, cursor: "pointer", padding: "8px 16px", borderBottom: "1px solid #eee", background: "#fafafa" }} onClick={() => { setScreen("landing"); setMessages([]); setQuickReplies([]); }}>← back to prototype picker</div>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, background: PURPLE, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 600 }}>W</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>Wysa for Teams</div>
            <div style={{ fontSize: 11, color: "#aaa" }}>Bot · always active</div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, maxHeight: 350, minHeight: 260 }}>
          {messages.map(m => <Message key={m.id} msg={m} />)}
          {typing && <TypingDots />}
          <div ref={msgsEndRef} />
        </div>
        {quickReplies.length > 0 && quickReplies[0]?.type === "slotpicker"
          ? <SlotPicker />
          : quickReplies.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 16px", borderTop: "1px solid #f0f0f0", alignItems: "center" }}>
              {quickReplies.map((qr, i) => <QRButton key={i} label={qr.label} onClick={qr.action} />)}
            </div>
          )}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #eee", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <input value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Type a message..." style={{ flex: 1, padding: "8px 14px", borderRadius: 20, border: "1px solid #ddd", fontSize: 13, background: "#fafafa", color: "#1a1a1a", outline: "none", fontFamily: "inherit" }} />
          <button onClick={handleSend} style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>›</button>
        </div>
      </div>
      <style>{`@keyframes tdot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}`}</style>
    </div>
  );
}
