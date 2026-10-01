# AGENTS.md — Super Admin, Admin Control & Existing Feature Refinement

## 0. Mission

You are a senior full-stack engineer working on an existing research/literature-review team management application.

The application already has authentication, users/members, teams, tasks, notices, and an admin area.

Your job is to:

1. Fix the currently reported issues.
2. Introduce a clean **Super Admin → Admin → User** role hierarchy.
3. Improve identity selection/display so users see meaningful names instead of raw UUIDs.
4. Improve dashboard layout and information hierarchy.
5. Preserve all existing functionality.
6. Do not rewrite unrelated modules.

---

# 1. Mandatory First Step: Inspect Before Changing

Before writing code, inspect the existing project.

Identify:

- Frontend framework
- Backend framework
- Database
- ORM/query layer
- Authentication mechanism
- Session/token handling
- Existing role system
- User/member model
- Team model
- Task model
- Notice model
- Existing admin model
- Existing dashboard layout
- Existing navigation/sidebar
- Existing API patterns
- Existing validation/error handling
- Existing seed/demo data

Search the codebase for:

```text
login
logout
auth
session
token
refresh
role
admin
user
member
team
task
notice
uid
uuid
```

Do not create duplicate authentication, user, team, or role systems if equivalent systems already exist.

---

# 2. Current Issues To Fix

The following issues are explicitly reported and must be investigated and resolved.

## ISSUE-01 — User Cannot Logout

### Current problem

A user can log in but cannot successfully log out.

### Required behavior

A logged-in user should have a visible:

```text
Logout
```

action.

On logout:

1. Client-side authentication state must be cleared.
2. Access token/session must be invalidated according to the existing authentication architecture.
3. Refresh token/session cookie must be cleared if used.
4. User should be redirected to the login page or public landing page.
5. Protected pages must no longer be accessible using stale client state.
6. Browser refresh must not restore the logged-in state incorrectly.

### Security

Do not implement logout as only:

```text
localStorage.clear()
```

unless that is genuinely sufficient for the existing architecture.

Inspect how authentication currently works and invalidate the correct server-side/session state.

---

# 3. ISSUE-02 — Admin Listing Is Incorrect

### Current problem

The application is showing all admins in places where it should distinguish between:

- Super Admin
- Admin
- Normal User

### Required role hierarchy

```text
SUPER_ADMIN
     │
     ├── ADMIN
     │     │
     │     └── USER / MEMBER
     │
     └── Full system control
```

Do not assume every admin is a Super Admin.

---

# 4. Super Admin Concept

Introduce a dedicated:

```text
SUPER_ADMIN
```

role.

Super Admin is the highest-level authority.

### Super Admin can

- Create Admin
- Update Admin
- Activate/deactivate Admin
- Remove/archive Admin
- View all Admins
- View all Users
- View all Teams
- View all Projects
- View all Tasks
- View all Notices
- Monitor system activity
- Manage system-level settings if such settings exist
- Access Admin management
- Access all monitoring dashboards

### Super Admin should NOT unnecessarily perform normal operational work

Super Admin is primarily responsible for:

```text
Administration
Governance
Monitoring
Admin Management
System-level control
```

---

# 5. Admin Role

Admin is an operational management role.

Admin can manage the application's normal administrative operations according to existing business rules.

Examples:

- Manage users/members
- Manage teams
- Manage tasks
- Manage notices
- Manage components
- Manage fund/expense records
- Approve component requests
- Monitor projects
- Monitor research activities

### Important

An Admin must NOT be able to:

- Create another Super Admin
- Promote another user to Super Admin
- Modify Super Admin permissions
- Delete/deactivate the last active Super Admin
- Change system-level role hierarchy

Only Super Admin can perform Super Admin-level operations.

---

# 6. User / Member Role

Normal users/members should have limited access.

They can:

- View permitted information
- Work with assigned tasks
- View teams
- View notices
- Request components
- View available components
- View allowed financial information
- Update their own permitted profile information

They cannot:

- Create Admins
- Create Super Admins
- Modify roles
- Manage other users' roles
- Modify system-level settings
- Access admin-only management screens

---

# 7. Role Permission Matrix

Implement according to the existing authorization architecture.

