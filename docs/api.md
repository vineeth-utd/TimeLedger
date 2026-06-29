# TimeLedger API Design

## Purpose

This document defines the API contract for TimeLedger.

The API should remain simple, RESTful, predictable, and easy for the frontend to consume.

All API routes should use Prisma for database access and follow the database design documented in `docs/database.md`.

---

# API Design Principles

* Next.js App Router Route Handlers should be used.
* Use Prisma for all database operations.
* Keep one responsibility per endpoint.
* Validate all request payloads.
* Return consistent response structures.
* Recalculate daily summaries whenever activities change.
* Do not expose unnecessary database details.

---

# Base URL

```
/api
```

---

# Standard Response Format

## Success

```json
{
  "success": true,
  "data": {}
}
```

## Error

```json
{
  "success": false,
  "message": "Human readable error message"
}
```

---

# Route Structure

```
src/
└── app/
    └── api/
        ├── activities/
        │   ├── route.js
        │   └── [id]/
        │       └── route.js
        │
        ├── categories/
        │   ├── route.js
        │   └── [id]/
        │       └── route.js
        │
        ├── daily-category-summaries/
        │   └── route.js
        │
        ├── weekly-targets/
        │   ├── route.js
        │   └── [id]/
        │       └── route.js
        │
        └── dashboard/
            ├── weekly/
            │   └── route.js
            └── monthly/
                └── route.js
```

---

# Categories API

## GET /api/categories

### Purpose

Return all categories based on the filters and ordered alphabetically.

### Optional query parameter:

- isActive

### Behavior:
- isActive=true → return only active categories
- isActive=false → return only inactive categories
- isActive not provided → return all categories

### Default ordering:
- name ascending

---

## POST /api/categories

### Purpose

Create a new category.

### Validation

* name is required
* name cannot be empty
* name must be unique

---

## PATCH /api/categories/:id

### Purpose

Update category information.

### Supported updates:
- name
- isActive

Use isActive=false to deactivate a category.
Use isActive=true to reactivate a category.

---

# Activities API

## GET /api/activities

### Purpose

Return activities within a date range.

### Query Parameters

* startDate
* endDate
* categoryId (optional)

### Sorting

Default:

* activityDate DESC
* startTime DESC

---

## POST /api/activities

### Purpose

Create a new activity.

### Required Fields

* activityDate
* title
* categoryId
* startTime
* endTime

### Optional Fields

* notes

### Server Responsibilities

* Validate request
* Calculate durationMinutes
* Save activity
* Recalculate daily summaries

---

## PATCH /api/activities/:id

### Purpose

Update an activity.

### Server Responsibilities

* Validate updates
* Recalculate durationMinutes
* Update activity
* Recalculate daily summaries

---

## DELETE /api/activities/:id

### Purpose

Delete an activity.

### Server Responsibilities

* Delete activity
* Recalculate daily summaries

---

# Daily Category Summary API

## GET /api/daily-category-summaries

### Purpose

Return daily summaries for a date range.

### Query Parameters

* startDate
* endDate

### Notes

Read-only endpoint.

Daily summaries are maintained automatically by the application.

---

# Weekly Targets API

## GET /api/weekly-targets

### Purpose

Return weekly targets.

### Query Parameters

* weekStartDate

---

## POST /api/weekly-targets

### Purpose

Create or update a weekly target.

### Required Fields

* weekStartDate
* categoryId
* targetMinutes

### Behavior

If a target already exists for the same category and week, update it instead of creating a duplicate.

---

## PATCH /api/weekly-targets/:id

### Purpose

Update an existing weekly target.

---

## DELETE /api/weekly-targets/:id

### Purpose

Delete a weekly target.

---

# Dashboard API

## GET /api/dashboard/weekly

### Purpose

Return all data required for the weekly dashboard.

### Query Parameters

* weekStartDate

### Response Includes

* Activities
* Daily summaries
* Weekly targets
* Time spent
* Remaining time
* Progress percentage

If a target is missing for a category, use the previous week's actual time as the fallback target.

---

## GET /api/dashboard/monthly

### Purpose

Return all data required for the monthly dashboard.

### Query Parameters

* year
* month

### Response Includes

* Monthly category totals
* Monthly comparison data

---

# Validation Rules

## Activities

* title cannot be empty
* categoryId must exist
* endTime must be greater than startTime
* durationMinutes is always calculated by the server

---

## Categories

* name cannot be empty
* name must be unique

---

## Weekly Targets

* categoryId must exist
* targetMinutes must be zero or greater

---

# Business Rules

Whenever an activity is:

* created
* updated
* deleted

the application must:

1. Calculate durationMinutes.
2. Update the activities table.
3. Recalculate affected daily category summaries.

Weekly and monthly values are always computed from `daily_category_summaries`.

No weekly or monthly summary tables should be created.

---

# HTTP Status Codes

| Status | Meaning               |
| ------ | --------------------- |
| 200    | Success               |
| 201    | Resource created      |
| 400    | Validation error      |
| 404    | Resource not found    |
| 409    | Duplicate resource    |
| 500    | Internal server error |

---

# MVP Scope

Implement only:

* Category Management
* Activity CRUD
* Daily Summary API
* Weekly Target API
* Dashboard API

Authentication, authorization, pagination, search, sorting, caching, and background jobs are outside the MVP scope.
