#!/usr/bin/env python3
"""make_sfx.py — 用 ffmpeg 合成 8 个法律动画音效（v0.5，无版权风险的占位音）

用法：
    python scripts/make_sfx.py --out assets/sfx
    python scripts/make_sfx.py --out assets/sfx --only whoosh,paper

产出（48kHz 单声道 wav，与 app.js 预览台音效同名同语义）：
    whoosh  挥动/飞出      paper   纸张/翻面     ching   金钱/到账
    thud    重物落地       stamp   盖章          crack   碎裂/撕毁
    pop     气泡/出现      scratch 书写/划动

全部由 lavfi 信号源合成，不含任何第三方素材。想要更高质量的音效，
用有使用权限的同名 wav 覆盖即可（mix_sfx.py 按文件名取用）。
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 每个音效 = lavfi 输入列表 + filter_complex（末端不标号，自动作为输出）
SFX = {
    "whoosh": {
        "inputs": ["anoisesrc=color=pink:sample_rate=48000:duration=0.4:seed=7"],
        "filter": "[0:a]bandpass=f=1000:width_type=h:w=1500,"
                  "volume='sin(PI*t/0.4)':eval=frame,volume=1.8,alimiter=limit=0.9",
    },
    "paper": {
        "inputs": ["anoisesrc=color=white:sample_rate=48000:duration=0.2:seed=11"],
        "filter": "[0:a]highpass=f=1400,"
                  "volume='exp(-pow((t-0.02)/0.02,2))+0.8*exp(-pow((t-0.11)/0.02,2))':eval=frame,"
                  "volume=2.2,alimiter=limit=0.9",
    },
    "ching": {
        "inputs": ["aevalsrc='(sin(2*PI*1568*t)+0.6*sin(2*PI*2093*t)+0.35*sin(2*PI*3136*t))"
                   "*exp(-7*t)/1.95':d=0.45:s=48000"],
        "filter": "[0:a]volume=1.6,alimiter=limit=0.9",
    },
    "thud": {
        "inputs": [
            "aevalsrc='sin(2*PI*(110*t-140*t*t))*exp(-13*t)':d=0.25:s=48000",
            "anoisesrc=color=brown:sample_rate=48000:duration=0.12:seed=3",
        ],
        "filter": "[1:a]lowpass=f=320,volume='exp(-30*t)':eval=frame,volume=1.5[n];"
                  "[0:a][n]amix=inputs=2:normalize=0,volume=1.6,alimiter=limit=0.95",
    },
    "stamp": {
        "inputs": [
            "aevalsrc='sin(2*PI*(140*t-180*t*t))*exp(-16*t)':d=0.2:s=48000",
            "anoisesrc=color=white:sample_rate=48000:duration=0.08:seed=5",
        ],
        "filter": "[1:a]highpass=f=2000,volume='exp(-40*t)':eval=frame,volume=1.8[n];"
                  "[0:a][n]amix=inputs=2:normalize=0,volume=1.6,alimiter=limit=0.95",
    },
    "crack": {
        "inputs": [
            "anoisesrc=color=white:sample_rate=48000:duration=0.25:seed=9",
            "aevalsrc='(2*mod(240*t-380*t*t,1)-1)*0.25*exp(-16*t)':d=0.2:s=48000",
        ],
        "filter": "[0:a]bandpass=f=700:width_type=h:w=900,"
                  "volume='exp(-14*t)':eval=frame,volume=2[n];"
                  "[n][1:a]amix=inputs=2:normalize=0,alimiter=limit=0.95",
    },
    "pop": {
        "inputs": ["aevalsrc='sin(2*PI*(520*t+2600*t*t))*exp(-32*t)':d=0.12:s=48000"],
        "filter": "[0:a]volume=1.8,alimiter=limit=0.9",
    },
    "scratch": {
        "inputs": ["anoisesrc=color=pink:sample_rate=48000:duration=0.6:seed=13"],
        "filter": "[0:a]bandpass=f=2400:width_type=h:w=1200,tremolo=f=13:d=0.7,"
                  "volume='if(lt(t,0.5),0.5,0.5*(0.6-t)/0.1)':eval=frame,"
                  "volume=2,alimiter=limit=0.9",
    },
}


def main():
    ap = argparse.ArgumentParser(description="ffmpeg 合成 8 个法律动画音效")
    ap.add_argument("--out", default="assets/sfx", help="输出目录（默认 assets/sfx）")
    ap.add_argument("--only", default="", help="只生成逗号分隔的部分音效，如 whoosh,paper")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("找不到 ffmpeg，请先安装并加入 PATH")

    names = [n.strip() for n in args.only.split(",") if n.strip()] or list(SFX)
    for n in names:
        if n not in SFX:
            sys.exit(f"未知音效: {n}（可选: {', '.join(SFX)}）")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for n in names:
        spec = SFX[n]
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
        for inp in spec["inputs"]:
            cmd += ["-f", "lavfi", "-i", inp]
        cmd += ["-filter_complex", spec["filter"], "-ac", "1", "-ar", "48000", str(out / f"{n}.wav")]
        subprocess.run(cmd, check=True)
        print(f"OK {out / (n + '.wav')}")
    print(f"完成 {len(names)} 个音效 → {out}")


if __name__ == "__main__":
    main()