| Capability | Super Admin | Admin | User |
|---|---:|---:|---:|
| Login | Yes | Yes | Yes |
| Logout | Yes | Yes | Yes |
| View own profile | Yes | Yes | Yes |
| Manage Super Admins | According to system policy | No | No |
| Create Admin | Yes | No | No |
| Edit Admin | Yes | No | No |
| Activate/Deactivate Admin | Yes | No | No |
| View Admins | Yes | Limited/No | No |
| Manage Users | Yes | Yes | No |
| Manage Teams | Yes | Yes | View |
| Manage Tasks | Yes | Yes | Own/Assigned |
| Manage Notices | Yes | Yes | View |
| Manage Components | Yes | Yes | View + Request |
| Manage Fund | Yes | Yes | View |
| Manage Expenses | Yes | Yes | View |
| View Audit Logs | Yes | According to policy | No |
| System Settings | Yes | No | No |

Do not blindly apply this matrix if the existing product has established business rules. Reconcile it with the current implementation.

---

# 8. Super Admin Management UI

Create a dedicated section:

```text
Super Admin
└── Admin Management
     ├── Admin List
     ├── Create Admin
     ├── Edit Admin
     ├── Admin Details
     └── Admin Status
```

### Admin List should show

- Member name
- Email
- Role
- Team if applicable
- Status
- Created date
- Last activity/login if available

Do NOT primarily display UUIDs.

Example:

```text
Name             Email              Role       Status
------------------------------------------------------
Rahim Hasan      rahim@email.com    ADMIN      Active
Karim Ahmed      karim@email.com    ADMIN      Active
```

---

# 9. Admin Creation

Only Super Admin can create an Admin.

Required fields should normally include:

- Member/User selection OR name
- Email/account identifier
- Role
- Team if applicable
- Status

Prefer selecting an existing user rather than creating duplicate user records.

Example:

```text
Select User
[ Search member... ]

Rahim Hasan
Karim Ahmed
Sazid Ahmed
```

Then assign:

```text
Role: ADMIN
```

Do not allow arbitrary client-side role assignment to:

```text
SUPER_ADMIN
```

unless the system explicitly supports a secure Super Admin creation/bootstrap flow.

---

# 10. SUPER_ADMIN Protection Rules

Implement safeguards.

### Rule 1

An Admin cannot create another Admin unless explicitly authorized.

### Rule 2

An Admin cannot promote a user to Super Admin.

### Rule 3

A User cannot access admin-management APIs even if they manually call the endpoint.

### Rule 4

Frontend hiding is not enough.

Every sensitive operation must be protected server-side.

### Rule 5

Prevent deleting/deactivating the final active Super Admin.

### Rule 6

Protect Super Admin account from ordinary Admin actions.

---

# 11. ISSUE-03 — Notice Position

### Current problem

Notice section is appearing too far down in the dashboard.

### Required improvement

Inspect the current dashboard hierarchy.

Notices should be placed in a prominent location without destroying the existing dashboard layout.

Recommended order:

```text
Dashboard
│
├── Summary / KPI
│
├── Important Notices
│
├── Tasks / Activities
│
└── Other sections
```

If notices are urgent/important, they should appear near the top.

Use responsive layout.

Do not simply move HTML elements without checking the grid/flex layout and responsive behavior.

---

# 12. ISSUE-04 — Raw UUIDs Are Being Shown

### Current problem

Task and related UI sections display raw IDs such as:

```text
8f7a2c1e-...
```

This is not user-friendly.

### Required principle

Use UUID internally, but display human-readable identity externally.

Bad:

```text
Assigned To:
8f7a2c1e-91...
```

Good:

```text
Assigned To:
Zihad Hasan
```

Or:

```text
Assigned To:
Zihad Hasan (Member ID: 8f7a2c1e...)
```

The UUID should generally remain hidden unless needed for technical/admin/debug purposes.

---

# 13. Task Member Selection

When creating/editing a task, do NOT require the user to manually enter a UUID.

Use a searchable selection field.

Example:

```text
Assign Member
[ Search member... ]

Zihad Hasan
Sazid Ahmed
Sara Rahman
```

Store:

```text
memberId / userId / UUID
```

internally.

Display:

```text
member.name
```

in the UI.

---

# 14. Team Selection

Similarly, team assignment should use:

