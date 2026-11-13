#!/usr/bin/env python3
"""离线人脸追踪 → 裁切关键帧 JSON。本地运行，不上传任何素材。

检测器优先级：mediapipe（若已安装）→ YuNet（onnx，自动缓存/下载）→ Haar（仅旧版 OpenCV 自带 xml 时）。
输出轨道以【源视频帧号】计；Remotion 组件 TrackedVideo 内部按 fps 换算，勿在合成帧上直接查表。
"""
import argparse
import json
import math
import os
import sys
import urllib.request

import cv2

MODEL_NAME = "face_detection_yunet_2023mar.onnx"
# opencv_zoo 的 onnx 走 Git LFS：github raw / contents API 只给指针，media 域才给真 blob
MODEL_URL = "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/" + MODEL_NAME
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".cache", "face-track")


class LowPass:
    def __init__(self):
        self.y = None

    def __call__(self, x, alpha):
        self.y = x if self.y is None else alpha * x + (1 - alpha) * self.y
        return self.y


class OneEuro:
    """抖动与滞后权衡的标准滤波器：慢速时重平滑，快速时放开跟随。"""

    def __init__(self, min_cutoff, beta, d_cutoff=1.0):
        self.min_cutoff, self.beta, self.d_cutoff = min_cutoff, beta, d_cutoff
        self.xf, self.df = LowPass(), LowPass()
        self.prev = None

    @staticmethod
    def alpha(cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def __call__(self, x, dt):
        dx = 0.0 if self.prev is None else (x - self.prev) / dt
        self.prev = x
        edx = self.df(dx, self.alpha(self.d_cutoff, dt))
        cutoff = self.min_cutoff + self.beta * abs(edx)
        return self.xf(x, self.alpha(cutoff, dt))


def resolve_model(args):
    if args.model:
        return args.model
    cached = os.path.join(CACHE_DIR, MODEL_NAME)
    if os.path.exists(cached) and os.path.getsize(cached) > 100000:
        return cached
    os.makedirs(CACHE_DIR, exist_ok=True)
    print("downloading YuNet model ->", cached, file=sys.stderr)
    req = urllib.request.Request(MODEL_URL, headers={"User-Agent": "face-track"})
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"https": args.proxy, "http": args.proxy}) if args.proxy else urllib.request.ProxyHandler({})
    )
    with opener.open(req, timeout=120) as r, open(cached, "wb") as f:
        f.write(r.read())
    return cached


