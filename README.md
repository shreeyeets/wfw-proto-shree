# Wysa for Teams — Prototype

A Next.js + OpenAI prototype that simulates **Wysa for Teams** — a performance-focused AI bot embedded in Microsoft Teams. The app demos two employee-facing use cases through a realistic Teams chat UI.

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # add your OPENAI_API_KEY
npm run dev                         # http://localhost:3000
```

Deploy: push to GitHub → import in Vercel → add `OPENAI_API_KEY` in environment variables.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Inline styles (MS Teams palette: `#6264A7`) |
| AI | OpenAI `gpt-4o-mini` via server-side API route |
| Deploy target | Vercel |

---

## File Map — Where Everything Lives

```
app/
  page.tsx              ← ALL screens + ALL conversation flow logic (UC1 & UC2)
  api/chat/route.ts     ← Server-side OpenAI proxy (key never reaches browser)
  layout.tsx            ← Root HTML layout + page metadata
  globals.css           ← Minimal global CSS reset

lib/
  prompts.json          ← ALL LLM prompt text (edit here to change AI behaviour)
  prompts.ts            ← Thin adapter — fills {{tokens}}, exports functions for page.tsx

WysaTeams.jsx           ← STALE original prototype (calls Anthropic directly, archived)
jo_prd.md               ← Full Product Requirements Document
thesis.txt              ← Founder thinking / product framing canvas
```

**Edit prompts → `lib/prompts.json`**  
**Edit conversation flow/branching → `app/page.tsx`**  
**Edit model or token settings → `app/api/chat/route.ts`**

---

## Architecture

### API Security
All AI calls are server-side. The browser never touches OpenAI directly:
```
Browser → POST /api/chat { system, messages }
             ↓
     app/api/chat/route.ts (server)
             ↓
         OpenAI API (key stays server-side)
             ↓
     { content: "..." } → browser
```
`OPENAI_API_KEY` is set in `.env.local` (never prefixed with `NEXT_PUBLIC_`, so Next.js never bundles it to the client).

### Screen State Machine
The entire app is one React component (`app/page.tsx`) with a `screen` state variable:
```
'landing' → 'teams' → 'chat'
```
- **`landing`**: Prototype picker — choose UC1 or UC2
- **`teams`**: Fake MS Teams UI with a Wysa notification toast (click to enter chat)
- **`chat`**: Full conversation UI — messages, typing dots, quick-reply buttons, slot picker, text input

---

## Conversation Flows

### UC1 — Morning Check-In

Triggered as a morning notification. Wysa opens with a **calendar insight card** (hardcoded: 5 meetings, back-to-back meetings at 11–12:30 and 3–4:30, 3 free slots) and presents 3 quick-reply branches.

#### Branch A: "Protect the slots"
```
Wysa: "Which ones?" 
→ SlotPicker UI (multi-select: 10:00–11:00 | 12:30–1:30 | 4:30–5:00)
→ User confirms selection
→ Wysa shows context note for each slot (from SLOT_NOTES)
→ [AI CALL] uc1ProtectSlotsSystem(slots) → generates 3 custom button labels
→ Button 1: "Assign tasks" → uc1AssignTasks
   → Wysa asks "What's going in [slot]?" for each selected slot
   → User types task per slot (free text, handled by assignMode in handleSend)
   → After all filled: "All set — those slots are locked."
   → Quick replies: "Good to go" | "I also have a deadline"
→ Button 2: "Decide later" → uc1DecideLater → CLOSING_MSG
→ Button 3: "I have a deadline" → Branch C
```

#### Branch B: "Light-work day"
```
→ [AI CALL] UC1_LIGHT_DAY_SYSTEM → Wysa validates in ≤2 sentences
→ Quick replies: "Async catchup" | "I'll just see how it goes"
→ Both paths end at CLOSING_MSG
```

#### Branch C: "I also have deadlines"
```
→ Wysa: "What are the deadlines, and roughly how much bandwidth will they consume?"
→ User types (free text, handled by triageMode in handleSend)
→ [AI CALL] UC1_TRIAGE_SYSTEM → Wysa responds in exactly 2 lines:
     Line 1: fits a slot or doesn't
     Line 2: one specific instruction
→ Quick replies: "Got it — I'll take that slot" | "That doesn't work, I need to rethink"
   → Rethink: re-enters triage with follow-up question
→ Accepting → CLOSING_MSG
```

**After UC1 flow ends**: if user types free text with no active mode, Wysa responds: *"The check-in is wrapped up for now. Come back if something else comes up."*

---

### UC2 — In-Moment Overwhelm

An iterative LLM conversation loop. No fixed branches — the AI drives the conversation.

#### Opening
```
Wysa: "You've had meetings stacked since 11am. If things are piling up..."
Wysa: "Is it the back-to-back meetings, or something else?"
Quick replies: "The meetings have wrecked my head" | "Something else"
```

#### The Loop (uc2Step 0 and 1)
Each user message → `uc2Reply()`:
```
1. Append user message to uc2History
2. detectTool(userText) — keyword match for early tool detection
3. [AI CALL] uc2StepSystem() prompt:
   - Role: "sharp colleague, not a coach"
   - Has calendar context (day type)
   - Must return JSON: { msg: "...", options: ["...", "..."] }
   - If options present → render as quick-reply buttons
   - If no options → user types (uc2WaitInput = true)
4. [AI CALL] uc2GenButtons() — second call to generate context-specific
   button options based on the full conversation history
5. Step counter increments
```

#### Resolution (uc2Step ≥ 2)
```
Same flow but switches to uc2ResolutionSystem() prompt:
- Decides: concrete next task OR surface a Wysa tool
- Returns plain text (not JSON)
- If a tool is named → render inline "Open: [Tool] →" button
```

