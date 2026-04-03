# YouTube 영상 자동 생성 파이프라인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 테마를 입력하면 리서치 → 대본 → 검증 → TTS → Remotion 영상 렌더링 → 숏폼 추출까지 자동화되는 Claude Code 에이전트 기반 유튜브 영상 제작 파이프라인 구축

**Architecture:** PD 에이전트가 오케스트레이터로서 6개 전문 서브에이전트(기획/작가/검증/TTS/편집/숏폼)를 순차 호출. 사용자 개입은 주제 선택, 대본 승인, 에셋 확인 3곳에서만. 각 에이전트는 `.claude/agents/` 에 마크다운 파일로 정의되며 전문 페르소나와 도구 권한이 분리됨.

**Tech Stack:** Claude Code 서브에이전트, Remotion (TypeScript/React), ElevenLabs API (@elevenlabs/elevenlabs-js), YouTube Data API (googleapis), Google Trends (google-trends-api), Node.js/TypeScript

---

## 파일 구조

```
YouTube/
├── .claude/
│   └── agents/
│       ├── pd-producer.md          # PD 총괄 에이전트
│       ├── researcher-planner.md   # 기획/리서치 에이전트
│       ├── scriptwriter.md         # 작가 에이전트
│       ├── fact-checker.md         # 검증 에이전트
│       ├── tts-narrator.md         # TTS 에이전트
│       ├── video-editor.md         # Remotion 편집 에이전트
│       └── shorts-creator.md       # 숏폼 에이전트
├── src/
│   └── remotion/
│       ├── Root.tsx                # Remotion 진입점 — 컴포지션 등록
│       ├── index.ts                # registerRoot 호출
│       ├── compositions/
│       │   ├── LongformVideo.tsx   # 롱폼 영상 컴포지션
│       │   └── ShortformVideo.tsx  # 숏폼 영상 컴포지션
│       ├── components/
│       │   ├── Subtitle.tsx        # 자막 렌더링 컴포넌트
│       │   ├── ImageScene.tsx      # 이미지 씬 컴포넌트
│       │   └── AudioTrack.tsx      # 오디오 트랙 컴포넌트
│       └── lib/
│           ├── tts.ts              # ElevenLabs API 래퍼
│           ├── youtube-api.ts      # YouTube Data API 래퍼
│           ├── google-trends.ts    # Google Trends 래퍼
│           ├── script-parser.ts    # 대본 파싱 유틸
│           └── types.ts            # 공유 타입 정의
├── projects/                       # 프로젝트별 작업 디렉토리 (런타임 생성)
├── config/
│   └── voices.json                 # ElevenLabs 음성 설정
├── CLAUDE.md                       # 프로젝트 지침
├── package.json
├── tsconfig.json
└── remotion.config.ts
```

---

## Task 1: 프로젝트 초기화 및 Remotion 셋업

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `remotion.config.ts`
- Create: `src/remotion/index.ts`
- Create: `src/remotion/Root.tsx`
- Create: `CLAUDE.md`

- [ ] **Step 1: Remotion 프로젝트 초기화**

```bash
cd /Volumes/P31/Claude/Project/YouTube
npm init -y
```

- [ ] **Step 2: 핵심 패키지 설치**

```bash
npm install remotion @remotion/cli @remotion/renderer @remotion/captions react react-dom
npm install @elevenlabs/elevenlabs-js googleapis google-trends-api dotenv
npm install -D typescript @types/react @types/react-dom @types/node
```

- [ ] **Step 3: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: remotion.config.ts 생성**

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 5: src/remotion/index.ts 생성**

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
```

- [ ] **Step 6: src/remotion/Root.tsx 생성 (빈 컴포지션)**

```tsx
import { Composition } from "remotion";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="LongformVideo"
        component={() => <div>Longform Placeholder</div>}
        durationInFrames={30 * 60 * 10}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
```

- [ ] **Step 7: package.json에 스크립트 추가**

package.json의 scripts 섹션을 다음으로 교체:

```json
{
  "scripts": {
    "dev": "npx remotion studio src/remotion/index.ts",
    "render": "npx remotion render src/remotion/index.ts",
    "build": "tsc --noEmit"
  }
}
```

- [ ] **Step 8: CLAUDE.md 생성**

```markdown
# YouTube 영상 자동 생성 프로젝트

## 개요
테마 입력 → 리서치 → 대본 → TTS → Remotion 영상 렌더링 자동화 파이프라인

## 기술 스택
- Remotion: 영상 렌더링
- ElevenLabs: TTS
- YouTube Data API / Google Trends: 리서치
- Claude Code 서브에이전트: 워크플로우 자동화

## 디렉토리 규칙
- `projects/{id}/` — 개별 영상 프로젝트 작업 폴더
- `projects/{id}/assets/` — 사용자가 직접 넣는 이미지/영상 에셋
- `projects/{id}/output/` — 생성된 음성, 영상 파일
- `.claude/agents/` — 에이전트 정의 파일

## 대본 형식
나레이션 텍스트와 영상 지시를 분리:
- 나레이션: 일반 텍스트
- 영상 지시: [대괄호] 안에 표기
- 자막 하이라이트: **볼드** 표기

