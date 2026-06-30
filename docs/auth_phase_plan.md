# TimeLedger Authentication & Data Isolation Plan

## Objective

TimeLedger is now a personal app.

The goal of this phase is to make the app private so that only the signed in user can read and write their own data.

No one should be able to see or modify another user's records.

---

## Already Done

The authentication foundation is already in place.

### Google Cloud
- A separate Google Cloud project for TimeLedger has been created.
- OAuth consent screen is configured.
- Data access scopes have been added.
- Test users have been added.

### Supabase
- Google Auth provider is enabled in Supabase.
- Google Client ID and Client Secret have been added.
- Site URL and Redirect URLs are configured.
- Supabase Auth is working correctly.

### App Setup
- Supabase environment variables have been added locally and in Vercel.
- The Supabase client package has been added.
- A login page exists.
- Google sign in works.
- The auth callback flow works.
- After login, the user is redirected back to the app successfully.
- The authenticated user can be retrieved from Supabase session data.

### Current State
Google sign in is functional.

What is still missing is data isolation per user.

---

## Temporary Authentication Implementation

A basic Google authentication flow has already been implemented to validate the end-to-end OAuth setup.

Current implementation:

- `src/app/login/page.js`
  - Contains a simple "Continue with Google" button.
  - Initiates Google sign in through Supabase.

- `src/app/auth/callback/page.js`
  - Handles the redirect after Google authentication.
  - Completes the login flow and redirects back into the application.

- `src/app/page.js`
  - Was temporarily updated during testing to verify the authenticated user and session.

These files were created or modified only to validate the Google OAuth flow.

During the authentication implementation phase, feel free to:
- keep the existing structure if it aligns with best practices,
- or refactor/reorganize it if there is a cleaner architecture.

The objective is to end up with a maintainable, production-ready authentication flow rather than preserving the current implementation.

---

## Guiding Principle

Use the authenticated Supabase user as the source of truth.

Every user owned record in TimeLedger must belong to one signed in user only.

The signed in Supabase `user.id` should be used to scope all app data.

Never trust a user identifier sent from the client. Always derive the authenticated user from the Supabase session on the server before accessing or modifying data.

---

## Phase 1: Database Ownership

Add user ownership to the database schema.

### Required changes
- Create or add a `User` table if needed for app ownership mapping.
- Add `userId` to all user specific tables.
- Ensure every record belongs to one user.
- Keep the existing schema structure intact as much as possible.

### Tables to scope by user
- MainCategory
- SubCategory
- Activity
- WeeklyTarget
- DailySubCategorySummary
- Any other table that stores user specific data or persisted summaries

### Notes
- If a summary or cache table exists only for derived analytics, decide whether it should also be user scoped.
- Existing data may need to be backfilled with the current user's ID during migration.
- The database should support multiple users without data overlap.

---

## Phase 2: API Protection

Update every API route to use the authenticated user.

### Required behavior
- Read the current signed in user from Supabase session data.
- Use that user's `user.id` in every query.
- Return only records that belong to that user.
- Prevent creation of records without a valid user context.
- Prevent editing or deleting records that belong to another user.

### API rules
- All GET routes should filter by `userId`.
- All POST routes should assign the current `userId`.
- All PATCH routes should verify ownership before updating.
- All DELETE routes should verify ownership before deleting.

### Important
The public URL should never expose data from another user.

---

## Phase 3: Page Protection

Protect the app UI.

### Required behavior
- If the user is not signed in, redirect them to `/login`.
- If the user is signed in, allow access to the app pages.
- Keep the login page public.
- Keep the auth callback page public.

### Pages to protect
- Dashboard
- Activities
- Categories
- Weekly Targets
- Analytics

---

## Phase 4: Logout

Add sign out support.

### Required behavior
- Add a sign out action in the navbar or user menu.
- Sign out should clear the session.
- After sign out, redirect to `/login`.

---

## Phase 5: Validation

After implementing the user isolation layer, verify:

- Login works.
- Logout works.
- Signed in users only see their own data.
- New data is saved under the correct user.
- One user cannot access another user's records.
- Dashboard, Activities, Categories, Weekly Targets, and Analytics still work correctly.

---

## Later Enhancement

After Google sign in is fully stable, optionally add:

- Email and password sign up
- Email and password sign in
- Password reset
- Email verification

This is optional and can be added later if needed.

---

## Implementation Order

1. Database ownership
2. API protection
3. Page protection
4. Logout
5. Validation

---

## Expected Outcome

After this phase:

- TimeLedger becomes private.
- Each authenticated user sees only their own data.
- The app is safe to use as a personal productivity tool.
- The existing UI and product flow remain unchanged.
- Authentication becomes the security layer around the current app.