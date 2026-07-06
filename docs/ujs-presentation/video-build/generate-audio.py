#!/usr/bin/env python3
"""Generate Hindi narration MP3 files from narration-hindi.json using edge-tts."""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "narration-hindi.json"
AUDIO_DIR = ROOT / "output" / "audio"
VOICE = "hi-IN-SwaraNeural"


async def synth_one(scene_id: str, text: str, out_mp3: Path) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(str(out_mp3))


async def main() -> int:
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        print("Installing edge-tts...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "edge-tts", "-q"])
        import edge_tts  # noqa: F401

    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    for scene in data["scenes"]:
        scene_id = scene["id"]
        out_mp3 = AUDIO_DIR / f"{scene_id}.mp3"
        print(f"  Audio: {scene_id} -> {out_mp3.name}")
        await synth_one(scene_id, scene["narration"], out_mp3)

    print(f"Done — {len(data['scenes'])} files in {AUDIO_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
