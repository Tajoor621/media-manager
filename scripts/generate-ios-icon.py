#!/usr/bin/env python3
"""Create the iOS universal app icon from the owner's supplied artwork."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "public/brand/media-manager-user-icon.webp"
catalog = root / "ios-native/MediaManager621/Assets.xcassets/AppIcon.appiconset"
catalog.mkdir(parents=True, exist_ok=True)
Image.open(source).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS).save(
    catalog / "AppIcon-1024.png", optimize=True
)
(catalog / "Contents.json").write_text(json.dumps({
    "images": [{"filename": "AppIcon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
    "info": {"author": "xcode", "version": 1}
}, indent=2) + "\n")
print("Generated iOS AppIcon.appiconset")
