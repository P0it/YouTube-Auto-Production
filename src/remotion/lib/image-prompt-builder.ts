import * as fs from "fs";
import * as path from "path";
import type { ImageStyle, ScriptPart, SectionType } from "./types";

interface SectionStyle {
  style: ImageStyle;
  mood: string;
  palette: string;
}

interface VisualStyleConfig {
  sectionStyles: Record<SectionType, SectionStyle>;
  channelIdentity: {
    name: string;
    tone: string;
    consistencyRule: string;
  };
}

interface ImageGenConfig {
  brandGuideline: string;
  negative: string;
}

let visualStyleCache: VisualStyleConfig | null = null;
let imageGenCache: ImageGenConfig | null = null;

function loadVisualStyle(): VisualStyleConfig {
  if (visualStyleCache) return visualStyleCache;
  const p = path.resolve(__dirname, "../../../config/visual-style.json");
  visualStyleCache = JSON.parse(fs.readFileSync(p, "utf-8")) as VisualStyleConfig;
  return visualStyleCache;
}

function loadImageGenConfig(): ImageGenConfig {
  if (imageGenCache) return imageGenCache;
  const p = path.resolve(__dirname, "../../../config/image-generation.json");
  imageGenCache = JSON.parse(fs.readFileSync(p, "utf-8")) as ImageGenConfig;
  return imageGenCache;
}

export interface PromptBuildInput {
  part: ScriptPart;
  topic: string;
  visualHint?: string;
  extraNotes?: string;
}

export interface BuiltPrompt {
  prompt: string;
  style: ImageStyle;
  sectionType: SectionType;
}

/**
 * 섹션 타입 × 스타일 맵을 기반으로 Gemini용 최종 프롬프트 문자열을 만든다.
 * - visualHint가 있으면 그걸 핵심 장면으로 사용, 없으면 파트의 visualDirections 첫 항목을 사용
 * - 학술/연구 섹션은 일러스트, 훅/일상/심화/아우트로는 시네마틱으로 자동 분기
 * - 사람 묘사 시 얼굴 식별성을 최소화(뒷모습/측면/그림자)하도록 브랜드 규칙에 명시
 */
export function buildImagePrompt(input: PromptBuildInput): BuiltPrompt {
  const visual = loadVisualStyle();
  const imgCfg = loadImageGenConfig();
  const sectionStyle = visual.sectionStyles[input.part.sectionType];
  const identity = visual.channelIdentity;

  const coreScene =
    input.visualHint?.trim() ||
    input.part.visualDirections[0] ||
    `visual metaphor for: ${input.part.partName}`;

  const stylePreamble =
    sectionStyle.style === "cinematic"
      ? "cinematic photography, 50mm lens, shallow depth of field, natural lighting"
      : "minimal editorial illustration, limited palette, flat shading with subtle texture, generous negative space";

  const lines = [
    `Channel identity: ${identity.name}. Tone: ${identity.tone}.`,
    `Style base: ${stylePreamble}.`,
    `Mood: ${sectionStyle.mood}. Palette: ${sectionStyle.palette}.`,
    `Scene: ${coreScene}.`,
    `Topic context: ${input.topic}.`,
    input.extraNotes ? `Notes: ${input.extraNotes}.` : "",
    `Brand rules: ${imgCfg.brandGuideline}.`,
    `Consistency: ${identity.consistencyRule}.`,
    `Avoid: ${imgCfg.negative}. Do not depict recognizable real people.`,
    `When showing a human, prefer back view, side profile, silhouette, or framing that obscures facial identity.`,
  ].filter(Boolean);

  return {
    prompt: lines.join(" "),
    style: sectionStyle.style,
    sectionType: input.part.sectionType,
  };
}