```text
Select Team
[ Search team... ]

EdgeVision
IntelliNova Research Team
Research Team Alpha
```

Store the team's internal ID/UUID.

Display:

```text
team.name
```

to users.

---

# 15. Task Display

Task cards/tables should show:

```text
Task Title
Description
Assigned Member
Team
Priority
Status
Deadline
```

Example:

```text
Task: Dataset Cleaning

Assigned To: Zihad Hasan
Team: EdgeVision
Status: In Progress
Deadline: 05 Oct 2026
```

Do not show raw UUIDs by default.

---

# 16. ID Display Strategy

Follow this rule throughout the application:

### Internal

Use:

```text
UUID / ID
```

for:

- Database relations
- API payloads
- Foreign keys
- Internal logic
- Routing where necessary

### External/UI

Use:

```text
Name
Email
Team Name
Project Name
Component Name
```

wherever human-readable labels exist.

---

# 17. Backend Response Design

Where appropriate, APIs should return both IDs and display data.

Example:

```json
{
  "memberId": "uuid",
  "member": {
    "id": "uuid",
    "name": "Zihad Hasan"
  },
  "teamId": "uuid",
  "team": {
    "id": "uuid",
    "name": "EdgeVision"
  }
}
```

Do not remove IDs from API responses if frontend/business logic needs them.

Instead, provide display-friendly relational data.

Avoid inefficient N+1 queries.

Use appropriate joins/includes/population according to the existing ORM/database architecture.

---

# 18. User/Member Search

For member selectors:

- Search by name
- Search by email where appropriate
- Show avatar if the existing UI supports it
- Show team where useful
- Return the internal ID behind the selection

Example:

```text
🔍 Search member...

Zihad Hasan
Software Engineering
EdgeVision
```

The selected value should be the internal user ID.

---

# 19. Team Search

For team selectors:

```text
🔍 Search team...

EdgeVision
IntelliNova Research Team
```

Selected value:

```text
teamId
```

Displayed value:

```text
team.name
```

---

# 20. Authentication & Logout Investigation

Inspect the complete auth flow:

```text
Login
  ↓
Token/session creation
  ↓
Protected routes
  ↓
User state
  ↓
Logout
  ↓
Token/session invalidation
  ↓
Redirect
```

Check:

- Access token
- Refresh token
- Cookies
- Local storage/session storage
- Auth context/store
- Backend logout endpoint
- Route guards
- Cached user state

Fix the root cause instead of adding a superficial logout button.

---

# 21. Navigation & Role-Based UI

Navigation should change according to role.

### Super Admin

```text
Dashboard
Members
Teams
Tasks
Notices
Components
Finance
Admin Management
Audit / Monitoring
Settings
```

### Admin

```text
Dashboard
Members
Teams
Tasks
Notices
Components
Finance
Monitoring
```

### User

```text
Dashboard
My Tasks
Teams
Notices
Components
Finance
```

Adjust according to existing product modules.

Users must not see admin-management navigation.

---

# 22. Audit & Monitoring

Because Super Admin is responsible for system monitoring, integrate existing audit logging if available.

Track important administrative events:

```text
Admin Created
Admin Updated
Admin Activated
Admin Deactivated
Role Changed
User Created
User Updated
Task Created
Task Assigned
Notice Created
Component Approved
Fund Added
Expense Added
```

For each event, record when supported:

- Actor
- Action
- Target
- Timestamp
- Relevant ID
- Metadata

Do not expose sensitive information unnecessarily.

---

# 23. Dashboard Improvements

Improve information hierarchy without redesigning the entire product.

Recommended:

```text
┌────────────────────────────────────────────┐
│ KPI / Summary Cards                        │
├────────────────────────────────────────────┤
│ Important Notices                          │
├──────────────────────┬─────────────────────┤
│ Tasks / Activities   │ Upcoming / Summary  │
├──────────────────────┴─────────────────────┤
│ Other dashboard information                │
└────────────────────────────────────────────┘
```

Use the existing design system.

Avoid excessive cards, animations, gradients, or decorative elements.

Prioritize readability and usefulness.

---

# 24. Data Integrity

Never solve display problems by changing stored foreign keys.

For example:

```text
task.assignedTo = user UUID
```

should remain correct.

Only the presentation layer should resolve:

