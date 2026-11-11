#!/usr/bin/env python3
"""将 UTF-8 SRT 与口播视频转成 Remotion 可读取的时间数据。"""
import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

TIMING = re.compile(r'^(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})(?:\s+.*)?$')


def read_seconds(parts):
    h, m, s, ms = map(int, parts)
    if m >= 60 or s >= 60:
        raise ValueError('字幕时间中的分钟和秒必须小于 60')
    return h * 3600 + m * 60 + s + ms / 1000


def parse_srt(path):
    raw = path.read_text(encoding='utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').strip()
    cues = []
    for number, block in enumerate(re.split(r'\n\s*\n', raw), 1):
        lines = block.splitlines()
        index = next((i for i, line in enumerate(lines) if '-->' in line), None)
        if index is None:
            raise ValueError(f'第 {number} 段字幕缺少时间行')
        match = TIMING.fullmatch(lines[index].strip())
        if not match:
            raise ValueError(f'第 {number} 段字幕时间格式错误')
        start, end = read_seconds(match.groups()[:4]), read_seconds(match.groups()[4:])
        text = '\n'.join(lines[index + 1:]).strip()
        if end <= start or not text:
            raise ValueError(f'第 {number} 段字幕时间无效或文字为空')
        if cues and start < cues[-1]['start']:
            raise ValueError(f'第 {number} 段字幕的开始时间早于上一段，请检查顺序')
        cues.append({'start': start, 'end': end, 'text': text})
    if not cues:
        raise ValueError('字幕文件为空')
    return cues


def main():
    parser = argparse.ArgumentParser(description='检查 SRT 和视频时长，生成 Remotion 时间数据。')
    parser.add_argument('--video', required=True, type=Path, help='口播视频路径')
    parser.add_argument('--srt', required=True, type=Path, help='UTF-8 编码的 SRT 路径')
    parser.add_argument('--output', required=True, type=Path, help='输出 JSON 路径')
    parser.add_argument('--fps', type=float, default=30, help='输出视频帧率，默认 30')
    args = parser.parse_args()
    if not math.isfinite(args.fps) or args.fps <= 0:
        raise ValueError('帧率必须为正数')
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(args.video)],
                           check=True, capture_output=True, text=True, encoding='utf-8')
    duration = float(json.loads(probe.stdout)['format']['duration'])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('视频时长无效，请检查素材')
    cues = parse_srt(args.srt)
    if any(c['end'] > duration + 0.1 for c in cues):
        raise ValueError('有字幕超出视频时长，请检查字幕与视频是否对应')
    overlaps = sum(cues[i]['start'] < cues[i-1]['end'] for i in range(1, len(cues)))
    result = {'fps': args.fps, 'durationInFrames': math.ceil(duration * args.fps),
              'durationSeconds': duration, 'cues': cues}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'完成：{len(cues)} 条字幕，视频 {duration:.3f} 秒，{result["durationInFrames"]} 帧，输出 {args.output}')
    if overlaps:
        print(f'提示：{overlaps} 处字幕时间重叠，请对照口播检查。', file=sys.stderr)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, StopIteration, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f'无法生成时间数据：{exc}', file=sys.stderr)
        sys.exit(1)
