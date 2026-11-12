#!/usr/bin/env bash
# compose.sh — 合成成片（pipeline 模板，v0.7）
# 动画帧序列 + 口播原声 + ASS 字幕 + 声音三层（真实BGM+真实音效）+ 真人小圆（可选）
# 用法：改下方「案件配置」→ bash compose.sh
# 依赖：ffmpeg / ffprobe（PATH 中）；声音混音另需 python3 + scripts/mix_sound.py
#
# 命名规则（必须遵守）：out/<案件名>_<画幅>.mp4，画幅标签 = 横屏16x9 / 竖屏9x16
# 隐私：本脚本只读本目录素材，不上传任何内容。
set -euo pipefail
cd "$(dirname "$0")"

# ── 案件配置（每案必改）──────────────────────────────────────────────
NAME="示例案件"            # ← 与 film.config.js 的 FILM.name 一致
ORIENT_LABEL="横屏16x9"    # ← 横屏16x9 | 竖屏9x16，与 FILM.orient 对应
FPS=30                     # ← 与 FILM.fps 一致
VOICE="voice.wav"          # ← 口播音频（也可填口播视频路径，自动取其音轨）
PERSON=""                  # ← 真人视频路径；留空 = 纯动画成片
CAPTIONS="captions.ass"    # ← ASS 字幕路径；留空 = 无字幕（文件名用 ASCII，避免转义问题）
DUR=""                     # ← 成片总秒数；留空 = 自动取 VOICE 时长（推荐）
BGM="auto"                 # ← auto=真实曲目（Mixkit 运行时下载，需网络）| synth=程序化合成（离线兜底，须声明）| 填路径=自有授权音乐 | off=无BGM（须声明）
BGM_MOOD="serious"         # ← 无 sound.json 时的兜底基调：serious|steady|upbeat
BGM_BPM=0                  # ← 0=按 mood 默认(76/96/124)
BGM_SECTIONS=""            # ← 无 sound.json 时的兜底分段：JSON 字符串或文件路径
# ────────────────────────────────────────────────────────────────────

OUT="out/${NAME}_${ORIENT_LABEL}.mp4"
mkdir -p out

if [ ! -d frames ]; then echo "缺 frames/ 目录，先跑 node render.cjs"; exit 1; fi
if [ ! -f "$VOICE" ]; then echo "缺口播音频: $VOICE"; exit 1; fi
if [ -z "$DUR" ]; then
  DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VOICE")
fi
FADEOUT=$(awk "BEGIN{printf \"%.2f\", $DUR-0.6}")

# 声音三层混音（v0.7，references/sound.md）：口播 + 真实BGM(自动ducking) + 真实音效 → mixed.wav
# mix_sound.py 与渲染引擎无关；不做 loudnorm，响度统一在本脚本最后处理。
AUDIO="$VOICE"
BED=""
if [ "$BGM" = "off" ]; then
  echo "BGM=off：成片无 BGM，交付时必须向用户声明（references/sound.md）"
elif [ "$BGM" = "auto" ] || [ "$BGM" = "synth" ]; then
  HAVE_REAL=0
  if [ "$BGM" = "auto" ]; then
    if [ -f sound.json ]; then
      python scripts/fetch_bgm.py --dur "$DUR" --config sound.json --out bgm.wav --cache-dir bgm-src && HAVE_REAL=1 || true
    else
      SECT_ARGS=()
      [ -n "$BGM_SECTIONS" ] && SECT_ARGS=(--sections "$BGM_SECTIONS")
      python scripts/fetch_bgm.py --dur "$DUR" --mood "$BGM_MOOD" "${SECT_ARGS[@]}" --out bgm.wav --cache-dir bgm-src && HAVE_REAL=1 || true
    fi
  fi
  if [ "$HAVE_REAL" != 1 ]; then
    echo "WARN BGM 回退 make_bgm 合成曲（网络不可用或 BGM=synth），交付时必须向用户声明"
    if [ -f sound.json ]; then
      python scripts/make_bgm.py --dur "$DUR" --config sound.json --out bgm.wav
    else
      SECT_ARGS=()
      [ -n "$BGM_SECTIONS" ] && SECT_ARGS=(--sections "$BGM_SECTIONS")
      python scripts/make_bgm.py --dur "$DUR" --mood "$BGM_MOOD" --bpm "$BGM_BPM" "${SECT_ARGS[@]}" --out bgm.wav
    fi
  fi
  BED="bgm.wav"