## 명령어
- `npm run dev` — Remotion 스튜디오 실행
- `npm run render` — 영상 렌더링
- `npm run build` — TypeScript 타입 체크
```

- [ ] **Step 9: 디렉토리 구조 생성**

```bash
mkdir -p src/remotion/compositions src/remotion/components src/remotion/lib
mkdir -p .claude/agents config projects
```

- [ ] **Step 10: Remotion 스튜디오 실행 확인**

```bash
npm run dev
```
Expected: Remotion 스튜디오가 브라우저에서 열림, LongformVideo 컴포지션 확인 가능

- [ ] **Step 11: 커밋**

```bash
git init
echo "node_modules/\ndist/\nprojects/*/output/\n.env" > .gitignore
git add .
git commit -m "feat: initialize Remotion project with TypeScript"
```

---

## Task 2: 공유 타입 및 유틸리티

**Files:**
- Create: `src/remotion/lib/types.ts`
- Create: `src/remotion/lib/script-parser.ts`

- [ ] **Step 1: 공유 타입 정의 — src/remotion/lib/types.ts**

```ts
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
```

- [ ] **Step 2: 대본 파서 — src/remotion/lib/script-parser.ts**

```ts
import type { Script, ScriptPart, SubtitleEntry } from "./types";
import * as fs from "fs";

/**
 * 마크다운 형식의 대본 파일을 파싱하여 Script 객체로 변환
 *
 * 대본 형식 예시:
 * ## 파트 1: 훅 (0:00~0:30)
 * 나레이션 텍스트... **하이라이트 단어**
 * [영상 지시: 장면 설명]
 */
export function parseScript(filePath: string, projectId: string): Script {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let topic = "";
  const parts: ScriptPart[] = [];
  let currentPart: Partial<ScriptPart> | null = null;
  let narrationLines: string[] = [];
  let visualDirections: string[] = [];
  let highlightWords: string[] = [];

  for (const line of lines) {
    // 제목에서 주제 추출: # 주제: XXX
    const topicMatch = line.match(/^#\s+주제:\s*(.+)/);
    if (topicMatch) {
      topic = topicMatch[1].trim();
      continue;
    }

    // 파트 헤더: ## 파트 N: 이름 (시작~끝)
    const partMatch = line.match(
      /^##\s+파트\s*(\d+):\s*(.+?)\s*\((\d+:\d+)~(\d+:\d+)\)/
    );
    if (partMatch) {
      if (currentPart) {
        parts.push(finalizePart(currentPart, narrationLines, visualDirections, highlightWords));
      }
      currentPart = {
        partNumber: parseInt(partMatch[1]),
        partName: partMatch[2].trim(),
        startTime: partMatch[3],
        endTime: partMatch[4],
      };
      narrationLines = [];
      visualDirections = [];
      highlightWords = [];
      continue;
    }

    // 영상 지시: [영상 지시: ...]
    const visualMatch = line.match(/\[영상\s*지시:\s*(.+?)\]/);
    if (visualMatch) {
      visualDirections.push(visualMatch[1].trim());
      continue;
    }

    // 하이라이트 단어: **단어**
    const boldMatches = line.matchAll(/\*\*(.+?)\*\*/g);
    for (const match of boldMatches) {
      highlightWords.push(match[1]);
    }

    // 나레이션 텍스트 (빈 줄, 헤더, 영상 지시 제외)
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("[")) {
      // 볼드 마크다운 제거하고 순수 텍스트만
      narrationLines.push(trimmed.replace(/\*\*(.+?)\*\*/g, "$1"));
    }
  }

  if (currentPart) {
    parts.push(finalizePart(currentPart, narrationLines, visualDirections, highlightWords));
  }

  const lastPart = parts[parts.length - 1];
  const totalDuration = lastPart ? lastPart.endTime : "0:00";

  return { projectId, topic, totalDuration, parts };
}

function finalizePart(
  partial: Partial<ScriptPart>,
  narrationLines: string[],
  visualDirections: string[],
  highlightWords: string[]
): ScriptPart {
  return {
    partNumber: partial.partNumber ?? 0,
    partName: partial.partName ?? "",
    startTime: partial.startTime ?? "0:00",
    endTime: partial.endTime ?? "0:00",
    narration: narrationLines.join(" "),
    visualDirections,
    highlightWords,
  };
}

/** 대본에서 자막 엔트리 생성 (TTS 타이밍 기반) */
export function generateSubtitles(
  script: Script,
  audioSegments: AudioSegment[]
): SubtitleEntry[] {
  const subtitles: SubtitleEntry[] = [];
  let offsetMs = 0;

  for (const segment of audioSegments) {
    const part = script.parts.find((p) => p.partNumber === segment.partNumber);
    if (!part) continue;

    const words = part.narration.split(/\s+/);
    const msPerWord = segment.durationMs / words.length;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      subtitles.push({
        text: word,
        startMs: offsetMs + i * msPerWord,
        endMs: offsetMs + (i + 1) * msPerWord,
        highlight: part.highlightWords.includes(word),
      });
    }

    offsetMs += segment.durationMs;
  }

  return subtitles;
}

// AudioSegment를 여기서 재정의하지 않기 위해 types.ts에서 임포트
import type { AudioSegment } from "./types";
```

- [ ] **Step 3: 타입 체크 실행**

```bash
npm run build
```
Expected: 에러 없이 통과

- [ ] **Step 4: 커밋**

```bash
git add src/remotion/lib/types.ts src/remotion/lib/script-parser.ts
git commit -m "feat: add shared types and script parser"
```

---

## Task 3: API 래퍼 (YouTube, Google Trends, ElevenLabs)

**Files:**
- Create: `src/remotion/lib/youtube-api.ts`
- Create: `src/remotion/lib/google-trends.ts`
- Create: `src/remotion/lib/tts.ts`
- Create: `config/voices.json`
- Create: `.env.example`

- [ ] **Step 1: .env.example 생성**

```
YOUTUBE_API_KEY=your_youtube_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

