# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React prototype for **Wysa for Teams** — a performance-focused chatbot embedded in Microsoft Teams. The prototype demos two use cases (UC1: morning check-in, UC2: in-moment overwhelm support) via a simulated Teams UI.

The current state is a single self-contained file (`WysaTeams.jsx`) intended to be ported into a Next.js app. See `setup.txt` for the migration plan.

## Planned Next.js stack

```
npx create-next-app@latest wysa-teams-proto --typescript --tailwind --app
```

- **Backend**: `app/api/chat/route.ts` — accepts `{ system, messages }`, calls OpenAI (`gpt-4o-mini`, `max_tokens: 1000`), returns `{ content: string }`
- **Frontend**: `WysaTeams.jsx` ported into `app/page.tsx`, with all `callClaude()` calls replaced by `fetch('/api/chat', ...)`
- **Prompts**: System prompt strings should be extracted to `lib/prompts.ts` — they are currently inline inside UC1/UC2 handler functions
- **Env**: `OPENAI_API_KEY` in `.env.local` (never exposed client-side — all AI calls go through the API route)
- **Deploy**: Vercel, with `OPENAI_API_KEY` set in project environment variables

## WysaTeams.jsx architecture

The component is a state machine with three screens (`landing → teams → chat`) and two conversation flows:

**Screens**
- `landing`: Prototype picker — choose UC1 or UC2
- `teams`: Simulated Teams notification UI, click to open chat
- `chat`: Full conversation interface with quick-reply buttons, slot picker, typing indicator

**Conversation flows**

- **UC1** (morning check-in): Branching flow — user chooses to protect calendar slots, assign tasks to them, triage a deadline, or acknowledge a light-work day. Calls Claude once (for button label generation after slot selection) and once per triage input.
- **UC2** (overwhelm): Iterative LLM loop — each user message goes to Claude with the full conversation history. After 2 exchanges (`uc2Step >= 2`), switches to a "resolution" system prompt that either gives a concrete next action or surfaces a Wysa tool. A second Claude call (`uc2GenButtons`) generates context-aware quick-reply buttons.

**Key state**

- `screen`, `uc`: top-level navigation state
- `messages`: rendered chat history
- `quickReplies`: current button options (or `[{type:"slotpicker"}]` for the slot multi-select)
- `fsRef` / `fsState`: mutable flow state (e.g. `assignMode`, `triageMode`, `uc2History`, `uc2Step`) — `fsRef` is used for synchronous reads inside async handlers; `fsState` triggers re-renders

**Wysa tool detection**

`detectTool(text)` keyword-matches user input against `WYSA_TOOLS` (CBT, Difficult Conversation, Strengths, Relaxation). If matched, the tool URL is surfaced as a button in the chat message via the `widget` prop on `Message`.

**Important rules embedded in the product (from `jo_prd.md`)**
- Individual data never exposed to managers; manager view requires ≥5 active users
- Every insight must include exactly one recommended action
- Language must frame issues as work patterns, never personal failure
- Employee interactions must complete in ≤60 seconds
