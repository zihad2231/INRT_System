-- CreateEnum
CREATE TYPE "component_status" AS ENUM ('AVAILABLE', 'PARTIALLY_AVAILABLE', 'IN_USE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "component_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "component_allocation_status" AS ENUM ('ACTIVE', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "components" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "component_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "available_quantity" INTEGER NOT NULL DEFAULT 0,
    "allocated_quantity" INTEGER NOT NULL DEFAULT 0,
    "status" "component_status" NOT NULL DEFAULT 'AVAILABLE',
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "unit_price" DECIMAL(12,2),
    "purchase_date" DATE,
    "location" VARCHAR(255),
    "condition" VARCHAR(50),
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "project_id" UUID,
    "requested_quantity" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "expected_start_date" DATE,
    "expected_end_date" DATE,
    "additional_note" TEXT,
    "status" "component_request_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "component_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_allocations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "component_id" UUID NOT NULL,
    "request_id" UUID,
    "project_id" UUID,
    "user_id" UUID,
    "team_id" UUID,
    "quantity" INTEGER NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_end_date" TIMESTAMPTZ(6),
    "actual_return_date" TIMESTAMPTZ(6),
    "status" "component_allocation_status" NOT NULL DEFAULT 'ACTIVE',
    "allocated_by" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "component_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "components_organization_id_status_idx" ON "components"("organization_id", "status");

-- CreateIndex
CREATE INDEX "components_organization_id_category_idx" ON "components"("organization_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "components_organization_id_component_code_key" ON "components"("organization_id", "component_code");

-- CreateIndex
CREATE INDEX "component_requests_organization_id_status_idx" ON "component_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "component_requests_requested_by_status_idx" ON "component_requests"("requested_by", "status");

-- CreateIndex
CREATE INDEX "component_requests_component_id_status_idx" ON "component_requests"("component_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "component_allocations_request_id_key" ON "component_allocations"("request_id");

-- CreateIndex
CREATE INDEX "component_allocations_component_id_status_idx" ON "component_allocations"("component_id", "status");

-- CreateIndex
CREATE INDEX "component_allocations_user_id_status_idx" ON "component_allocations"("user_id", "status");

-- CreateIndex
CREATE INDEX "component_allocations_project_id_status_idx" ON "component_allocations"("project_id", "status");

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_requests" ADD CONSTRAINT "component_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_requests" ADD CONSTRAINT "component_requests_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_requests" ADD CONSTRAINT "component_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_requests" ADD CONSTRAINT "component_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_requests" ADD CONSTRAINT "component_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_allocations" ADD CONSTRAINT "component_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_allocations" ADD CONSTRAINT "component_allocations_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_allocations" ADD CONSTRAINT "component_allocations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "component_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_allocations" ADD CONSTRAINT "component_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_allocations" ADD CONSTRAINT "component_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_allocations" ADD CONSTRAINT "component_allocations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_allocations" ADD CONSTRAINT "component_allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
