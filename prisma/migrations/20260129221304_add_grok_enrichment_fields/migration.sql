-- AlterTable
ALTER TABLE "academics" ADD COLUMN     "grok_enriched_at" TIMESTAMP(3),
ADD COLUMN     "grok_metadata" JSONB;
