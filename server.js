import express from 'express';
import multer  from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const genai  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model  = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

app.use(express.static(__dirname));

// ── Prompt ──────────────────────────────────────────────────────────────────
const PROMPT = `You are analysing a UK tax document uploaded for an annual Self Assessment return.

Return ONLY a valid JSON object — no markdown, no explanation — with exactly these fields:

{
  "type": <one of: "P60", "P45", "P11D", "payslip", "rental_income_statement", "rental_expense_receipt", "mortgage_statement", "bank_statement", "invoice", "other">,
  "category": <one of: "paye_employment", "rental_income", "self_employment", "other">,
  "confidence": <number 0.0–1.0>,
  "description": <1–2 sentence description of the document>,
  "tax_year": <"2023-24" format string if visible, else null>,
  "key_figure": <the main income or financial figure — for P60/P45/payslip use gross pay, for rental use total rent received; format as "£XX,XXX.XX"; null if not visible>
}`;

// ── Detection endpoint ───────────────────────────────────────────────────────
app.post('/api/detect', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { mimetype, buffer, originalname } = req.file;

  if (!mimetype.startsWith('image/') && mimetype !== 'application/pdf') {
    return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
  }

  const base64 = buffer.toString('base64');

  try {
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType: mimetype } },
      PROMPT,
    ]);

    const raw    = result.response.text().trim()
                     .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(raw);

    console.log(`[detect] ${originalname} → ${parsed.type} (${parsed.category}, ${Math.round(parsed.confidence * 100)}%)`);
    res.json(parsed);

  } catch (err) {
    console.error('[detect]', err.message);
    if (err instanceof SyntaxError) {
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
  console.log(`\n🌿  Taxfix Document Upload`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`\n    Needs: GEMINI_API_KEY in .env\n`);
});
