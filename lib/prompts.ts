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
