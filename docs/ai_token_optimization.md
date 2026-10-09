# AI token / rate-limit optimization: decision log

Engineering record of the token and rate-limit work on the text assistant. Facts, decisions and
measurements only. `docs/ai.md` remains the source of truth for architecture and contracts.

## Context
- Provider/model: Groq on the free/on-demand tier. Early measurements used `openai/gpt-oss-20b`; from the Batch 1 live runs onward the baseline is **`openai/gpt-oss-120b`** (fixed for all further comparisons), `reasoningEffort=low`, `maxTokens=512`. Limits: 8,000 TPM, 200k TPD, 1,000 RPM.
- Symptom: ordinary multi-step requests hit 429 (TPM) even for simple actions.
- Each user turn is an agent loop: every model call re-sends the system prompt, all tool
  definitions and the full conversation (checkpointed messages, including tool results).

## Tooling added
- `AI_LOG_USAGE=true` (`src/lib/ai/usageLog.js`): one `[ai-usage]` line per model call with call
  number, status, model, kind (tool calls / final), tool names, prompt / cached / uncached /
  completion / reasoning / total tokens, `maxTokens`, `reasoningEffort`, message and tool counts, and
  Groq rate-limit headers. 429 lines include Groq's error text. No message text, arguments,
  results or credentials are logged. `cached`/`uncached` are `null` (not 0) when the response does
  not report cache data; `cacheSource` and `shape` (field names only) show where cache data was or
  was not found.
- `scripts/ai-token-budget.mjs`: offline, no network. Measures the real prompt, tool definitions
  and result serializers and totals input and "requested" tokens per call for five representative flows.

## Offline measurements (before Batch 1)
- System prompt ~1,336 tokens + 11 tool definitions ~1,737 = fixed prefix ~3,073 tokens per call.
  Largest definitions: getActivities 345, updateActivity 239, createActivity 232, presentChoices 215.
- Variable: user message ~12, tool call ~20, getRecentActivities(5) 342, updateActivity result 141,
  getCategories (10 mains x 5 subs) 728, getActivities 20 rows 1,347.
- Turn input totals: simple read 7.5k (2 calls); getRecent -> update -> reply 9.6k (3 calls);
  category create + confirm + log activity 14.9k (4 calls); later turn in a conversation 7.1k.
- The fixed prefix is 82-96% of input in these flows. History is ~0.4-1k per call.

## Observed in manual runs (AI_LOG_USAGE)
- First-call prompt ~3.06k tokens; ~3.9k after getCategories is in the history.
- Groq's 429 `Requested` ~= prompt tokens + `max_tokens` (e.g. 4,930 and 5,083 with 1,024 cap).
  `Used` reflects actual tokens in the sliding minute.
- Typical completions 131-248 tokens (reasoning 107-194); the 1,024 cap was mostly unused
  reservation.
- One gpt-oss-20b call spent 1,022 of 1,024 completion tokens on reasoning and ended with
  `finish_reason: length` and no text; the app then returned an empty assistant message.
- A `presentChoices` call with 8 options violated the tool's `maxItems: 5`. Groq rejected it
  provider-side (400 `tool_use_failed`) before application validation, and the failed call still
  consumed ~4k of the TPM window.
- No `cached` value appeared in any response logged by the first version of the logger. That
  version only read `usage.prompt_tokens_details.cached_tokens`; it did not distinguish "field
  absent" from "zero". Groq's SDK types also describe `x_groq.usage.{dram,sram}_cached_tokens`.
  The logger now reads both and prints explicit `cached`, `uncached` and `cacheSource`.
  Whether Groq reports/serves cache hits for this model and tier is still unconfirmed.
- 429 responses carry `retry-after` (5-9 s in the samples). No automatic retry occurs in the
  current stack (each 429 appeared once per call).

