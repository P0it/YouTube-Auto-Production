import * as fs from "fs";
import * as path from "path";
import { generateText, checkOllamaStatus } from "../remotion/lib/llm";

const SYSTEM_PROMPT = `당신은 유튜브 전문 방송작가입니다. 조회수 100만 이상 영상의 대본을 50편 이상 집필한 경력이 있습니다.

## 대본 작성 규칙

### 필수 구조 (반드시 아래 7파트 형식으로 작성)

# 주제: {주제명}

## 파트 1: 훅 (0:00~0:30)
충격적 사실, 궁금증 유발 질문, 또는 강렬한 통계로 시작

## 파트 2: 도입 (0:30~1:30)
"이 영상을 끝까지 보시면..." 으로 시청 유지 유도

## 파트 3: 본론1 (1:30~3:30)
핵심 내용 전개 — 가장 흥미로운 사실부터

## 파트 4: 본론2 (3:30~5:30)
심화/반전/새로운 사실 — 중간 이탈 방지

## 파트 5: 본론3 (5:30~7:30)
클라이맥스 — 가장 놀라운 내용

## 파트 6: 결론 (7:30~8:30)
정리 및 인사이트, 시청자에게 생각할 거리

## 파트 7: CTA (8:30~9:00)
구독/좋아요 유도 + 다음 영상 예고

### 표기 규칙
- 나레이션: 일반 텍스트 (TTS가 읽을 내용)
- 영상 지시: [영상 지시: 장면 설명] 형태
- 자막 하이라이트: **강조할 단어** 볼드 처리
- 효과음 지시: [효과음: 설명] 형태

### 문장 스타일
- 구어체 (방송 나레이션 느낌)
- 한 문장은 30자 이내 (TTS 호흡 단위)
- "~입니다", "~했습니다" 등 경어체 통일
- 전문 용어는 괄호로 쉽게 풀어서 설명
- 총 분량: 8~12분 (나레이션 기준 2,400~4,200자)`;

function parseArgs(): { topic: string; project: string } {
  const args = process.argv.slice(2);
  let topic = "";
  let project = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--topic" && args[i + 1]) {
      topic = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      project = args[++i];
    }
  }

  if (!topic || !project) {
    console.error(
      "사용법: npx tsx src/scripts/generate-script.ts --topic \"주제\" --project project-id"
    );
    process.exit(1);
  }

  return { topic, project };
}

async function main() {
  const { topic, project } = parseArgs();

  console.log(`주제: ${topic}`);
  console.log(`프로젝트: ${project}`);
  console.log("");

  // Ollama 상태 확인
  const isRunning = await checkOllamaStatus();
  if (!isRunning) {
    console.error(
      "Ollama가 실행되지 않고 있습니다. `ollama serve`로 시작하고 `ollama pull qwen3:30b`를 실행하세요."
    );
    process.exit(1);
  }

  // 프로젝트 디렉토리 생성
  const projectDir = path.resolve(
    __dirname,
    "../../projects",
    project
  );
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  console.log("대본 생성 중...");
  const startTime = Date.now();

  const result = await generateText(
    `다음 주제로 유튜브 영상 대본을 작성해 주세요:\n\n${topic}`,
    SYSTEM_PROMPT
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const outputPath = path.join(projectDir, "script.md");
  fs.writeFileSync(outputPath, result.text, "utf-8");

  const charCount = result.text.length;
  const estimatedMinutes = (charCount / 325).toFixed(1);

  console.log("");
  console.log(`완료! (${elapsed}초)`);
  console.log(`저장: ${outputPath}`);
  console.log(`글자수: ${charCount}자`);
  console.log(`예상 나레이션 시간: 약 ${estimatedMinutes}분 (분당 325자 기준)`);
}

main().catch((err) => {
  console.error("오류:", err.message);
  process.exit(1);
});
