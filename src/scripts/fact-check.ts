import * as fs from "fs";
import * as path from "path";
import { generateText, checkOllamaStatus } from "../remotion/lib/llm";

const SYSTEM_PROMPT = `당신은 방송 팩트체커 겸 편집장입니다. 모든 대본이 방송에 나가기 전 최종 검증을 담당합니다.

## 검증 체크리스트

### 1. 사실 검증 (필수)
- 대본에 언급된 수치, 날짜, 인물, 사건이 정확한가?
- 핵심 팩트를 교차 검증
- 출처가 불분명한 주장이 있는가?

### 2. 논리 흐름 (권장)
- 앞뒤 문맥이 자연스럽게 연결되는가?
- 갑자기 새로운 개념이 설명 없이 등장하지 않는가?
- 결론이 본론의 내용과 일치하는가?

### 3. 중복 제거 (권장)
- 같은 내용을 다른 표현으로 반복하고 있지 않은가?
- 불필요한 서론이 길지 않은가?

### 4. 톤 일관성 (선택)
- 장르에 맞는 어조가 처음부터 끝까지 유지되는가?
- 갑자기 격식체/비격식체가 바뀌지 않는가?

### 5. 시간 배분 (필수)
- 전체 대본이 8분 이상의 나레이션 분량인가?
- 한국어 나레이션 기준: 분당 약 300~350자
- 8분 = 최소 2,400자 이상

## 출력 형식

반드시 아래 형식으로 출력하세요:

# 검증 리포트

## 수정 사항
| 심각도 | 위치 | 원문 | 수정 | 근거 |
|--------|------|------|------|------|
| (높음/중간/낮음) | 파트 N | 원래 텍스트 | 수정된 텍스트 | 수정 이유 |

## 검증 통계
- 팩트 체크 항목: N개
- 수정 사항: N개
- 총 글자수: N자 (예상 나레이션 시간: N분 N초)

---
(아래에 수정이 반영된 전체 대본)`;

function parseArgs(): { project: string } {
  const args = process.argv.slice(2);
  let project = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project" && args[i + 1]) {
      project = args[++i];
    }
  }

  if (!project) {
    console.error(
      "사용법: npx tsx src/scripts/fact-check.ts --project project-id"
    );
    process.exit(1);
  }

  return { project };
}

async function main() {
  const { project } = parseArgs();

  // 대본 파일 읽기
  const projectDir = path.resolve(
    __dirname,
    "../../projects",
    project
  );
  const scriptPath = path.join(projectDir, "script.md");

  if (!fs.existsSync(scriptPath)) {
    console.error(`대본 파일을 찾을 수 없습니다: ${scriptPath}`);
    process.exit(1);
  }

  const scriptContent = fs.readFileSync(scriptPath, "utf-8");
  console.log(`프로젝트: ${project}`);
  console.log(`대본 글자수: ${scriptContent.length}자`);
  console.log("");

  // Ollama 상태 확인
  const isRunning = await checkOllamaStatus();
  if (!isRunning) {
    console.error(
      "Ollama가 실행되지 않고 있습니다. `ollama serve`로 시작하고 `ollama pull qwen3:30b`를 실행하세요."
    );
    process.exit(1);
  }

  console.log("팩트체크 진행 중...");
  const startTime = Date.now();

  const result = await generateText(
    `다음 대본을 검증해 주세요:\n\n${scriptContent}`,
    SYSTEM_PROMPT
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const outputPath = path.join(projectDir, "script-verified.md");
  fs.writeFileSync(outputPath, result.text, "utf-8");

  console.log("");
  console.log(`완료! (${elapsed}초)`);
  console.log(`저장: ${outputPath}`);
  console.log(`검증 결과 글자수: ${result.text.length}자`);
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
