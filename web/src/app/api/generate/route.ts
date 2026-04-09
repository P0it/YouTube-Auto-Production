import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { streamGenerate } from "@/lib/ollama";
import { SCRIPTWRITER_SYSTEM, FACT_CHECKER_SYSTEM } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  const { projectId, topic, mode } = await request.json();

  if (!projectId || !mode) {
    return new Response("projectId and mode are required", { status: 400 });
  }

  const projectsDir = path.resolve(process.cwd(), "..", "projects");
  const projectDir = path.join(projectsDir, projectId);

  let prompt: string;
  let system: string;
  let outputFile: string;

  if (mode === "generate") {
    if (!topic) {
      return new Response("topic is required for generate mode", {
        status: 400,
      });
    }
    prompt = `다음 주제로 유튜브 영상 대본을 작성해 주세요:\n\n${topic}`;
    system = SCRIPTWRITER_SYSTEM;
    outputFile = "script.md";
  } else if (mode === "fact-check") {
    const scriptPath = path.join(projectDir, "script.md");
    if (!fs.existsSync(scriptPath)) {
      return new Response("script.md not found", { status: 404 });
    }
    const scriptContent = fs.readFileSync(scriptPath, "utf-8");
    prompt = `다음 대본을 검증해 주세요:\n\n${scriptContent}`;
    system = FACT_CHECKER_SYSTEM;
    outputFile = "script-verified.md";
  } else {
    return new Response("Invalid mode", { status: 400 });
  }

  try {
    const ollamaStream = await streamGenerate(prompt, system);

    // Wrap the stream to save accumulated text when done
    const reader = ollamaStream.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let accumulated = "";

    const wrappedStream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          // Save the accumulated text
          if (accumulated && projectDir) {
            if (!fs.existsSync(projectDir)) {
              fs.mkdirSync(projectDir, { recursive: true });
            }
            fs.writeFileSync(
              path.join(projectDir, outputFile),
              accumulated,
              "utf-8"
            );
          }
          controller.close();
          return;
        }

        // Parse the SSE data to accumulate text
        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.token) {
                accumulated += parsed.token;
              }
            } catch {
              // skip
            }
          }
        }

        controller.enqueue(value);
      },
    });

    return new Response(wrappedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return new Response(
      `Ollama 연결 실패: ${message}\nOllama가 실행 중인지 확인하세요 (ollama serve)`,
      { status: 502 }
    );
  }
}
