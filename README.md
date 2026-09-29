# INRT_System

Research and organization management platform. This repository is the full TypeScript monorepo containing the NestJS API backend and Next.js web application.

## Workspace

- `apps/web`: Next.js frontend
- `apps/api`: NestJS modular-monolith API

The Phase 1 PostgreSQL schema and Prisma integration are in place. Authentication currently supports login, logout, and the authenticated current-user endpoint using database-backed sessions. Feature modules are being added incrementally; avoid adding schema fields or authorization rules beyond the reviewed schema.

## Requirements

- Node.js 20+
- pnpm 10.12.4 (Corepack can activate the pinned version)

## Development

Corepack can run the pinned package manager from the repository root: `corepack pnpm install`.

- `corepack pnpm dev`: run frontend and API
- `corepack pnpm dev:web`: run frontend only
- `corepack pnpm dev:api`: run API only
- `corepack pnpm build`: build workspace applications
- `corepack pnpm lint`: lint workspace applications where configured
- `corepack pnpm typecheck`: type-check both applications

Copy `.env.example` to `.env`, replace the illustrative `DATABASE_URL` with a real PostgreSQL connection string, and never commit credentials. Run the Prisma migration workflow only against a database you intend to modify.

### Authentication API

- `POST /api/v1/auth/login` — validates email/password, creates a seven-day database session, and sets an HttpOnly, SameSite=Strict cookie.
- `POST /api/v1/auth/logout` — revokes the presented session and clears the cookie.
- `GET /api/v1/auth/me` — returns the current active user, organization, roles, and effective permissions.
- `GET /api/v1/users?page=1&limit=20` — lists non-deleted users in the current user's organization; requires `USER_VIEW`.
- `POST /api/v1/users` — provisions an invited user in the current organization; requires `USER_CREATE`. Role assignment additionally requires `ROLE_ASSIGN`; assigning system roles is restricted to Super Admin.
- `GET /api/v1/teams?page=1&limit=20&status=ACTIVE` — lists teams in the current organization; Super Admin/Admin see all organization teams, other users see only teams where they are active members. Requires `TEAM_VIEW`.
- `GET /api/v1/teams/:id` — returns a visible team; requires `TEAM_VIEW`.
- `POST /api/v1/teams` — creates a team and optional memberships/research-area links; requires `TEAM_CREATE`. Assigning a leader additionally requires `TEAM_LEADER_ASSIGN`.
- `GET /api/v1/projects?page=1&limit=20&status=ACTIVE` — lists visible projects in the current organization; Super Admin/Admin see all, other users see owned, joined, or active-team projects. Requires `PROJECT_VIEW`.
- `GET /api/v1/projects/:id` — returns a project only when it is within the caller's organization and visibility scope; requires `PROJECT_VIEW`.
- `POST /api/v1/projects` — creates a project and optional team/member/research-area relations as one nested database write; requires `PROJECT_MANAGE`.
- `GET /api/v1/projects/:projectId/papers?page=1&limit=20` — lists the project paper registry and current primary-reader details; requires `PAPER_VIEW`.
- `POST /api/v1/projects/:projectId/papers` — adds an existing paper by `paperId`, or finds/creates a central registry paper from `title` plus DOI/URL identifiers, then assigns the caller as primary reader. Requires `PAPER_ASSIGN`.
- `POST /api/v1/projects/:projectId/papers/:paperId/assignments` — assigns a primary reader by `userId`; the target must be active in the same organization. Requires `PAPER_ASSIGN`.
- `POST /api/v1/question-sets` — creates a dynamic typed research question set; optional `projectId` assigns it immediately. Requires `PROJECT_MANAGE`.
- `GET /api/v1/projects/:projectId/questions` — retrieves assigned active research question sets for form rendering; requires `PAPER_VIEW`.
- `POST /api/v1/projects/:projectId/question-sets/:questionSetId` — assigns an existing organization question set; requires `PROJECT_MANAGE`.
- `GET /api/v1/projects/:projectId/papers/:paperId/research-responses` — returns the caller's latest saved answers and submission state; caller must be an assigned primary reader and have `PAPER_VIEW`.
- `POST /api/v1/projects/:projectId/papers/:paperId/research-responses` — saves a typed draft or submits it for review with `{ "answers": [...], "submit": true }`; requires `PAPER_ASSIGN` and an active primary-reader assignment.
- `POST /api/v1/projects/:projectId/research-submissions/:submissionId/approve` and `/request-revision` — review submitted research; requires `PAPER_REVIEW`.
- `GET /api/v1/tasks?page=1&limit=20&status=TODO` — lists task records within the caller's organization and visibility scope; requires `TASK_VIEW`.
- `POST /api/v1/tasks` — creates a task with optional project/team, active organization member assignees, parent, and completed prerequisite dependencies; requires `TASK_CREATE`.
- `PATCH /api/v1/tasks/:id/status` — updates status/progress; only an assignee or user with `TASK_MANAGE` may update. Incomplete dependencies block starting a task.
- `GET /api/v1/todos?page=1&limit=20`, `POST /api/v1/todos`, `PATCH /api/v1/todos/:id/status` — scoped lightweight to-do listing, creation, and status updates. Assigning to others/team requires `TASK_MANAGE`.
- `GET /api/v1/notices?page=1&limit=20` — returns only published, in-date notices visible to the signed-in user: central, active team membership, or explicit individual recipient.
- `POST /api/v1/notices` — creates central/team/individual notice. Requires the matching `NOTICE_CREATE_CENTRAL`, `NOTICE_CREATE_TEAM`, or `NOTICE_CREATE_INDIVIDUAL` permission (or `NOTICE_MANAGE`); target users/teams are validated against the organization.
- `POST /api/v1/notices/:id/acknowledge` — records a one-time acknowledgement for a visible notice that requires it.
- `GET /api/v1/notices/:id/acknowledgements` — returns total/acknowledged/not-acknowledged and percent; requires `NOTICE_MANAGE` or Super Admin.
- `POST /api/v1/media/images` — authenticated multipart upload; send the image as field `image`, up to 10 MB. Valid JPEG/PNG/GIF/WebP content is checked before forwarding to ImageBB; response contains its hosted URL.
- `POST /api/v1/media/organization-logo` — organization admin-only multipart upload using field `image`; saves the ImageBB URL to the current organization and displays it in the app shell. The UI is available at `/settings`.

