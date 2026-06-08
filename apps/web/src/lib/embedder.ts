"use client";

// In-browser CLIP image embedder (transformers.js / ONNX).
// Uses Xenova/clip-vit-base-patch32 — the SAME checkpoint the pipeline uses
// (openai/clip-vit-base-patch32) — so query vectors are comparable to stored portfolio
// embeddings. Output is an L2-normalized 512-d vector for cosine search.

type ClipBundle = {
  processor: any;
  vision: any;
};

const MODEL_ID = "Xenova/clip-vit-base-patch32";

let bundlePromise: Promise<ClipBundle> | null = null;

/**
 * Mobile Safari (and other phone browsers) hard-cap per-tab WASM memory, so the fp32
 * vision model (~350 MB of weights in one contiguous heap) gets the tab killed mid-load.
 * On those devices we run q8 (~90 MB) on WASM and skip the WebGPU attempt entirely — iOS
 * WebGPU is flaky and a failed attempt can crash the page before the WASM fallback runs.
 *
 * The quality cost of q8 is a sub-1% ranking drift vs fp32 (same checkpoint, coarser math),
 * which only ever applies to phones — desktops keep full fp32 + WebGPU.
 */
function isConstrainedDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Phones/tablets, incl. iPadOS reporting as "Macintosh" but with touch points.
  const isMobileUA = /Mobi|Android|iPhone|iPod/i.test(ua);
  const isIpadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  // navigator.deviceMemory is Chromium-only (GB, capped at 8); treat ≤4 GB as constrained.
  const lowMemory =
    typeof (navigator as any).deviceMemory === "number" &&
    (navigator as any).deviceMemory <= 4;
  return isMobileUA || isIpadOS || lowMemory;
}

async function loadBundle(onStatus?: (msg: string) => void): Promise<ClipBundle> {
  onStatus?.("Loading vision model…");
  const { AutoProcessor, CLIPVisionModelWithProjection, env } = await import(
    "@huggingface/transformers"
  );
  // Always fetch from the Hub/CDN; we don't ship local model files.
  env.allowLocalModels = false;

  const processor = await AutoProcessor.from_pretrained(MODEL_ID);

  // ORT logs benign EP-assignment warnings via console.error, which trips the
  // Next.js dev overlay. Only surface actual errors (3 = error, 4 = fatal).
  const session_options = { logSeverityLevel: 3 as const };

  const constrained = isConstrainedDevice();

  // Constrained devices: q8 on WASM, no WebGPU attempt — keeps the tab under Safari's
  // memory ceiling. Anything else: fp32, preferring WebGPU for max parity + speed.
  if (constrained) {
    const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: "q8",
      device: "wasm",
      session_options,
    });
    return { processor, vision };
  }

  const hasWebGPU =
    typeof navigator !== "undefined" && "gpu" in navigator && !!(navigator as any).gpu;

  // Prefer WebGPU; fall back to WASM. fp32 maximizes parity with the fp32 pipeline.
  try {
    const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: "fp32",
      device: hasWebGPU ? "webgpu" : "wasm",
      session_options,
    });
    return { processor, vision };
  } catch (err) {
    onStatus?.("WebGPU unavailable, falling back to WASM…");
    const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: "fp32",
      device: "wasm",
      session_options,
    });
    return { processor, vision };
  }
}

/** Get (and cache) the CLIP model. First call downloads + warms the model. */
export function getClip(onStatus?: (msg: string) => void): Promise<ClipBundle> {
  if (!bundlePromise) bundlePromise = loadBundle(onStatus);
  return bundlePromise;
}

function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

/** Embed an image Blob/File into a normalized 512-d vector. */
export async function embedImage(
  file: Blob,
  onStatus?: (msg: string) => void,
): Promise<number[]> {
  const { RawImage } = await import("@huggingface/transformers");
  const { processor, vision } = await getClip(onStatus);
  onStatus?.("Analyzing your image…");
  const image = await RawImage.fromBlob(file);
  const inputs = await processor(image);
  const { image_embeds } = await vision(inputs);
  const data = Array.from(image_embeds.data as Float32Array);
  return l2normalize(data);
}
