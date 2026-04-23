import * as fs from "fs";
import * as path from "path";
import { searchPopularVideos } from "../remotion/lib/youtube-api";
import { getDailyTrends, getRelatedQueries } from "../remotion/lib/google-trends";

type Language = "ko" | "en";

/**
 * Raw-data collector for the researcher-planner subagent.
 *
 * IMPORTANT — anti-copy policy:
 * We intentionally do NOT collect Korean YouTube video titles as topic
 * candidates. Korean viewers would recognize the source and it would amount
 * to title-cloning. Instead we pull:
 *   (a) English academic/philosophical/psychological video titles for
 *       *inspiration* only (foreign context the Korean audience doesn't see),
 *   (b) Korean Google Trends — as a *cultural context signal* for what
 *       Korean viewers are thinking about this month, NOT as topics.
 *
 * The researcher-planner subagent is responsible for combining these
 * signals into ORIGINAL Korean topic angles that reference foreign academic
 * grounding.
 */

interface ForeignVideoReference {
  title: string;
  channelTitle: string;
  viewCount: number;
  url: string;
  publishedAt: string;
}

interface KoreanTrendSignal {
  query: string;
  kind: "daily" | "related";
}

interface ResearchResult {
  mode: "theme" | "auto";
  theme?: string;
  language: Language;
  /** English-only video references — inspiration, never a direct topic source. */
  foreignReferences: ForeignVideoReference[];
  /** Korean cultural context signals — what Korean audience is thinking about. */
  koreanContext: KoreanTrendSignal[];
  notesForPlanner: string;
  timestamp: string;
}

function parseArgs(): { theme?: string; project?: string; language: Language } {
  const args = process.argv.slice(2);
  let theme: string | undefined;
  let project: string | undefined;
  let language: Language = "ko";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--theme" && args[i + 1]) theme = args[++i];
    else if (args[i] === "--project" && args[i + 1]) project = args[++i];
    else if (args[i] === "--language" && args[i + 1]) {
      const v = args[++i];
      if (v === "ko" || v === "en") language = v;
    }
  }

  return { theme, project, language };
}

/**
 * English-only philosophy/psychology seeds. These pull *foreign* academic
 * video references the Korean audience never sees — safe for inspiration.
 */
const ENGLISH_SEEDS = [
  "classic psychology experiment explained",
  "philosophy of everyday life",
  "cognitive bias illustrated",
  "phenomenology introduction",
  "existential psychology",
  "moral philosophy thought experiment",
  "social psychology famous study",
  "academy of ideas",
  "the school of life philosophy",
];

async function collectForeignReferences(
  themeOrNull: string | undefined
): Promise<ForeignVideoReference[]> {
  const out: ForeignVideoReference[] = [];
  const queries = themeOrNull
    ? [translateThemeToEnglishHeuristic(themeOrNull), ...ENGLISH_SEEDS.slice(0, 5)]
    : ENGLISH_SEEDS;

  for (const q of queries) {
    console.log(`Searching YouTube (EN-only) for "${q}"...`);
    try {
      const videos = await searchPopularVideos(q, 5);
      for (const v of videos) {
        out.push({
          title: cleanTitle(v.title),
          channelTitle: v.channelTitle,
          viewCount: v.viewCount,
          url: v.url,
          publishedAt: v.publishedAt,
        });
      }
    } catch {
      console.warn(`"${q}" search failed, skipping.`);
    }
  }

  return dedupeByTitle(out);
}

async function collectKoreanContext(theme: string | undefined): Promise<KoreanTrendSignal[]> {
  const signals: KoreanTrendSignal[] = [];
  try {
    const daily = await getDailyTrends();
    for (const q of daily.slice(0, 6)) {
      signals.push({ query: q, kind: "daily" });
    }
  } catch {
    console.warn("Google Trends daily failed, skipping.");
  }

  if (theme) {
    try {
      const related = await getRelatedQueries(theme);
      for (const q of related.slice(0, 6)) {
        signals.push({ query: q, kind: "related" });
      }
    } catch {
      console.warn("Google Trends related failed, skipping.");
    }
  }

  return signals;
}

