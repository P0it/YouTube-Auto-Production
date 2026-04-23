/** 지원 언어 (현재 한국어 우선, 영어 확장 슬롯) */
export type Language = "ko" | "en";

/** 파트별 콘텐츠 섹션 타입 — 이미지 스타일 결정에 사용 */
export type SectionType =
  | "hook"
  | "framing"
  | "analysis"
  | "cases"
  | "deep"
  | "synthesis"
  | "outro";

/** 이미지 스타일 — 섹션 타입과 매핑 */
export type ImageStyle = "cinematic" | "illustration";

/** 리서치 결과로 추천된 주제 */
export interface TopicSuggestion {
  rank: number;
  title: string;
  estimatedSearchVolume: string;
  competition: "낮음" | "보통" | "높음";
  reason: string;
  referenceVideos: { title: string; viewCount: number; url: string }[];
}

/** 대본의 개별 파트 */
export interface ScriptPart {
  partNumber: number;
  partName: string;
  startTime: string;
  endTime: string;
  narration: string;
  visualDirections: string[];
  highlightWords: string[];
  sectionType: SectionType;
  sources: string[];
}

/** 전체 대본 */
export interface Script {
  projectId: string;
  topic: string;
  totalDuration: string;
  parts: ScriptPart[];
}

/** TTS 생성 결과 */
export interface AudioSegment {
  partNumber: number;
  filePath: string;
  durationMs: number;
}

/** 자막 항목 */
export interface SubtitleEntry {
  text: string;
  startMs: number;
  endMs: number;
  highlight: boolean;
}

/** 시네마틱 효과 종류 */
export type CinematicEffect =
  | "kenBurnsIn"
  | "kenBurnsOut"
  | "panLeft"
  | "panRight"
  | "pushIn"
  | "pullOut"
  | "static";

/** 에셋 매핑 */
export interface AssetMapping {
  partNumber: number;
  sequence: number;
  assetPath: string;
  type: "image" | "video";
  startMs: number;
  endMs: number;
  effect: CinematicEffect;
  sectionType: SectionType;
}

/** 이미지 생성 결과 메타데이터 — 리젠 시 재현성 확보 */
export interface GeneratedImageMeta {
  partNumber: number;
  sequence: number;
  filePath: string;
  prompt: string;
  model: string;
  sectionType: SectionType;
  style: ImageStyle;
  aspectRatio: "16:9" | "9:16";
  generatedAt: string;
}

/** Veo 비디오 클립 메타데이터 */
export interface GeneratedClipMeta {
  partNumber: number;
  sequence: number;
  filePath: string;
  prompt: string;
  model: string;
  sectionType: SectionType;
  aspectRatio: "16:9" | "9:16";
  durationSeconds: number;
  resolution: "720p" | "1080p" | "4k";
  generatedAt: string;
}

/** 프로젝트 메타데이터 */
export interface ProjectMeta {
  id: string;
  theme: string;
  topic: string;
  language: Language;
  createdAt: string;
  status:
    | "researching"
    | "topic_selection"
    | "scripting"
    | "verifying"
    | "script_approval"
    | "image_generation"
    | "asset_check"
    | "tts"
    | "editing"
    | "shorts"
    | "complete";
}
