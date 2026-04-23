import * as fs from "fs";
import * as path from "path";
import { parseScript } from "../remotion/lib/script-parser";
import { buildImagePrompt } from "../remotion/lib/image-prompt-builder";
import { generateVideoClip, readClipMetadata } from "../remotion/lib/video-generator";
import type { ScriptPart, SectionType } from "../remotion/lib/types";

interface Args {
  projectId: string;
  onlyParts?: number[];
  regenerate?: boolean;
  orientation: "landscape" | "portrait";
}

function parseArgs(argv: string[]): Args {
  const args: Args = { projectId: "", orientation: "landscape" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.projectId = argv[++i];
    else if (a === "--parts") args.onlyParts = argv[++i].split(",").map(Number);
    else if (a === "--regenerate") args.regenerate = true;
    else if (a === "--portrait") args.orientation = "portrait";
  }
  if (!args.projectId) {
    throw new Error(
      "Missing --project <id>. Example: npm run generate-video-clips -- --project test-philosophy"
    );
  }
  return args;
}

interface VeoConfig {
  targetClipCount: number;
  placementStrategy: "section-boundaries" | "first-per-section";
  sections: SectionType[];
}

function loadVeoConfig(): VeoConfig {
  const p = path.resolve(process.cwd(), "config", "video-generation.json");
  if (!fs.existsSync(p)) {
    return {
      targetClipCount: 4,
      placementStrategy: "section-boundaries",
      sections: ["hook", "cases", "deep", "outro"],
    };
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<VeoConfig>;
  return {
    targetClipCount: raw.targetClipCount ?? 4,
    placementStrategy: raw.placementStrategy ?? "section-boundaries",
    sections: raw.sections ?? ["hook", "cases", "deep", "outro"],
  };
}

function pickTargetParts(parts: ScriptPart[], cfg: VeoConfig): ScriptPart[] {
  const selected: ScriptPart[] = [];
  for (const sec of cfg.sections) {
    const match = parts.find((p) => p.sectionType === sec);
    if (match) selected.push(match);
  }
  return selected.slice(0, cfg.targetClipCount);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (process.env.SKIP_VEO === "1") {
    console.log("[generate-video-clips] SKIP_VEO=1 set — skipping.");
    return;
  }

  const projectDir = path.resolve(process.cwd(), "projects", args.projectId);
  const scriptVerified = path.join(projectDir, "script-verified.md");
  const scriptBase = path.join(projectDir, "script.md");
  const scriptPath = fs.existsSync(scriptVerified) ? scriptVerified : scriptBase;

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found at ${scriptPath}`);
  }

  const script = parseScript(scriptPath, args.projectId);
  const metaPath = path.join(projectDir, "meta.json");
  const projectMeta = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { topic?: string })
    : {};
  const topic = projectMeta.topic || script.topic;

  const veoCfg = loadVeoConfig();
  const targets = args.onlyParts
    ? script.parts.filter((p) => args.onlyParts!.includes(p.partNumber))
    : pickTargetParts(script.parts, veoCfg);

  if (targets.length === 0) {
    console.log("[generate-video-clips] no target parts — nothing to do.");
    return;
  }

  const existing = readClipMetadata(args.projectId);
  const existingKey = new Set(existing.map((m) => `${m.partNumber}-${m.sequence}`));

  console.log(
    `[generate-video-clips] project=${args.projectId} targets=${targets.length} orientation=${args.orientation}`
  );

  let generated = 0;
  let failed = 0;

  // Veo is slow and rate-limited; run sequentially.
  for (const part of targets) {
    const key = `${part.partNumber}-0`;
    if (existingKey.has(key) && !args.regenerate) {
      console.log(`  part ${part.partNumber} skip (clip exists)`);
      continue;
    }

    // Use the FIRST visual direction of the part as the clip's scene anchor.
    const hint = part.visualDirections[0] ?? `moment from ${part.partName}`;
    const built = buildImagePrompt({ part, topic, visualHint: hint });
    // Turn the static prompt into a cinematic motion instruction.
    const motionPrompt = `${built.prompt} Camera slowly dollies in, gentle parallax, natural ambient motion, 4 seconds, no dialogue, no on-screen text.`;

    console.log(`  part ${part.partNumber} [${built.sectionType}] starting Veo (~1–3 min)...`);

    try {
      const result = await generateVideoClip({
        projectId: args.projectId,
        partNumber: part.partNumber,
        sequence: 0,
        prompt: motionPrompt,
        sectionType: built.sectionType,
        orientation: args.orientation,
      });
      generated++;
      console.log(
        `  part ${part.partNumber} -> ${result.meta.filePath} (${result.bytes.toLocaleString()} bytes, ${result.meta.durationSeconds}s)`
      );
    } catch (err) {
      failed++;
      console.error(`  part ${part.partNumber} FAILED: ${(err as Error).message}`);
    }
  }

  console.log(`[generate-video-clips] done. generated=${generated} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
