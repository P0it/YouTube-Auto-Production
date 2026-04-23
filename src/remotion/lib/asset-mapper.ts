import * as fs from "fs";
import * as path from "path";
import type {
  AssetMapping,
  AudioSegment,
  CinematicEffect,
  GeneratedClipMeta,
  GeneratedImageMeta,
  Script,
  SectionType,
} from "./types";

/** Section → preferred effect palette. Cycle through these per image in a part. */
const SECTION_EFFECTS: Record<SectionType, CinematicEffect[]> = {
  hook: ["pushIn", "kenBurnsIn"],
  framing: ["kenBurnsIn", "panRight"],
  analysis: ["static", "pushIn", "static"],
  cases: ["static", "static", "pushIn"],
  deep: ["kenBurnsIn", "panLeft", "kenBurnsOut"],
  synthesis: ["pullOut", "kenBurnsOut"],
  outro: ["pullOut"],
};

function pickEffect(sectionType: SectionType, sequence: number): CinematicEffect {
  const palette = SECTION_EFFECTS[sectionType] ?? ["kenBurnsIn"];
  return palette[sequence % palette.length];
}

export interface BuildAssetMapInput {
  projectId: string;
  script: Script;
  audio: AudioSegment[];
  /** Use clips (Veo) when available for a part, otherwise fall back to images only. */
  preferClips?: boolean;
}

/**
 * For each audio segment (part), divide its duration evenly across the images
 * produced for that part. When a Veo clip exists for the same part, place it
 * at the start of the part (typically 4s) and distribute the images across
 * the remaining time.
 */
export function buildAssetMap(input: BuildAssetMapInput): AssetMapping[] {
  const { projectId, script, audio } = input;
  const preferClips = input.preferClips ?? true;

  const images = readJsonSafe<GeneratedImageMeta[]>(
    path.resolve(process.cwd(), "projects", projectId, "assets", "generated", "metadata.json"),
    []
  );
  const clips = readJsonSafe<GeneratedClipMeta[]>(
    path.resolve(process.cwd(), "projects", projectId, "assets", "clips", "metadata.json"),
    []
  );

  const imagesByPart = groupBy(images, (m) => m.partNumber);
  const clipsByPart = groupBy(clips, (m) => m.partNumber);

  const mapping: AssetMapping[] = [];
  let cursorMs = 0;

  for (const segment of audio) {
    const part = script.parts.find((p) => p.partNumber === segment.partNumber);
    if (!part) continue;

    const partImages = (imagesByPart.get(part.partNumber) ?? []).slice().sort(
      (a, b) => a.sequence - b.sequence
    );
    const partClips = (clipsByPart.get(part.partNumber) ?? []).slice().sort(
      (a, b) => a.sequence - b.sequence
    );

    const totalMs = segment.durationMs;
    const clipBudgetMs =
      preferClips && partClips.length > 0
        ? Math.min(totalMs, partClips[0].durationSeconds * 1000)
        : 0;

    const imageBudgetMs = Math.max(0, totalMs - clipBudgetMs);
    const imagesForSchedule = partImages.length > 0 ? partImages : [];
    const perImageMs =
      imagesForSchedule.length > 0 ? Math.floor(imageBudgetMs / imagesForSchedule.length) : 0;

    if (clipBudgetMs > 0) {
      const clip = partClips[0];
      mapping.push({
        partNumber: part.partNumber,
        sequence: -1,
        assetPath: clip.filePath,
        type: "video",
        startMs: cursorMs,
        endMs: cursorMs + clipBudgetMs,
        effect: "static",
        sectionType: part.sectionType,
      });
    }

    let imgCursor = cursorMs + clipBudgetMs;
    for (let i = 0; i < imagesForSchedule.length; i++) {
      const img = imagesForSchedule[i];
      const isLast = i === imagesForSchedule.length - 1;
      const slotMs = isLast
        ? cursorMs + totalMs - imgCursor
        : perImageMs;

      mapping.push({
        partNumber: part.partNumber,
        sequence: img.sequence,
        assetPath: img.filePath,
        type: "image",
        startMs: imgCursor,
        endMs: imgCursor + slotMs,
        effect: pickEffect(part.sectionType, i),
        sectionType: part.sectionType,
      });

      imgCursor += slotMs;
    }

    // If the part had no images at all, schedule a single black/empty slot
    // for the whole duration so downstream tools see the time accounted for.
    if (imagesForSchedule.length === 0 && clipBudgetMs === 0) {
      mapping.push({
        partNumber: part.partNumber,
        sequence: 0,
        assetPath: "",
        type: "image",
        startMs: cursorMs,
        endMs: cursorMs + totalMs,
        effect: "static",
        sectionType: part.sectionType,
      });
    }

    cursorMs += totalMs;
  }

  return mapping;
}

function readJsonSafe<T>(p: string, fallback: T): T {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function groupBy<T, K>(items: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = keyFn(item);
    const arr = out.get(k);
    if (arr) arr.push(item);
    else out.set(k, [item]);
  }
  return out;
}
