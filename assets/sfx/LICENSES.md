# assets/sfx 许可与来源（v0.7 真实录音库）

114 条真实录音 = 112 条 CC0 1.0 + 2 条 MIT 合成音。逐条登记见 `manifest.json`
（file / category / license / source_url / attribution / origin），本文件是汇总说明。
全部音频可商用、可修改、可随成片分发；两条例外见下方 MIT 声明。

## 来源仓库

1. **Barty-Bart/motion-graphics**（仓库代码 MIT，Copyright (c) 2026 Bart）
   `skills/sound-effects/sfx/` 内置 109 条 CC0 1.0 录音（Freesound 作者 qubodup、
   ethernel0 等 + Kenney 音效包）。本库只取音频文件，音频本身按 CC0 1.0 授权，
   与仓库代码许可无关。对应 `lib/` 下除 `ave/` 外的全部目录，origin 字段已登记。
2. **kmilo93sd/agent-video-editor**（MIT，Copyright (c) 2026 kmilo93sd）
   `skills/editing-videos/library/sfx/` 取 5 条（`lib/ave/`）：
   - page-turn.wav — Kenney rpg-audio bookFlip1，CC0 1.0
   - paper-handle-1.wav — Luckius（OGA various-paper-sound-effects），CC0 1.0
   - pencil-write.wav — AntumDeluge / NachtmahrTV（freesound 571800，OGA pencil-sounds），CC0 1.0
   - cash-register-cha-ching.wav — 仓库自合成（Kenney handleCoins + 合成铃声），MIT
   - stamp-thud.wav — 仓库自合成（Kenney bookPlace1 + impactSoft），MIT

## 默认 8 音套件（根目录，mix_sound.py 按语义名取用）

| 语义名 | 文件 | 来源 | 许可 |
|---|---|---|---|
| whoosh | whoosh.ogg | qubodup · Freesound 60013 | CC0 1.0 |
| paper | paper.wav | Luckius · OGA various-paper-sound-effects（paper-handle-1） | CC0 1.0 |
| ching | ching.wav | agent-video-editor 合成（handleCoins+铃声） | MIT |
| thud | thud.ogg | Kenney · impact-sounds impactPunch heavy | CC0 1.0 |
| stamp | stamp.wav | agent-video-editor 合成（bookPlace1+impactSoft） | MIT |
| crack | crack.ogg | qubodup · Freesound 222517 | CC0 1.0 |
| pop | pop.ogg | ethernel0 · Freesound 776016 | CC0 1.0 |
| scratch | scratch.wav | AntumDeluge/NachtmahrTV · freesound 571800 | CC0 1.0 |

## CC0 1.0

公共领域奉献：可商用、可修改、可再分发，**无需署名**（本库仍自愿登记 attribution）。
文本：https://creativecommons.org/publicdomain/zero/1.0/

## MIT 合成音适用声明（ching.wav / stamp.wav 及其 lib/ave/ 原件）

```
MIT License

Copyright (c) 2026 kmilo93sd

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

随成片分发无需附带本文件（MIT 允许 sublicense），但案件工程内保留本文件与
manifest.json 作为来源台账；对外交付如被问及素材来源，按上表回答。

## 不在本库内的素材

- **Mixkit 音效/音乐**：Mixkit Free License 禁止再分发原文件 → 一律运行时下载到
  案件工程（BGM 见 `scripts/fetch_bgm.py` + `assets/bgm/catalog.json`），不进本仓库。
- **make_sfx.py 合成音**：离线兜底，产出到 `assets/sfx-synth`，不覆盖本库。