# Prisma schema and migration notes

`schema.prisma` currently implements the Phase 1 relational foundation from the approved schema: organizations, users and access control, research areas/skills, teams, projects, and the central paper registry/assignments.

## Local commands

- `corepack pnpm --filter @intellinova/api prisma:validate`
- `corepack pnpm --filter @intellinova/api prisma:generate`
- Set a real local `DATABASE_URL` in the ignored root `.env` before running `prisma:migrate:dev`.

No migration has been applied or committed yet: a real PostgreSQL URL was not provided. Generate and review the initial migration against the agreed schema before connecting any shared/staging/production database.

## Required PostgreSQL-only paper assignment constraint

Prisma's schema DSL cannot represent the required partial unique index. Apply [paper-primary-reader-unique-index.sql](sql/paper-primary-reader-unique-index.sql) after the baseline migration has created `paper_assignments`.

This is necessary for race-safe enforcement that one project/paper pair has at most one active primary reader. The service should still catch the database unique violation and return the structured `PAPER_ALREADY_ASSIGNED` response.
