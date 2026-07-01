# TimeLedger UI Design

## Purpose

This document defines the frontend structure, pages, components, and user flows for TimeLedger.

The UI should support:

1. Fast activity logging
2. Category management
3. Daily and weekly time review
4. Progress tracking against weekly targets
5. Simple analytics and comparisons

The UI should remain clean, responsive, and easy to use on desktop and mobile.

---

## UI Principles

1. Keep the interface simple and focused.
2. Prioritize speed of data entry.
3. Use modals for create and edit flows.
4. Use tables for lists and summaries.
5. Use cards for high level metrics.
6. Keep primary actions easy to find.
7. Show validation errors clearly and near the relevant fields.
8. Avoid unnecessary animations and visual clutter.
9. Authentication should remain simple and unobtrusive.
10. Keep the interface focused on fast daily usage.
11. Avoid unnecessary settings and configuration.
12. Prioritize real-world usability over visual complexity.

---

## Global Layout

### App Shell

The application should use a consistent shell across pages.

### Default Landing Page

- Dashboard should be the default home page at `/`.

### Navigation Items

- Dashboard
- Activities
- Categories
- Analytics

### Responsive Behavior

#### Desktop
1. Show navigation clearly in the header or sidebar.
2. Use tables where space is available.
3. Show summary cards and charts in grids.

#### Mobile
1. Collapse navigation into a compact layout.
2. Stack cards vertically.
3. Convert wide tables into stacked rows or compact cards where needed.
4. Keep form fields easy to tap.

### Authentication

The application requires authentication.

Unauthenticated users are redirected to the Login page.

Authenticated users can access all application pages.

Google Sign-In is currently supported.

The navigation automatically adapts to the authentication state.

* Logged in → Dashboard, Activities, Categories, Analytics, Sign Out
* Logged out → TimeLedger logo and Sign In

---

## Navigation Flow

### Default Landing Page

- Dashboard (`/`)

### Authentication Flow

Unauthenticated users:

```
Application
        ↓
     /login
        ↓
Continue with Google
        ↓
Google Authentication
        ↓
Dashboard
```

Authenticated users can navigate between:

```
Dashboard
      ↓
Activities
      ↓
Categories
      ↓
Analytics
```

The application should preserve filters where practical when navigating between pages.

Navigation automatically adapts to the authentication state.

Authenticated users:

- Dashboard
- Activities
- Categories
- Analytics
- Sign Out

Unauthenticated users:

- TimeLedger logo
- Sign In

---

## Shared UI Components

The following components should be reused across pages.

### Login Page

Displays:

* TimeLedger branding
* Google Sign-In button
* Brief application description
* Authentication benefits

The login page should remain minimal and distraction free.

### PageHeader

Displays:
1. Page title
2. Short description
3. Primary action button when needed

### SummaryCard

Displays a single metric such as:
1. Total time spent
2. Weekly target
3. Remaining time
4. Progress percentage

### DataTable

Used for listing:
1. Activities
2. Categories

Should support:
1. Column headers
2. Empty state
3. Loading state
4. Row actions

### ActivityModal

Used for both Add Activity and Edit Activity.

### MainCategoryModal

Used for:

- Add Main Category
- Rename Main Category

### SubCategoryModal

Used for:

- Add Sub Category
- Rename Sub Category

### DateRangeFilter

Used for filtering data across multiple pages.

This component should be reusable by:

* Dashboard
* Activities
* Analytics

Supported filter options:

* Today
* Yesterday
* Current Week
* Previous Week
* Current Month
* Custom Date Range

The selected date range should be passed to the corresponding backend API as query parameters.

### ConfirmDialog

Used for delete actions and other destructive actions.

### EmptyState

Shown when there is no data to display.

### ErrorBanner

Shown when API requests fail or validation errors occur.

### LoadingState

Shown while data is being fetched.

### ChartCard

Used on the Analytics page to wrap charts with a title and optional filter controls.

---

## Page 1: Activities