```text
user UUID → user name
```

Similarly:

```text
teamId → team.name
projectId → project.name
componentId → component.name
```

---

# 25. Error States

Implement user-friendly states:

### Member not found

```text
Member information unavailable
```

### Team not found

```text
Team information unavailable
```

### Unauthorized

```text
You do not have permission to perform this action.
```

### Session expired

```text
Your session has expired. Please log in again.
```

Do not expose raw database errors or stack traces to normal users.

---

# 26. Testing Checklist

## Authentication

- [ ] User can login.
- [ ] User can logout.
- [ ] Logout clears appropriate session/token state.
- [ ] Back button does not expose protected content after logout.
- [ ] Refresh after logout stays logged out.
- [ ] Expired session redirects correctly.

## Roles

- [ ] Super Admin can manage Admins.
- [ ] Admin cannot create Super Admin.
- [ ] Admin cannot modify Super Admin.
- [ ] User cannot access admin endpoints.
- [ ] User cannot access Super Admin endpoints.
- [ ] Frontend navigation reflects role.
- [ ] Backend authorization reflects role.

## Tasks

- [ ] Member selector shows member names.
- [ ] Team selector shows team names.
- [ ] Task stores correct internal IDs.
- [ ] Task display shows names instead of UUIDs.
- [ ] Missing member/team is handled gracefully.

## Notices

- [ ] Notice section appears in the intended dashboard position.
- [ ] Responsive layout works on desktop/tablet/mobile.
- [ ] Existing notice functionality remains intact.

## Admin Management

- [ ] Super Admin can create Admin.
- [ ] Super Admin can activate/deactivate Admin.
- [ ] Admin list is correct.
- [ ] Role labels are correct.
- [ ] Last active Super Admin cannot accidentally be removed.

---

# 27. Implementation Order

Do the work in this order:

### Phase 1 — Investigation

1. Inspect auth system.
2. Inspect role system.
3. Inspect User/Member/Team relationships.
4. Inspect Task assignment.
5. Inspect dashboard layout.
6. Inspect Notice component.
7. Identify UUID rendering sources.

### Phase 2 — Critical Fixes

1. Fix logout.
2. Fix role/admin identification.
3. Fix UUID → name/team display.
4. Fix member/team selection.
5. Fix notice positioning.

### Phase 3 — Role Architecture

1. Introduce/verify SUPER_ADMIN role.
2. Define Admin permissions.
3. Define User permissions.
4. Add server-side authorization.
5. Add Super Admin Admin-management UI.

### Phase 4 — Refinement

1. Improve dashboard hierarchy.
2. Improve selectors/search.
3. Improve empty/loading/error states.
4. Add audit integration where available.
5. Clean up inconsistent role/identity displays.

### Phase 5 — Verification

Run:

- Backend tests
- Frontend tests
- Build
- Lint
- Database migration validation
- Manual role-based testing

Then verify existing literature-review features.

---

# 28. Important Engineering Rules

1. Do not rewrite the application.
2. Do not replace the existing authentication system without a demonstrated reason.
3. Do not create duplicate User/Member tables.
4. Do not create duplicate Team tables.
5. Do not replace UUIDs in the database just because they look ugly in the UI.
6. Do not trust frontend role checks alone.
7. Do not expose Super Admin controls to Admins.
8. Do not break existing APIs unnecessarily.
9. Reuse existing components and services.
10. Keep changes modular and reversible.
11. Preserve existing data.
12. Do not use mock data in production flows.
13. Do not mark a feature complete until it has been tested.

---

# 29. Final Deliverables

After implementation, provide:

1. Summary of changes.
2. Files/modules changed.
3. Database changes/migrations.
4. New APIs/endpoints.
5. Role/permission changes.
6. Bugs fixed.
7. Tests performed.
8. Any remaining issues.
9. Any migration/seed instructions required to run the updated system.

Do not claim completion if any critical issue remains unresolved.


---

# 30. Additional Admin Task Management

Admin must have full operational control over tasks within the existing business rules.

Admin can:
- Create task
- View task
- Edit task
- Delete task
- Assign/reassign task to a member
- Assign/reassign task to a team
- Change task status, priority, and deadline
- Update task description
- View task history where supported

