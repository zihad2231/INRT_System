# AGENTS.md — Component Management Module

## Role

You are a senior full-stack software engineer working inside an existing research/literature-review management application.

Your task is to implement the **Component Management Module** as a separate feature/module without breaking any existing functionality.

---

## 1. Core Objective

Build a centralized component inventory and component access-request system.

The module must allow:

- Admins to create, update, delete, and manage components.
- All authenticated users to view the component list.
- Users to request access/use of an available component.
- Admins to review, approve/grant, or reject component requests.
- The system to track component availability and allocation.
- Users to see relevant component status and usage information in read-only mode.

### Permission Principle

**Admin = Full Control**

**User = View + Request**

Users must never be able to directly create, edit, delete, approve, reject, or alter component inventory data.

---

## 2. Before Coding — Mandatory Project Inspection

Before changing code:

1. Inspect the complete existing project structure.
2. Identify the frontend framework and backend framework.
3. Identify the database and ORM/query layer.
4. Identify existing authentication and authorization.
5. Identify the existing User/Team/Project entities.
6. Identify existing API conventions.
7. Identify existing UI/component conventions.
8. Identify existing validation, error handling, and response formats.
9. Identify existing routing/navigation structure.
10. Reuse existing architecture and naming conventions.

Do NOT introduce a new framework, ORM, authentication system, or unrelated dependency unless absolutely necessary.

Do NOT rewrite existing modules.

---

# 3. Functional Requirements

## 3.1 Component List

Create a Component Management section.

Each component should support at minimum:

- Component ID
- Component Name
- Category
- Description
- Image
- Total Quantity
- Available Quantity
- Allocated/In-Use Quantity
- Status
- Created At
- Updated At

Optional fields may be added if the existing architecture supports them:

- Brand
- Model
- Unit Price
- Purchase Date
- Location
- Condition
- Notes

### Status

The system should derive or maintain meaningful states such as:

- Available
- Partially Available
- In Use
- Unavailable

Avoid allowing contradictory quantities and statuses.

For example:

```text
Total Quantity = 10
Available Quantity = 6
Allocated Quantity = 4
```

The system must preserve:

```text
Total = Available + Allocated
```

where applicable.

---

# 4. Admin Features

Admin must be able to:

### Add Component

Fields:

- Name
- Category
- Description
- Image
- Quantity
- Optional metadata

Validate all required fields.

### Edit Component

Admin can update component information and inventory quantity according to safe inventory rules.

### Delete Component

Do not allow destructive deletion if the component has active allocations or historical requests unless the existing project has an established soft-delete/archive mechanism.

Prefer:

```text
Active / Archived
```

over destroying historical records.

### View Component Details

Admin should see:

- Component information
- Image
- Total quantity
- Available quantity
- Allocated quantity
- Current allocations
- Active projects/users using it
- Request history

---

# 5. User Features

Users can:

### View Components

Users can browse the component inventory in read-only mode.

They can see:

- Component name
- Image
- Category
- Description
- Availability
- Available quantity
- Current usage where appropriate

Users cannot modify these values.

### Request Component

A user can submit a request containing:

- Component
- Requested quantity
- Project
- Purpose/reason
- Expected usage start date
- Expected usage end date
- Additional note

Request status:

```text
PENDING
APPROVED / GRANTED
REJECTED
CANCELLED
RETURNED
```

Use the existing project's enum/status conventions if available.

---

# 6. Request Approval Workflow

Workflow:

```text
USER
  ↓
Select Component
  ↓
Submit Request
  ↓
PENDING
  ↓
ADMIN REVIEW
  ├── APPROVE / GRANT
  └── REJECT
```

When Admin approves:

1. Validate that enough quantity is available.
2. Reserve/allocate the requested quantity.
3. Decrease available quantity.
4. Increase allocated/in-use quantity.
5. Create an allocation/usage record.
6. Update request status to APPROVED/GRANTED.
7. Preserve an audit/history record if the project already supports auditing.

If insufficient quantity exists, approval must fail safely with a clear error.

Do NOT allow available quantity to become negative.

---

# 7. Component Allocation / Usage

Create or reuse a relation between:

```text
Component
Project
User/Team
Allocation
```

An allocation should track at minimum:

- Component
- Project
- User/Team
- Quantity
- Start Date
- Expected End Date
- Actual Return Date
- Status
- Created At
- Updated At

Example:

```text
ESP32
Total: 10
Available: 6
In Use: 4

Used By:
- Smart Agriculture Project — 2 units
- IoT Monitoring Project — 2 units
```

