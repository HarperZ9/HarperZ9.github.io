"""Narration with the local Windows voice (System.Speech). No network, and it rebuilds exactly.

The voice ships with Windows, so the narration only rebuilds on Windows. The receipt names the
voice and the operating system build, so a mismatch elsewhere is explainable.
"""

from __future__ import annotations

import subprocess
import wave
from pathlib import Path

VOICE, RATE, PAD = "Microsoft Zira Desktop", 22050, 0.7


def speak(text: str, wav: Path) -> float:
    """Speak one line to a 16-bit mono WAV; return its length in seconds."""
    txt = wav.with_suffix(".txt")
    txt.write_text(text, encoding="utf-8")
    script = ("Add-Type -AssemblyName System.Speech;"
              "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;"
              f"$s.SelectVoice('{VOICE}');"
              f"$f=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo({RATE},"
              "[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,"
              "[System.Speech.AudioFormat.AudioChannel]::Mono);"
              f"$s.SetOutputToWaveFile('{wav}',$f);"
              f"$s.Speak([IO.File]::ReadAllText('{txt}'));$s.Dispose()")
    subprocess.run(["powershell.exe", "-NoProfile", "-Command", script], check=True)
    with wave.open(str(wav)) as w:
        return w.getnframes() / w.getframerate()


def narrate(scenes: list[dict], work: Path, fps: int) -> tuple[list[tuple[dict, float, float]], Path]:
    """Speak every scene, pad each to whole frames and its minimum length, and join them.

    Returns (scene, start, end) per scene and the path of the joined narration WAV.
    """
    timeline, pcm, t = [], bytearray(), 0.0
    for scene in scenes:
        wav = work / f"line-{scene['key']}.wav"
        duration = max(scene.get("min", 3.0), speak(scene["say"], wav) + PAD)
        duration = round(duration * fps) / fps
        with wave.open(str(wav)) as w:
            data = w.readframes(w.getnframes())
        need = round(duration * RATE) * 2
        pcm += data[:need] + bytes(max(0, need - len(data)))
        timeline.append((scene, t, t + duration))
        t += duration
    out = work / "narration.wav"
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(pcm))
    return timeline, out
