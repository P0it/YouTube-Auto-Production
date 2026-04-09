import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");
const ALLOWED_FILES = ["research.md", "script.md", "script-verified.md"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const file = request.nextUrl.searchParams.get("file");

  if (!file || !ALLOWED_FILES.includes(file)) {
    return new Response("Invalid file parameter", { status: 400 });
  }

  const filePath = path.join(PROJECTS_DIR, id, file);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ content: "" });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return NextResponse.json({ content });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { file, content } = await request.json();

  if (!file || !ALLOWED_FILES.includes(file)) {
    return new Response("Invalid file parameter", { status: 400 });
  }

  const projectDir = path.join(PROJECTS_DIR, id);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  fs.writeFileSync(path.join(projectDir, file), content, "utf-8");
  return NextResponse.json({ ok: true });
}