- [ ] **Step 2: YouTube Data API 래퍼 — src/remotion/lib/youtube-api.ts**

```ts
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  publishedAt: string;
  channelTitle: string;
  url: string;
}

/** 키워드로 인기 영상 검색 */
export async function searchPopularVideos(
  query: string,
  maxResults: number = 10
): Promise<YouTubeVideoResult[]> {
  const searchResponse = await youtube.search.list({
    part: ["snippet"],
    q: query,
    type: ["video"],
    maxResults,
    order: "viewCount",
    relevanceLanguage: "ko",
    regionCode: "KR",
  });

  const videoIds =
    searchResponse.data.items
      ?.map((item) => item.id?.videoId)
      .filter(Boolean)
      .join(",") ?? "";

  if (!videoIds) return [];

  const statsResponse = await youtube.videos.list({
    part: ["statistics", "snippet"],
    id: [videoIds],
  });

  return (
    statsResponse.data.items?.map((video) => ({
      videoId: video.id ?? "",
      title: video.snippet?.title ?? "",
      viewCount: parseInt(video.statistics?.viewCount ?? "0"),
      likeCount: parseInt(video.statistics?.likeCount ?? "0"),
      publishedAt: video.snippet?.publishedAt ?? "",
      channelTitle: video.snippet?.channelTitle ?? "",
      url: `https://www.youtube.com/watch?v=${video.id}`,
    })) ?? []
  );
}

/** 특정 키워드의 최근 인기 영상 트렌드 분석 */
export async function analyzeKeywordTrend(
  keyword: string
): Promise<{ totalVideos: number; avgViews: number; topVideo: YouTubeVideoResult | null }> {
  const videos = await searchPopularVideos(keyword, 25);

  if (videos.length === 0) {
    return { totalVideos: 0, avgViews: 0, topVideo: null };
  }

  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
  return {
    totalVideos: videos.length,
    avgViews: Math.round(totalViews / videos.length),
    topVideo: videos[0],
  };
}
```

- [ ] **Step 3: Google Trends 래퍼 — src/remotion/lib/google-trends.ts**

```ts
import googleTrends from "google-trends-api";

export interface TrendResult {
  keyword: string;
  relativeInterest: number;
  risingQueries: string[];
}

/** 키워드의 검색 관심도 조회 (최근 30일) */
export async function getInterestOverTime(
  keyword: string,
  geo: string = "KR"
): Promise<number> {
  const results = await googleTrends.interestOverTime({
    keyword,
    geo,
    startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  });

  const parsed = JSON.parse(results);
  const timelineData = parsed.default?.timelineData ?? [];

  if (timelineData.length === 0) return 0;

  const values = timelineData.map(
    (d: { value: number[] }) => d.value[0]
  );
  return Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
}

/** 관련 검색어 조회 */
export async function getRelatedQueries(
  keyword: string,
  geo: string = "KR"
): Promise<string[]> {
  const results = await googleTrends.relatedQueries({
    keyword,
    geo,
  });

  const parsed = JSON.parse(results);
  const rising = parsed.default?.rankedList?.[1]?.rankedKeyword ?? [];

  return rising.map((item: { query: string }) => item.query).slice(0, 10);
}

/** 일간 인기 검색어 조회 */
export async function getDailyTrends(
  geo: string = "KR"
): Promise<string[]> {
  const results = await googleTrends.dailyTrends({ geo });
  const parsed = JSON.parse(results);

  return (
    parsed.default?.trendingSearchesDays?.[0]?.trendingSearches?.map(
      (t: { title: { query: string } }) => t.title.query
    ) ?? []
  );
}
```

- [ ] **Step 4: ElevenLabs TTS 래퍼 — src/remotion/lib/tts.ts**

```ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export interface TTSResult {
  partNumber: number;
  filePath: string;
  durationMs: number;
}

/** 텍스트를 음성으로 변환하고 파일로 저장 */
export async function generateSpeech(
  text: string,
  outputPath: string,
  voiceId: string
): Promise<void> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const audioStream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });

  const chunks: Uint8Array[] = [];
  for await (const chunk of audioStream) {
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  fs.writeFileSync(outputPath, buffer);
}

