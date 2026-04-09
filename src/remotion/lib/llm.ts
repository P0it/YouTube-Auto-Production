import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface LlmConfig {
  model: string;
  endpoint: string;
  generateParams: {
    temperature: number;
    top_p: number;
    num_predict: number;
    repeat_penalty: number;
  };
}

export interface GenerateResult {
  text: string;
  totalDuration: number;
  promptEvalCount: number;
  evalCount: number;
}

/** config/llm.json 로드, OLLAMA_ENDPOINT 환경변수로 오버라이드 가능 */
export function loadConfig(): LlmConfig {
  const configPath = path.resolve(__dirname, "../../../config/llm.json");
  const config: LlmConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (process.env.OLLAMA_ENDPOINT) {
    config.endpoint = process.env.OLLAMA_ENDPOINT;
  }

  return config;
}

/** Ollama 서버 상태 확인 */
export async function checkOllamaStatus(): Promise<boolean> {
  const config = loadConfig();
  try {
    const res = await fetch(config.endpoint);
    return res.ok;
  } catch {
    return false;
  }
}

/** 텍스트 생성 (비스트리밍) */
export async function generateText(
  prompt: string,
  system?: string,
  options?: Partial<LlmConfig["generateParams"]>
): Promise<GenerateResult> {
  const config = loadConfig();

  const body: Record<string, unknown> = {
    model: config.model,
    prompt,
    stream: false,
    options: { ...config.generateParams, ...options },
  };

  if (system) {
    body.system = system;
  }

  const res = await fetch(`${config.endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  return {
    text: data.response ?? "",
    totalDuration: data.total_duration ?? 0,
    promptEvalCount: data.prompt_eval_count ?? 0,
    evalCount: data.eval_count ?? 0,
  };
}

/** 텍스트 생성 (스트리밍) — Ollama NDJSON을 토큰 단위로 yield */
export async function* streamGenerate(
  prompt: string,
  system?: string,
  options?: Partial<LlmConfig["generateParams"]>
): AsyncGenerator<string, void, unknown> {
  const config = loadConfig();

  const body: Record<string, unknown> = {
    model: config.model,
    prompt,
    stream: true,
    options: { ...config.generateParams, ...options },
  };

  if (system) {
    body.system = system;
  }

  const res = await fetch(`${config.endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line);
      if (parsed.response) {
        yield parsed.response;
      }
      if (parsed.done) return;
    }
  }
}
