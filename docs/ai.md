# TimeLedger AI Assistant

## 1. Purpose

TimeLedger includes a conversational AI Assistant (text-based, implemented) that allows users to interact with the application using natural language instead of manually filling forms for every operation. Voice input and the AI Productivity Coach remain future work (sections 17 and 18).

Example requests:

- "Add LeetCode from 9:15 AM to 10:40 AM today."
- "Extend my latest activity until 2:30 PM."
- "Change yesterday's gym activity to end at 7 PM."
- "Move yesterday's System Design activity to Personal Project."
- "Delete yesterday's gym activity."
- "Add Kubernetes study from 8 PM to 9 PM."

The assistant understands the request, determines which TimeLedger operations are required, calls controlled application tools, reasons over tool results when necessary, and returns a concise response.

The LLM must never access Prisma or the database directly.

All TimeLedger operations must pass through controlled AI tools and the application/service layer.

---

# 2. Scope

The AI Assistant is developed in two major phases: Phase 1 (text) is implemented; Phase 2 (voice) is future work.

## Phase 1 — Text-Based Assistant (implemented)

Phase 1 provides the complete conversational assistant using typed text, delivered as a floating assistant available across the authenticated application (`docs/ui.md`) and the `/api/assistant/chat` and `/api/assistant/confirm` endpoints (`docs/api.md`).

It includes:

- Controlled TimeLedger tools
- LLM integration
- LangGraph orchestration
- Multi-step tool calling
- Activity retrieval and mutation
- Category/subcategory resolution
- Relative date/time interpretation
- Conversation/workflow state
- Human confirmation for sensitive operations
- Assistant chat UI
- Validation, authorization, privacy, and reliability

Detailed implementation milestones and status are tracked in `planning.md`; token and rate-limit work is recorded in `ai_token_optimization.md`.

## Phase 2 — Voice Input (future)

Voice will be added now that the text assistant is implemented.

```text
Voice
  ↓
Speech-to-text
  ↓
Existing AI Assistant
  ↓
Existing LangGraph + Tool Pipeline
```

Voice is another input method, not a separate agent.

Detailed voice architecture will be designed when Phase 2 begins.

---

# 3. High-Level Architecture

```text
┌──────────────────────────────────────────────┐
│                 TimeLedger UI                │
│                                              │
│              AI Assistant Chat               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│            Assistant API / Server            │
│                                              │
│  Authentication                              │
│  Authenticated user context                  │
│  Current date/time                           │
│  User timezone                               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│               LangGraph Agent                │
│                                              │
│  LLM reasoning                               │
│  Tool selection                              │
│  Multi-step execution                        │
│  Conversation/workflow state                 │
│  Confirmation / interrupts                   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              TimeLedger AI Tools             │
│                                              │
│  Read tools                                  │
│  Activity mutation tools                     │
│  Taxonomy mutation tools                     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│       TimeLedger Application/Service Layer   │
│                                              │
│  Authorization                               │
│  Ownership enforcement                       │
│  Validation                                  │
│  Business rules                              │
│  Derived values                              │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
                     Prisma
                       │
                       ▼
               Supabase PostgreSQL
```

The AI layer must never bypass TimeLedger business logic.

---

# 4. Responsibility Boundaries

## 4.1 LLM

The LLM is responsible for:

- Understanding natural-language requests
- Determining user intent
- Deciding which tools are required
- Reasoning over tool results
- Determining whether additional tool calls are necessary
- Matching activities to existing categories/subcategories
- Detecting ambiguity
- Asking clarification questions
- Suggesting new categories when appropriate
- Producing concise user-facing responses

The LLM is not responsible for:

- Authorization
- Data ownership enforcement
- Direct database access
- Authoritative validation
- Enforcing TimeLedger business rules
- Calculating authoritative derived database values

The LLM must never be treated as a security boundary.

---

## 4.2 LangGraph

LangGraph orchestrates the assistant workflow.

It is responsible for:

- Maintaining conversation/workflow state
- Running the LLM
- Executing requested tools
- Returning tool results to the LLM
- Supporting repeated LLM → tool → LLM loops
- Branching based on workflow state
- Interrupting workflows when confirmation is required
- Resuming workflows after approval or rejection
- Maintaining pending actions

LangGraph contains workflow orchestration, not TimeLedger business logic.

---

## 4.3 AI Tools

