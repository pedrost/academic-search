-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('MASTERS', 'PHD', 'POSTDOC');

-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('ACADEMIA', 'GOVERNMENT', 'PRIVATE', 'NGO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CAPTCHA', 'LINKEDIN_MATCH', 'LOGIN_EXPIRED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ScraperSource" AS ENUM ('SUCUPIRA', 'LATTES', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "ScraperStatus" AS ENUM ('RUNNING', 'PAUSED', 'WAITING_INTERVENTION', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "academics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "research_field" TEXT,
    "degree_level" "DegreeLevel",
    "graduation_year" INTEGER,
    "institution" TEXT,
    "current_city" TEXT,
    "current_state" TEXT,
    "current_sector" "Sector" NOT NULL DEFAULT 'UNKNOWN',
    "current_job_title" TEXT,
    "current_company" TEXT,
    "linkedin_url" TEXT,
    "lattes_url" TEXT,
    "enrichment_status" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "last_enriched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dissertations" (
    "id" TEXT NOT NULL,
    "academic_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "keywords" TEXT[],
    "defense_year" INTEGER NOT NULL,
    "institution" TEXT NOT NULL,
    "program" TEXT,
    "advisor_name" TEXT,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dissertations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_tasks" (
    "id" TEXT NOT NULL,
    "academic_id" TEXT,
    "task_type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "assigned_to" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "enrichment_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_sessions" (
    "id" TEXT NOT NULL,
    "source" "ScraperSource" NOT NULL,
    "status" "ScraperStatus" NOT NULL DEFAULT 'RUNNING',
    "profiles_scraped" INTEGER NOT NULL DEFAULT 0,
    "tasks_created" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scraper_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enrichment_tasks_status_priority_idx" ON "enrichment_tasks"("status", "priority");

-- AddForeignKey
ALTER TABLE "dissertations" ADD CONSTRAINT "dissertations_academic_id_fkey" FOREIGN KEY ("academic_id") REFERENCES "academics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_tasks" ADD CONSTRAINT "enrichment_tasks_academic_id_fkey" FOREIGN KEY ("academic_id") REFERENCES "academics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
