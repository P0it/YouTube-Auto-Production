import * as fs from "fs";
import * as path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { withRetry } from "./retry";
import type { GeneratedImageMeta, SectionType, ImageStyle } from "./types";

dotenv.config();

interface ImageGenConfig {
  provider: "gemini";
  model: string;
  longformAspectRatio: "16:9";
  shortformAspectRatio: "9:16";
  imageSize: "512" | "1K" | "2K" | "4K";
  countPerPart: number;
  cacheRegeneratedPrompts: boolean;
}

let genCache: ImageGenConfig | null = null;
let aiClient: GoogleGenAI | null = null;

function loadConfig(): ImageGenConfig {
  if (genCache) return genCache;
  const p = path.resolve(__dirname, "../../../config/image-generation.json");
  genCache = JSON.parse(fs.readFileSync(p, "utf-8")) as ImageGenConfig;
  return genCache;
}

function getAi(): GoogleGenAI {
  if (aiClient) return aiClient;
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key not set. Add GOOGLE_GENERATIVE_AI_API_KEY (preferred) or GEMINI_API_KEY to .env."
    );
  }
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

export interface GenerateImageInput {
  projectId: string;
  partNumber: number;
  sequence: number;
  prompt: string;
  sectionType: SectionType;
  style: ImageStyle;
  orientation: "landscape" | "portrait";
}

export interface GenerateImageResult {
  meta: GeneratedImageMeta;
  bytes: number;
}

export function projectAssetsDir(projectId: string): string {
  return path.resolve(process.cwd(), "projects", projectId, "assets", "generated");
}

export function metadataFilePath(projectId: string): string {
  return path.join(projectAssetsDir(projectId), "metadata.json");
}

export function readMetadata(projectId: string): GeneratedImageMeta[] {
  const p = metadataFilePath(projectId);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as GeneratedImageMeta[];
  } catch {
    return [];
  }
}

export function writeMetadata(projectId: string, entries: GeneratedImageMeta[]): void {
  const dir = projectAssetsDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(metadataFilePath(projectId), JSON.stringify(entries, null, 2), "utf-8");
}

export async function generateImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  const cfg = loadConfig();
  const dir = projectAssetsDir(input.projectId);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `part_${String(input.partNumber).padStart(2, "0")}_${input.sequence}.png`;
  const filePath = path.join(dir, filename);

  const aspectRatio =
    input.orientation === "landscape" ? cfg.longformAspectRatio : cfg.shortformAspectRatio;

  const response = await withRetry(
    () =>
      getAi().models.generateContent({
        model: cfg.model,
        contents: input.prompt,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          // imageConfig exists on the wire API but is not yet in @google/genai typings.
          // Pass it through the untyped catch-all so aspectRatio/imageSize still apply.
          ...({ imageConfig: { aspectRatio, imageSize: cfg.imageSize } } as Record<
            string,
            unknown
          >),
        },
      }),
    {
      shouldRetry: (err) => {
        const e = err as { status?: number; message?: string };
        if (e.status && e.status >= 500) return true;
        if (e.status === 429) return true;
        if (e.message && /timeout|ECONNRESET|ETIMEDOUT/i.test(e.message)) return true;
        return false;
      },
      onRetry: (err, attempt, delay) => {
        console.warn(
          `[gemini] retry attempt=${attempt} delay=${Math.round(delay)}ms reason=${
            (err as Error)?.message ?? "unknown"
          }`
        );
      },
    }
  );

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (p): p is { inlineData: { data: string; mimeType?: string } } =>
      typeof (p as { inlineData?: unknown }).inlineData === "object" &&
      (p as { inlineData?: { data?: string } }).inlineData?.data !== undefined
  );

  if (!imagePart) {
    throw new Error(
      `Gemini response did not contain inlineData image. Part types: ${parts
        .map((p) => Object.keys(p))
        .join(", ")}`
    );
  }

  const buffer = Buffer.from(imagePart.inlineData.data, "base64");
  fs.writeFileSync(filePath, buffer);

  const meta: GeneratedImageMeta = {
    partNumber: input.partNumber,
    sequence: input.sequence,
    filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    prompt: input.prompt,
    model: cfg.model,
    sectionType: input.sectionType,
    style: input.style,
    aspectRatio,
    generatedAt: new Date().toISOString(),
  };

  const all = readMetadata(input.projectId).filter(
    (m) => !(m.partNumber === input.partNumber && m.sequence === input.sequence)
  );
  all.push(meta);
  all.sort((a, b) => a.partNumber - b.partNumber || a.sequence - b.sequence);
  writeMetadata(input.projectId, all);

  return { meta, bytes: buffer.byteLength };
}
