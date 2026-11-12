/* film.config.js — 案件整片配置（模板示例，照抄后逐字段改成你的案件）
   本文件同时被浏览器(film.html)和 Node(render.cjs) 读取，末尾的 module.exports 不要删。

   ── 填写步骤 ──────────────────────────────────────────────────────
   1. 先完成 STORYBOARD.md（逐句分镜，见 references/workflow.md 第三节）。
   2. 每个分镜行 → shots 数组的一项：动作 id 查 references/roster.md。
   3. 所有 dur 之和应等于口播总时长（timing.json / ffprobe 核对），
      否则成片结尾会缺画面或画面等声音。
   4. 法条/金额/日期只用稿件值；库内动作的演示默认值仅供预览。
   5. 每个镜头必须有 camera（不许全片 'off'）和 bg（不许全片 'paper'），
      这是 v0.5 的动感最低要求，验收会查。 */
'use strict';

const FILM = {
  name: '示例案件',          // 成片文件名前缀：out/<name>_<画幅>.mp4
  orient: 'land',            // 项目级单选：'land' 横屏16:9 | 'port' 竖屏9:16（律师选定，没写先问）
  fps: 30,                   // 与 compose.sh 的 FPS 保持一致
  theme: 'cream',            // cream 纸纹暖 | mist 雾青冷 | dusk 暮色深（全片统一）
  outline: 6,                // 贴纸描边 px（全片统一）
  shadow: 10,                // 投影强度（全片统一）
  transition: 12,            // 交叉淡化帧数（12帧=0.4s@30fps）。0=硬切（不推荐）。
                             // 不要超过最短镜头帧数的一半。
  voiceDuration: 0,          // 口播总秒数（ffprobe 测得）；render.cjs 用它核对总帧数，0=跳过核对

  shots: [
    /* 每项字段说明：
       act      必填。库动作 id（actions.js / roster.md）或 case-actions.js 注册的动作 id，
                也可以直接传含 build(S) 的动作对象。
       dur      必填。本镜头秒数 = 对应口播句组的时长。
       bg       场景底：paper 白纸 | home 家中 | court 法庭 | register 登记处 |
                office 办公室 | warehouse 仓库。按剧情地点选，别全片 paper。
       camera   镜头：off 固定 | push 全程推进 | hold 推近停留(数字/文书首选) |
                impact 冲击(对齐敲槌/盖章事件) | pan 横移 | breathe 呼吸兜底。
       focus    可选。镜头焦点，设计空间坐标 [x,y]（1080×800, GROUND=700）。
                不填 = 自动取动作第一个锚点。数字 chip 镜头建议显式指向 chip 位置。
       params   可选。覆盖 {ease, amp, scale}；scale 是人物缩放不是镜头缩放。
       cast     可选。自定义阵容 [{id, who, variant, opt}]；不填用动作自带 cast。
                飞行道具给出方记得 opt:{noProp:true}。
       sfx      可选。null/不填 = 用动作内置 events；[] = 本镜头静音；
                也可自定义 [{at:0~1, sfx:'whoosh|paper|ching|thud|stamp|crack|pop|scratch'}]。 */
    { act: 'doc-handoff', dur: 4.6, bg: 'court', camera: 'push' },
    // money-flow 计数在 t=.8 结束：停留 = dur×(1-.8) ≥ 1.2s → dur 必须 ≥ 6s。
    // focus 指向计数器（设计空间 540,250）；金额是库内演示值，成片须改稿件值。
    { act: 'money-flow', dur: 6.0, bg: 'office', camera: 'hold', focus: [540, 250] },
    { act: 'gavel-drop', dur: 4.0, bg: 'court', camera: 'impact', focus: [540, 500] },
  ],
};

if (typeof module !== 'undefined' && module.exports) module.exports = FILM;