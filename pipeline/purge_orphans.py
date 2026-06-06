"""One-off: delete bucket objects not referenced by any portfolio_images.storage_path.

Safe by construction: aborts if ANY row references a storage object, so it can only ever
remove true orphans. Run from pipeline/:  .venv/bin/python purge_orphans.py
"""

from __future__ import annotations

from tattoo_trap import config, db


def walk(b, prefix: str = "") -> list[str]:
    items = b.list(prefix) if prefix else b.list()
    out: list[str] = []
    for it in items:
        full = f"{prefix}/{it['name']}" if prefix else it["name"]
        if it.get("id") is None and it.get("metadata") is None:  # folder
            out += walk(b, full)
        else:
            out.append(full)
    return out


def main() -> None:
    c = db.client()
    referenced = (
        c.table("portfolio_images")
        .select("id", count="exact")
        .not_.is_("storage_path", "null")
        .execute()
        .count
    )
    if referenced:
        raise SystemExit(
            f"ABORT: {referenced} row(s) reference a storage object; not purging."
        )

    b = c.storage.from_(config.STORAGE_BUCKET)
    objs = walk(b)
    if not objs:
        print("Bucket already empty.")
        return

    # Supabase remove() handles batches; chunk to be safe on large buckets.
    for i in range(0, len(objs), 100):
        b.remove(objs[i : i + 100])
    print(f"Removed {len(objs)} orphaned object(s) from '{config.STORAGE_BUCKET}'.")
    print(f"Bucket now: {len(walk(b))} object(s).")


if __name__ == "__main__":
    main()
