# AGENTS.md — Fund & Expense Management Module

## Role

You are a senior full-stack software engineer working inside an existing research/literature-review management application.

Your task is to implement the **Fund & Expense Management Module** as a separate feature/module without breaking any existing functionality.

---

## 1. Core Objective

Build a transparent financial monitoring system for the research/team platform.

The module must allow:

- Admins to manage all fund/contribution records.
- Admins to manage all expense records.
- Admins to monitor total fund, total expense, and current balance.
- Users to view financial information in read-only mode.
- Users must not be able to add, edit, delete, or manipulate financial records.

### Permission Principle

**Admin = Full Financial Control**

**User = View Only**

---

## 2. Before Coding — Mandatory Project Inspection

Before changing code:

1. Inspect the complete existing project structure.
2. Identify frontend/backend/database technologies.
3. Identify existing authentication and role/permission system.
4. Identify existing User, Team, Project entities.
5. Identify existing API conventions.
6. Identify existing UI design system.
7. Identify validation/error-handling conventions.
8. Identify existing file upload/attachment system.
9. Identify existing audit logging if available.
10. Reuse existing architecture.

Do NOT rewrite existing modules.

Do NOT introduce unnecessary dependencies.

---

# 3. Financial Model

The system should distinguish between:

```text
FUND / CONTRIBUTION
        +
OTHER INCOME (optional)
        -
EXPENSE
        =
CURRENT BALANCE
```

Primary calculation:

```text
Total Fund = Sum of all valid fund transactions

Total Expense = Sum of all valid expense transactions

Current Balance = Total Fund - Total Expense
```

Do not store calculated balance as an independently editable value unless the existing architecture specifically requires it.

Prefer calculating it from transaction data to prevent inconsistency.

---

# 4. Fund / Contribution Management

Admin can create a fund record.

Required/typical fields:

- Transaction ID
- Contributor name/user
- Amount
- Date
- Purpose
- Payment/source method
- Note
- Attachment/receipt if applicable
- Created By
- Created At
- Updated At

Example:

```text
Contributor: Team Member A
Amount: ৳10,000
Date: 2026-09-30
Purpose: Research Fund
Method: Cash
```

---

# 5. Admin Fund Features

Admin must be able to:

### Add Fund

Create a new contribution record.

### Edit Fund

Correct legitimate data-entry mistakes.

### Delete/Reverse Fund

Avoid hard deletion when possible.

Prefer a transaction reversal/void mechanism if the existing architecture supports financial auditability.

Historical financial records should not silently disappear.

### View Fund History

Admin can filter by:

- Date
- Contributor
- Purpose
- Amount
- Source/method

---

# 6. Expense Management

Admin can create expense records.

Typical fields:

- Expense ID
- Expense title
- Amount
- Expense category
- Date
- Project
- Description
- Vendor/payee
- Attachment/receipt
- Created By
- Created At
- Updated At

Example:

```text
Expense: ESP32 Purchase
Category: Component
Amount: ৳3,500
Project: Smart Agriculture
Date: 2026-09-30
```

---

# 7. Expense Categories

Support configurable categories if the existing system allows it.

Possible defaults:

```text
Component Purchase
Sensor
Hardware
Software
Research
Transportation
Printing
Event
Subscription
Miscellaneous
```

Do not hard-code categories if the application already has a master-data/configuration system.

---

# 8. Financial Dashboard

Create an Admin financial dashboard.

Display:

```text
Total Fund
Total Expense
Current Balance
Number of Contributions
Number of Expenses
```

Example:

```text
Financial Overview
────────────────────────────
Total Fund       ৳100,000
Total Expense     ৳35,000
Current Balance   ৳65,000
────────────────────────────
Contributions          12
Expenses                18
```

---

# 9. Financial Transaction List

Admin should be able to view a unified transaction history.

Example:

```text
Date       Type       Description        Amount
------------------------------------------------
01 Sep     FUND       Member A          +20,000
05 Sep     EXPENSE    ESP32 Purchase     -5,000
10 Sep     FUND       Member B          +30,000
15 Sep     EXPENSE    Transportation     -2,000
```

Use clear transaction types:

```text
FUND
EXPENSE
```

If supported, add:

```text
REVERSAL
ADJUSTMENT
```

---

# 10. User Access

Users can view financial information but cannot modify it.

Users may see:

- Total Fund
- Total Expense
- Current Balance
- Contribution history
- Expense history
- Relevant project expense
- Basic transaction details

Users must NOT see sensitive administrative controls.

No:

```text
Add
Edit
Delete
Approve
Reverse
```

buttons for users.

---

# 11. Project-wise Expense Monitoring

Where a project exists, expenses should optionally be linked to a project.

Example:

```text
Project: Smart Agriculture

Total Project Expense: ৳18,500

Expenses:
- ESP32         ৳4,000
- Sensors       ৳7,500
- PCB           ৳3,000
- Transportation ৳4,000
```

This enables future project-level financial reporting.

---

# 12. Financial Summary & Filters

Admin should be able to filter financial data by:

- Date range
- Transaction type
- Contributor
- Expense category
- Project
- Amount range

