#!/usr/bin/env python3
"""Build a short (~2 min) Hindi EWUMS demo MP4 — pip packages only, no winget."""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "narration-hindi-short.json"
OUT_DIR = ROOT / "output"
WORK = OUT_DIR / "work-short"
VOICE = "hi-IN-SwaraNeural"


def ensure_deps() -> tuple[str, str]:
    for pkg in ("edge_tts", "imageio_ffmpeg"):
        try:
            __import__(pkg)
        except ImportError:
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg.replace("_", "-"), "-q"])
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe(), VOICE


def run(ffmpeg: str, cmd: list[str]) -> None:
    subprocess.check_call([ffmpeg, *cmd])


def probe_duration(ffmpeg: str, path: Path) -> float:
    out = subprocess.check_output(
        [ffmpeg, "-i", str(path), "-f", "null", "-"],
        stderr=subprocess.STDOUT,
        text=True,
        errors="ignore",
    )
    # fallback: use ffprobe-style from ffmpeg -i stderr
    import re

    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    if m:
        h, mi, s = m.groups()
        return int(h) * 3600 + int(mi) * 60 + float(s)
    return 20.0


async def synth_all(scenes: list[dict], ffmpeg: str) -> list[tuple[Path, float, str]]:
    import edge_tts

    AUDIO_DIR = OUT_DIR / "audio-short"
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    for scene in scenes:
        mp3 = AUDIO_DIR / f"{scene['id']}.mp3"
        print(f"  Voice: {scene['id']}")
        await edge_tts.Communicate(scene["narration"], VOICE).save(str(mp3))
        dur = probe_duration(ffmpeg, mp3)
        results.append((mp3, max(dur + 0.3, scene.get("durationSec", 20)), scene.get("title", scene["id"])))
    return results


def segment(ffmpeg: str, mp3: Path, dur: float, title: str, index: int) -> Path:
    WORK.mkdir(parents=True, exist_ok=True)
    seg = WORK / f"seg_{index:02d}.mp4"
    safe_title = title.replace("'", "").replace(":", " ")[:60]
    # Blue slide + Hindi title + audio
    vf = (
        f"drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='EWUMS':"
        f"fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h/3-40,"
        f"drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='{safe_title}':"
        f"fontcolor=white:fontsize=40:x=(w-text_w)/2:y=h/2,"
        f"drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='Uttarakhand Jal Sansthan':"
        f"fontcolor=0xBBDEFB:fontsize=28:x=(w-text_w)/2:y=h*2/3"
    )
    run(ffmpeg, [
        "-y",
        "-f", "lavfi", "-i", f"color=c=0x0d47a1:s=1920x1080:d={dur:.2f}",
        "-i", str(mp3),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k", "-shortest",
        "-movflags", "+faststart",
        str(seg),
    ])
    return seg


def main() -> int:
    print("=== EWUMS 2-min Hindi demo ===")
    ffmpeg, _ = ensure_deps()
    print(f"Using ffmpeg: {ffmpeg}")

    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("\n[1/2] Hindi narration...")
    clips = asyncio.run(synth_all(data["scenes"], ffmpeg))

    print("\n[2/2] Video segments...")
    segments = [segment(ffmpeg, mp3, dur, title, i) for i, (mp3, dur, title) in enumerate(clips, 1)]

    list_file = WORK / "concat.txt"
    list_file.write_text("\n".join(f"file '{s.resolve().as_posix()}'" for s in segments), encoding="utf-8")

    final = OUT_DIR / data.get("outputFile", "EWUMS-Client-Demo-2min-Hindi.mp4")
    run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", "-movflags", "+faststart", str(final)])

    print(f"\nDONE:\n  {final.resolve()}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