AI tools are controlled, deterministic interfaces between the agent and TimeLedger.

They are responsible for:

- Validating tool input structure
- Receiving authenticated execution context
- Calling the appropriate TimeLedger application/service logic
- Returning structured, sanitized results
- Returning structured errors

Tools should not contain general LLM reasoning.

For example:

`getCategories` retrieves the category taxonomy.

It does not decide which category is semantically best for an activity.

---

## 4.4 Application / Service Layer

The TimeLedger application/service layer remains authoritative.

It is responsible for:

- User ownership
- Authorization
- Business-rule validation
- Date/time validation
- Category/subcategory ownership validation
- Activity ownership validation
- Derived values such as duration
- Database operations
- Preventing invalid application state

The normal TimeLedger UI/API and AI tools should reuse the same underlying business logic wherever possible.

```text
                 ┌── Normal UI / API
                 │
                 ▼
        TimeLedger Service Layer
                 ▲
                 │
                 └── AI Tools
```

AI-specific copies of existing business logic should be avoided.

---

# 5. Authentication and User Isolation

All AI operations must automatically operate within the currently authenticated user's data.

The LLM must never provide or choose `userId`.

Invalid design:

```json
{
  "userId": "abc123",
  "title": "LeetCode"
}
```

Correct architecture:

```text
Authenticated request
        ↓
Supabase user/session
        ↓
Server-side execution context
        ↓
AI tool
        ↓
TimeLedger service
```

Tool schemas must not expose `userId`.

Every read or mutation must enforce ownership server-side.

An ID supplied or generated through the LLM must never be trusted merely because it is syntactically valid.

---

# 6. Date, Time, and Timezone Context

Natural-language time interpretation is a core assistant requirement.

Users may say:

- today
- yesterday
- tomorrow
- Monday
- last Monday
- earlier today
- this morning
- this evening
- now
- latest
- previous activity
- earlier this week

The assistant must receive reliable server-side context containing at least:

```text
currentDateTime
timezone
```

Example:

```text
currentDateTime: 2026-10-08T09:45:00-07:00
timezone: America/Phoenix
```

The LLM uses this context to convert relative language into concrete dates/times before calling TimeLedger tools.

The assistant must not blindly assume UTC for user-relative dates and times.

---

# 7. Phase 1 Tool Inventory

Phase 1 exposes eleven tools: eight data tools plus two category-deletion tools and one structured-clarification tool.

```text
TimeLedger AI Tools
│
├── Activity Retrieval
│   ├── getActivities
│   └── getRecentActivities
│
├── Activity Mutation
│   ├── createActivity
│   ├── updateActivity
│   └── deleteActivity
│
├── Taxonomy Retrieval
│   └── getCategories
│
├── Taxonomy Mutation
│   ├── createMainCategory
│   ├── createSubCategory
│   ├── deleteMainCategory
│   └── deleteSubCategory
│
└── Clarification
    └── presentChoices
```

`presentChoices` has no side effects: it lets the model offer 2-10 selectable options. Category deletion is blocked by the existing dependency rules (no cascade). The contracts in sections 8.x cover the original eight data tools; `presentChoices` and the category-deletion tools are described in section 12.1.

Analytics/coaching tools are outside the Phase 1 tool inventory.

---

# 8. Tool Contracts

The schemas below define the intended AI-facing contracts.

Exact implementation details should remain consistent with the current TimeLedger data model and application architecture.

---

## 8.1 `getCategories`

### Purpose

Retrieve the authenticated user's Main Category/Sub Category taxonomy.

### Conceptual Result

```json
{
  "categories": [
    {
      "id": "cat_123",
      "name": "Career Growth",
      "subCategories": [
        {
          "id": "sub_123",
          "name": "LeetCode Problems"
        },
        {
          "id": "sub_456",
          "name": "System Design"
        }
      ]
    }
  ]
}
```

For the initial implementation, returning the complete taxonomy is acceptable while the taxonomy remains reasonably small.

A search/filter parameter can be introduced later if necessary.

### Boundary

The tool retrieves taxonomy.

The LLM decides which category best fits an activity.

---

## 8.2 `getActivities`

### Purpose

General-purpose activity retrieval.

The tool supports both narrow and progressively broader searches.

### Conceptual Schema

