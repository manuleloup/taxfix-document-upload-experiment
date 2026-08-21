import express from 'express';
import multer  from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const ai     = new Anthropic();   // reads ANTHROPIC_API_KEY from env

app.use(express.static(__dirname));

// ── Prompt ──────────────────────────────────────────────────────────────────
const SYSTEM = `You are a document classifier for a UK tax filing service.
A taxpayer has just uploaded a file as part of their annual Self Assessment return.`;

const PROMPT = `Examine this document and return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:

{
  "type": <one of: "P60", "P45", "P11D", "payslip", "rental_income_statement", "rental_expense_receipt", "mortgage_statement", "bank_statement", "invoice", "other">,
  "category": <one of: "paye_employment", "rental_income", "self_employment", "other">,
  "confidence": <number 0.0–1.0>,
  "description": <1-2 sentence description>,
  "tax_year": <"2023-24" style if visible, else null>,
  "key_figure": <main monetary figure e.g. "£45,234.00" if visible, else null>
}`;

// ── Detection endpoint ───────────────────────────────────────────────────────
app.post('/api/detect', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { mimetype, buffer, originalname } = req.file;
  const isPdf   = mimetype === 'application/pdf';
  const isImage = mimetype.startsWith('image/');

  if (!isPdf && !isImage) {
    return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
  }

  const base64 = buffer.toString('base64');

  const docBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mimetype, data: base64 } };

  try {
    const msg = await ai.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: [docBlock, { type: 'text', text: PROMPT }] }],
      // Include PDF beta flag — harmless for non-PDF calls; needed on some model versions
      betas: ['pdfs-2024-09-25'],
    });

    const raw    = msg.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const result = JSON.parse(raw);

    console.log(`[detect] ${originalname} → ${result.type} (${result.category}, ${Math.round(result.confidence * 100)}%)`);
    res.json(result);

  } catch (err) {
    console.error('[detect]', err.message);
    if (err instanceof SyntaxError) {
      // Model returned non-JSON — fall back gracefully
      res.json({ type: 'other', category: 'other', confidence: 0,
                 description: 'Could not identify document', tax_year: null, key_figure: null });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🌿  Taxfix Document Upload prototype`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`\n    Make sure ANTHROPIC_API_KEY is set in .env\n`);
});
