# TimeLedger

A private, authenticated web application for tracking, organizing, and analyzing personal time.

TimeLedger was originally built to replace my Google Sheets based time tracking workflow and has evolved into a full-stack application that I use daily to log activities, manage categories, set weekly targets, and analyze how my time is spent.

The application is designed with a strong focus on fast activity logging, meaningful analytics, and a clean user experience across desktop and mobile.

---

## Live Demo

**Application:** https://timeledger-app.vercel.app

> Google Sign-In is required to access the application.

---

## Key Features

### Activity Management

- Log activities with start and end times
- Edit and delete existing activities
- Copy activity titles for quick reuse
- Track time using local timezone with 12-hour AM/PM display
- Organize activities using reusable categories

### Dashboard

- Weekly summary cards
- Today's activity summary
- Today's timeline
- Weekly progress against targets
- Quick activity logging

### Categories

- Main Category and Sub Category management
- Activate / Deactivate categories
- Safe deletion with dependency validation

### Weekly Targets

- Set weekly targets using hours and minutes
- Track progress against goals
- Compare planned vs actual effort

### Analytics

- Time distribution by category
- Daily trends
- Week-over-week comparison
- Target vs Actual analysis
- Activity insights
- Most Active Category
- Average Session Duration
- Longest Session

### AI Assistant

- Conversational activity management using natural language
- Create, update, find, and delete activities through chat
- Intelligent Main Category and Sub Category resolution
- Create and safely delete categories through conversational workflows
- Clarification choices for ambiguous requests
- Explicit confirmation before destructive or category-management actions
- Multi-step tool-calling workflows
- Floating assistant available across desktop and mobile
- Automatic page refresh after successful assistant changes
- Timezone-aware relative date and time interpretation

### Authentication

- Google Sign-In with Supabase Auth
- User-scoped data isolation
- Protected pages and APIs
- Secure server-side session validation

---

## Technology Stack

### Frontend

- Next.js 16 (App Router)
- React
- Tailwind CSS
- Recharts
- Lucide React

### Backend

- Next.js Route Handlers
- Prisma ORM

### Database

- PostgreSQL (Supabase)

### AI

- Groq (configurable model, GPT-OSS by default)
- LangGraph (orchestration, confirmations, PostgreSQL-backed conversation state)
- LangChain
- Zod (tool input validation)

### Authentication

- Supabase Auth
- Google OAuth

### Deployment

- Vercel
- Supabase

---

## Architecture

```
Browser
   │
   ▼
Next.js
   ├── React UI
   ├── REST APIs ────────────────┐
   │                             │
   └── AI Assistant              │
        │                        │
        ▼                        │
      LangGraph                  │
        │                        │
        ├── Groq LLM             │
        │                        │
        ▼                        │
   Controlled Tools              │
        │                        │
        ▼                        │
   Shared Services ◄─────────────┘
        │
        ▼
      Prisma
        │
        ▼
Supabase PostgreSQL
```

The AI model never accesses Prisma or the database directly, and it never supplies a trusted user identity: the user comes from the authenticated server-side session, and tool inputs cannot contain a `userId`. LangGraph orchestrates controlled TimeLedger tools, which reuse the same authenticated service layer as the application's APIs. Sensitive actions (deletions and category creation) run only after the user approves a server-built confirmation.

```
Authentication
──────────────
Google OAuth
      │
      ▼
Supabase Auth
      │
      ▼
Protected Pages
Protected APIs
User-scoped Data
```

---

## Project Structure

```
time-ledger/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── src/
│   ├── app/
│   │   ├── api/              # REST APIs and assistant endpoints
│   │   ├── analytics/
│   │   ├── activities/
│   │   ├── auth/
│   │   ├── categories/
│   │   ├── login/
│   │   └── page.js
│   │
│   ├── components/
│   │   ├── activities/
│   │   ├── assistant/        # Floating AI Assistant UI
│   │   ├── categories/
│   │   ├── dashboard/
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── ai/               # Assistant: LangGraph, controlled tools, prompt, confirmations
│   │   ├── services/         # Shared business logic (REST APIs and AI tools)
│   │   ├── auth.js
│   │   ├── prisma.js
│   │   ├── formatters.js
│   │   └── supabase/
│   │
│   └── proxy.js
│
├── scripts/                  # AI setup, evaluation and token-budget tooling
│
├── docs/
│   ├── database.md
│   ├── api.md
│   ├── ui.md
│   ├── ai.md
│   ├── ai_token_optimization.md
│   ├── planning.md
│   ├── auth_phase_plan.md
│   └── ui_refinement_plan.md
│
└── README.md
```

