#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _find_json_object(text: str, start_idx: int) -> tuple[int, int]:
    """
    Return (json_start, json_end_exclusive) for the JSON object beginning at/after start_idx.
    Uses brace depth counting and honors strings/escapes.
    """
    i = text.find("{", start_idx)
    if i == -1:
        raise ValueError("Could not find '{' starting JSON object")

    depth = 0
    in_str = False
    esc = False
    for j in range(i, len(text)):
        ch = text[j]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue

        if ch == '"':
            in_str = True
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i, j + 1

    raise ValueError("Unbalanced braces while scanning JSON object")


def main() -> int:
    if len(sys.argv) < 2:
        print(
            "Usage: extract_folium_geojson.py <folium_export.html> [output.geojson]",
            file=sys.stderr,
        )
        return 2

    html_path = Path(sys.argv[1]).expanduser().resolve()
    out_path = (
        Path(sys.argv[2]).expanduser().resolve()
        if len(sys.argv) >= 3
        else Path("frontend/public/geojson/tambon_flood_probability_polygons.geojson").resolve()
    )

    text = html_path.read_text(encoding="utf-8", errors="replace")

    # Folium pattern: geo_json_<id>_add({...});
    needle = "_add("
    idx = text.find(needle)
    if idx == -1:
        raise ValueError("Could not find Folium '*_add(' payload in HTML export")

    json_start, json_end = _find_json_object(text, idx + len(needle))
    raw = text[json_start:json_end]
    payload = json.loads(raw)

    if isinstance(payload, dict) and payload.get("type") != "FeatureCollection":
        payload = {"type": "FeatureCollection", **payload}
    if not isinstance(payload, dict) or payload.get("features") is None:
        raise ValueError("Extracted JSON did not look like a GeoJSON FeatureCollection")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(out_path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, out_path)

    n = len(payload.get("features") or [])
    print(f"Wrote {n} features to {out_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        raise

