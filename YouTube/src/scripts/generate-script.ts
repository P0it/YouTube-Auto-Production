import * as fs from "fs";
import * as path from "path";
import { generateScript } from "../remotion/lib/llm";

async function main() {
  const args = process.argv.slice(2);
  const topicIndex = args.indexOf("--topic");
  const projectIndex = args.indexOf("--project");

  if (topicIndex === -1) {
    console.error("사용법: npm run generate -- --topic '주제' [--project 프로젝트ID]");
    console.error("예시: npm run generate -- --topic '한국 치킨집 수 > 전 세계 맥도날드 수'");
    process.exit(1);
  }

  const topic = args[topicIndex + 1];
  const projectId =
    projectIndex !== -1
      ? args[projectIndex + 1]
      : new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const projectDir = path.resolve(__dirname, `../../projects/${projectId}`);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, "assets"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "output/audio"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "output/video/shorts"), { recursive: true });

  // 리서치 파일이 있으면 로드
  let researchContent = "";
  const researchPath = path.resolve(
    __dirname,
    "../../projects/trend-test-v3/research.md"
  );
  if (fs.existsSync(researchPath)) {
    const research = fs.readFileSync(researchPath, "utf-8");
    // 해당 주제의 상세 섹션 추출
    const topicSection = extractTopicSection(research, topic);
    researchContent = topicSection || `주제: ${topic}`;
  }

  console.log(`\n프로젝트 ID: ${projectId}`);
  console.log(`주제: ${topic}`);
  console.log(`대본 생성 중...\n`);

  const script = await generateScript(topic, researchContent);

  const scriptPath = path.join(projectDir, "script.md");
  fs.writeFileSync(scriptPath, script, "utf-8");

  console.log(`\n대본 저장 완료: ${scriptPath}`);
  console.log(`글자 수: ${script.length}자`);
  console.log(`\n다음 단계: npm run fact-check -- --project ${projectId}`);
}

function extractTopicSection(research: string, topic: string): string {
  const lines = research.split("\n");
  let capturing = false;
  let result: string[] = [];

  for (const line of lines) {
    if (line.startsWith("### ") && line.includes(topic.slice(0, 10))) {
      capturing = true;
      result.push(line);
      continue;
    }
    if (capturing && line.startsWith("### ") && !line.includes(topic.slice(0, 10))) {
      break;
    }
    if (capturing) {
      result.push(line);
    }
  }

  return result.join("\n");
}

main().catch((err) => {
  console.error("대본 생성 실패:", err.message);
  process.exit(1);
});
