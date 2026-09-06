import { Express, Request, Response } from 'express';
import multer from 'multer';
import { OfficialDocumentService, OFFICIAL_DOCUMENT_TYPES, OFFICIAL_DOCUMENT_STATUSES } from './official-document.service';
import { OfficialDocumentProcessingService } from './official-document-processing.service';
import { requireStaffAuth, requireRole } from './staff-auth.service';

/**
 * Official Information System route factory.
 * Kept separate from server.ts so the large legacy API file does not need
 * fragile manual surgery. Import and call registerOfficialDocumentRoutes(app).
 */
export function registerOfficialDocumentRoutes(app: Express) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
  });
  const documents = new OfficialDocumentService();
  const processing = new OfficialDocumentProcessingService(documents);
  const admin = [requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN')];

  app.get('/admin/official-documents/types', ...admin, (_req, res) => {
    res.json({ types: OFFICIAL_DOCUMENT_TYPES, statuses: OFFICIAL_DOCUMENT_STATUSES });
  });

  app.get('/admin/official-documents', ...admin, async (_req, res) => {
    try { res.json(await documents.listPending()); }
    catch (err: any) { res.status(500).json({ error: err.message ?? 'Failed to list official documents' }); }
  });

  app.get('/admin/official-documents/:id', ...admin, async (req, res) => {
    try { res.json(await documents.getById(req.params.id)); }
    catch (err: any) { res.status(404).json({ error: err.message ?? 'Official document not found' }); }
  });

  app.post('/admin/official-documents', ...admin, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'A PDF file is required' });
      const document = await documents.create({
        subCategoryId: String(req.body.subCategoryId ?? ''),
        documentType: req.body.documentType,
        title: String(req.body.title ?? ''),
        documentDate: new Date(req.body.documentDate),
        sourceUrl: req.body.sourceUrl,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileBytes: req.file.buffer,
      });
      res.status(201).json(document);
    } catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to create official document' }); }
  });

  app.post('/admin/official-documents/:id/process', ...admin, async (req, res) => {
    try {
      if (req.body?.pdfBase64) {
        const buffer = Buffer.from(req.body.pdfBase64, 'base64');
        res.json(await processing.processPdf(req.params.id, buffer));
        return;
      }
      const doc = await documents.getById(req.params.id);
      if (!doc.extractedText) return res.status(400).json({ error: 'PDF bytes are not available for reprocessing. Upload the PDF again.' });
      await documents.setProcessing(req.params.id);
      res.json({ documentId: req.params.id, status: 'PROCESSING', message: 'Document marked for processing; provide the PDF bytes to run extraction.' });
    } catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to process official document' }); }
  });

  app.get('/admin/official-documents/:id/candidates', ...admin, async (req, res) => {
    try { res.json(await processing.listCandidates(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message ?? 'Failed to load fact candidates' }); }
  });

  app.patch('/admin/official-document-candidates/:id', ...admin, async (req, res) => {
    try { res.json(await processing.updateCandidate(req.params.id, req.body)); }
    catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to update candidate' }); }
  });

  app.post('/admin/official-document-candidates/:id/approve', ...admin, async (req, res) => {
    try { res.json(await processing.approveCandidate(req.params.id, new Date())); }
    catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to approve candidate' }); }
  });

  app.delete('/admin/official-document-candidates/:id', ...admin, async (req, res) => {
    try { res.json(await processing.discardCandidate(req.params.id)); }
    catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to discard candidate' }); }
  });

  app.post('/admin/official-documents/:id/approve', ...admin, async (req, res) => {
    try { res.json(await documents.transition(req.params.id, 'APPROVED')); }
    catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to approve document' }); }
  });

  app.post('/admin/official-documents/:id/reject', ...admin, async (req, res) => {
    try { res.json(await documents.transition(req.params.id, 'REJECTED')); }
    catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to reject document' }); }
  });

  app.post('/admin/official-documents/:id/supersede', ...admin, async (req, res) => {
    try {
      if (!req.body?.replacementDocumentId) return res.status(400).json({ error: 'replacementDocumentId is required' });
      res.json(await documents.transition(req.params.id, 'SUPERSEDED', req.body.replacementDocumentId));
    } catch (err: any) { res.status(400).json({ error: err.message ?? 'Failed to supersede document' }); }
  });
}
