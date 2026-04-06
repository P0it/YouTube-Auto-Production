import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";

const PROJECTS_DIR = path.resolve(process.cwd(), "../projects");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectPath = path.join(PROJECTS_DIR, id);

  if (!fs.existsSync(projectPath)) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const readFile = (name: string) => {
    const p = path.join(projectPath, name);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : null;
  };

  return Response.json({
    id,
    script: readFile("script.md"),
    scriptVerified: readFile("script-verified.md"),
    research: readFile("research.md"),
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { fileName, content } = await request.json();

  const allowed = ["script.md", "script-verified.md", "research.md"];
  if (!allowed.includes(fileName)) {
    return Response.json({ error: "Invalid file name" }, { status: 400 });
  }

  const projectPath = path.join(PROJECTS_DIR, id);
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, fileName), content, "utf-8");

  return Response.json({ saved: true });
}
