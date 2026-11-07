import "server-only";
import { dueSources, runSource } from "./store";

/** Lay noi dung tu cac nguon den han (interval_hours), kiem tra moi 10 phut. Bat tu instrumentation.ts. */

const TICK_MS = 10 * 60_000;
type WorkerState = { timer?: NodeJS.Timeout; running: boolean; started: boolean };
const g = globalThis as unknown as { __curateWorker?: WorkerState };
const state: WorkerState = (g.__curateWorker ??= { running: false, started: false });

export function startCurateWorker() {
  if (state.started) return;
  state.started = true;
  state.timer = setInterval(() => void tick(), TICK_MS);
  state.timer.unref?.();
  setTimeout(() => void tick(), 60_000).unref?.();
}

export async function tick() {
  if (state.running) return 0;
  state.running = true;
  try {
    let n = 0;
    for (const s of await dueSources()) n += (await runSource(s)).added;
    return n;
  } catch (e) {
    console.error("[curate] tick", e);
    return 0;
  } finally {
    state.running = false;
  }
}
