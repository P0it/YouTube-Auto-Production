import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

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

  if (!id || !id.trim()) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
  }

  // 디렉토리명으로 사용할 slug 생성 (공백→하이픈, 특수문자 제거)
  const slug = id
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[<>:"/\\|?*]/g, "");

  if (!slug) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }

  const projectDir = path.join(PROJECTS_DIR, slug);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Create meta.json
  const meta: ProjectMeta = {
    id: slug,
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

  // 리서치 스크립트 백그라운드 실행
  const rootDir = path.resolve(process.cwd(), "..");
  const scriptPath = path.join(rootDir, "src", "scripts", "research.ts");

  const args = ["tsx", scriptPath, "--project", slug];
  if (theme) {
    args.push("--theme", theme);
  }

  const child = spawn("npx", args, {
    cwd: rootDir,
    stdio: "ignore",
    detached: true,
    shell: true,
  });

  child.on("exit", (code) => {
    // 스크립트 완료 후 status를 topic_selection으로 변경
    const metaPath = path.join(projectDir, "meta.json");
    if (fs.existsSync(metaPath)) {
      const updatedMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      updatedMeta.status = code === 0 ? "topic_selection" : "researching";
      fs.writeFileSync(metaPath, JSON.stringify(updatedMeta, null, 2), "utf-8");
    }
  });

  child.unref();

  return NextResponse.json({ ok: true, meta });
}
