import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { isProcessAlive, readProgress, type ProgressRecord } from "@/lib/spawn-helper";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

/** Heartbeat older than this = the child process is almost certainly dead. */
const STALE_HEARTBEAT_MS = 30 * 60_000;

function projectDir(id: string) {
  return path.join(PROJECTS_DIR, id);
}

function computeCounts(id: string): ProgressRecord["counts"] {
  const dir = projectDir(id);
  const imagesMetaPath = path.join(dir, "assets", "generated", "metadata.json");
  const clipsMetaPath = path.join(dir, "assets", "clips", "metadata.json");
  const audioManifestPath = path.join(dir, "output", "audio", "manifest.json");

  const countArray = (p: string): number => {
    if (!fs.existsSync(p)) return 0;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, "utf-8"));
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };
  const countSegments = (p: string): number => {
    if (!fs.existsSync(p)) return 0;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, "utf-8")) as { segments?: unknown[] };
      return Array.isArray(parsed.segments) ? parsed.segments.length : 0;
    } catch {
      return 0;
    }
  };

  return {
    images: countArray(imagesMetaPath),
    clips: countArray(clipsMetaPath),
    audio: countSegments(audioManifestPath),
  };
}

function deriveLiveness(record: ProgressRecord): ProgressRecord {
  // If the stage already exited, respect that.
  if (record.finishedAt) return record;

  // Still running? Check PID and heartbeat.
  const alive = isProcessAlive(record.pid);
  const lastBeat = record.lastHeartbeatAt ? Date.parse(record.lastHeartbeatAt) : 0;
  const staleBeat = lastBeat > 0 && Date.now() - lastBeat > STALE_HEARTBEAT_MS;

  if (!alive || staleBeat) {
    return {
      ...record,
      crashed: true,
      tail: [...record.tail, `[crash-detected] pid=${record.pid ?? "?"} alive=${alive} stale=${staleBeat}`].slice(-200),
    };
  }
  return record;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const raw = readProgress(projectDir(id)) ?? ({ stage: "idle", tail: [] } as ProgressRecord);
  const record = deriveLiveness(raw);
  record.counts = computeCounts(id);
  return NextResponse.json(record);
}
