# 造动作教程（action-forge）

目标：库里没有的剧情动作，优先用工厂拼；工厂覆盖不了才写自定义机制。所有动作必须是 `t` 的纯函数。

## 1. 动作契约

```js
def({
  id, cat,            // cat: hand | money | move | focus | lock
  name, desc, dur,    // dur 秒（预览时钟用）
  cast: [{ id, who, variant?, opt? }],   // 出场角色；id 是 S.chars 的键
  phases: [[tEnd, '阶段名'], ...],        // 阶段 chip，最后一项 tEnd=1.01
  events: [{ at: t01, sfx: 'paper' }],  // 音效事件点（与画面接触/冲击对齐；转场/翻页不配音）
  build(S) {
    // 建道具节点（S.below 桌景 / S.above 道具 / S.fx 火花chip）
    return {
      update(t, P) { /* t∈[0,1]；只写属性，不读 DOM 状态 */ },
      anchors(P) { return [[x,y], ...]; },   // 参考线十字
      guidePath(P) { return 'M...'; },       // 参考线路径
    };
  },
});
```

规则：
- `update` 内**不得**依赖上一帧状态、随机数、Date；同一 t 必须同一画面（scrub/逐帧渲染的前提）。
- 角色一律 `S.chars[id]`；`set(x, s, deg, flip, gray, op)`、`hand(x, s, deg, flip)`。
- **坐标只写设计空间**（1080×800, GROUND=700）：`set/hand`、`chip`、`qbez/qd` 内部自动映射到活画幅（横屏 1920×1080 / 竖屏 1080×1920，见 studio.md §8）。自定义场景字面量（门/桌/闪光等位置）必须过 `X(x)`/`Yg(y)`，尺寸乘 `O.os`；天空 UI 用 `Ys(y)` 与 `O.ts`。`anchors/guidePath` 返回映射后的画布坐标。
- 朝向：给出方 `faceFlip(A.C, 1)`、接物方 `faceFlip(B.C, -1)`；`faceFlip = (C,want) => want / C.face`。
- 飞行道具给出方 cast 加 `opt:{noProp:true}`；`P` 提供 scale/amp/ease，幅度乘 `P.amp`、缓动用 `ease(P,u)`。
- 时间切片用 `seg(t,a,b)`；插值 `lerp`；弧线 `qbez(a,b,lift,u)`；余震 `shake(t,at,dur,amp)`。

## 2. 九个工厂（先查这里）

| 工厂 | 表达 | 关键选项 |
|---|---|---|
| actHandoff | 道具弧线递接+接住翻面 | from,to,fromX,toX,prop(doc/indict/cert/book/folder/chart/ledger/record/bankbook),title,propScale |
| actMoney | 钞票流+count-up | from,to?,fromX,toX?,amount,label,mode:'pile'\|'chip',pileX,sneak(背后低弧),extra(S,t,P) |
| actStamp | 举→砸→冲击波→认定印→chip | caster,casterX,watch?,watchX?,prop:'stamp'\|'gavel'\|'seal',docTitle,imprintText,chipText,chipColor |
| actFocus | 文书/法典/账本展开逐行点亮，或纯chip火花 | caster,casterX,watch?,kind:'doc'\|'book'\|'ledger'\|'chip',title,lines[],chipText |
| actMovePair | 双人同步滑入/滑出 | a,b,a0,a1,b0,b1,faceA,faceB,leanA,leanB,grayB(乙灰化) |
| actLock | 走近→手铐落腕→咔嗒→灰化低头 | a,b,a0,a1,b0,chipText |
| actJoint | 双方倾身相会 | mode:'shake'\|'seal',a,b,a0,a1,b0,b1,mid?(居中第三人),chipText |
| actGray | 限制牌落下→全身灰化 | who,chipText |
| actCustody | 小孩居中→走向归属 | toX,chipText（cast 需 man/woman/child） |

拼动作示例（30 秒出一个新动作）：

```js
actHandoff({
  id: 'detain-handoff', name: '出示拘留证', from: 'police', to: 'rogue',
  fromX: 320, toX: 760, prop: 'doc', title: '拘留证',
  desc: '拘留证从警察手飞向老赖，接住翻面',
  cast: [{ id: 'police', who: 'police', opt: { noProp: true } }, { id: 'rogue', who: 'rogue' }],
});
```

