"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  hasScript: boolean;
  hasVerified: boolean;
  hasResearch: boolean;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newId, setNewId] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects);
  }, []);

  const createProject = async () => {
    const id =
      newId.trim() ||
      new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.push(`/project/${id}`);
  };

  return (
    <div className="space-y-8">
      {/* New Project */}
      <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">새 프로젝트 시작</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="프로젝트 ID (비우면 자동 생성)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createProject}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            + 새 프로젝트
          </button>
        </div>
      </section>

      {/* Project List */}
      <section>
        <h2 className="text-lg font-semibold mb-4">프로젝트 목록</h2>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-sm">프로젝트가 없습니다.</p>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/project/${p.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-left hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{p.id}</h3>
                  <div className="flex gap-2">
                    {p.hasResearch && (
                      <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded">
                        리서치
                      </span>
                    )}
                    {p.hasScript && (
                      <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                        대본
                      </span>
                    )}
                    {p.hasVerified && (
                      <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">
                        검증완료
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