```ts
getActivities({
  date?: string,

  startDate?: string,
  endDate?: string,

  query?: string,

  mainCategoryId?: string,
  subCategoryId?: string,

  timeFrom?: string,
  timeTo?: string,

  limit?: number
})
```

### Date Filtering

For one date:

```ts
date?: string // YYYY-MM-DD
```

Example:

```json
{
  "date": "2026-10-07",
  "query": "gym"
}
```

For a range:

```ts
startDate?: string // YYYY-MM-DD
endDate?: string   // YYYY-MM-DD
```

Example:

```json
{
  "startDate": "2026-10-05",
  "endDate": "2026-10-08",
  "query": "system design"
}
```

Use either:

```text
date
```

or:

```text
startDate + endDate
```

but not both forms simultaneously.

### Text Query

```ts
query?: string
```

`query` performs deterministic, case-insensitive textual matching over useful human-readable fields such as:

- Activity title
- Activity notes
- Sub Category name
- Main Category name

Phase 1 does not require embeddings or vector search for activity retrieval.

### Category Filters

```ts
mainCategoryId?: string
subCategoryId?: string
```

These are exact filters.

When the LLM already knows a category ID, exact filtering should be preferred over textual matching where appropriate.

### Time Window

```ts
timeFrom?: string // HH:mm
timeTo?: string   // HH:mm
```

These represent an overlapping time window.

For:

```json
{
  "date": "2026-10-07",
  "timeFrom": "17:00",
  "timeTo": "19:00"
}
```

an activity from 5:30 PM to 6:45 PM matches.

### Combining Filters

Multiple filters use AND semantics.

Example:

```json
{
  "date": "2026-10-07",
  "query": "gym",
  "timeFrom": "17:00",
  "timeTo": "20:00"
}
```

means:

> Activities on October 7 matching "gym" that overlap 5 PM–8 PM.

### Limits

The backend must enforce safe result limits.

Initial recommendation:

```text
Default: 20
Maximum: 50
```

The LLM must not be able to retrieve arbitrarily large amounts of activity history in one request.

### Ordering

Results should use deterministic chronological ordering:

```text
activityDate ASC
startTime ASC
```

### Pagination

Traditional pagination is unnecessary for the initial assistant.

Instead, return truncation metadata.

Example:

```json
{
  "activities": [],
  "totalMatches": 84,
  "totalMinutes": 5040,
  "truncated": true
}
```

`truncated` is present (as `true`) only when there are more matches than returned rows; the row count is the length of `activities`.

If a search is too broad, the assistant should narrow it or ask the user for clarification rather than paging through large amounts of history.

### Conceptual Result

The model-facing form is compact, because tool results stay in the conversation and are re-sent on every later model call (see `docs/ai_token_optimization.md`):

```json
{
  "success": true,
  "activities": [
    {
      "id": 123,
      "title": "LeetCode",
      "activityDate": "2026-10-07",
      "startTime": "09:15",
      "endTime": "10:40",
      "durationMinutes": 85,
      "subCategory": "LeetCode Problems",
      "subCategoryId": 45,
      "mainCategory": "Career Growth"
    }
  ],
  "totalMatches": 1,
  "totalMinutes": 85
}
```

- `notes` appears only when non-empty. The nested `{id, name}` category objects are flattened to names plus `subCategoryId`; `mainCategory.id` is omitted (main category ids come from `getCategories`). `durationMinutes` and `totalMinutes` remain the authoritative values; `endTime` may be the internal `24:00`.
- `getRecentActivities` returns `{ success, activities }`.
- `updateActivity` returns `{ success, activity, previous }` where `previous` holds only the OLD values of the fields that changed (a null note means it was empty; `{}` if nothing changed).
- This is a view over the tool result only. Service results, REST responses and the confirmation snapshots (which keep the full activity with category ids) are unchanged.

Raw Prisma objects should not be returned unnecessarily.

---

## 8.3 `getRecentActivities`

### Purpose

Retrieve the authenticated user's most recent activities.

### Conceptual Schema

```ts
getRecentActivities({
  limit?: number
})
```

Typical requests:

- "End my latest activity now."
- "Extend my previous activity."
- "What was the last thing I logged?"

Example:

```text
"End my latest activity now."

        ↓

getRecentActivities({ limit: 1 })

        ↓

updateActivity(...)
```

The backend should enforce a safe maximum limit.

---

## 8.4 `createActivity`

### Purpose

