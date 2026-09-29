# IntelliNova workspace guidance

- Follow the IntelliNova PRD and TRD: TypeScript, Next.js App Router frontend, NestJS modular-monolith API, and PostgreSQL as the intended primary database.
- Keep frontend and API independently organized under `apps/web` and `apps/api`; keep shared root scripts and package-manager configuration at the workspace root.
- Put business rules and authorization in the API. Never connect the browser directly to privileged database credentials.
- Do not invent schema, role-scope rules, or research workflows. The Backend Schema/Database Design document is pending; wait for it before adding persistence models or database migrations.
- Keep credentials out of source control. Use environment variables and update `.env.example` only with non-secret variable names/placeholders.
- Add validation and tests for meaningful API behavior. Preserve build, lint, and typecheck health.
- MVP priorities begin with authentication, organization/users/teams/projects, central paper registry and duplicate protection, literature tracking, tasks, notices, and progress. Do not implement future-phase features without direction.
