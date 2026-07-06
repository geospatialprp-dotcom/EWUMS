#!/usr/bin/env python3
"""Merge Hindi narration + optional screen clips into one MP4 using ffmpeg."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG = ROOT / "narration-hindi.json"
AUDIO_DIR = ROOT / "output" / "audio"
SCREEN_DIR = ROOT / "output" / "screen-clips"
OUT_DIR = ROOT / "output"
WORK = OUT_DIR / "work"


def run(cmd: list[str]) -> None:
    print(" ", " ".join(cmd[:8]), "..." if len(cmd) > 8 else "")
    subprocess.check_call(cmd)


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        text=True,
    )
    return float(out.strip())


def find_screen_video(scene_id: str) -> Path | None:
    clip_dir = SCREEN_DIR / scene_id
    if not clip_dir.is_dir():
        return None
    for ext in (".webm", ".mp4"):
        for f in clip_dir.glob(f"*{ext}"):
            return f
    return None


def make_scene_segment(scene: dict, index: int) -> Path:
    scene_id = scene["id"]
    audio_mp3 = AUDIO_DIR / f"{scene_id}.mp3"
    if not audio_mp3.exists():
        raise FileNotFoundError(f"Missing audio: {audio_mp3} — run generate-audio.py first")

    audio_dur = ffprobe_duration(audio_mp3)
    target_dur = max(audio_dur + 0.5, float(scene.get("durationSec", 30)))
    seg_out = WORK / f"seg_{index:02d}_{scene_id}.mp4"
    screen = find_screen_video(scene_id)
    title = scene.get("title", scene_id).replace(":", " ").replace("'", "")

    if screen and screen.exists():
        # Scale screen clip to target duration (trim or loop last frame via tpad)
        scaled = WORK / f"screen_{scene_id}.mp4"
        run([
            "ffmpeg", "-y", "-i", str(screen),
            "-vf", f"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1",
            "-t", str(target_dur), "-an", str(scaled),
        ])
        run([
            "ffmpeg", "-y", "-i", str(scaled), "-i", str(audio_mp3),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k", "-shortest",
            "-movflags", "+faststart", str(seg_out),
        ])
    else:
        # Title card + audio only
        run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=0x0d47a1:s=1920x1080:d={target_dur}",
            "-i", str(audio_mp3),
            "-vf",
            (
                f"drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='EWUMS':"
                f"fontcolor=white:fontsize=72:x=(w-text_w)/2:y=h/3,"
                f"drawtext=fontfile=C\\\\:/Windows/Fonts/arial.ttf:text='{title}':"
                f"fontcolor=white:fontsize=48:x=(w-text_w)/2:y=h/2"
            ),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "192k", "-shortest",
            "-movflags", "+faststart", str(seg_out),
        ])

    return seg_out


def main() -> int:
    if not shutil.which("ffmpeg"):
        print("ERROR: ffmpeg not found. Install: winget install Gyan.FFmpeg")
        return 1

    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)

    segments: list[Path] = []
    for i, scene in enumerate(data["scenes"], start=1):
        print(f"Segment {i}: {scene['id']}")
        segments.append(make_scene_segment(scene, i))

    list_file = WORK / "concat.txt"
    list_file.write_text(
        "\n".join(f"file '{s.resolve().as_posix()}'" for s in segments),
        encoding="utf-8",
    )

    final = OUT_DIR / data.get("outputFile", "EWUMS-Client-Demo-7min-Hindi-v1.mp4")
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(list_file),
        "-c", "copy", "-movflags", "+faststart", str(final),
    ])

    print(f"\nVIDEO READY:\n  {final.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