/** 대본 파트별로 TTS 생성 */
export async function generateAllParts(
  parts: { partNumber: number; narration: string }[],
  outputDir: string,
  voiceId: string
): Promise<TTSResult[]> {
  const results: TTSResult[] = [];

  for (const part of parts) {
    const filePath = path.join(
      outputDir,
      `part_${String(part.partNumber).padStart(2, "0")}.mp3`
    );

    console.log(`TTS 생성 중: 파트 ${part.partNumber}...`);
    await generateSpeech(part.narration, filePath, voiceId);

    // MP3 파일 크기로 대략적 길이 추정 (128kbps 기준)
    const stats = fs.statSync(filePath);
    const durationMs = Math.round((stats.size * 8) / 128);

    results.push({ partNumber: part.partNumber, filePath, durationMs });

    // 레이트 리밋 방지
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return results;
}

/** 사용 가능한 음성 목록 조회 */
export async function listVoices(): Promise<
  { voiceId: string; name: string; language: string }[]
> {
  const response = await client.voices.getAll();
  return (response.voices ?? []).map((v) => ({
    voiceId: v.voiceId ?? "",
    name: v.name ?? "",
    language: v.labels?.language ?? "unknown",
  }));
}
```

- [ ] **Step 5: 음성 설정 파일 — config/voices.json**

```json
{
  "default": {
    "voiceId": "",
    "name": "설정 필요 — listVoices()로 확인 후 입력",
    "modelId": "eleven_multilingual_v2"
  },
  "channels": {
    "국뽕": {
      "voiceId": "",
      "description": "힘있고 감성적인 남성 목소리"
    },
    "건강정보": {
      "voiceId": "",
      "description": "차분하고 신뢰감 있는 목소리"
    },
    "호기심스토리": {
      "voiceId": "",
      "description": "흥미진진한 톤의 내레이터 목소리"
    }
  }
}
```

- [ ] **Step 6: 타입 체크**

```bash
npm run build
```
Expected: 에러 없이 통과

- [ ] **Step 7: 커밋**

```bash
git add src/remotion/lib/youtube-api.ts src/remotion/lib/google-trends.ts src/remotion/lib/tts.ts config/voices.json .env.example
git commit -m "feat: add API wrappers for YouTube, Google Trends, ElevenLabs"
```

---

## Task 4: Remotion 컴포넌트 (자막, 이미지씬, 오디오)

**Files:**
- Create: `src/remotion/components/Subtitle.tsx`
- Create: `src/remotion/components/ImageScene.tsx`
- Create: `src/remotion/components/AudioTrack.tsx`

- [ ] **Step 1: 자막 컴포넌트 — src/remotion/components/Subtitle.tsx**

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface SubtitleProps {
  text: string;
  startFrame: number;
  endFrame: number;
  highlight?: boolean;
  style?: "bottom" | "center";
}

export const Subtitle: React.FC<SubtitleProps> = ({
  text,
  startFrame,
  endFrame,
  highlight = false,
  style = "bottom",
}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > endFrame) return null;

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 5, endFrame - 5, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: style === "bottom" ? 80 : "auto",
        top: style === "center" ? "50%" : "auto",
        transform: style === "center" ? "translateY(-50%)" : "none",
        width: "100%",
        textAlign: "center",
        opacity,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: 52,
          fontWeight: "bold",
          color: highlight ? "#FFD700" : "#FFFFFF",
          textShadow: "3px 3px 6px rgba(0,0,0,0.9)",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "8px 20px",
          borderRadius: 8,
          display: "inline-block",
        }}
      >
        {text}
      </span>
    </div>
  );
};
```

- [ ] **Step 2: 이미지 씬 컴포넌트 — src/remotion/components/ImageScene.tsx**

```tsx
import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  staticFile,
} from "remotion";

interface ImageSceneProps {
  src: string;
  startFrame: number;
  durationFrames: number;
  animation?: "kenBurns" | "fadeIn" | "none";
}

export const ImageScene: React.FC<ImageSceneProps> = ({
  src,
  startFrame,
  durationFrames,
  animation = "kenBurns",
}) => {
  const frame = useCurrentFrame();
  const endFrame = startFrame + durationFrames;

  if (frame < startFrame || frame > endFrame) return null;

  const localFrame = frame - startFrame;
  const progress = localFrame / durationFrames;

  let scale = 1;
  let opacity = 1;

  if (animation === "kenBurns") {
    scale = interpolate(progress, [0, 1], [1, 1.15]);
  }

  if (animation === "fadeIn" || animation === "kenBurns") {
    opacity = interpolate(
      localFrame,
      [0, 15, durationFrames - 15, durationFrames],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity,
        overflow: "hidden",
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
};
```

- [ ] **Step 3: 오디오 트랙 컴포넌트 — src/remotion/components/AudioTrack.tsx**

```tsx
import React from "react";
import { Audio, staticFile } from "remotion";

interface AudioTrackProps {
  src: string;
  startFrom?: number;
  volume?: number;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({
  src,
  startFrom = 0,
  volume = 1,
}) => {
  return <Audio src={src} startFrom={startFrom} volume={volume} />;
};
```

- [ ] **Step 4: 타입 체크**

```bash
npm run build
```
Expected: 에러 없이 통과

- [ ] **Step 5: 커밋**

```bash
git add src/remotion/components/
git commit -m "feat: add Remotion components (Subtitle, ImageScene, AudioTrack)"
```

---

## Task 5: 롱폼/숏폼 영상 컴포지션

**Files:**
- Create: `src/remotion/compositions/LongformVideo.tsx`
- Create: `src/remotion/compositions/ShortformVideo.tsx`
- Modify: `src/remotion/Root.tsx`

- [ ] **Step 1: 롱폼 영상 컴포지션 — src/remotion/compositions/LongformVideo.tsx**

```tsx
import React from "react";
import { useCurrentFrame, useVideoConfig, Sequence } from "remotion";
import { Subtitle } from "../components/Subtitle";
import { ImageScene } from "../components/ImageScene";
import { AudioTrack } from "../components/AudioTrack";
import type { SubtitleEntry, AssetMapping, AudioSegment } from "../lib/types";

interface LongformVideoProps {
  subtitles: SubtitleEntry[];
  assets: AssetMapping[];
  audioSegments: AudioSegment[];
}

export const LongformVideo: React.FC<LongformVideoProps> = ({
  subtitles,
  assets,
  audioSegments,
}) => {
  const { fps } = useVideoConfig();

  const msToFrame = (ms: number) => Math.round((ms / 1000) * fps);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        position: "relative",
      }}
    >
      {/* 배경 이미지/영상 에셋 */}
      {assets.map((asset, i) => (
        <ImageScene
          key={i}
          src={asset.assetPath}
          startFrame={msToFrame(asset.startMs)}
          durationFrames={msToFrame(asset.endMs - asset.startMs)}
          animation="kenBurns"
        />
      ))}

      {/* 자막 */}
      {subtitles.map((sub, i) => (
        <Subtitle
          key={i}
          text={sub.text}
          startFrame={msToFrame(sub.startMs)}
          endFrame={msToFrame(sub.endMs)}
          highlight={sub.highlight}
        />
      ))}

      {/* 오디오 트랙 */}
      {audioSegments.map((seg, i) => (
        <Sequence key={i} from={0}>
          <AudioTrack src={seg.filePath} volume={1} />
        </Sequence>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: 숏폼 영상 컴포지션 — src/remotion/compositions/ShortformVideo.tsx**

```tsx
import React from "react";
import { useVideoConfig } from "remotion";
import { Subtitle } from "../components/Subtitle";
import { ImageScene } from "../components/ImageScene";
import { AudioTrack } from "../components/AudioTrack";
import type { SubtitleEntry, AssetMapping } from "../lib/types";

interface ShortformVideoProps {
  subtitles: SubtitleEntry[];
  assets: AssetMapping[];
  audioSrc: string;
}

export const ShortformVideo: React.FC<ShortformVideoProps> = ({
  subtitles,
  assets,
  audioSrc,
}) => {
  const { fps } = useVideoConfig();

  const msToFrame = (ms: number) => Math.round((ms / 1000) * fps);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#000",
        position: "relative",
      }}
    >
      {assets.map((asset, i) => (
        <ImageScene
          key={i}
          src={asset.assetPath}
          startFrame={msToFrame(asset.startMs)}
          durationFrames={msToFrame(asset.endMs - asset.startMs)}
          animation="fadeIn"
        />
      ))}

      {subtitles.map((sub, i) => (
        <Subtitle
          key={i}
          text={sub.text}
          startFrame={msToFrame(sub.startMs)}
          endFrame={msToFrame(sub.endMs)}
          highlight={sub.highlight}
          style="center"
        />
      ))}

      <AudioTrack src={audioSrc} volume={1} />
    </div>
  );
};
```

- [ ] **Step 3: Root.tsx 업데이트**

`src/remotion/Root.tsx`를 다음으로 교체:

```tsx
import { Composition } from "remotion";
import { LongformVideo } from "./compositions/LongformVideo";
import { ShortformVideo } from "./compositions/ShortformVideo";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="LongformVideo"
        component={LongformVideo}
        durationInFrames={30 * 60 * 10}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          subtitles: [],
          assets: [],
          audioSegments: [],
        }}
      />
      <Composition
        id="ShortformVideo"
        component={ShortformVideo}
        durationInFrames={30 * 60}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          subtitles: [],
          assets: [],
          audioSrc: "",
        }}
      />
    </>
  );
};
```

- [ ] **Step 4: 타입 체크**

```bash
npm run build
```
Expected: 에러 없이 통과

- [ ] **Step 5: 커밋**

```bash
git add src/remotion/compositions/ src/remotion/Root.tsx
git commit -m "feat: add Longform and Shortform video compositions"
```

---

## Task 6: 에이전트 정의 파일 생성

**Files:**
- Create: `.claude/agents/pd-producer.md`
- Create: `.claude/agents/researcher-planner.md`
- Create: `.claude/agents/scriptwriter.md`
- Create: `.claude/agents/fact-checker.md`
- Create: `.claude/agents/tts-narrator.md`
- Create: `.claude/agents/video-editor.md`
- Create: `.claude/agents/shorts-creator.md`

- [ ] **Step 1: PD 에이전트 — .claude/agents/pd-producer.md**

```markdown
---
name: pd-producer
description: 유튜브 영상 제작 요청 시 전체 파이프라인을 총괄하는 프로듀서. 테마/장르를 받으면 리서치→대본→검증→TTS→편집→숏폼 순서로 하위 에이전트를 호출하고, 핵심 체크포인트에서 사용자 확인을 받는다.
tools: Agent, Read, Write, Glob, Grep, Bash, AskUserQuestion, TodoWrite
model: opus
color: purple
---