Useful summaries:

```text
This Month
This Year
Project-wise
Category-wise
Contributor-wise
```

Do not add complex analytics unless they fit the existing application's scope.

---

# 13. API Requirements

Follow the existing API architecture.

Typical operations:

```text
GET    /funds
GET    /funds/:id
POST   /funds
PUT    /funds/:id
DELETE /funds/:id

GET    /expenses
GET    /expenses/:id
POST   /expenses
PUT    /expenses/:id
DELETE /expenses/:id

GET    /financial-summary
GET    /financial-transactions
```

Do not blindly use these exact paths if the existing project has different conventions.

---

# 14. Authorization

All write operations must be protected server-side.

### Admin-only

- Create fund
- Edit fund
- Delete/void/reverse fund
- Create expense
- Edit expense
- Delete/void/reverse expense
- Manage categories if applicable
- View administrative financial controls

### User

- View financial summary
- View permitted transaction history

Never rely only on frontend route/button hiding for authorization.

---

# 15. Validation & Business Rules

Validate:

- Amount must be greater than zero.
- Date must be valid.
- Required fields must be present.
- Project must exist if supplied.
- Contributor must exist if linked to a user.
- Expense must not create an invalid financial state if the product's rules prohibit negative balance.

Important:

Do NOT silently modify the fund balance.

Do NOT allow users to submit fake fund or expense transactions.

---

# 16. Balance Handling

The balance should be calculated consistently:

```text
Balance = Total Fund - Total Expense
```

Example:

```text
Total Fund = 100,000
Total Expense = 35,000

Balance = 65,000
```

Use precise monetary handling.

Avoid floating-point arithmetic for money when the chosen database/backend supports decimal/numeric types.

For Bangladesh currency, display:

```text
৳65,000
```

but store a proper numeric/decimal value.

---

# 17. Attachments

If the existing application already supports file uploads, allow:

- Receipt
- Invoice
- Payment proof
- Expense document

Do not introduce a separate storage system if an existing one is already available.

Validate file type and size using the application's existing security rules.

---

# 18. Auditability

Financial data is sensitive and should be traceable.

If audit logging exists, record:

- Who created a fund record
- Who edited it
- Who voided/reversed it
- Who created an expense
- Who edited it
- Who voided/reversed it
- Timestamp
- Relevant record ID

Prefer reversible/void operations over permanently deleting historical financial transactions.

---

# 19. UI Requirements

### Admin

```text
Admin
 └── Finance
      ├── Financial Dashboard
      ├── Funds
      ├── Add Fund
      ├── Expenses
      ├── Add Expense
      ├── Transactions
      └── Reports / Filters
```

### User

```text
User
 └── Finance
      ├── Financial Overview
      └── Transaction History
```

Use existing layout, sidebar, table, modal, form, card, and notification components wherever possible.

---

# 20. Testing Requirements

### Admin

Verify:

- Can add fund.
- Can edit fund.
- Can safely void/delete fund according to system rules.
- Can add expense.
- Can edit expense.
- Can safely void/delete expense.
- Can view financial dashboard.
- Can filter transactions.

### User

Verify:

- Can view financial summary.
- Can view permitted transaction history.
- Cannot add fund.
- Cannot edit fund.
- Cannot delete fund.
- Cannot add expense.
- Cannot edit expense.
- Cannot delete expense.

### Calculation

Test:

```text
Fund + Fund - Expense - Expense = Balance
```

Example:

```text
10,000 + 5,000 - 3,000 - 2,000 = 10,000
```

Test empty transaction state, large amounts, invalid amounts, and date filters.

---

# 21. Non-Functional Requirements

- Preserve existing features.
- Use existing architecture.
- Use existing authentication/authorization.
- Use database transactions where multiple financial records must change atomically.
- Use proper decimal/numeric money storage.
- Keep code modular.
- Keep UI responsive.
- Do not expose admin-only controls to users.
- Do not silently destroy financial history.

---

# 22. Implementation Strategy

Implement in this order:

1. Inspect existing architecture.
2. Identify existing User/Team/Project relationships.
3. Design Fund and Expense entities.
4. Create migrations/schema changes.
5. Implement financial services.
6. Implement authorization.
7. Implement fund CRUD.
8. Implement expense CRUD.
9. Implement balance/summary calculations.
10. Implement transaction history.
11. Implement filters.
12. Implement admin UI.
13. Implement user read-only UI.
14. Add validation/error handling.
15. Add audit integration.
16. Add tests.
17. Run existing tests.
18. Build/run frontend and backend.
19. Verify existing literature-review features remain functional.
20. Provide a concise implementation summary.

---

# 23. Definition of Done

The module is complete only when:

- Admin can manage funds.
- Admin can manage expenses.
- Current balance is calculated correctly.
- Financial history is preserved.
- Users can view financial information.
- Users cannot modify financial information.
- Project-wise expenses can be tracked where applicable.
- Authorization is enforced server-side.
- Money is stored safely using appropriate numeric/decimal types.
- Validation and error handling work.
- Existing application functionality remains intact.
