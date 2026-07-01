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
* Every API route requires an authenticated user unless explicitly documented otherwise.
* User ownership is enforced on every request.
* Never trust user identifiers supplied by the client.
* Always derive the authenticated user from the Supabase session.

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

# Authentication

## Authentication Provider

TimeLedger uses **Supabase Auth** for authentication.

Version 1 supports:

* Google Sign-In

Future versions may additionally support:

* Email and Password authentication

---

## Authentication Flow

1. User signs in using Google.
2. Supabase authenticates the user.
3. Supabase creates a session.
4. The authenticated Supabase `user.id` becomes the ownership key for all application data.
5. The session is validated on every protected request.

The application never stores user passwords or manages authentication directly.

---

## Authorization

All user-owned resources are scoped to the authenticated user.

The authenticated Supabase `user.id` is automatically used by the backend to determine data ownership.

The client never supplies or controls the `userId`.

Every protected API route derives the authenticated user from the current Supabase session before performing any database operation.

---

## Protected Resources

The following resources are user-owned:

* Main Categories
* Sub Categories
* Activities
* Daily Sub Category Summaries
* Weekly Targets
* Dashboard data
* Analytics data

Each user can access only their own data.

---

## Public Routes

The following routes remain publicly accessible:

* `/login`
* `/auth/callback`

All other application pages require authentication.

---

## Unauthorized Requests

Protected API routes require a valid authenticated Supabase session.

If authentication fails, the API returns:

* **401 Unauthorized**

If a requested resource belongs to another user, the API behaves as though the resource does not exist and returns:

* **404 Not Found**

This prevents exposing the existence of another user's data.

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
        ├── daily-sub-category-summaries/
        │   └── route.js
        │
        ├── weekly-targets/
        │   ├── route.js
        │   └── [id]/
        │       └── route.js
        │
        └── dashboard/
            └── weekly/
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

Returns only the authenticated user's records.

Default ordering:

* name ascending

---

## POST /api/main-categories

Create a Main Category.

Validation:

* name required
* name unique
* name not empty

The authenticated user's userId is assigned automatically.

---

## PATCH /api/main-categories/:id

Supported updates:

* name
* isActive

Ownership is verified before updating.

---

# Sub Categories API

## GET /api/sub-categories

Optional query parameters:

* mainCategoryId
* isActive

Behavior:

mainCategoryId filters sub categories belonging to a particular main category.

isActive behaves like Main Categories.

Returns only the authenticated user's records.

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

The authenticated user's userId is assigned automatically.

---

## PATCH /api/sub-categories/:id

Supported updates:

* name
* mainCategoryId
* isActive

Ownership is verified before updating.

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

Behavior:

Returns only the authenticated user's records.

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

The authenticated user's userId is assigned automatically.

---

## PATCH /api/activities/:id

Server Responsibilities

* Validate updates
* Recalculate durationMinutes
* Update activity
* Recalculate daily summaries
* Ownership is verified before updating.

---

## DELETE /api/activities/:id

Server Responsibilities

* Delete activity
* Recalculate daily summaries
* Ownership is verified before deleting.

---

# Weekly Targets API

## GET /api/weekly-targets

Query Parameters

* weekStartDate

Behavior:

Returns only the authenticated user's records.

---

## POST /api/weekly-targets

Required fields

* weekStartDate
* mainCategoryId
* targetMinutes

Targets are maintained only for Main Categories.

The authenticated user's userId is assigned automatically.

---

## PATCH /api/weekly-targets/:id

Update target.

Ownership is verified before updating.

---

## DELETE /api/weekly-targets/:id

Delete target.

Ownership is verified before deleting.

---

# Dashboard API

## GET /api/dashboard/weekly

### Purpose

Return all data required to render the Dashboard. 

Returns only the authenticated user's records.

The frontend should make a single request to this endpoint.

The backend is responsible for aggregating data from:

* activities
* daily_sub_category_summaries
* weekly_targets
* main_categories
* sub_categories

---

## Query Parameters

### period

Supported values:

* weekStartDate
* today

Default:

* today

---

## Response Structure

### Today's Timeline

Chronological list of today's activities.

Each activity includes:

* id
* activityDate
* title
* subCategory
* mainCategory
* startTime
* endTime
* durationMinutes

---

### Today's Summary

#### Main Categories

For each Main Category:

* name
* totalMinutes

Main Category totals are derived from Daily Sub Category Summaries.

---

#### Sub Categories

For each Sub Category:

* name
* totalMinutes

---

### Weekly Progress

For each Main Category:

* targetMinutes
* actualMinutes
* remainingMinutes
* progressPercentage

If a weekly target does not exist, use the previous week's actual value as the default target.

---

## Backend Responsibilities

The Dashboard endpoint should:

* fetch today's activities
* fetch Daily Sub Category Summaries
* derive Main Category totals
* fetch Weekly Targets
* calculate remaining time
* calculate progress percentages

The frontend should not perform these calculations.

---

## Notes

The Dashboard API is a Backend-for-Frontend endpoint.

It exists specifically to simplify the Dashboard UI by returning a fully prepared response.

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

## Authentication

All protected routes require a valid authenticated Supabase session.

Unauthenticated requests return:

401 Unauthorized

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

All CRUD operations are performed only within the authenticated user's data.

Cross-user access is never permitted.

---

# HTTP Status Codes

| Status | Meaning               |
| ------ | --------------------- |
| 200    | Success               |
| 201    | Resource created      |
| 400    | Validation error      |
| 401    | Unauthorized          |
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

Implemented:

* Google Authentication
* User-scoped authorization
* Protected API routes

Not included:

* Email/password authentication
* Pagination
* Background jobs
* Advanced caching
