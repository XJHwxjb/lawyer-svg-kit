#!/usr/bin/env python3
"""手持源稳像 → 方形真人小圆素材。本地运行，不上传任何素材。

face_track.py 的裁切只平移窗口：16:9 特写源会被 clamp 成全高方裁，垂直晃动/头部倾斜/
远近 zoom 原样透传，手持素材放进小圆仍然抖。本脚本改用逐帧相似变换（平移+缩放+旋转）
把人脸锁到窗口固定位置/大小/水平线，只留下 clamp 边界处的少量残差。

用法：python scripts/stabilize_person.py 口播.mp4 -o person-stable.mp4
输出方形 mp4（默认 1080×1080、源帧率），可直接接 compose.sh 的 PERSON 或 TrackedVideo 之外的
普通 OffthreadVideo/overlay 圆裁链路（无需 track JSON）。
"""
import argparse
import json
import math
import os
import sys

import cv2
import numpy as np

from face_track import resolve_model


def make_detector(args):
    """返回 (name, detect(frame) -> (cx,cy,h,roll) 像素/度 或 None)。"""
    if args.detector in ("auto", "mediapipe"):
        try:
            import mediapipe as mp
            fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=args.score)

            def detect(frame):
                res = fd.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                if not res.detections:
                    return None
                d = max(res.detections, key=lambda z: z.score[0])
                b = d.location_data.relative_bounding_box
                H, W = frame.shape[:2]
                kp = d.location_data.relative_keypoints
                re, le = kp[0], kp[1]
                roll = math.degrees(math.atan2((le.y - re.y) * H, (le.x - re.x) * W))
                return ((b.xmin + b.width / 2) * W, (b.ymin + b.height / 2) * H, b.height * H, roll)
            return "mediapipe", detect
        except ImportError:
            if args.detector == "mediapipe":
                sys.exit("mediapipe 未安装（pip install mediapipe，需 Python<=3.12）")
    if args.detector in ("auto", "yunet"):
        model = resolve_model(args)
        det = cv2.FaceDetectorYN.create(model, "", (320, 320), args.score, 0.3, 5000)

        def detect(frame):
            det.setInputSize((frame.shape[1], frame.shape[0]))
            _, faces = det.detect(frame)
            if faces is None or len(faces) == 0:
                return None
            b = max(faces, key=lambda f: f[2] * f[3])
            x, y, w, h = b[:4]
            lm = b[4:14].reshape(5, 2)
            re, le = lm[0], lm[1]
            roll = math.degrees(math.atan2(le[1] - re[1], le[0] - re[0]))
            return (float(x + w / 2), float(y + h / 2), float(h), float(roll))
        return "yunet", detect
    sys.exit("稳像需要关键点估 roll：请用 yunet（默认）或 mediapipe，Haar 不支持")


def fill_gaps(raw, n):
    keys = sorted(raw)
    out = [None] * n
    for i in range(n):
        if i in raw:
            out[i] = raw[i]
            continue
        lo = max((k for k in keys if k < i), default=None)
        hi = min((k for k in keys if k > i), default=None)
        if lo is None and hi is None:
            continue
        if lo is None:
            out[i] = raw[hi]
        elif hi is None:
            out[i] = raw[lo]
        else:
            p = (i - lo) / (hi - lo)
            out[i] = tuple(a + (b - a) * p for a, b in zip(raw[lo], raw[hi]))
    return out


