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

**Status:** Completed (Main and Sub Category APIs implement the Main Category > Sub Category hierarchy; current behavior is documented in `api.md`.)

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

## Dashboard API

* GET /api/dashboard

The Dashboard API should return all data required to render the Dashboard in a single response.

The backend is responsible for:

* Fetching today's activities
* Fetching Daily Sub Category Summaries
* Deriving Main Category summaries
* Fetching Weekly Targets
* Calculating Remaining Time
* Calculating Progress Percentage

---

## Dashboard UI

### Quick Actions

* Add Activity

### Today's Summary

* Summary by Main Category
* Summary by Sub Category

### Today's Timeline

* Chronological list of today's activities
* Edit activity
* Delete activity

### Current Week Progress

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

Interactive dashboard powered by a dedicated Dashboard API.

---

# Phase 8 - Analytics

Implement:

## Analytics API

* GET /api/analytics

The Analytics API should return all data required to render the Analytics page in a single response.

The backend is responsible for:

* Deriving Main Category summaries from Daily Sub Category Summaries
* Preparing comparison datasets
* Preparing trend datasets

---

## Analytics UI

Implement:

* Weekly Main Category comparison
* Weekly Sub Category comparison
* Monthly Main Category comparison
* Monthly Sub Category comparison
* Productivity trends over time

Analytics should use:

* Daily Sub Category Summaries
* Weekly Targets

Main Category summaries should be derived from Daily Sub Category Summaries.

Deliverable:

Analytics page powered by a dedicated Analytics API.

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

---

# Project Status

## Version 1.0 Completed

The implementation has evolved beyond the original planning document.

The core MVP has been successfully completed with several enhancements and architectural improvements discovered during development and real-world usage.

Implemented:

- Dashboard
- Activities
- Categories
- Weekly Targets
- Analytics
- Responsive UI
- Accessibility improvements
- Authentication (Google Sign-In)
- User-scoped data isolation
- Protected API routes
- Protected pages
- Logout
- Production deployment (Vercel + Supabase)

Additional implementation details and refinements are documented in:

- `ui_refinement_plan.md`
- `auth_phase_plan.md`

The current application behavior is documented in:

- `database.md`
- `api.md`
- `ui.md`

Future enhancements will be tracked separately in `BACKLOG.md`.

---

# Phase 10 - AI Assistant

Add a conversational AI interface that allows TimeLedger operations to be performed through natural language.

Detailed AI architecture, tool contracts, safety rules, and agent behavior are documented in `docs/ai.md`.

## Phase 10A - Text-Based AI Assistant

### Milestone 1 - AI Tool Foundation

Implement the controlled interface between the AI Assistant and TimeLedger.

Scope:

- Inspect and reuse existing application/service logic
- Add authenticated AI tool execution context
- Define tool schemas
- Implement activity retrieval tools
- Implement activity mutation tools
- Implement taxonomy retrieval/mutation tools
- Add structured tool results
- Add structured application-level errors
- Enforce user ownership and validation

Initial tools:

- `getCategories`
- `getActivities`
- `getRecentActivities`
- `createActivity`
- `updateActivity`
- `deleteActivity`
- `createMainCategory`
- `createSubCategory`

**Status:** Complete

---

### Milestone 2 - LLM and LangGraph Foundation

Integrate the conversational reasoning/orchestration layer.

Scope:

- Configure LLM provider
- Integrate LangGraph
- Register TimeLedger tools
- Define assistant system instructions
- Supply current date/time and timezone context
- Implement LLM → tool → LLM execution loop
- Support multiple sequential tool calls
- Define initial graph/conversation state

**Status:** Complete

---

### Milestone 3 - Core Activity Workflows

Support natural-language activity management.

Scope:

- Create activities
- Retrieve/search activities
- Update activities
- Delete activities
- Resolve latest/previous activity
- Exact-date retrieval
- Date-range retrieval
- Text-based retrieval
- Time-window retrieval
- Relative date/time interpretation
- Multi-step activity operations