## Options considered (summary)
| Option | Expected effect | Trade-off / risk |
|---|---|---|
| Lower output cap | Cuts `Requested` by the difference on every call | Too low truncates tool calls, especially with heavy reasoning |
| Lower reasoning effort | Fewer hidden output tokens, lower latency, avoids runaway reasoning | May reduce judgement quality (ambiguity, category choice); needs live check |
| Prompt compression | ~350-500 tokens per call | Behaviour drift; needs live scenarios |
| Tool description / wire-schema compression | ~250-450 tokens per call | Slightly more format errors; Zod still validates |
| Compact tool results | ~20-35% of each result, repeated in later calls | Separate model-facing serializer; contract/test changes |
| History compaction | Matters in long conversations | Follow-ups need earlier ids; keep recent turns whole |
| Dynamic tool exposure | ~430 tokens when category mutation tools are hidden | Changes the tool set mid-turn; would invalidate a provider prompt cache if one is active |
| Skip final LLM call after a direct mutation | Saves a whole call | Breaks chained requests; changes wording; functionality change |
| Automatic 429 retry honouring retry-after | Turns many 429s into a short wait | Deployment time limits; not adopted yet |

## Decisions
- Measure one variable at a time. The 20b model was used for the first Batch 1 design; the Batch 1 live runs were on 120b, which is now the fixed baseline.
- Batch 1 (output side and failure handling) before any input-side compression:
  1. `AI_REASONING_EFFORT` (low | medium | high), default `low`.
  2. Default `AI_MAX_OUTPUT_TOKENS` 1024 -> 512.
  3. Output truncation: a length-limited response with a complete valid tool call or some text is
     kept; with neither, the turn fails as `ASSISTANT_INCOMPLETE` (HTTP 500) via the normal failure
     path, preserving `changes`/`outcome`. Nothing is retried automatically.
  4. No automatic 429 retries. `Retry-After` (clamped 1-120 s) is passed to the client as
     `data.retryAfterSeconds` (+ header) so the UI can say when to try again.
  5. `presentChoices` accepts 2-10 options; more than 10 are listed in text (separate fix).
- Keep `AI_LOG_USAGE` instrumentation.

## Offline results, before -> after Batch 1
Fixed prefix is now 3,100 tokens (+27 from the presentChoices wording); it is unchanged by Batch 1.
"Requested" = input + output cap (1,024 -> 512):

| Flow | Calls | Requested before | Requested after |
|---|---|---|---|
| Simple read | 2 | 9,640 | 8,616 |
| getRecent -> update -> reply | 3 | 12,787 | 11,251 |
| Category create + confirm + activity | 4 | 19,100 | 17,052 |
| First turn (getRecent 5) | 2 | 8,631 | 7,607 |
| Later turn in conversation | 2 | 9,221 | 8,197 |

Per call this is 512 fewer requested tokens. The effect of reasoning effort on real output tokens
is not measurable offline.

## Experiments / results
- Deterministic tests (fake model/fetch, no Groq): truncation cases (empty, whitespace, empty
  block, tool call + length, text + length, applied mutation then truncation, approved
  confirmation then truncation), retry-after parsing and propagation, client text, model config
  defaults and overrides, cache-field logging variants (standard, explicit 0, not reported,
  x_groq hardware fields).
- Live effect of Batch 1: see "Batch 1 live measurements" below.

## Batch 1 live measurements (gpt-oss-120b, reasoningEffort=low, maxTokens=512)
Two manual turns, `AI_LOG_USAGE=true`:

| Turn | Call | prompt | completion | reasoning | total | remainingTokens after |
|---|---|---|---|---|---|---|
| Q1 "What did I do today?" | 1 (getActivities) | 3,081 | 47 | 15 | 3,128 | 4,648 |
| | 2 (final) | 3,432 | 180 | none reported | 3,612 | 1,252 |
| Q2 "Add Token Optimization ..." | 1 (updateActivity) | 3,634 | 80 | 48 | 3,714 | 4,319 |
| | 2 (final) | 3,821 | 38 | none reported | 3,859 | 587 |

- Output is now 1.6-3.4% of a turn's tokens (reasoning 15-48 tokens, no `finish: length`). The turns
  are input-bound: the fixed prefix is ~3,080 of the first call's 3,128 tokens.
- A plain two-call turn consumed 84-93% of the 8,000 TPM window (remaining 1,252 and 587 after the
  second call). A third call in the same minute would have returned 429. Batch 1 reduces the
  `Requested` pre-check but does not create headroom; input size is the remaining lever.
