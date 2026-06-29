# TimeLedger Database Design

## Purpose

This document defines the database structure for TimeLedger.

The database should support:

- logging activities with start and end times
- managing reusable categories
- maintaining daily category summaries
- storing weekly targets per category
- computing weekly and monthly views from daily summary data

The design should stay simple, normalized, and easy to maintain.

---

# Design Principles

- `activities` is the source of truth for all logged work sessions and personal time blocks.
- `daily_category_summaries` stores only daily aggregated totals.
- Weekly and monthly summaries are computed from daily summaries.
- Categories are managed in a reference table and reused across activities.
- Weekly targets are stored separately from actual logged time.
- All important tables include timestamps.

---

# Tables

## 1. categories

### Purpose

Stores all available categories that can be assigned to activities.

### Columns

- id
- name
- is_active
- created_at
- updated_at

### Constraints

- name must be unique
- name must not be empty
- is_active defaults to true

### Relationships

- One category has many activities.
- One category has many daily category summaries.
- One category has many weekly targets.

---

## 2. activities

### Purpose

Stores every individual activity performed by the user.

This is the source of truth for all analytics.

### Columns

- id
- activity_date
- title
- category_id
- start_time
- end_time
- duration_minutes
- notes
- created_at
- updated_at

### Notes

- `activity_date` represents the day the activity was performed.
- `title` is free text and should not be normalized into a separate table for the MVP.
- `duration_minutes` is calculated from `start_time` and `end_time`.
- Whenever an activity is created or edited, the application recalculates `duration_minutes`.

### Constraints

- title must not be empty
- category_id is required
- start_time is required
- end_time is required
- end_time must be later than start_time
- duration_minutes must be non negative

### Relationships

- Many activities belong to one category.

### Indexes

- activity_date
- category_id
- start_time
- end_time

---

## 3. daily_category_summaries

### Purpose

Stores precomputed daily totals for each category.

### Why this table exists

This table improves dashboard performance by avoiding repeated aggregation of raw activities.

### Columns

- id
- summary_date
- category_id
- total_minutes
- total_entries
- created_at
- updated_at

### Notes

- One row represents one category for one day.
- This table is recalculated whenever activities are added, edited, or deleted.
- Weekly and monthly summaries are computed from this table.

### Constraints

- summary_date is required
- category_id is required
- one row per summary_date and category_id
- total_minutes must be non negative
- total_entries must be non negative

### Relationships

- Many daily category summaries belong to one category.

### Indexes

- unique(summary_date, category_id)
- summary_date
- category_id

---

## 4. weekly_targets

### Purpose

Stores weekly target time for each category.

### Columns

- id
- week_start_date
- category_id
- target_minutes
- created_at
- updated_at

### Notes

- One row represents one category for one week.
- If no target exists for the selected week, the application should use the previous week's actual time as the default target.
- The dashboard should display:
  - target
  - actual time spent
  - remaining time
  - progress percentage

### Constraints

- week_start_date is required
- category_id is required
- one row per week_start_date and category_id
- target_minutes must be non negative

### Relationships

- Many weekly targets belong to one category.

### Indexes

- unique(week_start_date, category_id)
- week_start_date
- category_id

---

# Application Rules

## Activity Handling

When an activity is created, edited, or deleted:

1. Calculate or recalculate `duration_minutes`.
2. Save the activity.
3. Recalculate the affected day's category summaries.

---

## Daily Summary

For every category on a given day:

- Sum `duration_minutes`
- Count total activities

Store the result in `daily_category_summaries`.

---

## Weekly Dashboard

Weekly totals should be computed from `daily_category_summaries`.

For each category, display:

- time spent this week
- weekly target
- remaining time
- progress percentage
- previous week's time
- difference from previous week

---

## Monthly Dashboard

Monthly totals should also be computed from `daily_category_summaries`.

Do not maintain separate monthly summary tables.

---

# Time Handling

- Store timestamps using timezone aware types.
- Store all durations in minutes.
- Use a consistent definition of the week's start day throughout the application.

---

# MVP Scope

The initial version supports:

- Categories
- Activities
- Daily category summaries
- Weekly targets

No additional tables should be introduced unless a feature clearly requires them.