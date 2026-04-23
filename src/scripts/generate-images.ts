import * as fs from "fs";
import * as path from "path";
import { parseScript } from "../remotion/lib/script-parser";
import { buildImagePrompt } from "../remotion/lib/image-prompt-builder";
import { generateImage, readMetadata } from "../remotion/lib/image-generator";
import type { ScriptPart, GeneratedImageMeta } from "../remotion/lib/types";

interface Args {
  projectId: string;
  onlyPart?: number;
  onlySequence?: number;
  regenerate?: boolean;
  orientation: "landscape" | "portrait";
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    projectId: "",
    orientation: "landscape",
    concurrency: Number(process.env.IMAGE_CONCURRENCY ?? 6),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.projectId = argv[++i];
    else if (a === "--part") args.onlyPart = Number(argv[++i]);
    else if (a === "--sequence") args.onlySequence = Number(argv[++i]);
    else if (a === "--regenerate") args.regenerate = true;
    else if (a === "--portrait") args.orientation = "portrait";
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]);
  }
  if (!args.projectId) {
    throw new Error(
      "Missing --project <id>. Example: npm run generate-images -- --project test-philosophy"
    );
  }
  if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
    args.concurrency = 6;
  }
  return args;
}

/** All unique (partNumber, sequence) slots derived from the script. */
function buildJobList(
  parts: ScriptPart[],
  args: Args
): { part: ScriptPart; sequence: number; hint: string }[] {
  const jobs: { part: ScriptPart; sequence: number; hint: string }[] = [];
  for (const part of parts) {
    if (args.onlyPart && part.partNumber !== args.onlyPart) continue;
    const hints = part.visualDirections.length > 0
      ? part.visualDirections
      : [`visual metaphor for: ${part.partName}`];
    hints.forEach((hint, sequence) => {
      if (args.onlySequence !== undefined && sequence !== args.onlySequence) return;
      jobs.push({ part, sequence, hint });
    });
  }
  return jobs;
}

/** Simple parallel-map with bounded concurrency. */
async function runBounded<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function pull(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => pull());
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = path.resolve(process.cwd(), "projects", args.projectId);
  const scriptVerified = path.join(projectDir, "script-verified.md");
  const scriptBase = path.join(projectDir, "script.md");
  const scriptPath = fs.existsSync(scriptVerified) ? scriptVerified : scriptBase;

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found for project "${args.projectId}" at ${scriptPath}`);
  }

  const script = parseScript(scriptPath, args.projectId);
  const metaPath = path.join(projectDir, "meta.json");
  const projectMeta = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { topic?: string })
    : {};
  const topic = projectMeta.topic || script.topic;

  const jobs = buildJobList(script.parts, args);
  if (jobs.length === 0) {
    throw new Error("No image jobs produced — check --part / --sequence flags or script content.");
  }

  const existing = readMetadata(args.projectId);
  const existingKey = new Set(
    existing.map((m) => `${m.partNumber}-${m.sequence}`)
  );

  console.log(
    `[generate-images] project=${args.projectId} jobs=${jobs.length} concurrency=${args.concurrency} orientation=${args.orientation}`
  );

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  await runBounded(jobs, args.concurrency, async (job) => {
    const key = `${job.part.partNumber}-${job.sequence}`;
    if (existingKey.has(key) && !args.regenerate) {
      skipped++;
      return;
    }

    const built = buildImagePrompt({
      part: job.part,
      topic,
      visualHint: job.hint,
    });

    const label = `part ${job.part.partNumber}#${job.sequence} [${built.sectionType}/${built.style}]`;
    console.log(`  ${label} generating...`);

    try {
      const result = await generateImage({
        projectId: args.projectId,
        partNumber: job.part.partNumber,
        sequence: job.sequence,
        prompt: built.prompt,
        sectionType: built.sectionType,
        style: built.style,
        orientation: args.orientation,
      });
      generated++;
      console.log(
        `  ${label} -> ${result.meta.filePath} (${result.bytes.toLocaleString()} bytes)`
      );
    } catch (err) {
      failed++;
      console.error(`  ${label} FAILED: ${(err as Error).message}`);
    }
  });

  console.log(
    `[generate-images] done. generated=${generated} skipped=${skipped} failed=${failed}`
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
