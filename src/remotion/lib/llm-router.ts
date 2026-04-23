import { generateText as ollamaGenerate, streamGenerate as ollamaStream } from "./llm-ollama";
import { runClaude } from "./claude-headless";

/**
 * Task classification used by CLI scripts and internal modules. Claude Code's
 * Max Plan covers the "claude-code" backend — we invoke it by spawning
 * `claude -p` headlessly, never the paid Anthropic API.
 */
export type LlmTask =
  | "research"
  | "script"
  | "fact-check"
  | "image-prompt"
  | "parse";

export type LlmStrategy = "hybrid" | "local-only" | "claude-code-only";

export interface LlmCallInput {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  /**
   * When routing to Claude Code headless, this lets the caller inject a
   * subagent hand-off ("Use the scriptwriter subagent for project X...")
   * instead of the plain system+prompt pair.
   */
  claudeInstruction?: string;
}

export interface LlmRouteDecision {
  backend: "claude-code" | "ollama";
}

function currentStrategy(): LlmStrategy {
  const raw = (process.env.LLM_STRATEGY ?? "hybrid").toLowerCase();
  if (raw === "local-only" || raw === "claude-code-only") return raw;
  return "hybrid";
}

export function routeFor(task: LlmTask): LlmRouteDecision {
  const strategy = currentStrategy();

  if (strategy === "local-only") return { backend: "ollama" };
  if (strategy === "claude-code-only") return { backend: "claude-code" };

  // hybrid — Claude Code (Max Plan) for the work that needs quality,
  // Ollama for cheap utility tasks.
  switch (task) {
    case "research":
    case "script":
    case "fact-check":
      return { backend: "claude-code" };
    case "image-prompt":
    case "parse":
    default:
      return { backend: "ollama" };
  }
}

export async function llm(task: LlmTask, input: LlmCallInput): Promise<string> {
  const route = routeFor(task);

  if (route.backend === "claude-code") {
    const instruction =
      input.claudeInstruction ??
      `SYSTEM:\n${input.system}\n\nUSER:\n${input.prompt}\n\nReply with the final answer only.`;
    const result = await runClaude(instruction, { timeoutMs: 15 * 60_000 });
    if (result.exitCode !== 0) {
      throw new Error(
        `claude -p failed (exit ${result.exitCode}). stderr: ${result.stderr.slice(-300)}`
      );
    }
    return result.stdout.trim();
  }

  const result = await ollamaGenerate(input.prompt, input.system, {
    temperature: input.temperature,
    num_predict: input.maxTokens,
  });
  return result.text;
}

export async function* llmStream(
  task: LlmTask,
  input: LlmCallInput
): AsyncGenerator<string, void, unknown> {
  const route = routeFor(task);

  if (route.backend === "claude-code") {
    // Headless streaming from `claude -p` is non-trivial (JSON events with --output-format).
    // For v1 we fall back to the non-streaming path.
    const text = await llm(task, input);
    yield text;
    return;
  }

  yield* ollamaStream(input.prompt, input.system, {
    temperature: input.temperature,
    num_predict: input.maxTokens,
  });
}