For task deletion, inspect whether the project uses soft-delete/archive/audit history. Prefer archival when historical records must be preserved.

Normal users must not arbitrarily edit or delete tasks unless existing requirements explicitly allow it.

---

# 31. Image Upload & Image Connection Investigation

## Current Problem

The web application has image-related issues. Users cannot successfully upload images, or the uploaded image is not correctly connected between frontend, backend, storage, database, and UI.

Investigate the complete pipeline:

```text
File Picker
 → FormData/Request
 → API Endpoint
 → Backend Upload Handler
 → Validation
 → Storage
 → Database Image URL/Path
 → API Response
 → Frontend Rendering
```

Do not assume the problem is only frontend-related.

### Frontend

Verify:
- File input works.
- Selected file is stored correctly.
- `multipart/form-data` is used where required.
- `FormData` uses the exact backend field name.
- File is actually included in the request.
- Form validation does not incorrectly reject images.

Do not JSON-stringify a file.

### Backend

Inspect:
- Multipart/upload middleware
- Field name
- File-size limits
- MIME validation
- Storage path/bucket
- Filename generation
- File permissions
- Error handling

### Storage & Database

Use the existing storage architecture. Do not introduce a new provider unnecessarily.

Store a valid image reference such as:

```text
imageUrl
imagePath
mediaId
```

according to the existing architecture.

### URL/Path

Verify:
- API base URL
- Relative vs absolute URL
- Static-file serving
- CORS
- Development/production environment variables
- Backend/frontend host configuration

Fix the actual connection problem rather than hiding it with a placeholder.

### User Profile Image

If profile/avatar upload is supported:

```text
User
 → Select Image
 → Upload
 → Backend
 → Storage
 → Profile Updated
 → Image URL Returned
 → Avatar Displayed
```

Verify the complete flow and ensure the image remains visible after page refresh.

---

# 32. Notice Position — Explicit Requirement

The Notice section MUST appear above the Overview section.

Required dashboard order:

```text
Dashboard
│
├── Important Notices
├── Overview / KPI
├── Tasks / Activities
└── Other dashboard sections
```

Do not place Notice below Overview or hide it in a secondary tab unless explicitly required.

Ensure responsive behavior remains correct.

---

# 33. General Web Correction Audit

After fixing the reported issues, inspect related functionality without unnecessarily redesigning unrelated areas.

Check:

### Authentication
- Login
- Logout
- Session persistence/expiration
- Protected routes
- Role redirects

### Navigation
- Sidebar links
- Active state
- Role-specific menus
- Broken routes
- Unauthorized pages

### Dashboard
- Notice placement
- Overview
- Tasks
- Cards
- Responsive layout
- Loading/empty/error states

### User/Member
- Profile
- Name display
- Avatar/image upload
- Member selection
- Team association

### Team
- Team name display
- Team selection
- Team members
- UUID hidden from normal UI

### Tasks
- Create
- View
- Edit
- Delete
- Member assignment
- Team assignment
- Status
- Priority
- Deadline
- UUID display

### Notices
- Create/edit/delete according to role
- Position
- Details
- Responsive behavior

### API/Data Connection
Check for broken endpoints, wrong API base URLs, CORS issues, missing relations, failed requests, console errors, and network errors.

Fix real functional/usability issues; do not make unrelated cosmetic changes.

---

# 34. GitHub Safety Rule — CRITICAL

The agent MUST NOT push or publish changes to GitHub before receiving explicit user permission.

Never automatically:

```text
git push
```

Also do not:
- Create a GitHub PR
- Merge a PR
- Publish a release
- Modify the remote repository
- Force push
- Push to main/master

Required workflow:

```text
Inspect
 → Implement
 → Test
 → Fix
 → Review
 → Final Verification
 → STOP
 → Ask User for Permission
 → Only after explicit approval: Git commit/push
```

Even if all tests pass, STOP before any remote GitHub operation.

---

# 35. Final Verification Before GitHub Permission

Before asking for permission, verify:

### Functional
- Login works.
- Logout works.
- Super Admin permissions work.
- Admin permissions work.
- User permissions work.
- Admin can edit tasks.
- Admin can delete tasks.
- Member selectors show names.
- Team selectors show names.
- Raw UUIDs are not unnecessarily exposed.
- Notice is above Overview.
- User image upload works.
- Uploaded images are stored correctly.
- Uploaded images render after refresh.
- Existing images still work.
- Existing literature-review features still work.

