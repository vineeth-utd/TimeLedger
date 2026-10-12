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

## Light / Dark Theme (Small UI Enhancement)

Added after the AI Assistant and Voice milestones as a small, explicitly approved personalization enhancement; not a separate phase.

- Global Light/Dark toggle (Sun/Moon) in the authenticated navigation, desktop and mobile
- First visit follows the browser/OS preference; an explicit choice is saved in `localStorage` and takes precedence afterward
- No wrong-theme flash (inline init script before first paint); no theme library
- Class-based dark mode with semantic neutral tokens plus explicit `dark:` variants for status/accent colors; charts and the floating Assistant included
- No database, API, authentication or AI changes
- Verified manually on light/dark, desktop and mobile/home-screen usage

**Status:** Complete. See `ui.md` (Theme).

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

**Status:** Complete — Milestones 1–4 complete; verified on desktop Chrome, Android mobile and the Android home-screen shortcut. iOS/Safari was not tested (see Milestone 4).

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

**Status:** Complete — deterministic checks pass (`node scripts/stt-check.mjs`, lint, build, unauthenticated 401); live Groq transcription verified through real microphone recordings in production.

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

**Status:** Complete — recording UI and draft population; deterministic checks pass (`scripts/voice-check.mjs`, lint, build); verified with real microphones on desktop Chrome, Android mobile and the Android home-screen shortcut. Transcription populates the editable draft; nothing is auto-submitted.

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

**Status:** Complete — the draft/Send flow was delivered in M2; M3 added post-transcription focus/caret, locking of choices/New conversation/suggestions during voice, and screen-reader announcements. Deterministic checks, lint and build pass; verified in production (review/edit, explicit Send, existing assistant flow). No voice metadata, separate send path or server changes.

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
- Verify audio is not persisted or logged by the speech-to-text layer (the reviewed text, once sent, is a normal assistant message).
- Verify authentication and request limits.
- Verify provider rate-limit/error handling.
- Configure production environment variables.
- Update README and final documentation after deployment.

**Reduced verification plan:** deterministic checks (`scripts/stt-check.mjs` incl. provider/HTTP error mapping, `scripts/voice-check.mjs`, lint, build); cancel, too-short, panel-close, permission-denied and the 60 s auto-stop (browser offline, no Groq call) checked manually without transcription; real voice flows: one desktop Chrome, one iPhone Safari on a Vercel Preview (through confirmation, mutation and page refresh; record the MIME/container produced), one iPhone home-screen-shortcut transcription, plus one optional clarification/multi-action case. If WebM proves problematic on Safari, prefer MP4 first for Safari only.

**Completion criteria:** deterministic checks pass on the deployed commit; the live flows above pass on the Preview/Production URL; no audio persisted or logged by the speech-to-text layer; microphone released on every exit path; production env confirmed; README/docs updated.

**Result:** Voice input was verified on the deployed main build.

| Platform | Result |
|---|---|
| Desktop Chrome (production) | Passed |
| Android mobile browser | Passed |
| Android home-screen shortcut (normal mobile usage) | Passed |
| iPhone/iOS Safari and macOS Safari | **Not tested** (no device available). Unverified platform, not a known defect |

Verified in production (deployed main build): real microphone recording, Stop, Groq Whisper transcription with good accuracy; the transcription appears as an editable draft and is never sent automatically; the microphone is released after Stop and Cancel; review/edit, Send and the existing assistant flow; confirmation, mutation and automatic page refresh.

Deterministic checks (`scripts/stt-check.mjs`: 9 checks incl. provider/HTTP error mapping with a stubbed provider; `scripts/voice-check.mjs`: 6 checks), lint of the voice/STT files and the production build pass. Cancel, too-short recordings, permission denial, the 60 s auto-stop and provider rate-limit/error mapping are covered by the deterministic checks and implementation review rather than separate recorded device tests.

