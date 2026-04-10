"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ProjectMeta {
  id: string;
  theme: string;
  topic: string;
  createdAt: string;
  status: string;
}

interface ProjectInfo {
  id: string;
  files: string[];
  meta: ProjectMeta | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  researching: { label: "리서치 중", color: "bg-yellow-900 text-yellow-300", step: 1 },
  topic_selection: { label: "주제 선택 대기", color: "bg-orange-900 text-orange-300", step: 2 },
  scripting: { label: "대본 작성 중", color: "bg-blue-900 text-blue-300", step: 3 },
  verifying: { label: "팩트체크 중", color: "bg-purple-900 text-purple-300", step: 4 },
  script_approval: { label: "대본 승인 대기", color: "bg-orange-900 text-orange-300", step: 5 },
  asset_check: { label: "에셋 확인 대기", color: "bg-orange-900 text-orange-300", step: 6 },
  tts: { label: "TTS 생성 중", color: "bg-indigo-900 text-indigo-300", step: 7 },
  editing: { label: "영상 편집 중", color: "bg-pink-900 text-pink-300", step: 8 },
  shorts: { label: "숏폼 생성 중", color: "bg-pink-900 text-pink-300", step: 9 },
  complete: { label: "완료", color: "bg-green-900 text-green-300", step: 10 },
};

const PIPELINE_STEPS = [
  "리서치", "주제선택", "대본", "검증", "승인", "에셋", "TTS", "편집", "숏폼", "완료",
];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-0.5 mt-2">
      {PIPELINE_STEPS.map((name, i) => (
        <div key={name} className="flex-1 flex flex-col items-center">
          <div
            className={`w-full h-1.5 rounded-full ${
              i < step ? "bg-blue-500" : "bg-gray-800"
            }`}
          />
          <span className="text-[9px] text-gray-600 mt-0.5">{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [newId, setNewId] = useState("");
  const [newTheme, setNewTheme] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects);
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newId.trim()) return;

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: newId.trim(), theme: newTheme.trim() }),
    });

    if (res.ok) {
      const data = await res.json();
      window.location.href = `/project/${data.meta.id}`;
    }
  }

  async function deleteProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  }

  const needsAction = projects.filter((p) =>
    ["topic_selection", "script_approval", "asset_check"].includes(p.meta?.status ?? "")
  );
  const inProgress = projects.filter(
    (p) =>
      p.meta?.status &&
      !["topic_selection", "script_approval", "asset_check", "complete"].includes(p.meta.status)
  );
  const completed = projects.filter((p) => p.meta?.status === "complete");
  const noMeta = projects.filter((p) => !p.meta);

  return (
    <div>
      {/* Create New Project */}
      <form onSubmit={createProject} className="mb-8 p-4 border border-gray-800 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 mb-3">새 프로젝트 생성</h3>
        <div className="flex gap-2">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="프로젝트 ID (예: blue-zone-story)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            required
          />
          <input
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            placeholder="테마/장르 (예: 건강/의학 실화)"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
          >
            + 생성
          </button>
        </div>
      </form>

      {/* Action Required */}
      {needsAction.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            사용자 확인 필요
          </h2>
          <div className="grid gap-3">
            {needsAction.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={deleteProject} />
            ))}
          </div>
        </section>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3">진행 중</h2>
          <div className="grid gap-3">
            {inProgress.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={deleteProject} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3 text-gray-500">완료</h2>
          <div className="grid gap-3">
            {completed.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={deleteProject} />
            ))}
          </div>
        </section>
      )}

      {/* Legacy projects without meta */}
      {noMeta.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-3 text-gray-600">기존 프로젝트</h2>
          <div className="grid gap-3">
            {noMeta.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className="block border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <span className="font-medium">{p.id}</span>
                <div className="text-xs text-gray-600 mt-1">
                  {p.files.join(", ")}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {projects.length === 0 && (
        <p className="text-gray-500 text-center py-12">
          프로젝트가 없습니다. 위에서 새 프로젝트를 생성하세요.
        </p>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectInfo;
  onDelete: (id: string) => void;
}) {
  const status = STATUS_CONFIG[project.meta?.status ?? ""] ?? {
    label: "알 수 없음",
    color: "bg-gray-800 text-gray-400",
    step: 0,
  };

  return (
    <div className="relative border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <Link href={`/project/${project.id}`} className="block">
        <div className="flex items-center justify-between pr-8">
          <div>
            <span className="font-medium text-lg">{decodeURIComponent(project.id)}</span>
            {project.meta?.topic && (
              <span className="ml-3 text-sm text-gray-400">
                {project.meta.topic}
              </span>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded ${status.color}`}>
            {status.label}
          </span>
        </div>
        {project.meta?.theme && (
          <div className="text-xs text-gray-600 mt-1">테마: {project.meta.theme}</div>
        )}
        <ProgressBar step={status.step} />
      </Link>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`"${decodeURIComponent(project.id)}" 프로젝트를 삭제하시겠습니까?`)) {
            onDelete(project.id);
          }
        }}
        className="absolute top-3 right-3 text-gray-700 hover:text-red-400 transition-colors"
        title="삭제"
      >
        &times;
      </button>
    </div>
  );
}
