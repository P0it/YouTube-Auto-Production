import * as fs from "fs";
import * as path from "path";
import Link from "next/link";

interface ProjectInfo {
  id: string;
  files: string[];
}

function getProjects(): ProjectInfo[] {
  const projectsDir = path.resolve(process.cwd(), "..", "projects");
  if (!fs.existsSync(projectsDir)) return [];

  const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
  return dirs
    .filter((d) => d.isDirectory())
    .map((d) => {
      const projectPath = path.join(projectsDir, d.name);
      const files = fs.readdirSync(projectPath).filter((f) => f.endsWith(".md"));
      return { id: d.name, files };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getStatusBadge(files: string[]) {
  if (files.includes("script-verified.md"))
    return { label: "검증완료", color: "bg-green-900 text-green-300" };
  if (files.includes("script.md"))
    return { label: "대본작성", color: "bg-blue-900 text-blue-300" };
  if (files.includes("research.md"))
    return { label: "리서치", color: "bg-yellow-900 text-yellow-300" };
  return { label: "초기", color: "bg-gray-800 text-gray-400" };
}

export default function Home() {
  const projects = getProjects();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">프로젝트 목록</h2>
        <form action="/api/projects" method="POST" className="flex gap-2">
          <input
            name="id"
            type="text"
            placeholder="새 프로젝트 ID"
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
          >
            + 새 프로젝트
          </button>
        </form>
      </div>

      {projects.length === 0 ? (
        <p className="text-gray-500">프로젝트가 없습니다. 새 프로젝트를 생성하세요.</p>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const status = getStatusBadge(project.files);
            return (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-lg">{project.id}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${status.color}`}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  파일: {project.files.join(", ") || "없음"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
