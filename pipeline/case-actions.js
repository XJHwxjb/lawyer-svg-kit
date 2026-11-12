/* case-actions.js — 案件自定义动作（可选）
   库里没有的动作才写在这里；优先用 actions.js 的九个动作工厂拼（见 references/action-forge.md）。
   写法与 actions.js 完全一致：def({ id, cat, name, dur, desc, phases, events, cast, build(S){...} })。
   坐标一律写设计空间 1080×800 / GROUND=700，场景字面量过 X()/Yg()/Ys()。
   注册后在 film.config.js 的 shots 里用 id 引用。没有自定义动作时本文件保持空即可。

   示例（取消注释即用）：
   def({
     id: 'case-demo', cat: 'hand', name: '示例交接', dur: 4.0,
     desc: '照抄 doc-handoff 改的示例',
     phases: [[.5, '递出'], [1.01, '接住']],
     events: [{ at: .5, sfx: 'paper' }],
     cast: [{ id: 'man', who: 'man', opt: { noProp: true } }, { id: 'woman', who: 'woman' }],
     build(S) {
       const doc = propDoc(el('g', {}, S.above));
       return {
         update(t, P) {
           const mh = S.man.hand(300, P.scale), wh = S.woman.hand(780, P.scale);
           const u = ease(P, seg(t, .2, .7));
           const pos = qbez(mh, wh, 150 * P.amp, u);
           doc.setAttribute('transform', `translate(${pos[0]},${pos[1]})`);
           S.man.set(300, P.scale); S.woman.set(780, P.scale);
         },
         anchors: () => [S.man.hand(300, 1), S.woman.hand(780, 1)],
         guidePath: () => '',
       };
     },
   });
*/
'use strict';