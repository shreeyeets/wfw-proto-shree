# Wysa for Teams — Product Requirements Document

## Product Overview

Wysa for Teams is performance infrastructure embedded in Slack and Microsoft Teams. It helps teams sustain output under load by surfacing work-pattern signals early and giving individuals and managers one clear action.

It is not a wellness program. It is not therapy. It is a performance system — the same way a monitoring dashboard tells an engineering team their API is degrading before users complain.

-----

## Problem Statement

Teams don’t fail because people are weak. They fail because work patterns — meeting density, context-switching load, unclear priorities, inadequate recovery time — exceed human cognitive limits. By the time a manager notices, the cost is already paid in errors, attrition, or burnout.

Current tools either ignore this problem (most work platforms) or pathologise it (wellness apps). Neither addresses the system.

-----

## Target Users

*Primary: Knowledge workers in teams of 5–50*


High-output roles: engineering, product, marketing, consulting
Already inside Slack or Teams daily
Friction threshold: ~30 seconds


*Secondary: Managers (team leads, senior ICs managing delivery)*


Need signal without noise
Cannot afford to monitor individuals
Want to act on structural issues, not pastoral care


*Tertiary: HR / Ops / Leadership*


Need org-level pattern visibility
Want to understand what work practices drive strain


-----

## Core Use Cases

### UC1: Daily Check-in (Employee)


Triggered: morning or post-lunch, configurable
Duration: 15–30 seconds
Input: 3 state dimensions (focus, load, energy)
Output: 1 micro-tool offer based on state


### UC2: In-moment Tool (Employee)


Triggered: on-demand (“I’m overwhelmed”)
Duration: 60–90 seconds
Tools: focus reset, priority triage, recovery breath, planning frame


### UC3: Team Trend (Manager)


Triggered: weekly digest, or on-demand
Shows: team-level pattern (last 7 days)
Output: 1 recommended structural action


### UC4: Anonymous Signal (Employee → System)


Employee can flag a systemic issue anonymously
Aggregated if ≥3 similar signals in team
Surfaces as pattern in manager view, not individual flag


### UC5: Org Pattern View (HR/Leadership)


Cross-team aggregates
Identifies which teams or work patterns correlate with strain signals
No individual, no team-level detail below threshold


-----

## Core Rules (Non-negotiable)

### Privacy


Individual data is never exposed to anyone
Manager view requires minimum team threshold (default: 5 active users)
All data is aggregated before leaving the user’s context
No manager can query individual check-in history


### Framing


Issues are always framed as work patterns, not people
Language: “Your team’s meeting load is high this week” not “People are struggling”
No diagnostic labels, no wellness language


### Action


Every insight surface must include exactly one recommended action
Actions must be structural: reduce meetings, add buffer time, clarify scope
Actions are optional and never enforced


### Friction


Employee interactions: ≤60 seconds
Manager digest: skimmable in 90 seconds
No mandatory flows, no forced completions


-----

## Privacy Architecture

User Input
    ↓
Local encryption (at rest)
    ↓
Aggregate compute (server-side, no PII)
    ↓
Team-level output (min threshold enforced)
    ↓
Manager view (patterns only)

Individual records are stored encrypted. Aggregation happens in a separate compute layer. No query path exists from manager interface to individual records.

-----

## Engagement Model

*What we don’t use:*


Points, badges, streaks with pressure
Leaderboards of any kind
Completion rates shown to managers


*What we use:*


Small win reinforcement: “You’ve been consistent this week — that data helps your team.”
Optional team challenges framed as experiments: “Try: no meetings before 10am for 2 weeks. See what changes.”
Longitudinal personal insight: “Last month you consistently flagged Tuesdays as high-load. Still true?”


-----

## Behavioral Engine

Every employee interaction is designed to produce the feeling: *“I can do something about this.”*

This is achieved through:


*Reduction to one thing*: Never present more than one action at a time
*Controllability framing*: Distinguish what user can control vs. cannot
*Small step bias*: Actions are always achievable in the next 30 minutes
*Completion closure*: Every tool ends with a micro-win acknowledgment


These are applied CBT principles (self-efficacy, cognitive restructuring, behavioural activation) without naming them as such.

-----

## Platform Differences

### Slack


Conversational tone
Frequent light nudges (daily check-in)
Interactive message buttons
Block Kit for structured cards
DM-based, private


### Microsoft Teams


Structured card format (Adaptive Cards)
Less frequent, higher-signal interactions
Tab-based dashboard for manager view
Bot Framework integration


-----

## Out of Scope (v1)


Clinical escalation pathways
Integration with HR systems
Calendar analysis (future: auto-detect meeting load)
Manager coaching content
Mobile native app