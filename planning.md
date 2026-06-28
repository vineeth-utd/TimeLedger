# TimeLedger MVP Plan

## Objective

Build a hosted personal time tracking application that enables quick task logging, automatic summaries, weekly goal tracking, and productivity analytics.

---

# Phase 1 - Project Setup

* Initialize Next.js project
* Configure Tailwind CSS
* Configure Prisma
* Connect Supabase PostgreSQL
* Create initial database schema
* Configure environment variables

Deliverable:

* Application successfully connected to Supabase database.

---

# Phase 2 - Database

Create tables:

* categories
* task_entries
* daily_category_summaries
* weekly_targets

Seed initial categories.

Deliverable:

* Database schema finalized.

---

# Phase 3 - Task Management

Implement:

* Add task
* Edit task
* Delete task
* View tasks
* Duration calculation
* Category selection

Deliverable:

* Complete CRUD for task entries.

---

# Phase 4 - Category Management

Implement:

* View categories
* Add category
* Prevent duplicate category names
* Allow inactive categories in future if needed

Deliverable:

* Categories managed from the UI.

---

# Phase 5 - Daily Summary

Automatically recalculate daily summaries whenever:

* task added
* task edited
* task deleted

Deliverable:

* Daily category summaries remain accurate.

---

# Phase 6 - Dashboard

Dashboard should display:

* Today's tasks
* Today's category summary
* Current week's category totals
* Weekly targets
* Remaining time
* Progress percentage

Support date filters:

* Today
* Yesterday
* Current Week
* Previous Week
* Current Month
* Custom Date Range

---

# Phase 7 - Analytics

Implement charts for:

* Weekly category comparison
* Monthly category comparison
* Time spent by category
* Weekly productivity trend

Weekly and monthly values should be computed from daily summaries.

---

# Phase 8 - Deployment

Deploy application to Vercel.

Verify:

* Database connectivity
* CRUD operations
* Dashboard
* Mobile responsiveness

---

# Success Criteria

The application is complete when:

* Tasks can be added, edited, and deleted.
* Categories can be managed.
* Daily summaries update automatically.
* Weekly targets function correctly.
* Remaining weekly time is displayed.
* Charts are accurate.
* Application is accessible from desktop and mobile.
* Deployment is successful.

---

# Development Rules

* Complete one phase before moving to the next.
* Keep code simple and readable.
* Avoid premature optimization.
* Avoid unnecessary packages.
* Use Prisma for database operations.
* Use React components with JavaScript.
* Keep API routes focused on a single responsibility.

When requirements are unclear, choose the simplest implementation that satisfies the current MVP.
