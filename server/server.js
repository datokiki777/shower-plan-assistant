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

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed: ${origin}`));
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

const UNKNOWN = "გადასამოწმებელია";

const emptyAnalysis = () => ({
  clientName: UNKNOWN,
  address: UNKNOWN,
  orderNumber: UNKNOWN,
  date: UNKNOWN,
  showerTraySize: UNKNOWN,
  glassSizes: [],
  panelTypes: [],
  fittings: [],
  extraWork: [],
  prices: [],
  totalPrice: UNKNOWN,
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
  translatedSummaryKa: UNKNOWN
});

const analysisSchema = {
  name: "shower_plan_analysis",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      clientName: { type: "string" },
      address: { type: "string" },
      orderNumber: { type: "string" },
      date: { type: "string" },
      showerTraySize: { type: "string" },
      glassSizes: { type: "array", items: { type: "string" } },
      panelTypes: { type: "array", items: { type: "string" } },
      fittings: { type: "array", items: { type: "string" } },
      extraWork: { type: "array", items: { type: "string" } },
      prices: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            amount: { type: "string" }
          },
          required: ["label", "amount"]
        }
      },
      totalPrice: { type: "string" },
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
      translatedSummaryKa: { type: "string" }
    },
    required: [
      "clientName",
      "address",
      "orderNumber",
      "date",
      "showerTraySize",
      "glassSizes",
      "panelTypes",
      "fittings",
      "extraWork",
      "prices",
      "totalPrice",
      "workNotes",
      "sketchExplanation",
      "suspiciousItems",
      "translatedSummaryKa"
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

app.post("/api/analyze", upload.array("files", 8), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: "OPENAI_API_KEY is missing. Use demo mode or configure .env."
      });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: "Upload at least one PDF or image." });
    }

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
              text:
                "You extract German shower installation order documents and sketches for Georgian workers. Never invent unclear values. If handwriting, dimensions, price, location, or sketch meaning is uncertain, return exactly 'გადასამოწმებელია' for that field or list item. Translate German notes into Georgian. Keep dimensions/prices exactly as written when readable."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Analyze these uploaded PDF/image documents. Extract client data, order data, shower tray and glass measurements, panel types/area, fittings, additional work, prices/total, work notes, and a simple Georgian explanation of the sketch layout: door, WC, window, shower tray, fixed/moving glass, and panel-covered walls."
            },
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
      analysis: normalizeAnalysis(parsed)
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
