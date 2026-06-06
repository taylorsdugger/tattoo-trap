"""Tattoo Trap data pipeline.

Stages (run in order, each idempotent):
    seed_shops   -> crawl_shops -> embed_images -> (tag_artists, post-MVP)
"""

__all__ = ["config", "db", "embedder"]
