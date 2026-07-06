# Build EWUMS Demo Video on Your PC

This folder **creates the MP4 file on your computer** — it is not pre-recorded in git.

## Output location

After running the build script:

```
docs/ujs-presentation/video-build/output/EWUMS-Client-Demo-7min-Hindi-v1.mp4
```

Full path on your machine:

```
C:\Users\Dell\Projects\egip-platform\docs\ujs-presentation\video-build\output\EWUMS-Client-Demo-7min-Hindi-v1.mp4
```

## Quick start (≈5 min — Hindi voice + title cards)

**PowerShell:**

```powershell
cd C:\Users\Dell\Projects\egip-platform\docs\ujs-presentation\video-build
.\BUILD-DEMO-VIDEO.ps1
```

Requires: **Python 3**, **ffmpeg** (script can install via winget).

## Full demo (≈15 min — live app screen + Hindi voice)

```powershell
cd C:\Users\Dell\Projects\egip-platform\docs\ujs-presentation\video-build
.\BUILD-DEMO-VIDEO.ps1 -WithScreen
```

Records https://ewumsujs.com automatically with Playwright, then merges Hindi narration.

## What gets installed

| Tool | Purpose |
|------|---------|
| `edge-tts` (pip) | Hindi AI voice |
| `ffmpeg` | Video assembly |
| `playwright` (npm, optional) | Screen recording |

## Manual steps

```powershell
python generate-audio.py      # Hindi MP3 per scene
node record-screen.mjs        # Optional screen clips
python assemble-video.py      # Final MP4
```

## Scripts & narration

| File | Purpose |
|------|---------|
| `narration-hindi.json` | Scene text + timings |
| `../CLIENT-DEMO-VIDEO-SCRIPT-HINDI.md` | Full human-readable script |
| `../CLIENT-DEMO-CLICK-CHECKLIST.md` | Manual recording guide |

## Note

- **Audio-only build** (`BUILD-DEMO-VIDEO.ps1`) = blue title cards + professional Hindi voice — good for quick client share.
- **WithScreen build** = real EWUMS UI footage — better for technical demos; needs internet to ewumsujs.com.

For a studio-quality demo, still record manually with OBS using the Hindi script — this automation is a fast alternative.
