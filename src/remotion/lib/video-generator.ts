import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { withRetry } from "./retry";
import type { GeneratedClipMeta, SectionType } from "./types";

dotenv.config();

interface VideoGenConfig {
  model: string;
  aspectRatio: "16:9" | "9:16";
  resolution: "720p" | "1080p" | "4k";
  durationSeconds: "4" | "6" | "8";
  pollIntervalMs: number;
  maxWaitMs: number;
}

let aiClient: GoogleGenAI | null = null;
let cfgCache: VideoGenConfig | null = null;

function getAi(): GoogleGenAI {
  if (aiClient) return aiClient;
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key not set. Add GOOGLE_GENERATIVE_AI_API_KEY to .env to use Veo."
    );
  }
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

function loadConfig(): VideoGenConfig {
  if (cfgCache) return cfgCache;
  const p = path.resolve(__dirname, "../../../config/video-generation.json");
  if (fs.existsSync(p)) {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<VideoGenConfig>;
    cfgCache = {
      model: raw.model ?? "veo-3.1-fast-generate-preview",
      aspectRatio: raw.aspectRatio ?? "16:9",
      resolution: raw.resolution ?? "720p",
      durationSeconds: raw.durationSeconds ?? "4",
      pollIntervalMs: raw.pollIntervalMs ?? 10_000,
      maxWaitMs: raw.maxWaitMs ?? 6 * 60_000,
    };
  } else {
    cfgCache = {
      model: "veo-3.1-fast-generate-preview",
      aspectRatio: "16:9",
      resolution: "720p",
      durationSeconds: "4",
      pollIntervalMs: 10_000,
      maxWaitMs: 6 * 60_000,
    };
  }
  return cfgCache;
}

export function projectClipsDir(projectId: string): string {
  return path.resolve(process.cwd(), "projects", projectId, "assets", "clips");
}

export function clipMetadataPath(projectId: string): string {
  return path.join(projectClipsDir(projectId), "metadata.json");
}

export function readClipMetadata(projectId: string): GeneratedClipMeta[] {
  const p = clipMetadataPath(projectId);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as GeneratedClipMeta[];
  } catch {
    return [];
  }
}

export function writeClipMetadata(projectId: string, entries: GeneratedClipMeta[]): void {
  fs.mkdirSync(projectClipsDir(projectId), { recursive: true });
  fs.writeFileSync(clipMetadataPath(projectId), JSON.stringify(entries, null, 2), "utf-8");
}

export interface GenerateVideoClipInput {
  projectId: string;
  partNumber: number;
  sequence: number;
  prompt: string;
  sectionType: SectionType;
  orientation?: "landscape" | "portrait";
}

export interface GenerateVideoClipResult {
  meta: GeneratedClipMeta;
  bytes: number;
}

export async function generateVideoClip(
  input: GenerateVideoClipInput
): Promise<GenerateVideoClipResult> {
  const cfg = loadConfig();
  const dir = projectClipsDir(input.projectId);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `part_${String(input.partNumber).padStart(2, "0")}_${input.sequence}.mp4`;
  const filePath = path.join(dir, filename);

  const aspectRatio =
    input.orientation === "portrait" ? "9:16" : cfg.aspectRatio;

  let operation = await withRetry(
    () =>
      getAi().models.generateVideos({
        model: cfg.model,
        prompt: input.prompt,
        config: {
          aspectRatio,
          resolution: cfg.resolution,
          durationSeconds: cfg.durationSeconds,
          personGeneration: "allow_all",
        } as unknown as Record<string, unknown>,
      }),
    {
      shouldRetry: (err) => {
        const e = err as { status?: number };
        return !e.status || e.status >= 500 || e.status === 429;
      },
      onRetry: (err, attempt, delay) => {
        console.warn(
          `[veo] start retry attempt=${attempt} delay=${Math.round(delay)}ms reason=${
            (err as Error)?.message ?? "unknown"
          }`
        );
      },
    }
  );

  const started = Date.now();
  while (!operation.done) {
    if (Date.now() - started > cfg.maxWaitMs) {
      throw new Error(
        `Veo generation exceeded maxWaitMs=${cfg.maxWaitMs}ms for part ${input.partNumber}#${input.sequence}`
      );
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
    operation = await getAi().operations.getVideosOperation({ operation });
  }

  const generated = operation.response?.generatedVideos?.[0]?.video;
  if (!generated) {
    throw new Error("Veo completed but response contained no generated video.");
  }

  await getAi().files.download({ file: generated, downloadPath: filePath });

  const stats = fs.statSync(filePath);

  const meta: GeneratedClipMeta = {
    partNumber: input.partNumber,
    sequence: input.sequence,
    filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
    prompt: input.prompt,
    model: cfg.model,
    sectionType: input.sectionType,
    aspectRatio,
    durationSeconds: Number(cfg.durationSeconds),
    resolution: cfg.resolution,
    generatedAt: new Date().toISOString(),
  };

  const all = readClipMetadata(input.projectId).filter(
    (m) => !(m.partNumber === input.partNumber && m.sequence === input.sequence)
  );
  all.push(meta);
  all.sort((a, b) => a.partNumber - b.partNumber || a.sequence - b.sequence);
  writeClipMetadata(input.projectId, all);

  return { meta, bytes: stats.size };
}
