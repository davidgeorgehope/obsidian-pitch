#!/usr/bin/env python3
"""Generate narration audio for each slide using ElevenLabs API."""

import json
import os
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests -q")
    import requests

# Load config
script_dir = Path(__file__).parent
env_path = script_dir / ".env"
slides_path = script_dir / "slides.json"
audio_dir = script_dir / "audio"
audio_dir.mkdir(exist_ok=True)

# Parse .env
api_key = None
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith("ELEVENLABS_API_KEY"):
            api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

if not api_key:
    print("Error: ELEVENLABS_API_KEY not found in .env")
    sys.exit(1)

# Load slides
with open(slides_path) as f:
    config = json.load(f)

voice_config = config["voice"]
slides = config["slides"]

# ElevenLabs API
BASE_URL = "https://api.elevenlabs.io/v1"
headers = {
    "xi-api-key": api_key,
    "Content-Type": "application/json",
}


def list_voices():
    """List available voices to help pick one."""
    resp = requests.get(f"{BASE_URL}/voices", headers=headers)
    if resp.ok:
        for v in resp.json()["voices"]:
            labels = v.get("labels", {})
            gender = labels.get("gender", "?")
            accent = labels.get("accent", "?")
            desc = labels.get("description", "")
            print(f"  {v['voice_id']}  {v['name']:20s}  {gender:8s}  {accent:12s}  {desc}")
    else:
        print(f"Failed to list voices: {resp.status_code} {resp.text}")


def generate_slide_audio(slide_id, text, voice_cfg):
    """Generate audio for a single slide."""
    out_path = audio_dir / f"{slide_id}.mp3"

    if out_path.exists():
        print(f"  [skip] {slide_id}.mp3 already exists")
        return True

    payload = {
        "text": text,
        "model_id": voice_cfg["model_id"],
        "voice_settings": {
            "stability": voice_cfg["stability"],
            "similarity_boost": voice_cfg["similarity_boost"],
            "style": voice_cfg["style"],
        },
    }

    resp = requests.post(
        f"{BASE_URL}/text-to-speech/{voice_cfg['voice_id']}",
        headers=headers,
        json=payload,
    )

    if resp.status_code == 200:
        out_path.write_bytes(resp.content)
        size_kb = len(resp.content) / 1024
        print(f"  [done] {slide_id}.mp3 ({size_kb:.0f} KB)")
        return True
    else:
        print(f"  [FAIL] {slide_id}: {resp.status_code} — {resp.text[:200]}")
        return False


def main():
    if "--voices" in sys.argv:
        print("Available voices:")
        list_voices()
        return

    slide_filter = None
    if "--slide" in sys.argv:
        idx = sys.argv.index("--slide")
        if idx + 1 < len(sys.argv):
            slide_filter = sys.argv[idx + 1]

    if "--regenerate" in sys.argv:
        # Remove existing files to force regeneration
        for slide in slides:
            f = audio_dir / f"{slide['id']}.mp3"
            if slide_filter and slide["id"] != slide_filter:
                continue
            if f.exists():
                f.unlink()
                print(f"  [removed] {slide['id']}.mp3")

    print(f"Generating audio for {len(slides)} slides...")
    print(f"Voice: {voice_config['voice_id']}")
    print(f"Model: {voice_config['model_id']}")
    print()

    success = 0
    failed = 0
    for slide in slides:
        if slide_filter and slide["id"] != slide_filter:
            continue
        print(f"Slide: {slide['id']}")
        if generate_slide_audio(slide["id"], slide["narration"], voice_config):
            success += 1
        else:
            failed += 1
        time.sleep(0.5)  # Rate limit courtesy

    print(f"\nDone: {success} generated, {failed} failed")


if __name__ == "__main__":
    main()
