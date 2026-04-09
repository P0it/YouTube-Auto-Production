import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

export interface ProjectMeta {
  id: string;
  theme: string;
  topic: string;
  createdAt: string;
  status:
    | "researching"
    | "topic_selection"
    | "scripting"
    | "verifying"
    | "script_approval"
    | "asset_check"
    | "tts"
    | "editing"
    | "shorts"
    | "complete";
}

function readMeta(projectDir: string): ProjectMeta | null {
  const metaPath = path.join(projectDir, "meta.json");
  if (!fs.existsSync(metaPath)) return null;
  return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
}

export async function GET() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return NextResponse.json([]);
  }

  const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const projects = dirs
    .filter((d) => d.isDirectory())
    .map((d) => {
      const projectPath = path.join(PROJECTS_DIR, d.name);
      const files = fs
        .readdirSync(projectPath)
        .filter((f) => !fs.statSync(path.join(projectPath, f)).isDirectory());
      const meta = readMeta(projectPath);
      return {
        id: d.name,
        files,
        meta,
      };
    })
    .sort((a, b) => {
      // Sort by createdAt descending (newest first)
      const aTime = a.meta?.createdAt ?? "0";
      const bTime = b.meta?.createdAt ?? "0";
      return bTime.localeCompare(aTime);
    });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, theme } = body;

  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }

  const projectDir = path.join(PROJECTS_DIR, id);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Create meta.json
  const meta: ProjectMeta = {
    id,
    theme: theme || "",
    topic: "",
    createdAt: new Date().toISOString(),
    status: "researching",
  };

  fs.writeFileSync(
    path.join(projectDir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf-8"
  );

  return NextResponse.json({ ok: true, meta });
}
