import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

const OLLAMA_BASE_URL = "http://localhost:11434";
const CONFIG_PATH = path.resolve(process.cwd(), "../config/llm.json");
const AGENTS_PATH = path.resolve(process.cwd(), "../.claude/agents");

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function loadAgentPrompt(name: string): string {
  return fs.readFileSync(path.join(AGENTS_PATH, `${name}.md`), "utf-8");
}

export async function POST(request: NextRequest) {
  const { topic, research, mode } = await request.json();

  const config = loadConfig();
  const agentName = mode === "fact-check" ? "fact-checker" : "scriptwriter";
  const systemPrompt = loadAgentPrompt(agentName);

  let userPrompt: string;
  if (mode === "fact-check") {
    userPrompt = `다음 대본을 검증해주세요.\n\n## 대본\n${topic}\n\n## 요구사항\n1. 수정 사항 표를 작성하세요\n2. 검증 통계를 제공하세요\n3. 수정이 반영된 전체 대본을 제공하세요`;
  } else {
    userPrompt = `다음 주제로 8~12분 분량의 유튜브 영상 대본을 작성해주세요.\n\n## 주제\n${topic}\n\n## 리서치 자료\n${research || "없음"}\n\n## 요구사항\n- 대본 형식 규칙을 반드시 준수하세요\n- 파트별로 시간 표기를 포함하세요\n- 나레이션, [영상 지시], **하이라이트** 구분을 명확히 해주세요\n- 총 나레이션 분량이 8분(약 2,400자) 이상이어야 합니다`;
  }

  const response = await fetch(`${config.baseUrl || OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    }),
  });

  if (!response.ok || !response.body) {
    return Response.json(
      { error: `Ollama 연결 실패: ${response.statusText}` },
      { status: 502 }
    );
  }

  // Stream the response
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: json.message.content })}\n\n`)
              );
            }
            if (json.done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch {
            // skip invalid JSON
          }
        }
      }

      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