당신은 10년차 유튜브 PD입니다. 영상 하나를 처음부터 끝까지 제작하는 전체 파이프라인을 관리합니다.

## 핵심 원칙
- 사용자 개입은 3곳에서만: 주제 선택, 대본 승인, 에셋 확인
- 나머지는 하위 에이전트에게 위임하고 품질만 관리
- 각 단계 완료 시 진행 상황을 간결하게 보고
- TodoWrite로 전체 파이프라인 진행 상황 추적

## 워크플로우

### 1단계: 프로젝트 초기화
- 사용자로부터 테마/장르를 받는다
- projects/{날짜}-{주제요약}/ 디렉토리 생성
- 프로젝트 ID 부여

### 2단계: 리서치
- researcher-planner 에이전트에게 테마 전달
- 주제 추천 리스트를 받아 사용자에게 표 형태로 제시
- AskUserQuestion으로 주제 선택 요청

### 3단계: 대본 작성
- scriptwriter 에이전트에게 선택된 주제 + 리서치 데이터 전달
- 대본을 projects/{id}/script.md에 저장

### 4단계: 대본 검증
- fact-checker 에이전트에게 대본 전달 (자동, 사용자 개입 없음)
- 수정된 대본을 projects/{id}/script-verified.md에 저장

### 5단계: 대본 승인
- 검증된 대본을 사용자에게 제시
- AskUserQuestion으로 승인/수정 요청