The project follows a feature-oriented structure using the Next.js App Router. Shared components, utilities, authentication, services, the AI Assistant, and API routes are organized separately to keep the codebase modular and maintainable.

---

## Getting Started

### Prerequisites

Before running the application, ensure the following are installed:

- Node.js 20+
- npm
- PostgreSQL (via Supabase)
- Git

---

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd time-ledger
```

Install dependencies:

```bash
npm install
```

---

### Environment Variables

Create a `.env` file in the project root (see `.env.example`).

Required variables:

```env
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GROQ_API_KEY=
```

Where:

- `DATABASE_URL` → Supabase Session Pooler connection string
- `NEXT_PUBLIC_SUPABASE_URL` → Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → Supabase Publishable (Anon) Key
- `GROQ_API_KEY` → Groq API key used by the AI Assistant (server-only; never exposed to the browser)

Optional AI tuning and debug variables (all can be omitted):

```env
AI_MODEL=
AI_MAX_OUTPUT_TOKENS=
AI_REASONING_EFFORT=
AI_CHECKPOINTER=
AI_LOG_USAGE=
```

- `AI_MODEL` → Groq model used by the assistant (default `openai/gpt-oss-120b`)
- `AI_MAX_OUTPUT_TOKENS` → Maximum output tokens per model call (default `512`)
- `AI_REASONING_EFFORT` → `low`, `medium` or `high` (default `low`)
- `AI_CHECKPOINTER` → set to `memory` to keep conversation state in-process (local testing only); by default state is stored in PostgreSQL
- `AI_LOG_USAGE` → set to `true` to log per-call token usage and rate-limit headers while debugging (no message content)

---

### Database

Generate the Prisma client:

```bash
npx prisma generate
```

Apply migrations:

```bash
npx prisma migrate dev
```

Create the AI Assistant's conversation-state tables (one-time, idempotent):

```bash
node --env-file=.env scripts/ai-setup-checkpointer.mjs
```

---

### Running the Application

Start the development server:

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

---

### Production

The production application is deployed on Vercel.

Deployment requires:

- Vercel
- Supabase
- Google OAuth credentials
- Environment variables configured in Vercel

---

## Project Documentation

Detailed design and implementation documents are available in the `docs/` directory.

| Document | Description |
|----------|-------------|
| `planning.md` | Project planning, roadmap, and milestone status (including the AI Assistant phases) |
| `database.md` | Database schema, relationships, and business rules |
| `api.md` | REST API design and endpoint specifications |
| `ui.md` | User interface design, application workflows, and the floating AI Assistant |
| `ai.md` | AI Assistant architecture, controlled tools, confirmations, and safety boundaries |
| `ai_token_optimization.md` | Token and rate-limit measurements and optimization decisions for the assistant |
| `auth_phase_plan.md` | Authentication implementation plan and design decisions |
| `ui_refinement_plan.md` | UI refinement history and implementation details |

---

## Current Status

**Version:** 1.0

TimeLedger is a fully functional, authenticated personal productivity application that is actively used for daily time tracking.

### Core Features

- Dashboard
- Activities
- Categories
- Weekly Targets
- Analytics
- Text-based AI Assistant

### Authentication & Security

- Google Authentication
- User-scoped data ownership
- Protected pages
- Protected APIs

### AI Assistant

- Natural-language activity and category management
- Confirmation required for sensitive actions
- Server-side, user-scoped tools (the LLM never accesses the database)

### User Experience

- Responsive UI
- Accessibility improvements
- Local timezone handling

### Deployment

- Vercel
- Supabase

---

## Roadmap

Future enhancements include:

### Productivity

- Recurring activities
- Wake-up tracking
- Reminders

### Analytics

- Advanced analytics
- Better trend analysis

### AI

- Voice input (Speech-to-Text) for the assistant
- AI Productivity Coach and advanced AI analytics

### Integrations

- Google Calendar integration

### Data Management

- CSV import
- CSV export

### Personalization

- Dark mode

### Authentication

- Email and Password authentication

For the complete roadmap, refer to **Future Extensions** in `docs/ui.md` and the AI phases in `docs/planning.md`.

---

TimeLedger continues to evolve through real-world daily usage, with future enhancements driven by practical experience rather than planned feature additions.