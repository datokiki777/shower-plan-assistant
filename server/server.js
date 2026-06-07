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
  documentType: "shower_offer",
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
  sketchExplanation: {
    door: UNKNOWN,
    wc: UNKNOWN,
    window: UNKNOWN,
    showerTray: UNKNOWN,
    fixedGlass: UNKNOWN,
    movingGlass: UNKNOWN,
    panelWalls: UNKNOWN
  },
  suspiciousItems: [UNKNOWN],
  sourceNotes: [],
  loadingListTitle: UNKNOWN,
  loadingRows: [],
  panelTotals: []
});

const loadingRowSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    originalText: { type: "string" },
    georgianText: { type: "string" },
    panelColor: { type: "string" },
    panelAreaSqm: { type: "string" }
  },
  required: ["originalText", "georgianText", "panelColor", "panelAreaSqm"]
};

const analysisSchema = {
  name: "badelix_pdf_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      documentType: { type: "string" },
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
      sketchExplanation: {
        type: "object",
        additionalProperties: false,
        properties: {
          door: { type: "string" },
          wc: { type: "string" },
          window: { type: "string" },
          showerTray: { type: "string" },
          fixedGlass: { type: "string" },
          movingGlass: { type: "string" },
          panelWalls: { type: "string" }
        },
        required: ["door", "wc", "window", "showerTray", "fixedGlass", "movingGlass", "panelWalls"]
      },
      suspiciousItems: { type: "array", items: { type: "string" } },
      sourceNotes: { type: "array", items: { type: "string" } },
      loadingListTitle: { type: "string" },
      loadingRows: { type: "array", items: loadingRowSchema },
      panelTotals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            panelColor: { type: "string" },
            totalSqm: { type: "string" },
            clients: { type: "array", items: { type: "string" } }
          },
          required: ["panelColor", "totalSqm", "clients"]
        }
      }
    },
    required: [
      "documentType",
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
      "sketchExplanation",
      "suspiciousItems",
      "sourceNotes",
      "loadingListTitle",
      "loadingRows",
      "panelTotals"
    ]
  },
  strict: true
};

function normalizeAnalysis(value) {
  const base = emptyAnalysis();
  const merged = { ...base, ...value };
  merged.sketchExplanation = { ...base.sketchExplanation, ...(value?.sketchExplanation || {}) };
  for (const key of Object.keys(base)) {
    if (merged[key] === null || merged[key] === undefined || merged[key] === "") merged[key] = UNKNOWN;
  }
  for (const key of Object.keys(merged.sketchExplanation)) {
    if (!merged.sketchExplanation[key]) merged.sketchExplanation[key] = UNKNOWN;
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

function promptForType(analysisType) {
  if (analysisType === "loading_list") {
    return "This is not a shower-offer analysis. It is a BADELIX loading list. Return documentType='loading_list'. Your job is only to translate/recreate the loading list in Georgian, preserving the same logical order, rows, grouping, dates, ranges, names, addresses, product names, colors, dimensions, square meters, and prices exactly when readable. Do not analyze or summarize. For each visible row/line/block, set originalText to the German/source text if readable, georgianText to the Georgian translation, panelColor to the panel color if that line/client includes a color such as UBEDA or ZANZIBAR, and panelAreaSqm to the panel square meter value if present. If unclear, use 'გადასამოწმებელია'. At the end calculate panelTotals: group all identical panel colors and sum their square meters. Use comma/dot decimals robustly. Include client names or row labels in the clients array for each color group. If areas are unclear, mark totalSqm as 'გადასამოწმებელია'. Fill ordinary shower-offer fields with 'გადასამოწმებელია' or empty arrays.";
  }

  return "Analyze the BADELIX document by fixed page logic. Page 1: extract only client first/last name, address exactly as written, and telephone number if readable. Do not return order number or date. Page 2: extract selected system package as S or M, shower tray dimensions, and whether Antirutsch/anti-slip is selected. Do not create a general work-description paragraph. Page 3: extract selected glass partition size, selected hinged door/swing element size, BADELIX panel color such as UBEDA, and selected faucet/shower items under BADELIX Armaturen. Call that list 'დასაყენებლების სია'. Faucet options are Mischbatterie and Thermomischbatterie. Hand shower options are Brauseset and Regendusche. Do not include item prices in installables. Extract Zusatzarbeiten as 'დამატებითი სამუშაო' and translate handwritten work items into Georgian, without prices unless the price is necessary to identify the handwritten line. Page 4: extract selected panel height. Translate Verkleidung bis Wannenrand as 'ძველი ვანის კანტამდე', Verkleidung bis Fliesenkante as 'კაფელის კანტამდე', and Verkleidung deckenhoch/Deckenhöhe as 'ჭერამდე'. Explain the sketch in Georgian: where window, door, shower tray, fixed/moving glass, WC, cabinet, protrusion/ledge (Vorsprung = უჯრა), panels and numbered handwritten notes are, preserving the original layout meaning. Also include suspicious/unclear items. Fill loading-list fields with empty arrays and 'გადასამოწმებელია'.";
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
    const analysisType = req.body?.analysisType === "loading_list" ? "loading_list" : "shower_offer";

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: "You extract German BADELIX PDFs for Georgian workers. Never invent unclear values. If handwriting, dimensions, location, checkbox state, totals, or sketch meaning is uncertain, return exactly 'გადასამოწმებელია'. Translate German labels and handwritten notes into natural Georgian while preserving dimensions, color names, package letters, product names, dates/ranges, prices, and numbers exactly when readable."
            }
          ]
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: promptForType(analysisType) },
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
