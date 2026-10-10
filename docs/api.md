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
* Assistant conversations

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
        ├── dashboard/
        │   └── weekly/
        │       └── route.js
        │
        └── assistant/
            ├── chat/
            │   └── route.js
            └── confirm/
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

## DELETE /api/main-categories/:id and /api/sub-categories/:id

Behavior is unchanged; the rules now live in `categoryService` (`deleteMainCategory`, `deleteSubCategory`), also used by the assistant's confirmed delete tools. Deletion is blocked with 409 while dependent data exists (main: sub categories, activities, weekly targets; sub: activities, daily summaries).

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

# Assistant API

The text AI Assistant is served by two POST endpoints. Architecture, tools, safety rules and confirmation internals are in `docs/ai.md`; the chat UI is in `docs/ui.md`.

* Both require an authenticated Supabase session (401 otherwise). The user is always derived from the session; the request never carries a user id, tool name or tool arguments.
* Both are non-streaming and return one complete assistant turn.
* Both require the browser's IANA `timezone`, used to interpret relative dates and times ("yesterday", "8 PM").
* Conversation state is stored server-side and keyed by the authenticated user and the client-generated `threadId`, so threads cannot cross users.
* Unknown request fields are rejected with 400.

---

## POST /api/assistant/chat

Send one user message.

Request

```json
{
  "threadId": "thread_abc123",
  "message": "Extend my latest activity to 8:59 PM",
  "timezone": "America/Phoenix"
}
```

* `threadId`: 1-100 characters, letters, digits, `-` or `_`. Generated by the client and reused for the whole conversation.
* `message`: 1-4000 characters after trimming.
* `timezone`: a valid IANA timezone.

Success (200)

```json
{
  "success": true,
  "data": {
    "threadId": "thread_abc123",
    "reply": "✓ Updated Assistant UI: end time 8:34 PM -> 8:59 PM.",
    "pendingAction": null,
    "choices": null,
    "changes": [{ "type": "activity_updated" }]
  }
}
```

* `reply`: the assistant's text (a small Markdown subset). When `pendingAction` is set, it is a server-generated confirmation prompt, not model text.
* `pendingAction`: `null`, or a confirmation awaiting the user (see below).
* `choices`: `null`, or `{ "options": [{ "label", "message" }] }` (2-10 options). Optional shortcuts for an ambiguous request: choosing one sends its `message` as a normal chat message; the user can also type any answer. Choices are not confirmations.
* `changes`: `[{ "type" }]` with `type` one of `activity_created`, `activity_updated`, `activity_deleted`, `category_created`, `category_deleted`, or `unknown`. Derived on the server from successful tool results (never from reply text), so the client knows when to refresh what it displays.

---

## POST /api/assistant/confirm

Approve or reject the pending confirmation.

Request

```json
{
  "threadId": "thread_abc123",
  "actionId": "act_0123456789abcdef01234567",
  "decision": "approve",
  "timezone": "America/Phoenix"
}
```

* `actionId`: the id from `pendingAction`.
* `decision`: `approve` or `reject`.

The server executes exactly the action it stored when the confirmation was created, at most once. The client cannot change its arguments. The response has the same shape as a chat success: `reply` continues the conversation, and `changes` lists what was applied. Rejecting performs nothing.

---

## Pending Confirmations

Sensitive actions never run directly from the model's request: deleting an activity, deleting a Main or Sub Category, and creating a Main or Sub Category. The turn that requests one returns a `pendingAction`:

```json
{
  "actionId": "act_0123456789abcdef01234567",
  "expiresAt": "2026-10-08T18:15:00.000Z",
  "actions": [
    { "kind": "DELETE_ACTIVITY", "display": { "summary": "Delete activity \"Gym\" on 2026-10-07, 7:00 AM-8:00 AM (Health > Gym)" } }
  ]
}
```

* Only server-built summaries are returned; database ids, record snapshots and tool arguments are never exposed.
* A confirmation expires 30 minutes after it is created.
* While one is pending, `POST /api/assistant/chat` returns 409 `PENDING_ACTION` with the pending action; the user must approve or reject first.
* A deletion already known to be blocked (for example a category that still has activities) is reported as a normal reply and no confirmation is created.
* The target is re-verified before an approved action runs; if it changed, nothing is deleted.

---

## Assistant Errors

Failures use the standard error format with an added `code`.

