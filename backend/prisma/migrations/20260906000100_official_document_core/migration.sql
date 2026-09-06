-- Phase B: Official Document Core
-- Deliberately separate from NotificationImport: this stores the source document
-- and its lifecycle/history. No document is student-visible or trusted until
-- explicit admin approval.

CREATE TYPE "OfficialDocumentType" AS ENUM (
  'NOTIFICATION',
  'ADDENDUM_CORRIGENDUM',
  'APPLICATION',
  'EXAM_DATE',
  'HALL_TICKET',
  'ANSWER_KEY',
  'RESULT',
  'CERTIFICATE_VERIFICATION',
  'COUNSELLING',
  'FINAL_SELECTION',
  'OTHER'
);

CREATE TYPE "OfficialDocumentStatus" AS ENUM (
  'UPLOADED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TABLE "OfficialDocument" (
  "id" TEXT NOT NULL,
  "subCategoryId" TEXT NOT NULL,
  "documentType" "OfficialDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "sourceUrl" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileBytes" BYTEA,
  "extractedText" TEXT,
  "status" "OfficialDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "supersedesDocumentId" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficialDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfficialDocument_subCategoryId_documentDate_idx"
  ON "OfficialDocument"("subCategoryId", "documentDate");
CREATE INDEX "OfficialDocument_status_uploadedAt_idx"
  ON "OfficialDocument"("status", "uploadedAt");
CREATE INDEX "OfficialDocument_documentType_idx"
  ON "OfficialDocument"("documentType");

ALTER TABLE "OfficialDocument"
  ADD CONSTRAINT "OfficialDocument_subCategoryId_fkey"
  FOREIGN KEY ("subCategoryId") REFERENCES "ExamSubCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfficialDocument"
  ADD CONSTRAINT "OfficialDocument_supersedesDocumentId_fkey"
  FOREIGN KEY ("supersedesDocumentId") REFERENCES "OfficialDocument"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
