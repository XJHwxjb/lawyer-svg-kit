#!/usr/bin/env python3
"""fetch_bgm.py — 真实曲目 BGM（v0.7）：按章节 mood 运行时下载 Mixkit 曲目并组装 bgm.wav

用法：
    python scripts/fetch_bgm.py --dur 96.133 --config sound.json --out bgm.wav --cache-dir bgm-src
    python scripts/fetch_bgm.py --dur 20 --mood serious --out bgm.wav
    python scripts/fetch_bgm.py --dur 60 --sections '[{"at":0,"mood":"serious"},{"at":30,"mood":"upbeat"}]' --out bgm.wav

许可（assets/bgm/catalog.json，Mixkit Stock Music Free License，2026-10-13 核对）：
在线视频商用免费、无需署名；但禁止再分发原文件 → mp3 只下载到案件工程（--cache-dir），
不进公开仓库。每个案件首次使用前打开 license_url 核对许可未变，记录进 bgm.credits.json。

组装：每章自动跳过安静前奏、在曲目中选头尾都活跃的位置裁剪/循环到章节长 →
分段 RMS 校准 0.12 → 章节间 0.8s 等功率交叉淡化 → 首尾 0.4s/0.8s 淡入淡出 → 峰值 0.7。
ducking 不在这里做，统一由 mix_sound.py 负责。

网络失败/下载失败 → 退出码 1，compose.sh 回退 make_bgm.py 合成 BGM 并向用户声明。
"""
import argparse
import array
import json
import math
import subprocess
import sys
import tempfile
import urllib.request
import wave
from pathlib import Path

import mix_sound
from mix_sound import SR, read_wav

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

XFADE = 0.8
TARGET_RMS = 0.12


def fetch(url, dst, proxy):
    if dst.exists() and dst.stat().st_size > 10000:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({"https": proxy, "http": proxy})) if proxy else urllib.request.build_opener()
    for i in range(3):
        try:
            with opener.open(url, timeout=45) as r:
                data = r.read()
            if len(data) < 10000:
                raise Exception("文件过小，疑似错误页")
            dst.write_bytes(data)
            return
        except Exception:
            if i == 2:
                raise
    raise Exception("unreachable")


