import type { Script, ScriptPart, SubtitleEntry, AudioSegment } from "./types";
import * as fs from "fs";

/**
 * 마크다운 형식의 대본 파일을 파싱하여 Script 객체로 변환
 */
export function parseScript(filePath: string, projectId: string): Script {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let topic = "";
  const parts: ScriptPart[] = [];
  let currentPart: Partial<ScriptPart> | null = null;
  let narrationLines: string[] = [];
  let visualDirections: string[] = [];
  let highlightWords: string[] = [];

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
          finalizePart(currentPart, narrationLines, visualDirections, highlightWords)
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
      continue;
    }

    const visualMatch = line.match(/\[영상\s*지시:\s*(.+?)\]/);
    if (visualMatch) {
      visualDirections.push(visualMatch[1].trim());
      continue;
    }

    const boldMatches = line.matchAll(/\*\*(.+?)\*\*/g);
    for (const match of boldMatches) {
      highlightWords.push(match[1]);
    }

    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("[")) {
      narrationLines.push(trimmed.replace(/\*\*(.+?)\*\*/g, "$1"));
    }
  }

  if (currentPart) {
    parts.push(
      finalizePart(currentPart, narrationLines, visualDirections, highlightWords)
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
  highlightWords: string[]
): ScriptPart {
  return {
    partNumber: partial.partNumber ?? 0,
    partName: partial.partName ?? "",
    startTime: partial.startTime ?? "0:00",
    endTime: partial.endTime ?? "0:00",
    narration: narrationLines.join(" "),
    visualDirections,
    highlightWords,
  };
}

/** 대본에서 자막 엔트리 생성 (TTS 타이밍 기반) */
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
    const msPerWord = segment.durationMs / words.length;

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