Only active users can log in. Newly provisioned users remain `INVITED` until an invitation/activation flow is implemented. Login is limited to five attempts per minute per IP in this single API process; use a shared Redis-backed throttler before deploying multiple API replicas. Session tokens are opaque, stored as SHA-256 hashes, and direct permission denies override role grants. A real database and migrated schema are required to run the API.

The web dashboard now verifies the session using `GET /api/v1/auth/me`, loads project/task/notice summaries, and signs out through the API. Configure `NEXT_PUBLIC_API_BASE_URL` for the browser and `WEB_ORIGIN` on the API for credentialed CORS. A real database with an active user and assigned permissions is needed for successful sign-in.

### Implemented web screens

- `/login`: username/email and password sign-in.
- `/`: authenticated, data-backed dashboard for visible projects, papers, tasks, and notices.
- `/projects` and `/projects/:id`: searchable/filterable project portfolio, project creation, project details, and team/paper counts.
- `/projects/:id/papers`: central registry lookup/add flow with duplicate assignment reader details.
- `/projects/:id/papers/:paperId/research`: dynamic project-question form, versioned draft save, and submit-for-review.
- `/members`, `/teams`, `/tasks`, `/notices`, `/research`: organization directory, team list/create, task status and personal todo completion, notice acknowledgement/publishing, and research tracker selection.

Assets management, spreadsheet import/export, analytics reports, meeting/calendar/timeline, and remaining edit/assignment workflows are not yet complete. The listed screens depend on the PostgreSQL schema being migrated and an authenticated account with the corresponding permissions.

### First administrator setup

1. Set a real PostgreSQL `DATABASE_URL` in the ignored root `.env` file and apply the reviewed Prisma migrations.
2. Set `BOOTSTRAP_ORG_NAME`, `BOOTSTRAP_ORG_SLUG`, `BOOTSTRAP_ADMIN_USERNAME`, and a private `BOOTSTRAP_ADMIN_PASSWORD` (10–72 characters) in that local `.env` file. Prefer at least 12 characters and rotate any password shared in chat before production. Do not put passwords in source control or chat.
3. Run `corepack pnpm --filter @intellinova/api db:bootstrap-admin` once. It creates the organization if absent, seeds the Super Admin role and current API permissions, then creates an active admin with the configured username. Reruns preserve an existing account's password and only ensure its Super Admin role.
4. Sign in at `/login` using the configured username and password.

Paper identity matching normalizes title, DOI, and canonical URL. Exact identity matches reuse the central registry entry; title matches are exact after normalization, while semantic similarity remains advisory/future work. The active-primary-reader database invariant additionally requires applying the PostgreSQL SQL index in `apps/api/prisma/sql/paper-primary-reader-unique-index.sql` after the baseline migration.
