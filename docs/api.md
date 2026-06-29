# TimeLedger API Design

## Purpose

This document defines the API contract for TimeLedger.

The API should remain simple, RESTful, predictable, and easy for the frontend to consume.

All API routes should use Prisma for database access and follow the database design documented in `docs/database.md`.

---

# API Design Principles

* Use Next.js App Router Route Handlers.
* Use Prisma for all database operations.
* Keep one responsibility per endpoint.
* Validate all request payloads.
* Return consistent response structures.
* Recalculate summaries whenever activities change.
* Do not expose unnecessary database details.
* Main Categories and Sub Categories are separate resources.

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
        ├── main-categories/
        │   ├── route.js
        │   └── [id]/
        │       └── route.js
        │
        ├── sub-categories/
        │   ├── route.js
        │   └── [id]/
        │       └── route.js
        │
        ├── daily-main-category-summaries/
        │   └── route.js
        │
        ├── daily-sub-category-summaries/
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

# Main Categories API

## GET /api/main-categories

Optional query parameter:

* isActive

Behavior:

* isActive=true → active only
* isActive=false → inactive only
* omitted → all

Default ordering:

* name ascending

---

## POST /api/main-categories

Create a Main Category.

Validation:

* name required
* name unique
* name not empty

---

## PATCH /api/main-categories/:id

Supported updates:

* name
* isActive

---

# Sub Categories API

## GET /api/sub-categories

Optional query parameters:

* mainCategoryId
* isActive

Behavior:

mainCategoryId filters sub categories belonging to a particular main category.

isActive behaves like Main Categories.

Default ordering:

* name ascending

---

## POST /api/sub-categories

Required fields:

* mainCategoryId
* name

Validation:

* parent Main Category must exist
* name required
* name unique within the selected Main Category

---

## PATCH /api/sub-categories/:id

Supported updates:

* name
* mainCategoryId
* isActive

Future support:

Moving a Sub Category to another Main Category.

---

# Activities API

## GET /api/activities

Query Parameters

* startDate
* endDate
* mainCategoryId (optional)
* subCategoryId (optional)

Sorting

* activityDate DESC
* startTime DESC

---

## POST /api/activities

Required fields

* activityDate
* title
* subCategoryId
* startTime
* endTime

Optional

* notes

Server Responsibilities

* Validate request
* Verify Sub Category exists
* Derive Main Category automatically
* Calculate durationMinutes
* Save activity
* Recalculate daily summaries

---

## PATCH /api/activities/:id

Server Responsibilities

* Validate updates
* Recalculate durationMinutes
* Update activity
* Recalculate daily summaries

---

## DELETE /api/activities/:id

Server Responsibilities

* Delete activity
* Recalculate daily summaries

---

# Daily Main Category Summary API

## GET /api/daily-main-category-summaries

Query Parameters

* startDate
* endDate

Read-only endpoint.

---

# Daily Sub Category Summary API

## GET /api/daily-sub-category-summaries

Query Parameters

* startDate
* endDate

Read-only endpoint.

---

# Weekly Targets API

## GET /api/weekly-targets

Query Parameters

* weekStartDate

---

## POST /api/weekly-targets

Required fields

* weekStartDate
* mainCategoryId
* targetMinutes

Targets are maintained only for Main Categories.

---

## PATCH /api/weekly-targets/:id

Update target.

---

## DELETE /api/weekly-targets/:id

Delete target.

---

# Dashboard API

## GET /api/dashboard/weekly

Returns:

* Today's timeline
* Daily Main Category Summary
* Daily Sub Category Summary
* Weekly Targets
* Current Week Progress

If a weekly target does not exist, use the previous week's actual value as the fallback target.

---

## GET /api/dashboard/monthly

Returns:

* Monthly Main Category totals
* Monthly Sub Category totals
* Monthly comparisons

---

# Validation Rules

## Activities

* title cannot be empty
* subCategoryId must exist
* endTime must be later than startTime
* durationMinutes is always calculated by the server

## Main Categories

* name required
* name unique

## Sub Categories

* name required
* Main Category must exist
* name unique within the same Main Category

## Weekly Targets

* mainCategoryId must exist
* targetMinutes must be zero or greater

---

# Business Rules

Whenever an activity is:

* created
* updated
* deleted

the application must:

1. Calculate durationMinutes.
2. Save the activity.
3. Update Daily Sub Category Summary.
4. Update Daily Main Category Summary.

Weekly Dashboard

* uses Main Categories only

Activities

* are always logged using Sub Categories

Main Categories

* are derived automatically

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

Implement:

* Main Category Management
* Sub Category Management
* Activity CRUD
* Daily Summary APIs
* Weekly Target API
* Dashboard API

Authentication, authorization, pagination, caching, background jobs, and advanced analytics are outside the MVP scope.
