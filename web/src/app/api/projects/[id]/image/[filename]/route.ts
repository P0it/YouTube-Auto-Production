import { NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;

  if (!/^part_\d+_\d+\.(png|jpe?g|webp|gif)$/i.test(filename)) {
    return new Response("invalid filename", { status: 400 });
  }

  const generatedPath = path.join(PROJECTS_DIR, id, "assets", "generated", filename);
  const overridePath = path.join(PROJECTS_DIR, id, "assets", "images", filename);
  const filePath = fs.existsSync(overridePath) ? overridePath : generatedPath;

  if (!fs.existsSync(filePath)) {
    return new Response("not found", { status: 404 });
  }

  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
