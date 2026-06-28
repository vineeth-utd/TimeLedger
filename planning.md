# TimeLedger MVP Plan

## Objective

Build a hosted personal time tracking application that allows quick task entry, automatic summaries, weekly goal tracking, and analytics.

---

# Phase 1 — Foundation

* Initialize Next.js project
* Configure Tailwind
* Configure Prisma
* Connect Supabase PostgreSQL
* Create database schema
* Seed initial categories

Deliverable:
Application connected to the database.

---

# Phase 2 — Task CRUD

Implement:

* Add task
* Edit task
* Delete task
* List tasks
* Duration calculation

Deliverable:
Users can fully manage task entries.

---

# Phase 3 — Daily Summary

Implement:

* Daily category summary table
* Automatic recalculation after task changes

Deliverable:
Daily summaries remain consistent.

---

# Phase 4 — Dashboard

Dashboard should display:

* Today's task list
* Today's category totals
* Current week's totals
* Weekly targets
* Remaining time
* Progress percentage

---

# Phase 5 — Analytics

Implement:

* Weekly comparison
* Monthly comparison
* Category breakdown
* Trend charts

Compute weekly and monthly values from daily summaries.

---

# Phase 6 — Polish

* Improve responsive layout
* Improve loading states
* Improve error handling
* Verify calculations
* Deploy to Vercel

---

# Success Criteria

The application is complete when:

* Tasks can be added, edited, and deleted.
* Categories are manageable.
* Daily summaries are automatically maintained.
* Weekly targets work correctly.
* Weekly remaining time is shown.
* Analytics are accurate.
* Application is accessible from desktop and mobile.
* Application is deployed successfully.

---

# Development Rules

* Keep features incremental.
* Complete one phase before starting the next.
* Avoid introducing unnecessary complexity.
* Prefer simple SQL and Prisma queries.
* Build only what is required for the MVP.