def make_detector(args):
    if args.detector in ("auto", "mediapipe"):
        try:
            import mediapipe as mp
            fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)

            def detect(frame):
                res = fd.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                if not res.detections:
                    return None
                b = max(res.detections, key=lambda d: d.score[0]).location_data.relative_bounding_box
                return (b.xmin + b.width / 2, b.ymin + b.height / 2, b.height)
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
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])[:4]
            H, W = frame.shape[:2]
            return (float(x + w / 2) / W, float(y + h / 2) / H, float(h) / H)
        return "yunet", detect
    xml = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
    if not os.path.exists(xml):
        sys.exit("无可用检测器：装 mediapipe，或允许下载 YuNet 模型（--proxy 可指定代理）")
    cc = cv2.CascadeClassifier(xml)

    def detect(frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cc.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
        if len(faces) == 0:
            return None
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        H, W = frame.shape[:2]
        return ((x + w / 2) / W, (y + h / 2) / H, h / H)
    return "haar", detect


def fill_gaps(raw, n):
    """raw: {idx: (cx,cy,fh)} → 长度 n 的列表；漏检线性插值，首尾保持。"""
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
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--aspect", type=float, default=1.0, help="裁切窗宽高比：1=方/圆裁，1.7778=横窗，0.5625=竖窗")
    ap.add_argument("--margin", type=float, default=4.0, help="裁切高 = 脸高 × margin（4≈胸口以上）")
    ap.add_argument("--anchor", type=float, default=0.38, help="脸中心落在裁切窗高度的比例")
    ap.add_argument("--stride", type=int, default=2, help="每隔几帧检测一次")
    ap.add_argument("--min-cutoff", type=float, default=0.6)
    ap.add_argument("--score", type=float, default=0.5, help="YuNet 置信度阈值；手持/模糊素材可降到 0.3~0.4")
    ap.add_argument("--beta", type=float, default=0.4)
    ap.add_argument("--window", type=float, default=0.25, help="中心平滑 lookahead 秒数（前后各取）")
    ap.add_argument("--detector", choices=["auto", "mediapipe", "yunet", "haar"], default="auto")
    ap.add_argument("--model", help="YuNet onnx 路径（默认 ~/.cache/face-track/）")
    ap.add_argument("--proxy", help="下载模型用的代理，如 http://127.0.0.1:7897")
    ap.add_argument("--debug-dir", help="写 5 张叠框检查图（裁切框绿/检测框红）")
    ap.add_argument("--sendcmd", help="另写 ffmpeg sendcmd 命令文件（零依赖管线预裁切用）")
    args = ap.parse_args()

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        sys.exit("打不开视频: " + args.video)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
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
        sys.exit("全片未检测到人脸，检查素材或换检测器")
    n = (fno + args.stride - 1) // args.stride
    filled = fill_gaps(raw, n)
    half = max(1, round(args.window * fps / args.stride))
    smoothed = center_smooth(filled, half)
    dt = args.stride / fps
    filters = [OneEuro(args.min_cutoff, args.beta) for _ in range(3)]
    track = []
    for i, v in enumerate(smoothed):
        if v is None:
            continue
        cx, cy, fh = (filters[k](v[k], dt) for k in range(3))
        h = fh * args.margin * H
        w = h * args.aspect
        if w > W or h > H:
            s = min(W / w, H / h)
            w, h = w * s, h * s
        x = min(max(cx * W - w / 2, 0), W - w)
        y = min(max(cy * H - args.anchor * h, 0), H - h)
        track.append({"f": i * args.stride, "x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2)})

    meta = {
        "source": os.path.basename(args.video), "fps": fps, "width": W, "height": H,
        "frame_count": fno, "stride": args.stride, "aspect": args.aspect, "margin": args.margin,
        "anchor": args.anchor, "detector": name, "detected_ratio": round(len(raw) / n, 3),
        "smoothing": {"window_s": args.window, "min_cutoff": args.min_cutoff, "beta": args.beta},
        "frame_unit": "source-video frames",
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "track": track}, f, ensure_ascii=False)

    if args.sendcmd:
        # sendcmd 的时间轴 = 人物源视频秒；逐区间下发 crop 四参数，供 ffmpeg 一次预裁切
        with open(args.sendcmd, "w", encoding="utf-8") as f:
            for i, p in enumerate(track):
                t0 = p["f"] / fps
                t1 = track[i + 1]["f"] / fps if i + 1 < len(track) else fno / fps
                f.write(f"{t0:.3f}-{t1:.3f} crop x {p['x']}, crop y {p['y']}, crop w {p['w']}, crop h {p['h']};\n")

    if args.debug_dir:
        os.makedirs(args.debug_dir, exist_ok=True)
        cap = cv2.VideoCapture(args.video)
        for q in (0, .25, .5, .75, .99):
            target = int(q * (fno - 1))
            cap.set(cv2.CAP_PROP_POS_FRAMES, target)
            ok, frame = cap.read()
            if not ok:
                continue
            e = min(track, key=lambda t: abs(t["f"] - target))
            x, y, w, h = (int(e[k]) for k in ("x", "y", "w", "h"))
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 200, 0), 3)
            # cv2.imwrite 在 Windows 非 ASCII 路径下静默失败，走 imencode + Python 写盘
            ok2, buf = cv2.imencode(".jpg", frame)
            if ok2:
                with open(os.path.join(args.debug_dir, f"check-{int(q * 100):02d}.jpg"), "wb") as f:
                    f.write(buf.tobytes())
        cap.release()

    print(json.dumps({"detector": name, "detected_ratio": meta["detected_ratio"],
                      "track_points": len(track), "out": args.out}, ensure_ascii=False))


if __name__ == "__main__":
    main()