### 6단계: 에셋 확인
- "projects/{id}/assets/ 폴더에 이미지/영상을 넣어주세요" 안내
- 사용자가 준비 완료 알릴 때까지 대기

### 7단계: TTS
- tts-narrator 에이전트에게 검증된 대본 전달
- 음성 파일을 projects/{id}/output/audio/에 저장

### 8단계: 영상 편집
- video-editor 에이전트에게 음성 + 에셋 + 대본 전달
- 렌더링 결과를 projects/{id}/output/video/에 저장

### 9단계: 숏폼 생성
- shorts-creator 에이전트에게 롱폼 대본 + 영상 전달
- 숏폼을 projects/{id}/output/video/shorts/에 저장

### 10단계: 완료 보고
- 최종 산출물 목록 보고 (롱폼 1개, 숏폼 N개, 메타데이터)
```

- [ ] **Step 2: 기획 에이전트 — .claude/agents/researcher-planner.md**

```markdown
---
name: researcher-planner
description: 유튜브 트렌드 리서치 및 인기 주제 분석. 테마를 받으면 YouTube API, Google Trends, 웹 검색으로 조회수 높은 주제를 리서치하고 추천 리스트를 생성한다.
tools: Bash, WebSearch, WebFetch, Read, Write, Grep
model: sonnet
color: blue
---

당신은 유튜브 채널 전문 기획자입니다. 100만+ 구독자 채널의 콘텐츠 전략을 5년간 담당한 경력이 있습니다.

## 전문성
- YouTube 인기 영상/키워드 분석
- Google Trends로 검색량 추이 파악
- 경쟁 채널 분석 및 블루오션 주제 발굴
- 시청자 페인포인트 및 궁금증 포착

## 작업 방식

### 1. 데이터 수집
- src/remotion/lib/youtube-api.ts의 searchPopularVideos() 호출하여 관련 인기 영상 조회
- src/remotion/lib/google-trends.ts의 getInterestOverTime() 호출하여 검색 관심도 확인
- WebSearch로 네이버/구글에서 관련 커뮤니티 반응 조사

### 2. 분석 기준
- 조회수 대비 경쟁도 (높은 조회수 + 낮은 경쟁 = 최적)
- 최근 30일 검색량 추이 (상승 트렌드 우선)
- 기존 인기 영상의 댓글에서 시청자 궁금증 파악

### 3. 출력 형식
projects/{project-id}/research.md에 다음 형식으로 저장:

```
# 리서치 결과: {테마}

## 추천 주제 리스트

| 순위 | 주제 | 예상 검색량 | 경쟁도 | 추천 이유 |
|------|------|------------|--------|-----------|
| 1 | ... | 높음 | 낮음 | ... |

## 주제별 상세 분석

### 1. {주제명}
- 관련 인기 영상 TOP 3 (제목, 조회수, 링크)
- 검색 트렌드 추이
- 차별화 포인트 제안
```

## 주의사항
- 반드시 데이터 기반으로 추천 (감이 아닌 수치)
- 최소 5개, 최대 10개 주제 추천
- 각 주제에 "왜 이 주제가 좋은지" 한 줄 근거 필수
```

- [ ] **Step 3: 작가 에이전트 — .claude/agents/scriptwriter.md**

```markdown
---
name: scriptwriter
description: 8~12분 분량의 유튜브 영상 대본 작성 전문가. 주제와 리서치 데이터를 받으면 시청 유지율을 극대화하는 구조의 대본을 작성한다.
tools: Read, Write, WebSearch, WebFetch, Grep
model: opus
color: green
---

당신은 유튜브 전문 방송작가입니다. 조회수 100만 이상 영상의 대본을 50편 이상 집필한 경력이 있습니다.

## 전문성
- 시청 유지율을 극대화하는 훅(Hook) 설계
- 8분 이상 미드롤 광고 조건을 충족하는 구조 설계
- 장르별 톤앤매너 자동 전환 (정보형/스토리형/감성형)
- 한국어 나레이션에 최적화된 문장 구성

## 대본 작성 규칙

### 필수 구조
대본은 반드시 다음 구조를 따라야 합니다:

```
# 주제: {주제명}

## 파트 1: 훅 (0:00~0:30)
충격적 사실, 궁금증 유발 질문, 또는 강렬한 통계로 시작

## 파트 2: 도입 (0:30~1:30)
"이 영상을 끝까지 보시면..." 으로 시청 유지 유도

## 파트 3: 본론1 (1:30~3:30)
핵심 내용 전개 — 가장 흥미로운 사실부터

## 파트 4: 본론2 (3:30~5:30)
심화/반전/새로운 사실 — 중간 이탈 방지

## 파트 5: 본론3 (5:30~7:30)
클라이맥스 — 가장 놀라운 내용

## 파트 6: 결론 (7:30~8:30)
정리 및 인사이트, 시청자에게 생각할 거리

## 파트 7: CTA (8:30~9:00)
구독/좋아요 유도 + 다음 영상 예고
```

