import "server-only";
import * as fs from "fs";
import * as path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

export interface ResearchValidation {
  exists: boolean;
  /** True if the file is just the raw-data placeholder written by research.ts. */
  isPlaceholder: boolean;
  /** True if the researcher-planner subagent produced a usable topic table. */
  ready: boolean;
  /** How many 7+ column rows we found under "주제 후보". */
  topicCount: number;
}

/**
 * Placeholder detection — research.ts writes these marker sections before
 * the researcher-planner subagent takes over. If either marker is still
 * present, the file has not been curated yet.
 */
const PLACEHOLDER_MARKERS = [
  "# 리서치 raw 데이터",
  "## 외국어(영어) 영상 참고",
];

/**
 * A ready research.md must contain a "## 주제 후보" section with a markdown
 * table of at least 5 rows, each with 7+ pipe-delimited columns (the columns
 * scriptwriter expects: # | 주제 | 일상 훅 | 학문 분야 | 이론 | 대표 연구 | 한국 맥락).
 */
const MIN_TOPICS_TO_BE_READY = 5;

export function validateResearch(projectId: string): ResearchValidation {
  const filePath = path.join(PROJECTS_DIR, projectId, "research.md");
  if (!fs.existsSync(filePath)) {
    return { exists: false, isPlaceholder: false, ready: false, topicCount: 0 };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const isPlaceholder = PLACEHOLDER_MARKERS.some((m) => content.includes(m));

  const topicCount = countCandidateRows(content);
  const ready = !isPlaceholder && topicCount >= MIN_TOPICS_TO_BE_READY;

  return {
    exists: true,
    isPlaceholder,
    ready,
    topicCount,
  };
}

function countCandidateRows(content: string): number {
  const lines = content.split("\n");
  let inCandidates = false;
  let count = 0;
  for (const line of lines) {
    const section = line.match(/^##\s+(.+)/);
    if (section) {
      inCandidates = /주제\s*후보/.test(section[1]);
      continue;
    }
    if (!inCandidates) continue;
    if (/^\|\s*-+/.test(line)) continue;
    if (/^\|\s*#\s*\|/.test(line)) continue;

    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const cols = trimmed
      .slice(1, -1)
      .split(/(?<!\\)\|/)
      .map((c) => c.trim());
    if (cols.length < 7) continue;
    const rank = parseInt(cols[0]);
    if (!Number.isFinite(rank)) continue;
    count++;
  }
  return count;
}
