#!/usr/bin/env python3
"""make_bgm.py — 纯 Python 标准库程序化生成 BGM（v0.6，无版权风险）

用法：
    python scripts/make_bgm.py --dur 96.133 --mood serious --out bgm.wav
    python scripts/make_bgm.py --dur 96.133 --config sound.json --out bgm.wav
    python scripts/make_bgm.py --dur 30 --mood upbeat --bpm 124 \
        --sections '[{"at":0,"mood":"serious"},{"at":12,"mood":"upbeat"}]' --out bgm.wav

三种情绪预设（references/sound.md 规则 1/4）：
    serious  低频钢琴拨弦 + 弦乐垫，无鼓。案情/严肃段。默认 76 BPM。
    steady   垫 + 八分琶音 + 轻鼓点。分析/方法段。默认 96 BPM。
    upbeat   轻快鼓组 + 五声旋律。收尾/行动号召段。默认 124 BPM。

分段铺设：--sections / --config 里的 sections 在章节边界切换情绪，
边界处做 0.5s「小停顿」呼吸（音量 dips 到 30%，不是静音）。
全部由数学公式合成，不含任何第三方素材；想要真实音乐用有授权的
wav 直接替换 bgm.wav（mix_sound.py 只认文件）。
"""
import argparse
import array
import json
import math
import random
import sys
import wave
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SR = 48000
MOODS = ("serious", "steady", "upbeat")
DEFAULT_BPM = {"serious": 76, "steady": 96, "upbeat": 124}
PROG = {"serious": [57, 53, 48, 55], "steady": [57, 53, 48, 55], "upbeat": [60, 55, 57, 53]}
PENTA = [0, 3, 5, 7, 10, 12]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def add(buf, start, dur, fn, amp):
    n = len(buf)
    i0 = max(0, int(start * SR))
    i1 = min(n, int((start + dur) * SR))
    for i in range(i0, i1):
        buf[i] += amp * fn((i - i0) / SR)


def pluck(freq, decay=5.0):
    w = 2 * math.pi * freq
    def f(t):
        e = math.exp(-decay * t) * min(t / 0.005, 1)
        return e * (math.sin(w * t) + 0.35 * math.sin(2 * w * t) + 0.12 * math.sin(3 * w * t))
    return f


def pad(freq):
    w = 2 * math.pi * freq
    def f(t):
        return (math.sin(w * t) + 0.6 * math.sin(w * 1.003 * t) + 0.6 * math.sin(w * 0.997 * t)
                + 0.15 * math.sin(2 * w * t)) / 2.35
    return f


def bass(freq):
    w = 2 * math.pi * freq
    return lambda t: math.exp(-3 * t) * (math.sin(w * t) + 0.3 * math.sin(2 * w * t))


def kick():
    def f(t):
        ph = 2 * math.pi * (45 * t + 75 * 0.12 * (1 - math.exp(-t / 0.04)))
        return math.exp(-18 * t) * math.sin(ph)
    return f


def hat(rng):
    noise = [rng.uniform(-1, 1) for _ in range(int(0.06 * SR))]
    def f(t):
        i = int(t * SR)
        if i >= len(noise):
            return 0.0
        v = noise[i] - (noise[i - 1] if i else 0)
        return v * math.exp(-60 * t)
    return f


def snare(rng):
    noise = [rng.uniform(-1, 1) for _ in range(int(0.2 * SR))]
    def f(t):
        i = int(t * SR)
        if i >= len(noise):
            return 0.0
        return (0.5 * noise[i] + 0.3 * math.sin(2 * math.pi * 180 * t)) * math.exp(-25 * t)
    return f


def bar(buf, t0, beat, mood, chord, rng):
    if mood == "serious":
        add(buf, t0, beat * 2.2, pluck(hz(chord - 12), 3.5), 0.5)
        add(buf, t0 + 2 * beat, beat * 1.8, pluck(hz(chord - 5), 4), 0.32)
        for iv in (0, 3, 7):
            add(buf, t0, beat * 4, pad(hz(chord + iv)), 0.055)
        if rng.random() < 0.5:
            add(buf, t0 + 3 * beat, beat, pluck(hz(chord + 12), 5), 0.16)
    elif mood == "steady":
        for iv in (0, 3, 7):
            add(buf, t0, beat * 4, pad(hz(chord + iv)), 0.045)
        for k, iv in enumerate((0, 7, 12, 7, 0, 7, 12, 15)):
            add(buf, t0 + k * beat / 2, beat * 0.6, pluck(hz(chord + iv), 6), 0.2)
        for b in range(4):
            add(buf, t0 + b * beat, 0.25, kick(), 0.4)
            add(buf, t0 + (b + 0.5) * beat, 0.06, hat(rng), 0.1)
        add(buf, t0, beat * 1.5, bass(hz(chord - 12)), 0.35)
    else:
        for b in range(4):
            add(buf, t0 + b * beat, 0.25, kick(), 0.55)
            add(buf, t0 + b * beat / 2, 0.06, hat(rng), 0.13)
            add(buf, t0 + (b + 0.5) * beat, 0.06, hat(rng), 0.13)
        for b in (1, 3):
            add(buf, t0 + b * beat, 0.2, snare(rng), 0.3)
        for k, iv in enumerate((0, 0, 7, 0)):
            add(buf, t0 + k * beat, beat * 0.9, bass(hz(chord - 12 + iv)), 0.3)
        for k in range(8):
            if rng.random() < 0.8:
                iv = rng.choice(PENTA)
                add(buf, t0 + k * beat / 2, beat * 0.55, pluck(hz(chord + 12 + iv), 7), 0.22)


