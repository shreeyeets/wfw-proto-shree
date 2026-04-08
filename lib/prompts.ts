/**
 * Thin adapter over prompts.json.
 * All prompt text lives in prompts.json — edit there, not here.
 * This file only handles {{token}} substitution and re-exports the same
 * function signatures that app/page.tsx already imports.
 */
import data from './prompts.json';

/** Replace all {{token}} occurrences in a template string. */
function fill(template: string, vars: Record<string, string> = {}): string {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, val),
    template,
  );
}

// ── Shared ─────────────────────────────────────────────────────────────────

export const CALENDAR = data.calendar;

// ── UC1 ────────────────────────────────────────────────────────────────────

export function uc1ProtectSlotsSystem(slots: string[]): string {
  return fill(data.uc1.protect_slots_system, { slots: slots.join(', ') });
}

export const UC1_LIGHT_DAY_SYSTEM = data.uc1.light_day_system;
export const UC1_LIGHT_DAY_TASKS_SYSTEM = data.uc1.light_day_tasks_system;

export function uc1LightDayTasksPrompt(tasks: string): string {
  return fill(data.uc1.light_day_tasks_system, { tasks });
}

export const UC1_TRIAGE_SYSTEM = data.uc1.triage_system;
export const UC1_CLOSE_SYSTEM = data.uc1.close_system;

export function uc1ProtectConfirmSystem(slots: string[]): string {
  return fill(data.uc1.protect_confirm_system, { slots: slots.join(', ') });
}

export function uc1AssignConfirmSystem(tasks: string[], slots: string[]): string {
  return fill(data.uc1.assign_confirm_system, {
    tasks: tasks.join(', '),
    slots: slots.join(', '),
  });
}

// ── UC2 ────────────────────────────────────────────────────────────────────

export function uc2StepSystem(): string {
  return fill(data.uc2.step_system, { dayType: data.calendar.dayType });
}

export function uc2ResolutionSystem(toolCtx: string): string {
  return fill(data.uc2.resolution_system, {
    toolsDesc: data.wysa_tools_description,
    toolCtx,
  });
}

export const UC2_BUTTONS_SYSTEM = data.uc2.buttons_system;
export const UC2_TOOL_EXPLAIN_SYSTEM = data.uc2.tool_explain_system;

export function uc2ButtonsUserPrompt(
  history: string,
  lastBot: string,
  toolHint: string,
): string {
  return fill(data.uc2.buttons_user_prompt, { history, lastBot, toolHint });
}

export function uc2ToolExplainPrompt(toolName: string, history: string): string {
  return fill(data.uc2.tool_explain_system, { toolName, history });
}

export const UC2_DEFER_TOOL_SYSTEM = data.uc2.defer_tool_system;

// ── NEW ────────────────────────────────────────────────────────────────────

export const CALENDAR_EVENT_TITLE_SYSTEM = data.calendar_event_title_system;
export const UC1_ASSIGN_TASK_REFRAME_SYSTEM = data.assign_task_reframe_system;

export function calendarEventTitleSystem(task: string): string {
  return fill(data.calendar_event_title_system, { task });
}

export function uc1AssignTaskReframeSystem(task: string, duration: number): string {
  return fill(data.assign_task_reframe_system, { task, duration: String(duration) });
}

// ── UC3 ────────────────────────────────────────────────────────────────────

const uc3 = (data as Record<string, any>).uc3;

/** Main conversational system prompt — injected with live team context. */
export function uc3TeamQuerySystem(
  manager: string,
  week: string,
  teamSummary: string,
  anonymousSignals: string,
): string {
  return fill(uc3.team_query_system, { manager, week, teamSummary, anonymousSignals });
}

/** One-sentence opening hook — used for the bot's first text after the summary card. */
export function uc3TeamSummarySystem(teamSummary: string): string {
  return fill(uc3.team_summary_system, { teamSummary });
}

/** System prompt for the button-generation LLM call. */
export const UC3_BUTTONS_SYSTEM: string = uc3.buttons_system;

/** User payload for the button-generation call — fills {{history}} and {{lastBot}}. */
export function uc3ButtonsUserPrompt(history: string, lastBot: string): string {
  return fill(uc3.buttons_user_prompt, { history, lastBot });
}

/** LLM-generated fix suggestion — injected with team summary data. */
export function uc3FixOfferSystem(teamSummary: string): string {
  return fill(uc3.fix_offer_system, { teamSummary });
}

// ── UC_HUB ─────────────────────────────────────────────────────────────────

const ucHubData = (data as Record<string, any>).uc_hub;

// Valid resource keys the LLM may return — kept here so the format injection
// and the page's HUB_RESOURCES object stay in sync without a separate config file.
const HUB_RESOURCE_KEYS_LIST =
  'wysa, rethink_care_coaching, rethink_care_parenting, rethink_care_neuro, nudge, ' +
  'calm_mindfulness, sober_sidekick, uptime, mental_health_ally, eap, in_app_self_care';

/**
 * Hub main system prompt.
 * Wraps hub_system from prompts.json and appends a strict JSON output format
 * that adds `care_type` and enumerates valid resource keys.
 */
export function ucHubSystem(): string {
  const base: string = ucHubData.hub_system;
  return (
    base +
    `\n\nCRITICAL — override the output format above. Return ONLY this JSON:\n` +
    `{"msg":"your sentence","care_type":"NA","specific_resource_redirected":"NA","specific_resource_handoff":false}\n` +
    `With a resource: {"msg":"your response","care_type":"specific_resource","specific_resource_redirected":"resource_key","specific_resource_handoff":false}\n` +
    `For crisis: {"msg":"your response","care_type":"crisis","specific_resource_redirected":"eap","specific_resource_handoff":true}\n` +
    `Valid resource keys (exact): ${HUB_RESOURCE_KEYS_LIST}\n` +
    `Set care_type to "crisis" ONLY for suicidal ideation, self-harm, or acute safety risk.\n` +
    `specific_resource_redirected is NA for all regular conversational turns.`
  );
}

/** Static system prompt for Hub button generation. */
export const UC_HUB_BUTTONS_SYSTEM: string = ucHubData.buttons_system;

/** User payload for the Hub button-generation call. */
export function ucHubButtonsUserPrompt(history: string, lastBot: string): string {
  return fill(ucHubData.buttons_user_prompt, { history, lastBot });
}

/** Post-tool follow-up system prompt. */
export function ucHubToolFollowupSystem(toolName: string): string {
  return fill(ucHubData.tool_followup_system, { toolName });
}
