import * as fs from "fs";
import * as path from "path";

interface LlmConfig {
  model: string;
  endpoint: string;
  generateParams: {
    temperature: number;
    top_p: number;
    num_predict: number;
    repeat_penalty: number;
  };
}

export function getConfig(): LlmConfig {
  const configPath = path.resolve(process.cwd(), "..", "config", "llm.json");
  const config: LlmConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (process.env.OLLAMA_ENDPOINT) {
    config.endpoint = process.env.OLLAMA_ENDPOINT;
  }

  return config;
}

export async function checkHealth(): Promise<boolean> {
  const config = getConfig();
  try {
    const res = await fetch(config.endpoint);
    return res.ok;
  } catch {
    return false;
  }
}

export async function streamGenerate(
  prompt: string,
  system: string
): Promise<ReadableStream<Uint8Array>> {
  const config = getConfig();

  const res = await fetch(`${config.endpoint}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt,
      system,
      stream: true,
      options: config.generateParams,
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  if (!res.body) {
    throw new Error("No response body");
  }

  const reader = res.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ token: parsed.response })}\n\n`)
              );
            }
            if (parsed.done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    },
  });
}
