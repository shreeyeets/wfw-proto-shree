# Wysa for Teams — TODO

## 🔴 Critical / Before Sharing

- [ ] **Add error boundary / try-catch to API route** — currently `route.ts` has no error handling; a bad key or OpenAI outage will surface a raw 500. Wrap in try/catch and return `{ error: "..." }` with a 500 status.
- [ ] **Remove all hardcoded calendar data** — `SLOT_ORDER`, `SLOT_NOTES`, `InsightCard`, and notif text are all hardcoded for a specific day pattern (5 meetings, back-to-back meetings at 11, 3pm, free slots at 10/12:30/4:30). This needs to either be config-driven or pulled from a calendar API.
- [ ] **Add `.env.local` to `.gitignore`** — confirm before pushing; `.env.local.example` is present but verify actual `.env.local` is excluded.
- [ ] **Rate limiting on `/api/chat`** — anyone with the URL can hammer OpenAI at your cost. Add basic IP-based rate limiting (e.g. `upstash/ratelimit` or a simple in-memory counter).

---

## 🟡 Product / UX

- [ ] **UC1: Make the "I also have deadlines" flow re-entrant** — currently if a user hits triage → "that doesn't work" → re-enter deadlines, the flow works but the escape paths aren't clean. Needs testing.
- [ ] **UC2: Tool surfacing is brittle** — `detectTool()` keyword matches on user input, but the AI can also name a tool. The merge logic in `uc2Reply` is complex and could misfire. Consider a single source of truth (trust the AI's JSON, not keyword matching).
- [ ] **UC1 & UC2: Add a "restart" button** — users testing the prototype can only go back via "← back to prototype picker" which resets everything. A restart-within-flow option would be useful for demos.
- [ ] **Typing indicator delays feel off** — some `delay()` calls in UC1 are hardcoded (400ms, 500ms, 700ms) independently of content length. Proportional delay (based on word count) would feel more natural.
- [ ] **UC2: Long conversations don't resolve gracefully** — if the AI keeps asking questions past step 2, the resolution prompt kicks in but may feel abrupt. Add a soft transition message before switching prompts.
- [ ] **Slot notes are opinionated** — e.g. `"4:30–5:00 — tight 30 min. Wrap up loose ends only, don't start anything new."` This is Wysa's opinion injected without asking. Review whether this framing fits the product voice.

---

## 🟢 Features (Backlog / Next Use Cases)

- [ ] **UC3: Team Trend digest (Manager view)** — weekly digest showing team-level patterns. Defined in PRD but not started. Requires aggregation layer.
- [ ] **UC4: Anonymous Signal** — employee flags a systemic issue anonymously; aggregates if ≥3 similar signals. Requires a backend data store.
- [ ] **UC5: Org Pattern View (HR/Leadership)** — cross-team aggregates. Downstream of UC3/UC4.
- [ ] **Calendar integration** — explicitly listed as future in PRD: auto-detect meeting load from Google Calendar / MS Graph API. Would replace the current hardcoded `CALENDAR` object in `lib/prompts.ts`.
- [ ] **Configurable trigger times** — UC1 is supposed to be configurable (morning or post-lunch). Currently always morning context.
- [ ] **Persistent user state** — currently all state is in-memory / per-session. For a real product, check-in history needs persistence (DB + auth).
- [ ] **Manager dashboard tab (MS Teams Tab)** — PRD calls for a tab-based dashboard for managers. Not started.
- [ ] **Slack variant** — PRD specifies a Slack-specific variant with Block Kit and conversational tone. Not started.

---

## 🔵 Code Quality / Tech Debt

- [ ] **`app/page.tsx` is 650 lines** — all screens, components, and flow logic are in one file. Extract components to `components/` and flow handlers to separate files (e.g. `lib/uc1.ts`, `lib/uc2.ts`).
- [ ] **`WysaTeams.jsx` is stale** — the original single-file prototype still lives in the root. Now that the Next.js port is done, archive or delete it to avoid confusion.
- [ ] **Inline styles throughout** — everything is styled with inline `style={{}}` objects. Migrate to Tailwind classes (already installed) or CSS modules for maintainability.
- [ ] **`useCallback` dependency arrays aren't fully correct** — `initUC1` and `initUC2` have `// eslint-disable-line react-hooks/exhaustive-deps` comments, meaning the dependency arrays are incorrect. Fix to avoid stale closure bugs.
- [ ] **No loading state on the landing screen** — if a user picks UC1/UC2 and the first AI call is slow, there's no feedback during the init. Add a loading state.
- [ ] **`callAI` has no timeout** — a hung OpenAI request will hang the UI indefinitely. Add `AbortController` with a timeout (e.g. 10s).
- [ ] **TypeScript: `setFsState` is unused in renders** — `fsState` is never read (only `fsRef` is), so `const [, setFsState]` is only used to trigger re-renders. This is a known pattern but worth a comment explaining why.
- [ ] **No tests** — zero test coverage. At minimum, add unit tests for `detectTool()` and the prompt builder functions in `lib/prompts.ts`.

---

## 🔸 Before a Real Deployment

- [ ] Replace `dev-widget.wysa.io` tool URLs with production equivalents
- [ ] Add proper authentication (Teams SSO / OAuth)
- [ ] Implement actual calendar data ingestion (MS Graph API)
- [ ] Swap hardcoded user initial `'S'` in `Avatar` to real user data
- [ ] Privacy review — confirm no user input is logged or retained server-side
- [ ] Set response size limits on the API route (currently accepts any `max_tokens`)
