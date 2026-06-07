"""Zero-shot "is this image actually a tattoo?" filter (CLIP, no extra model).

Shop sites mix real tattoo photos with headshots, shop logos, social-network icons (Yelp,
Google), storefront photos and lazy-load placeholders. Filename/URL rules miss most of these
(`yelp.webp`, `adam.webp`, `angel-antonio-tattoo-artist.webp` carry no give-away token). Instead
we score the CLIP *image* embedding we already compute against a set of tattoo vs not-tattoo
text prompts: an image is kept only if its best tattoo prompt beats its best junk prompt by a
margin. Validated on the live DB — cleanly drops headshots/logos/storefronts while keeping every
real tattoo (real tattoos clear the margin by >0.05; headshots sit at/below 0).
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np

from .embedder import get_embedder

TATTOO_PROMPTS = [
    "a photo of a tattoo on skin",
    "a close-up photo of a tattoo",
    "tattoo body art",
    "a black and grey tattoo",
    "a colorful tattoo design",
    "a tattoo on an arm",
    "a healed tattoo",
]
NOT_TATTOO_PROMPTS = [
    "a portrait photo of a person's face",
    "a headshot of a person",
    "a company logo",
    "a sign with text",
    "a photo of a building storefront",
    "a photo of a tattoo shop interior",
    "a screenshot of a website",
    "a social media app icon",
    "a default avatar placeholder image",
    "a blank placeholder image",
]

# An image is kept when (best tattoo prompt) - (best junk prompt) >= this. 0.02 sits well inside
# the gap measured on real data (real tattoos >> 0.05, headshots/logos <= ~0.01).
TATTOO_MARGIN = 0.02


@lru_cache(maxsize=1)
def _prompt_features() -> tuple[np.ndarray, np.ndarray]:
    emb = get_embedder()
    return emb.embed_texts(TATTOO_PROMPTS), emb.embed_texts(NOT_TATTOO_PROMPTS)


def tattoo_scores(image_vec: np.ndarray) -> tuple[float, float]:
    """Return (best tattoo-prompt cosine, best junk-prompt cosine) for an L2-normalized image
    embedding (CLIP image features, as stored in portfolio_images.embedding)."""
    v = np.asarray(image_vec, dtype="float32")
    v = v / (np.linalg.norm(v) + 1e-12)
    pos, neg = _prompt_features()
    return float((pos @ v).max()), float((neg @ v).max())


def is_tattoo(image_vec: np.ndarray, margin: float = TATTOO_MARGIN) -> bool:
    pos, neg = tattoo_scores(image_vec)
    return (pos - neg) >= margin
