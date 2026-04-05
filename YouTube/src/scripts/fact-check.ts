import * as fs from "fs";
import * as path from "path";
import { factCheck } from "../remotion/lib/llm";

async function main() {
  const args = process.argv.slice(2);
  const projectIndex = args.indexOf("--project");

  if (projectIndex === -1) {
    console.error("사용법: npm run fact-check -- --project 프로젝트ID");
    process.exit(1);
  }

  const projectId = args[projectIndex + 1];
  const projectDir = path.resolve(__dirname, `../../projects/${projectId}`);
  const scriptPath = path.join(projectDir, "script.md");

  if (!fs.existsSync(scriptPath)) {
    console.error(`대본 파일을 찾을 수 없습니다: ${scriptPath}`);
    console.error("먼저 npm run generate 를 실행하세요.");
    process.exit(1);
  }

  const scriptContent = fs.readFileSync(scriptPath, "utf-8");

  console.log(`\n프로젝트 ID: ${projectId}`);
  console.log(`대본 파일: ${scriptPath}`);
  console.log(`팩트체크 중...\n`);

  const result = await factCheck(scriptContent);

  const verifiedPath = path.join(projectDir, "script-verified.md");
  fs.writeFileSync(verifiedPath, result, "utf-8");

  console.log(`\n검증 완료: ${verifiedPath}`);
  console.log(`\n다음 단계: ElevenLabs 음성 설정 후 TTS 생성`);
}

main().catch((err) => {
  console.error("팩트체크 실패:", err.message);
  process.exit(1);
});
