import { randomUUID } from 'crypto';
import pdfParse from 'pdf-parse';
import { prisma } from '../../lib/prisma';
import { VerifiedExamFactType } from '@prisma/client';
import { OfficialDocumentService } from './official-document.service';

const PATTERNS: Array<{ factType: VerifiedExamFactType; regex: RegExp }> = [
  { factType: 'APPLICATION_START_DATE', regex: /application\s+(?:will\s+)?(?:start|begin|open)s?\s+(?:on\s+)?([^\n.,]+)/i },
  { factType: 'APPLICATION_END_DATE', regex: /(?:last\s+date|closing\s+date|application\s+(?:will\s+)?close)s?\s*(?:to\s+apply\s*)?:?\s*(?:is\s+)?(?:on\s+)?([^\n.,]+)/i },
  { factType: 'EXAM_DATE', regex: /exam(?:ination)?\s+(?:will\s+be\s+)?(?:held|conducted|scheduled)\s+(?:on\s+)?([^\n.,]+)/i },
  { factType: 'VACANCY_COUNT', regex: /(?:total\s+)?vacan(?:cy|cies)\s*:?\s*(\d[\d,]*)/i },
  { factType: 'AGE_LIMIT', regex: /age\s+limit\s*:?\s*([^\n.,]+)/i },
  { factType: 'ELIGIBILITY', regex: /eligibilit(?:y|ies)\s*:?\s*([^\n.]+)/i },
];

export class OfficialDocumentProcessingService {
  constructor(private readonly documents = new OfficialDocumentService()) {}

  async extractPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
    if (!buffer?.length) throw new Error('Uploaded PDF is empty');
    const result = await pdfParse(buffer);
    const text = result.text.trim();
    if (!text) throw new Error('No extractable text was found in the PDF');
    return { text, pages: result.numpages ?? 0 };
  }

  async processPdf(documentId: string, buffer: Buffer) {
    const extracted = await this.extractPdf(buffer);
    await this.documents.setExtractedText(documentId, extracted.text);

    const candidates: Array<{ id: string; suggestedFactType: string; suggestedValue: string }> = [];
    for (const pattern of PATTERNS) {
      const match = extracted.text.match(pattern.regex);
      if (!match?.[1]) continue;
      const value = match[1].trim();
      if (!value) continue;
      const id = randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "OfficialDocumentFactCandidate"
          ("id", "documentId", "suggestedFactType", "suggestedValue", "updatedAt")
        VALUES (${id}, ${documentId}, ${pattern.factType}, ${value}, CURRENT_TIMESTAMP)
      `;
      candidates.push({ id, suggestedFactType: pattern.factType, suggestedValue: value });
    }

    return { documentId, pages: extracted.pages, extractedCharacters: extracted.text.length, candidates };
  }

  async listCandidates(documentId: string) {
    return prisma.$queryRaw<any[]>`
      SELECT "id", "documentId", "suggestedFactType", "suggestedValue", "approved", "resultingFactId", "createdAt", "updatedAt"
      FROM "OfficialDocumentFactCandidate"
      WHERE "documentId" = ${documentId}
      ORDER BY "createdAt" ASC
    `;
  }

  async updateCandidate(id: string, input: { suggestedFactType?: VerifiedExamFactType; suggestedValue?: string }) {
    const value = input.suggestedValue?.trim();
    await prisma.$executeRaw`
      UPDATE "OfficialDocumentFactCandidate"
      SET "suggestedFactType" = COALESCE(${input.suggestedFactType ?? null}, "suggestedFactType"),
          "suggestedValue" = COALESCE(${value ?? null}, "suggestedValue"),
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id} AND "approved" = FALSE
    `;
    return prisma.$queryRaw<any[]>`SELECT * FROM "OfficialDocumentFactCandidate" WHERE "id" = ${id}`;
  }

  /** Explicit approval only. This is the sole path from candidate → verified fact. */
  async approveCandidate(id: string, verifiedAt: Date) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT c.*, d."subCategoryId", d."sourceUrl", d."status" AS "documentStatus"
      FROM "OfficialDocumentFactCandidate" c
      JOIN "OfficialDocument" d ON d."id" = c."documentId"
      WHERE c."id" = ${id}
    `;
    const candidate = rows[0];
    if (!candidate) throw new Error('Fact candidate not found');
    if (candidate.approved) return candidate;
    if (candidate.documentStatus !== 'READY_FOR_REVIEW') throw new Error('Document must be ready for review before fact approval');
    if (!candidate.sourceUrl) throw new Error('Official source URL is required before fact approval');

    const factType = candidate.suggestedFactType as VerifiedExamFactType;
    if (!(Object.values(VerifiedExamFactType) as string[]).includes(factType)) throw new Error('Invalid fact type');

    const fact = await prisma.verifiedExamFact.create({
      data: {
        subCategoryId: candidate.subCategoryId,
        factType,
        value: candidate.suggestedValue,
        isOfficialConfirmed: true,
        sourceUrl: candidate.sourceUrl,
        verifiedAt,
      },
    });

    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "OfficialDocumentFactCandidate"
        SET "approved" = TRUE, "resultingFactId" = ${fact.id}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${id}
      `,
      prisma.$executeRaw`
        INSERT INTO "OfficialDocumentFact" ("documentId", "factId")
        VALUES (${candidate.documentId}, ${fact.id})
        ON CONFLICT ("documentId", "factId") DO NOTHING
      `,
    ]);

    return fact;
  }

  async discardCandidate(id: string) {
    await prisma.$executeRaw`
      DELETE FROM "OfficialDocumentFactCandidate"
      WHERE "id" = ${id} AND "approved" = FALSE
    `;
    return { discarded: true };
  }
}