**Known limitations / unverified:** iOS/macOS Safari is untested, so the MP4/AAC recording path (and Safari's WebM support) is unverified on real devices; if WebM proves problematic on Safari, prefer MP4 first for Safari only. Whisper can hallucinate short phrases on silence (mitigated by the mandatory review before Send). Transcription has no per-user rate limit beyond Groq's own. iOS may not raise the keyboard after dictation.

**Status:** Complete

---

## Configurable AI Provider (Groq | OpenAI-compatible)

Small enhancement after Phase 10B: `AI_PROVIDER` and `STT_PROVIDER` (`groq` default | `openai-compatible`) select the LLM and speech-to-text providers independently from environment variables, using An OpenAI-compatible API (`OPENAI_COMPATIBLE_API_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`). Groq behaviour and defaults are unchanged. OpenAI-compatible does not receive `reasoning_effort`. No graph, tool or UI changes.

**Status:** Implemented and verified deterministically (`scripts/provider-check.mjs`). Live OpenAI-compatible chat/tool-call and transcription checks pending.

Model, output-token cap and reasoning settings are per provider (`GROQ_*` / `OPENAI_COMPATIBLE_*`); the shared `AI_MODEL`, `STT_MODEL`, `AI_MAX_OUTPUT_TOKENS` and `AI_REASONING_EFFORT` no longer exist.

## Assistant Duration Wording (Small UX Enhancement)

Assistant replies show durations as hours and minutes (`2 hrs 34 mins`) instead of raw minutes. The model still reports whole minutes; the server deterministically rewrites clear integer durations in the final reply (`src/lib/ai/durationText.js`). Internal values, tool results and API contracts are unchanged. Verified by `scripts/duration-text-check.mjs`.

---

# Phase 11 - AI Productivity Agent

Add an opt-in AI Productivity Agent that proactively analyzes completed weeks, generates personalized weekly productivity reports, stores them in TimeLedger, and optionally delivers them by email.

The initial version focuses on weekly review and coaching. More advanced multi-week analysis and interactive productivity coaching may be added later.

## Product Behavior

The AI Productivity Agent is an optional per-user feature and is disabled by default.

When the AI Productivity Agent is disabled:

- No scheduled productivity-agent LLM runs occur for the user.
- No new weekly AI reports are generated.
- No weekly report emails are sent.
- Previously generated reports remain available.

When the AI Productivity Agent is enabled:

- A weekly report is generated automatically after the previous week is complete.
- The report is persisted and available from the AI Productivity Agent page.
- Weekly email delivery is controlled by a separate per-user setting.

Weekly email behavior:

- AI Productivity Agent ON + Weekly Email Reports OFF → generate and persist the report, but do not email it.
- AI Productivity Agent ON + Weekly Email Reports ON → generate, persist, and email the report.
- AI Productivity Agent OFF → generate nothing and send nothing, regardless of the saved email preference.
- Disabling the parent feature does not need to erase the saved email preference.

The initial automated report compares:

- the previous completed week; and
- the completed week immediately before it.

The architecture should allow additional historical periods to be analyzed later without requiring the initial implementation to retrieve them.

---

## Milestone 1 - Analytics & Report Data Foundation

Build the deterministic analytics foundation required by the AI Productivity Agent.

Before adding new analytics logic, inspect the existing Analytics implementation and reuse or extract existing calculations wherever practical.

The LLM must not calculate authoritative analytics values that TimeLedger can calculate deterministically.

Scope:

- Inspect the current Analytics frontend/backend/service logic.
- Reuse existing Daily Sub Category Summaries and Weekly Targets.
- Build a server-side weekly report-data service.
- Retrieve the previous completed week and the completed week before it.
- Include both Main Category and Sub Category summaries.
- Derive Main Category totals from existing summary data where appropriate.
- Include weekly targets for Main Categories.
- Calculate deterministic target-vs-actual metrics.
- Calculate target achievement/deviation.
- Calculate week-over-week absolute changes.
- Calculate week-over-week percentage changes where meaningful.
- Identify deterministic largest increases/decreases where useful.
- Return a compact structured dataset suitable for later LLM interpretation.
- Keep all reads scoped to the authenticated user.
- Do not expose raw activity history to the LLM when summary data is sufficient.
- Do not add LLM report generation yet.

The output of this milestone should clearly separate:

- deterministic facts calculated by TimeLedger; and
- interpretation that will later be performed by the LLM.

**Status:** Complete

Implemented in `src/lib/analytics/reportMetrics.js` (pure calculations), `src/lib/services/weeklyReportService.js` (user-scoped read of `daily_sub_category_summaries` + explicit `weekly_targets`) and `getWeekStartMondayForDate` in `src/lib/timezone.js`. Explicit targets only (no previous-week fallback; missing or 0 target → `null`). The existing Analytics page and Dashboard route were intentionally not refactored. Verified by `scripts/weekly-report-check.mjs`.

---

## Milestone 2 - Productivity Agent Data & Preferences

Add the persistence required for the AI Productivity Agent and weekly reports.

Scope:

- Add a user-scoped feature/preferences model suitable for this feature and future optional TimeLedger features.
- Store whether the AI Productivity Agent is enabled.
- Store whether Weekly Email Reports are enabled.
- Both settings default to disabled.
- Keep the email preference independent from the parent feature preference.
- Store or otherwise establish the user's IANA timezone required for scheduled weekly processing.
- Add persisted weekly report records.
- Store the report's target week and generation state.
- Store generated report content in a structured form suitable for rendering in TimeLedger and email.
- Track generation timestamps and relevant failure state.
- Enforce user ownership for preferences and reports.
- Define an idempotency key/constraint so one user/week represents one scheduled weekly report.
- Design report state so concurrent/repeated scheduler invocations cannot generate duplicate scheduled reports.
- Preserve historical reports when the feature is disabled.
- Do not add scheduled execution yet.
- Do not add email delivery yet.

The exact schema and state model should be finalized after inspecting the existing Prisma/authentication architecture.

**Status:** Complete (code and migration SQL; not yet applied to the Supabase database)

Implemented as `user_preferences` and `weekly_reports` (see `docs/database.md` sections 7-8; migration `20261011120000_add_productivity_agent_tables`), `src/lib/services/productivityAgentService.js` (preference defaults, validation and derived behavior), and `src/lib/analytics/reportStatus.js`. One report row per user/week with insert-as-claim semantics; M1 facts are snapshotted on the report. Verified offline by `scripts/productivity-agent-check.mjs`. Retry leases, email-delivery state and report APIs belong to later milestones.

---

## Milestone 3 - AI Weekly Report Generation

Generate personalized weekly productivity reports from the deterministic analytics produced by Milestone 1.

The LLM is responsible for interpretation and recommendations, not authoritative calculations.

Scope:

- Use the configured TimeLedger LLM provider/model.
- Provide the LLM with the structured two-week analytics dataset.
- Analyze Main Category and Sub Category changes.
- Interpret target-vs-actual performance.
- Identify meaningful improvements, regressions and shifts in time allocation.
- Avoid presenting speculative causes as facts.
- Avoid automatically treating increased leisure/break time or reduced career/productivity time as inherently negative.
- Distinguish observed facts from interpretations or possible explanations.
- Generate a concise weekly overview.
- Generate category-level observations where useful.
- Generate a small number of actionable recommendations for the upcoming week.
- Keep recommendations grounded in the supplied TimeLedger analytics.
- Produce a structured report that can be rendered consistently in both the application and email.
- Persist the generated report.
- Support manual report generation for development/quality evaluation before scheduling is introduced.
- Handle insufficient or missing weekly data gracefully.
- Keep LLM access behind controlled application/service boundaries; the LLM must never access Prisma or the database directly.

Initial report sections should include, where meaningful:

- Week overview
- Target vs Actual
- Week-over-week changes
- Main Category insights
- Sub Category insights
- AI observations
- Recommendations for the next week

Report quality should be manually evaluated before scheduled generation is implemented.

**Status:** Implementation complete (offline-verified; live-model quality evaluated on five synthetic fixtures with prompt `weekly-report-v5.1`). **Live persistence verified** against the real database during the Milestone 4 manual verification (report generated and persisted as `completed`).

Implemented in `src/lib/ai/report/` (prompt + compact input with a deterministic data-coverage signal, schema/validation/normalization/number guard, generation), `src/lib/services/weeklyReportGenerationService.js` (claim -> M1 facts -> model -> persist), per-provider report output caps (`GROQ_REPORT_MAX_OUTPUT_TOKENS` / `OPENAI_COMPATIBLE_REPORT_MAX_OUTPUT_TOKENS`, default 2048) and an OpenAI-compatible-only report reasoning effort (`OPENAI_COMPATIBLE_REPORT_REASONING_EFFORT`, baseline `low`). See `docs/ai.md` section 18C. Verified by `scripts/weekly-report-generation-check.mjs`; the opt-in live evaluation is `scripts/weekly-report-eval.mjs` (dry run, no database writes).

---

## Milestone 4 - AI Productivity Agent Page

Add the user-facing AI Productivity Agent experience.

Scope:

- Add an AI Productivity Agent page for authenticated users.
- Allow the user to enable or disable the AI Productivity Agent.
- Keep the feature disabled by default.
- When disabled, show a concise explanation of the feature and an option to enable it.
- Allow Weekly Email Reports to be enabled or disabled separately.
- Make it clear that email delivery only applies while the AI Productivity Agent is enabled.
- Display the latest generated weekly report.
- Display historical weekly reports.
- Allow users to inspect previously generated reports after disabling the feature.
- Provide appropriate loading, empty and error states.
- Support manual report generation/regeneration where appropriate.
- Keep the page responsive and consistent with the existing TimeLedger UI.
- Enforce authenticated user ownership for all report/preference operations.

Do not introduce a general Settings page solely for this feature.

**Status:** Complete. Offline-verified, then manually verified in the browser against the real database and model after the M2 migration was applied. One UI defect found there (the Generate action did not appear after enabling the Agent until a refresh, because the generation target week was not reloaded once the timezone was stored) is fixed.

Implemented as `/productivity-agent` (`src/app/productivity-agent`, `src/components/productivity-agent`), `/api/productivity-agent/{preferences,reports,reports/[id]}` and `listWeeklyReports` / `getWeeklyReport` / `requestWeeklyReportGeneration` in `productivityAgentService.js`. Decisions: manual generation targets only the latest completed week and is blocked while the Agent is disabled; failed reports can be retried, completed reports are not regenerated; stale `generating` recovery is deferred to Milestone 5; the Weekly Email Reports toggle is hidden until Milestone 6 (the preference remains supported by the API). See `docs/api.md` and `docs/ui.md`.

---

## Milestone 5 - Scheduled Weekly Generation

Automatically generate weekly reports for eligible users.

Scope:

- Add scheduled/background execution suitable for the deployed TimeLedger environment.
- Evaluate the simplest reliable scheduling mechanism supported by the current Vercel deployment before adding new infrastructure.
- Run scheduled eligibility checks for users with the AI Productivity Agent enabled.
- Respect each user's local timezone when determining when a completed week is ready for review.
- Generate the report only after the previous local week has completed.
- Use the persisted report/idempotency state to prevent duplicate scheduled generation.
- Safely handle repeated or concurrent scheduler invocations.
- Claim report-generation work before invoking the LLM.
- Add bounded retry behavior for clearly retryable generation failures.
- Do not retry indefinitely.
- Persist generation failures/status so they are visible and recoverable.
- Allow failed reports to be generated manually later.
- Users with the AI Productivity Agent disabled must not cause scheduled LLM calls.
- Email delivery must not be required for scheduled report generation.

**Status:** Complete. Offline-verified via `scripts/weekly-report-scheduler-check.mjs`.

Implemented as `vercel.json` (daily cron at 12:00 UTC conforming to Vercel Hobby constraints), `GET /api/cron/weekly-reports` (constant-time `CRON_SECRET` bearer auth, `maxDuration = 60`), `weeklyReportSchedulerService.js` (`findEligibleScheduledUsers`, `processScheduledWeeklyReports`), and enhanced `claimReport` in `weeklyReportGenerationService.js`. Key decisions: catch-up semantics (the latest completed week remains eligible across any day of the week until completed or retry cap reached); bounded execution (default max batch size 3, 45 s budget); 10-minute stale lease recovery for crashed/abandoned `generating` rows; max 3 scheduled attempts with failed/exhausted reports remaining recoverable via manual user retry in the UI. See `docs/api.md`.

---

## Milestone 6 - Weekly Report Email Delivery

Optionally deliver generated weekly reports by email.

Email delivery is a separate opt-in from enabling the AI Productivity Agent.

Scope:

- Determine and implement the simplest reliable email-delivery mechanism suitable for TimeLedger.
- Use the authenticated user's account email as the report recipient where available.
- Do not require the LLM to generate the report again for email delivery.
- Render email content from the persisted weekly report.
- Send email only when both:
  - the AI Productivity Agent is enabled; and
  - Weekly Email Reports are enabled.
- Track email-delivery state separately from report-generation state.
- Track successful delivery time.
- Track delivery failures without losing the generated report.
- Add bounded retry behavior for clearly retryable email failures.
- Avoid blindly resending when the delivery outcome is unknown.
- Support manual resend of an already-generated report where appropriate.
- Manual resend must reuse the persisted report rather than invoke the LLM again.
- Do not expose authentication credentials or email-provider secrets to the browser.

The email mechanism should be finalized during this milestone rather than coupling the earlier report-generation milestones to a specific email provider.

**Status:** Complete — Resend via HTTPS fetch (`https://api.resend.com/emails`), recipient retrieved from Supabase Auth (`getAuthenticatedUser` / `admin.getUserById`), persisted `facts` + `content` email rendering (HTML + text), independent email delivery status (`sending`, `sent`, `failed`), 5-min stale lease, max 3 scheduled attempts, no automatic retry on ambiguous outcome (`EMAIL_UNKNOWN_OUTCOME`), manual Send/Retry/Resend in UI (`POST /api/productivity-agent/reports/:id/email`), preference toggle exposed, server secrets preserved. Deterministic offline checks pass (`scripts/weekly-report-email-check.mjs`, lint, regression suites). Live migration and real delivery deferred for deployment.

---

## Milestone 7 - Reliability and Production Readiness

Validate the AI Productivity Agent end to end.

Scope:

- Analytics correctness.
- Main Category and Sub Category report accuracy.
- Target-vs-actual calculations.
- Week-over-week calculations.
- User preference behavior.
- Feature disabled/enabled behavior.
- Email preference behavior.
- User isolation and authorization.
- Historical report access.
- Manual generation/regeneration.
- Manual email resend.
- Scheduler authentication/security.
- Scheduler idempotency.
- Concurrent scheduler invocations.
- Duplicate-generation prevention.
- User timezone/week-boundary behavior.
- Missing or insufficient weekly data.
- LLM provider failures.
- LLM rate limits/timeouts.
- Invalid or incomplete LLM report output.
- Email provider failures.
- Unknown email-delivery outcomes.
- Bounded retry behavior.
- Disabling and re-enabling the feature.
- Responsive desktop/mobile UI.
- Production scheduler behavior.
- Safe logging with no report content, credentials or private user data unnecessarily logged.

Update the relevant architecture, database, API, UI and README documentation only as the corresponding implementation becomes authoritative.

**Status:** Complete — Hardened scheduler loop with per-user email failure containment; safe distinction between Supabase Admin config missing (`EMAIL_CONFIG_MISSING`) and missing recipient (`EMAIL_RECIPIENT_MISSING`) without crashing background processing; audited safe logging across Phase 11 (no credentials, prompts, report bodies, recipient emails, or raw third-party error messages in logs; safe error codes only); added deterministic reliability checks (`scripts/weekly-report-reliability-check.mjs`); verified all Phase 11 test suites (107/107 total assertions passing), ESLint clean, and production build succeeded. Authoritative documentation updated across README, database, UI, AI, and planning docs.