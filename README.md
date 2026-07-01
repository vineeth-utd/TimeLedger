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
Next.js (App Router)
    │
    ├── React UI
    ├── API Routes
    │
    ▼
Prisma ORM
    │
    ▼
Supabase PostgreSQL
```

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
│   │   ├── api/
│   │   ├── analytics/
│   │   ├── activities/
│   │   ├── auth/
│   │   ├── categories/
│   │   ├── login/
│   │   └── page.js
│   │
│   ├── components/
│   │   ├── activities/
│   │   ├── categories/
│   │   ├── dashboard/
│   │   └── ...
│   │
│   ├── lib/
│   │   ├── auth.js
│   │   ├── prisma.js
│   │   ├── formatters.js
│   │   └── supabase/
│   │
│   └── proxy.js
│
├── docs/
│   ├── database.md
│   ├── api.md
│   ├── ui.md
│   ├── planning.md
│   ├── auth_phase_plan.md
│   └── ui_refinement_plan.md
│
└── README.md
```

The project follows a feature-oriented structure using the Next.js App Router. Shared components, utilities, authentication, and API routes are organized separately to keep the codebase modular and maintainable.

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

Create a `.env` file in the project root.

Required variables:

```env
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Where:

- `DATABASE_URL` → Supabase Session Pooler connection string
- `NEXT_PUBLIC_SUPABASE_URL` → Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → Supabase Publishable (Anon) Key

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