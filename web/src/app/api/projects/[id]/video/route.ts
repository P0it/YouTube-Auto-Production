import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

/**
 * Stream the project's longform MP4 (or a named short) with HTTP range support
 * so <video> tags can seek without downloading the whole file.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const variant = request.nextUrl.searchParams.get("variant") ?? "longform";

  const filePath = resolveVideoPath(id, variant);
  if (!filePath || !fs.existsSync(filePath)) {
    return new Response("not found", { status: 404 });
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const range = request.headers.get("range");

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1]);
      const end = match[2] ? parseInt(match[2]) : stats.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      return new Response(stream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
        },
      });
    }
  }

  const stream = fs.createReadStream(filePath);
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stats.size),
      "Accept-Ranges": "bytes",
    },
  });
}

function resolveVideoPath(id: string, variant: string): string | null {
  const videoDir = path.join(PROJECTS_DIR, id, "output", "video");
  if (variant === "longform") {
    return path.join(videoDir, "longform.mp4");
  }
  if (/^short_\d+$/.test(variant)) {
    return path.join(videoDir, "shorts", `${variant}.mp4`);
  }
  return null;
}
