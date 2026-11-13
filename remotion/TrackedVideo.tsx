import React from 'react';
import {OffthreadVideo, useCurrentFrame, useVideoConfig} from 'remotion';

export type TrackPoint = {f: number; x: number; y: number; w: number; h: number};
export type FaceTrack = {
  meta: {fps: number; width: number; height: number; aspect: number; frame_count: number};
  track: TrackPoint[];
};

/** 源视频帧号 → 裁切框（线性插值）。轨道以源帧计，与合成 fps 无关。 */
export function cropAt(track: FaceTrack, sourceFrame: number): TrackPoint {
  const t = track.track;
  if (!t.length) throw new Error('face track 为空');
  if (sourceFrame <= t[0].f) return t[0];
  const last = t[t.length - 1];
  if (sourceFrame >= last.f) return last;
  let i = 1;
  while (t[i].f < sourceFrame) i++;
  const a = t[i - 1], b = t[i];
  const p = (sourceFrame - a.f) / (b.f - a.f);
  const mix = (u: number, v: number) => u + (v - u) * p;
  return {f: sourceFrame, x: mix(a.x, b.x), y: mix(a.y, b.y), w: mix(a.w, b.w), h: mix(a.h, b.h)};
}

/** 人脸追踪人物窗：窗宽高比必须与 track.meta.aspect 一致（圆裁传 borderRadius: '50%'）。 */
export const TrackedVideo: React.FC<{
  src: string;
  track: FaceTrack;
  width: number;
  height: number;
  startFrom?: number;
  muted?: boolean;
  borderRadius?: number | string;
  style?: React.CSSProperties;
}> = ({src, track, width, height, startFrom = 0, muted = true, borderRadius = 0, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (Math.abs(width / height - track.meta.aspect) > 0.01) {
    throw new Error(`窗宽高比 ${(width / height).toFixed(3)} 与轨道 aspect ${track.meta.aspect} 不一致`);
  }
  const sourceFrame = (startFrom + frame / fps) * track.meta.fps;
  const c = cropAt(track, sourceFrame);
  const k = width / c.w;
  return (
    <div style={{width, height, overflow: 'hidden', position: 'relative', borderRadius, ...style}}>
      <OffthreadVideo
        src={src}
        muted={muted}
        style={{
          position: 'absolute',
          maxWidth: 'none',
          width: track.meta.width * k,
          height: track.meta.height * k,
          left: width / 2 - (c.x + c.w / 2) * k,
          top: height / 2 - (c.y + c.h / 2) * k,
        }}
      />
    </div>
  );
};