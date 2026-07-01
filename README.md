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