import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import wav from "wav";
import dotenv from "dotenv";
import { withRetry } from "./retry";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (aiClient) return aiClient;
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key not set. Add GOOGLE_GENERATIVE_AI_API_KEY to .env to use Gemini TTS."
    );
  }
  aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

interface TtsConfig {
  model: string;
  voiceName: string;
  stylePreamble: string;
  sampleRateHz: number;
  channels: number;
  bitDepth: number;
}

let cfgCache: TtsConfig | null = null;

function loadTtsConfig(): TtsConfig {
  if (cfgCache) return cfgCache;
  const p = path.resolve(__dirname, "../../../config/tts.json");
  if (fs.existsSync(p)) {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<TtsConfig>;
    cfgCache = {
      model: raw.model ?? "gemini-3.1-flash-tts-preview",
      voiceName: raw.voiceName ?? "Achernar",
      stylePreamble:
        raw.stylePreamble ??
        "다음 텍스트를 차분하고 사색적인 톤으로, 철학 다큐멘터리의 내레이터처럼 또박또박 읽어주세요. 감정을 과장하지 말고, 문장 사이에 자연스러운 호흡을 두세요.",
      sampleRateHz: raw.sampleRateHz ?? 24000,
      channels: raw.channels ?? 1,
      bitDepth: raw.bitDepth ?? 16,
    };
  } else {
    cfgCache = {
      model: "gemini-3.1-flash-tts-preview",
      voiceName: "Achernar",
      stylePreamble:
        "다음 텍스트를 차분하고 사색적인 톤으로, 철학 다큐멘터리의 내레이터처럼 또박또박 읽어주세요. 감정을 과장하지 말고, 문장 사이에 자연스러운 호흡을 두세요.",
      sampleRateHz: 24000,
      channels: 1,
      bitDepth: 16,
    };
  }
  return cfgCache;
}

function writeWav(
  pcm: Buffer,
  outputPath: string,
  cfg: TtsConfig
): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const writer = new wav.FileWriter(outputPath, {
      channels: cfg.channels,
      sampleRate: cfg.sampleRateHz,
      bitDepth: cfg.bitDepth,
    });
    writer.on("finish", () => resolve());
    writer.on("error", reject);
    writer.write(pcm);
    writer.end();
  });
}

export interface GenerateTtsInput {
  text: string;
  outputPath: string;
  voiceOverride?: string;
}

export interface GenerateTtsResult {
  filePath: string;
  bytes: number;
  sampleRateHz: number;
  durationMs: number;
}

export async function generateTts(input: GenerateTtsInput): Promise<GenerateTtsResult> {
  const cfg = loadTtsConfig();
  const voiceName = input.voiceOverride ?? cfg.voiceName;
  const fullPrompt = `${cfg.stylePreamble}\n\n${input.text}`;

  const response = await withRetry(
    () =>
      getAi().models.generateContent({
        model: cfg.model,
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        } as unknown as Record<string, unknown>,
      }),
    {
      shouldRetry: (err) => {
        const e = err as { status?: number; message?: string };
        if (e.status && (e.status >= 500 || e.status === 429)) return true;
        if (e.message && /timeout|ECONNRESET|ETIMEDOUT/i.test(e.message)) return true;
        return false;
      },
      onRetry: (err, attempt, delay) => {
        console.warn(
          `[gemini-tts] retry attempt=${attempt} delay=${Math.round(delay)}ms reason=${
            (err as Error)?.message ?? "unknown"
          }`
        );
      },
    }
  );

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const audioPart = parts.find(
    (p): p is { inlineData: { data: string; mimeType?: string } } =>
      typeof (p as { inlineData?: unknown }).inlineData === "object" &&
      (p as { inlineData?: { data?: string } }).inlineData?.data !== undefined
  );

  if (!audioPart) {
    throw new Error(
      `Gemini TTS response contained no inlineData audio. Parts: ${parts
        .map((p) => Object.keys(p))
        .join(", ")}`
    );
  }

  const pcm = Buffer.from(audioPart.inlineData.data, "base64");
  const outputWav = input.outputPath.replace(/\.mp3$/i, ".wav");
  await writeWav(pcm, outputWav, cfg);

  const stats = fs.statSync(outputWav);
  const bytesPerSecond = cfg.sampleRateHz * cfg.channels * (cfg.bitDepth / 8);
  const durationMs = Math.round((pcm.byteLength / bytesPerSecond) * 1000);

  return {
    filePath: outputWav,
    bytes: stats.size,
    sampleRateHz: cfg.sampleRateHz,
    durationMs,
  };
}