def center_smooth(series, half):
    out = []
    for i in range(len(series)):
        lo, hi = max(0, i - half), min(len(series), i + half + 1)
        win = [v for v in series[lo:hi] if v]
        out.append(tuple(sum(c) / len(win) for c in zip(*win)) if win else None)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("video")
    ap.add_argument("-o", "--out", required=True, help="输出方形 mp4")
    ap.add_argument("--size", type=int, default=1080, help="输出方窗边长")
    ap.add_argument("--face-frac", type=float, default=0.80, help="脸高占方窗比例；越大越稳但越贴脸（源垂直摆幅大时靠放大制造余量）")
    ap.add_argument("--center-y", type=float, default=0.50, help="脸中心落在方窗高度的比例")
    ap.add_argument("--smooth", type=float, default=0.10, help="检测序列中心平滑秒数（前后各取）；压检测噪声与 clamp 极端值，手持源 0.05~0.15")
    ap.add_argument("--stride", type=int, default=1)
    ap.add_argument("--score", type=float, default=0.5)
    ap.add_argument("--detector", choices=["auto", "mediapipe", "yunet"], default="auto")
    ap.add_argument("--model")
    ap.add_argument("--proxy")
    ap.add_argument("--preview", help="写 3 条 consecutive-frame 检查条到该目录")
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        sys.exit("打不开视频: " + args.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    name, detect = make_detector(args)

    raw, fno = {}, 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if fno % args.stride == 0:
            d = detect(frame)
            if d:
                raw[fno // args.stride] = d
        fno += 1
    cap.release()
    if not raw:
        sys.exit("全片未检测到人脸，检查素材或降低 --score")
    n = (fno + args.stride - 1) // args.stride
    half = max(0, round(args.smooth * fps / args.stride / 2))
    series = center_smooth(fill_gaps(raw, n), half)

    S = args.size
    T = np.array([S / 2, args.center_y * S])
    target_h = args.face_frac * S
    vw = cv2.VideoWriter(args.out, cv2.VideoWriter_fourcc(*"mp4v"), fps / args.stride, (S, S))
    if not vw.isOpened():
        sys.exit("写不了输出: " + args.out)

    total = fno
    resid, fno = [], 0
    want = set()
    if args.preview:
        for q in (0.1, 0.5, 0.85):
            base = int(q * (total - 1))
            want.update(range(base, base + 6))
    previews = {}
    cap = cv2.VideoCapture(args.video)
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        i = fno // args.stride
        if fno % args.stride == 0 and i < len(series) and series[i]:
            cx, cy, h, roll = series[i]
            s = target_h / max(h, 1.0)
            th = math.radians(-roll)
            c, sn = math.cos(th), math.sin(th)
            # 旋转后方窗在源里的 footprint 半宽/半高；s 不够大就抬高 s 防露边
            need = (abs(c) + abs(sn)) * S / min(W, H)
            s = max(s, need)
            A = s * np.array([[c, -sn], [sn, c]])
            hw = hh = (abs(c) + abs(sn)) * S / 2 / s
            C = np.array([min(max(cx, hw), W - hw), min(max(cy, hh), H - hh)])
            t = T - A @ C
            M = np.array([[A[0, 0], A[0, 1], t[0]], [A[1, 0], A[1, 1], t[1]]])
            out = cv2.warpAffine(frame, M, (S, S), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            r = A @ (np.array([cx, cy]) - C)
            resid.append((float(r[0]), float(r[1])))
            vw.write(out)
            if args.preview and fno in want:
                previews[fno] = out
        fno += 1
    cap.release()
    vw.release()

    if args.preview:
        os.makedirs(args.preview, exist_ok=True)
        for q in (0.1, 0.5, 0.85):
            base = int(q * (total - 1))
            strip = [previews[z] for z in range(base, base + 6) if z in previews]
            if strip:
                sheet = np.hstack([cv2.resize(z, (300, 300)) for z in strip])
                ok2, buf = cv2.imencode(".jpg", sheet)
                if ok2:
                    with open(os.path.join(args.preview, f"stable-{int(q * 100):02d}.jpg"), "wb") as f:
                        f.write(buf.tobytes())

    r = np.array(resid) if resid else np.zeros((1, 2))
    stats = {
        "detector": name, "detected_ratio": round(len(raw) / n, 3), "frames": fno,
        "out": args.out, "size": S, "fps": fps / args.stride,
        "residual_px": {"std": [round(float(v), 2) for v in r.std(axis=0)],
                        "p95": [round(float(v), 2) for v in np.percentile(abs(r), 95, axis=0)],
                        "max": [round(float(v), 2) for v in abs(r).max(axis=0)]},
        "residual_in_300_circle_px": {"std": [round(float(v) * 300 / S, 2) for v in r.std(axis=0)],
                                      "max": [round(float(v) * 300 / S, 2) for v in abs(r).max(axis=0)]},
    }
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()