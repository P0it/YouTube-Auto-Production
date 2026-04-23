import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { STAGE_RUNNERS } from "@/lib/pipeline-stages";
import { validateResearch } from "@/lib/research-validator";
import { updateProgress } from "@/lib/spawn-helper";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

export type ProjectLanguage = "ko" | "en";

export interface ProjectMeta {
  id: string;
  theme: string;
  topic: string;
  language: ProjectLanguage;
  createdAt: string;
  status:
    | "researching"
    | "topic_selection"
    | "scripting"
    | "verifying"
    | "script_approval"
    | "image_generation"
    | "video_clips"
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

function writeMeta(projectDir: string, meta: ProjectMeta) {
  fs.writeFileSync(
    path.join(projectDir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf-8"
  );
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
      const research = validateResearch(d.name);
      return {
        id: d.name,
        files,
        meta,
        researchReady: research.ready,
        topicCount: research.topicCount,
      };
    })
    .sort((a, b) => {
      const aTime = a.meta?.createdAt ?? "0";
      const bTime = b.meta?.createdAt ?? "0";
      return bTime.localeCompare(aTime);
    });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, theme, language } = body as {
    id?: string;
    theme?: string;
    language?: ProjectLanguage;
  };

  if (!id || !id.trim()) {
    return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
  }

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

  const effectiveLanguage: ProjectLanguage = language === "en" ? "en" : "ko";

  const meta: ProjectMeta = {
    id: slug,
    theme: theme || "",
    topic: "",
    language: effectiveLanguage,
    createdAt: new Date().toISOString(),
    status: "researching",
  };
  writeMeta(projectDir, meta);

  // Raw data collection (YouTube EN + Google Trends KR) — short, then hand off
  // to the researcher-planner subagent for Korean topic curation.
  STAGE_RUNNERS.researchRaw.run({
    projectId: slug,
    projectDir,
    meta,
    onExit: (rawCode) => {
      if (rawCode !== 0) return;
      const latest = readMeta(projectDir);
      if (!latest) return;

      STAGE_RUNNERS.researchCurate.run({
        projectId: slug,
        projectDir,
        meta: latest,
        onExit: (curateCode) => {
          const m = readMeta(projectDir);
          if (!m) return;

          const validation = validateResearch(slug);

          // Claude exited 0 but the file is still a placeholder → CLI was
          // probably not authenticated or never actually called the subagent.
          if (curateCode === 0 && !validation.ready) {
            updateProgress(projectDir, (r) => ({
              ...r,
              crashed: true,
              tail: [
                ...r.tail,
                `[validate] research.md is not ready (placeholder=${validation.isPlaceholder}, topicCount=${validation.topicCount}). Keeping status=researching. Check: claude CLI installed & logged in?`,
              ].slice(-200),
            }));
            return;
          }

          if (curateCode !== 0) {
            updateProgress(projectDir, (r) => ({
              ...r,
              crashed: true,
              tail: [...r.tail, `[validate] claude -p exited ${curateCode}`].slice(-200),
            }));
            return;
          }

          if (validation.ready && m.status === "researching") {
            m.status = "topic_selection";
            writeMeta(projectDir, m);
          }
        },
      });
    },
  });

  return NextResponse.json({ ok: true, meta });
}