`extra(S,t,P)` 钩子用于加旁观者/依偎者（见 alimony-flow 的小孩、embezzle-expose 的老板）。

## 3. 自定义机制骨架（工厂不够用时）

例：查封贴封条——封条从法警手飞向门板、拍平、盖章印显现。

```js
def({
  id: 'seal-up', cat: 'focus', name: '查封贴封条', dur: 4.8,
  desc: '封条飞向门板拍平，查封印显现',
  phases: [[.3, '持封条'], [.6, '贴上门板'], [.85, '拍平压实'], [1.01, '查封完成']],
  events: [{ at: .6, sfx: 'stamp' }],
  cast: [{ id: 'bailiff', who: 'police', variant: 'bailiff', opt: { noProp: true } },
         { id: 'rogue', who: 'rogue' }],
  build(S) {
    const door = el('g', { transform: `translate(${X(700)},${Yg(470)}) scale(${O.os})` }, S.below);
    el('rect', { x: -70, y: -160, width: 140, height: 320, rx: 8, fill: '#8a5a33' }, door);
    const strip = el('g', { opacity: 0 }, S.above);
    el('rect', { x: -16, y: -110, width: 32, height: 220, rx: 4, fill: PAL.paper, stroke: PAL.seal, 'stroke-width': 2 }, strip);
    const imprint = propImprint(el('g', { opacity: 0, transform: `translate(${X(700)},${Yg(470)}) scale(${.8 * O.os})` }, S.above), '查封');
    const A = S.chars.bailiff, B = S.chars.rogue;
    const fA = faceFlip(A.C, 1);
    return {
      update(t, P) {
        const s = P.scale, ah = A.hand(320, s, 0, fA);
        const u = ease(P, seg(t, .3, .6));
        const pos = qbez(ah, [X(700), Yg(470)], 120 * P.amp, u);
        strip.setAttribute('opacity', seg(t, .05, .2));
        strip.setAttribute('transform', `translate(${pos[0]},${pos[1]}) rotate(${lerp(-14, 0, u)}) scale(${lerp(.7, 1, u) * O.os})`);
        imprint.setAttribute('opacity', seg(t, .62, .78));
        const press = shake(t, .6, .2, 3 * P.amp);
        door.setAttribute('transform', `translate(${X(700) + press * O.os},${Yg(470)}) scale(${O.os})`);
        A.set(320, s, 3 * Math.sin(seg(t, .2, .5) * Math.PI), fA);
        B.set(880, s, 6 * seg(t, .6, .9), -1, .7 * seg(t, .6, .9), 1);
      },
      anchors: () => [[X(700), Yg(470)]],
      guidePath: P => qd(S.chars.bailiff.hand(320, P.scale, 0, fA), [X(700), Yg(470)], 120 * P.amp),
    };
  },
});
```

要点：冲击帧 = events 的 at = shake 的 at = imprint 显现起点，三者对齐才有"砸实"的感觉。门板组内局部坐标（rect 的 ±70/±160）不映射——整组已 `scale(O.os)`，位置与尺寸同因子缩放才贴地。

## 4. 音效事件表

`paper`(纸张/落桌接触) `ching`(金属/钱) `thud`(落地/闷击) `stamp`(盖章脆响) `crack`(裂开) `pop`(chip 弹出) `scratch`(书写)。**7 音，无 whoosh**——转场/翻页/挥动飞出静音（v0.8 删除 whoosh）；只有接触/冲击点配音。预览台按 events 自动合成；成片混音按同一 at 贴真实 SFX。

## 5. 验收清单（每个新动作必跑）

1. `node --check actions.js`。
2. 预览台 sweep：`for orient of ['land','port'] { __kit.setOrientation(orient); for f of [0,.12,.3,.5,.7,.9,1] __kit.seek(f) }` 无异常、控制台零报错、SVG 属性无 NaN。
3. 目视三帧 × 双画幅：起飞前 / 冲击帧 / 定格帧（截图存 qa/）；竖屏检查剧情不侵入上方标题安全区。
4. 镜像检查：接物方 flip 后道具不反字、手锚点对齐。
5. 幅度/缓动压力：`P.amp=1.6` + `ease='spring'` 不穿帮。
6. 回写 roster.md 动作表。

以上为**库验收**（新动作入库须双画幅都成立）；案件交付的验收与导出只跑用户选中的画幅（SKILL.md Step 4/5）。