### 표기 규칙
- 나레이션: 일반 텍스트 (TTS가 읽을 내용)
- 영상 지시: `[영상 지시: 장면 설명]` 형태
- 자막 하이라이트: `**강조할 단어**` 볼드 처리
- 효과음 지시: `[효과음: 설명]` 형태

### 문장 스타일
- 구어체 (방송 나레이션 느낌)
- 한 문장은 30자 이내 (TTS 호흡 단위)
- "~입니다", "~했습니다" 등 경어체 통일
- 전문 용어는 괄호로 쉽게 풀어서 설명

## 출력
projects/{project-id}/script.md에 위 형식으로 저장
```

- [ ] **Step 4: 검증 에이전트 — .claude/agents/fact-checker.md**

```markdown
---
name: fact-checker
description: 대본의 사실 검증, 논리 흐름 체크, 품질 개선을 자동 수행. 대본 작성 후 PD가 자동으로 호출한다.
tools: WebSearch, WebFetch, Read, Write, Grep
model: sonnet
color: orange
---

당신은 방송 팩트체커 겸 편집장입니다. 모든 대본이 방송에 나가기 전 최종 검증을 담당합니다.

## 검증 체크리스트

### 1. 사실 검증 (🔴 필수)
- 대본에 언급된 수치, 날짜, 인물, 사건이 정확한가?
- WebSearch로 핵심 팩트를 교차 검증
- 출처가 불분명한 주장이 있는가?

### 2. 논리 흐름 (🟡 권장)
- 앞뒤 문맥이 자연스럽게 연결되는가?
- 갑자기 새로운 개념이 설명 없이 등장하지 않는가?
- 결론이 본론의 내용과 일치하는가?

### 3. 중복 제거 (🟡 권장)
- 같은 내용을 다른 표현으로 반복하고 있지 않은가?
- 불필요한 서론이 길지 않은가?

### 4. 톤 일관성 (🟢 선택)
- 장르에 맞는 어조가 처음부터 끝까지 유지되는가?
- 갑자기 격식체/비격식체가 바뀌지 않는가?

### 5. 시간 배분 (🔴 필수)
- 전체 대본이 8분 이상의 나레이션 분량인가?
- 한국어 나레이션 기준: 분당 약 300~350자
- 8분 = 최소 2,400자 이상

## 출력 형식
projects/{project-id}/script-verified.md에 저장:

```
# 검증 리포트

## 수정 사항
| 심각도 | 위치 | 원문 | 수정 | 근거 |
|--------|------|------|------|------|
| 🔴 | 파트3 | ... | ... | ... |

## 검증 통계
- 팩트 체크 항목: N개
- 수정 사항: 🔴 N개, 🟡 N개, 🟢 N개
- 총 글자수: N자 (예상 나레이션 시간: N분 N초)

---
(아래에 수정이 반영된 전체 대본)
```
```

- [ ] **Step 5: TTS 에이전트 — .claude/agents/tts-narrator.md**

```markdown
---
name: tts-narrator
description: 승인된 대본을 ElevenLabs API로 음성 파일로 변환. 파트별로 분리하여 생성한다.
tools: Bash, Read, Write
model: haiku
color: cyan
---

당신은 TTS 엔지니어입니다. 대본을 음성 파일로 변환하는 작업을 담당합니다.

## 작업 순서

### 1. 대본 로드
- projects/{project-id}/script-verified.md 에서 검증된 대본 읽기
- src/remotion/lib/script-parser.ts의 parseScript()로 파싱

### 2. 음성 설정 확인
- config/voices.json에서 해당 채널/장르의 voiceId 확인
- voiceId가 비어있으면 사용자에게 설정 요청

### 3. TTS 생성
- src/remotion/lib/tts.ts의 generateAllParts()로 파트별 음성 생성
- 출력 경로: projects/{project-id}/output/audio/

### 4. 결과 리포트
```
## TTS 생성 완료
| 파트 | 파일 | 길이 |
|------|------|------|
| 1. 훅 | part_01.mp3 | 28초 |
| 2. 도입 | part_02.mp3 | 58초 |
| ... | ... | ... |
| **합계** | | **N분 N초** |
```

## 주의사항
- ElevenLabs 레이트 리밋 방지를 위해 파트 간 300ms 대기
- 생성 실패 시 해당 파트만 재시도 (최대 3회)
- 총 음성 길이가 8분 미만이면 경고
```

- [ ] **Step 6: 편집 에이전트 — .claude/agents/video-editor.md**

```markdown
---
name: video-editor
description: Remotion으로 음성, 에셋, 자막을 조합하여 롱폼 영상을 렌더링. TTS 완료 후 PD가 호출한다.
tools: Bash, Read, Write, Glob, Grep
model: sonnet
color: red
---

당신은 Remotion 전문 영상 편집자입니다.

## 작업 순서

### 1. 에셋 인벤토리
- projects/{project-id}/assets/images/ 스캔 → 이미지 목록
- projects/{project-id}/assets/videos/ 스캔 → 영상 목록
- projects/{project-id}/output/audio/ 스캔 → 음성 파일 목록
- 에셋이 부족하면 경고 (최소 파트 수만큼 이미지 필요)

