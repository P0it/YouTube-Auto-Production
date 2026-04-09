"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

type Tab = "generate" | "script" | "factcheck" | "verified";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [tab, setTab] = useState<Tab>("generate");
  const [topic, setTopic] = useState("");
  const [streamOutput, setStreamOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [scriptContent, setScriptContent] = useState("");
  const [verifiedContent, setVerifiedContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const loadFile = useCallback(
    async (file: string): Promise<string> => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}?file=${file}`
        );
        if (!res.ok) return "";
        const data = await res.json();
        return data.content ?? "";
      } catch {
        return "";
      }
    },
    [projectId]
  );

  useEffect(() => {
    loadFile("script.md").then(setScriptContent);
    loadFile("script-verified.md").then(setVerifiedContent);
  }, [loadFile]);

  async function handleGenerate(mode: "generate" | "fact-check") {
    setIsStreaming(true);
    setStreamOutput("");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const body =
        mode === "generate"
          ? { projectId, topic, mode }
          : { projectId, topic: "", mode };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        setStreamOutput(`오류: ${err}`);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                accumulated += parsed.token;
                setStreamOutput(accumulated);
              }
            } catch {
              // skip
            }
          }
        }
      }

      // Reload files after generation
      if (mode === "generate") {
        setScriptContent(accumulated);
      } else {
        setVerifiedContent(accumulated);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setStreamOutput(`오류: ${err.message}`);
      }
    } finally {
      setIsStreaming(false);
    }
  }

  async function saveScript() {
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "script.md", content: scriptContent }),
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "generate", label: "대본 생성" },
    { key: "script", label: "대본" },
    { key: "factcheck", label: "팩트체크" },
    { key: "verified", label: "검증 대본" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{projectId}</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === t.key
                ? "bg-gray-800 text-white border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {tab === "generate" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="주제를 입력하세요 (예: 시한부 9개월 선고받고 37년을 더 산 남자)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleGenerate("generate")}
              disabled={isStreaming || !topic.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
            >
              {isStreaming ? "생성 중..." : "대본 생성 (Qwen3)"}
            </button>
          </div>
          {streamOutput && (
            <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-sm whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {streamOutput}
            </pre>
          )}
        </div>
      )}

      {/* Script Tab */}
      {tab === "script" && (
        <div>
          <textarea
            value={scriptContent}
            onChange={(e) => setScriptContent(e.target.value)}
            onBlur={saveScript}
            className="w-full h-[600px] bg-gray-900 border border-gray-800 rounded p-4 text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
            placeholder="대본이 아직 없습니다. '대본 생성' 탭에서 생성하세요."
          />
          <p className="mt-2 text-xs text-gray-600">
            포커스를 벗어나면 자동 저장됩니다
          </p>
        </div>
      )}

      {/* Fact Check Tab */}
      {tab === "factcheck" && (
        <div>
          <button
            onClick={() => handleGenerate("fact-check")}
            disabled={isStreaming || !scriptContent.trim()}
            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 rounded text-sm font-medium mb-4"
          >
            {isStreaming ? "검증 중..." : "팩트체크 실행"}
          </button>
          {!scriptContent.trim() && (
            <p className="text-sm text-gray-500 mb-4">
              먼저 대본을 생성하세요.
            </p>
          )}
          {streamOutput && tab === "factcheck" && (
            <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-sm whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {streamOutput}
            </pre>
          )}
        </div>
      )}

      {/* Verified Tab */}
      {tab === "verified" && (
        <div>
          {verifiedContent ? (
            <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-sm whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {verifiedContent}
            </pre>
          ) : (
            <p className="text-gray-500">
              검증된 대본이 아직 없습니다. '팩트체크' 탭에서 실행하세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
