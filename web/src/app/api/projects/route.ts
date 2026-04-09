import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

export async function GET() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return NextResponse.json([]);
  }

  const dirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  const projects = dirs
    .filter((d) => d.isDirectory())
    .map((d) => {
      const projectPath = path.join(PROJECTS_DIR, d.name);
      const files = fs.readdirSync(projectPath).filter((f) => f.endsWith(".md"));
      return { id: d.name, files };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const id = formData.get("id") as string;

  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return new Response("Invalid project ID", { status: 400 });
  }

  const projectDir = path.join(PROJECTS_DIR, id);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  // Redirect back to the project page
  return NextResponse.redirect(new URL(`/project/${id}`, request.url));
}