Create one activity.

### Conceptual Schema

```ts
createActivity({
  title: string,
  activityDate: string,
  startTime: string,
  endTime: string,
  subCategoryId: string,
  notes?: string
})
```

Do not expose:

```text
userId
duration
```

If Main Category is derived from Sub Category, `mainCategoryId` should not be required either.

Authoritative derived values such as duration should be calculated by TimeLedger.

---

## 8.5 `updateActivity`

### Purpose

Update one exactly identified activity.

### Conceptual Schema

```ts
updateActivity({
  activityId: string,

  title?: string,
  activityDate?: string,
  startTime?: string,
  endTime?: string,
  subCategoryId?: string,
  notes?: string
})
```

Do not expose:

```text
userId
duration
```

### Boundary

The tool requires an exact `activityId`.

It must not search for an activity from a natural-language description.

Correct flow:

```text
User request
     ↓
getActivities(...)
     ↓
LLM resolves exactly one activity
     ↓
updateActivity(activityId, ...)
```

If multiple activities remain plausible, the assistant asks the user for clarification.

---

## 8.6 `deleteActivity`

### Purpose

Delete one exactly identified activity.

### Conceptual Schema

```ts
deleteActivity({
  activityId: string
})
```

The tool operates only on an exact activity ID.

Example:

```text
"Delete yesterday's gym activity."

        ↓

getActivities(
    date = yesterday,
    query = "gym"
)

        ↓

Resolve exact activity

        ↓

Request confirmation

        ↓

deleteActivity(activityId)
```

---

## 8.7 `createMainCategory`

### Purpose

Create a new Main Category.

### Conceptual Schema

```ts
createMainCategory({
  name: string
})
```

Additional fields should only be included if required by the existing category model.

Main Category creation requires explicit user confirmation.

---

## 8.8 `createSubCategory`

### Purpose

Create a new Sub Category under an existing Main Category.

### Conceptual Schema

```ts
createSubCategory({
  name: string,
  mainCategoryId: string
})
```

Sub Category creation requires explicit user confirmation.

---

# 9. Progressive Activity Retrieval

The assistant should retrieve the minimum data necessary to resolve the request.

When the user provides sufficient information, use a narrow search.

Example:

```text
"Change yesterday's gym activity."

        ↓

getActivities(
    date = yesterday,
    query = "gym"
)
```

For vague requests, broader retrieval may be necessary.

Example:

```text
"Change that interview preparation I did earlier this week to end at 6."

        ↓

Search bounded date range
+ query "interview preparation"

        ↓

No match

        ↓

Broaden search within the same date range

        ↓

Reason over candidates

        ↓

If multiple plausible candidates remain:
ask user
```

The agent must not guess when meaningful ambiguity remains.

Searches should remain temporally bounded whenever possible.

---

# 10. Category Resolution

Category selection is an LLM reasoning responsibility.

## Clear Existing Match

Given:

```text
Career Growth
├── LeetCode Problems
├── System Design
├── AI Concepts
└── Personal Project
```

User:

> Add LeetCode from 9:15 to 10:40.

`LeetCode Problems` is an obvious match.

The assistant can use it automatically.

No confirmation is necessary.

---

## Ambiguous Existing Match

User:

> Add interview preparation from 9:15 to 10:40.

Possible matches:

```text
LeetCode Problems
System Design
AI Interview Prep
Behavioral Interview Prep
```

The assistant should ask the user which one they mean rather than choosing arbitrarily.

---

## No Suitable Existing Match

User:

> Add Kubernetes study from 8 to 9.

If no appropriate Sub Category exists, the assistant may suggest creating one.

Example:

```text
"I don't see a suitable subcategory.
Would you like me to create Kubernetes under Career Growth?"
```

Creation only occurs after explicit user approval.

The assistant must never silently modify the user's taxonomy.

---

# 11. Confirmation Policy

Not every write operation requires confirmation.

When the user clearly commands an operation and the target is unambiguous, the original request itself provides authorization.

Policy (confirmation is enforced by the workflow; bulk operations are not designed yet):