#### Wysa Tool Surfacing (both steps)
Two parallel detection mechanisms:
1. **Keyword detection** (`detectTool`): matches user input against trigger words → passes tool as context to AI
2. **AI mention**: AI explicitly names a tool → `WYSA_TOOLS.find()` match in response text

When a tool is surfaced:
```
Wysa: "[response]" + [Open: Tool Name →] button (links to dev-widget.wysa.io)
Quick replies: "Done — back from the tool" | "I'll try it later"
```

#### Button classification
After each AI response, `uc2HandleBtn()` classifies quick-reply clicks:
- Tool name detected in label → `uc2OpenTool()`
- Matches `/good now|satisfied|know what to do.../` → closing message
- Matches `/later|not now.../` → defer message ("I'll bring it back...")
- Otherwise → loop continues via `uc2Reply()`

---

## Key Constants and Data

### Hardcoded Calendar Data (UC1)
```typescript
SLOT_ORDER = ['10:00–11:00', '12:30–1:30', '4:30–5:00']
SLOT_NOTES = { per slot: contextual commentary shown after selection, e.g. "4:30–5:00 — tight 30 min. Wrap up loose ends only, don't start anything new." }
// Also in prompts.json: calendar.dayType (injected into UC2 step prompt)
```

### Wysa Tools (4 tools, all point to same dev widget for now)
```typescript
WYSA_TOOLS = [
  { name: 'CBT to Beat Stress',               triggers: ['stressed', 'anxious', ...] },
  { name: 'Planning a Difficult Conversation', triggers: ['conversation', 'manager', ...] },
  { name: 'Finding Your Strengths',            triggers: ['meaning', 'lost', 'purpose', ...] },
  { name: 'Progressive Relaxation',           triggers: ['tense', 'tight', 'wound up', ...] },
]
```

### Flow State (`fsRef` / `fsState`)
`fsRef` is a mutable ref for synchronous reads inside async handlers; `fsState` triggers re-renders. Both are updated together via `updateFs()`.

| Key | Used in | Meaning |
|-----|---------|---------|
| `assignMode` | UC1 | Actively assigning tasks to slots |
| `assignSlots` | UC1 | Array of selected slot strings |
| `assignIdx` | UC1 | Which slot we're currently asking about |
| `assignedTasks` | UC1 | Tasks collected so far |
| `triageMode` | UC1 | Awaiting deadline + duration from user |
| `slotSelectMode` | UC1 | Slot picker is showing |
| `protectedSlots` | UC1 | Slots confirmed by user |
| `uc2History` | UC2 | Full conversation history for LLM |
| `uc2Step` | UC2 | Step counter (≥2 → resolution prompt) |
| `uc2WaitInput` | UC2 | Whether free-text input is expected |

### `handleSend` — how typed input is routed
```typescript
UC1 + assignMode  → uc1HandleAssign(val)   // slot task assignment
UC1 + triageMode  → uc1Triage(val)         // deadline input
UC1 + no mode     → friendly fallback msg  // post-flow free text
UC2               → uc2Reply(val)          // always goes to LLM
```

---

## Prompts (`lib/prompts.json`)

All text the LLM sees. Edit values freely — do not rename keys (code references them). Use `{{token}}` for runtime substitution.

| Key | Used when | Dynamic tokens |
|-----|-----------|----------------|
| `uc1.protect_slots_system` | After slot selection | `{{slots}}` |
| `uc1.light_day_system` | User picks light day | — |
| `uc1.triage_system` | User inputs deadline | — |
| `uc2.step_system` | Each UC2 step (0 and 1) | `{{dayType}}` |
| `uc2.resolution_system` | UC2 step ≥ 2 | `{{toolsDesc}}`, `{{toolCtx}}` |
| `uc2.buttons_system` | Button generation call | — |
| `uc2.buttons_user_prompt` | Button generation (user msg) | `{{history}}`, `{{lastBot}}`, `{{toolHint}}` |
| `calendar.dayType` | Injected into UC2 step prompt | — |
| `wysa_tools_description` | Injected into resolution prompt | — |

---

## Product Rules (Non-negotiable, from `jo_prd.md`)

- Individual data is **never** exposed to managers
- Manager view requires **≥ 5 active users** threshold
- Every insight must include **exactly one** recommended action
- Language frames issues as **work patterns**, never personal failure
- Employee interactions must complete in **≤ 60 seconds**
- No diagnostic labels, no wellness language

---

## What's Not Built Yet

| Feature | Status |
|---------|--------|
| UC3: Manager team trend digest | Not started |
| UC4: Anonymous signal (≥3 aggregates) | Not started |
| UC5: Org pattern view (HR/Leadership) | Not started |
| Calendar integration (MS Graph / Google) | Not started — all data hardcoded |
| Auth / user identity | Not started — avatar hardcoded to "S" |
| Data persistence | Not started — every session starts fresh |
| Production tool URLs | All 4 tools link to same Accenture dev widget |
| Rate limiting on `/api/chat` | Not implemented |

---

## Common Edit Scenarios

| Want to... | Edit |
|-----------|------|
| Change AI tone / instructions | `lib/prompts.json` → relevant prompt key |
| Change the hardcoded calendar | `lib/prompts.json` → `calendar.dayType` + `app/page.tsx` → `SLOT_NOTES`, `InsightCard` |
| Add a Wysa tool | `app/page.tsx` → `WYSA_TOOLS` array |
| Change LLM model or token limit | `app/api/chat/route.ts` |
| Add a new UC flow | `app/page.tsx` → add handler functions + wire into `handleSend` and landing screen |
| Change notification text | `app/page.tsx` → `notifText` |
