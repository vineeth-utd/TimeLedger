# TimeLedger Database Design

## Purpose

This document defines the database structure for TimeLedger.

The database should support:

* Logging activities with start and end times
* Managing reusable main categories
* Managing reusable sub categories
* Maintaining daily summaries by both main category and sub category
* Storing weekly targets for main categories
* Computing weekly and monthly views from daily summary data

The design should remain simple, normalized, and easy to maintain.

---

# Design Principles

* `activities` is the source of truth.
* Every user-owned record belongs to exactly one authenticated user.
* The authenticated Supabase Auth `user.id` is used as the ownership key.
* All application data is scoped by user ownership.
* Every activity belongs to exactly one sub category.
* Every sub category belongs to exactly one main category.
* Main categories are derived through sub categories and should never be manually selected while creating an activity.
* Daily summaries are precomputed.
* Weekly targets are maintained only for main categories.
* All important tables include timestamps.

---

# Tables

## 1. main_categories

### Purpose

Stores the highest level activity grouping.

Examples:

* Career Growth
* Admin / Life Maintenance
* Health
* Entertainment

### Columns

* id
* name
* is_active
* created_at
* updated_at
* user_id

### Constraints

* name must be unique
* is_active defaults to true

### Relationships

One main category has many sub categories.

One main category has many weekly targets.

One main category has many daily main category summaries.

Many main categories belong to one authenticated user.

---

## 2. sub_categories

### Purpose

Stores selectable activity categories.

Examples:

Career Growth

* LeetCode
* AI Concepts
* LLM Course
* Internship Applications

Admin / Life Maintenance

* Kitchen Chores
* Cooking
* Laundry

### Columns

* id
* main_category_id
* name
* is_active
* created_at
* updated_at
* user_id

### Constraints

* name must be unique within the same main category
* is_active defaults to true

### Relationships

One sub category belongs to one main category.

One sub category has many activities.

One sub category has many daily sub category summaries.

Many sub categories belong to one authenticated user.

---

## 3. activities

### Purpose

Stores every individual activity performed by the user.

This is the source of truth for all analytics.

### Columns

* id
* activity_date
* title
* sub_category_id
* start_time
* end_time
* duration_minutes
* notes
* created_at
* updated_at
* user_id

### Notes

* Main category is derived automatically from the selected sub category.
* Users only select the sub category.
* Duration is calculated from start and end time.

### Relationships

Many activities belong to one sub category.

Many activities belong to one authenticated user.

---

## 4. daily_sub_category_summaries

### Purpose

Stores precomputed daily totals for every sub category.

### Columns

* id
* summary_date
* sub_category_id
* total_minutes
* total_activities
* created_at
* updated_at
* user_id

### Relationships

Many daily summaries belong to one authenticated user.

## 5. weekly_targets

### Purpose

Stores weekly targets.

Targets exist only for main categories.

### Columns

* id
* week_start_date
* main_category_id
* target_minutes
* created_at
* updated_at
* user_id

### Relationships

Many weekly targets belong to one authenticated user.

---

# Application Rules

## Activity Creation

When an activity is created:

1. User selects a sub category.
2. Main category is derived automatically.
3. Duration is calculated.
4. Activity is stored.
5. Daily sub category summary is recalculated.
6. Daily main category summary is recalculated.

The same rules apply when activities are edited or deleted.

---

# Category Rules

Main categories

* used for weekly targets
* used for weekly dashboard
* used for analytics

Sub categories

* selected while creating activities
* shown in activity tables
* summarized daily
* rolled up into their parent main category

Inactive categories

* should not appear in activity forms
* should remain visible in category management
* can be reactivated
* can be deleted only when no dependent data exists
* otherwise deletion is blocked with a clear validation message

---

# Dashboard Rules

Dashboard should display:

Today's Summary

* by main category
* by sub category

Current Week

* grouped by main category
* compared against weekly targets

Today's Timeline

* reverse chronological activity list (most recent first)

---

# Time Handling

* Store timestamps using timezone-aware types.
* Store durations as integer minutes.
* Store weekly targets internally as integer minutes.
* All user-facing dates are interpreted using the user's local timezone.
* Week calculations are based on the user's local timezone.
* Times are displayed in 12-hour AM/PM format throughout the UI.

---

# Authentication & Data Ownership

TimeLedger is a private application.

Authentication is provided by Supabase Auth using Google Sign-In.

Every user-owned record stores the authenticated Supabase `user.id` as `user_id`.

All database reads and writes are scoped to the authenticated user.

No application-managed User table exists.

Supabase Auth remains the single source of truth for user identity.

---

# MVP Scope

The MVP supports:

* Main categories
* Sub categories
* Activities
* Daily summaries
* Weekly targets

The current implementation also includes:

* Google Authentication
* User-scoped data ownership
* Protected API routes
* Protected application pages

No additional database tables are required beyond the current schema.
