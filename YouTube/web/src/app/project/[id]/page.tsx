"use client";

import { useState, useEffect, useRef, use } from "react";

interface ProjectData {
  id: string;
  script: string | null;
  scriptVerified: string | null;
  research: string | null;
}

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [topic, setTopic] = useState("");
  const [tab, setTab] = useState<"generate" | "script" | "verified">(
    "generate"
  );
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProject(data);
        if (data.script) setTab("script");
        if (data.scriptVerified) setTab("verified");
      });
  }, [id]);

  const startGeneration = async (mode: "script" | "fact-check") => {
    setGenerating(true);
    setStreamText("");

    const body =
      mode === "fact-check"
        ? { topic: project?.script, mode: "fact-check" }
        : { topic, research: project?.research || "", mode: "generate" };

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      setStreamText("Ollama 연결 실패. ollama serve 가 실행 중인지 확인하세요.");
      setGenerating(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const { text } = JSON.parse(data);
          fullText += text;
          setStreamText(fullText);
        } catch {
          // skip
        }
      }

      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }

    // Save the result
    const fileName =
      mode === "fact-check" ? "script-verified.md" : "script.md";
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, content: fullText }),
    });

    // Refresh project data
    const refreshed = await fetch(`/api/projects/${id}`).then((r) => r.json());
    setProject(refreshed);
    setTab(mode === "fact-check" ? "verified" : "script");
    setGenerating(false);
  };

  const saveScript = async (content: string) => {
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: "script.md", content }),
    });
  };

  if (!project) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-gray-300 mb-1 inline-block"
          >
            ← 목록으로
          </a>
          <h1 className="text-2xl font-bold">{id}</h1>
        </div>
        <div className="flex gap-2">
          {project.script && !generating && (
            <button
              onClick={() => startGeneration("fact-check")}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              팩트체크 실행
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
        <button
          onClick={() => setTab("generate")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "generate"
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          대본 생성
        </button>
        <button
          onClick={() => setTab("script")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "script"
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          대본 {project.script ? "✓" : ""}
        </button>
        <button
          onClick={() => setTab("verified")}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "verified"
              ? "bg-gray-700 text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          검증 대본 {project.scriptVerified ? "✓" : ""}
        </button>
      </div>

      {/* Tab Content */}
      {tab === "generate" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              주제 입력
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 시한부 9개월 선고받고 37년을 더 산 남자의 비결&#10;&#10;리서치 자료도 함께 붙여넣을 수 있습니다."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <button
            onClick={() => startGeneration("script")}
            disabled={!topic.trim() || generating}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {generating ? "생성 중..." : "대본 생성 (Qwen3)"}
          </button>

          {streamText && (
            <div
              ref={outputRef}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 max-h-[600px] overflow-y-auto"
            >
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-gray-200">
                {streamText}
              </pre>
            </div>
          )}
        </div>
      )}

      {tab === "script" && (
        <div className="space-y-4">
          {project.script ? (
            <>
              <textarea
                defaultValue={project.script}
                onBlur={(e) => saveScript(e.target.value)}
                rows={30}
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <p className="text-xs text-gray-500">
                편집 후 포커스를 벗어나면 자동 저장됩니다.
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">
              아직 대본이 없습니다. &quot;대본 생성&quot; 탭에서 생성하세요.
            </p>
          )}
        </div>
      )}

      {tab === "verified" && (
        <div className="space-y-4">
          {project.scriptVerified ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 max-h-[700px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono text-gray-200">
                {project.scriptVerified}
              </pre>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              아직 검증된 대본이 없습니다. 대본을 먼저 생성한 후
              &quot;팩트체크 실행&quot; 버튼을 눌러주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
