import "server-only";
import * as fs from "fs";
import * as path from "path";
import {
  isProcessAlive,
  readProgress,
  updateProgress,
  type ProgressRecord,
} from "./spawn-helper";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

/** Heartbeats older than this mark the job as definitely dead. */
const STALE_HEARTBEAT_MS = 30 * 60_000;

let sweptOnce = false;

/**
 * Scan every project's progress.json on server startup. If a project has a
 * stage "running" (no finishedAt) but the PID no longer exists, or the
 * heartbeat is too old, mark it crashed. Users can then click "resume" in
 * the UI to relaunch that stage.
 *
 * Safe to call more than once — we guard with a module-level flag so the
 * same server instance doesn't keep re-sweeping on hot reload.
 */
export function sweepPipelines(): { swept: number; crashed: number } {
  if (sweptOnce) return { swept: 0, crashed: 0 };
  sweptOnce = true;

  if (!fs.existsSync(PROJECTS_DIR)) return { swept: 0, crashed: 0 };

  let swept = 0;
  let crashed = 0;

  for (const dirent of fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const projectDir = path.join(PROJECTS_DIR, dirent.name);
    const record = readProgress(projectDir);
    if (!record) continue;
    swept++;

    // Already clean (idle, finished, or already marked crashed).
    if (record.stage === "idle") continue;
    if (record.finishedAt) continue;

    const alive = isProcessAlive(record.pid);
    const lastBeat = record.lastHeartbeatAt ? Date.parse(record.lastHeartbeatAt) : 0;
    const stale = lastBeat > 0 && Date.now() - lastBeat > STALE_HEARTBEAT_MS;

    if (!alive || stale) {
      crashed++;
      updateProgress(projectDir, (r: ProgressRecord) => ({
        ...r,
        crashed: true,
        tail: [
          ...r.tail,
          `[sweep] server restart detected dead stage=${r.stage} pid=${r.pid ?? "?"} alive=${alive} stale=${stale}`,
        ].slice(-200),
      }));
    }
  }

  if (swept > 0) {
    console.log(`[pipeline-sweep] swept ${swept} project(s), ${crashed} marked crashed`);
  }

  return { swept, crashed };
}
