import React from 'react';

/** 一个纸张实例贯穿桌面、近看、归档三个画面。frame 是本镜头局部帧。 */
export type DocumentTransitionProps = {
  frame: number;
  fps: number;
  /** 仅填经核对的标题；不传时保持无字图形。 */
  title?: string;
  color?: string;
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const p = clamp(v); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

export const DocumentTransition: React.FC<DocumentTransitionProps> = ({frame, fps, title, color = '#8fc7db'}) => {
  const t = Math.max(0, frame) / Math.max(1, fps);
  // 桌面停留 → 推近 → 阅读停留 → 移到档案盒；所有段首尾位置连续。
  const zoom = smooth((t - 0.8) / 1.0);
  const file = smooth((t - 3.2) / 1.3);
  const x = mix(mix(610, 930, zoom), 1405, file);
  const y = mix(mix(665, 478, zoom), 652, file);
  const scale = mix(mix(0.85, 2.0, zoom), 0.62, file);
  const rotation = mix(mix(-9, 0, zoom), 5, file);
  const near = smooth((t - 0.8) / 0.7) * (1 - smooth((t - 3.3) / 0.6));
  const folder = smooth((t - 3.1) / 0.55);
  // 道具落入后由档案盒前沿遮挡，避免突然消失。
  const covered = smooth((t - 4.3) / 0.6);
  return <svg viewBox="0 0 1920 1080" width="100%" height="100%" role="img" aria-label="材料从桌面进入近景，再放入档案盒">
    <rect width="1920" height="1080" fill="#0d2030" />
    <circle cx="1010" cy="470" r="490" fill={color} opacity={0.06 + near * 0.05} />
    <g opacity={1 - near * 0.65}>
      <path d="M240 770H1680" stroke={color} strokeWidth="3" opacity=".42" />
      <path d="M335 784H1580L1650 820H265Z" fill="#25465a" opacity=".8" />
    </g>
    {/* 后片始终画在纸张后面；前沿画在纸张前面。 */}
    <g opacity={folder}>
      <path d="M1260 615h112l30 30h188v160h-330z" fill="#9c7445" stroke="#d4b77c" strokeWidth="5" strokeLinejoin="round" />
    </g>
    <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
      <rect x="-115" y="-154" width="230" height="308" rx="9" fill="#f4ead5" stroke="#d3bea1" strokeWidth="4" />
      <path d="M-80-104h110M-80-62h160M-80-24h160M-80 14h127" stroke="#607787" strokeWidth="7" strokeLinecap="round" opacity=".7" />
      <path d="M-80 62h80M-80 93h120" stroke="#b49469" strokeWidth="5" strokeLinecap="round" opacity=".75" />
      {title ? <text x="0" y="-120" textAnchor="middle" fill="#263b47" fontSize="16" fontFamily="sans-serif">{title}</text> : null}
    </g>
    <g opacity={folder}>
      <path d="M1250 716h350l-20 100h-310z" fill="#d2ad6f" stroke="#e2c58f" strokeWidth="5" strokeLinejoin="round" />
      <rect x="1355" y="750" width="140" height="28" rx="4" fill="#f2e6c7" opacity=".8" />
      <path d={`M1245 ${mix(820, 685, covered)}h360v135h-360z`} fill="#d2ad6f" opacity={covered} />
    </g>
  </svg>;
};