- Cache fields: `cached: null`, `cacheSource: "not_reported"`. The response `usage` held only
  `queue_time, prompt_tokens, prompt_time, completion_tokens, completion_time, total_tokens,
  total_time` (+ `completion_tokens_details` when reasoning occurred); no `prompt_tokens_details`
  and no `x_groq.usage`. Groq sent no cache data for this model/tier, so cache status is unknown
  from the fields. Separately, `remainingTokens` dropped by almost exactly each call's full
  `total_tokens` (3,396 vs 3,612; 3,732 vs 3,859; the gap matches ~1 s of window refill), which
  suggests the rate limiter charged the full prompt. That is an inference about accounting, not a
  cache reading.

## Create vs update finding
- Observed (Q2): the user asked to add a new "Token Optimization" activity; an activity with that
  title already existed. The model called `updateActivity` (reply: "Updated Token Optimization: end
  time 12:50 AM -> 8:35 AM") instead of `createActivity`, using ids from the earlier "what did I do
  today" result in the thread and without calling `getRecentActivities`.
- Cause (instruction gap): nothing in the prompt or tool descriptions said that add/log/record means
  a new activity, or that update is only for an activity the user asked to change. The prompt's
  chaining example ("update the latest activity, then create the next one") and the "extend an
  activity" rule leaned toward update, and nothing told the model to refresh "previous/latest"
  references. Not attributed to `reasoningEffort=low` (no evidence either way; the A/B is deferred
  until after the instruction fix). The user's wording was also somewhat vague, so no rule was
  added for this specific phrasing.
- Fix (token-neutral; fixed prefix 3,100 -> 3,098):
  - Prompt: "Adding, logging, recording or creating an activity means a NEW activity: createActivity,
    even if a similar one exists. Use updateActivity only when the user asks to change, extend,
    move or rename an existing activity." and, for latest/last/previous/current references, "call
    getRecentActivities ... instead of relying on older results in this conversation".
  - Chaining example changed to "fetch the latest activity, then create the next one".
  - Tool descriptions: `createActivity` = "Create a NEW activity (add/log/record)"; `updateActivity`
    = "Change an EXISTING activity (update/extend/move/rename) ...; never use it to add a new activity".
  - Offsetting trims: duplicate sentences removed from the prompt (the update-fields rule that the
    tool description already carries, the repeated "never claim" sentence, wording tightened).
- Regression scenario: `scripts/ai-eval.mjs` #33 (two turns: "What did I do today?" then
  "Add Token Optimization under Reading from previous end time to current time" with an existing
  same-titled activity). Asserts no `updateActivity`, exactly one `createActivity`, the existing
  activity unchanged, one new Token Optimization activity. Not yet run against Groq.

## Batch 2: input-side compression (gpt-oss-120b, low, 512)
Approved and implemented in two stages so the saving and any regression can be attributed.

### Stage A: wire schema + tool descriptions
- `getToolDefinitions` (`src/lib/ai/tools/index.js`) strips machine-validation keywords from the schema
  sent to the model: `pattern`, `additionalProperties`, `minimum`/`maximum`/`exclusiveMinimum`,
  `minLength`/`maxLength`, `minItems`/`maxItems`. Zod remains the authoritative validator (unchanged
  `execute` path; a violation returns a structured tool error). Provider-side rejections of a call
  (the earlier `presentChoices` 400) can no longer happen for these constraints.
- Human-readable hints kept as `description` via `.describe()`: `YYYY-MM-DD`, `HH:mm`,
  `HH:mm or 24:00` (end times), `limit` ranges (`1-50`, `1-20`).
- Tool descriptions shortened; the repeated confirmation/cascade notes removed from the delete and
  create-category tools (confirmation is enforced by the graph, and the prompt keeps one sentence).
  `deleteSubCategory` now states only that it fails if it has activities (the old text wrongly listed
  weekly targets and sub categories, which apply to Main Categories).

### Stage B: prompt compression
- Rules merged and reworded (category-resolution bullets 6 -> 4, search and ambiguity rules, confirmation
  and rejection rule, cross-midnight rule, intro). Examples kept: "8-9 AM to 10 = 10 AM" and
  "extend 8:14-8:34 PM to 8:59 PM sets endTime 20:59". Two clauses removed in the first draft were
  restored after review ("or an update" crossing midnight; "prefer asking over miscategorizing"), as was
  "related concepts or synonyms alone don't count".

