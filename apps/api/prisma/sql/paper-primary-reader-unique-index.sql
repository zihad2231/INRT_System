-- Apply after the baseline Prisma migration has created paper_assignments.
-- Keeps the primary-reader invariant safe under concurrent assignment requests.
CREATE UNIQUE INDEX "paper_assignments_one_active_primary_reader"
ON "paper_assignments" ("project_id", "paper_id")
WHERE "assignment_type" = 'PRIMARY_READER'
  AND "status" NOT IN ('COMPLETED', 'CANCELLED');
