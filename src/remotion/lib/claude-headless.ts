import { spawn, type SpawnOptions } from "child_process";
import * as path from "path";

/**
 * Headless wrapper around the Claude Code CLI (`claude -p ...`).
 *
 * Covered by the user's Claude Max Plan — never call the Anthropic API directly.
 * The CLI inherits the user's logged-in Max Plan session.
 *
 * Prereqs on the host:
 *   1. Claude Code CLI installed and on PATH.
 *   2. `claude /login` already run interactively at least once.
 */

export interface RunClaudeOptions {
  /** Working directory. Defaults to repo root — important so subagent files resolve. */
  cwd?: string;
  /** Hard timeout in ms. Default 10 minutes — script generation can be slow. */
  timeoutMs?: number;
  /**
   * Skip interactive permission prompts. Required for web-API spawn since no TTY.
   * Safe for this local project; do NOT enable on shared infra.
   */
  skipPermissions?: boolean;
  /** Extra env vars to merge onto the child process. */
  env?: NodeJS.ProcessEnv;
  /** Called with each stdout line (for progress logging). */
  onStdout?: (line: string) => void;
  /** Called with each stderr line. */
  onStderr?: (line: string) => void;
}

export interface RunClaudeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

const REPO_ROOT = path.resolve(__dirname, "../../..");

/** Find the installed `claude` binary — resolves on Windows and POSIX. */
function claudeCommand(): { command: string; shell: boolean } {
  return { command: "claude", shell: process.platform === "win32" };
}

/**
 * Spawn `claude -p "<prompt>"` headlessly. Resolves when the CLI exits.
 * The prompt is passed as a single argv entry, so shell quoting issues are
 * contained to Windows — which we mitigate by running under `shell: true`.
 */
export function runClaude(
  prompt: string,
  opts: RunClaudeOptions = {}
): Promise<RunClaudeResult> {
  const {
    cwd = REPO_ROOT,
    timeoutMs = 10 * 60_000,
    skipPermissions = true,
    env,
    onStdout,
    onStderr,
  } = opts;

  const { command, shell } = claudeCommand();
  const args: string[] = ["-p"];
  if (skipPermissions) args.push("--dangerously-skip-permissions");
  args.push(prompt);

  const spawnOpts: SpawnOptions = {
    cwd,
    shell,
    env: { ...process.env, ...(env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
  };

  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(command, args, spawnOpts);

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      stdout += text;
      if (onStdout) {
        for (const line of text.split(/\r?\n/)) if (line) onStdout(line);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      stderr += text;
      if (onStderr) {
        for (const line of text.split(/\r?\n/)) if (line) onStderr(line);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;
      if (killed) {
        reject(
          new Error(
            `claude -p timed out after ${timeoutMs}ms. stdout=${stdout.slice(-200)} stderr=${stderr.slice(-200)}`
          )
        );
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 1, durationMs });
    });
  });
}

/**
 * Convenience helper: run a pd-producer-style pipeline instruction.
 * The prompt should tell Claude Code which subagent to delegate to.
 */
export async function runAgentInstruction(
  instruction: string,
  opts: RunClaudeOptions = {}
): Promise<RunClaudeResult> {
  return runClaude(instruction, opts);
}
