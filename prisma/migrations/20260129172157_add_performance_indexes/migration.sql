-- CreateIndex
CREATE INDEX "academics_name_institution_graduation_year_idx" ON "academics"("name", "institution", "graduation_year");

-- CreateIndex
CREATE INDEX "academics_enrichment_status_linkedin_url_idx" ON "academics"("enrichment_status", "linkedin_url");

-- CreateIndex
CREATE INDEX "dissertations_academic_id_idx" ON "dissertations"("academic_id");

-- CreateIndex
CREATE INDEX "dissertations_academic_id_title_defense_year_idx" ON "dissertations"("academic_id", "title", "defense_year");