/**
 * Very rough best-effort mapping of a Korean theme string to an English
 * search phrase. This is intentionally light — the planner agent does the
 * real translation/interpretation. We just pick a few academic probes.
 */
function translateThemeToEnglishHeuristic(theme: string): string {
  return `${theme} psychology philosophy study`;
}

function cleanTitle(title: string): string {
  return title
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
      ""
    )
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeByTitle(refs: ForeignVideoReference[]): ForeignVideoReference[] {
  const seen = new Set<string>();
  const out: ForeignVideoReference[] = [];
  for (const r of refs) {
    const key = r.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function buildPlannerNotes(result: Omit<ResearchResult, "notesForPlanner">): string {
  const hasForeign = result.foreignReferences.length;
  const hasContext = result.koreanContext.length;
  return [
    `Raw data for researcher-planner. Mode=${result.mode}${
      result.theme ? `, seed="${result.theme}"` : ""
    }.`,
    `Foreign references: ${hasForeign} English philosophy/psychology video titles — use ONLY as inspiration. NEVER translate a Korean viewer would recognize or copy a Korean title.`,
    `Korean context signals: ${hasContext} Google Trends entries — use as "what Korean audience is currently thinking about" cultural signal, NOT as topic candidates.`,
    `Your job: produce 10-15 original Korean philosophy/psychology topics. Each must have (a) an everyday Korean life hook, (b) academic framing, (c) a real peer-reviewed paper citation. See the 6-column table format in your agent definition.`,
    `Reject any topic where the core angle would collide with a recognizable Korean YouTube video.`,
  ].join("\n");
}

/**
 * Legacy research.md shape, kept as a placeholder until the researcher-planner
 * subagent overwrites it with the curated 6-column Korean table.
 */
function placeholderMarkdown(result: ResearchResult): string {
  return [
    `# 리서치 raw 데이터: ${result.theme || "자동 탐색"}`,
    ``,
    `> 이 파일은 researcher-planner 서브에이전트가 곧 **한국어 주제 후보 6컬럼 표**로 덮어씁니다.`,
    `> 현재는 raw-trends.json의 원시 데이터 요약만 들어있습니다.`,
    ``,
    `## 외국어(영어) 영상 참고 (${result.foreignReferences.length}개)`,
    `researcher-planner가 영감용으로만 사용 — 한국어 영상 제목은 수집하지 않습니다.`,
    ``,
    ...result.foreignReferences.slice(0, 15).map(
      (v, i) => `${i + 1}. ${v.title} — ${v.channelTitle}`
    ),
    ``,
    `## 한국 문화 컨텍스트 (${result.koreanContext.length}개)`,
    `시청자 공감대 파악용. 주제 후보 아님.`,
    ``,
    ...result.koreanContext.map((s, i) => `${i + 1}. ${s.query} (${s.kind})`),
    ``,
  ].join("\n");
}

async function main() {
  const { theme, project, language } = parseArgs();
  const startTime = Date.now();

  const foreignReferences = await collectForeignReferences(theme);
  const koreanContext = await collectKoreanContext(theme);

  const partial: Omit<ResearchResult, "notesForPlanner"> = {
    mode: theme ? "theme" : "auto",
    theme,
    language,
    foreignReferences,
    koreanContext,
    timestamp: new Date().toISOString(),
  };
  const result: ResearchResult = {
    ...partial,
    notesForPlanner: buildPlannerNotes(partial),
  };

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const jsonOutput = JSON.stringify(result, null, 2);

  if (project) {
    const projectDir = path.resolve(__dirname, "../../projects", project);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    fs.writeFileSync(path.join(projectDir, "raw-trends.json"), jsonOutput, "utf-8");
    fs.writeFileSync(path.join(projectDir, "research.md"), placeholderMarkdown(result), "utf-8");

    console.error(`\nSaved raw-trends.json to ${projectDir}`);
  }

  console.error(
    `\nDone! foreignRefs=${foreignReferences.length} koreanContext=${koreanContext.length} (${elapsed}s)`
  );
  console.log(jsonOutput);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
