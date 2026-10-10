@AGENTS.md

# TimeLedger

## Project Overview

TimeLedger is a personal full-stack web application for tracking daily activities, analyzing time spent across categories, monitoring weekly goals, and visualizing productivity trends.

The application is primarily intended for personal use but should follow clean architecture and coding practices so it can be extended in the future.

---

# Tech Stack

* Next.js (App Router)
* React
* JavaScript (ES6+)
* Tailwind CSS
* Prisma ORM
* Supabase PostgreSQL
* Vercel
* Recharts

---

# Primary Goal

Build a clean, production-quality MVP as efficiently as possible.

Prioritize simplicity, maintainability, and correctness over unnecessary abstractions.

---

# Core Features

## Activity Management

* Add activity
* Edit activity
* Delete activity
* Automatically calculate duration from start and end timestamps
* Store calculated duration in minutes

## Categories

* Categories are maintained in a reference table.
* Every activity must belong to an existing category.
* Users can add new categories directly from the UI.

## Daily Category Summary

Maintain a daily category summary table.

Whenever an activity is:

* created
* updated
* deleted

recalculate only the affected day's category summaries.

Weekly and monthly summaries should be computed dynamically from daily summaries.

## Weekly Targets

Maintain weekly targets per category.

If a target does not exist for the selected week, automatically use the previous week's actual time as the default target.

The dashboard should display:

* Current week time spent
* Weekly target
* Remaining time
* Progress percentage

---

# Architecture Principles

* `activities` is the source of truth.
* `daily_category_summaries` stores precomputed daily totals.
* Weekly and monthly summaries are derived from daily summaries.
* Next.js handles both frontend and backend.
* Keep business logic on the server whenever possible.
* Keep React components focused on presentation.
* Keep APIs small and reusable.
* Avoid unnecessary abstraction.

---

# Coding Standards

* Use modern JavaScript (ES6+).
* Use async/await.
* Prefer functional React components.
* Use meaningful variable and function names.
* Keep functions small and readable.
* Use Prisma for all database operations.
* Keep SQL queries efficient.

---

# UI Guidelines

Design should be simple, responsive, and easy to use.

Prioritize usability over appearance.

Support both desktop and mobile browsers.

---

# Things NOT to Build

Do not implement unless explicitly requested:

* Notifications
* Background jobs
* Offline support
* Calendar integrations
* Theme customization
* Complex animations
* Over-engineered state management
* Future AI/voice/productivity-coach functionality beyond the currently approved milestone

---

# Documentation Sources of Truth

Use project documentation according to the area being modified:

* `docs/database.md` — database schema, relationships, and database business rules
* `docs/api.md` — REST API contracts and backend behavior
* `docs/ui.md` — UI behavior and application workflows
* `docs/ai.md` — AI Assistant architecture, tool contracts, agent behavior, confirmation rules, privacy, and AI safety boundaries
* `docs/planning.md` — project roadmap, implementation phases, milestone scope, and milestone status
* `docs/auth_phase_plan.md` — authentication implementation history and design decisions
* `docs/ui_refinement_plan.md` — UI refinement history and implementation decisions

Read only the documentation relevant to the current task rather than loading all project documentation unnecessarily.

===

# Claude Workflow

Before implementing any feature:

1. Read only the files required for the current task.
2. Use the project documentation (`docs/`) as the source of truth.
3. Understand the feature requirements.
4. Identify the files that will be created or modified.
5. Call out any assumptions, ambiguities, risks, or suggested improvements before implementation.
6. Produce a clear step-by-step implementation plan.
7. Wait for my approval before writing or modifying any code.
8. Implement only the approved scope.

## Implementation Rules

* Keep changes focused on the current feature.
* Do not read or modify unrelated files.
* Avoid unnecessary refactoring.
* Prefer simple, production-ready solutions.
* Keep functions and components small and readable.
* Reuse existing utilities whenever appropriate.
* Follow the database design in `docs/database.md`.
* Follow the API contracts in `docs/api.md`.
* Follow the category filtering rules in `docs/api.md` and `docs/ui.md`.
* If implementation differs from the documentation, explain why before making the change.

---

## AI Assistant Development

When working on the AI Assistant:

* Follow `docs/ai.md` as the source of truth for AI architecture, tool boundaries, agent behavior, confirmation rules, and safety requirements.
* Follow `docs/planning.md` for the currently approved AI milestone and implementation order.
* Before implementing a milestone, inspect only the existing code required to understand and implement that milestone.
* Reuse existing TimeLedger application/service/business logic wherever possible.
* Do not duplicate existing activity, category, authorization, or validation logic inside AI tools.
* The LLM must never access Prisma or the database directly.
* AI tool schemas must never accept `userId`; user identity must come from authenticated server-side context.
* All tool operations must remain scoped to the authenticated user.
* LangGraph is responsible for orchestration, state, branching, interrupts, and resumption. TimeLedger business logic must remain outside the graph.
* Treat tool inputs and outputs as controlled application contracts rather than exposing raw database objects.
* Implement only the currently approved AI milestone.
* Do not implement future voice, analytics, or Productivity Coach functionality while working on the text assistant unless explicitly requested.
* If the existing codebase requires a deviation from `docs/ai.md`, explain the conflict and proposed change before implementation.

---

## Development Philosophy

* Complete one feature at a time.
* Prefer incremental commits after each completed milestone.
* Minimize Claude token usage by reading only the necessary files and avoiding unnecessary analysis.
