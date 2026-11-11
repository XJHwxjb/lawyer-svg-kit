import React from 'react';

/** frame 为本镜头局部帧，fps 与视频合成帧率相同；任意跳帧结果一致。 */
export type MotionProps = {frame: number; fps?: number; size?: number; color?: string};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
const range = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

/** 天平：横梁和两侧秤盘作为整体绕支点小幅摆动，逐渐回到平衡。 */
export const AnimatedScales: React.FC<MotionProps> = ({frame, fps = 30, size = 240, color = '#8ec6dd'}) => {
  const t = Math.max(0, frame / fps);
  const angle = 8 * Math.cos(t * 5) * (1 - range(t, 0.2, 2.8));
  return <svg width={size} height={size} viewBox="0 0 128 128" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="正义天平">
    <g><path d="M64 18v82M49 109h30M41 115h46M53 100h22"/><circle cx="64" cy="15" r="4"/><path d="M57 100v-5h14v5"/></g>
    <g transform={`rotate(${angle} 64 29)`}>
      <path d="M25 37c13 0 26-8 39-8s26 8 39 8"/><circle cx="64" cy="29" r="4"/>
      <path d="M25 37 12 72h26L25 37Zm78 0L90 72h26l-13-35Z"/>
      <path d="M12 72c2 8 7 12 13 12s11-4 13-12M90 72c2 8 7 12 13 12s11-4 13-12"/>
    </g>
  </svg>;
};

/** 法槌：落在底座上沿后轻微回弹；单次动作而非无限循环。 */
export const AnimatedGavel: React.FC<MotionProps> = ({frame, fps = 30, size = 240, color = '#8ec6dd'}) => {
  const t = Math.max(0, frame / fps);
  const angle = t < 0.35 ? -32 : t < 0.65 ? -32 * (1 - range(t, 0.35, 0.65)) :
    t < 0.8 ? -8 * range(t, 0.65, 0.8) : t < 1.05 ? -8 * (1 - range(t, 0.8, 1.05)) : 0;
  return <svg width={size} height={size} viewBox="0 0 128 128" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="法槌与底座">
    <path d="M60 99h51v10H60zM54 115h63"/>
    <g transform={`rotate(${angle} 40 55)`}>
      <path d="M40 55 79 84M36 58 75 87"/>
      <rect x="72" y="80" width="27" height="16" rx="3"/>
      <path d="M77 80v16M94 80v16"/>
    </g>
  </svg>;
};

/** 清单：每一行单独描绘，间隔可根据实际口播调整。 */
export const AnimatedChecklist: React.FC<MotionProps & {rowStartSeconds?: number[]}> = ({frame, fps = 30, size = 240, color = '#8ec6dd', rowStartSeconds = [0.3, 0.9, 1.5]}) => {
  const t = Math.max(0, frame / fps);
  return <svg width={size} height={size} viewBox="0 0 128 128" fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="逐项核对清单">
    <rect x="25" y="20" width="78" height="91" rx="7"/><path d="M43 17h42v13H43z"/>
    {[50, 72, 94].map((y, i) => {
      const p = range(t, rowStartSeconds[i] ?? (0.3 + i * 0.6), (rowStartSeconds[i] ?? (0.3 + i * 0.6)) + 0.4);
      return <g key={y} opacity={p}><path d={`M39 ${y}l5 5 9-11`} pathLength={1} strokeDasharray={1} strokeDashoffset={1-p}/><path d={`M62 ${y}h26`} pathLength={1} strokeDasharray={1} strokeDashoffset={1-p}/></g>;
    })}
  </svg>;
};
