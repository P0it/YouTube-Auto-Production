import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { ProjectMeta } from "../route";
import { STAGE_RUNNERS } from "@/lib/pipeline-stages";
import { spawnStage } from "@/lib/spawn-helper";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");
const ROOT_DIR = path.resolve(process.cwd(), "..");
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

function listGeneratedImages(projectDir: string): {
  filename: string;
  partNumber: number;
  sequence: number;
}[] {
  const generatedDir = path.join(projectDir, "assets", "generated");
  if (!fs.existsSync(generatedDir)) return [];
  return fs
    .readdirSync(generatedDir)
    .filter((f) => /^part_\d+_\d+\.(png|jpg|jpeg|webp)$/i.test(f))
    .map((f) => {
      const m = f.match(/^part_(\d+)_(\d+)\./);
      return {
        filename: f,
        partNumber: m ? parseInt(m[1]) : 0,
        sequence: m ? parseInt(m[2]) : 0,
      };
    })
    .sort((a, b) => a.partNumber - b.partNumber || a.sequence - b.sequence);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = request.nextUrl.searchParams.get("file");
  const action = request.nextUrl.searchParams.get("action");

  const projectDir = getProjectDir(id);

  if (action === "assets") {
    const assetsDir = path.join(projectDir, "assets");
    const generated = listGeneratedImages(projectDir);
    const imagesDir = path.join(assetsDir, "images");
    const videosDir = path.join(assetsDir, "videos");
    const clipsMeta = path.join(assetsDir, "clips", "metadata.json");
    const images = fs.existsSync(imagesDir)
      ? fs.readdirSync(imagesDir).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      : [];
    const videos = fs.existsSync(videosDir)
      ? fs.readdirSync(videosDir).filter((f) => /\.(mp4|mov|webm)$/i.test(f))
      : [];
    const clips = fs.existsSync(clipsMeta)
      ? (JSON.parse(fs.readFileSync(clipsMeta, "utf-8")) as {
          partNumber: number;
          sequence: number;
          filePath: string;
        }[])
      : [];
    return NextResponse.json({ images, videos, generated, clips });
  }

  if (action === "generated_metadata") {
    const metaPath = path.join(projectDir, "assets", "generated", "metadata.json");
    if (!fs.existsSync(metaPath)) return NextResponse.json({ entries: [] });
    const entries = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    return NextResponse.json({ entries });
  }

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectDir = getProjectDir(id);

  if (!fs.existsSync(projectDir)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  fs.rmSync(projectDir, { recursive: true, force: true });
  return NextResponse.json({ ok: true });
}

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

  const requireMeta = (): ProjectMeta | NextResponse => {
    const meta = readMeta(projectDir);
    if (!meta) return NextResponse.json({ error: "No meta.json found" }, { status: 404 });
    return meta;
  };

  if (body.action === "update_status") {
    const metaOrRes = requireMeta();
    if (metaOrRes instanceof NextResponse) return metaOrRes;
    const meta = metaOrRes;
    meta.status = body.status;
    if (body.topic) meta.topic = body.topic;
    writeMeta(projectDir, meta);
    return NextResponse.json({ ok: true, meta });
  }

  if (body.action === "select_topic") {
    const metaOrRes = requireMeta();
    if (metaOrRes instanceof NextResponse) return metaOrRes;
    const meta = metaOrRes;
    meta.topic = body.topic;
    meta.status = "scripting";
    writeMeta(projectDir, meta);

    STAGE_RUNNERS.scripting.run({
      projectId: id,
      projectDir,
      meta,
      onExit: (code) => {
        const latest = readMeta(projectDir);
        if (!latest) return;
        if (code === 0 && latest.status === "scripting") {
          latest.status = "verifying";
        } else if (code !== 0) {
          // Keep meta.status; progress.json records the failure.
        }
        writeMeta(projectDir, latest);
      },
    });

    return NextResponse.json({ ok: true, meta });
  }

  if (body.action === "approve_script") {
    const metaOrRes = requireMeta();
    if (metaOrRes instanceof NextResponse) return metaOrRes;
    const meta = metaOrRes;
    meta.status = "image_generation";
    writeMeta(projectDir, meta);

    STAGE_RUNNERS.imageGeneration.run({
      projectId: id,
      projectDir,
      meta,
      onExit: (code) => {
        const latest = readMeta(projectDir);
        if (!latest) return;
        if (code !== 0) {
          // stay in image_generation; user can resume
          return;
        }
        if (process.env.SKIP_VEO === "1") {
          latest.status = "asset_check";
          writeMeta(projectDir, latest);
          return;
        }
        latest.status = "video_clips";
        writeMeta(projectDir, latest);
        STAGE_RUNNERS.videoClips.run({
          projectId: id,
          projectDir,
          meta: latest,
          onExit: (code2) => {
            const m = readMeta(projectDir);
            if (!m) return;
            m.status = code2 === 0 ? "asset_check" : "video_clips";
            writeMeta(projectDir, m);
          },
        });
      },
    });

    return NextResponse.json({ ok: true, meta });
  }

  if (body.action === "generate_images") {
    const metaOrRes = requireMeta();
    if (metaOrRes instanceof NextResponse) return metaOrRes;
    const meta = metaOrRes;
    meta.status = "image_generation";
    writeMeta(projectDir, meta);
    STAGE_RUNNERS.imageGeneration.run({
      projectId: id,
      projectDir,
      meta,
      onExit: (code) => {
        const latest = readMeta(projectDir);
        if (!latest) return;
        latest.status = code === 0 ? "asset_check" : "image_generation";
        writeMeta(projectDir, latest);
      },
    });
    return NextResponse.json({ ok: true, meta });
  }

  if (body.action === "regenerate_image") {
    const partNumber = Number(body.partNumber);
    const sequence = body.sequence !== undefined ? Number(body.sequence) : undefined;
    if (!Number.isFinite(partNumber) || partNumber < 1) {
      return NextResponse.json({ error: "partNumber required" }, { status: 400 });
    }
    const args = [
      "tsx",
      path.join(ROOT_DIR, "src", "scripts", "generate-images.ts"),
      "--project",
      id,
      "--part",
      String(partNumber),
      "--regenerate",
    ];
    if (sequence !== undefined) args.push("--sequence", String(sequence));
    spawnStage({
      projectDir,
      stage: "regenerate_image",
      command: "npx",
      args,
      cwd: ROOT_DIR,
    });
    return NextResponse.json({ ok: true, partNumber, sequence });
  }

  if (body.action === "regenerate_clip") {
    const partNumber = Number(body.partNumber);
    if (!Number.isFinite(partNumber) || partNumber < 1) {
      return NextResponse.json({ error: "partNumber required" }, { status: 400 });
    }
    spawnStage({
      projectDir,
      stage: "regenerate_clip",
      command: "npx",
      args: [
        "tsx",
        path.join(ROOT_DIR, "src", "scripts", "generate-video-clips.ts"),
        "--project",
        id,
        "--parts",
        String(partNumber),
        "--regenerate",
      ],
      cwd: ROOT_DIR,
    });
    return NextResponse.json({ ok: true, partNumber });
  }

  if (body.action === "confirm_assets") {
    const metaOrRes = requireMeta();
    if (metaOrRes instanceof NextResponse) return metaOrRes;
    const meta = metaOrRes;
    meta.status = "tts";
    writeMeta(projectDir, meta);

    STAGE_RUNNERS.tts.run({
      projectId: id,
      projectDir,
      meta,
      onExit: (code) => {
        const latest = readMeta(projectDir);
        if (!latest) return;
        if (code !== 0) return;
        latest.status = "editing";
        writeMeta(projectDir, latest);
        STAGE_RUNNERS.editing.run({
          projectId: id,
          projectDir,
          meta: latest,
          onExit: (code2) => {
            const m = readMeta(projectDir);
            if (!m) return;
            if (code2 !== 0) return;
            m.status = "shorts";
            writeMeta(projectDir, m);
            STAGE_RUNNERS.shorts.run({
              projectId: id,
              projectDir,
              meta: m,
              onExit: () => {
                // The shorts subagent is responsible for setting status=complete.
              },
            });
          },
        });
      },
    });

    return NextResponse.json({ ok: true, meta });
  }

  const { file, content } = body;
  if (!file || !ALLOWED_FILES.includes(file)) {
    return new Response("Invalid file parameter", { status: 400 });
  }

  fs.writeFileSync(path.join(projectDir, file), content, "utf-8");
  return NextResponse.json({ ok: true });
}
