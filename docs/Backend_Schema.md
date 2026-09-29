# IntelliNova Research & Organization Management System
## Backend Schema / Database Design — Version 1.0

**Database:** PostgreSQL
**Recommended Hosting:** Neon PostgreSQL
**Architecture:** Relational + JSONB for flexible research data
**ORM Recommendation:** Prisma ORM
**Primary Key Strategy:** UUID
**ID Strategy:** Internal UUID + human-readable business IDs

### 1. Database Design Principles
এই database-এর মূল লক্ষ্য:
* Data integrity
* Duplicate prevention
* Strong relationships
* Role-based access
* Team/project-level access control
* Research form flexibility
* Efficient reporting
* Auditability
* Future scalability

Database-এর গুরুত্বপূর্ণ business logic শুধুমাত্র backend code-এর উপর নির্ভর করবে না। যেখানে সম্ভব, database constraint + backend validation দুটোই ব্যবহার করা হবে।

### 2 - 84. Schema Definition
*(The detailed schema, including entities like Users, Roles, Permissions, Research Areas, Teams, Projects, Papers, Assignments, Tasks, Notices, Assets, and Audit Logs have been captured in the system context and the Prisma schema `apps/api/prisma/schema.prisma`)*

### Important Rules
* **Rule 1 — One Central Paper Registry:** একই paper organization/project-এর মধ্যে duplicate record তৈরি করবে না।
* **Rule 2 — Assignment is Separate from Paper:** Paper এবং কে paperটি পড়ছে—এই দুটি আলাদা entity। (Paper -> Paper Assignment -> Member)
* **Rule 3 — Research Questions are Dynamic:** Project -> Question Set -> Questions -> Answers.

### MVP Database Tables
**Phase 1 — Core**
organizations, users, roles, permissions, user_roles, role_permissions, teams, team_members, research_areas, user_research_areas, projects, project_teams, project_members, papers, paper_identifiers, project_papers, paper_assignments

*(Refer to the full document in chat history for more details.)*
