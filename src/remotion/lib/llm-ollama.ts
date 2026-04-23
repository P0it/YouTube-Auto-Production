import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

export interface OllamaConfig {
  model: string;
  endpoint: string;
  generateParams: {
    temperature: number;
    top_p: number;
    num_predict: number;
    repeat_penalty: number;
  };
}

export interface OllamaGenerateResult {
  text: string;
  totalDuration: number;
  promptEvalCount: number;
  evalCount: number;
}

export function loadOllamaConfig(): OllamaConfig {
  const configPath = path.resolve(__dirname, "../../../config/llm.json");
  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Partial<OllamaConfig> & {
    ollama?: Partial<OllamaConfig>;
  };

  const ollamaSection = raw.ollama ?? {};
  const config: OllamaConfig = {
    model: ollamaSection.model ?? raw.model ?? "qwen3:30b",
    endpoint: ollamaSection.endpoint ?? raw.endpoint ?? "http://localhost:11434",
    generateParams: {
      temperature: 0.7,
      top_p: 0.9,
      num_predict: 4096,
      repeat_penalty: 1.1,
      ...(raw.generateParams ?? {}),
      ...(ollamaSection.generateParams ?? {}),
    },
  };

  if (process.env.OLLAMA_ENDPOINT) config.endpoint = process.env.OLLAMA_ENDPOINT;
  if (process.env.OLLAMA_MODEL) config.model = process.env.OLLAMA_MODEL;

  return config;
}

export async function checkOllamaStatus(): Promise<boolean> {
  const config = loadOllamaConfig();
  try {
    const res = await fetch(config.endpoint);
    return res.ok;
  } catch {
    return false;
  }
}

export async function generateText(
  prompt: string,
  system?: string,
  options?: Partial<OllamaConfig["generateParams"]>
): Promise<OllamaGenerateResult> {
  const config = loadOllamaConfig();

  const body: Record<string, unknown> = {
    model: config.model,
    prompt,
    stream: false,
    options: { ...config.generateParams, ...options },
  };

  if (system) body.system = system;

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

export async function* streamGenerate(
  prompt: string,
  system?: string,
  options?: Partial<OllamaConfig["generateParams"]>
): AsyncGenerator<string, void, unknown> {
  const config = loadOllamaConfig();

  const body: Record<string, unknown> = {
    model: config.model,
    prompt,
    stream: true,
    options: { ...config.generateParams, ...options },
  };

  if (system) body.system = system;

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
      if (parsed.response) yield parsed.response;
      if (parsed.done) return;
    }
  }
}
