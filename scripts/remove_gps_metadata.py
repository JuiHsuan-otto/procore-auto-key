#!/usr/bin/env python3
"""Remove EXIF from JPEGs that contain GPS data, without re-encoding pixels."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import piexif
from PIL import Image


def has_gps(path: Path) -> bool:
    with Image.open(path) as image:
        exif = image.getexif()
        return bool(exif.get_ifd(0x8825)) if 0x8825 in exif else False


def pixel_digest(path: Path) -> tuple[tuple[int, int], str]:
    with Image.open(path) as image:
        image.load()
        return image.size, hashlib.sha256(image.tobytes()).hexdigest()


def clean(path: Path) -> bool:
    if not has_gps(path):
        return False
    before = pixel_digest(path)
    temp = path.with_name(path.name + ".metadata-clean.tmp")
    temp.write_bytes(path.read_bytes())
    try:
        exif = piexif.load(str(temp))
        exif["GPS"] = {}
        piexif.insert(piexif.dump(exif), str(temp))
        if pixel_digest(temp) != before:
            raise RuntimeError(f"pixel verification failed: {path}")
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
    if has_gps(path):
        raise RuntimeError(f"GPS metadata remains: {path}")
    return True


def main() -> int:
    paths = [Path(arg) for arg in sys.argv[1:]]
    if not paths:
        paths = [p for p in Path("img").rglob("*") if p.suffix.lower() in {".jpg", ".jpeg"}]
    changed = 0
    for path in paths:
        if clean(path):
            print(f"REMOVED_GPS={path}")
            changed += 1
    print(f"GPS_FILES_CLEANED={changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
