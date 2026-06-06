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

async function loadBundle(onStatus?: (msg: string) => void): Promise<ClipBundle> {
  onStatus?.("Loading vision model…");
  const { AutoProcessor, CLIPVisionModelWithProjection, env } = await import(
    "@huggingface/transformers"
  );
  // Always fetch from the Hub/CDN; we don't ship local model files.
  env.allowLocalModels = false;

  const processor = await AutoProcessor.from_pretrained(MODEL_ID);

  const hasWebGPU =
    typeof navigator !== "undefined" && "gpu" in navigator && !!(navigator as any).gpu;

  // Prefer WebGPU; fall back to WASM. fp32 maximizes parity with the fp32 pipeline.
  try {
    const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: "fp32",
      device: hasWebGPU ? "webgpu" : "wasm",
    });
    return { processor, vision };
  } catch (err) {
    onStatus?.("WebGPU unavailable, falling back to WASM…");
    const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      dtype: "fp32",
      device: "wasm",
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
