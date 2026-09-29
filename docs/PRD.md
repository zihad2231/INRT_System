# IntelliNova Research & Organization Management System
## Product Requirements Document (PRD) — Version 1.0

**Product Type:** Internal Organization & Research Management Platform
**Primary Users:** Super Admin, Admin, Team Leader/Manager, Research Member
**Primary Purpose:** Organization-wide member, team, research project, paper, task, progress, asset, notice and reporting management.

---

### 1. Product Overview
The IntelliNova Research & Organization Management System is an internal web-based platform designed to centralize the organization's research activities, members, teams, projects, papers, tasks, assets, communication, progress tracking and reporting.

The platform will not be limited to a literature-review application. Literature/paper management will be one of the major research modules inside a broader organizational management system.

**The system will provide:**
* Organization/member management
* Team management
* Research area and skill management
* Research project management
* Central paper registry
* Paper assignment and duplicate prevention
* Research/literature data collection
* Task and To-Do management
* Team target dates and project timelines
* Team-specific portals
* Individual member dashboards
* Organization-wide Admin dashboard
* Central, team-wise and individual notices
* Asset management
* Image and document URL management
* Progress analytics
* Excel export
* Audit history
* Notifications
* Future AI-assisted research capabilities

### 2. Problem Statement
Currently, research organizations often manage members, teams, papers, tasks, deadlines and progress using separate tools such as Excel, Google Sheets, WhatsApp, Google Drive, Email, Documents, and Manual reports. 

**This creates several problems:**
* The same research paper may be assigned to multiple members unintentionally.
* Admin cannot easily see the complete progress of every team.
* Members do not have a centralized place for their tasks.
* Team deadlines are difficult to monitor.
* Notices can be missed.
* Member research areas and skills are not centrally organized.
* Organizational assets are difficult to track.
* Research information is scattered across multiple files.
* Excel trackers require manual updating.
* Historical changes and accountability are difficult to maintain.
* Team-level and organization-level progress reporting takes significant manual effort.

The proposed platform will solve these problems through a centralized, role-based system.

### 3. Product Vision
The vision is to build a single internal platform where every member knows what they need to do, every team knows how they are progressing, and administrators can see the complete organizational picture from one place. The system should eventually become the organization's central digital infrastructure for research operations.

### 4. Product Goals
* **G1 — Centralize Organization Data:** Maintain members, teams, research areas, projects, papers, tasks, assets and notices in one platform.
* **G2 — Prevent Duplicate Paper Assignment:** Ensure that within the same project, a paper currently being read/handled by one member cannot accidentally be started by another member.
* **G3 — Improve Team Accountability:** Every team will have target dates, tasks, projects and measurable progress.
* **G4 — Provide Role-specific Dashboards:** Different users should see different information based on their responsibilities.
* **G5 — Simplify Research Tracking:** Members should update research activities directly in the platform instead of maintaining separate trackers manually.
* **G6 — Automate Reporting:** Members and teams should be able to download their tracker data as Excel files.
* **G7 — Improve Organizational Communication:** Admin should be able to publish central, team-specific or individual notices.
* **G8 — Maintain Research History:** Important activities and changes should be recorded through audit logs and version history.

### 5. Non-Goals for Version 1
The following should not be mandatory for the first release:
* Fully autonomous AI research
* Automatic paper writing
* Automatic publication submission
* Automatic peer-review replacement
* Complex HR/payroll management
* Financial accounting
* Public social networking
* Public-facing research portal

*(These may be considered in future versions.)*

### 6. User Roles

#### 6.1 Super Admin
Super Admin has organization-wide authority.
* **Permissions:** Create Admin, Create users, Create teams, Create projects, Assign members, Assign admins, Manage roles, Manage organization settings, Manage assets, View all teams, View all members, View all projects, View all papers, View all progress, View all notices, Export organization-wide reports, Manage system permissions, View audit logs.

#### 7. Admin
Admin manages operational activities.
* **Permissions:** Manage assigned teams/projects, View all assigned team members, Create tasks, Assign papers, Monitor progress, Create notices, Create team notices, Create individual notices, Approve/reject research submissions, Track deadlines, Manage team target dates, View analytics, Export team/project reports.
* *(Admin should not have unrestricted system-level privileges unless explicitly granted by Super Admin.)*

#### 8. Team Leader / Team Manager
This role is optional but strongly recommended.
* **Permissions:** View own team, View team members, Assign team tasks, View team progress, Manage team To-Do items, View team papers, Monitor deadlines, Export team tracker, Create team-level updates where permitted.
* *(Team Leader cannot manage organization-wide users or system settings.)*

#### 9. Research Member
* **Permissions:** View personal dashboard, View assigned tasks, View team portal, View assigned projects, Add papers, Search papers, Receive duplicate warnings, Update paper progress, Complete research forms, Complete assigned To-Do items, View relevant notices, View own profile, Update permitted profile information, Download personal tracker.

#### 10. Notice Manager
Admin can grant a special permission to selected users.
* **Permissions:** Create central notices if permitted, Create team notices, Edit permitted notices, Archive permitted notices.
* **Cannot:** Create users, Manage teams, Access Admin controls, Change system settings.

### 11. Core Product Modules
The platform will contain the following major modules:
1. Dashboard
2. Organization
3. Members
4. Teams
5. Research Areas
6. Projects
7. Paper Registry
8. Research/Literature Tracker
9. Tasks
10. To-Do
11. Timeline & Target Dates
12. Notices
13. Notifications
14. Assets
15. Documents/Resources
16. Analytics
17. Excel Import/Export
18. Audit Logs
19. System Settings

### 12 - 74. Detailed Specifications
*(Detailed specs are captured in the conversation history and cover modules like Organization Management, Team Portals, Duplicate Prevention, Kanban, Asset Management, Analytics, etc.)*

### Definition of Done — MVP
MVP will be considered ready when:
* Super Admin can create/manage organization users.
* Admin can manage assigned teams.
* Members can access their dashboards.
* Teams have dedicated portals.
* Projects can be created.
* Papers can be added and assigned.
* Duplicate papers are detected within a project.
* Existing reader/member details are shown when conflict occurs.
* Members can update research data.
* Tasks and To-Do items work.
* Team target dates work.
* Central/team/member notices work.
* Admin can monitor team/member progress.
* Assets can be recorded and assigned.
* Images can be represented through stored URLs.
* Excel trackers can be generated.
* Search and filtering work.
* Audit logs record critical actions.
* Role-based access prevents unauthorized access.

### Product Principle
The system should always answer three questions:
* **Member:** “What do I need to do?”
* **Team:** “How is our team progressing?”
* **Admin:** “How is the entire organization progressing, and where is the problem?”
