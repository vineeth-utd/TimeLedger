# TimeLedger MVP Plan

## Objective

Build a hosted personal time tracking application that enables quick activity logging, automatic summaries, weekly goal tracking, and productivity analytics.

The database design is documented in `docs/database.md` and should be treated as the source of truth.

The API contract is documented in `docs/api.md` and should be followed during backend implementation.

---

# Phase 1 - Project Setup ✅

* Initialize Next.js project
* Configure Tailwind CSS
* Configure Prisma
* Connect Supabase PostgreSQL
* Configure environment variables

Status: Completed

---

# Phase 2 - Database ✅

Implement the database schema defined in `docs/database.md`.

Tables:

* categories
* activities
* daily_category_summaries
* weekly_targets

Status: Completed

---

# Phase 3 - Activity Management Backend ✅

Implement:

* GET /api/activities
* POST /api/activities
* PATCH /api/activities/:id
* DELETE /api/activities/:id

Features:

* Duration calculation
* Daily summary recalculation
* Validation

Status: Completed

---

# Phase 4 - Category Management Backend ✅

Implement:

* GET /api/categories
* POST /api/categories
* PATCH /api/categories/:id

Features:

* Category validation
* Duplicate prevention
* Soft deactivation

Status: Completed

---

# Phase 5 - Activity Management UI

Implement:

* Activities page
* Activities table
* Add Activity dialog
* Edit Activity dialog
* Delete Activity
* Connect to Activities API
* Category dropdown using Categories API

Deliverable:

The application can be used to manage activities from the browser.

---

# Phase 6 - Category Management UI

Implement:

* Categories page
* View categories
* Add category
* Rename category
* Activate / deactivate category

Deliverable:

Categories can be managed completely through the UI.

---

# Phase 7 - Dashboard

Implement:

* Today's activities
* Today's category summary
* Current week's category totals
* Weekly targets
* Remaining time
* Progress percentage

Support filters:

* Today
* Yesterday
* Current Week
* Previous Week
* Current Month
* Custom Date Range

Deliverable:

Interactive dashboard with daily and weekly insights.

---

# Phase 8 - Analytics

Implement:

* Weekly comparison chart
* Monthly comparison chart
* Category breakdown
* Productivity trends

Analytics should use `daily_category_summaries` as the data source.

Deliverable:

Analytics page completed.

---

# Phase 9 - Deployment & Polish

Deploy to Vercel.

Verify:

* API functionality
* Database connectivity
* Responsive UI
* Error handling
* Mobile usability

Deliverable:

Production-ready MVP.

---

# Success Criteria

The MVP is complete when:

* Activities can be managed through the UI.
* Categories can be managed through the UI.
* Daily summaries update automatically.
* Weekly targets work correctly.
* Dashboard displays accurate progress.
* Analytics are accurate.
* The application is deployed and usable on desktop and mobile.

---

# Development Rules

* Follow `docs/database.md` for database implementation.
* Follow `docs/api.md` for backend implementation.
* Complete one phase before moving to the next.
* Keep implementations simple and production-ready.
* Avoid unnecessary packages and abstractions.
* Test each phase before proceeding.

```
```
