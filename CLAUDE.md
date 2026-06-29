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

## Task Management

* Add task entry
* Edit task entry
* Delete task entry
* Automatically calculate duration from start and end timestamps
* Store calculated duration in minutes

## Categories

* Categories are maintained in a reference table.
* Tasks must reference an existing category.
* Users can add new categories directly from the UI.

## Daily Category Summary

Maintain a daily category summary table.

Whenever a task is:

* created
* updated
* deleted

recalculate only the affected day's category summaries.

Weekly and monthly summaries should be computed dynamically from daily summaries.

## Weekly Targets

Maintain weekly targets per category.

If a target does not exist for a selected week, automatically use the previous week's actual time as the default target.

Dashboard should display:

* Current week time spent
* Weekly target
* Remaining time
* Progress percentage

---

# Architecture Principles

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
* Keep functions focused and readable.
* Write reusable utility functions where appropriate.
* Keep SQL queries efficient.

---

# UI Guidelines

Design should be simple, responsive, and easy to use.

Prioritize usability over appearance.

Support both desktop and mobile browsers.

---

# Things NOT to Build

Do not implement unless explicitly requested:

* Authentication
* User management
* Notifications
* Background jobs
* Offline support
* Calendar integrations
* AI features
* Theme customization
* Complex animations
* Over-engineered state management

---

# Claude Workflow

For every feature:

1. Understand the requirement.
2. Identify impacted files.
3. Explain the implementation approach briefly.
4. Wait for approval if the change is significant.
5. Implement only the approved scope.

Avoid unrelated refactoring.

Prefer small, incremental commits over large implementations.

Optimize for minimal Claude token usage while maintaining clean code.
