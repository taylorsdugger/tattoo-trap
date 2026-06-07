"""Backfill: remove already-embedded portfolio images that aren't actually tattoos.

Scores each embedded image's *stored* CLIP vector against the tattoo / not-tattoo prompts in
content_filter (no image re-download needed) and removes the ones that fail the gate — the
headshots, shop logos, Yelp/Google icons, storefronts and placeholders that were ingested
before the content filter existed. Deletes the row and its Storage thumbnail.

Safe by default: prints a plan and changes nothing. Apply with --apply.

    .venv/bin/python prune_nontattoo_images.py             # dry-run plan (default)
    .venv/bin/python prune_nontattoo_images.py --apply      # remove non-tattoo images + thumbs
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict

import numpy as np

from tattoo_trap import config, db
from tattoo_trap.content_filter import TATTOO_MARGIN, tattoo_scores


def _parse_vec(v) -> np.ndarray:
    return np.array(json.loads(v) if isinstance(v, str) else v, dtype="float32")


def main() -> None:
    ap = argparse.ArgumentParser(description="Prune non-tattoo images from the visual index.")
    ap.add_argument("--apply", action="store_true", help="execute the removal (rows + thumbnails)")
    ap.add_argument("--margin", type=float, default=TATTOO_MARGIN, help="tattoo-vs-junk margin")
    args = ap.parse_args()

    c = db.client()
    artists = {a["id"]: a["name"] for a in c.table("artists").select("id,name").execute().data}
    rows = (
        c.table("portfolio_images")
        .select("id,artist_id,storage_path,source_url,embedding")
        .not_.is_("embedding", "null")
        .execute()
        .data
    )

    junk, kept_per_artist = [], defaultdict(int)
    for r in rows:
        pos, neg = tattoo_scores(_parse_vec(r["embedding"]))
        if (pos - neg) < args.margin:
            junk.append({**r, "pos": pos, "neg": neg})
        else:
            kept_per_artist[r["artist_id"]] += 1

    print(f"Scored {len(rows)} embedded image(s); {len(junk)} fail the tattoo gate "
          f"(margin {args.margin}).\n")
    by_artist = defaultdict(list)
    for j in junk:
        by_artist[j["artist_id"]].append(j)
    for aid in sorted(by_artist, key=lambda i: artists.get(i, "")):
        name = artists.get(aid, f"artist {aid}")
        emptied = " ← 0 tattoo images left" if kept_per_artist[aid] == 0 else ""
        print(f"  {name[:34]:<34} drop {len(by_artist[aid])}, keep {kept_per_artist[aid]}{emptied}")
        for j in sorted(by_artist[aid], key=lambda x: x["pos"] - x["neg"]):
            fn = (j["source_url"] or "").split("/")[-1][:48]
            print(f"      tattoo={j['pos']:.2f} junk={j['neg']:.2f}  {fn}")

    if not args.apply:
        print("\nDry run — nothing changed. Re-run with --apply to remove these.")
        return

    bucket = c.storage.from_(config.STORAGE_BUCKET)
    ids = [j["id"] for j in junk]
    paths = [j["storage_path"] for j in junk if j.get("storage_path")]
    for i in range(0, len(ids), 100):
        c.table("portfolio_images").delete().in_("id", ids[i:i + 100]).execute()
    for i in range(0, len(paths), 100):
        try:
            bucket.remove(paths[i:i + 100])
        except Exception as exc:  # noqa: BLE001 — storage cleanup is best-effort
            print(f"  ! storage remove failed for a batch: {exc!r}")
    print(f"\nRemoved {len(ids)} non-tattoo image(s) and {len(paths)} thumbnail(s).")


if __name__ == "__main__":
    main()
