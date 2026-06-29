# TimeLedger MVP Plan

## Objective

Build a hosted personal time tracking application that enables quick activity logging, automatic summaries, weekly goal tracking, and productivity analytics.

The database design is documented in `docs/database.md` and should be treated as the source of truth.

---

# Phase 1 - Project Setup

* Initialize Next.js project
* Configure Tailwind CSS
* Configure Prisma
* Connect Supabase PostgreSQL
* Configure environment variables

Deliverable:

* Application successfully connected to Supabase PostgreSQL.

---

# Phase 2 - Database

Implement the database schema defined in `docs/database.md`.

Create the following tables:

* categories
* activities
* daily_category_summaries
* weekly_targets

Seed initial categories if required.

Deliverable:

* Database schema finalized.
* Initial Prisma migration created.

---

# Phase 3 - Activity Management

Implement:

* Add activity
* Edit activity
* Delete activity
* View activities
* Automatic duration calculation
* Category selection

Deliverable:

* Complete CRUD for activities.

---

# Phase 4 - Category Management

Implement:

* View categories
* Add category
* Prevent duplicate category names
* Support inactive categories for future use

Deliverable:

* Categories managed from the UI.

---

# Phase 5 - Daily Category Summary

Automatically recalculate daily summaries whenever an activity is:

* added
* edited
* deleted

Deliverable:

* Daily category summaries remain accurate.

---

# Phase 6 - Dashboard

Dashboard should display:

* Today's activities
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

Deliverable:

* Dashboard displays accurate summaries and progress.

---

# Phase 7 - Analytics

Implement charts for:

* Weekly category comparison
* Monthly category comparison
* Time spent by category
* Weekly productivity trend

Weekly and monthly values should be computed from `daily_category_summaries`.

Deliverable:

* Analytics page completed.

---

# Phase 8 - Deployment

Deploy the application to Vercel.

Verify:

* Database connectivity
* Activity CRUD operations
* Dashboard
* Analytics
* Mobile responsiveness

Deliverable:

* Production deployment completed.

---

# Success Criteria

The application is complete when:

* Activities can be added, edited, and deleted.
* Categories can be managed.
* Daily summaries update automatically.
* Weekly targets function correctly.
* Remaining weekly time is displayed.
* Analytics are accurate.
* Application is accessible from desktop and mobile.
* Application is successfully deployed.

---

# Development Rules

* Follow `docs/database.md` for all database-related implementation.
* Complete one phase before moving to the next.
* Keep code simple and readable.
* Avoid premature optimization.
* Avoid unnecessary packages.
* Use Prisma for all database operations.
* Use React components with JavaScript.
* Keep API routes focused on a single responsibility.
* Build the smallest working solution before adding enhancements.

When requirements are unclear, choose the simplest implementation that satisfies the MVP.