**Status:** Implemented — deterministic checks pass; targeted live-model regression evaluation pending (optional, Groq quota)

Implemented: `totalMinutes` (service-calculated total across all matches), compact workflow prompt, code-computed
calendar block (today/yesterday/this & last week/last 7 days), delete intent resolution (confirmation workflow added in
Milestone 5), opt-in behavioral evaluator `scripts/ai-eval.mjs`.

Live evaluation: run only the unresolved scenarios (#4, #6, #9, #10, #11, #12, #13, #16), one run each; fix and
re-run only failures. The full suite is not required and is not run automatically.

---

### Milestone 4 - Intelligent Category Resolution

Allow the assistant to reason over the existing Main Category/Sub Category taxonomy.

Scope:

- Fetch taxonomy only when required
- Match obvious existing categories
- Use clear matches without unnecessary confirmation
- Detect ambiguous category matches
- Ask for clarification when required
- Detect when no suitable category exists
- Suggest new Main Categories/Sub Categories

**Status:** Implemented — deterministic checks pass; targeted live-model regression evaluation pending (optional, Groq quota)

Implemented: category-resolution rules in the system prompt (clear / explicit / ambiguous / no-match, thread
taxonomy reuse; creating categories was deferred to Milestone 5 and is now available there), `getCategories`
description update (contract unchanged). Live scenarios #21-#25 in `scripts/ai-eval.mjs` run later together with
the unresolved Milestone 3 scenarios (one run each, targeted).

---

### Milestone 5 - Human-in-the-Loop Safety

Add stateful confirmation workflows using LangGraph.

Confirmation is required for:

- Main Category creation
- Sub Category creation
- Activity deletion
- Bulk updates
- Bulk deletion

Scope:

- Pending action state
- LangGraph interruption
- User approval/rejection
- Workflow resumption
- Safe cancellation
- Handling conversation changes while confirmation is pending

**Status:** Implemented — deterministic checks pass (memory and PostgreSQL checkpointers); targeted live-model regression evaluation pending (optional, Groq quota)

Implemented: three-node interrupt workflow (`agent` / `tools` / `confirm`), frozen pending action in graph state,
server-generated confirmation display, `POST /api/assistant/confirm` (approve/reject by `actionId`), `PENDING_ACTION`
response for chat while a confirmation is pending, 30-minute expiry, stale-target check for deletes, durable
PostgreSQL checkpointer (schema `ai_checkpoints`, created by `scripts/ai-setup-checkpointer.mjs`), removal of the
`AI_ENABLE_ACTIVITY_WRITES` flag, at-most-once action resolution via `assistant_action_claims` (migration applied
manually, not yet in Prisma migration history; see docs/database.md). Out of scope (not designed yet): bulk
update/delete confirmation, recovery of claimed-but-unresolved actions. Live eval scenarios #13, #23 (updated) and #26-#28 (new) run later with the targeted Groq pass.

---

### Milestone 6 - Assistant UI

Build the text-based conversational interface.

Scope:

- Assistant chat interface
- User and assistant messages
- Loading/tool execution states
- Confirmation UI
- Error states
- Appropriate retry behavior
- Mobile responsiveness
- Streaming responses if appropriate (not implemented by decision: non-streaming)

**Status:** Complete. Implemented as a floating assistant (desktop/tablet right-side panel, mobile full-screen sheet), non-streaming, and manually verified in the browser. Refinements made after manual testing: safe Markdown replies, structured clarification choices, mutation `changes` that refresh the visible page, resolved-confirmation records, authoritative partial-success/failure outcomes, no database ids in replies, and category deletion (confirmed, dependency-checked). Token and rate-limit optimization is recorded in `docs/ai_token_optimization.md`.

**Remaining optional live-model regression evaluation (not part of implementation/UI completion):** a single targeted pass of `scripts/ai-eval.mjs` over the scenarios not yet run against Groq (M3 #4, #6, #9-#13, #16; M4 #21-#25; M5 #13, #23, #26-#28; M6 #29-#33), to be run only when quota is available and approved, fixing and re-running only failures.

---

### Milestone 7 - Reliability and Hardening

Validate the assistant against failure cases and security boundaries.

Scope:

- Tool schema tests
- Authorization tests
- User-isolation tests
- Service-layer validation tests
- Agent workflow tests
- Confirmation workflow tests
- Ambiguous activity/category cases
- Invalid date/time handling
- Tool/database failure handling
- Multi-step partial failures
- Excessively broad retrieval
- Safe logging

**Status:** Pending

---

## Phase 10B - Voice Input

Add speech-to-text as an alternative input method for the existing TimeLedger Assistant.

Voice reuses the complete Phase 10A assistant architecture:

```text
Voice
  ↓
Browser Recording
  ↓
Speech-to-text
  ↓
Review / Edit
  ↓
Existing Text Assistant
  ↓
Existing LangGraph + Tool Pipeline
```

Initial decisions:

- Tap to start recording; tap again to stop.
- Always show the transcription for review/editing before Send.
- Never automatically submit a transcription.
- Test English first while keeping the transcription layer language-agnostic where practical.
- Do not persist recorded audio.
- Do not create separate voice-agent logic.

**Status:** Planned

### Milestone 1 - Speech-to-Text Foundation

Build the server-side transcription capability independently of the assistant UI.

Scope:
- Select and configure the speech-to-text provider/model.
- Start with Groq-hosted Whisper Large V3 Turbo, subject to implementation-time verification.
- Isolate provider-specific transcription code.
- Add an authenticated transcription endpoint.
- Accept supported audio input safely.
- Validate request/audio type and size.
- Define reasonable recording/request limits.
- Transcribe audio and return text only.
- Handle provider errors and rate limits.
- Do not execute assistant tools.
- Do not persist audio.

**Status:** Implemented — deterministic checks pass (`node scripts/stt-check.mjs`, lint, build, unauthenticated 401); live transcription verification pending (real-audio test to be approved separately)

---

### Milestone 2 - Voice Recording UI

Add audio recording to the existing floating assistant.

Scope:
- Add a microphone control to the existing assistant input.
- Tap once to start recording.
- Tap again to stop.
- Show clear recording state.
- Handle microphone permission request/denial.
- Allow recording cancellation.
- Show stopping/transcribing states.
- Keep the existing text input and assistant layout.
- Support desktop panel and mobile full-screen assistant.
- Disable voice recording whenever normal assistant input is disabled.

**Status:** Implemented — recording UI and draft population built; deterministic checks pass (`scripts/voice-check.mjs`, lint, build). Manual microphone verification (desktop Chrome/Safari, iPhone Safari on a Vercel preview) and the live Groq transcription test are pending. Transcription populates the editable draft; nothing is auto-submitted.

---

### Milestone 3 - Transcription Review and Chat Integration

Connect voice transcription to the existing text-assistant workflow.

Scope:
- Send completed recordings to the transcription endpoint.
- Place returned transcription into the existing chat input.
- Allow the user to review and edit the transcription.
- Require explicit Send before the transcription enters the assistant pipeline.
- Reuse the current thread and existing /api/assistant/chat flow.
- Preserve clarification and confirmation behavior.
- Handle transcription errors without modifying conversation/application state.
- Test English first while keeping the implementation language-agnostic where practical.

**Status:** Not started

---

### Milestone 4 - Voice Verification and Production Readiness
Validate voice input across real TimeLedger usage.

Scope:
- Test desktop browser recording.
- Test mobile browser / installed shortcut experience.
- Test microphone permission flows.
- Test cancellation and transcription failures.
- Test common TimeLedger terminology and category names.
- Test dates, times and relative-time phrases.
- Test multi-action spoken requests.
- Verify transcription review prevents unintended execution.
- Verify audio is not persisted.
- Verify authentication and request limits.
- Verify provider rate-limit/error handling.
- Configure production environment variables.
- Update README and final documentation after deployment.

**Status:** Not started

