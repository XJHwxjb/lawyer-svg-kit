#!/usr/bin/env python3
"""mix_sound.py — 声音三层混音：口播 + BGM(自动ducking) + 音效（v0.7）

用法：
    python scripts/mix_sound.py --voice voice.wav --events events.json \
        --sfx-dir assets/sfx --bgm bgm.wav --out mixed.wav

与渲染引擎无关：任何路线（pipeline / Remotion / 自建引擎）只要产出
voice.wav + events.json + bgm.wav，就都走这一步。混音本身纯 Python 标准库、
逐样本确定性；音效/BGM 若为 ogg/mp3/flac（v0.7 真实录音库默认 ogg），
用 ffmpeg 解码到临时 wav（ffmpeg 本就是合成路线的必备依赖）。

音效解析：--sfx-dir 下按 <name>.wav / .ogg / .mp3 / .flac 顺序找，加载后自动裁掉
前导静音（阈值 = max(0.005, 峰值×2%)），让真实录音的发声点对齐 events 秒点。
assets/sfx 根目录是默认 8 音真实录音套件（whoosh/paper/ching/thud/stamp/crack/pop/scratch），
lib/ 是 114 条备选真实录音（manifest.json 逐条登记来源与许可），换音直接改 events 的 sfx 名
或把自有授权音频放根目录同名覆盖。

响度契约（references/sound.md 规则 2，相对口播活跃 RMS）：
    口播间隙/B-roll：BGM ≈ 口播 RMS − 7dB
    口播说话时：    BGM ≈ 口播 RMS − 17dB（attack 30ms / release 200ms / hangover 300ms）
    音效：gain 0.5，不压口播。
本脚本不做 loudnorm；响度统一由合成脚本最后的 loudnorm=I=-16:TP=-1.5:LRA=11 处理。
"""
import argparse
import array
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SR = 48000
HOP = 2400  # 50ms 包络窗
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2:
            sys.exit(f"{path}: 只支持 16-bit PCM wav（先用 ffmpeg 转：-acodec pcm_s16le）")
        ch, rate, n = w.getnchannels(), w.getframerate(), w.getnframes()
        raw = array.array("h")
        raw.frombytes(w.readframes(n))
    if ch == 2:
        mono = array.array("d", ((raw[i] + raw[i + 1]) / 65536.0 for i in range(0, len(raw), 2)))
    else:
        mono = array.array("d", (v / 32768.0 for v in raw))
    if rate != SR:
        m = int(len(mono) * SR / rate)
        out = array.array("d", [0.0]) * m
        for i in range(m):
            x = i * rate / SR
            j = int(x)
            f = x - j
            a = mono[j] if j < len(mono) else 0.0
            b = mono[j + 1] if j + 1 < len(mono) else a
            out[i] = a + (b - a) * f
        mono = out
    return mono


def load_audio(path):
    path = Path(path)
    if path.suffix.lower() == ".wav":
        return read_wav(path)
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / "decoded.wav"
        subprocess.run([FFMPEG, "-y", "-v", "error", "-i", str(path),
                        "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", str(tmp)], check=True)
        return read_wav(tmp)


def trim_lead(x):
    pk = max((abs(v) for v in x), default=0.0)
    th = max(0.005, pk * 0.02)
    i = 0
    while i < len(x) and abs(x[i]) < th:
        i += 1
    return x[i:] if i < len(x) else x


def rms_windows(x):
    out = []
    for i in range(0, len(x), HOP):
        seg = x[i:i + HOP]
        out.append(math.sqrt(sum(v * v for v in seg) / max(1, len(seg))))
    return out