| Operation | Behavior |
|---|---|
| Create activity with clear category | Execute |
| Update clearly identified activity | Execute |
| Use obvious existing category | Execute |
| Ambiguous activity | Ask clarification |
| Ambiguous category | Ask clarification |
| Create Main Category | Confirm |
| Create Sub Category | Confirm |
| Delete Main Category | Confirm (blocked, with the reason, if dependent data exists) |
| Delete Sub Category | Confirm (blocked, with the reason, if dependent data exists) |
| Delete activity | Confirm |
| Bulk modification | Confirm |
| Bulk deletion | Confirm |

Confirmation requirements should be enforced by the workflow rather than relying only on the LLM to remember them.

---

# 12. LangGraph Workflow

LangGraph is used because the assistant requires stateful workflows, branching, interruption, and resumption.

Basic tool loop:

```text
User
 ↓
LLM
 ↓
Tool call
 ↓
Tool result
 ↓
LLM
 ↓
Another tool call if required
 ↓
...
 ↓
Final response
```

Example confirmation workflow:

```text
User request
     ↓
LLM
     ↓
getCategories
     ↓
LLM determines new Sub Category is required
     ↓
Prepare pending action
     ↓
LANGGRAPH INTERRUPT
     ↓
Ask user for confirmation
     ↓
User approves / rejects
     ↓
LANGGRAPH RESUME
     ↓
Approved?
   ├── Yes
   │     ↓
   │ createSubCategory
   │     ↓
   │ createActivity
   │     ↓
   │ Final response
   │
   └── No
         ↓
      Return to conversation
```

Graph state may need to preserve:

- Conversation messages
- Original user request
- Tool results
- Proposed/pending action
- Confirmation state
- Resolved activity/category IDs
- Relevant date/time context

Exact graph-state implementation should follow LangGraph conventions and the needs discovered during implementation.

---

## 12.1 Implemented Confirmation Workflow (Milestone 5)

