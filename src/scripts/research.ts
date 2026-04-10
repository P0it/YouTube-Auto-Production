import * as fs from "fs";
import * as path from "path";
import { searchPopularVideos } from "../remotion/lib/youtube-api";
import { getDailyTrends, getRelatedQueries } from "../remotion/lib/google-trends";

interface TopicCandidate {
  title: string;
  description: string;
  source: "youtube" | "trends" | "llm";
}

interface ResearchResult {
  mode: "theme" | "auto";
  theme?: string;
  candidates: TopicCandidate[];
  timestamp: string;
}

function parseArgs(): { theme?: string; project?: string } {
  const args = process.argv.slice(2);
  let theme: string | undefined;
  let project: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--theme" && args[i + 1]) {
      theme = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      project = args[++i];
    }
  }

  return { theme, project };
}

/** 테마 있을 때: LLM이 주제를 생성하고 YouTube API로 포화 체크 */
async function researchWithTheme(theme: string): Promise<TopicCandidate[]> {
  console.log(`Searching YouTube for "${theme}"...`);

  // YouTube에서 해당 테마의 인기 영상 가져오기
  const videos = await searchPopularVideos(theme, 15);

  const candidates: TopicCandidate[] = [];

  // 인기 영상 제목에서 주제 패턴 추출
  for (const video of videos) {
    const cleaned = cleanTitle(video.title);
    if (!cleaned) continue;
    candidates.push({
      title: cleaned,
      description: `${video.channelTitle} · 조회수 ${formatViewCount(video.viewCount)} · ${formatDate(video.publishedAt)}`,
      source: "youtube",
    });
  }

  // 관련 검색어도 가져오기
  console.log(`Fetching related queries for "${theme}"...`);
  try {
    const relatedQueries = await getRelatedQueries(theme);
    for (const query of relatedQueries.slice(0, 5)) {
      candidates.push({
        title: cleanTitle(query),
        description: `"${theme}" 관련 급상승 검색어`,
        source: "trends",
      });
    }
  } catch (err) {
    console.warn("Google Trends related queries failed, skipping.");
  }

  return candidates;
}

/** 테마 없을 때: Google Trends 일간 트렌드 + YouTube 인기 영상 */
async function researchAuto(): Promise<TopicCandidate[]> {
  console.log("Auto-discovering today's trends...");

  const candidates: TopicCandidate[] = [];

  // Google Trends daily trending searches
  console.log("Fetching Google Trends daily searches...");
  try {
    const dailyTrends = await getDailyTrends();
    for (const trend of dailyTrends.slice(0, 10)) {
      candidates.push({
        title: trend,
        description: "오늘의 Google 인기 검색어",
        source: "trends",
      });
    }
  } catch (err) {
    console.warn("Google Trends failed, using YouTube only.");
  }

  // YouTube trending keyword searches
  const trendingKeywords = ["viral", "shocking", "mind blowing", "you won't believe"];
  for (const keyword of trendingKeywords) {
    console.log(`Searching YouTube for "${keyword}"...`);
    try {
      const videos = await searchPopularVideos(keyword, 5);
      for (const video of videos) {
        candidates.push({
          title: cleanTitle(video.title),
          description: `${video.channelTitle} · 조회수 ${formatViewCount(video.viewCount)}`,
          source: "youtube",
        });
      }
    } catch (err) {
      console.warn(`"${keyword}" search failed, skipping.`);
    }
  }

  return candidates;
}

/** 제목에서 이모지, 해시태그, 과도한 공백 제거 */
function cleanTitle(title: string): string {
  return title
    // 이모지 제거
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "")
    // 해시태그 제거
    .replace(/#\S+/g, "")
    // 여러 공백을 하나로
    .replace(/\s+/g, " ")
    .trim();
}

function formatViewCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

function generateResearchMarkdown(result: ResearchResult): string {
  const header = `# 리서치 결과: ${result.theme || "자동 탐색"}\n\n## 주제 후보\n\n`;
  const tableHeader = `| # | 주제 | 설명 | 출처 |\n|---|------|------|------|\n`;

  const rows = result.candidates.map((c, i) =>
    `| ${i + 1} | ${c.title.replace(/\|/g, "\\|")} | ${c.description.replace(/\|/g, "\\|")} | ${c.source} |`
  ).join("\n");

  return header + tableHeader + rows + "\n";
}

async function main() {
  const { theme, project } = parseArgs();
  const startTime = Date.now();

  let candidates: TopicCandidate[];

  if (theme) {
    candidates = await researchWithTheme(theme);
  } else {
    candidates = await researchAuto();
  }

  const result: ResearchResult = {
    mode: theme ? "theme" : "auto",
    theme,
    candidates,
    timestamp: new Date().toISOString(),
  };

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // JSON 출력 (에이전트가 파싱할 수 있도록)
  const jsonOutput = JSON.stringify(result, null, 2);

  // 프로젝트 디렉토리가 지정되면 파일로도 저장
  if (project) {
    const projectDir = path.resolve(__dirname, "../../projects", project);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // raw JSON 저장 (에이전트용)
    const outputPath = path.join(projectDir, "raw-trends.json");
    fs.writeFileSync(outputPath, jsonOutput, "utf-8");

    // research.md 생성 (웹 UI용)
    const md = generateResearchMarkdown(result);
    fs.writeFileSync(path.join(projectDir, "research.md"), md, "utf-8");

    console.error(`\nSaved: ${outputPath}`);
  }

  console.error(`\nDone! ${candidates.length} candidates collected (${elapsed}s)`);

  // stdout으로 JSON 출력 (에이전트가 캡처)
  console.log(jsonOutput);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
