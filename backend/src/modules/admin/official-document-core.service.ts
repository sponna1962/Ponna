// PONNA — Official Document Core
// Phase B foundation for the Official Information System.
// This module is intentionally framework/Prisma-independent at this stage:
// it centralises document metadata validation and lifecycle rules before
// persistence is wired to the existing admin/import infrastructure.

export const OFFICIAL_DOCUMENT_TYPES = [
  'NOTIFICATION',
  'ADDENDUM_CORRIGENDUM',
  'APPLICATION',
  'EXAM_DATE',
  'HALL_TICKET',
  'ANSWER_KEY',
  'OBJECTION',
  'RESULT',
  'CERTIFICATE_VERIFICATION',
  'COUNSELLING',
  'FINAL_SELECTION',
  'OTHER',
] as const;

export type OfficialDocumentType = (typeof OFFICIAL_DOCUMENT_TYPES)[number];

export const OFFICIAL_DOCUMENT_STATUSES = [
  'UPLOADED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
] as const;

export type OfficialDocumentStatus = (typeof OFFICIAL_DOCUMENT_STATUSES)[number];

export interface OfficialDocumentMetadata {
  authorityId: string;
  subCategoryId: string;
  documentType: OfficialDocumentType;
  documentDate: string;
  sourceUrl: string;
  title?: string;
}

export interface OfficialDocumentRecord extends OfficialDocumentMetadata {
  id: string;
  status: OfficialDocumentStatus;
  originalFileName: string;
  mimeType: 'application/pdf';
  fileSizeBytes: number;
  uploadedAt: string;
}

const HTTP_URL = /^https?:\/\//i;

export function validateOfficialDocumentMetadata(input: OfficialDocumentMetadata): string[] {
  const errors: string[] = [];

  if (!input.authorityId?.trim()) errors.push('authorityId is required');
  if (!input.subCategoryId?.trim()) errors.push('subCategoryId is required');
  if (!OFFICIAL_DOCUMENT_TYPES.includes(input.documentType)) {
    errors.push('documentType is invalid');
  }
  if (!input.documentDate || Number.isNaN(Date.parse(input.documentDate))) {
    errors.push('documentDate must be a valid date');
  }
  if (!input.sourceUrl?.trim() || !HTTP_URL.test(input.sourceUrl.trim())) {
    errors.push('sourceUrl must be an http(s) URL');
  }
  if (input.title !== undefined && input.title.length > 200) {
    errors.push('title must be 200 characters or fewer');
  }

  return errors;
}

export function assertPdfUpload(file: {
  originalname?: string;
  mimetype?: string;
  size?: number;
}): void {
  const mimeOk = file.mimetype === 'application/pdf';
  const extensionOk = /\.pdf$/i.test(file.originalname ?? '');
  if (!mimeOk || !extensionOk) {
    throw new Error('Only PDF documents are accepted');
  }
  if (!file.size || file.size <= 0) {
    throw new Error('Uploaded PDF is empty');
  }
}

/**
 * Explicit lifecycle transitions. There is deliberately no implicit
 * auto-approval transition: extracted content can only become APPROVED
 * through an explicit admin action in the persistence layer.
 */
export function canTransitionOfficialDocument(
  from: OfficialDocumentStatus,
  to: OfficialDocumentStatus,
): boolean {
  const allowed: Record<OfficialDocumentStatus, OfficialDocumentStatus[]> = {
    UPLOADED: ['PROCESSING', 'REJECTED'],
    PROCESSING: ['READY_FOR_REVIEW', 'REJECTED'],
    READY_FOR_REVIEW: ['APPROVED', 'REJECTED', 'PROCESSING'],
    APPROVED: ['SUPERSEDED'],
    REJECTED: [],
    SUPERSEDED: [],
  };
  return allowed[from].includes(to);
}

export function assertOfficialDocumentTransition(
  from: OfficialDocumentStatus,
  to: OfficialDocumentStatus,
): void {
  if (!canTransitionOfficialDocument(from, to)) {
    throw new Error(`Invalid official document transition: ${from} → ${to}`);
  }
}

/**
 * Builds a safe, concise display label for the student-facing source chip.
 * The full URL remains available to the UI as sourceUrl; this helper avoids
 * leaking internal filenames or processing metadata into the public label.
 */
export function officialSourceLabel(authorityName: string, verifiedDate: string): string {
  const name = authorityName.trim() || 'Official authority';
  return `✓ Official information · Source: ${name} · verified ${verifiedDate}`;
}
