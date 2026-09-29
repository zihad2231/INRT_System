# IntelliNova - Project Gap Analysis & Execution Plan

After carefully comparing the PRD, TRD, and the Backend Schema with the current codebase (`apps/api` and `apps/web`), the following modules and features are still missing and need to be implemented to achieve a complete, smooth software experience.

## 🔴 Missing Backend Modules (NestJS - `apps/api`)
1. **Papers Module (`src/papers`) - *Partially Missing/To Validate***
   - The Central Paper Registry, duplicate detection engine, and paper assignments logic need to be fully verified or built.
2. **Audit Logs Module (`src/audit`)**
   - No module exists to capture user activity and record entity changes (PRD Section 51, Schema Section 55).
3. **Notifications Module (`src/notifications`)**
   - Real-time/In-app notification system is missing (PRD Section 30).
4. **Excel Exports & Background Jobs (`src/exports` & `src/jobs`)**
   - Need to implement BullMQ or Inngest for asynchronous background tasks (like generating Excel trackers).

## 🔴 Missing Frontend Modules (Next.js - `apps/web`)
1. **Papers & Literature Registry UI (`app/papers` or `app/research`)**
   - The UI for adding papers, duplicate paper warning modals, and collaboration requests is not fully scaffolded.
2. **Audit Logs Viewer**
   - Super Admin/Admin interface to view historical changes.
3. **Notifications Dropdown/Center**
   - A real-time notification popover/bell icon in the dashboard.
4. **Export Tracker UI**
   - A dedicated section for team leaders and admins to download Excel reports.

## 🚀 Execution Plan (Organized into Sprints)

### Sprint 1: The Core Research Engine (Papers)
- Implement frontend UI for the Central Paper Registry (`apps/web/app/papers`).
- Hook up the frontend with the `PapersModule` API.
- Ensure the duplicate prevention engine (business logic) is working perfectly and throwing the `PAPER_ALREADY_ASSIGNED` conflict to the frontend.

### Sprint 2: Audit & Accountability
- Create the `AuditModule` in NestJS.
- Add Prisma interceptors/middleware to automatically log creates/updates/deletes.
- Build the frontend UI for Admin to view Audit Logs.

### Sprint 3: Notifications & Communication
- Implement the `NotificationsModule`.
- Build the WebSocket gateway (or SSE) for real-time delivery.
- Create the Notification Bell UI in the Next.js header.

### Sprint 4: Reporting & Background Jobs
- Set up BullMQ + Redis for background job processing.
- Implement the Excel Generation logic using `exceljs` or `xlsx`.
- Build the frontend download buttons and Export status UI.

---
**Status of Database:** The Prisma Schema is completely updated. The `pnpm install` is currently running, after which the database will be seeded.
