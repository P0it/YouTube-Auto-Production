import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { ProjectMeta } from "../route";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");
const ALLOWED_FILES = [
  "research.md",
  "script.md",
  "script-verified.md",
  "meta.json",
];

function getProjectDir(id: string) {
  return path.join(PROJECTS_DIR, id);
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

// GET: Read project file or list assets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = request.nextUrl.searchParams.get("file");
  const action = request.nextUrl.searchParams.get("action");

  const projectDir = getProjectDir(id);

  // List assets
  if (action === "assets") {
    const assetsDir = path.join(projectDir, "assets");
    if (!fs.existsSync(assetsDir)) {
      return NextResponse.json({ images: [], videos: [] });
    }
    const imagesDir = path.join(assetsDir, "images");
    const videosDir = path.join(assetsDir, "videos");
    const images = fs.existsSync(imagesDir)
      ? fs.readdirSync(imagesDir).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      : [];
    const videos = fs.existsSync(videosDir)
      ? fs.readdirSync(videosDir).filter((f) => /\.(mp4|mov|webm)$/i.test(f))
      : [];
    return NextResponse.json({ images, videos });
  }

  // Read meta
  if (file === "meta.json") {
    const meta = readMeta(projectDir);
    return NextResponse.json({ content: meta ? JSON.stringify(meta, null, 2) : "", meta });
  }

  if (!file || !ALLOWED_FILES.includes(file)) {
    return new Response("Invalid file parameter", { status: 400 });
  }

  const filePath = path.join(projectDir, file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ content: "" });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return NextResponse.json({ content });
}

// PUT: Update file or pipeline status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const projectDir = getProjectDir(id);

  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Update pipeline status
  if (body.action === "update_status") {
    const meta = readMeta(projectDir);
    if (!meta) {
      return NextResponse.json({ error: "No meta.json found" }, { status: 404 });
    }
    meta.status = body.status;
    if (body.topic) meta.topic = body.topic;
    writeMeta(projectDir, meta);
    return NextResponse.json({ ok: true, meta });
  }

  // Select topic from research
  if (body.action === "select_topic") {
    const meta = readMeta(projectDir);
    if (!meta) {
      return NextResponse.json({ error: "No meta.json found" }, { status: 404 });
    }
    meta.topic = body.topic;
    meta.status = "scripting";
    writeMeta(projectDir, meta);
    return NextResponse.json({ ok: true, meta });
  }

  // Approve script
  if (body.action === "approve_script") {
    const meta = readMeta(projectDir);
    if (!meta) {
      return NextResponse.json({ error: "No meta.json found" }, { status: 404 });
    }
    meta.status = "asset_check";
    writeMeta(projectDir, meta);
    return NextResponse.json({ ok: true, meta });
  }

  // Confirm assets
  if (body.action === "confirm_assets") {
    const meta = readMeta(projectDir);
    if (!meta) {
      return NextResponse.json({ error: "No meta.json found" }, { status: 404 });
    }
    meta.status = "tts";
    writeMeta(projectDir, meta);
    return NextResponse.json({ ok: true, meta });
  }

  // Default: write file
  const { file, content } = body;
  if (!file || !ALLOWED_FILES.includes(file)) {
    return new Response("Invalid file parameter", { status: 400 });
  }

  fs.writeFileSync(path.join(projectDir, file), content, "utf-8");
  return NextResponse.json({ ok: true });
}