def main():
    ap = argparse.ArgumentParser(description="程序化生成 BGM（无版权风险）")
    ap.add_argument("--dur", type=float, required=True)
    ap.add_argument("--mood", default="serious", choices=MOODS)
    ap.add_argument("--bpm", type=float, default=0, help="0=按情绪默认（serious76/steady96/upbeat124）")
    ap.add_argument("--sections", default="", help='JSON 字符串或文件：[{"at":秒,"mood":...}]')
    ap.add_argument("--config", default="", help="sound.json：含 mood/bpm/sections，优先于命令行")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    mood, bpm, sections = args.mood, args.bpm, []
    if args.sections:
        p = Path(args.sections)
        sections = json.loads(p.read_text(encoding="utf-8") if p.exists() else args.sections)
    if args.config:
        d = json.loads(Path(args.config).read_text(encoding="utf-8"))
        mood = d.get("mood", mood)
        bpm = d.get("bpm", bpm) or bpm
        sections = d.get("sections", sections) or sections
    if mood not in MOODS:
        sys.exit(f"未知 mood: {mood}（可选 {MOODS}）")
    bpm = bpm or DEFAULT_BPM[mood]
    sections = sorted(sections, key=lambda s: s["at"]) if sections else [{"at": 0, "mood": mood}]
    if sections[0]["at"] > 0:
        sections.insert(0, {"at": 0, "mood": mood})

    rng = random.Random(args.seed)
    n = int(args.dur * SR)
    buf = array.array("d", [0.0]) * n
    beat = 60.0 / bpm
    barlen = 4 * beat
    t = 0.0
    bi = 0
    while t < args.dur - 0.05:
        mood_here = sections[0]["mood"]
        for s in sections:
            if s["at"] <= t + 1e-6:
                mood_here = s["mood"]
        chord = PROG[mood_here][bi % 4]
        bar(buf, t, beat, mood_here, chord, rng)
        t += barlen
        bi += 1

    # 分段 RMS 校准：各情绪段响度一致，mix_sound 的 −7/−17 契约在每段都成立
    bounds = [s["at"] for s in sections] + [args.dur]
    for k in range(len(sections)):
        i0, i1 = int(bounds[k] * SR), min(n, int(bounds[k + 1] * SR))
        if i1 <= i0:
            continue
        r = math.sqrt(sum(buf[i] * buf[i] for i in range(i0, i1)) / (i1 - i0)) or 1e-9
        g = 0.12 / r
        for i in range(i0, i1):
            buf[i] *= g

    # 章节边界「小停顿」呼吸：dip 到 30%，0.5s，不是静音（静音会触发连续性门禁）
    for s in sections[1:]:
        a = s["at"]
        i0, i1 = int((a - 0.15) * SR), int((a + 0.35) * SR)
        for i in range(max(0, i0), min(n, i1)):
            tt = i / SR
            if tt < a:
                g = 1 - 0.7 * (tt - (a - 0.15)) / 0.15
            elif tt < a + 0.1:
                g = 0.3
            else:
                g = 0.3 + 0.7 * (tt - a - 0.1) / 0.25
            buf[i] *= g
    for i in range(min(n, int(0.4 * SR))):
        buf[i] *= i / (0.4 * SR)
    for i in range(max(0, n - int(0.8 * SR)), n):
        buf[i] *= (n - i) / (0.8 * SR)

    peak = max(1e-9, max(abs(v) for v in buf))
    g = 0.7 / peak
    pcm = array.array("h", (int(max(-1, min(1, v * g)) * 32767) for v in buf))
    with wave.open(str(args.out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"OK {args.out}（{args.dur:.1f}s, {bpm:.0f}BPM, beat={beat:.3f}s, "
          f"sections={[(s['at'], s['mood']) for s in sections]}）")


if __name__ == "__main__":
    main()