### Technical
- Backend tests pass.
- Frontend tests pass.
- Lint passes where configured.
- Build succeeds.
- Database migrations work.
- No critical console errors.
- No critical API/network errors.
- Server-side authorization is verified.
- No secrets or `.env` files are included.

---

# 36. Final Agent Response Before GitHub

After implementation and verification, DO NOT push.

Report:

```text
Implementation completed.

Fixed:
- Logout
- Super Admin/Admin/User roles
- Admin task edit/delete
- Member/team name display
- Notice placement
- Image upload/connection
- Other verified web issues

Tests:
- Backend: PASS/FAIL
- Frontend: PASS/FAIL
- Build: PASS/FAIL

GitHub:
NOT PUSHED — waiting for explicit permission.
```

Then wait.

Only an explicit instruction such as:

```text
Yes, push to GitHub.
```

or equivalent authorization permits the remote Git operation.


---

# 37. Assets Section — User-Submitted Resources

## Objective

The existing **Assets** section should become a shared resource area where authenticated users can contribute useful research resources from their own accounts.

Users should be able to add resources such as:

- Useful website links
- Research-related web pages
- Blog posts
- Tutorials
- Documentation
- Other relevant external resources

The system must preserve the identity of the person who submitted each asset.

---

## 37.1 User Asset Submission

A logged-in user should have an action such as:

```text
+ Add Asset
```

The form should support:

```text
Title
URL / Link
Description
Category
Optional Thumbnail/Image
```

The system should automatically associate the authenticated user as the creator.

Do NOT ask the user to manually enter their own user ID.

Store the internal:

```text
userId / memberId
```

but display the user's human-readable information.

---

## 37.2 Asset Card Display

Every submitted asset should clearly show:

```text
[Asset Title]

Short description...

Open Resource →

Posted by:
[Profile Image] Zihad Hasan
Software Engineer / Research Member
```

The exact profile title should come from the user's existing profile/designation field if available.

If the project has:

```text
name
profileImage
designation/title
team
```

reuse those fields.

Do not duplicate profile data unnecessarily.

---

## 37.3 Asset Ownership

The system must know:

```text
Asset → Created By → User
```

A user should be able to manage their own submitted assets according to the application's permission rules.

At minimum, users should be able to:

- View their submitted assets
- Edit their own asset where allowed
- Delete their own asset where allowed

Admins should be able to:

- View all assets
- Edit/remove inappropriate or broken assets
- Monitor asset submissions

Do not allow one normal user to modify another user's asset unless authorized.

---

## 37.4 Asset Validation

Validate:

- Title required
- Valid URL
- Supported URL protocol (`https://` preferred)
- Description length
- Optional image type/size
- Duplicate/invalid URL handling where appropriate

Do not trust raw URLs or user-provided HTML.

Prevent unsafe content injection.

---

# 38. Tracker Excel Export & Download — Fix Required

## Current Problem

The tracker currently appears to support Excel export/download, but the export or download is not working correctly.

This must be treated as a functional bug, not just a UI issue.

---

## 38.1 Export Flow

Expected behavior:

```text
Tracker
   ↓
Export to Excel
   ↓
Generate .xlsx
   ↓
Browser download starts
   ↓
Valid Excel file downloaded
```

The downloaded file should open correctly in Microsoft Excel/LibreOffice/Google Sheets.

---

## 38.2 Investigate Full Export Pipeline

Inspect:

- Export button handler
- Frontend API request
- Backend export endpoint
- Authentication
- Database query
- Excel generation library
- Response content type
- Content-Disposition header
- Blob handling
- Browser download logic
- File name generation
- Empty-data handling
- Large dataset handling

Do not simply add another download button.

Find the root cause.

---

## 38.3 Expected Download

Use a meaningful filename, for example:

```text
literature-tracker-2026-10-01.xlsx
```

The response should use the appropriate Excel MIME type and download headers.

If the frontend receives a binary response, handle it as a `Blob` rather than trying to parse it as JSON.

---

## 38.4 Export Data

The exported tracker should contain meaningful human-readable values.

Do NOT export only raw UUIDs where names are available.

For example:

