import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import OpenAI from "openai";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const nestedPublicDir = path.join(rootDir, "public");
const publicDir = fs.existsSync(path.join(nestedPublicDir, "index.html")) ? nestedPublicDir : rootDir;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 8 }
});

const allowedOrigins = (process.env.API_ORIGINS || "http://localhost:4177,http://127.0.0.1:4177,https://shower.dbuilder.eu")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin not allowed: ${origin}`));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

const UNKNOWN = "გადასამოწმებელია";

const emptyAnalysis = () => ({
  clientName: UNKNOWN,
  address: UNKNOWN,
  phone: UNKNOWN,
  packageType: UNKNOWN,
  showerTraySize: UNKNOWN,
  antiSlip: UNKNOWN,
  glassPartitionSize: UNKNOWN,
  hingedDoorSize: UNKNOWN,
  panelColor: UNKNOWN,
  panelHeight: UNKNOWN,
  installables: [],
  extraWork: [],
  workNotes: [],
  suspiciousItems: [UNKNOWN],
  sourceNotes: [],
});

const analysisSchema = {
  name: "badelix_pdf_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clientName: { type: "string" },
      address: { type: "string" },
      phone: { type: "string" },
      packageType: { type: "string" },
      showerTraySize: { type: "string" },
      antiSlip: { type: "string" },
      glassPartitionSize: { type: "string" },
      hingedDoorSize: { type: "string" },
      panelColor: { type: "string" },
      panelHeight: { type: "string" },
      installables: { type: "array", items: { type: "string" } },
      extraWork: { type: "array", items: { type: "string" } },
      workNotes: { type: "array", items: { type: "string" } },
      suspiciousItems: { type: "array", items: { type: "string" } },
      sourceNotes: { type: "array", items: { type: "string" } }
    },
    required: [
      "clientName",
      "address",
      "phone",
      "packageType",
      "showerTraySize",
      "antiSlip",
      "glassPartitionSize",
      "hingedDoorSize",
      "panelColor",
      "panelHeight",
      "installables",
      "extraWork",
      "workNotes",
      "suspiciousItems",
      "sourceNotes"
    ]
  },
  strict: true
};

function normalizeAnalysis(value) {
  const base = emptyAnalysis();
  const merged = { ...base, ...value };
  for (const key of Object.keys(base)) {
    if (merged[key] === null || merged[key] === undefined || merged[key] === "") merged[key] = UNKNOWN;
  }
  if (!Array.isArray(merged.suspiciousItems) || merged.suspiciousItems.length === 0) {
    merged.suspiciousItems = [UNKNOWN];
  }
  return merged;
}

function estimateCost(usage) {
  const inputTokens = Number(usage?.input_tokens || usage?.prompt_tokens || 0);
  const outputTokens = Number(usage?.output_tokens || usage?.completion_tokens || 0);
  const totalTokens = Number(usage?.total_tokens || inputTokens + outputTokens);
  const inputUsdPerMillion = Number(process.env.OPENAI_INPUT_USD_PER_1M || 2);
  const outputUsdPerMillion = Number(process.env.OPENAI_OUTPUT_USD_PER_1M || 8);
  const budgetUsd = Number(process.env.OPENAI_MONTHLY_BUDGET_USD || 5);
  const estimatedCostUsd = (inputTokens / 1_000_000) * inputUsdPerMillion + (outputTokens / 1_000_000) * outputUsdPerMillion;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    budgetUsd,
    estimatedPercent: budgetUsd > 0 ? Number(((estimatedCostUsd / budgetUsd) * 100).toFixed(3)) : 0
  };
}

function fileToContent(file) {
  const b64 = file.buffer.toString("base64");
  if (file.mimetype === "application/pdf") {
    return {
      type: "input_file",
      filename: file.originalname,
      file_data: `data:application/pdf;base64,${b64}`
    };
  }
  return {
    type: "input_image",
    image_url: `data:${file.mimetype || "image/jpeg"};base64,${b64}`,
    detail: "high"
  };
}

function offerPrompt() {
  return "Analyze the BADELIX document by fixed page logic. Page 1: extract only client first/last name, address exactly as written, and telephone number if readable. Do not return order number or date. Page 2: extract selected system package as S or M, shower tray dimensions, and whether Antirutsch/anti-slip is selected. Do not create a general work-description paragraph. Page 3: extract selected glass partition size, selected hinged door/swing element size, BADELIX panel color such as UBEDA, and selected faucet/shower items under BADELIX Armaturen. Call that list 'დასაყენებლების სია'. Faucet options are Mischbatterie and Thermomischbatterie. Hand shower options are Brauseset and Regendusche. Do not include item prices in installables. Extract Zusatzarbeiten as 'დამატებითი სამუშაო' and translate handwritten work items into Georgian, without prices unless the price is necessary to identify the handwritten line. Page 4 panel height rule is strict: there are exactly three checkbox options that matter. If 'Verkleidung bis Wannenrand' is checked, panelHeight must be 'ძველი ვანის კანტამდე'. If 'Verkleidung bis Fliesenkante' is checked, panelHeight must be 'კაფელის კანტამდე'. If 'Verkleidung deckenhoch' is checked, panelHeight must be 'ჭერამდე'. The separate 'Deckenhöhe ___ cm' value is only the room ceiling height from floor to ceiling and must NEVER be used as panelHeight and must not override the three checkboxes. Also include suspicious/unclear items.";
}

app.post("/api/analyze", upload.array("files", 8), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: "OPENAI_API_KEY is missing. Use demo mode or configure .env." });
    }

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: "Upload at least one PDF or image." });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4.1";

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: "You extract German BADELIX PDFs for Georgian workers. Never invent unclear values. If handwriting, dimensions, location, checkbox state, totals, or any value is uncertain, return exactly 'გადასამოწმებელია'. Translate German labels and handwritten notes into natural Georgian while preserving dimensions, color names, package letters, product names, dates/ranges, prices, and numbers exactly when readable."
            }
          ]
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: offerPrompt() },
            ...files.map(fileToContent)
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...analysisSchema
        }
      }
    });

    const parsed = JSON.parse(response.output_text);
    res.json({
      sourceFiles: files.map((file) => file.originalname),
      model,
      analysis: normalizeAnalysis(parsed),
      usage: estimateCost(response.usage)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "AI analysis failed.",
      detail: error?.message || String(error)
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 4177);
app.listen(port, () => {
  console.log(`Shower Plan Assistant running at http://localhost:${port}`);
});
