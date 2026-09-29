-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED', 'DELETED');

-- CreateEnum
CREATE TYPE "team_status" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "project_paper_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "paper_assignment_type" AS ENUM ('PRIMARY_READER', 'COLLABORATOR', 'REVIEWER');

-- CreateEnum
CREATE TYPE "paper_assignment_status" AS ENUM ('ASSIGNED', 'READING', 'EXTRACTING', 'SUBMITTED', 'REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "paper_conflict_resolution" AS ENUM ('BLOCKED', 'COLLABORATION_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "research_answer_type" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'URL', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "research_submission_status" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'REVISION_REQUIRED', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "todo_status" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "notice_priority" AS ENUM ('URGENT', 'IMPORTANT', 'NORMAL');

-- CreateEnum
CREATE TYPE "notice_scope" AS ENUM ('CENTRAL', 'TEAM', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "notice_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "asset_condition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'RETIRED');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'LOST', 'RETIRED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "logo_url" TEXT,
    "description" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    "date_format" VARCHAR(30) NOT NULL DEFAULT 'YYYY-MM-DD',
    "status" "organization_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "member_code" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "full_name" VARCHAR(200) NOT NULL,
    "profile_image_url" TEXT,
    "phone" VARCHAR(50),
    "bio" TEXT,
    "joining_date" DATE,
    "status" "user_status" NOT NULL DEFAULT 'INVITED',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "module" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_areas" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "research_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_research_areas" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "research_area_id" UUID NOT NULL,
    "proficiency" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_research_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "proficiency" VARCHAR(30),
    "years_experience" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "team_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "team_leader_id" UUID,
    "start_date" DATE,
    "target_date" DATE,
    "status" "team_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "membership_role" VARCHAR(50),
    "joined_at" DATE,
    "left_at" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_research_areas" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "research_area_id" UUID NOT NULL,

    CONSTRAINT "team_research_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "owner_id" UUID,
    "default_team_id" UUID,
    "start_date" DATE,
    "target_date" DATE,
    "status" "project_status" NOT NULL DEFAULT 'PLANNING',
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_teams" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "project_role" VARCHAR(50),
    "joined_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_research_areas" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "research_area_id" UUID NOT NULL,

    CONSTRAINT "project_research_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "paper_code" VARCHAR(50) NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "authors" JSONB,
    "abstract" TEXT,
    "publication_year" INTEGER,
    "journal_name" VARCHAR(255),
    "doi" VARCHAR(255),
    "canonical_url" TEXT,
    "pdf_url" TEXT,
    "image_url" TEXT,
    "publisher" VARCHAR(255),
    "research_area_id" UUID,
    "metadata" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_identifiers" (
    "id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "identifier_type" VARCHAR(50) NOT NULL,
    "identifier_value" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_papers" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "added_by" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "project_paper_status" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "project_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_assignments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assignment_type" "paper_assignment_type" NOT NULL,
    "status" "paper_assignment_status" NOT NULL DEFAULT 'ASSIGNED',
    "assigned_by" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "paper_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_assignment_conflicts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "existing_assignment_id" UUID NOT NULL,
    "resolution" "paper_conflict_resolution" NOT NULL DEFAULT 'BLOCKED',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_assignment_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_sets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_question_sets" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "question_set_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_question_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_questions" (
    "id" UUID NOT NULL,
    "question_set_id" UUID NOT NULL,
    "question_code" VARCHAR(50) NOT NULL,
    "question_text" TEXT NOT NULL,
    "description" TEXT,
    "answer_type" "research_answer_type" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "excel_column" VARCHAR(100),
    "validation_rules" JSONB,
    "options" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "research_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_responses" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "answer_text" TEXT,
    "answer_number" DECIMAL(18,4),
    "answer_boolean" BOOLEAN,
    "answer_date" DATE,
    "answer_json" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "research_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_submissions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "status" "research_submission_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMPTZ(6),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "project_id" UUID,
    "team_id" UUID,
    "created_by" UUID NOT NULL,
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "task_status" NOT NULL DEFAULT 'TODO',
    "start_date" TIMESTAMPTZ(6),
    "due_date" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "parent_task_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,
    "dependency_type" VARCHAR(30) NOT NULL DEFAULT 'FINISH_TO_START',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "user_id" UUID,
    "team_id" UUID,
    "project_id" UUID,
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "todo_status" NOT NULL DEFAULT 'TODO',
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "notice_priority" NOT NULL DEFAULT 'NORMAL',
    "scope" "notice_scope" NOT NULL,
    "created_by" UUID NOT NULL,
    "publish_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "status" "notice_status" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_teams" (
    "id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,

    CONSTRAINT "notice_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_users" (
    "id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "notice_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_acknowledgements" (
    "id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "serial_number" VARCHAR(255),
    "image_url" TEXT,
    "purchase_date" DATE,
    "purchase_price" DECIMAL(12,2),
    "condition" "asset_condition" NOT NULL DEFAULT 'NEW',
    "status" "asset_status" NOT NULL DEFAULT 'AVAILABLE',
    "location" VARCHAR(255),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID,
    "team_id" UUID,
    "assigned_by" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMPTZ(6),
    "condition_on_assignment" "asset_condition" NOT NULL,
    "condition_on_return" "asset_condition",
    "notes" TEXT,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_status_idx" ON "users"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_member_code_key" ON "users"("organization_id", "member_code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_code_key" ON "roles"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key" ON "user_permissions"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "research_areas_organization_id_status_idx" ON "research_areas"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "research_areas_organization_id_slug_key" ON "research_areas"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "user_research_areas_research_area_id_idx" ON "user_research_areas"("research_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_research_areas_user_id_research_area_id_key" ON "user_research_areas"("user_id", "research_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_organization_id_name_key" ON "skills"("organization_id", "name");

-- CreateIndex
CREATE INDEX "user_skills_skill_id_idx" ON "user_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_user_id_skill_id_key" ON "user_skills"("user_id", "skill_id");

-- CreateIndex
CREATE INDEX "teams_organization_id_status_idx" ON "teams"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_team_code_key" ON "teams"("organization_id", "team_code");

-- CreateIndex
CREATE INDEX "team_members_user_id_is_active_idx" ON "team_members"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_user_id_key" ON "team_members"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_research_areas_team_id_research_area_id_key" ON "team_research_areas"("team_id", "research_area_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");

-- CreateIndex
CREATE INDEX "projects_organization_id_target_date_idx" ON "projects"("organization_id", "target_date");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organization_id_project_code_key" ON "projects"("organization_id", "project_code");

-- CreateIndex
CREATE INDEX "project_teams_team_id_idx" ON "project_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_teams_project_id_team_id_key" ON "project_teams"("project_id", "team_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_research_areas_project_id_research_area_id_key" ON "project_research_areas"("project_id", "research_area_id");

-- CreateIndex
CREATE UNIQUE INDEX "papers_paper_code_key" ON "papers"("paper_code");

-- CreateIndex
CREATE INDEX "papers_organization_id_normalized_title_idx" ON "papers"("organization_id", "normalized_title");

-- CreateIndex
CREATE INDEX "papers_organization_id_doi_idx" ON "papers"("organization_id", "doi");

-- CreateIndex
CREATE INDEX "papers_publication_year_idx" ON "papers"("publication_year");

-- CreateIndex
CREATE UNIQUE INDEX "papers_organization_id_normalized_title_key" ON "papers"("organization_id", "normalized_title");

-- CreateIndex
CREATE UNIQUE INDEX "papers_organization_id_doi_key" ON "papers"("organization_id", "doi");

-- CreateIndex
CREATE UNIQUE INDEX "papers_organization_id_canonical_url_key" ON "papers"("organization_id", "canonical_url");

-- CreateIndex
CREATE INDEX "paper_identifiers_paper_id_idx" ON "paper_identifiers"("paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "paper_identifiers_identifier_type_normalized_value_key" ON "paper_identifiers"("identifier_type", "normalized_value");

-- CreateIndex
CREATE INDEX "project_papers_paper_id_idx" ON "project_papers"("paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_papers_project_id_paper_id_key" ON "project_papers"("project_id", "paper_id");

-- CreateIndex
CREATE INDEX "paper_assignments_project_id_paper_id_idx" ON "paper_assignments"("project_id", "paper_id");

-- CreateIndex
CREATE INDEX "paper_assignments_user_id_status_idx" ON "paper_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "paper_assignment_conflicts_project_id_paper_id_created_at_idx" ON "paper_assignment_conflicts"("project_id", "paper_id", "created_at");

-- CreateIndex
CREATE INDEX "question_sets_organization_id_status_idx" ON "question_sets"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_question_sets_project_id_question_set_id_key" ON "project_question_sets"("project_id", "question_set_id");

-- CreateIndex
CREATE INDEX "research_questions_question_set_id_display_order_idx" ON "research_questions"("question_set_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "research_questions_question_set_id_question_code_key" ON "research_questions"("question_set_id", "question_code");

-- CreateIndex
CREATE INDEX "research_responses_project_id_paper_id_user_id_status_idx" ON "research_responses"("project_id", "paper_id", "user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "research_responses_project_id_paper_id_question_id_user_id__key" ON "research_responses"("project_id", "paper_id", "question_id", "user_id", "version");

-- CreateIndex
CREATE INDEX "research_submissions_project_id_paper_id_status_idx" ON "research_submissions"("project_id", "paper_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "research_submissions_project_id_paper_id_submitted_by_versi_key" ON "research_submissions"("project_id", "paper_id", "submitted_by", "version");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_due_date_idx" ON "tasks"("organization_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "tasks_project_id_status_idx" ON "tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "tasks_team_id_status_idx" ON "tasks"("team_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_organization_id_task_code_key" ON "tasks"("organization_id", "task_code");

-- CreateIndex
CREATE INDEX "task_assignees_user_id_assigned_at_idx" ON "task_assignees"("user_id", "assigned_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_task_id_user_id_key" ON "task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_task_id_key" ON "task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE INDEX "todos_organization_id_status_due_date_idx" ON "todos"("organization_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "todos_user_id_status_idx" ON "todos"("user_id", "status");

-- CreateIndex
CREATE INDEX "todos_team_id_status_idx" ON "todos"("team_id", "status");

-- CreateIndex
CREATE INDEX "notices_organization_id_status_publish_at_expires_at_idx" ON "notices"("organization_id", "status", "publish_at", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "notice_teams_notice_id_team_id_key" ON "notice_teams"("notice_id", "team_id");

-- CreateIndex
CREATE INDEX "notice_users_user_id_idx" ON "notice_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_users_notice_id_user_id_key" ON "notice_users"("notice_id", "user_id");

-- CreateIndex
CREATE INDEX "notice_acknowledgements_user_id_acknowledged_at_idx" ON "notice_acknowledgements"("user_id", "acknowledged_at");

-- CreateIndex
CREATE UNIQUE INDEX "notice_acknowledgements_notice_id_user_id_key" ON "notice_acknowledgements"("notice_id", "user_id");

-- CreateIndex
CREATE INDEX "assets_organization_id_status_idx" ON "assets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "assets_organization_id_category_idx" ON "assets"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "assets_organization_id_asset_code_key" ON "assets"("organization_id", "asset_code");

-- CreateIndex
CREATE INDEX "asset_assignments_asset_id_returned_at_idx" ON "asset_assignments"("asset_id", "returned_at");

-- CreateIndex
CREATE INDEX "asset_assignments_user_id_returned_at_idx" ON "asset_assignments"("user_id", "returned_at");

-- CreateIndex
CREATE INDEX "asset_assignments_team_id_returned_at_idx" ON "asset_assignments"("team_id", "returned_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_areas" ADD CONSTRAINT "research_areas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_areas" ADD CONSTRAINT "research_areas_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "research_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_research_areas" ADD CONSTRAINT "user_research_areas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_research_areas" ADD CONSTRAINT "user_research_areas_research_area_id_fkey" FOREIGN KEY ("research_area_id") REFERENCES "research_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_team_leader_id_fkey" FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_research_areas" ADD CONSTRAINT "team_research_areas_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_research_areas" ADD CONSTRAINT "team_research_areas_research_area_id_fkey" FOREIGN KEY ("research_area_id") REFERENCES "research_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_team_id_fkey" FOREIGN KEY ("default_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_teams" ADD CONSTRAINT "project_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_research_areas" ADD CONSTRAINT "project_research_areas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_research_areas" ADD CONSTRAINT "project_research_areas_research_area_id_fkey" FOREIGN KEY ("research_area_id") REFERENCES "research_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_research_area_id_fkey" FOREIGN KEY ("research_area_id") REFERENCES "research_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_identifiers" ADD CONSTRAINT "paper_identifiers_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_papers" ADD CONSTRAINT "project_papers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_papers" ADD CONSTRAINT "project_papers_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_papers" ADD CONSTRAINT "project_papers_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignments" ADD CONSTRAINT "paper_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignments" ADD CONSTRAINT "paper_assignments_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignments" ADD CONSTRAINT "paper_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignments" ADD CONSTRAINT "paper_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignment_conflicts" ADD CONSTRAINT "paper_assignment_conflicts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignment_conflicts" ADD CONSTRAINT "paper_assignment_conflicts_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignment_conflicts" ADD CONSTRAINT "paper_assignment_conflicts_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignment_conflicts" ADD CONSTRAINT "paper_assignment_conflicts_existing_assignment_id_fkey" FOREIGN KEY ("existing_assignment_id") REFERENCES "paper_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_assignment_conflicts" ADD CONSTRAINT "paper_assignment_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_sets" ADD CONSTRAINT "question_sets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_question_sets" ADD CONSTRAINT "project_question_sets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_question_sets" ADD CONSTRAINT "project_question_sets_question_set_id_fkey" FOREIGN KEY ("question_set_id") REFERENCES "question_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_questions" ADD CONSTRAINT "research_questions_question_set_id_fkey" FOREIGN KEY ("question_set_id") REFERENCES "question_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_responses" ADD CONSTRAINT "research_responses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_responses" ADD CONSTRAINT "research_responses_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_responses" ADD CONSTRAINT "research_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "research_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_responses" ADD CONSTRAINT "research_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_submissions" ADD CONSTRAINT "research_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_teams" ADD CONSTRAINT "notice_teams_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_teams" ADD CONSTRAINT "notice_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_users" ADD CONSTRAINT "notice_users_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_users" ADD CONSTRAINT "notice_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgements" ADD CONSTRAINT "notice_acknowledgements_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_acknowledgements" ADD CONSTRAINT "notice_acknowledgements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
