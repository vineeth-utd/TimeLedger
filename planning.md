# TimeLedger MVP Plan

## Objective

Build a hosted personal time tracking application that enables quick activity logging, automatic summaries, weekly goal tracking, and productivity analytics.

The database design is documented in `docs/database.md` and should be treated as the source of truth.

The API contract is documented in `docs/api.md` and should be followed during backend implementation.

The UI design is documented in `docs/ui.md` and should be followed during frontend implementation.

---

# Phase 1 - Project Setup ✅

* Initialize Next.js project
* Configure Tailwind CSS
* Configure Prisma
* Connect Supabase PostgreSQL
* Configure environment variables

**Status:** Completed

---

# Phase 2 - Database ✅

Implement the database schema defined in `docs/database.md`.

Database design includes:

* Main Categories
* Sub Categories
* Activities
* Daily Sub Category Summaries (Main Category summaries are derived.)
* Weekly Targets

**Status:** Completed

---

# Phase 3 - Activity Management Backend ✅

Implement:

* GET /api/activities
* POST /api/activities
* PATCH /api/activities/:id
* DELETE /api/activities/:id

Features:

* Activity validation
* Duration calculation
* Daily summary recalculation
* Automatic main category derivation from selected sub category

**Status:** Completed

---

# Phase 4 - Category Management Backend

Implement:

## Main Category APIs

* GET /api/main-categories
* POST /api/main-categories
* PATCH /api/main-categories/:id

## Sub Category APIs

* GET /api/sub-categories
* POST /api/sub-categories
* PATCH /api/sub-categories/:id

Features:

* Main category management
* Sub category management
* Parent-child relationship validation
* Duplicate prevention
* Soft deactivation
* Reactivation

**Status:** Pending (Current APIs should be updated to support the new hierarchy.)

---

# Phase 5 - Activity Management UI

Implement:

* Activities page
* Activities table
* Add Activity modal
* Edit Activity modal
* Delete Activity
* Connect to Activities API

Activity form should support:

* Activity Date
* Title
* Sub Category selection
* Automatically display the corresponding Main Category
* Start Time
* End Time
* Notes

Deliverable:

The application can be used to manage activities completely through the browser.

---

# Phase 6 - Category Management UI

Implement:

## Main Category Management

* View Main Categories
* Add Main Category
* Rename Main Category
* Activate / Deactivate Main Category

## Sub Category Management

* View Sub Categories
* Add Sub Category
* Rename Sub Category
* Activate / Deactivate Sub Category

Future Enhancement:

* Move a Sub Category to another Main Category

Deliverable:

Both Main Categories and Sub Categories can be managed through the UI.

---

# Phase 7 - Dashboard

Implement:

## Today's Summary

* Summary by Main Category
* Summary by Sub Category

## Today's Timeline

* Chronological list of today's activities
* Edit activity
* Delete activity

## Current Week Progress

Display:

* Weekly target
* Time spent
* Remaining time
* Progress percentage

Progress should be calculated using Main Categories.

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

* Weekly Main Category comparison
* Weekly Sub Category comparison
* Monthly Main Category comparison
* Monthly Sub Category comparison
* Productivity trends over time

Analytics should use:

* Daily Main Category Summaries
* Daily Sub Category Summaries

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
* Cross-browser compatibility

Deliverable:

Production-ready MVP.

---

# Success Criteria

The MVP is complete when:

* Activities can be managed through the UI.
* Main Categories can be managed through the UI.
* Sub Categories can be managed through the UI.
* Activities are logged using Sub Categories.
* Main Categories are automatically derived from the selected Sub Category.
* Daily summaries are available by both Main Category and Sub Category.
* Weekly targets work correctly for Main Categories.
* Dashboard displays accurate daily and weekly progress.
* Analytics are accurate.
* The application is deployed and usable on desktop and mobile.

---

# Development Rules

* Follow `docs/database.md` for all database implementation.
* Follow `docs/api.md` for all backend implementation.
* Follow `docs/ui.md` for all frontend implementation.
* Complete one phase before moving to the next.
* Keep implementations simple and production-ready.
* Avoid unnecessary packages and abstractions.
* Test each completed phase before proceeding.
* Prefer reusable components and utilities where appropriate.
* Keep backend, frontend, and documentation aligned whenever changes are introduced.