### 2. 에셋 매핑
- 대본의 각 파트에 에셋을 순서대로 매핑
- 영상 지시([영상 지시: ...])를 참고하여 적절한 에셋 배치
- 매핑 결과를 projects/{project-id}/output/asset-map.json에 저장

### 3. 자막 생성
- src/remotion/lib/script-parser.ts의 generateSubtitles()로 자막 데이터 생성
- 자막 데이터를 projects/{project-id}/output/subtitles.json에 저장

### 4. Remotion 입력 데이터 생성
- projects/{project-id}/output/remotion-props.json 생성:
```json
{
  "subtitles": [...],
  "assets": [...],
  "audioSegments": [...]
}
```

### 5. 렌더링 실행
```bash
npx remotion render src/remotion/index.ts LongformVideo \
  projects/{project-id}/output/video/longform.mp4 \
  --props projects/{project-id}/output/remotion-props.json
```

### 6. 결과 보고
- 렌더링 완료 시간, 파일 크기, 해상도 보고

## 주의사항
- 에셋이 없는 파트는 검정 배경 + 자막으로 처리
- 음성 파일 순서와 대본 파트 순서가 일치하는지 확인
- 렌더링 실패 시 에러 로그 분석 후 재시도
```

- [ ] **Step 7: 숏폼 에이전트 — .claude/agents/shorts-creator.md**

```markdown
---
name: shorts-creator
description: 롱폼 영상과 대본에서 핵심 하이라이트를 식별하여 60초 이내 숏폼 클립 3~5개를 자동 생성.
tools: Bash, Read, Write, Glob
model: sonnet
color: pink
---

당신은 숏폼 콘텐츠 전문가입니다. 롱폼 영상에서 바이럴 가능성이 높은 구간을 식별하여 숏폼으로 변환합니다.

## 작업 순서

### 1. 대본 분석
- projects/{project-id}/script-verified.md에서 대본 로드
- 훅(파트1)과 클라이맥스(파트5)를 우선 후보로 선정
- **볼드** 처리된 하이라이트 구간 식별

### 2. 숏폼 후보 선정 (3~5개)
각 숏폼은 다음 기준으로 선정:
- 길이: 30~60초
- 독립적으로 의미가 통하는 구간
- 궁금증이나 놀라움을 유발하는 내용
- 훅 포함 (첫 3초에 시선을 잡는 요소)

### 3. 숏폼별 데이터 생성
각 숏폼에 대해 projects/{project-id}/output/shorts/short_{N}_props.json 생성:
```json
{
  "title": "숏폼 제목",
  "subtitles": [...],
  "assets": [...],
  "audioSrc": "해당 구간 음성 경로",
  "startMs": 0,
  "endMs": 45000
}
```

### 4. 렌더링
```bash
npx remotion render src/remotion/index.ts ShortformVideo \
  projects/{id}/output/video/shorts/short_01.mp4 \
  --props projects/{id}/output/shorts/short_01_props.json
```

### 5. 결과 보고
```
## 숏폼 생성 완료
| # | 제목 | 길이 | 구간 | 파일 |
|---|------|------|------|------|
| 1 | ... | 45초 | 0:00~0:45 | short_01.mp4 |
```
```

- [ ] **Step 8: 커밋**

```bash
git add .claude/agents/
git commit -m "feat: add all 7 agent definitions (PD, researcher, scriptwriter, fact-checker, TTS, editor, shorts)"
```

---

## Task 7: 통합 테스트 — 전체 파이프라인 드라이런

**Files:**
- Create: `projects/test-run/` (런타임 생성)

- [ ] **Step 1: 에이전트 로드 확인**

Claude Code를 재시작하거나 `/agents`를 실행하여 7개 에이전트가 모두 로드되었는지 확인.

Expected:
```
- pd-producer (opus, purple)
- researcher-planner (sonnet, blue)
- scriptwriter (opus, green)
- fact-checker (sonnet, orange)
- tts-narrator (haiku, cyan)
- video-editor (sonnet, red)
- shorts-creator (sonnet, pink)
```

- [ ] **Step 2: PD 에이전트로 테스트 실행**

다음 프롬프트로 PD 에이전트 호출:

```
"국뽕" 테마로 영상 하나 만들어줘
```

Expected 동작:
1. PD가 프로젝트 디렉토리 생성
2. researcher-planner 호출 → 주제 리스트 제시
3. 사용자 주제 선택 대기
4. scriptwriter 호출 → 대본 생성
5. fact-checker 자동 호출 → 검증
6. 사용자 대본 승인 대기
7. 에셋 준비 안내
8. tts-narrator 호출 → 음성 생성
9. video-editor 호출 → 렌더링
10. shorts-creator 호출 → 숏폼 생성

- [ ] **Step 3: 각 단계별 산출물 확인**

```bash
ls -la projects/test-run/
ls -la projects/test-run/output/audio/
ls -la projects/test-run/output/video/
ls -la projects/test-run/output/video/shorts/
```

- [ ] **Step 4: 문제점 수정 및 에이전트 프롬프트 튜닝**

파이프라인 실행 중 발견된 문제를 수정:
- 에이전트 간 데이터 전달 누락
- 프롬프트 불명확으로 인한 출력 형식 불일치
- API 호출 에러 처리

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete YouTube auto-production pipeline v1"
```
