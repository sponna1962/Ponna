-- Phase B/C: reviewable fact candidates and document provenance.
-- Candidates are never trusted facts. A candidate becomes a VerifiedExamFact
-- only after an explicit admin approval action.

CREATE TABLE "OfficialDocumentFactCandidate" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "suggestedFactType" TEXT NOT NULL,
  "suggestedValue" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT FALSE,
  "resultingFactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficialDocumentFactCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OfficialDocumentFactCandidate_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "OfficialDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OfficialDocumentFactCandidate_documentId_idx"
  ON "OfficialDocumentFactCandidate"("documentId");
CREATE INDEX "OfficialDocumentFactCandidate_approved_idx"
  ON "OfficialDocumentFactCandidate"("approved");

-- Provenance link: one approved VerifiedExamFact may be tied to the exact
-- official document that produced/confirmed it, without changing the existing
-- VerifiedExamFact Prisma model or duplicating the fact database.
CREATE TABLE "OfficialDocumentFact" (
  "documentId" TEXT NOT NULL,
  "factId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficialDocumentFact_pkey" PRIMARY KEY ("documentId", "factId"),
  CONSTRAINT "OfficialDocumentFact_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "OfficialDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OfficialDocumentFact_factId_fkey"
    FOREIGN KEY ("factId") REFERENCES "VerifiedExamFact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OfficialDocumentFact_factId_idx"
  ON "OfficialDocumentFact"("factId");
