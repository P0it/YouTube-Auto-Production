import * as fs from "fs";
import * as path from "path";
import { llm } from "../remotion/lib/llm-router";

const SYSTEM_PROMPT = `You are the head writer for a Korean-language philosophy & psychology YouTube channel.

Channel identity: quiet, reflective, intellectually serious. Every script follows the formula "shared everyday experience → academic explanation → real research cases → deep dive → application".

You MUST produce the entire script in Korean using exactly this 7-part skeleton with these exact headers (the downstream parser depends on them):

# 주제: {주제명}

## 파트 1: 훅 (0:00~0:30)
Open on a concrete everyday moment the Korean viewer has actually lived. First sentence = a scene, not a thesis.

## 파트 2: 도입 (0:30~1:30)
Reframe that moment as a question, then name the philosophical or psychological concept that will answer it. Promise what will be covered.

## 파트 3: 학문적 해석 (1:30~4:00)
Explain the core theory. Define jargon in parentheses on first use.

## 파트 4: 연구 사례 (4:00~7:00)
At least two real studies or classic experiments with author + year. Every claim carries an inline [출처: 저자 (연도), 논문·실험명] tag.

## 파트 5: 심화 (7:00~10:00)
Counter-examples, edge cases, modern life applications. Where does the theory break?

## 파트 6: 통합 (10:00~11:00)
Tie back to Part 1's opening moment. Leave the viewer with one philosophical question.

## 파트 7: 아우트로 (11:00~12:00)
Brief warm CTA. No shouting.

## Markup rules (strict)
- Narration: plain Korean text on its own lines.
- [영상 지시: 장면 설명] — never spoken, used by image generator.
- [출처: 저자 (연도), 논문명] — required in Part 4, never spoken.
- **단어** — 1–2 subtitle highlights per part max.

## Tone
- Korean honorific register (-입니다). No register slippage.
- Reflective, not sensational. No "놀랍게도", no "인생이 바뀝니다".
- Sentences ≤ 35 Korean characters for TTS breath.
- Total narration ≥ 2,800 Korean characters.

Output the script only — no preamble, no meta-commentary.`;

function parseArgs(): { topic: string; project: string } {
  const args = process.argv.slice(2);
  let topic = "";
  let project = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--topic" && args[i + 1]) topic = args[++i];
    else if (args[i] === "--project" && args[i + 1]) project = args[++i];
  }

  if (!topic || !project) {
    console.error(
      'Usage: npx tsx src/scripts/generate-script.ts --topic "주제" --project project-id'
    );
    process.exit(1);
  }

  return { topic, project };
}

async function main() {
  const { topic, project } = parseArgs();

  console.log(`Topic: ${topic}`);
  console.log(`Project: ${project}`);

  const projectDir = path.resolve(__dirname, "../../projects", project);
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

  console.log("Generating script via LLM router (task=script)...");
  const startTime = Date.now();

  const text = await llm("script", {
    system: SYSTEM_PROMPT,
    prompt: `다음 주제로 유튜브 영상 대본을 작성해 주세요:\n\n${topic}`,
    maxTokens: 8192,
    temperature: 0.75,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const outputPath = path.join(projectDir, "script.md");
  fs.writeFileSync(outputPath, text, "utf-8");

  const charCount = text.length;
  const estimatedMinutes = (charCount / 325).toFixed(1);

  console.log("");
  console.log(`Done in ${elapsed}s`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Characters: ${charCount}`);
  console.log(`Estimated narration: ~${estimatedMinutes} min (325 cpm)`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