---

# 8. Returning Components

Admin should be able to mark an allocation as returned/released.

When returned:

```text
Available Quantity += Returned Quantity
Allocated Quantity -= Returned Quantity
```

The system must preserve the historical allocation.

Do not delete historical usage records.

---

# 9. UI Requirements

Create a clean, responsive UI consistent with the existing application.

Recommended screens:

### Admin

```text
Admin
 └── Components
      ├── Dashboard
      ├── Component List
      ├── Add Component
      ├── Edit Component
      ├── Component Details
      ├── Requests
      └── Allocations / Usage
```

### User

```text
User
 └── Components
      ├── Component List
      ├── Component Details
      ├── Request Component
      └── My Requests
```

Do not create duplicate layouts if the project already has reusable layouts/components.

---

# 10. API Requirements

Follow the existing API style.

Typical endpoints may be:

```text
GET    /components
GET    /components/:id

POST   /components
PUT    /components/:id
DELETE /components/:id

POST   /component-requests
GET    /component-requests
GET    /component-requests/my

PATCH  /component-requests/:id/approve
PATCH  /component-requests/:id/reject

GET    /component-allocations
PATCH  /component-allocations/:id/return
```

Do not blindly use these paths if the project already has a routing convention.

---

# 11. Authorization

Every protected operation must be enforced server-side.

Never rely only on hiding UI buttons.

### Admin-only

- Create component
- Edit component
- Delete/archive component
- Approve request
- Reject request
- Return/release allocation
- Modify inventory

### User

- View components
- View permitted usage information
- Create component request
- View own requests

---

# 12. Validation & Business Rules

Implement validation for:

- Required fields
- Positive quantities
- Valid dates
- End date >= start date
- Requested quantity <= available quantity at approval time
- No negative inventory
- No unauthorized modification

Prevent duplicate or conflicting active allocations where the business rules require it.

---

# 13. Error Handling

Return clear errors for:

- Component not found
- Insufficient quantity
- Unauthorized action
- Invalid request
- Already processed request
- Invalid allocation
- Component cannot be deleted due to active usage

Use the project's existing error response format.

---

# 14. Security Requirements

- Enforce authorization on backend/API.
- Validate all user-controlled input.
- Validate uploaded images using the existing upload strategy.
- Prevent users from modifying request status directly.
- Prevent users from manipulating component quantity.
- Prevent IDOR-style access to unauthorized resources where applicable.

---

# 15. Auditability

If the existing system has audit logging, integrate with it.

Important actions:

- Component created
- Component updated
- Component archived/deleted
- Request submitted
- Request approved
- Request rejected
- Component allocated
- Component returned

---

# 16. Testing Requirements

Before considering the module complete, test:

### Admin

- Can add component.
- Can edit component.
- Can archive/delete component safely.
- Can view all requests.
- Can approve valid requests.
- Can reject requests.
- Can release/return components.

### User

- Can view components.
- Can submit request.
- Can view own requests.
- Cannot create/edit/delete components.
- Cannot approve/reject requests.
- Cannot modify inventory.

### Inventory

Test:

```text
Total = Available + Allocated
```

after:

- Creation
- Approval
- Return
- Quantity update

Also test insufficient inventory and concurrent approval scenarios where supported.

---

# 17. Non-Functional Requirements

- Keep code modular.
- Reuse existing services/components.
- Follow existing naming conventions.
- Avoid unnecessary dependencies.
- Maintain responsive UI.
- Maintain existing authentication.
- Do not break existing literature-review features.
- Keep database migrations reversible where the project supports migrations.
- Do not remove existing data.

---

# 18. Implementation Strategy

Implement in this order:

1. Inspect existing architecture.
2. Design entities/models and relationships.
3. Create database migration/schema changes.
4. Implement backend services.
5. Implement authorization.
6. Implement component CRUD.
7. Implement request workflow.
8. Implement allocation/return workflow.
9. Implement APIs/routes.
10. Implement frontend pages/components.
11. Add validation and error handling.
12. Add tests.
13. Run existing tests.
14. Run/build frontend and backend.
15. Verify that existing features still work.
16. Provide a concise implementation summary.

---

# 19. Definition of Done

The module is complete only when:

- Admin has full component management.
- Users have read-only component visibility.
- Users can request components.
- Admin can approve/reject requests.
- Approved requests affect inventory correctly.
- Allocations can be tracked.
- Components can be returned/released.
- Historical records are preserved.
- Backend authorization is enforced.
- Validation and error handling work.
- Existing application functionality remains intact.