- The graph has three nodes: `agent`, `tools`, `confirm`. The `tools` node executes reads and activity create/update directly. It never executes a gated tool (`deleteActivity`, `createMainCategory`, `createSubCategory`): it validates the call, builds a server-side display, and stores a frozen **pending action** (`actionId`, `expiresAt`, validated args, display) in graph state.
- The `confirm` node raises one `interrupt()` with the user-facing payload (no tool arguments). Only after an approving resume does it execute the frozen args via the tool's normal validation/service path (delete additionally re-checks that the activity still matches what the user was shown). No LLM call occurs between approval and execution.
- `POST /api/assistant/confirm` takes `{ threadId, actionId, decision: "approve" | "reject", timezone }` and never tool arguments. While an action is pending, `POST /api/assistant/chat` returns HTTP 409 `PENDING_ACTION`. Other conflicts: `NO_PENDING_ACTION`, `STALE_ACTION`, `ACTION_EXPIRED` (30 minutes).
- Each pending action has a random server-generated `actionId`. Before resuming, the confirm flow atomically claims `(userId, threadId, actionId)` in `assistant_action_claims` (first decision wins, approve or reject). A claim conflict returns 409 `ACTION_OUTCOME_UNKNOWN` and the action is never executed again through confirmation, whether the first attempt is still running, finished, or failed midway. There is no automatic recovery: the user inspects their data and makes a fresh request.
- Rejected, expired or stale actions return a structured error to the model, which must not retry them.
- Conversation state and pending actions persist in a PostgreSQL checkpointer (schema `ai_checkpoints`).
- Chat/confirm success responses also carry `data.choices` (`{ options: [{ label, message }] }` or `null`) and `data.changes` (`[{ type }]`, type in `activity_created`, `activity_updated`, `activity_deleted`, `category_created`, `category_deleted`, or `unknown` when a turn hit the step limit). `changes` is derived server-side from successful mutating tool results, never from model prose. The UI uses it to refresh visible pages.
- Clarification vs confirmation: `presentChoices` (no side effects, no confirmation) lets the model offer 2-10 selectable options for ambiguous activities/categories (with more than 10 the assistant lists them in text and asks). The graph ends the turn after it; the options arrive as `data.choices` and the normal input stays enabled. Picking an option sends its `message` as an ordinary user message. A gated confirmation takes precedence if both occur in one step. `updateActivity` results include `previous` so replies can state exact old -> new values.
- Failure handling: a graph failure after a turn started (for example a Groq 429 after a tool ran) is returned, not thrown, with an authoritative `outcome`, derived from the thread's checkpoint (completed nodes and their tool messages are persisted, so no separate mutation tracking exists): `applied` (`changes` definitely happened, only the assistant's continuation failed; HTTP 429 `RATE_LIMITED` or 500 `ASSISTANT_UNAVAILABLE` with `data.changes`), `none` (nothing executed), or `unknown` (a node that may have mutated did not complete, or state can't be read; HTTP 409 `ACTION_OUTCOME_UNKNOWN`). Changes are counted only from messages produced by that invocation. A claimed action is never offered again: chat on a thread whose pending action was already claimed returns `ACTION_OUTCOME_UNKNOWN`, and the UI starts a new thread. Errors before anything ran (for example before the claim) keep the plain 429/500 response without `data.outcome`, and the pending confirmation stays available.
- Output limits: `AI_MAX_OUTPUT_TOKENS` (default 512) and `AI_REASONING_EFFORT` (`low` | `medium` | `high`, default `low`) configure the model call. The cap is kept near real usage; Groq's TPM pre-check ("Requested") appears to include only part of it, and the exact accounting is unverified (see `docs/ai_token_optimization.md`). A response cut off by the cap (`finish_reason: length`) that still contains a valid tool call or some text is used normally; with neither, the turn fails as `ASSISTANT_INCOMPLETE` (HTTP 500) through the normal failure path, so `changes`/`outcome` are preserved. On a 429 the provider's `Retry-After` (integer seconds, clamped to 120) is returned as `data.retryAfterSeconds` and a `Retry-After` header when present; the UI shows it, and nothing is retried automatically. `AI_LOG_USAGE=true` logs one `[ai-usage]` line per model call (token counts, cache fields, rate-limit headers; no content).
- Category deletion: `deleteMainCategory` and `deleteSubCategory` are gated like `deleteActivity`. The dependency/ownership rules live in `categoryService` (shared with the REST routes): a Main Category with sub categories, activities or weekly targets, or a Sub Category with activities or daily summaries, cannot be deleted (no cascade). Describing the action runs the same check, so a blocked deletion fails with the dependency reason and no confirmation is shown; approval re-validates the target (name must still match, dependencies re-checked). `getCategories` accepts `includeInactive` (default false) for finding inactive categories to manage.
- The confirmation payload sent to clients carries only the server-built `display.summary` per action (no ids, snapshots or arguments). Assistant replies and choice labels must never show internal ids.
- Not designed yet: bulk-update/bulk-deletion confirmation, and recovery of claimed-but-unresolved actions.

---

# 13. Multi-Step Operations

The assistant must support multiple sequential tool calls.

Example:

```text
"Change yesterday's gym activity to end at 7 PM."

        ↓

getActivities({
    date: yesterday,
    query: "gym"
})

        ↓

Exactly one activity found

        ↓

updateActivity({
    activityId: "...",
    endTime: "19:00"
})

        ↓

Final response
```

A more complex future interaction may look like:

```text
"I finished LeetCode. End my latest activity now and start Cooking."

        ↓

getRecentActivities({ limit: 1 })

        ↓

updateActivity(...)

        ↓

getCategories()

        ↓

Resolve Cooking

        ↓

createActivity(...)

        ↓

Final response
```

The agent should call only the tools necessary for the current request.

For example:

> Extend my latest activity until 2:30.

does not require fetching the category taxonomy.

---

# 14. Validation and Guardrails

Validation exists at multiple layers.

```text
User message
     ↓
LLM / Agent
     ↓
Tool schema validation
     ↓
Authorization / ownership validation
     ↓
Business-rule validation
     ↓
Application / Service Layer
     ↓
Database
     ↓
Sanitized tool result
     ↓
LLM
     ↓
User response
```

## Tool Schema Validation

Validate structural correctness such as:

- Required fields
- Data types
- Date formats
- Time formats
- Allowed values
- Maximum limits

---

## Authorization and Ownership

Verify server-side that:

- Activities belong to the authenticated user
- Main Categories belong to the authenticated user
- Sub Categories belong to the authenticated user
- Referenced resources cannot cross user boundaries

Never trust IDs simply because the LLM supplied them.

---

## Business Validation

The authoritative TimeLedger layer should enforce rules such as:

- Valid dates
- Valid start/end times
- Valid time ranges
- Valid category relationships
- Required fields
- Existing overlap rules, if applicable
- Other current TimeLedger constraints

The AI layer must not replace authoritative application validation.

---

## Output Guardrails

Tool results should expose only information required for assistant reasoning.

Avoid unnecessarily returning:

- Raw Prisma records
- Authentication data
- Database implementation details
- Internal application metadata
- Irrelevant fields

---

# 15. Structured Tool Results and Errors

Tools should return structured application-level results.

Example successful activity result:

```json
{
  "success": true,
  "activity": {
    "id": "act_123",
    "title": "LeetCode",
    "activityDate": "2026-10-08",
    "startTime": "09:15",
    "endTime": "10:40",
    "durationMinutes": 85,
    "subCategory": "LeetCode Problems",
    "subCategoryId": 45,
    "mainCategory": "Career Growth"
  }
}
```

Raw Prisma/database exceptions should not be exposed to the LLM.

Example error:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TIME_RANGE",
    "message": "End time must be after start time."
  }
}
```

Potential application-level error codes include:

```text
ACTIVITY_NOT_FOUND
CATEGORY_NOT_FOUND
SUBCATEGORY_NOT_FOUND
INVALID_DATE
INVALID_TIME
INVALID_TIME_RANGE
UNAUTHORIZED_RESOURCE
VALIDATION_ERROR
```

The exact error taxonomy should align with existing application conventions.

Structured errors allow the LLM to decide whether to:

- Correct a tool call
- Perform another lookup
- Ask for clarification
- Explain the problem to the user

---

# 16. Privacy Principles

The assistant follows a least-data principle.

Retrieve only what is necessary for the current request.

Prefer:

```text
specific date
+
specific query
```

over large historical retrievals.

Use:

- Bounded date ranges
- Safe result limits
- Sanitized result objects
- User-scoped queries

The future Productivity Coach should use aggregated Analytics Engine tools rather than routinely exposing large amounts of raw activity history to the LLM.

---

# 17. Future — Analytics and Productivity Coach

The conversational assistant may later become the interface for the AI Productivity Coach.

Example requests:

- "How was my productivity this week?"
- "Compare my career preparation over the last four weeks."
- "Where am I losing the most time?"
- "What should I improve next week?"

These should use controlled Analytics Engine tools rather than having the LLM retrieve large amounts of raw activities and calculate analytics itself.

```text
User
 ↓
