#!/usr/bin/env python3
"""Generate a simple dark DMG background image for BirthdayPing."""

import struct
import sys
import zlib
from pathlib import Path


def create_png(width, height, r, g, b):
    """Create a minimal PNG file with a solid color."""
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return (
            struct.pack(">I", len(data))
            + c
            + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        )

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = make_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes([r, g, b]) * width
    idat = make_chunk(b"IDAT", zlib.compress(raw))
    iend = make_chunk(b"IEND", b"")
    return header + ihdr + idat + iend


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "dmg-background.png"
    # Dark charcoal background
    out.write_bytes(create_png(600, 400, 30, 30, 36))
    print(f"Created {out}")
