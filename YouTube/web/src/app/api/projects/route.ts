import * as fs from "fs";
import * as path from "path";
import { NextRequest } from "next/server";

const PROJECTS_DIR = path.resolve(process.cwd(), "../projects");

export async function GET() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return Response.json([]);
  }

  const dirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const projectPath = path.join(PROJECTS_DIR, d.name);
      const hasScript = fs.existsSync(path.join(projectPath, "script.md"));
      const hasVerified = fs.existsSync(
        path.join(projectPath, "script-verified.md")
      );
      const hasResearch = fs.existsSync(path.join(projectPath, "research.md"));

      return {
        id: d.name,
        hasScript,
        hasVerified,
        hasResearch,
      };
    });

  return Response.json(dirs);
}

export async function POST(request: NextRequest) {
  const { id } = await request.json();
  const projectPath = path.join(PROJECTS_DIR, id);

  fs.mkdirSync(projectPath, { recursive: true });
  fs.mkdirSync(path.join(projectPath, "assets"), { recursive: true });
  fs.mkdirSync(path.join(projectPath, "output/audio"), { recursive: true });
  fs.mkdirSync(path.join(projectPath, "output/video/shorts"), {
    recursive: true,
  });

  return Response.json({ id, created: true });
}