### Purpose

The Activities page is the primary page for viewing, filtering, editing, and deleting activities across any date range.

This page should be the most frequently used part of the application.

### Main Features

1. View activities in a table
2. Add a new activity
3. Edit an existing activity
4. Delete an activity
5. Filter activities by date range
6. Filter activities by category if needed

### Data Source

1. GET /api/activities
2. POST /api/activities
3. PATCH /api/activities/:id
4. DELETE /api/activities/:id
5. GET /api/sub-categories?isActive=true for the category dropdown

### Page Layout

### Recommended Layout Order

1. Quick Actions
2. Today's Summary
3. Current Week Progress
4. Today's Timeline

#### Header
1. Title: Activities
2. Primary button: Add Activity

#### Filter Row

Use the shared DateRangeFilter component.

Optional filters:

- Main Category
- Sub Category

#### Activity Table

Recommended columns:

1. Activity Date
2. Title
3. Sub Category
4. Start Time
5. End Time
6. Duration
7. Notes
8. Actions

Activity titles and truncated notes display native tooltips on hover.

A copy action is available for activity titles to support quick reuse.

#### Row Actions

1. Edit
2. Delete
3. Copy Activity Title

### Activity Modal

The Add Activity and Edit Activity modal should be reusable from both the Dashboard and Activities page.

#### Fields
1. Activity Date
2. Title
3. Sub Category
4. Main Category (auto populated, read only)
5. Start Time
6. End Time
7. Notes

Selecting a Sub Category should automatically populate the corresponding Main Category.

The Main Category is read-only and cannot be changed directly.

Default Activity Date should use the user's local date.

Start and End times are displayed in 12-hour AM/PM format.

#### Behavior
1. Add opens an empty form
2. Edit opens the same form with existing values prefilled
3. Save closes the modal after success
4. Cancel closes the modal without saving

### User Flow

1. User opens Activities page.
2. User clicks Add Activity.
3. Modal opens.
4. User fills details and saves.
5. App calls POST /api/activities.
6. Table refreshes.
7. Daily summary data is updated by the backend.

### Empty State

If no activities exist for the selected filter:
1. Show a friendly empty state
2. Include a button to add the first activity

---

## Page 2: Categories

### Purpose

The Categories page manages both Main Categories and Sub Categories.

Users should be able to:

- Create Main Categories
- Rename Main Categories
- Activate / Deactivate Main Categories

- Create Sub Categories
- Rename Sub Categories
- Activate / Deactivate Sub Categories

Each Sub Category belongs to exactly one Main Category.

The page should support filtering by:
- All
- Active
- Inactive

### Data Source
1. GET /api/main-categories
2. POST /api/main-categories
3. PATCH /api/main-categories/:id
4. GET /api/sub-categories
5. POST /api/sub-categories
6. PATCH /api/sub-categories/:id

### Important Note

The categories API should support filtering by active status.

The UI should use that capability as follows:
1. Show all categories by default in category management
2. Filter to active categories when needed
3. Filter to inactive categories when needed
4. Show only active categories in the Activity modal dropdown

### Page Layout

#### Header

1. Title: Categories
2. Primary button: Add Main Category

#### Filter Row

The Categories page should include a status filter:

1. All
2. Active
3. Inactive

#### Category Hierarchy

Display Main Categories as expandable sections.

Each Main Category should display its associated Sub Categories.

Example layout:

```text
▼ Career Growth

    LeetCode Problems
    AI Concepts
    LLM Course

    + Add Sub Category

----------------------------------------------------

▼ Admin / Life Maintenance

    Kitchen Chores
    Cooking
    Laundry

    + Add Sub Category
```

#### Main Category Actions

For each Main Category:

1. Rename
2. Deactivate
3. Reactivate
4. Delete (only when no dependent data exists)

#### Sub Category Actions

For each Sub Category:

1. Rename
2. Deactivate if active
3. Reactivate if inactive

Inactive Main Categories and Sub Categories should be visually distinguishable.