AI Assistant
 ↓
LLM / LangGraph
 ↓
Analytics Engine Tools
 ↓
Aggregated structured analytics
 ↓
LLM
 ↓
Personalized explanation/coaching
```

Potential future tools include:

```text
getWeeklySummary
compareWeeks
getCategoryTrends
getTargetPerformance
getTimeDistribution
```

The Analytics Engine remains a separate controlled application capability.

---

# 18. Future — Voice Input

Voice is intentionally deferred until the text assistant is stable.

The architectural requirement is:

```text
                Typed text
                    │
                    ▼
              AI Assistant
                    ▲
                    │
Voice → Speech-to-text
```

Speech-to-text may use Whisper or another appropriate transcription model.

The resulting transcription enters the same assistant pipeline.

The following remain unchanged:

- LangGraph workflow
- TimeLedger tools
- Authentication
- Confirmation rules
- Validation
- Business logic

Voice adds input convenience, not a second agent architecture.

---

# 19. Core Design Principles

1. **The LLM never accesses the database directly.**

   All TimeLedger access happens through controlled tools.

2. **The LLM never provides `userId`.**

   Authenticated server context determines the user.

3. **LangGraph orchestrates workflows; it does not contain TimeLedger business logic.**

4. **Tools are deterministic.**

   Reasoning belongs to the LLM. Application operations belong to tools/services.

5. **Reuse existing business logic.**

   Do not create AI-specific copies of activity/category business rules when existing logic can be reused or extracted into shared services.

6. **Retrieve the minimum necessary data.**

   Prefer narrow, bounded searches.

7. **Never guess when meaningful ambiguity exists.**

   Ask the user.

8. **Do not over-confirm.**

   Clear explicit user commands should execute without unnecessary additional approval.

9. **Protect destructive and taxonomy-changing operations.**

   Deletion, category creation, and bulk mutations require confirmation.

10. **Backend validation is authoritative.**

    Never rely on the LLM for correctness or security.

11. **Tool inputs and outputs are contracts.**

    Use strict schemas, sanitized results, and structured errors.

12. **Voice remains an input adapter.**

    Do not duplicate the assistant architecture for voice.