def main():
    ap = argparse.ArgumentParser(description="口播 + BGM ducking + 音效 三层混音")
    ap.add_argument("--voice", required=True)
    ap.add_argument("--events", default="")
    ap.add_argument("--sfx-dir", default="assets/sfx")
    ap.add_argument("--bgm", default="", help="BGM wav；不填 = 无 BGM（须向用户声明）")
    ap.add_argument("--out", required=True)
    ap.add_argument("--sfx-gain", type=float, default=0.5)
    ap.add_argument("--bed-gap-db", type=float, default=-7, help="间隙时 BGM 相对口播 RMS")
    ap.add_argument("--bed-duck-db", type=float, default=-17, help="说话时 BGM 相对口播 RMS")
    args = ap.parse_args()

    voice = load_audio(Path(args.voice))
    n = len(voice)
    mix = array.array("d", voice)

    vr_list = [r for r in rms_windows(voice) if r > 0.01]
    vr = math.sqrt(sum(r * r for r in vr_list) / len(vr_list)) if vr_list else 0.1

    stats = {"voice_rms_db": round(20 * math.log10(max(1e-9, vr)), 1), "sfx": 0}

    if args.bgm:
        bed = load_audio(Path(args.bgm))
        br = math.sqrt(sum(v * v for v in bed) / max(1, len(bed))) or 1e-6
        gap_g = vr * 10 ** (args.bed_gap_db / 20) / br
        duck_g = vr * 10 ** (args.bed_duck_db / 20) / br
        wins = rms_windows(voice)
        # 300ms hangover：词间/句间短停顿不算间隙，说话期间 BGM 保持压低；
        # 真正停顿 ≥0.3s 后才以 200ms release 抬头，间隙音乐可闻地 swell。
        raw = [r > 0.01 for r in wins]
        act = raw[:]
        for k, a in enumerate(raw):
            if a:
                for j in range(k + 1, min(len(act), k + 7)):
                    act[j] = True
        gains, g = [], gap_g
        for a in act:
            target = duck_g if a else gap_g
            g += (target - g) * (0.8 if target < g else 0.22)
            gains.append(g)
        # 逐样本线性插值包络 + 首尾淡入淡出
        fade_in, fade_out = int(0.5 * SR), int(0.8 * SR)
        for k, gk in enumerate(gains):
            g2 = gains[k + 1] if k + 1 < len(gains) else gk
            i0, i1 = k * HOP, min(n, (k + 1) * HOP)
            for i in range(i0, i1):
                if i >= len(bed):
                    break
                env = gk + (g2 - gk) * ((i - i0) / HOP)
                if i < fade_in:
                    env *= i / fade_in
                if i > n - fade_out:
                    env *= max(0.0, (n - i) / fade_out)
                mix[i] += bed[i] * env
        stats["bed_gap_db_rel"] = args.bed_gap_db
        stats["bed_duck_db_rel"] = args.bed_duck_db
    else:
        print("WARN 无 BGM：成片将只有口播+音效，须向用户声明")

    if args.events and Path(args.events).exists():
        events = json.loads(Path(args.events).read_text(encoding="utf-8"))
        sfx_dir = Path(args.sfx_dir)
        cache, missing = {}, []
        for e in events:
            name, t = e["sfx"], e.get("time", -1)
            if t < 0:
                continue
            if name not in cache:
                hit = next((sfx_dir / f"{name}{ext}" for ext in (".wav", ".ogg", ".mp3", ".flac")
                            if (sfx_dir / f"{name}{ext}").exists()), None)
                if hit is None:
                    missing.append(name)
                    cache[name] = None
                else:
                    cache[name] = trim_lead(load_audio(hit))
            s = cache[name]
            if s is None:
                continue
            i0 = int(t * SR)
            for i, v in enumerate(s):
                j = i0 + i
                if j >= n:
                    break
                mix[j] += v * args.sfx_gain
            stats["sfx"] += 1
        if missing:
            stats["sfx_missing"] = sorted(set(missing))

    peak = max(1e-9, max(abs(v) for v in mix))
    if peak > 0.98:
        g = 0.98 / peak
        for i in range(n):
            mix[i] *= g
    stats["peak_db"] = round(20 * math.log10(peak), 1)
    pcm = array.array("h", (int(max(-1, min(1, v)) * 32767) for v in mix))
    with wave.open(str(args.out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"OK {args.out} " + json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()