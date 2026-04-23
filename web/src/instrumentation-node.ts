/**
 * Node.js-only instrumentation. Loaded by `instrumentation.ts` via dynamic
 * import so webpack never bundles fs/child_process into the Edge runtime.
 */
import { sweepPipelines } from "./lib/pipeline-sweep";

export function register() {
  try {
    sweepPipelines();
  } catch (err) {
    console.error("[pipeline-sweep] failed:", err);
  }
}
