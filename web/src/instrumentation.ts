/**
 * Next.js calls `register()` once per server process. We only want our
 * pipeline sweep to run under the Node.js runtime (it uses `fs` and
 * `child_process`), never under Edge. Per the Next.js docs, the way to
 * keep Edge webpack bundles clean is to split runtimes into their own files.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const mod = await import("./instrumentation-node");
  mod.register();
}
