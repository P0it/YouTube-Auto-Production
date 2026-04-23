import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { ProjectMeta } from "../../route";
import { STAGE_RUNNERS, stageRunnerForStatus } from "@/lib/pipeline-stages";
import { readProgress, writeProgress } from "@/lib/spawn-helper";
import { validateResearch } from "@/lib/research-validator";

const PROJECTS_DIR = path.resolve(process.cwd(), "..", "projects");

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectDir = path.join(PROJECTS_DIR, id);
  const metaPath = path.join(projectDir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as ProjectMeta;

  // Special case: topic_selection with a placeholder research.md means the
  // researcher-planner never actually curated. Re-run the curate stage
  // instead of refusing (we'd otherwise tell the user "this is a user
  // checkpoint" even though the checkpoint is unusable).
  let runner = stageRunnerForStatus(meta.status);
  if (meta.status === "topic_selection") {
    const research = validateResearch(id);
    if (!research.ready) {
      // Roll status back so the pipeline treats this like an unfinished
      // research step rather than a ready-to-pick checkpoint.
      meta.status = "researching";
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
      runner = STAGE_RUNNERS.researchCurate;
    }
  }

  if (!runner) {
    return NextResponse.json(
      { error: `status "${meta.status}" is a user checkpoint or terminal — no resume.` },
      { status: 400 }
    );
  }

  // Clear the crashed flag before relaunching so the UI updates immediately.
  const prev = readProgress(projectDir);
  if (prev) {
    writeProgress(projectDir, {
      ...prev,
      crashed: false,
      tail: [...prev.tail, `[resume] re-running stage ${runner.key}`].slice(-200),
    });
  }

  runner.run({
    projectId: id,
    projectDir,
    meta,
    onExit: (code) => {
      // For researchCurate specifically, re-run the validate-and-transition
      // logic so a retried curate can properly advance to topic_selection or
      // get re-flagged as crashed. Other stages' transitions are chained
      // from the original PUT handlers or handled by the subagent itself.
      if (runner !== STAGE_RUNNERS.researchCurate) return;

      const validation = validateResearch(id);
      const current = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as ProjectMeta;

      if (code === 0 && validation.ready && current.status === "researching") {
        current.status = "topic_selection";
        fs.writeFileSync(metaPath, JSON.stringify(current, null, 2), "utf-8");
      } else if (code === 0 && !validation.ready) {
        const prog = readProgress(projectDir);
        if (prog) {
          writeProgress(projectDir, {
            ...prog,
            crashed: true,
            tail: [
              ...prog.tail,
              `[validate] retry still produced placeholder (topicCount=${validation.topicCount}). Verify claude CLI auth.`,
            ].slice(-200),
          });
        }
      }
    },
  });

  return NextResponse.json({ ok: true, stage: runner.key, status: meta.status });
}
