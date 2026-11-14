#!/usr/bin/env bash
# compose.sh — 合成成片（pipeline 模板，v0.9）
# 动画帧序列 + 口播原声 + ASS 字幕 + 口播+真实音效（无 BGM）+ 真人 3:4 小窗（可选）
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
PERSON_W=300               # ← 真人小窗宽度 px（v0.9：3:4 矩形窗，高自动 = 宽×4/3）
PERSON_CY=0.30             # ← 3:4 裁切的纵向锚点：0=贴顶 0.5=居中 1=贴底。
                           #   律师脸通常在源画面上 1/3，取 0.25~0.40 让脸落在窗内上 1/3；
                           #   源已是 3:4 时裁切自动退化为全幅，此值无效。
PERSON_POS="40:main_h-440" # ← 小窗位置（默认左下角，距底/左 40px）。
                           #   竖屏字幕 MarginV ≥ 460，别压到小窗。
CAPTIONS="captions.ass"    # ← ASS 字幕路径；留空 = 无字幕（文件名用 ASCII，避免转义问题）
DUR=""                     # ← 成片总秒数；留空 = 自动取 VOICE 时长（推荐）
# ────────────────────────────────────────────────────────────────────

OUT="out/${NAME}_${ORIENT_LABEL}.mp4"
mkdir -p out
PERSON_H=$(awk "BEGIN{printf \"%d\", $PERSON_W*4/3}")

if [ ! -d frames ]; then echo "缺 frames/ 目录，先跑 node render.cjs"; exit 1; fi
if [ ! -f "$VOICE" ]; then echo "缺口播音频: $VOICE"; exit 1; fi
if [ -z "$DUR" ]; then
  DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VOICE")
fi
FADEOUT=$(awk "BEGIN{printf \"%.2f\", $DUR-0.6}")

# 声音两层混音（v0.8，references/sound.md）：口播 + 真实音效 → mixed.wav（无 BGM）
# 律师要求只加音效、不加背景音乐；转场/翻页静音。mix_sound.py 与渲染引擎无关；
# 不做 loudnorm，响度统一在本脚本最后处理。
AUDIO="$VOICE"
if [ -f scripts/mix_sound.py ]; then
  EV_ARGS=(); [ -f events.json ] && EV_ARGS=(--events events.json)
  python scripts/mix_sound.py --voice "$VOICE" --out mixed.wav "${EV_ARGS[@]}" --sfx-dir assets/sfx
  AUDIO="mixed.wav"
  echo "口播+音效已混入 mixed.wav（无 BGM）"
else
  echo "WARN 缺 scripts/mix_sound.py，只用原声（不满足声音门禁：成片应有动作音效）"
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
  # 真人 3:4 小窗（v0.9，律师要求）：源视频不是 3:4 就先裁成 3:4，再以人物为中心取窗。
  # crop 表达式对任意源画幅成立：宽源裁两侧（水平居中），窄源裁上下（纵向按 PERSON_CY 锚定脸）。
  # 源恰好 3:4 时 w=iw、h=ih，裁切退化为全幅。裁完缩到 PERSON_W×PERSON_H 叠到 PERSON_POS。
  # -stream_loop -1：真人素材短于成片时循环播放。真人声音忽略，只用口播轨。
  if [ ! -f "$PERSON" ]; then echo "缺真人视频: $PERSON"; exit 1; fi
  PCROP="crop=w='if(gt(iw/ih,3/4),ih*3/4,iw)':h='if(gt(iw/ih,3/4),ih,iw*4/3)':x='(iw-ow)/2':y='(ih-oh)*${PERSON_CY}'"
  ffmpeg -y -hide_banner -loglevel warning \
    -framerate "$FPS" -i frames/%05d.jpg \
    -stream_loop -1 -i "$PERSON" \
    -i "$AUDIO" \
    $DITHER \
    -filter_complex "[1:v]${PCROP},scale=${PERSON_W}:${PERSON_H},setsar=1[p];[0:v][p]overlay=${PERSON_POS}:shortest=0,${VF}[o];[2:a][3:a]${LOUD}[a]" \
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
echo "下一步：按 references/delivery-qa.md 实听实看 + freezedetect 冻结门禁 + 音效可闻/峰值门禁"