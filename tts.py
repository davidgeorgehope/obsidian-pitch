#!/usr/bin/env python3
"""
ElevenLabs TTS — standalone text-to-speech script.

Voice: Sarah (EXAVITQu4vr4xnSDxMaL) — Mature, Reassuring, Confident
Model: eleven_turbo_v2_5
Pronounces "SaaS" correctly.

Usage:
  # From text argument
  python3 tts.py "Hello, this is a test."

  # From file
  python3 tts.py --file input.txt

  # Custom output path
  python3 tts.py "Hello world" --out greeting.mp3

  # Override voice
  python3 tts.py "Hello" --voice-id XrExE9yKIg1WjnnlVkGX

  # List available voices
  python3 tts.py --voices

Environment:
  ELEVENLABS_API_KEY — required, or set in .env file in same directory
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    os.system(f"{sys.executable} -m pip install requests -q")
    import requests

BASE_URL = "https://api.elevenlabs.io/v1"

# Default voice config — Sarah, turbo v2.5
DEFAULTS = {
    "voice_id": "EXAVITQu4vr4xnSDxMaL",  # Sarah
    "model_id": "eleven_turbo_v2_5",
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0.3,
}


def load_api_key():
    """Load API key from env var or .env file."""
    key = os.environ.get("ELEVENLABS_API_KEY")
    if key:
        return key
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("ELEVENLABS_API_KEY"):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def list_voices(api_key):
    """List all available voices."""
    resp = requests.get(
        f"{BASE_URL}/voices",
        headers={"xi-api-key": api_key},
    )
    if not resp.ok:
        print(f"Error: {resp.status_code} {resp.text}")
        return
    print(f"{'Voice ID':<30} {'Name':<25} {'Gender':<10} {'Accent':<15} {'Description'}")
    print("-" * 110)
    for v in resp.json()["voices"]:
        labels = v.get("labels", {})
        print(
            f"{v['voice_id']:<30} {v['name']:<25} "
            f"{labels.get('gender', '?'):<10} "
            f"{labels.get('accent', '?'):<15} "
            f"{labels.get('description', '')}"
        )


def synthesize(api_key, text, voice_id=None, model_id=None,
               stability=None, similarity_boost=None, style=None):
    """Generate speech from text. Returns audio bytes."""
    vid = voice_id or DEFAULTS["voice_id"]
    payload = {
        "text": text,
        "model_id": model_id or DEFAULTS["model_id"],
        "voice_settings": {
            "stability": stability if stability is not None else DEFAULTS["stability"],
            "similarity_boost": similarity_boost if similarity_boost is not None else DEFAULTS["similarity_boost"],
            "style": style if style is not None else DEFAULTS["style"],
        },
    }
    resp = requests.post(
        f"{BASE_URL}/text-to-speech/{vid}",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        },
        json=payload,
    )
    if resp.status_code == 200:
        return resp.content
    else:
        print(f"Error: {resp.status_code} — {resp.text[:300]}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="ElevenLabs TTS — text to speech with Sarah voice (turbo v2.5)"
    )
    parser.add_argument("text", nargs="?", help="Text to synthesize")
    parser.add_argument("--file", "-f", help="Read text from file")
    parser.add_argument("--out", "-o", default="output.mp3", help="Output file (default: output.mp3)")
    parser.add_argument("--voice-id", help=f"Voice ID (default: {DEFAULTS['voice_id']})")
    parser.add_argument("--model-id", help=f"Model ID (default: {DEFAULTS['model_id']})")
    parser.add_argument("--stability", type=float, help=f"Stability 0-1 (default: {DEFAULTS['stability']})")
    parser.add_argument("--similarity-boost", type=float, help=f"Similarity boost 0-1 (default: {DEFAULTS['similarity_boost']})")
    parser.add_argument("--style", type=float, help=f"Style 0-1 (default: {DEFAULTS['style']})")
    parser.add_argument("--voices", action="store_true", help="List available voices")
    args = parser.parse_args()

    api_key = load_api_key()
    if not api_key:
        print("Error: ELEVENLABS_API_KEY not set. Set it in env or .env file.", file=sys.stderr)
        sys.exit(1)

    if args.voices:
        list_voices(api_key)
        return

    # Get text
    text = args.text
    if args.file:
        text = Path(args.file).read_text()
    if not text:
        # Read from stdin
        if not sys.stdin.isatty():
            text = sys.stdin.read()
        else:
            parser.print_help()
            sys.exit(1)

    text = text.strip()
    if not text:
        print("Error: empty text", file=sys.stderr)
        sys.exit(1)

    print(f"Voice: {args.voice_id or DEFAULTS['voice_id']}")
    print(f"Model: {args.model_id or DEFAULTS['model_id']}")
    print(f"Text: {text[:80]}{'...' if len(text) > 80 else ''}")
    print(f"Output: {args.out}")

    audio = synthesize(
        api_key, text,
        voice_id=args.voice_id,
        model_id=args.model_id,
        stability=args.stability,
        similarity_boost=args.similarity_boost,
        style=args.style,
    )

    if audio:
        Path(args.out).write_bytes(audio)
        print(f"Done: {len(audio) / 1024:.0f} KB written to {args.out}")
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
