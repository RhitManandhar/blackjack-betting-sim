import type { Probe } from './benchmark';

// Browser versions of the benchmark's platform measurements. The longest gap between animation
// frames shows whether the page stayed responsive (a gap above about 100 ms is a visible stall).
// Memory is reported only where the browser exposes it (Chrome and Edge); elsewhere it is blank.

interface ChromeMemory {
  readonly usedJSHeapSize: number;
}

function heapBytes(): number | null {
  const memory = (performance as Performance & { memory?: ChromeMemory }).memory;
  return memory === undefined ? null : memory.usedJSHeapSize;
}

const MB = 1024 * 1024;

export function browserProbe(): Probe {
  let frame = 0;
  let lastFrame = 0;
  let maxGap = 0;
  let peak: number | null = null;
  const onFrame = (time: number) => {
    if (lastFrame > 0) maxGap = Math.max(maxGap, time - lastFrame);
    lastFrame = time;
    frame = requestAnimationFrame(onFrame);
  };
  const sampleMemory = () => {
    const bytes = heapBytes();
    if (bytes !== null) peak = Math.max(peak ?? 0, bytes);
  };
  return {
    start() {
      maxGap = 0;
      lastFrame = 0;
      peak = null;
      sampleMemory();
      frame = requestAnimationFrame(onFrame);
    },
    sample: sampleMemory,
    stop() {
      cancelAnimationFrame(frame);
      return { mainThreadMaxGapMs: maxGap, peakMemoryMb: peak === null ? null : peak / MB };
    },
  };
}

/** Runs a full garbage collection if the browser exposes gc(); returns whether it did. */
export function collectGarbage(): boolean {
  const gc = (globalThis as { gc?: () => void }).gc;
  if (gc === undefined) return false;
  gc();
  gc();
  return true;
}

export function currentHeapMb(): number | null {
  const bytes = heapBytes();
  return bytes === null ? null : bytes / MB;
}

export function browserEnvironment(): string {
  const device = navigator as Navigator & { deviceMemory?: number };
  const memory =
    device.deviceMemory === undefined ? '' : `, about ${String(device.deviceMemory)} GB memory`;
  return `${navigator.userAgent} — ${String(navigator.hardwareConcurrency)} logical cores${memory}, ${new Date().toISOString().slice(0, 10)}`;
}
