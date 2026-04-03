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

/** 에셋 매핑 */
export interface AssetMapping {
  partNumber: number;
  assetPath: string;
  type: "image" | "video";
  startMs: number;
  endMs: number;
}

/** 프로젝트 메타데이터 */
export interface ProjectMeta {
  id: string;
  theme: string;
  topic: string;
  createdAt: string;
  status:
    | "researching"
    | "scripting"
    | "verifying"
    | "tts"
    | "editing"
    | "shorts"
    | "complete";
}