### Fixed-prefix tokens (system prompt incl. date/calendar tail + 11 tool definitions)
| | Before Batch 2 | After Stage A | After Stage B (final) |
|---|---|---|---|
| Prompt instructions | 1,178 | 1,178 | 1,001 |
| Date/calendar tail | 166 | 166 | 166 |
| Tool descriptions | 671 | 312 | 312 |
| Tool schemas | 899 | 512 | 512 |
| Tool wrapper (name/type keys) | 184 | 176 | 176 |
| **Fixed prefix** | **3,098** | **2,344** | **2,167** |
Total saving 931 tokens per model call (30%): Stage A 754, Stage B 177.

### Simulated totals (512 output cap; requested = input + cap, per call)
| Flow | Calls | Input before -> A -> B | Requested before -> A -> B |
|---|---|---|---|
| Simple read (getActivities, 20 rows) | 2 | 7,592 -> 6,080 -> 5,726 | 8,616 -> 7,104 -> 6,750 |
| getRecent -> update -> reply | 3 | 9,715 -> 7,447 -> 6,916 | 11,251 -> 8,983 -> 8,452 |
| Category create + confirm + activity | 4 | 14,896 -> n/a -> 11,272 | 17,052 -> n/a -> 13,320 |
Per-call requested for the 3-call flow is ~2.7-3.0k after Stage B. Actual `Used` counts real tokens
(not the cap), so a 3-call turn of ~6.9k input plus ~0.3k completion can now fit an empty 8,000 TPM
window; it did not fit before (the third call's `Used` + `Requested` exceeded 8,000). Turns that start
with other usage in the window will still hit 429.

### Behavioural information removed (not merely reworded)
- Provider-visible constraints: regex patterns, positive-integer bounds on ids, string length limits
  (question 300, label 80, message 200), option bounds (kept as "2-10" in the `presentChoices`
  description) and "no extra properties". Enforced by Zod at runtime; a violation is now a tool error
  the model can correct rather than a provider rejection.
- Tool-description statements: "requires confirmation, call directly" (5 tools; the prompt keeps it
  once), "no cascade" on the delete tools, "does not search" (`updateActivity`), "use for
  latest/last/previous" (`getRecentActivities`; the prompt rule remains), "never ask the user for
  24:00" (`createActivity`; the prompt rule remains), the `presentChoices` example message and
  "with more than 10 ask in text" (prompt rule remains), "exactly identified", "(even if truncated)",
  `getCategories` "retrieval only".
- Prompt: "Tools take local HH:mm times and YYYY-MM-DD dates" (now carried by the schema hints), the
  "message that identifies it" clause for choice options, "with that sub's id from the earlier result" in
  the follow-up rule, and example wording. Nothing in the safety rules (confirmation enforcement,
  rejection/expiry handling, no ids, 24:00 internal-only, category-deletion blockers, new vs update)
  was removed.

### Verification (no Groq)
Offline budget script; wire-schema test (no validation keywords left, required/properties/hints kept,
tool names unchanged) and 40+ invalid/valid argument cases proving Zod still rejects what the schema no
longer states (bad/impossible dates, `25:00`, `24:00` as a start, `24:01`, ids 0/negative/fractional,
`userId` or extra keys, limits, option counts and lengths); existing suites (verify, m3-m8 prompt and
behaviour contracts, Batch 1 test), lint and build. Scratch prompt-wording assertions were updated to
the new phrasing only where the same rule is still present.
Pending: one targeted live run (#29-#33 plus M4/M5 category and confirmation scenarios).

## Deferred / open questions
- Does Groq report or serve prompt-cache hits for this model and tier? Check `cached`/`cacheSource`.
- Is the real `Requested` now ~prompt + 512, and is call `completion` now well under the cap?
- Does `low` reasoning change behaviour on ambiguity / category-resolution scenarios?
- Deferred after Batch 2: compact `getCategories` and activity result shapes (~200 tokens in category flows,
  ~20 per activity), history compaction, dynamic tool exposure; `low` vs `medium` A/B.
- Automatic retry honouring `retry-after`, and its interaction with deployment time limits.
- Model choice (20b vs 120b) once the measurements are in.
