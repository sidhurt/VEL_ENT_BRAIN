import express from 'express';
import multer from 'multer';
import {
    createClient, listClients, getClientBrain,
    proposeKnowledge, getReviewQueue, reviewKnowledge,
    assembleClientContext, generateForClient
} from '../clientBrain';
import { extractClientKnowledge } from '../extraction';
import { parseDocument } from '../fileParsing';

// ============================================================================
// CLIENT BRAIN — V1 product routes. The client account is the anchor entity;
// every route walls to the caller's own org (enforced inside clientBrain.ts).
// Errors carry .status (403 walls) — surfaced honestly, defaulting to 500.
// ============================================================================

// In-memory uploads (serverless-safe), capped at 15MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const router = express.Router();

const clientErr = (res: express.Response, err: any) =>
    res.status(err.status || 500).json({ error: err.message });

router.post('/api/clients', async (req, res) => {
    try {
        const { name, industry } = req.body;
        if (!name?.trim()) return res.status(422).json({ error: 'Client name required' });
        res.json(await createClient(req.principal!.id, name.trim(), industry));
    } catch (err: any) { clientErr(res, err); }
});

router.get('/api/clients', async (req, res) => {
    try {
        res.json(await listClients(req.principal!.id));
    } catch (err: any) { clientErr(res, err); }
});

router.get('/api/clients/:clientId/brain', async (req, res) => {
    try {
        res.json(await getClientBrain(req.principal!.id, String(req.params.clientId)));
    } catch (err: any) { clientErr(res, err); }
});

// Manual proposal (single items typed/edited by a human)
router.post('/api/clients/:clientId/knowledge', async (req, res) => {
    try {
        const { items, source } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(422).json({ error: 'items[] required' });
        }
        res.json(await proposeKnowledge(req.principal!.id, String(req.params.clientId), items, source || 'manual'));
    } catch (err: any) { clientErr(res, err); }
});

// Ingestion: raw document text -> extracted candidates -> review queue.
// V1 accepts extracted text; file parsing (PDF/DOCX/PPTX) is specced for handoff.
router.post('/api/clients/:clientId/ingest', async (req, res) => {
    try {
        const { text, sourceName } = req.body;
        if (!text?.trim() || text.trim().length < 100) {
            return res.status(422).json({ error: 'text required (min 100 chars of document content)' });
        }
        const clientId = String(req.params.clientId);
        // Wall check + client name happen inside; do a cheap access probe first
        const { clientName } = await getClientBrain(req.principal!.id, clientId);
        const extraction = await extractClientKnowledge(text, clientName, sourceName || 'uploaded document');
        const result = await proposeKnowledge(req.principal!.id, clientId, extraction.items, sourceName || 'uploaded document');
        res.json({
            extracted: extraction.items.length,
            proposed: result.proposed,
            chunks: extraction.chunks,
            model: extraction.model,
            items: extraction.items,
        });
    } catch (err: any) { clientErr(res, err); }
});

// File ingestion: PDF / DOCX / TXT / MD -> parsed text -> extraction -> review queue.
router.post('/api/clients/:clientId/ingest-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(422).json({ error: "multipart field 'file' required" });
        const clientId = String(req.params.clientId);
        const sourceName = req.file.originalname || 'uploaded file';
        const { clientName } = await getClientBrain(req.principal!.id, clientId); // wall check
        const parsed = await parseDocument(req.file.buffer, sourceName);
        const extraction = await extractClientKnowledge(parsed.text, clientName, sourceName);
        const result = await proposeKnowledge(req.principal!.id, clientId, extraction.items, sourceName);
        res.json({
            file: sourceName,
            format: parsed.format,
            textChars: parsed.text.length,
            truncated: parsed.truncated,
            extracted: extraction.items.length,
            proposed: result.proposed,
            items: extraction.items,
        });
    } catch (err: any) { clientErr(res, err); }
});

router.get('/api/clients/:clientId/review-queue', async (req, res) => {
    try {
        res.json(await getReviewQueue(req.principal!.id, String(req.params.clientId)));
    } catch (err: any) { clientErr(res, err); }
});

router.post('/api/knowledge/:knowledgeId/review', async (req, res) => {
    try {
        const { action, edits } = req.body;
        if (action !== 'approve' && action !== 'reject') {
            return res.status(422).json({ error: "action must be 'approve' or 'reject'" });
        }
        res.json(await reviewKnowledge(req.principal!.id, String(req.params.knowledgeId), action, edits));
    } catch (err: any) { clientErr(res, err); }
});

// Client-scoped assembly / generation. Every response carries the receipt
// asserting the wall: only this client's brain was reachable.
router.post('/api/clients/:clientId/enhance', async (req, res) => {
    try {
        const { prompt, executionMode = 'execute' } = req.body;
        if (!prompt?.trim()) return res.status(422).json({ error: 'prompt required' });
        const clientId = String(req.params.clientId);
        if (executionMode === 'assemble') {
            res.json(await assembleClientContext(req.principal!.id, clientId, prompt));
        } else {
            res.json(await generateForClient(req.principal!.id, clientId, prompt));
        }
    } catch (err: any) { clientErr(res, err); }
});

export default router;
