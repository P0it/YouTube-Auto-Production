import * as fs from "fs";
import * as path from "path";
import { parseScript } from "../remotion/lib/script-parser";
import { generateTts } from "../remotion/lib/tts-gemini";

interface Args {
  projectId: string;
  onlyPart?: number;
  regenerate?: boolean;
  voice?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { projectId: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.projectId = argv[++i];
    else if (a === "--part") args.onlyPart = Number(argv[++i]);
    else if (a === "--regenerate") args.regenerate = true;
    else if (a === "--voice") args.voice = argv[++i];
  }
  if (!args.projectId) {
    throw new Error(
      "Missing --project <id>. Example: npm run generate-tts -- --project test-philosophy"
    );
  }
  return args;
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
  const audioDir = path.join(projectDir, "output", "audio");
  fs.mkdirSync(audioDir, { recursive: true });

  const targets = args.onlyPart
    ? script.parts.filter((p) => p.partNumber === args.onlyPart)
    : script.parts;

  if (targets.length === 0) {
    throw new Error(`No parts to synthesize.`);
  }

  console.log(
    `[generate-tts] project=${args.projectId} parts=${targets.length}${
      args.voice ? ` voice=${args.voice}` : ""
    }`
  );

  const segments: { partNumber: number; filePath: string; durationMs: number }[] = [];
  let failed = 0;

  for (const part of targets) {
    const outputWav = path.join(
      audioDir,
      `part_${String(part.partNumber).padStart(2, "0")}.wav`
    );

    if (fs.existsSync(outputWav) && !args.regenerate) {
      const stats = fs.statSync(outputWav);
      console.log(`  part ${part.partNumber} skip (exists: ${stats.size.toLocaleString()} bytes)`);
      continue;
    }

    const charCount = part.narration.length;
    console.log(
      `  part ${part.partNumber} synthesizing (${charCount} chars, ~${Math.round(charCount / 5.4)}s expected)...`
    );

    try {
      const result = await generateTts({
        text: part.narration,
        outputPath: outputWav,
        voiceOverride: args.voice,
      });
      segments.push({
        partNumber: part.partNumber,
        filePath: result.filePath,
        durationMs: result.durationMs,
      });
      console.log(
        `  part ${part.partNumber} -> ${path.basename(result.filePath)} (${result.bytes.toLocaleString()} bytes, ${Math.round(result.durationMs / 1000)}s)`
      );
    } catch (err) {
      failed++;
      console.error(`  part ${part.partNumber} FAILED: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  const manifest = path.join(audioDir, "manifest.json");
  fs.writeFileSync(
    manifest,
    JSON.stringify({ project: args.projectId, generatedAt: new Date().toISOString(), segments }, null, 2),
    "utf-8"
  );
  console.log(`[generate-tts] done. segments=${segments.length} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