def decode(path):
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "d.wav"
        subprocess.run([mix_sound.FFMPEG, "-y", "-v", "error", "-i", str(path),
                        "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(tmp)], check=True)
        return read_wav(tmp)


def loop_to(src, need):
    if len(src) >= need:
        return array.array("d", src[:need])
    out = array.array("d", src)
    seam = int(0.05 * SR)
    while len(out) < need:
        take = min(len(src), need - len(out) + seam)
        chunk = src[:take]
        start = len(out) - seam
        for i in range(seam):
            f = i / seam
            out[start + i] = out[start + i] * (1 - f) + chunk[i] * f
        out.extend(chunk[seam:])
    return out[:need]


def choose_offset(src, need):
    hop = int(0.25 * SR)
    if len(src) < hop * 4:
        return 0
    prof = [math.sqrt(sum(v * v for v in src[i:i + hop]) / hop) for i in range(0, len(src) - hop, hop)]
    med = sorted(prof)[len(prof) // 2] or 1e-9
    start = 0
    for i, r in enumerate(prof):
        if r >= 0.6 * med:
            start = i * hop
            break
    if len(src) <= need:
        return start
    limit = min(len(src) - need, start + int(20 * SR))
    best, best_score = start, -1.0
    for off in range(start, limit + 1, hop):
        head = math.sqrt(sum(v * v for v in src[off:off + hop]) / hop)
        tail = math.sqrt(sum(v * v for v in src[off + need - hop:off + need]) / hop)
        score = min(head, tail)
        if score > best_score:
            best, best_score = off, score
    return best


def calibrate(buf):
    r = math.sqrt(sum(v * v for v in buf) / max(1, len(buf))) or 1e-9
    g = TARGET_RMS / r
    for i in range(len(buf)):
        buf[i] *= g
    return buf


def main():
    ap = argparse.ArgumentParser(description="按章节 mood 下载真实曲目组装 BGM")
    ap.add_argument("--dur", type=float, required=True)
    ap.add_argument("--mood", default="serious")
    ap.add_argument("--sections", default="", help="JSON 字符串或文件：[{at,mood}]")
    ap.add_argument("--config", default="", help="sound.json（含 mood/sections）")
    ap.add_argument("--tracks", default="", help="覆盖选曲 JSON：{mood: mixkit_id}")
    ap.add_argument("--catalog", default=str(Path(__file__).resolve().parent.parent / "assets" / "bgm" / "catalog.json"))
    ap.add_argument("--cache-dir", default="bgm-src")
    ap.add_argument("--proxy", default="", help="如 http://127.0.0.1:7897")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    cat = json.loads(Path(args.catalog).read_text(encoding="utf-8"))
    sections = []
    if args.sections:
        p = Path(args.sections)
        sections = json.loads(p.read_text(encoding="utf-8") if p.exists() else args.sections)
    elif args.config:
        cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
        sections = cfg.get("sections") or []
        args.mood = cfg.get("mood", args.mood)
    if not sections:
        sections = [{"at": 0, "mood": args.mood}]
    sections = sorted(sections, key=lambda s: s["at"])
    if sections[0]["at"] > 0:
        sections.insert(0, {"at": 0, "mood": args.mood})
    override = json.loads(args.tracks) if args.tracks else {}

    bounds = [s["at"] for s in sections] + [args.dur]
    cache = Path(args.cache_dir)
    bufs, credits = [], []
    for k, s in enumerate(sections):
        L = bounds[k + 1] - bounds[k]
        if L <= 0:
            continue
        mood = s.get("mood", args.mood)
        ids = cat["moods"].get(mood, cat["moods"]["serious"])
        tid = str(override.get(mood, ids[0]))
        tr = cat["tracks"].get(tid)
        if not tr:
            sys.exit(f"catalog 无曲目 {tid}")
        url = cat["source_pattern"].format(id=tid)
        mp3 = cache / f"{tid}.mp3"
        try:
            fetch(url, mp3, args.proxy)
            src = decode(mp3)
        except Exception as e:
            sys.exit(f"FETCH_FAIL mood={mood} id={tid}: {e}")
        need = int((L + (XFADE if k < len(sections) - 1 else 0)) * SR)
        off = choose_offset(src, need)
        bufs.append(calibrate(loop_to(src[off:], need)))
        credits.append({"at": s["at"], "mood": mood, "id": tid, "title": tr["title"], "artist": tr["artist"],
                        "license": cat["license"], "license_url": cat["license_url"], "source_url": url,
                        "cache_file": str(mp3)})
        print(f"  section {s['at']:>6.1f}s {mood:8s} -> #{tid} {tr['title']} ({L:.1f}s)")

    xf = int(XFADE * SR)
    out = bufs[0]
    for b in bufs[1:]:
        start = len(out) - xf
        for i in range(xf):
            f = i / xf
            out[start + i] = out[start + i] * math.cos(f * math.pi / 2) + b[i] * math.sin(f * math.pi / 2)
        out.extend(b[xf:])
    n = int(args.dur * SR)
    out = out[:n]
    if len(out) < n:
        out.extend(array.array("d", [0.0]) * (n - len(out)))
    fi, fo = int(0.4 * SR), int(0.8 * SR)
    for i in range(min(fi, n)):
        out[i] *= i / fi
    for i in range(max(0, n - fo), n):
        out[i] *= (n - i) / fo
    peak = max(1e-9, max(abs(v) for v in out))
    g = 0.7 / peak
    pcm = array.array("h", (int(max(-1, min(1, v * g)) * 32767) for v in out))
    with wave.open(str(args.out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    Path(args.out).with_name("bgm.credits.json").write_text(
        json.dumps({"license_checked": cat["checked"], "tracks": credits}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"OK {args.out} ({args.dur:.1f}s, {len(credits)} tracks, credits=bgm.credits.json)")


if __name__ == "__main__":
    main()