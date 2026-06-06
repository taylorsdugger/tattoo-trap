"""Model-parity sanity checks.

The pipeline must produce L2-normalized 512-d CLIP vectors. The browser uses the *same*
checkpoint (Xenova/clip-vit-base-patch32), so a query embedded in the browser is comparable
to portfolio embeddings produced here.

Full cross-runtime parity (browser vs pipeline cosine >= ~0.99) is verified manually with
apps/web's dev tools against the same test image; see pipeline/README.md. These tests cover
the pipeline-side invariants that make that parity possible.

Run:  pytest        (downloads the CLIP weights on first run)
"""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from tattoo_trap import config


@pytest.fixture(scope="module")
def embedder():
    from tattoo_trap.embedder import get_embedder

    return get_embedder()


def _solid(color) -> Image.Image:
    return Image.new("RGB", (256, 256), color)


def test_embedding_shape_and_dim(embedder):
    vec = embedder.embed(_solid((180, 40, 40)))
    assert vec.shape == (config.EMBED_DIM,)
    assert vec.dtype == np.float32


def test_embedding_is_l2_normalized(embedder):
    vec = embedder.embed(_solid((10, 120, 200)))
    assert np.isclose(np.linalg.norm(vec), 1.0, atol=1e-4)


def test_same_image_is_self_similar(embedder):
    img = _solid((60, 160, 90))
    a = embedder.embed(img)
    b = embedder.embed(img.copy())
    assert float(a @ b) > 0.999


def test_different_images_less_similar_than_identical(embedder):
    a = embedder.embed(_solid((230, 20, 20)))
    b = embedder.embed(_solid((20, 20, 230)))
    same = embedder.embed(_solid((230, 20, 20)))
    assert float(a @ same) > float(a @ b)