else
  if [ ! -f "$BGM" ]; then echo "缺 BGM 文件: $BGM"; exit 1; fi
  BED="$BGM"
fi
if [ -f scripts/mix_sound.py ]; then
  BED_ARGS=(); [ -n "$BED" ] && BED_ARGS=(--bgm "$BED")
  EV_ARGS=(); [ -f events.json ] && EV_ARGS=(--events events.json)
  python scripts/mix_sound.py --voice "$VOICE" --out mixed.wav "${BED_ARGS[@]}" "${EV_ARGS[@]}" --sfx-dir assets/sfx
  AUDIO="mixed.wav"
  echo "声音三层已混入 mixed.wav"
  [ -f bgm.credits.json ] && echo "BGM 许可记录: bgm.credits.json（交付时随附核对）"
else
  echo "WARN 缺 scripts/mix_sound.py，只用原声（不满足 v0.6 声音门禁）"
fi

# 字幕 + 首尾淡入淡出（字幕在淡入淡出之前叠加，避免字幕被一起淡掉）
VF=""
if [ -n "$CAPTIONS" ]; then
  if [ ! -f "$CAPTIONS" ]; then echo "缺字幕文件: $CAPTIONS"; exit 1; fi
  VF="ass=${CAPTIONS},"
fi
VF="${VF}fade=t=in:st=0:d=0.35,fade=t=out:st=${FADEOUT}:d=0.6"

ENC=(-c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -profile:v high -level 4.2 -g 60
     -c:a aac -b:a 192k -ar 48000 -movflags +faststart -t "$DUR")

# 不可闻抖动噪声（-86dBFS）：部分 ffmpeg 构建的 aac 编码器在"纯数字静音段+衰减尾音"
# 上会掉进 denormal 浮点陷阱（实测慢约百倍、画面被背压卡住）。混入极微白噪声可消除，
# 人耳不可闻。改音频链路时务必保留这一路 amix。
DITHER="-f lavfi -i anoisesrc=color=white:amplitude=0.00005:sample_rate=48000"
LOUD="amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1.5:LRA=11"

if [ -n "$PERSON" ]; then
  # 真人左下角 Ø300 小圆（用户标准机位）：裁方→缩300→圆形 alpha→overlay。
  # -stream_loop -1：真人素材短于成片时循环播放。真人声音忽略，只用口播轨。
  # 注意：竖屏时字幕别压到小圆（字幕底部边距建议 ≥ 360px，见 captions 样式 MarginV）。
  if [ ! -f "$PERSON" ]; then echo "缺真人视频: $PERSON"; exit 1; fi
  ffmpeg -y -hide_banner -loglevel warning \
    -framerate "$FPS" -i frames/%05d.jpg \
    -stream_loop -1 -i "$PERSON" \
    -i "$AUDIO" \
    $DITHER \
    -filter_complex "[1:v]scale=300:300:force_original_aspect_ratio=increase,crop=300:300,format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lte(hypot(X-W/2,Y-H/2),W/2),255,0)'[p];[0:v][p]overlay=40:main_h-340:shortest=0,${VF}[o];[2:a][3:a]${LOUD}[a]" \
    -map "[o]" -map "[a]" \
    "${ENC[@]}" "$OUT"
else
  ffmpeg -y -hide_banner -loglevel warning \
    -framerate "$FPS" -i frames/%05d.jpg \
    -i "$AUDIO" \
    $DITHER \
    -filter_complex "[0:v]${VF}[o];[1:a][2:a]${LOUD}[a]" \
    -map "[o]" -map "[a]" \
    "${ENC[@]}" "$OUT"
fi

echo "OK -> $OUT"
echo "下一步：按 references/delivery-qa.md 实听实看 + freezedetect 冻结门禁 + silencedetect 声音连续性门禁"