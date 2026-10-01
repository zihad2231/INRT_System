-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('VALID', 'VOIDED');

-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('COMPONENT_PURCHASE', 'SENSOR', 'HARDWARE', 'SOFTWARE', 'RESEARCH', 'TRANSPORTATION', 'PRINTING', 'EVENT', 'SUBSCRIPTION', 'MISCELLANEOUS');

-- CreateTable
CREATE TABLE "funds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "fund_code" VARCHAR(50) NOT NULL,
    "contributor_name" VARCHAR(255) NOT NULL,
    "contributor_user_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "purpose" VARCHAR(255) NOT NULL,
    "payment_method" VARCHAR(100) NOT NULL DEFAULT 'CASH',
    "receipt_url" TEXT,
    "notes" TEXT,
    "status" "transaction_status" NOT NULL DEFAULT 'VALID',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "expense_code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" "expense_category" NOT NULL DEFAULT 'MISCELLANEOUS',
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "project_id" UUID,
    "vendor" VARCHAR(255),
    "receipt_url" TEXT,
    "description" TEXT,
    "status" "transaction_status" NOT NULL DEFAULT 'VALID',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funds_organization_id_status_date_idx" ON "funds"("organization_id", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "funds_organization_id_fund_code_key" ON "funds"("organization_id", "fund_code");

-- CreateIndex
CREATE INDEX "expenses_organization_id_status_date_idx" ON "expenses"("organization_id", "status", "date");

-- CreateIndex
CREATE INDEX "expenses_project_id_status_idx" ON "expenses"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_organization_id_expense_code_key" ON "expenses"("organization_id", "expense_code");

-- AddForeignKey
ALTER TABLE "funds" ADD CONSTRAINT "funds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funds" ADD CONSTRAINT "funds_contributor_user_id_fkey" FOREIGN KEY ("contributor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funds" ADD CONSTRAINT "funds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