| Status | Code | Meaning |
| ------ | ---- | ------- |
| 400 | (none) | Invalid JSON body or failed validation (`message` explains) |
| 401 | (none) | No authenticated session |
| 409 | `PENDING_ACTION` | Chat while a confirmation is pending (`data.pendingAction` is returned) |
| 409 | `NO_PENDING_ACTION` | Confirm with nothing pending |
| 409 | `STALE_ACTION` | `actionId` is not the current pending action |
| 409 | `ACTION_EXPIRED` | The confirmation expired and was cancelled; nothing was done |
| 409 | `ACTION_OUTCOME_UNKNOWN` | The action was already submitted and its outcome cannot be confirmed; check the data and start a new request or thread |
| 429 | `RATE_LIMITED` | The model provider is rate limiting; `data.retryAfterSeconds` and a `Retry-After` header are present when provided |
| 500 | `ASSISTANT_UNAVAILABLE` | The assistant failed to finish the turn |
| 500 | `ASSISTANT_INCOMPLETE` | The model response was cut off before it was usable |

When a turn fails after it started (429 and 500 above, and `ACTION_OUTCOME_UNKNOWN`), `data` carries `threadId`, `pendingAction: null`, `changes`, and `outcome`:

* `none`: nothing was executed.
* `applied`: the listed `changes` definitely happened; only the assistant's continuation failed. Clients should refresh and must not repeat the change.
* `unknown`: an action may have run. Clients must not retry blindly.

Nothing is retried automatically, and a failed chat request must not be resent without checking `outcome`. Errors before anything ran return only `success` and `message` (a 429 may also carry `data.retryAfterSeconds`).

---

## POST /api/assistant/transcribe

Authenticated speech-to-text endpoint (Phase 10B, Milestone 1). Converts one recording to text and nothing else.

It does not execute assistant tools, call LangGraph, modify TimeLedger data, submit anything to `/api/assistant/chat`, or persist audio. The audio exists only in memory for the duration of the request. The only user-related input is the authenticated session; no `userId`, thread or timezone is accepted.

### Request

`multipart/form-data` with a single field:

* `audio`: the recorded file (required).

Accepted MIME types (parameters such as `;codecs=opus` are ignored): `audio/webm`, `video/webm`, `audio/ogg`, `audio/mp4`, `video/mp4`, `audio/x-m4a`, `audio/m4a`, `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/x-wav`, `audio/wave`, `audio/flac`, `audio/x-flac`. This covers MediaRecorder output on Chrome/Edge/Android (webm/opus), Firefox (ogg or webm/opus) and Safari/iOS (mp4/AAC). A lightweight container-signature check rejects mislabeled or garbage uploads; it does not prove the audio is decodable (the provider decides that).

Limit: 2 MB per recording (`MAX_AUDIO_BYTES`). Duration is not parsed server-side; the size cap bounds it and the recording UI (Milestone 2) is expected to stop recording at about 60 seconds.

Language is not a request field; the provider auto-detects it.

### Success Response (200)

```json
{ "success": true, "data": { "text": "log two hours of deep work this morning" } }
```

### Error Responses

All errors: `{ "success": false, "code": "…", "message": "…" }` (401 has no `code`).

| Status | Code | Cause |
|---|---|---|
| 401 | none (`Unauthorized`) | Not signed in |
| 400 | `INVALID_AUDIO` | Not multipart, missing/non-file `audio`, or empty recording |
| 413 | `AUDIO_TOO_LARGE` | Over 2 MB |
| 415 | `UNSUPPORTED_AUDIO_FORMAT` | MIME type not allowed or content signature does not match it |
| 422 | `INVALID_AUDIO` | Provider could not read the audio |
| 422 | `NO_SPEECH` | Transcription was empty |
| 429 | `RATE_LIMITED` | Provider rate limit; `data.retryAfterSeconds` and `Retry-After` header when provided |
| 504 | `TRANSCRIPTION_TIMEOUT` | Provider took longer than 25 seconds |
| 502 | `TRANSCRIPTION_FAILED` | Other provider failure |
| 500 | `TRANSCRIPTION_UNAVAILABLE` | `GROQ_API_KEY` not configured |

Nothing is retried automatically. Provider error details are logged server-side only; audio and transcripts are never logged.

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
| 409    | Duplicate resource, or an assistant confirmation conflict |
| 429    | Rate limited (assistant) |
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
* Text AI Assistant API (`/api/assistant/chat`, `/api/assistant/confirm`)

Not included:

* Email/password authentication
* Pagination
* Background jobs
* Advanced caching
