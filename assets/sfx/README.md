# assets/sfx — 真实录音音效库（v0.8 默认）

律师动画成片的声音两层之一（口播 + 音效，无 BGM）。默认 7 音是真实录音（CC0 为主），
不再是合成占位音。来源与许可见 [LICENSES.md](LICENSES.md)，逐条台账见 `manifest.json`。

## 结构

```
assets/sfx/
├── paper.wav / ching.wav / thud.ogg / stamp.wav /
│   crack.ogg / pop.ogg / scratch.wav               ← 默认 7 音（语义名）
├── lib/            ← 100 条备选真实录音，按类别分目录
│   ├── kit/ impact/ transition/ ding/ click/
│   │   pop/ riser/ ui-blip/ glitch/ typing/ tick/ ambience/ …
│   └── ave/        ← agent-video-editor 的 5 条（paper/scratch/ching/stamp 备选）
├── manifest.json   ← 逐条：file/category/license/source_url/attribution/origin
└── LICENSES.md
```

## 取用规则（mix_sound.py）

- `--sfx-dir assets/sfx`（compose.sh 默认）；events.json 的 `sfx` 字段 = **根目录**
  文件名去扩展名，按 `.wav → .ogg → .mp3 → .flac` 顺序解析，ffmpeg 自动解码。
- 根目录找不到名字 → 计入 `sfx_missing` 并跳过（不中断混音），交付前必须清零。

## 换音 / 加音

1. **从 lib 选**：试听 `lib/<类别>/` 里的录音，把选中的复制到根目录并按事件命名，
   如 `cp lib/ding/<file>.ogg assets/sfx/ding.ogg`，events 写 `"sfx": "ding"`。
   复制后在案件工程里保留来源记录（manifest.json 已含该条）。
2. **自有授权音频覆盖**：同名放根目录即可（wav/ogg/mp3/flac），优先于内置音。
3. **离线兜底**：`python scripts/make_sfx.py --out assets/sfx-synth` 生成合成音，
   混音改 `--sfx-dir assets/sfx-synth`，交付时须向用户声明是合成音。

## 注意

- 预览台 app.js 的音效是 WebAudio 即时合成的近似音，**只听个响**；
  真实质感以 mix_sound.py 混出的成片为准。
- 口播 > 音效 的优先级与响度契约见 `references/sound.md`（v0.8 无 BGM；转场/翻页静音）。