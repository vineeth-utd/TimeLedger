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
9. Do not add authentication in the MVP.
10. Do not add settings, themes, or other nonessential features.

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

---

## Navigation Flow

Default page:

Dashboard

Navigation:

Dashboard
↓

Activities
↓

Categories
↓

Analytics

The application should preserve filters when navigating back where practical.

---

## Shared UI Components

The following components should be reused across pages.

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

### CategoryModal

Used for adding and renaming categories.

### DateRangeFilter

Used for filtering activity data and dashboard data.

Should support:
1. Today
2. Yesterday
3. Current Week
4. Previous Week
5. Current Month
6. Custom Range

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
5. GET /api/categories?isActive=true for the category dropdown

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
1. Date range selector
2. Optional category filter
3. Optional quick filters such as Today and This Week

#### Activity Table

Recommended columns:

1. Activity Date
2. Title
3. Category
4. Start Time
5. End Time
6. Duration
7. Notes
8. Actions

#### Row Actions

1. Edit
2. Delete

### Activity Modal

The Add Activity and Edit Activity modal should be reusable from both the Dashboard and Activities page.

#### Fields
1. Activity Date
2. Title
3. Category
4. Start Time
5. End Time
6. Notes

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

The Categories page should show all categories by default.

The page should support filtering by:
- All
- Active
- Inactive

### Data Source

1. GET /api/categories
2. POST /api/categories
3. PATCH /api/categories/:id

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
2. Primary button: Add Category

#### Filter Row

The Categories page should include a status filter:

1. All
2. Active
3. Inactive

#### Category List

Recommended columns:

1. Name
2. Status
3. Actions

#### Row Actions

1. Rename
2. Deactivate if active
3. Reactivate if inactive

Inactive categories should be visually distinguishable from active categories.

Examples:
- muted text
- "Inactive" badge
- disabled color palette

### Category Modal

#### Fields
1. Category Name

#### Behavior
1. Add opens a blank form
2. Rename opens the form prefilled with the current name
3. Save closes the modal after success

### Validation Feedback

1. Show a clear message if the name is empty
2. Show a clear message if the name already exists
3. Show a clear message if the category cannot be saved

### User Flow

1. User opens Categories page.
2. User clicks Add Category.
3. Modal opens.
4. User enters a name and saves.
5. App calls POST /api/categories.
6. List refreshes.

### Empty State

If there are no categories for the selected status filter:
1. Show an empty state
2. Prompt the user to add the first category

### Category Status Behavior

1. Active categories should be selectable in activity forms.
2. Inactive categories should not appear in the activity dropdown.
3. Inactive categories should remain visible in category management.
4. Inactive categories should be able to be reactivated from the Categories page.

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
6. Support date range filters

### Data Source

### Data Source

Dashboard data is composed from:

- GET /api/activities
- GET /api/daily-category-summaries
- GET /api/weekly-targets

The dashboard should not perform calculations in the frontend when summary data is already available from the backend.

### Page Layout

#### Header
1. Title: Dashboard
2. Date range selector or week selector

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

Show all of today's activities in chronological order.

Each row should show:
- Time
- Title
- Category
- Duration
- Actions

Actions:
- Edit
- Delete

#### Quick Actions

- + Add Activity should be visible at the top of the Dashboard.

#### Today's Summary

Show category-wise totals for the current day.

#### Current Week Progress

Show spent time, target time, remaining time, and progress percentage per category.

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

The Analytics page shows broader trends and comparisons over time.

### Main Features

1. Weekly comparison chart
2. Monthly comparison chart
3. Time spent by category
4. Trend over time

### Data Source

1. Daily category summaries
2. Weekly targets
3. Activity data where needed

### Page Layout

#### Header
1. Title: Analytics
2. Time period selector

#### Chart Sections

Recommended charts:

1. Weekly category comparison
2. Monthly category comparison
3. Category breakdown chart
4. Trend chart for time spent over time

Charts should support:

- Hover tooltips
- Date range selection
- Category filtering (future)

### User Flow

1. User opens Analytics.
2. User selects a period.
3. Charts update based on the selected range.

### Empty State

If there is not enough data:
1. Show a clear empty state
2. Suggest using the app for a few days to see trends

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
2. Deactivate categories with a clear confirmation step if needed.

---

## Accessibility

1. All buttons must have clear labels.
2. All form fields must have visible labels.
3. Modal dialogs should be closable with Escape.
4. Focus should move into the modal when it opens.
5. Tables and charts should remain readable on smaller screens.

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

The UI should not include:
1. Authentication
2. User profiles
3. Settings pages
4. Themes
5. Advanced permissions
6. Background automation
7. Overly complex animations

---

## Future Extensions

Possible future additions:
1. Keyboard shortcuts for faster logging
2. Inline quick add row
3. Export to CSV
4. Dark mode
5. More advanced analytics filters
6. Category reactivation history
7. Bulk activity editing
8. Import existing activity data from CSV or Google Sheets