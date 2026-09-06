import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';

export const OFFICIAL_DOCUMENT_TYPES = [
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
  'OTHER',
] as const;

export const OFFICIAL_DOCUMENT_STATUSES = [
  'UPLOADED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
] as const;

type OfficialDocumentType = (typeof OFFICIAL_DOCUMENT_TYPES)[number];
type OfficialDocumentStatus = (typeof OFFICIAL_DOCUMENT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<OfficialDocumentStatus, OfficialDocumentStatus[]> = {
  UPLOADED: ['PROCESSING', 'REJECTED'],
  PROCESSING: ['READY_FOR_REVIEW', 'REJECTED'],
  READY_FOR_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUPERSEDED'],
  REJECTED: [],
  SUPERSEDED: [],
};

export class OfficialDocumentService {
  /**
   * Creates the source-document record only. It does NOT create verified facts,
   * publish news, notify students, or mark the document approved.
   */
  async create(input: {
    subCategoryId: string;
    documentType: OfficialDocumentType;
    title: string;
    documentDate: Date;
    sourceUrl?: string;
    fileName: string;
    mimeType: string;
    fileBytes?: Buffer | null;
  }) {
    if (!OFFICIAL_DOCUMENT_TYPES.includes(input.documentType)) {
      throw new Error('Invalid official document type');
    }
    if (input.mimeType !== 'application/pdf') {
      throw new Error('Only PDF official documents are accepted');
    }
    if (!input.title.trim() || !input.fileName.trim()) {
      throw new Error('Document title and file name are required');
    }

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "OfficialDocument"
        ("id", "subCategoryId", "documentType", "title", "documentDate",
         "sourceUrl", "fileName", "mimeType", "fileBytes", "status", "updatedAt")
      VALUES
        (${id}, ${input.subCategoryId}, ${input.documentType}::"OfficialDocumentType",
         ${input.title.trim()}, ${input.documentDate},
         ${input.sourceUrl?.trim() || null}, ${input.fileName.trim()}, ${input.mimeType},
         ${input.fileBytes ?? null}, 'UPLOADED'::"OfficialDocumentStatus", CURRENT_TIMESTAMP)
    `;
    return this.getById(id);
  }

  async getById(id: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT "id", "subCategoryId", "documentType", "title", "documentDate",
             "sourceUrl", "fileName", "mimeType", "extractedText", "status",
             "supersedesDocumentId", "uploadedAt", "processedAt", "reviewedAt",
             "approvedAt", "createdAt", "updatedAt"
      FROM "OfficialDocument"
      WHERE "id" = ${id}
    `;
    if (!rows[0]) throw new Error('Official document not found');
    return rows[0];
  }

  async listPending() {
    return prisma.$queryRaw<any[]>`
      SELECT "id", "subCategoryId", "documentType", "title", "documentDate",
             "sourceUrl", "fileName", "mimeType", "status", "supersedesDocumentId",
             "uploadedAt", "processedAt", "reviewedAt", "approvedAt"
      FROM "OfficialDocument"
      WHERE "status" IN ('UPLOADED'::"OfficialDocumentStatus",
                          'PROCESSING'::"OfficialDocumentStatus",
                          'READY_FOR_REVIEW'::"OfficialDocumentStatus")
      ORDER BY "uploadedAt" DESC
    `;
  }

  async setExtractedText(id: string, extractedText: string) {
    const current = await this.getById(id);
    if (current.status !== 'PROCESSING' && current.status !== 'UPLOADED') {
      throw new Error('Document is not available for processing');
    }
    await prisma.$executeRaw`
      UPDATE "OfficialDocument"
      SET "extractedText" = ${extractedText},
          "status" = 'READY_FOR_REVIEW'::"OfficialDocumentStatus",
          "processedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
    return this.getById(id);
  }

  async transition(id: string, nextStatus: OfficialDocumentStatus, supersedesDocumentId?: string) {
    if (!OFFICIAL_DOCUMENT_STATUSES.includes(nextStatus)) {
      throw new Error('Invalid official document status');
    }
    const current = await this.getById(id);
    if (!ALLOWED_TRANSITIONS[current.status as OfficialDocumentStatus].includes(nextStatus)) {
      throw new Error(`Invalid document status transition: ${current.status} -> ${nextStatus}`);
    }

    if (nextStatus === 'APPROVED' && !current.sourceUrl) {
      throw new Error('Official source URL is required before approval');
    }

    if (nextStatus === 'SUPERSEDED' && !supersedesDocumentId) {
      throw new Error('Replacement document ID is required when superseding a document');
    }

    await prisma.$executeRaw`
      UPDATE "OfficialDocument"
      SET "status" = ${nextStatus}::"OfficialDocumentStatus",
          "supersedesDocumentId" = ${supersedesDocumentId ?? null},
          "reviewedAt" = CASE WHEN ${nextStatus} IN ('APPROVED', 'REJECTED') THEN CURRENT_TIMESTAMP ELSE "reviewedAt" END,
          "approvedAt" = CASE WHEN ${nextStatus} = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE "approvedAt" END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;

    return this.getById(id);
  }
}
