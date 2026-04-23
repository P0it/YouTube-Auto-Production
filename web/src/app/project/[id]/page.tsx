"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProjectMeta {
  id: string;
  theme: string;
  topic: string;
  language?: "ko" | "en";
  createdAt: string;
  status: string;
}

interface TopicCandidate {
  rank: number;
  title: string;
  everydayHook: string;
  field: string;
  theory: string;
  reference: string;
  koreanApplication: string;
}

interface GeneratedImageEntry {
  partNumber: number;
  sequence: number;
  filePath: string;
  prompt: string;
  sectionType: string;
  style: string;
  aspectRatio: string;
  generatedAt: string;
}

interface AssetsPayload {
  images: string[];
  videos: string[];
  generated?: { filename: string; partNumber: number; sequence: number }[];
  clips?: { partNumber: number; sequence: number; filePath: string }[];
}

interface ProgressPayload {
  stage: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  pid?: number;
  logPath?: string;
  lastHeartbeatAt?: string;
  crashed?: boolean;
  tail: string[];
  counts?: { images?: number; clips?: number; audio?: number };
}

const STATUS_LABELS: Record<string, string> = {
  researching: "리서치 진행 중...",
  topic_selection: "주제를 선택하세요",
  scripting: "대본 작성 중...",
  verifying: "팩트체크 진행 중...",
  script_approval: "대본을 확인하고 승인하세요",
  image_generation: "이미지 자동 생성 중... (20-30장)",
  video_clips: "Veo 영상 클립 생성 중... (느림, 1-3분/클립)",
  asset_check: "생성된 이미지와 클립을 확인하세요",
  tts: "Gemini TTS 생성 중...",
  editing: "Remotion 렌더링 중...",
  shorts: "숏폼 생성 중...",
  complete: "제작 완료!",
};

// ─── Parse research.md to extract the 7-column topic table ───
// Format: | # | 주제 | 일상 훅 | 학문 분야 | 핵심 이론/개념 | 대표 연구 (저자·연도) | 한국 맥락 적용 |
function parseResearchTopics(content: string): TopicCandidate[] {
  const topics: TopicCandidate[] = [];
  const lines = content.split("\n");
  // We only want rows inside the "## 주제 후보" section, not the excluded-topics table.
  let inCandidates = false;
  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)/);
    if (sectionMatch) {
      inCandidates = /주제\s*후보/.test(sectionMatch[1]);
      continue;
    }
    if (!inCandidates) continue;

    // Skip header/separator rows.
    if (/^\|\s*-+/.test(line)) continue;
    if (/^\|\s*#\s*\|/.test(line)) continue;

    const cols = splitPipeRow(line);
    if (!cols) continue;
    if (cols.length < 7) continue;
    const rank = parseInt(cols[0]);
    if (!Number.isFinite(rank)) continue;

    topics.push({
      rank,
      title: stripQuotes(cols[1]),
      everydayHook: cols[2],
      field: cols[3],
      theory: cols[4],
      reference: cols[5],
      koreanApplication: cols[6],
    });
  }
  return topics;
}

function splitPipeRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
}

