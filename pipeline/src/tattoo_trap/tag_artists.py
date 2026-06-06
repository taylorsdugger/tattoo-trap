"""Stage 4 (post-MVP, stub) — one vision-model pass per artist to generate style tags.

Tags (fine line, blackwork, realism, botanical, anime, ornamental, ...) are *supplemental*
metadata for filtering — the primary search mechanism is vector similarity, not tags.

This is intentionally a stub. When implemented, it should:
  1. pick a few representative images per artist,
  2. make ONE classification call per artist (not per image),
  3. write results to an `artist_tags` table.
"""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="(post-MVP) Tag artists by style.")
    parser.add_argument("--metro", required=True)
    parser.parse_args()
    print("tag_artists is a post-MVP stub. See plan.md / ARCHITECTURE.md.")


if __name__ == "__main__":
    main()