Examples:

* Muted text
* "Inactive" badge
* Disabled color palette

---

### Category Modal

The same modal should support both Main Categories and Sub Categories.

#### Mode 1: Add / Edit Main Category

Fields:

1. Main Category Name

---

#### Mode 2: Add / Edit Sub Category

Fields:

1. Main Category
2. Sub Category Name

When adding a Sub Category from within a Main Category section, the Main Category should already be selected.

If opened independently in the future, the user should be able to choose the Main Category.

---

### Validation Feedback

1. Category name must not be empty.
2. Main Category names must be unique.
3. Sub Category names must be unique within the selected Main Category.
4. Display clear validation messages for duplicate names and invalid input.

---

### User Flow

#### Add Main Category

1. User clicks "Add Main Category".
2. Modal opens in Main Category mode.
3. User enters the Main Category name.
4. App calls POST /api/main-categories.
5. Category hierarchy refreshes.

#### Add Sub Category

1. User clicks "+ Add Sub Category" under a Main Category.
2. Modal opens in Sub Category mode.
3. The selected Main Category is pre-filled.
4. User enters the Sub Category name.
5. App calls POST /api/sub-categories.
6. Category hierarchy refreshes.

---

### Empty State

If there are no Main Categories for the selected filter:

1. Show an empty state.
2. Prompt the user to create the first Main Category.

---

### Category Status Behavior

1. Only active Sub Categories should be selectable while creating or editing an Activity.
2. Inactive Sub Categories should not appear in the Activity form.
3. Main Categories are derived automatically from the selected Sub Category in the Activity form.
4. Both active and inactive categories should remain visible in Category Management based on the selected filter.
5. Both Main Categories and Sub Categories can be reactivated from the Categories page.

---

## Page 3: Dashboard

### Purpose

The Dashboard page gives a quick view of current progress and recent time usage.

This page should answer:

1. How much time have I spent?
2. What is my weekly target?
3. How much time remains?
4. Am I ahead or behind target?

### Main Features

1. Show today's activity summary
2. Show current week summary by category
3. Show weekly targets
4. Show remaining time per category
5. Show progress percentage
6. Support week navigation.
7. Weekly metrics and weekly progress reflect the selected week.
8. Today's Summary and Today's Timeline always display today's data regardless of the selected week.

### Data Source

Dashboard data is composed from:

- GET /api/activities
- GET /api/daily-category-summaries
- GET /api/weekly-targets

The dashboard should not perform calculations in the frontend when summary data is already available from the backend.

### Page Layout

#### Header

- Title: Dashboard
- Shared DateRangeFilter

#### Summary Cards

Recommended cards:

1. Time spent this week
2. Weekly target
3. Remaining time
4. Progress percentage

#### Category Breakdown

Show each category with:
1. Spent time
2. Target time
3. Remaining time
4. Progress percentage

#### Today's Timeline

Show today's activities in reverse chronological order (most recent first).

This supports quickly editing the most recently logged activity.

Each row should show:
- Time
- Title
- Sub Category
- Duration
- Actions

Actions:
- Edit
- Delete

#### Quick Actions

- + Add Activity should be visible at the top of the Dashboard.

#### Today's Summary

Display two summary sections:
1. Main Category Summary
2. Sub Category Summary

#### Current Week Progress

Display progress only by Main Category.

Each Main Category should display:

- Weekly Target
- Time Spent
- Remaining Time
- Progress Percentage

### User Flow

1. User opens Dashboard.
2. User selects a time range or week.
3. Dashboard shows time spent and target progress.
4. Dashboard updates the chart and summary cards.

### Empty State

If there is no data for the selected range:
1. Show a friendly empty state
2. Suggest logging the first activity

---

## Page 4: Analytics

### Purpose

The Analytics page provides insights into how time is being spent across Main Categories and Sub Categories.

It helps answer questions such as:

