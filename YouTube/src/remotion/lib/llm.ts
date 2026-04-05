import * as fs from "fs";
import * as path from "path";

interface LLMConfig {
  provider: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

function loadConfig(): LLMConfig {
  const configPath = path.resolve(__dirname, "../../../config/llm.json");
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

interface OllamaResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
}

/** Ollama API로 텍스트 생성 */
export async function generate(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const config = loadConfig();

  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OllamaResponse;
  return data.message.content;
}

/** 에이전트 시스템 프롬프트 로드 */
export function loadAgentPrompt(agentName: string): string {
  const agentPath = path.resolve(
    __dirname,
    `../../../.claude/agents/${agentName}.md`
  );
  return fs.readFileSync(agentPath, "utf-8");
}

/** 대본 생성 */
export async function generateScript(
  topic: string,
  researchContent: string
): Promise<string> {
  const systemPrompt = loadAgentPrompt("scriptwriter");

  const userPrompt = `다음 주제로 8~12분 분량의 유튜브 영상 대본을 작성해주세요.

## 주제
${topic}

## 리서치 자료
${researchContent}

## 요구사항
- 대본 형식 규칙을 반드시 준수하세요
- 파트별로 시간 표기를 포함하세요
- 나레이션, [영상 지시], **하이라이트** 구분을 명확히 해주세요
- 총 나레이션 분량이 8분(약 2,400자) 이상이어야 합니다`;

  return generate(systemPrompt, userPrompt);
}

/** 팩트체크 */
export async function factCheck(scriptContent: string): Promise<string> {
  const systemPrompt = loadAgentPrompt("fact-checker");

  const userPrompt = `다음 대본을 검증해주세요.

## 대본
${scriptContent}

## 요구사항
1. 수정 사항 표를 작성하세요 (심각도, 위치, 원문, 수정, 근거)
2. 검증 통계를 제공하세요 (검증 항목 수, 수정 건수, 전체 글자수, 예상 나레이션 시간)
3. 수정이 반영된 전체 대본을 제공하세요`;

  return generate(systemPrompt, userPrompt);
}