```text
Paper Title
Author
Member Name
Team Name
Status
Assigned Member
Research Area
Date
Notes
```

rather than:

```text
user_uuid
team_uuid
```

unless IDs are explicitly useful as additional columns.

---

## 38.5 Export Verification

After fixing:

1. Click Export.
2. Confirm browser download starts.
3. Confirm `.xlsx` file exists.
4. Open the file.
5. Verify headers.
6. Verify data rows.
7. Verify member/team names.
8. Verify special characters are preserved.
9. Verify empty tracker behavior.
10. Verify larger datasets.
11. Verify unauthorized users cannot access protected export APIs if export is role-restricted.

---

# 39. Dashboard Summary Cards — Screenshot-Based UI Correction

The provided screenshot shows three dashboard summary cards:

```text
Research papers
Project members
Tasks & assignments
```

with numbers such as:

```text
0
0
0
```

and a small:

```text
View project data →
```

text link.

## Current UX Problem

The cards currently look like passive information/statistics.

It is not immediately obvious that these are interactive navigation controls.

The user should be able to understand at first glance:

> “These cards are clickable and will take me to the related section.”

---

## 39.1 Make the Cards Clearly Interactive

Each summary card should function as a clear navigation action.

Recommended behavior:

```text
[ Research Papers ]
0

View Research Papers →
```

```text
[ Project Members ]
0

View Project Members →
```

```text
[ Tasks & Assignments ]
0

View Tasks & Assignments →
```

The entire card may be clickable if consistent with the application's design.

If the whole card is clickable:

- Use pointer cursor.
- Add a subtle hover state.
- Keep visible CTA text.
- Use an accessible link/button semantic.
- Provide keyboard focus state.
- Ensure screen readers understand the destination.

---

## 39.2 Improve CTA Text

Avoid generic text:

```text
View project data →
```

because it does not explain what will happen.

Use context-specific text:

```text
View Research Papers →
View Project Members →
View Tasks & Assignments →
```

This makes the destination obvious.

---

## 39.3 Card Icon & Label

Keep the existing icon style if it matches the application.

Make sure the icon communicates the category:

```text
Research Papers → document/book icon
Project Members → users/team icon
Tasks → checklist/task icon
```

Do not rely on the icon alone to communicate the action.

---

## 39.4 Card Navigation

Each card should route to the correct existing page.

Example:

```text
Research Papers → /research-papers
Project Members → /members
Tasks & Assignments → /tasks
```

Use the application's actual routes rather than blindly creating these exact paths.

Verify that no route is broken.

---

# 40. Dashboard Empty-State Behavior

If the number is:

```text
0
```

the card should still clearly explain what the user can do.

For example:

```text
Research Papers
0

No papers yet
View Research Papers →
```

Do not make the dashboard look broken simply because the project currently has no records.

Use existing empty-state conventions if available.

---

# 41. Final Web Feature Verification — Expanded

Before marking the implementation complete, verify all of the following:

### Authentication
- Login
- Logout
- Session
- Role-based access

### Dashboard
- Notice above Overview
- Research Papers card
- Project Members card
- Tasks & Assignments card
- Cards are visibly interactive
- Correct navigation
- Empty state
- Responsive layout

### Assets
- Add asset
- Add website link
- Add blog post
- Add useful resource
- Asset creator automatically captured
- Creator name displayed
- Creator profile image displayed if available
- Creator profile/designation/title displayed
- Own asset management
- Admin moderation
- URL validation

### Tracker
- Tracker loads
- Data loads correctly
- Export button works
- Excel file downloads
- Excel file opens
- Names instead of unnecessary UUIDs
- Correct file name
- Empty-data export handled
- Large dataset tested

### Existing Features
- Literature review
- Tasks
- Teams
- Members
- Notices
- Components
- Finance
- Admin/Super Admin controls

Do not mark the project complete if a critical existing feature is broken.

---

# 42. GitHub Rule Remains Unchanged

All requirements from the previous GitHub safety section remain mandatory.

After completing all work:

```text
IMPLEMENT
   ↓
TEST
   ↓
FIX
   ↓
VERIFY
   ↓
REPORT
   ↓
STOP
```

Do NOT push to GitHub until the user explicitly authorizes it.

Even after successful tests, wait for explicit permission.