function stripQuotes(s: string): string {
  return s.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [research, setResearch] = useState("");
  const [script, setScript] = useState("");
  const [verified, setVerified] = useState("");
  const [assets, setAssets] = useState<AssetsPayload>({
    images: [],
    videos: [],
    generated: [],
  });
  const [generatedMeta, setGeneratedMeta] = useState<GeneratedImageEntry[]>([]);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [metaRes, researchRes, scriptRes, verifiedRes, assetsRes, genMetaRes, progressRes] =
      await Promise.all([
        fetch(`/api/projects/${projectId}?file=meta.json`),
        fetch(`/api/projects/${projectId}?file=research.md`),
        fetch(`/api/projects/${projectId}?file=script.md`),
        fetch(`/api/projects/${projectId}?file=script-verified.md`),
        fetch(`/api/projects/${projectId}?action=assets`),
        fetch(`/api/projects/${projectId}?action=generated_metadata`),
        fetch(`/api/projects/${projectId}/progress`),
      ]);

    const metaData = await metaRes.json();
    const researchData = await researchRes.json();
    const scriptData = await scriptRes.json();
    const verifiedData = await verifiedRes.json();
    const assetsData = await assetsRes.json();
    const genMetaData = await genMetaRes.json();
    const progressData = await progressRes.json();

    setMeta(metaData.meta ?? null);
    setResearch(researchData.content ?? "");
    setScript(scriptData.content ?? "");
    setVerified(verifiedData.content ?? "");
    setAssets(assetsData);
    setGeneratedMeta(genMetaData.entries ?? []);
    setProgress(progressData);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 자동 단계일 때 5초마다 폴링
  useEffect(() => {
    const autoStates = [
      "researching",
      "scripting",
      "verifying",
      "image_generation",
      "video_clips",
      "tts",
      "editing",
      "shorts",
    ];
    if (!meta || !autoStates.includes(meta.status)) return;
    const interval = setInterval(loadData, 5000);
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

  async function regenerateImage(partNumber: number) {
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "regenerate_image", partNumber }),
    });
    // Give the child process time to start writing, then refresh
    setTimeout(loadData, 3000);
  }

  async function retryImageGeneration() {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate_images" }),
    });
    const data = await res.json();
    setMeta(data.meta);
  }

  async function resumeStage() {
    const res = await fetch(`/api/projects/${projectId}/resume`, { method: "POST" });
    const data = await res.json();
    if (data.error) {
      alert(`재시도 실패: ${data.error}`);
      return;
    }
    setTimeout(loadData, 2000);
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
            projectId={projectId}
            research={research}
            progress={progress}
            onSelect={selectTopic}
            onResume={resumeStage}
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

        {/* ── STEP: Image Generation (auto with progress) ── */}
        {status === "image_generation" && (
          <>
            <ImageGenerationUI
              projectId={projectId}
              generatedMeta={generatedMeta}
              onRetry={retryImageGeneration}
              script={verified || script}
            />
            {progress && <ProgressPanel progress={progress} onResume={resumeStage} />}
          </>
        )}

        {/* ── STEP: Video clip generation (slow) ── */}
        {status === "video_clips" && (
          <div className="py-10">
            <div className="text-center mb-4">
              <div className="inline-block w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400">Veo 영상 클립 생성 중 (클립당 1-3분 소요)</p>
              <p className="text-xs text-gray-600 mt-2">
                생성된 클립: {progress?.counts?.clips ?? 0}개
              </p>
            </div>
            {progress && <ProgressPanel progress={progress} onResume={resumeStage} />}
          </div>
        )}

        {/* ── STEP: Asset Check (generated thumbnails + regenerate) ── */}
        {status === "asset_check" && (
          <AssetCheckUI
            projectId={projectId}
            script={verified || script}
            assets={assets}
            generatedMeta={generatedMeta}
            onConfirm={confirmAssets}
            onRefresh={loadData}
            onRegenerate={regenerateImage}
          />
        )}

        {/* ── STEP: Automated / Waiting ── */}
        {["researching", "scripting", "verifying", "tts", "editing", "shorts"].includes(
          status
        ) && (
          <div className="py-10">
            <div className="text-center mb-6">
              <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400">{STATUS_LABELS[status]}</p>
              <p className="text-xs text-gray-600 mt-2">
                완료되면 자동으로 다음 단계로 진행됩니다.
              </p>
            </div>

            {progress && <ProgressPanel progress={progress} onResume={resumeStage} />}

            <div className="mt-8 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-700 mb-2 text-center">개발용: 수동 상태 전환</p>
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
          <CompleteView projectId={projectId} topic={meta?.topic ?? ""} />
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
    { key: "image_generation", label: "이미지" },
    { key: "video_clips", label: "클립" },
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
  projectId,
  research,
  progress,
  onSelect,
  onResume,
}: {
  projectId: string;
  research: string;
  progress: ProgressPayload | null;
  onSelect: (topic: string) => void;
  onResume: () => void;
}) {
  const topics = parseResearchTopics(research);
  const isPlaceholder =
    research.includes("## 외국어(영어) 영상 참고") ||
    research.includes("# 리서치 raw 데이터");
  const isCurateStage = progress?.stage === "research:curate";
  const curateCrashed = progress?.crashed === true && isCurateStage;

  if (!research || isPlaceholder) {
    return (
      <div className="border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-2">
          {curateCrashed ? "리서치 큐레이션 실패" : "주제 큐레이션 중"}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {curateCrashed ? (
            <>
              researcher-planner 에이전트가 작업을 완료하지 못했습니다. 대개 원인은
              <br />
              <code className="text-gray-400">claude</code> CLI가 설치·로그인되지 않았거나
              권한 문제입니다. 터미널에서 <code className="text-gray-400">claude --version</code>,
              <code className="text-gray-400"> claude /login</code>을 확인한 뒤 재시도해주세요.
            </>
          ) : (
            <>
              researcher-planner 에이전트가 영어 학술 자료와 한국 문화 컨텍스트를 결합해
              <br />
              10–15개 원본 주제를 큐레이션하고 있습니다. 완료되면 자동으로 갱신됩니다.
            </>
          )}
        </p>
        <div className="flex gap-2 mb-4">
          <button
            onClick={onResume}
            className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded"
          >
            {curateCrashed ? "큐레이션 재시도" : "강제 재시도"}
          </button>
          <span className="text-xs text-gray-600 self-center">
            projectId: <code>{projectId}</code>
          </span>
        </div>
        {research && (
          <details className="mt-4">
            <summary className="text-xs text-gray-600 cursor-pointer">
              현재 수집된 raw 데이터 보기
            </summary>
            <div className="mt-2 bg-gray-900 border border-gray-800 rounded p-3 text-xs max-h-[300px] overflow-y-auto prose prose-invert prose-xs max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{research}</ReactMarkdown>
            </div>
          </details>
        )}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-bold mb-4">리서치 결과 (파싱 실패)</h3>
        <p className="text-xs text-gray-500 mb-3">
          자동 파싱에 실패했습니다. 아래 원문에서 주제를 확인하고 직접 입력하세요.
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded p-4 text-sm max-h-[500px] overflow-y-auto mb-4 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{research}</ReactMarkdown>
        </div>
        <TopicManualInput onSelect={onSelect} />
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-1">
        주제 후보 {topics.length}개 — 하나를 선택하세요
      </h3>
      <p className="text-xs text-gray-500 mb-5">
        외국 학술 자료에서 영감을 얻되, 한국 시청자 일상에 맞춰 원본 각도로 재구성된 후보입니다.
      </p>
      <div className="grid gap-3">
        {topics.map((topic) => (
          <TopicCard key={topic.rank} topic={topic} onSelect={onSelect} />
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 mb-2">
          원하는 주제가 없다면 직접 입력 (scriptwriter가 그대로 반영)
        </p>
        <TopicManualInput onSelect={onSelect} />
      </div>

      <details className="mt-6 border border-gray-800 rounded-lg">
        <summary className="px-4 py-2 text-xs text-gray-500 cursor-pointer">
          research.md 원본 보기 (제외된 주제 · 참고한 외국 영감 포함)
        </summary>
        <div className="p-4 bg-gray-900 text-xs prose prose-invert prose-xs max-w-none max-h-[400px] overflow-y-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{research}</ReactMarkdown>
        </div>
      </details>
    </div>
  );
}

function TopicCard({
  topic,
  onSelect,
}: {
  topic: TopicCandidate;
  onSelect: (title: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(topic.title)}
      className="text-left border border-gray-800 rounded-lg p-4 hover:border-amber-500 hover:bg-gray-900 transition-colors group"
    >
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded shrink-0">
          #{topic.rank}
        </span>
        <span className="text-base font-medium group-hover:text-amber-300 transition-colors">
          {topic.title}
        </span>
      </div>

      <div className="ml-7 grid gap-2 text-sm">
        <Field label="일상 훅" value={topic.everydayHook} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="학문 분야" value={topic.field} muted />
          <Field label="핵심 이론" value={topic.theory} muted />
        </div>
        <Field label="대표 연구" value={topic.reference} muted />
        <Field label="한국 맥락" value={topic.koreanApplication} />
      </div>
    </button>
  );
}

function Field({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <span
        className={`text-[10px] uppercase tracking-wide mr-2 ${
          muted ? "text-gray-600" : "text-amber-600"
        }`}
      >
        {label}
      </span>
      <span className={muted ? "text-gray-400" : "text-gray-200"}>{value}</span>
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

function ImageGenerationUI({
  projectId,
  generatedMeta,
  onRetry,
  script,
}: {
  projectId: string;
  generatedMeta: GeneratedImageEntry[];
  onRetry: () => void;
  script: string;
}) {
  const totalParts = countScriptParts(script);
  const done = generatedMeta.length;

  return (
    <div className="text-center py-16">
      <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-400">
        Gemini가 파트별 이미지를 자동 생성 중입니다.
      </p>
      <p className="text-xs text-gray-600 mt-2">
        진행: {done} / {totalParts || "?"} 파트 완료
      </p>

      {generatedMeta.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-3 max-w-5xl mx-auto">
          {generatedMeta.map((m) => (
            <div key={`${m.partNumber}-${m.sequence}`} className="w-40">
              <img
                src={`/api/projects/${projectId}/image/${fileNameForMeta(m)}`}
                alt={`part ${m.partNumber}`}
                className="w-40 h-[90px] object-cover rounded border border-gray-800"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                파트 {m.partNumber} · {m.sectionType}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-700 mb-2">문제가 있다면 재시도</p>
        <button
          onClick={onRetry}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1 rounded"
        >
          이미지 생성 재시도
        </button>
      </div>
    </div>
  );
}

function countScriptParts(script: string): number {
  if (!script) return 0;
  const matches = script.match(/^##\s+파트\s*\d+:/gm);
  return matches ? matches.length : 0;
}

function fileNameForMeta(m: GeneratedImageEntry): string {
  const parts = m.filePath.split("/");
  return parts[parts.length - 1];
}

function AssetCheckUI({
  projectId,
  script,
  assets,
  generatedMeta,
  onConfirm,
  onRefresh,
  onRegenerate,
}: {
  projectId: string;
  script: string;
  assets: AssetsPayload;
  generatedMeta: GeneratedImageEntry[];
  onConfirm: () => void;
  onRefresh: () => void;
  onRegenerate: (partNumber: number) => void;
}) {
  const directions: { partNumber: number; part: string; direction: string }[] = [];
  const lines = script.split("\n");
  let currentPart = "";
  let currentPartNum = 0;
  for (const line of lines) {
    const partMatch = line.match(/^##\s+파트\s*(\d+):\s*(.+)/);
    if (partMatch) {
      currentPartNum = parseInt(partMatch[1]);
      currentPart = partMatch[0];
    }
    const dirMatch = line.match(/\[영상\s*지시:\s*(.+?)\]/);
    if (dirMatch) {
      directions.push({
        partNumber: currentPartNum,
        part: currentPart,
        direction: dirMatch[1],
      });
    }
  }

  const byPart = new Map<number, GeneratedImageEntry>();
  for (const g of generatedMeta) {
    if (!byPart.has(g.partNumber) || g.sequence > (byPart.get(g.partNumber)?.sequence ?? -1)) {
      byPart.set(g.partNumber, g);
    }
  }
  const parts = Array.from(byPart.values()).sort((a, b) => a.partNumber - b.partNumber);
  const totalParts = countScriptParts(script);
  const userAssets = assets.images.length + assets.videos.length;

  return (
    <div>
      <h3 className="text-lg font-bold mb-2">생성 이미지 확인</h3>
      <p className="text-sm text-gray-500 mb-6">
        Gemini가 각 파트에 맞게 생성한 이미지입니다. 마음에 들지 않는 파트는 개별 재생성하세요.
      </p>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-400">
          생성 완료: {parts.length} / {totalParts} 파트
        </span>
        <button
          onClick={onRefresh}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {parts.map((p) => {
          const direction = directions.find((d) => d.partNumber === p.partNumber);
          return (
            <div key={p.partNumber} className="border border-gray-800 rounded-lg overflow-hidden">
              <img
                src={`/api/projects/${projectId}/image/${fileNameForMeta(p)}`}
                alt={`part ${p.partNumber}`}
                className="w-full aspect-video object-cover bg-black"
              />
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">파트 {p.partNumber}</span>
                  <div className="flex gap-1">
                    <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                      {p.sectionType}
                    </span>
                    <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                      {p.style}
                    </span>
                  </div>
                </div>
                {direction && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                    {direction.direction}
                  </p>
                )}
                <button
                  onClick={() => onRegenerate(p.partNumber)}
                  className="w-full text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1.5 rounded"
                >
                  이 파트 재생성
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {userAssets > 0 && (
        <details className="mb-6 border border-gray-800 rounded-lg">
          <summary className="px-4 py-2 text-xs text-gray-500 cursor-pointer">
            사용자 추가 에셋 ({userAssets}개) — projects/{projectId}/assets/images|videos/
          </summary>
          <div className="p-4 flex flex-wrap gap-2">
            {assets.images.map((img) => (
              <span key={img} className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300">
                {img}
              </span>
            ))}
            {assets.videos.map((vid) => (
              <span key={vid} className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300">
                {vid}
              </span>
            ))}
          </div>
        </details>
      )}

      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={parts.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-medium"
        >
          모든 이미지 확인 완료 → TTS 진행
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

interface YouTubeAuthStatus {
  connected: boolean;
  clientConfigured: boolean;
  scopes: string[];
}

interface UploadState {
  status: "idle" | "starting" | "uploading" | "thumbnail" | "done" | "error";
  videoId?: string;
  error?: string;
  uploadedAt?: string;
  url?: string;
  bytesSent?: number;
  bytesTotal?: number;
}

function CompleteView({ projectId, topic }: { projectId: string; topic: string }) {
  const [ytStatus, setYtStatus] = useState<YouTubeAuthStatus | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [form, setForm] = useState({
    title: topic || decodeURIComponent(projectId),
    description: "",
    tags: "철학, 심리학",
    categoryId: "27",
    privacyStatus: "private" as "private" | "unlisted" | "public",
    madeForKids: false,
    thumbnailDataUrl: "" as string,
  });

  const refreshAuth = useCallback(async () => {
    const r = await fetch(`/api/youtube/oauth/status`);
    setYtStatus(await r.json());
  }, []);

  const refreshUpload = useCallback(async () => {
    const r = await fetch(`/api/projects/${projectId}/upload`);
    setUploadState(await r.json());
  }, [projectId]);

  useEffect(() => {
    refreshAuth();
    refreshUpload();
  }, [refreshAuth, refreshUpload]);

  useEffect(() => {
    if (uploadState.status === "uploading" || uploadState.status === "starting" || uploadState.status === "thumbnail") {
      const t = setInterval(refreshUpload, 2000);
      return () => clearInterval(t);
    }
  }, [uploadState.status, refreshUpload]);

  async function connectYouTube() {
    const r = await fetch(`/api/youtube/oauth/url`);
    const data = await r.json();
    if (data.error) {
      alert(`OAuth URL 생성 실패: ${data.error}`);
      return;
    }
    window.open(data.url, "_blank", "width=520,height=680");
    // Poll the status a few times while the user completes auth.
    const t = setInterval(async () => {
      await refreshAuth();
    }, 2000);
    setTimeout(() => clearInterval(t), 120_000);
  }

  async function disconnectYouTube() {
    await fetch(`/api/youtube/oauth/status`, { method: "DELETE" });
    refreshAuth();
  }

  async function onThumbnailChange(file: File | null) {
    if (!file) {
      setForm((f) => ({ ...f, thumbnailDataUrl: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, thumbnailDataUrl: String(reader.result ?? "") }));
    };
    reader.readAsDataURL(file);
  }

  async function startUpload() {
    if (!ytStatus?.connected) {
      alert("먼저 YouTube 계정을 연결하세요.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      description: form.description,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      categoryId: form.categoryId,
      privacyStatus: form.privacyStatus,
      madeForKids: form.madeForKids,
      thumbnailDataUrl: form.thumbnailDataUrl || undefined,
    };
    setUploadState({ status: "starting" });
    const r = await fetch(`/api/projects/${projectId}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (data.error) {
      setUploadState({ status: "error", error: data.error });
      return;
    }
    refreshUpload();
  }

  const uploadProgress =
    uploadState.bytesTotal && uploadState.bytesSent
      ? Math.round((uploadState.bytesSent / uploadState.bytesTotal) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-4xl mb-2">&#10003;</div>
        <p className="text-xl font-bold text-green-400">제작 완료</p>
        {topic && <p className="text-sm text-gray-500 mt-1">주제: {topic}</p>}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">최종 영상</h3>
        <video
          src={`/api/projects/${projectId}/video`}
          controls
          className="w-full bg-black rounded-lg border border-gray-800"
        />
        <div className="mt-2 text-xs">
          <a
            href={`/api/projects/${projectId}/video`}
            download={`${projectId}.mp4`}
            className="text-blue-400 hover:text-blue-300"
          >
            영상 다운로드
          </a>
        </div>
      </div>

      <div className="border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-300">YouTube 업로드</h3>
          {ytStatus && (
            <div className="flex items-center gap-2 text-xs">
              {!ytStatus.clientConfigured && (
                <span className="text-red-400">
                  YOUTUBE_OAUTH_CLIENT_ID / CLIENT_SECRET 미설정
                </span>
              )}
              {ytStatus.clientConfigured && ytStatus.connected && (
                <>
                  <span className="text-green-400">● 연결됨</span>
                  <button
                    onClick={disconnectYouTube}
                    className="text-gray-500 hover:text-gray-300 underline"
                  >
                    해제
                  </button>
                </>
              )}
              {ytStatus.clientConfigured && !ytStatus.connected && (
                <button
                  onClick={connectYouTube}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                >
                  YouTube 계정 연결
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="text-xs text-gray-500">
            제목
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm"
              maxLength={100}
            />
          </label>
          <label className="text-xs text-gray-500">
            설명
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm h-32 font-mono"
            />
          </label>
          <label className="text-xs text-gray-500">
            태그 (쉼표 구분)
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              공개 범위
              <select
                value={form.privacyStatus}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    privacyStatus: e.target.value as "private" | "unlisted" | "public",
                  }))
                }
                className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm"
              >
                <option value="private">비공개</option>
                <option value="unlisted">일부 공개 (링크)</option>
                <option value="public">공개</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              카테고리
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="mt-1 w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-sm"
              >
                <option value="27">교육</option>
                <option value="22">People &amp; Blogs</option>
                <option value="24">엔터테인먼트</option>
                <option value="28">Science &amp; Technology</option>
              </select>
            </label>
          </div>
          <label className="text-xs text-gray-500">
            썸네일 (선택, 1280×720 권장)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onThumbnailChange(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm text-gray-300 file:mr-3 file:bg-gray-800 file:text-gray-200 file:px-3 file:py-1.5 file:border-0 file:rounded"
            />
            {form.thumbnailDataUrl && (
              <img
                src={form.thumbnailDataUrl}
                alt="thumbnail"
                className="mt-2 h-24 rounded border border-gray-800"
              />
            )}
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={form.madeForKids}
              onChange={(e) => setForm((f) => ({ ...f, madeForKids: e.target.checked }))}
            />
            아동용 콘텐츠로 지정
          </label>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={startUpload}
            disabled={
              !ytStatus?.connected ||
              uploadState.status === "uploading" ||
              uploadState.status === "starting" ||
              uploadState.status === "thumbnail"
            }
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-2 rounded text-sm font-medium"
          >
            {uploadState.status === "idle" || uploadState.status === "done" || uploadState.status === "error"
              ? "YouTube에 업로드"
              : "업로드 중..."}
          </button>

          {uploadState.status === "uploading" && (
            <span className="text-xs text-gray-400">
              {uploadProgress}% ({formatBytes(uploadState.bytesSent ?? 0)}/
              {formatBytes(uploadState.bytesTotal ?? 0)})
            </span>
          )}
          {uploadState.status === "thumbnail" && (
            <span className="text-xs text-gray-400">썸네일 업로드 중...</span>
          )}
          {uploadState.status === "done" && uploadState.url && (
            <a
              href={uploadState.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-green-400 hover:text-green-300 underline"
            >
              업로드 완료 → {uploadState.url}
            </a>
          )}
          {uploadState.status === "error" && (
            <span className="text-xs text-red-400">오류: {uploadState.error}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function ProgressPanel({
  progress,
  onResume,
}: {
  progress: ProgressPayload;
  onResume?: () => void;
}) {
  const started = progress.startedAt ? new Date(progress.startedAt).toLocaleTimeString() : "-";
  const ended = progress.finishedAt ? new Date(progress.finishedAt).toLocaleTimeString() : null;
  const lastBeat = progress.lastHeartbeatAt
    ? new Date(progress.lastHeartbeatAt).toLocaleTimeString()
    : null;

  return (
    <div className="max-w-2xl mx-auto border border-gray-800 rounded-lg overflow-hidden">
      {progress.crashed && (
        <div className="bg-red-950 border-b border-red-800 px-4 py-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="text-red-300">
              <strong>작업 중단 감지</strong> — 서버가 재시작되었거나 프로세스가 예상보다
              오래 응답하지 않고 있습니다.
              {lastBeat && (
                <span className="text-red-400 ml-2">마지막 heartbeat: {lastBeat}</span>
              )}
            </div>
            {onResume && (
              <button
                onClick={onResume}
                className="shrink-0 bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1 rounded"
              >
                이어서 재시도
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between bg-gray-900 px-4 py-2 text-xs text-gray-400">
        <span>
          stage: <span className="text-gray-200">{progress.stage}</span>
          {progress.pid && <span className="text-gray-600 ml-2">pid {progress.pid}</span>}
        </span>
        <span>
          {started}
          {ended ? ` → ${ended}` : progress.crashed ? " (crashed)" : " (running)"}
          {progress.exitCode !== undefined && ` · exit ${progress.exitCode}`}
        </span>
      </div>
      {progress.counts && (
        <div className="flex gap-4 px-4 py-2 bg-gray-900 border-t border-gray-800 text-xs text-gray-400">
          <span>이미지 {progress.counts.images ?? 0}</span>
          <span>클립 {progress.counts.clips ?? 0}</span>
          <span>오디오 {progress.counts.audio ?? 0}</span>
        </div>
      )}
      <pre className="bg-black text-gray-300 text-[11px] leading-relaxed p-3 max-h-[220px] overflow-y-auto whitespace-pre-wrap font-mono">
        {progress.tail.length === 0 ? "(no output yet)" : progress.tail.join("\n")}
      </pre>
      {progress.logPath && (
        <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-[10px] text-gray-600">
          full log: <code>{progress.logPath}</code>
        </div>
      )}
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
