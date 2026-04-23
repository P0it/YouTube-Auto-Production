import "server-only";
import * as path from "path";
import type { ProjectMeta } from "@/app/api/projects/route";
import { spawnStage, type StageKey } from "@/lib/spawn-helper";

const REPO_ROOT = path.resolve(process.cwd(), "..");

interface StageRunContext {
  projectId: string;
  projectDir: string;
  meta: ProjectMeta;
  onExit: (exitCode: number) => void;
}

export interface StageRunner {
  key: StageKey;
  /** Status shown on the project while this stage is running. */
  runningStatus: ProjectMeta["status"];
  run: (ctx: StageRunContext) => void;
}

/**
 * Launch one Node CLI script (image generation, TTS, render, ...) as a
 * detached background process that updates meta.status when it exits.
 */
function nodeScriptRunner(
  key: StageKey,
  runningStatus: ProjectMeta["status"],
  scriptRelative: string,
  buildArgs: (ctx: StageRunContext) => string[]
): StageRunner {
  return {
    key,
    runningStatus,
    run: (ctx) => {
      const scriptPath = path.join(REPO_ROOT, scriptRelative);
      spawnStage({
        projectDir: ctx.projectDir,
        stage: key,
        command: "npx",
        args: ["tsx", scriptPath, ...buildArgs(ctx)],
        cwd: REPO_ROOT,
        onExit: ctx.onExit,
      });
    },
  };
}

/**
 * Launch `claude -p --dangerously-skip-permissions` detached, feeding the
 * prompt via stdin.
 *
 * Why stdin instead of argv:
 *   On Windows, `spawn("claude", [..., longPrompt], { shell: true })` expands
 *   to `cmd.exe /d /s /c "claude -p --dangerously-skip-permissions longPrompt"`
 *   but Node does NOT automatically quote argv entries that contain spaces,
 *   so the long prompt gets split by cmd.exe on whitespace. Claude receives
 *   garbage argv, ignores it, drops into interactive mode with a closed stdin,
 *   and exits 0 within seconds having done nothing. stdin delivery sidesteps
 *   the shell entirely.
 */
function claudeRunner(
  key: StageKey,
  runningStatus: ProjectMeta["status"],
  buildInstruction: (ctx: StageRunContext) => string
): StageRunner {
  return {
    key,
    runningStatus,
    run: (ctx) => {
      const instruction = buildInstruction(ctx);
      spawnStage({
        projectDir: ctx.projectDir,
        stage: key,
        command: "claude",
        args: ["-p", "--dangerously-skip-permissions"],
        stdinContent: instruction,
        cwd: REPO_ROOT,
        env: { FACT_CHECK_MODE: process.env.FACT_CHECK_MODE ?? "full" } as unknown as NodeJS.ProcessEnv,
        onExit: ctx.onExit,
      });
    },
  };
}

export const STAGE_RUNNERS = {
  researchRaw: nodeScriptRunner(
    "research:raw",
    "researching",
    "src/scripts/research.ts",
    ({ projectId, meta }) => {
      const args = ["--project", projectId, "--language", meta.language ?? "ko"];
      if (meta.theme) args.push("--theme", meta.theme);
      return args;
    }
  ),

  researchCurate: claudeRunner(
    "research:curate",
    "researching",
    ({ projectId }) =>
      `Use the researcher-planner subagent for project \`${projectId}\`. Read projects/${projectId}/raw-trends.json (foreignReferences + koreanContext + notesForPlanner) and produce the 7-column Korean topic candidate table at projects/${projectId}/research.md. Strictly follow the anti-copy rule in the agent definition. When done, update projects/${projectId}/meta.json status to "topic_selection".`
  ),

  scripting: claudeRunner(
    "scripting:claude",
    "scripting",
    ({ projectId, meta }) =>
      `Use the scriptwriter subagent to write projects/${projectId}/script.md for topic "${meta.topic}" (read projects/${projectId}/research.md for context). Produce the 7-part Korean structure with 5–10 [영상 지시: ...] per part and [출처: ...] in Part 4. Then use the fact-checker subagent (mode: ${process.env.FACT_CHECK_MODE ?? "full"}) to produce projects/${projectId}/script-verified.md. When both files exist, update projects/${projectId}/meta.json status to "script_approval".`
  ),

  imageGeneration: nodeScriptRunner(
    "image_generation",
    "image_generation",
    "src/scripts/generate-images.ts",
    ({ projectId }) => ["--project", projectId]
  ),

  videoClips: nodeScriptRunner(
    "video_clips",
    "video_clips",
    "src/scripts/generate-video-clips.ts",
    ({ projectId }) => ["--project", projectId]
  ),

  tts: nodeScriptRunner(
    "tts",
    "tts",
    "src/scripts/generate-tts.ts",
    ({ projectId }) => ["--project", projectId]
  ),

  editing: nodeScriptRunner(
    "editing",
    "editing",
    "src/scripts/render-video.ts",
    ({ projectId }) => ["--project", projectId]
  ),

  shorts: claudeRunner(
    "shorts:claude",
    "shorts",
    ({ projectId }) =>
      `Use the shorts-creator subagent for project \`${projectId}\`. Produce 3–5 shorts into projects/${projectId}/output/video/shorts/. When done, update projects/${projectId}/meta.json status to "complete".`
  ),
} as const satisfies Record<string, StageRunner>;

/**
 * Given the CURRENT meta.status of a paused/crashed project, returns the
 * stage that should be (re)run to move it forward. For user-checkpoint
 * statuses it returns null — the user has to click a button, not resume.
 */
export function stageRunnerForStatus(
  status: ProjectMeta["status"]
): StageRunner | null {
  switch (status) {
    case "researching":
      // Ambiguous — raw or curate? We resume from curate because raw is fast
      // and usually done; if raw is missing, the curate subagent will notice.
      return STAGE_RUNNERS.researchCurate;
    case "scripting":
    case "verifying":
      return STAGE_RUNNERS.scripting;
    case "image_generation":
      return STAGE_RUNNERS.imageGeneration;
    case "video_clips":
      return STAGE_RUNNERS.videoClips;
    case "tts":
      return STAGE_RUNNERS.tts;
    case "editing":
      return STAGE_RUNNERS.editing;
    case "shorts":
      return STAGE_RUNNERS.shorts;
    case "topic_selection":
    case "script_approval":
    case "asset_check":
    case "complete":
    default:
      return null;
  }
}
