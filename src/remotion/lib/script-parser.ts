import type {
  Script,
  ScriptPart,
  SectionType,
  SubtitleEntry,
  AudioSegment,
} from "./types";
import * as fs from "fs";

/** 7파트 구조 고정 매핑 — scriptwriter 에이전트의 템플릿과 일치해야 한다 */
const PART_SECTION_MAP: Record<number, SectionType> = {
  1: "hook",
  2: "framing",
  3: "analysis",
  4: "cases",
  5: "deep",
  6: "synthesis",
  7: "outro",
};

export function sectionTypeForPart(partNumber: number): SectionType {
  return PART_SECTION_MAP[partNumber] ?? "deep";
}

export function parseScript(filePath: string, projectId: string): Script {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let topic = "";
  const parts: ScriptPart[] = [];
  let currentPart: Partial<ScriptPart> | null = null;
  let narrationLines: string[] = [];
  let visualDirections: string[] = [];
  let highlightWords: string[] = [];
  let sources: string[] = [];

  for (const line of lines) {
    const topicMatch = line.match(/^#\s+주제:\s*(.+)/);
    if (topicMatch) {
      topic = topicMatch[1].trim();
      continue;
    }

    const partMatch = line.match(
      /^##\s+파트\s*(\d+):\s*(.+?)\s*\((\d+:\d+)~(\d+:\d+)\)/
    );
    if (partMatch) {
      if (currentPart) {
        parts.push(
          finalizePart(currentPart, narrationLines, visualDirections, highlightWords, sources)
        );
      }
      currentPart = {
        partNumber: parseInt(partMatch[1]),
        partName: partMatch[2].trim(),
        startTime: partMatch[3],
        endTime: partMatch[4],
      };
      narrationLines = [];
      visualDirections = [];
      highlightWords = [];
      sources = [];
      continue;
    }

    const visualMatch = line.match(/\[영상\s*지시:\s*(.+?)\]/);
    if (visualMatch) {
      visualDirections.push(visualMatch[1].trim());
    }

    const sourceMatches = line.matchAll(/\[출처:\s*(.+?)\]/g);
    for (const m of sourceMatches) {
      sources.push(m[1].trim());
    }

    const boldMatches = line.matchAll(/\*\*(.+?)\*\*/g);
    for (const match of boldMatches) {
      highlightWords.push(match[1]);
    }

    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("[")) {
      narrationLines.push(
        trimmed
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\[영상\s*지시:\s*.+?\]/g, "")
          .replace(/\[출처:\s*.+?\]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      );
    }
  }

  if (currentPart) {
    parts.push(
      finalizePart(currentPart, narrationLines, visualDirections, highlightWords, sources)
    );
  }

  const lastPart = parts[parts.length - 1];
  const totalDuration = lastPart ? lastPart.endTime : "0:00";

  return { projectId, topic, totalDuration, parts };
}

function finalizePart(
  partial: Partial<ScriptPart>,
  narrationLines: string[],
  visualDirections: string[],
  highlightWords: string[],
  sources: string[]
): ScriptPart {
  const partNumber = partial.partNumber ?? 0;
  return {
    partNumber,
    partName: partial.partName ?? "",
    startTime: partial.startTime ?? "0:00",
    endTime: partial.endTime ?? "0:00",
    narration: narrationLines.filter(Boolean).join(" "),
    visualDirections,
    highlightWords,
    sectionType: sectionTypeForPart(partNumber),
    sources,
  };
}

export function generateSubtitles(
  script: Script,
  audioSegments: AudioSegment[]
): SubtitleEntry[] {
  const subtitles: SubtitleEntry[] = [];
  let offsetMs = 0;

  for (const segment of audioSegments) {
    const part = script.parts.find((p) => p.partNumber === segment.partNumber);
    if (!part) continue;

    const words = part.narration.split(/\s+/);
    const msPerWord = segment.durationMs / Math.max(words.length, 1);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      subtitles.push({
        text: word,
        startMs: offsetMs + i * msPerWord,
        endMs: offsetMs + (i + 1) * msPerWord,
        highlight: part.highlightWords.includes(word),
      });
    }

    offsetMs += segment.durationMs;
  }

  return subtitles;
}
