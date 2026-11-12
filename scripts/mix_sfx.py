#!/usr/bin/env python3
"""mix_sfx.py — 按 events.json 把音效贴到口播音频上（v0.5）

用法：
    python scripts/mix_sfx.py --voice voice.wav --events events.json \
        --sfx-dir assets/sfx --out mixed.wav [--gain 0.5]

输入：
    voice.wav    口播原声（只播放一次的那一份）
    events.json  render.cjs 产出：[{time: 绝对秒, sfx: 音效名, shot: 镜头id}]
    assets/sfx/  make_sfx.py 产出的同名 wav（缺哪个跳哪个，只警告不报错）

输出：
    mixed.wav    口播 + 音效（48kHz 单声道）。本脚本不做 loudnorm，
                 响度统一由 compose.sh 的 loudnorm=I=-16:TP=-1.5:LRA=11 处理。

实现：每个音效 adelay 到绝对秒点 → volume=gain → 与口播 amix(normalize=0,
duration=first)。normalize=0 保证口播音量不被音效数量稀释；duration=first
保证输出长度 = 口播长度，音效不会拖长成片。
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def main():
    ap = argparse.ArgumentParser(description="按 events.json 混音口播 + 音效")
    ap.add_argument("--voice", required=True)
    ap.add_argument("--events", required=True)
    ap.add_argument("--sfx-dir", default="assets/sfx")
    ap.add_argument("--out", required=True)
    ap.add_argument("--gain", type=float, default=0.5, help="音效相对音量（默认 0.5，不压口播）")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("找不到 ffmpeg，请先安装并加入 PATH")
    voice = Path(args.voice)
    if not voice.exists():
        sys.exit(f"缺口播音频: {voice}")
    events = json.loads(Path(args.events).read_text(encoding="utf-8"))
    sfx_dir = Path(args.sfx_dir)

    usable, skipped = [], []
    for e in events:
        wav = sfx_dir / f"{e['sfx']}.wav"
        if wav.exists() and e.get("time", 0) >= 0:
            usable.append((e, wav))
        else:
            skipped.append(f"{e.get('sfx')}@{e.get('time')}")
    if skipped:
        print(f"WARN 跳过 {len(skipped)} 个缺文件/非法事件: {', '.join(skipped[:8])}...")

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(voice)]
    if not usable:
        print("没有可用音效，仅转码口播")
        cmd += ["-ac", "1", "-ar", "48000", args.out]
        subprocess.run(cmd, check=True)
        print(f"OK {args.out}")
        return

    parts, labels = [], ["[0:a]"]
    for i, (e, wav) in enumerate(usable, start=1):
        cmd += ["-i", str(wav)]
        ms = round(e["time"] * 1000)
        parts.append(f"[{i}:a]adelay={ms}:all=1,volume={args.gain}[s{i}]")
        labels.append(f"[s{i}]")
    fc = ";".join(parts) + ";" + "".join(labels) + \
        f"amix=inputs={len(usable) + 1}:normalize=0:duration=first[out]"
    cmd += ["-filter_complex", fc, "-map", "[out]", "-ac", "1", "-ar", "48000", args.out]
    subprocess.run(cmd, check=True)
    print(f"OK {args.out}（{len(usable)} 个音效，gain={args.gain}）")


if __name__ == "__main__":
    main()