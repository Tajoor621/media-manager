#!/usr/bin/env python3
"""Generate install icons from the owner's Media-Manager artwork.

Source: public/brand/media-manager-user-icon.webp
This script only changes branding assets; it never changes user files.
Requires Pillow (python -m pip install Pillow).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE = PUBLIC / "brand" / "media-manager-user-icon.webp"
im = Image.open(SOURCE).convert("RGB")
for size in (180, 192, 512):
    im.resize((size, size), Image.Resampling.LANCZOS).save(
        PUBLIC / f"icon-{size}.png", optimize=True
    )
# Maskable: keep artwork within central safe zone against a black background.
size = 512
canvas = Image.new("RGB", (size, size), "#0A0A0B")
inner = im.resize((384, 384), Image.Resampling.LANCZOS)
canvas.paste(inner, ((size - 384) // 2, (size - 384) // 2))
canvas.save(PUBLIC / "icon-maskable-512.png", optimize=True)
# Apple home-screen icon is the square version; no transparency.
im.resize((180, 180), Image.Resampling.LANCZOS).save(
    PUBLIC / "apple-touch-icon.png", optimize=True
)
# Web branding: preserve the complete artwork.
im.resize((768, 768), Image.Resampling.LANCZOS).save(
    PUBLIC / "brand" / "media-manager-brand.png", optimize=True
)
# Existing web components refer to these legacy brand paths.
im.resize((768, 768), Image.Resampling.LANCZOS).save(
    PUBLIC / "brand" / "logo.jpg", quality=92, optimize=True
)
im.resize((256, 256), Image.Resampling.LANCZOS).save(
    PUBLIC / "brand" / "mark.png", optimize=True
)
print("Media-Manager icons and web brand generated.")
