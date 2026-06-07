"""CLIP image embedder (pipeline side).

Uses the same checkpoint as the browser (`openai/clip-vit-base-patch32` ==
`Xenova/clip-vit-base-patch32`). Returns L2-normalized 512-d float32 vectors so cosine
similarity matches what the web app computes. See tests/test_parity.py.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from . import config


class Embedder:
    def __init__(self, model_name: str = config.EMBED_MODEL) -> None:
        self.model_name = model_name
        self.model = CLIPModel.from_pretrained(model_name)
        self.processor = CLIPProcessor.from_pretrained(model_name)
        self.model.eval()

    @torch.no_grad()
    def embed(self, image: Image.Image) -> np.ndarray:
        inputs = self.processor(images=image.convert("RGB"), return_tensors="pt")
        feats = self.model.get_image_features(**inputs)
        vec = feats[0].cpu().numpy().astype("float32")
        norm = float(np.linalg.norm(vec))
        return vec / (norm + 1e-12)

    @torch.no_grad()
    def embed_texts(self, prompts: list[str]) -> np.ndarray:
        """Embed text prompts into the same CLIP space as images (L2-normalized rows). Used for
        zero-shot content classification (e.g. "is this a tattoo?") against image embeddings."""
        inputs = self.processor(text=prompts, return_tensors="pt", padding=True)
        feats = self.model.get_text_features(**inputs).cpu().numpy().astype("float32")
        norms = np.linalg.norm(feats, axis=1, keepdims=True)
        return feats / (norms + 1e-12)


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    return Embedder()
