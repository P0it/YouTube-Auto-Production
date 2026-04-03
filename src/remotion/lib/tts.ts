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
