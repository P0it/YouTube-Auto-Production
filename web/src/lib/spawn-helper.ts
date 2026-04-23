import "server-only";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type StageKey =
  | "research:raw"
  | "research:curate"
  | "scripting:claude"
  | "image_generation"
  | "video_clips"
  | "tts"
  | "editing"
  | "shorts:claude"
  | "regenerate_image"
  | "regenerate_clip";

export interface ProgressRecord {
  stage: StageKey | "idle";
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  pid?: number;
  logPath?: string;
  lastHeartbeatAt?: string;
  /** Convenience: crashed = process died before finishedAt was written. */
  crashed?: boolean;
  /** Last tail lines (bounded) for UI display. */
  tail: string[];
  /** Derived counts filled by the progress endpoint, not by the spawner. */
  counts?: { images?: number; clips?: number; audio?: number };
}

const TAIL_MAX_LINES = 200;

export function progressFilePath(projectDir: string): string {
  return path.join(projectDir, "output", "progress.json");
}

/**
 * Locate an executable by walking PATH. On Windows, commands are commonly
 * shipped as `.cmd` / `.bat` shims (e.g. `claude.cmd` from npm, `npx.cmd`).
 * `spawn(cmd)` with `shell: false` only finds `.exe` by default, so we
 * resolve the full path ourselves. This lets us avoid `shell: true`, which
 * on Windows both pops a visible cmd.exe window AND breaks stdin piping
 * because cmd.exe doesn't forward its stdin to the child it spawned.
 */
export function resolveExecutable(command: string): string {
  if (process.platform !== "win32") return command;
  if (path.isAbsolute(command) && fs.existsSync(command)) return command;

  const pathEnv = process.env.PATH ?? "";
  const pathExtRaw = process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  const exts = ["", ...pathExtRaw.split(";").map((e) => e.trim()).filter(Boolean)];

  for (const dir of pathEnv.split(";")) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // skip unreadable paths
      }
    }
  }
  return command; // fall through; spawn will fail with ENOENT, which is informative
}

export function logFilePath(projectDir: string, stage: StageKey): string {
  return path.join(projectDir, "output", "logs", `${stage.replace(/[:/\\]/g, "_")}.log`);
}

export function readProgress(projectDir: string): ProgressRecord | null {
  const p = progressFilePath(projectDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as ProgressRecord;
  } catch {
    return null;
  }
}

export function writeProgress(projectDir: string, record: ProgressRecord): void {
  fs.mkdirSync(path.dirname(progressFilePath(projectDir)), { recursive: true });
  fs.writeFileSync(progressFilePath(projectDir), JSON.stringify(record, null, 2), "utf-8");
}

export function updateProgress(
  projectDir: string,
  updater: (r: ProgressRecord) => ProgressRecord
): void {
  const current =
    readProgress(projectDir) ?? ({ stage: "idle", tail: [] } as ProgressRecord);
  writeProgress(projectDir, updater(current));
}

export interface SpawnStageOptions {
  projectDir: string;
  stage: StageKey;
  /** The actual command + args to run. If `command: "node"` the helper will use `npx`. */
  command: "npx" | "claude";
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  onExit?: (exitCode: number) => void;
  /**
   * If set, the string is written to the child's stdin and then the stream
   * is closed. Use this to pass long prompts to `claude -p` without fighting
   * Windows shell escaping on argv.
   */
  stdinContent?: string;
}

export interface SpawnStageResult {
  pid?: number;
  logPath: string;
  child: ChildProcess;
}

/**
 * Launch a pipeline stage as a detached background process.
 *
 * Key guarantees:
 *  - `detached: true` + `child.unref()` so the child survives if the Next.js
 *    server restarts or crashes. The child will keep writing progress.json.
 *  - Stdout/stderr are teed to a log file at `output/logs/{stage}.log`
 *    (full transcript preserved across server restarts) and to the
 *    `progress.json.tail` field (compact in-memory window for the UI).
 *  - Heartbeats: every 10s while running we bump `lastHeartbeatAt` so the
 *    sweep logic can distinguish "running" vs "silently dead".
 */
export function spawnStage(opts: SpawnStageOptions): SpawnStageResult {
  const { projectDir, stage, command, args, cwd, env, onExit, stdinContent } = opts;

  const logPath = logFilePath(projectDir, stage);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  writeProgress(projectDir, {
    stage,
    startedAt: new Date().toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
    tail: [
      `[start] ${command} ${args.join(" ")}${stdinContent ? ` (stdin: ${stdinContent.length} chars)` : ""}`,
    ],
    logPath: path.relative(cwd, logPath).replace(/\\/g, "/"),
  });
  logStream.write(
    `\n===== ${new Date().toISOString()} ${stage} =====\n${command} ${args.join(" ")}\n`
  );
  if (stdinContent) {
    logStream.write(`[stdin] ${stdinContent.slice(0, 500)}${stdinContent.length > 500 ? "..." : ""}\n`);
  }

  // Resolve .cmd / .exe explicitly on Windows so we don't need `shell: true`,
  // which would (a) pop a visible cmd.exe window and (b) swallow stdin.
  const resolved = resolveExecutable(command);

  const child = spawn(resolved, args, {
    cwd,
    stdio: [stdinContent ? "pipe" : "ignore", "pipe", "pipe"],
    detached: true,
    shell: false,
    windowsHide: true,
    env: { ...process.env, ...(env ?? {}) },
  });

  if (stdinContent && child.stdin) {
    child.stdin.end(stdinContent, "utf-8");
  }

  // pid available synchronously after spawn unless the binary is missing;
  // update progress with it so sweep can check liveness later.
  if (child.pid) {
    updateProgress(projectDir, (r) => ({ ...r, pid: child.pid }));
  }

  const appendTail = (line: string) => {
    updateProgress(projectDir, (r) => ({
      ...r,
      tail: [...r.tail, line].slice(-TAIL_MAX_LINES),
      lastHeartbeatAt: new Date().toISOString(),
    }));
  };

  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8");
    logStream.write(text);
    for (const line of text.split(/\r?\n/)) if (line) appendTail(line);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8");
    logStream.write(text);
    for (const line of text.split(/\r?\n/)) if (line) appendTail(`[stderr] ${line}`);
  });

  // Heartbeat loop — visible to sweep even during long silent jobs like Veo.
  const heartbeat = setInterval(() => {
    updateProgress(projectDir, (r) => ({
      ...r,
      lastHeartbeatAt: new Date().toISOString(),
    }));
  }, 10_000);

  child.on("exit", (code) => {
    clearInterval(heartbeat);
    logStream.end();
    updateProgress(projectDir, (r) => ({
      ...r,
      finishedAt: new Date().toISOString(),
      exitCode: code ?? 1,
      crashed: false,
      tail: [...r.tail, `[exit] ${code ?? 1}`].slice(-TAIL_MAX_LINES),
    }));
    onExit?.(code ?? 1);
  });

  child.on("error", (err) => {
    clearInterval(heartbeat);
    logStream.write(`[error] ${err.message}\n`);
    logStream.end();
    updateProgress(projectDir, (r) => ({
      ...r,
      finishedAt: new Date().toISOString(),
      exitCode: 1,
      crashed: true,
      tail: [...r.tail, `[error] ${err.message}`].slice(-TAIL_MAX_LINES),
    }));
    onExit?.(1);
  });

  // Decouple from the Next.js server process lifetime.
  child.unref();

  return {
    pid: child.pid,
    logPath,
    child,
  };
}

/** True iff a process with `pid` is currently alive (best-effort, cross-platform). */
export function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    // Signal 0 doesn't actually kill — it just probes if the PID exists.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