* Where is most of my time going?
* Which Main Categories receive the most attention?
* Which Sub Categories consume the most time?
* How are my weekly and monthly trends changing?
* Am I consistently meeting my weekly targets?

---

### Main Features

1. Summary metrics
2. Most Active Category
3. Average Session
4. Longest Session
5. Week-over-week comparison
6. Target vs Actual comparison
7. Main Category comparison
8. Daily trend
9. Top Sub Categories

---

### Data Source

Analytics is primarily computed from Activities with client-side aggregation.
Weekly Targets are additionally used for Target vs Actual analysis.

---

### Page Layout

#### Header

- Title: Analytics
- Shared DateRangeFilter

---

#### Chart Sections

Recommended charts:

### Main Category Comparison

Compare total time spent across Main Categories.

Examples:

* Current Week
* Previous Week
* Current Month

---

### Sub Category Comparison

Compare time spent across Sub Categories.

Users should be able to identify where most of their effort is going.

---

### Weekly Target Progress

Show progress against weekly targets for each Main Category.

Display:

* Target
* Actual
* Remaining
* Progress percentage

---

### Trend Analysis

Show historical trends such as:

* Daily time spent
* Weekly time spent
* Monthly time spent

---

### Time Distribution

Visualize how total time is distributed across:

* Main Categories
* Sub Categories

---

### Chart Features

All charts should support:

* Hover tooltips
* Date range selection
* Responsive resizing
* Export support (future)

Future enhancements:

* Filter by Main Category
* Filter by Sub Category

---

### User Flow

1. User opens Analytics.
2. User selects a date range.
3. Charts update automatically.
4. User compares trends and identifies areas for improvement.

---

### Empty State

If there is insufficient data:

1. Display a clear empty state.
2. Suggest using the application for several days before meaningful analytics become available.

---

## Form and Interaction Rules

### Modals
1. Use a modal for add and edit forms.
2. Reuse the same modal for create and update where possible.

### Save Behavior
1. Disable save while request is in progress.
2. Show success feedback after save.
3. Refresh the relevant page data after success.

### Error Behavior
1. Show validation errors near the field when possible.
2. Show API errors in a visible message area.
3. Keep the form open if save fails.

### Delete Behavior
1. Always ask for confirmation before deleting an activity.
2. Deactivate categories when they should no longer appear for new activities.
3. Delete categories only when they contain no dependent data. Otherwise display a clear validation message describing the blocking dependencies.

---

## Accessibility

1. All buttons must have clear labels.
2. All form fields must have visible labels.
3. Modal dialogs should be closable with Escape.
4. Focus should move into the modal when it opens.
5. Tables and charts should remain readable on smaller screens.
6. Authentication redirects should prevent unauthorized page access.
7. Navigation adapts to authentication state.
8. Icon-only buttons include accessible labels.

---

## Visual Style

The visual style should be:
1. Clean
2. Minimal
3. Modern
4. Easy to scan
5. Not overly decorated

The interface should feel practical rather than flashy.

---

## MVP Scope

The MVP UI should include:

1. Activities page
2. Categories page
3. Dashboard page
4. Analytics page

Implemented:

* Google Authentication
* Protected Pages
* Responsive Design
* Accessibility Improvements

Not yet implemented:

* Email / Password login
* User Profile
* Settings
* Themes
* Background Automation

---

## Future Extensions

### Productivity

1. Keyboard shortcuts for faster logging
2. Inline quick add row
3. Bulk activity editing
4. Recurring activities
5. Wake-up tracking
6. Reminders

### Categories & Activities

7. Move Sub Category to another Main Category
8. Merge Main Categories
9. Merge Sub Categories

### Analytics

10. More advanced analytics filters
11. LLM insights

### Data Management

12. Export to CSV
13. Import existing activity data from CSV or Google Sheets

### Integrations

14. Google Calendar integration

### Personalization

15. Dark mode

### Authentication

16. Email / Password authentication
17. User profile and preferences

### Workflow Improvements

18. Duplicate / Copy previous activity