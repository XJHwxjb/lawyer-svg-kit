import React from 'react';

// 镜头状态始终使用画布像素；scale > 1 表示推进。动画按局部帧求值。
export type CameraState = {x: number; y: number; scale: number};
export type CameraKey = CameraState & {frame: number};
const mix = (a: number, b: number, p: number) => a + (b-a)*p;
const smooth = (p: number) => {const v = Math.max(0, Math.min(1, p)); return v*v*(3-2*v);};

/** keys 必须按帧递增且至少有一项；开始和结束之后保持边界状态。 */
export function cameraAt(frame: number, keys: readonly CameraKey[]): CameraState {
 if (!keys.length) throw new Error('cameraAt 至少需要一个关键帧');
 if (keys.some((k, i) => !Number.isFinite(k.frame) || !Number.isFinite(k.x) || !Number.isFinite(k.y) || !Number.isFinite(k.scale) || k.scale <= 0 || (i > 0 && k.frame <= keys[i-1].frame))) throw new Error('镜头关键帧必须有限、帧号递增且 scale > 0');
 const next = keys.findIndex(k => k.frame > frame);
 if (next === 0) return keys[0];
 if (next < 0) return keys[keys.length-1];
 const a=keys[next-1], b=keys[next], p=smooth((frame-a.frame)/(b.frame-a.frame));
 return {x:mix(a.x,b.x,p), y:mix(a.y,b.y,p), scale:mix(a.scale,b.scale,p)};
}

/** 每层单独传 depth，统一镜头状态；字幕/头像放在此层外。 */
export const CameraLayer: React.FC<{camera: CameraState; depth?: number; width?: number; height?: number; children: React.ReactNode}> =
 ({camera, depth=1, width=1920, height=1080, children}) => {
  const d=Math.max(0,Math.min(1,depth));
  const scale=mix(1,camera.scale,d);
  const x=mix(width/2,camera.x,d), y=mix(height/2,camera.y,d);
  return <div style={{position:'absolute',left:0,top:0,width,height,transformOrigin:'0 0',
   transform:`translate(${width/2-x*scale}px, ${height/2-y*scale}px) scale(${scale})`}}>{children}</div>;
 };
