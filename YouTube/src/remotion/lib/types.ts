export interface TopicSuggestion {
  rank: number;
  category: string;
  topic: string;
  hookPoint: string;
  competitionLevel: "낮음" | "중간" | "높음";
  existingVideos: string;
  suggestedTitles: string[];
  source: string;
}

export interface ScriptPart {
  partNumber: number;
  partName: string;
  startTime: string;
  endTime: string;
  narration: string;
  visualDirections: string[];
  highlightWords: string[];
}

export interface Script {
  projectId: string;
  topic: string;
  totalDuration: string;
  parts: ScriptPart[];
}

export interface AudioSegment {
  partNumber: number;
  filePath: string;
  durationMs: number;
}

export interface SubtitleEntry {
  text: string;
  startMs: number;
  endMs: number;
  highlight: boolean;
}

export interface AssetMapping {
  partNumber: number;
  assetPath: string;
  startMs: number;
  endMs: number;
  type: "image" | "video";
}

export interface ProjectMeta {
  projectId: string;
  theme: string;
  topic: string;
  createdAt: string;
  status: "research" | "script" | "verified" | "tts" | "rendering" | "complete";
  longformPath?: string;
  shortsPath?: string[];
}
