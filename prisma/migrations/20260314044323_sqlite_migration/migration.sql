-- CreateTable
CREATE TABLE "academics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "research_field" TEXT,
    "degree_level" TEXT,
    "graduation_year" INTEGER,
    "institution" TEXT,
    "current_city" TEXT,
    "current_state" TEXT,
    "current_sector" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "current_job_title" TEXT,
    "current_company" TEXT,
    "linkedin_url" TEXT,
    "lattes_url" TEXT,
    "enrichment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "last_enriched_at" DATETIME,
    "grok_metadata" JSONB,
    "grok_enriched_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "dissertations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academic_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "keywords" JSONB NOT NULL DEFAULT [],
    "defense_year" INTEGER NOT NULL,
    "institution" TEXT NOT NULL,
    "program" TEXT,
    "advisor_name" TEXT,
    "source_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "dissertations_academic_id_fkey" FOREIGN KEY ("academic_id") REFERENCES "academics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrichment_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academic_id" TEXT,
    "task_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "assigned_to" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    CONSTRAINT "enrichment_tasks_academic_id_fkey" FOREIGN KEY ("academic_id") REFERENCES "academics" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scraper_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "profiles_scraped" INTEGER NOT NULL DEFAULT 0,
    "tasks_created" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "academics_name_institution_graduation_year_idx" ON "academics"("name", "institution", "graduation_year");

-- CreateIndex
CREATE INDEX "academics_enrichment_status_linkedin_url_idx" ON "academics"("enrichment_status", "linkedin_url");

-- CreateIndex
CREATE INDEX "academics_current_state_idx" ON "academics"("current_state");

-- CreateIndex
CREATE INDEX "academics_current_city_idx" ON "academics"("current_city");

-- CreateIndex
CREATE INDEX "academics_research_field_idx" ON "academics"("research_field");

-- CreateIndex
CREATE INDEX "academics_degree_level_idx" ON "academics"("degree_level");

-- CreateIndex
CREATE INDEX "academics_current_sector_idx" ON "academics"("current_sector");

-- CreateIndex
CREATE INDEX "dissertations_academic_id_idx" ON "dissertations"("academic_id");

-- CreateIndex
CREATE INDEX "dissertations_academic_id_title_defense_year_idx" ON "dissertations"("academic_id", "title", "defense_year");

-- CreateIndex
CREATE INDEX "enrichment_tasks_status_priority_idx" ON "enrichment_tasks"("status", "priority");
