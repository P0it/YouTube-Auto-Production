import * as fs from "fs";
import * as path from "path";
import { llm } from "../remotion/lib/llm-router";

const SYSTEM_PROMPT = `You are the fact-checker and final editor for a Korean philosophy/psychology YouTube channel.

Your standard is high — a single fabricated citation fails the entire script.

## What you must verify (in priority order)

1. **Citation reality** — every [출처: ...] tag in the script must point to a real paper / experiment. Author exists, paper exists, paper actually says what the script claims. Use web search for plato.stanford.edu, scholar.google.com, PsycNet, PubMed. If you cannot confirm in two searches, replace with a verified equivalent from the same domain; do NOT leave unverified citations.

2. **Claim accuracy** — numbers, dates, named effects, experimental setups. Flag over-generalizations of single studies. Note known replication failures (e.g. ego depletion, power posing) and require acknowledgment.

3. **Structural compliance**
   - All 7 parts present with exact Korean headers: "## 파트 1: 훅 (0:00~0:30)" through "## 파트 7: 아우트로 (11:00~12:00)"
   - Part 4 has ≥ 2 distinct [출처: ...] tags
   - Every part has ≥ 1 [영상 지시: ...]
   - Narration total ≥ 2,800 Korean characters

4. **Logical flow** — Part 6 must tie back to Part 1's opening moment. Part 2 must name the concept Part 3 unpacks. New concepts from Part 3 must be reused in Part 5 or cut.

5. **Tone** — consistent Korean honorific register (-입니다). No "놀랍게도", no "인생이 바뀝니다". New jargon gets a plain-Korean gloss on first use.

## Output format (strict — Korean)

# 검증 리포트

## 인용 검증
| # | 원 인용 | 확인 결과 | 수정 |
|---|-------|--------|-----|
| 1 | ... | 확인됨 / 확인 불가 / 부분 확인 | 유지 / 대체 / 삭제 |

## 수정 사항
| 심각도 | 위치 | 원문 | 수정 | 근거 |
|--------|-----|-----|-----|-----|
| 높음 | 파트 N | ... | ... | ... |

## 검증 통계
- 인용 수: N개 (확인 N / 대체 N / 삭제 N)
- 총 글자수: N자 (예상 나레이션 시간: N분 N초)
- 수정 건수: N

---

(아래에 수정이 반영된 전체 대본 — 원래의 7-part 구조와 마크업 규칙 그대로)

## Rules
- Never silently rewrite. Every change gets a row with a reason.
- Preserve the writer's voice. Fix facts and structure, not style — unless style violates tone rules.
- Output the report and the corrected full script in one document.`;

function parseArgs(): { project: string } {
  const args = process.argv.slice(2);
  let project = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project" && args[i + 1]) project = args[++i];
  }

  if (!project) {
    console.error("Usage: npx tsx src/scripts/fact-check.ts --project project-id");
    process.exit(1);
  }

  return { project };
}

async function main() {
  const { project } = parseArgs();

  const projectDir = path.resolve(__dirname, "../../projects", project);
  const scriptPath = path.join(projectDir, "script.md");

  if (!fs.existsSync(scriptPath)) {
    console.error(`Script file not found: ${scriptPath}`);
    process.exit(1);
  }

  const scriptContent = fs.readFileSync(scriptPath, "utf-8");
  console.log(`Project: ${project}`);
  console.log(`Script chars: ${scriptContent.length}`);

  console.log("Fact-checking via LLM router (task=fact-check, web_search enabled)...");
  const startTime = Date.now();

  const text = await llm("fact-check", {
    system: SYSTEM_PROMPT,
    prompt: `다음 대본을 검증해 주세요:\n\n${scriptContent}`,
    maxTokens: 8192,
    temperature: 0.3,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const outputPath = path.join(projectDir, "script-verified.md");
  fs.writeFileSync(outputPath, text, "utf-8");

  console.log("");
  console.log(`Done in ${elapsed}s`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Verified chars: ${text.length}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
