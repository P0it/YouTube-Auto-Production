import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { parseScript, generateSubtitles } from "../remotion/lib/script-parser";
import { buildAssetMap } from "../remotion/lib/asset-mapper";
import type { AudioSegment } from "../remotion/lib/types";

interface Args {
  projectId: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { projectId: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.projectId = argv[++i];
  }
  if (!args.projectId) {
    throw new Error(
      "Missing --project <id>. Example: npm run render-video -- --project test-philosophy"
    );
  }
  return args;
}

function readAudioManifest(projectDir: string): AudioSegment[] {
  const manifestPath = path.join(projectDir, "output", "audio", "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      segments?: AudioSegment[];
    };
    if (raw.segments && raw.segments.length > 0) return raw.segments;
  }

  // Fallback: scan the audio directory and probe durations from WAV headers.
  const audioDir = path.join(projectDir, "output", "audio");
  if (!fs.existsSync(audioDir)) return [];
  const files = fs
    .readdirSync(audioDir)
    .filter((f) => /^part_\d+\.(wav|mp3)$/i.test(f))
    .sort();
  return files.map((f) => {
    const match = f.match(/^part_(\d+)\./);
    const partNumber = match ? parseInt(match[1]) : 0;
    const filePath = path.join(audioDir, f);
    const durationMs = estimateDuration(filePath);
    return {
      partNumber,
      filePath: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      durationMs,
    };
  });
}

/**
 * Rough duration estimate. For WAV (PCM 24kHz mono 16-bit) we read the header.
 * For MP3 we approximate from file size at 128kbps. TTS manifest is preferred
 * whenever available — this is only a fallback.
 */
function estimateDuration(filePath: string): number {
  const stats = fs.statSync(filePath);
  if (filePath.toLowerCase().endsWith(".wav")) {
    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(44);
    fs.readSync(fd, header, 0, 44, 0);
    fs.closeSync(fd);
    const sampleRate = header.readUInt32LE(24);
    const bitsPerSample = header.readUInt16LE(34);
    const numChannels = header.readUInt16LE(22);
    if (sampleRate > 0 && bitsPerSample > 0 && numChannels > 0) {
      const dataSize = stats.size - 44;
      const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
      return Math.round((dataSize / bytesPerSecond) * 1000);
    }
  }
  // MP3 fallback at 128kbps
  return Math.round((stats.size * 8) / 128);
}

async function runRemotion(
  propsPath: string,
  outputPath: string,
  durationFrames: number,
  fps: number
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const args = [
    "remotion",
    "render",
    "src/remotion/index.ts",
    "LongformVideo",
    outputPath,
    "--props",
    propsPath,
    "--frames",
    `0-${Math.max(0, durationFrames - 1)}`,
    "--fps",
    String(fps),
  ];

  return new Promise<void>((resolve, reject) => {
    const child = spawn("npx", args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`remotion render exited with code ${code}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = path.resolve(process.cwd(), "projects", args.projectId);

  const scriptVerified = path.join(projectDir, "script-verified.md");
  const scriptBase = path.join(projectDir, "script.md");
  const scriptPath = fs.existsSync(scriptVerified) ? scriptVerified : scriptBase;
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found at ${scriptPath}`);
  }

  const script = parseScript(scriptPath, args.projectId);
  const audio = readAudioManifest(projectDir);
  if (audio.length === 0) {
    throw new Error(
      `No audio segments found. Run \`npm run generate-tts -- --project ${args.projectId}\` first.`
    );
  }

  const assets = buildAssetMap({
    projectId: args.projectId,
    script,
    audio,
    preferClips: true,
  });
  const subtitles = generateSubtitles(script, audio);

  const outputDir = path.join(projectDir, "output");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "asset-map.json"),
    JSON.stringify(assets, null, 2),
    "utf-8"
  );

  const propsPath = path.join(outputDir, "remotion-props.json");
  fs.writeFileSync(
    propsPath,
    JSON.stringify({ subtitles, assets, audioSegments: audio }, null, 2),
    "utf-8"
  );

  const fps = 30;
  const totalMs = audio.reduce((acc, s) => acc + s.durationMs, 0);
  const durationFrames = Math.ceil((totalMs / 1000) * fps);

  const outputVideo = path.join(outputDir, "video", "longform.mp4");
  console.log(
    `[render-video] project=${args.projectId} parts=${audio.length} totalMs=${totalMs} frames=${durationFrames}`
  );
  console.log(`[render-video] rendering to ${outputVideo}...`);

  await runRemotion(propsPath, outputVideo, durationFrames, fps);

  const stats = fs.statSync(outputVideo);
  console.log(
    `[render-video] done. ${outputVideo} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
