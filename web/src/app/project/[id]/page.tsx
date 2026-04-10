"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProjectMeta {
  id: string;
  theme: string;
  topic: string;
  createdAt: string;
  status: string;
}

interface TopicCandidate {
  rank: number;
  title: string;
  description: string;
  source: string;
}

const STATUS_LABELS: Record<string, string> = {
  researching: "리서치 진행 중...",
  topic_selection: "주제를 선택하세요",
  scripting: "대본 작성 중...",
  verifying: "팩트체크 진행 중...",
  script_approval: "대본을 확인하고 승인하세요",
  asset_check: "에셋을 확인하세요",
  tts: "TTS 생성 중...",
  editing: "영상 편집 중...",
  shorts: "숏폼 생성 중...",
  complete: "제작 완료!",
};

// ─── Parse research.md to extract topic list ───
function parseResearchTopics(content: string): TopicCandidate[] {
  const topics: TopicCandidate[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    // 새 형식: | # | Topic | Description | Source |
    const match = line.match(
      /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
    );
    if (match) {
      topics.push({
        rank: parseInt(match[1]),
        title: match[2].trim().replace(/\\\|/g, "|"),
        description: match[3].trim().replace(/\\\|/g, "|"),
        source: match[4].trim(),
      });
    }
  }
  return topics;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [research, setResearch] = useState("");
  const [script, setScript] = useState("");
  const [verified, setVerified] = useState("");
  const [assets, setAssets] = useState<{ images: string[]; videos: string[] }>({
    images: [],
    videos: [],
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [metaRes, researchRes, scriptRes, verifiedRes, assetsRes] =
      await Promise.all([
        fetch(`/api/projects/${projectId}?file=meta.json`),
        fetch(`/api/projects/${projectId}?file=research.md`),
        fetch(`/api/projects/${projectId}?file=script.md`),
        fetch(`/api/projects/${projectId}?file=script-verified.md`),
        fetch(`/api/projects/${projectId}?action=assets`),
      ]);

    const metaData = await metaRes.json();
    const researchData = await researchRes.json();
    const scriptData = await scriptRes.json();
    const verifiedData = await verifiedRes.json();
    const assetsData = await assetsRes.json();

    setMeta(metaData.meta ?? null);
    setResearch(researchData.content ?? "");
    setScript(scriptData.content ?? "");
    setVerified(verifiedData.content ?? "");
    setAssets(assetsData);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 자동 단계(researching, scripting 등)일 때 5초마다 폴링
  useEffect(() => {
    const autoStates = ["researching", "scripting", "verifying", "tts", "editing", "shorts"];
    if (!meta || !autoStates.includes(meta.status)) return;
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [meta?.status, loadData]);

  async function updateStatus(status: string, extra?: Record<string, string>) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", status, ...extra }),
    });
    const data = await res.json();
    setMeta(data.meta);
  }

  async function selectTopic(topic: string) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "select_topic", topic }),
    });
    const data = await res.json();
    setMeta(data.meta);
  }

  async function approveScript() {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_script" }),
    });
    const data = await res.json();
    setMeta(data.meta);
  }

  async function requestRevision() {
    await updateStatus("scripting");
  }

  async function confirmAssets() {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_assets" }),
    });
    const data = await res.json();
    setMeta(data.meta);
  }

  async function saveScript(content: string) {
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "script.md", content }),
    });
  }

  if (loading) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  const status = meta?.status ?? "researching";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.push("/")}
          className="text-gray-500 hover:text-gray-300 text-sm"
        >
          &larr; 목록
        </button>
        <h2 className="text-2xl font-bold">{decodeURIComponent(projectId)}</h2>
      </div>
      {meta?.theme && (
        <p className="text-sm text-gray-500 mb-1">테마: {meta.theme}</p>
      )}
      <p className="text-sm text-gray-400 mb-6">
        {STATUS_LABELS[status] ?? status}
      </p>

      {/* Pipeline Steps Indicator */}
      <PipelineSteps currentStatus={status} />

      <div className="mt-8">
        {/* ── STEP: Topic Selection ── */}
        {status === "topic_selection" && (
          <TopicSelectionUI
            research={research}
            onSelect={selectTopic}
          />
        )}

        {/* ── STEP: Script Approval ── */}
        {status === "script_approval" && (
          <ScriptApprovalUI
            script={script}
            verified={verified}
            onApprove={approveScript}
            onRevision={requestRevision}
            onSave={saveScript}
            setScript={setScript}
          />
        )}

        {/* ── STEP: Asset Check ── */}
        {status === "asset_check" && (
          <AssetCheckUI
            projectId={projectId}
            script={verified || script}
            assets={assets}
            onConfirm={confirmAssets}
            onRefresh={loadData}
          />
        )}

        {/* ── STEP: Automated / Waiting ── */}
        {["researching", "scripting", "verifying", "tts", "editing", "shorts"].includes(
          status
        ) && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">
              {STATUS_LABELS[status]}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              에이전트가 작업 중입니다. 완료되면 자동으로 다음 단계로 진행됩니다.
            </p>

            {/* Dev: manual status advance for testing */}
            <div className="mt-8 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-700 mb-2">개발용: 수동 상태 전환</p>
              <div className="flex gap-2 justify-center flex-wrap">
                {status === "researching" && (
                  <DevButton onClick={() => updateStatus("topic_selection")} label="→ 주제선택" />
                )}
                {status === "scripting" && (
                  <DevButton onClick={() => updateStatus("verifying")} label="→ 팩트체크" />
                )}
                {status === "verifying" && (
                  <DevButton onClick={() => updateStatus("script_approval")} label="→ 대본승인" />
                )}
                {status === "tts" && (
                  <DevButton onClick={() => updateStatus("editing")} label="→ 편집" />
                )}
                {status === "editing" && (
                  <DevButton onClick={() => updateStatus("shorts")} label="→ 숏폼" />
                )}
                {status === "shorts" && (
                  <DevButton onClick={() => updateStatus("complete")} label="→ 완료" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Complete ── */}
        {status === "complete" && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#10003;</div>
            <p className="text-xl font-bold text-green-400">제작 완료!</p>
            <p className="text-sm text-gray-500 mt-2">
              {meta?.topic && `주제: ${meta.topic}`}
            </p>
          </div>
        )}

        {/* ── Always visible: project files ── */}
        <details className="mt-8 border border-gray-800 rounded-lg">
          <summary className="px-4 py-3 text-sm text-gray-500 cursor-pointer hover:text-gray-300">
            프로젝트 파일 보기
          </summary>
          <div className="p-4 space-y-4">
            {research && (
              <FilePreview title="research.md" content={research} />
            )}
            {script && (
              <FilePreview title="script.md" content={script} />
            )}
            {verified && (
              <FilePreview title="script-verified.md" content={verified} />
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function PipelineSteps({ currentStatus }: { currentStatus: string }) {
  const steps = [
    { key: "researching", label: "리서치" },
    { key: "topic_selection", label: "주제선택" },
    { key: "scripting", label: "대본" },
    { key: "verifying", label: "검증" },
    { key: "script_approval", label: "승인" },
    { key: "asset_check", label: "에셋" },
    { key: "tts", label: "TTS" },
    { key: "editing", label: "편집" },
    { key: "shorts", label: "숏폼" },
    { key: "complete", label: "완료" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === currentStatus);
  const isUserStep = ["topic_selection", "script_approval", "asset_check"].includes(
    currentStatus
  );

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        const isUser = ["topic_selection", "script_approval", "asset_check"].includes(
          step.key
        );

        return (
          <div key={step.key} className="flex-1 text-center">
            <div
              className={`h-2 rounded-full mb-1 ${
                isDone
                  ? "bg-blue-500"
                  : isActive
                    ? isUserStep
                      ? "bg-orange-500 animate-pulse"
                      : "bg-blue-500 animate-pulse"
                    : "bg-gray-800"
              }`}
            />
            <span
              className={`text-[10px] ${
                isActive
                  ? "text-white font-medium"
                  : isDone
                    ? "text-blue-400"
                    : "text-gray-600"
              } ${isUser ? "underline decoration-dotted" : ""}`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopicSelectionUI({
  research,
  onSelect,
}: {
  research: string;
  onSelect: (topic: string) => void;
}) {
  const topics = parseResearchTopics(research);

  if (!research) {
    return (
      <p className="text-gray-500">
        리서치 결과가 아직 없습니다. researcher-planner 에이전트가 research.md를 생성하면 여기에 주제 목록이 표시됩니다.
      </p>
    );
  }

  if (topics.length === 0) {
    // Fallback: render markdown + manual input
    return (
      <div>
        <h3 className="text-lg font-bold mb-4">리서치 결과</h3>
        <div className="bg-gray-900 border border-gray-800 rounded p-4 text-sm max-h-[500px] overflow-y-auto mb-4 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{research}</ReactMarkdown>
        </div>
        <TopicManualInput onSelect={onSelect} />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">
        주제 후보 ({topics.length}개) — 하나를 선택하세요
      </h3>
      <div className="grid gap-3">
        {topics.map((topic) => (
          <button
            key={topic.rank}
            onClick={() => onSelect(topic.title)}
            className="text-left border border-gray-800 rounded-lg p-4 hover:border-blue-500 hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded shrink-0">
                #{topic.rank}
              </span>
              <span className="font-medium">{topic.title}</span>
            </div>
            <p className="text-sm text-gray-400 ml-7">{topic.description}</p>
            <div className="mt-2 ml-7">
              <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                {topic.source}
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-800">
        <TopicManualInput onSelect={onSelect} />
      </div>
    </div>
  );
}

function TopicManualInput({ onSelect }: { onSelect: (topic: string) => void }) {
  const [custom, setCustom] = useState("");
  return (
    <div className="flex gap-2">
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder="또는 직접 주제 입력..."
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        onClick={() => custom.trim() && onSelect(custom.trim())}
        disabled={!custom.trim()}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-4 py-2 rounded text-sm"
      >
        선택
      </button>
    </div>
  );
}

function ScriptApprovalUI({
  script,
  verified,
  onApprove,
  onRevision,
  onSave,
  setScript,
}: {
  script: string;
  verified: string;
  onApprove: () => void;
  onRevision: () => void;
  onSave: (content: string) => void;
  setScript: (s: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"verified" | "original" | "edit">(
    verified ? "verified" : "original"
  );
  const displayContent = verified || script;

  // Extract verification report header if present
  const reportEnd = verified.indexOf("\n---\n");
  const report = reportEnd > 0 ? verified.slice(0, reportEnd) : "";
  const verifiedScript = reportEnd > 0 ? verified.slice(reportEnd + 5) : verified;

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">대본 검토 및 승인</h3>

      {/* Verification Report Summary */}
      {report && (
        <div className="bg-orange-950 border border-orange-800 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-medium text-orange-300 mb-2">
            팩트체크 리포트
          </h4>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {report}
          </pre>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {verified && (
          <button
            onClick={() => setActiveTab("verified")}
            className={`px-3 py-1.5 text-sm ${
              activeTab === "verified"
                ? "text-white border-b-2 border-green-500"
                : "text-gray-500"
            }`}
          >
            검증 대본
          </button>
        )}
        <button
          onClick={() => setActiveTab("original")}
          className={`px-3 py-1.5 text-sm ${
            activeTab === "original"
              ? "text-white border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
        >
          원본 대본
        </button>
        <button
          onClick={() => setActiveTab("edit")}
          className={`px-3 py-1.5 text-sm ${
            activeTab === "edit"
              ? "text-white border-b-2 border-yellow-500"
              : "text-gray-500"
          }`}
        >
          직접 수정
        </button>
      </div>

      {/* Content */}
      {activeTab === "verified" && (
        <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto">
          {verifiedScript || verified}
        </pre>
      )}
      {activeTab === "original" && (
        <pre className="bg-gray-900 border border-gray-800 rounded p-4 text-sm whitespace-pre-wrap max-h-[500px] overflow-y-auto">
          {script}
        </pre>
      )}
      {activeTab === "edit" && (
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          onBlur={() => onSave(script)}
          className="w-full h-[500px] bg-gray-900 border border-gray-800 rounded p-4 text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onApprove}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-medium"
        >
          대본 승인
        </button>
        <button
          onClick={onRevision}
          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded"
        >
          수정 요청 (재작성)
        </button>
      </div>

      {!displayContent && (
        <p className="text-gray-500 mt-4">
          아직 대본이 생성되지 않았습니다.
        </p>
      )}
    </div>
  );
}

function AssetCheckUI({
  projectId,
  script,
  assets,
  onConfirm,
  onRefresh,
}: {
  projectId: string;
  script: string;
  assets: { images: string[]; videos: string[] };
  onConfirm: () => void;
  onRefresh: () => void;
}) {
  // Extract visual directions from script
  const directions: { part: string; direction: string }[] = [];
  const lines = script.split("\n");
  let currentPart = "";
  for (const line of lines) {
    const partMatch = line.match(/^##\s+파트\s*\d+:\s*(.+)/);
    if (partMatch) currentPart = partMatch[0];
    const dirMatch = line.match(/\[영상\s*지시:\s*(.+?)\]/);
    if (dirMatch) {
      directions.push({ part: currentPart, direction: dirMatch[1] });
    }
  }

  const totalAssets = assets.images.length + assets.videos.length;

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">에셋 확인</h3>

      {/* Visual Directions from Script */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-400 mb-2">
          대본의 영상 지시 ({directions.length}개)
        </h4>
        <div className="space-y-2">
          {directions.map((d, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded p-3 text-sm"
            >
              <span className="text-xs text-gray-600">{d.part}</span>
              <p className="text-gray-300 mt-1">{d.direction}</p>
            </div>
          ))}
          {directions.length === 0 && (
            <p className="text-sm text-gray-600">
              대본에 영상 지시가 없습니다.
            </p>
          )}
        </div>
      </div>

      {/* Current Assets */}
      <div className="mb-6 p-4 border border-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-400">
            현재 에셋 ({totalAssets}개)
          </h4>
          <button
            onClick={onRefresh}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            새로고침
          </button>
        </div>

        {totalAssets === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">에셋이 아직 없습니다.</p>
            <p className="text-gray-600 text-xs mt-2">
              아래 경로에 이미지/영상을 넣어주세요:
            </p>
            <code className="text-xs text-gray-400 mt-1 block">
              projects/{projectId}/assets/images/
            </code>
            <code className="text-xs text-gray-400 block">
              projects/{projectId}/assets/videos/
            </code>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.images.length > 0 && (
              <div>
                <span className="text-xs text-gray-500">
                  이미지 ({assets.images.length})
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {assets.images.map((img) => (
                    <span
                      key={img}
                      className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300"
                    >
                      {img}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {assets.videos.length > 0 && (
              <div>
                <span className="text-xs text-gray-500">
                  영상 ({assets.videos.length})
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {assets.videos.map((vid) => (
                    <span
                      key={vid}
                      className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300"
                    >
                      {vid}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-medium"
        >
          에셋 확인 완료 → TTS 진행
        </button>
      </div>
    </div>
  );
}

function FilePreview({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 mb-1">{title}</h4>
      <div className="bg-gray-900 border border-gray-800 rounded p-3 text-xs max-h-[300px] overflow-y-auto prose prose-invert prose-xs max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function DevButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1 rounded"
    >
      {label}
    </button>
  );
}
