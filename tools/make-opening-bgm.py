#!/usr/bin/env python3
"""オープニングのBGM（opening_bgm.wav）を、元の曲から作る。

  python3 tools/make-opening-bgm.py

元の曲 Tiny_Planet_Joyride.mp3（本人が作った曲）の、**イントロ8小節だけ**を
拍どおりに頭へ戻れるよう切り出す。元の曲ファイルは大きいのでリポジトリには入れていない
（.gitignore）。手元に置いてから流す。

決めごと
  ・テンポは 120BPM（1拍 0.5秒・1小節 2秒）。イントロはちょうど8小節
  ・区切りは「最初の音の立ち上がり」から「本編の頭の立ち上がり」の直前まで。
    **拍の長さをいじらない**ので、頭へ戻ってもリズムがずれない
  ・イントロの最後の2小節は盛り上がって音が厚く、頭（静か）との落差が 10dB ほどある。
    そのまま戻すと段差が耳につくので、**最後の4秒で dB を直線に 0 → -10 まで下げて**、
    頭と同じくらいの大きさに着地させる
  ・つなぎ目で「プツッ」と鳴らないよう、頭に 2ms・終わりに 12ms のごく短い絞りを入れる

macOS の afconvert で mp3 を解く（ffmpeg は要らない）。numpy が要る。
"""
import pathlib, subprocess, sys, tempfile, wave
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'Tiny_Planet_Joyride.mp3'
OUT = ROOT / 'opening_bgm.wav'

SR = 44100
START = 1716        # 最初の音の立ち上がり（0.0389秒）
END = 707386        # 本編の頭の立ち上がり（16.0405秒）。ここは含めない
FADE_DB = -10.0     # 最後に下げきる量
FADE_SEC = 4.0      # 下げはじめてから終わりまで（最後の2小節）
EDGE_IN, EDGE_OUT = 0.002, 0.012   # つなぎ目の絞り（秒）


def decode(path):
    """mp3 を 44.1kHz・16bit・ステレオの配列にする"""
    with tempfile.TemporaryDirectory() as d:
        wav = pathlib.Path(d) / 'full.wav'
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', str(path), str(wav)], check=True)
        with wave.open(str(wav)) as w:
            if w.getframerate() != SR or w.getnchannels() != 2:
                sys.exit('想定と違う形式: %d Hz / %d ch' % (w.getframerate(), w.getnchannels()))
            raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768


def build(x):
    seg = x[START:END].copy()
    n = len(seg)
    ramp = int(FADE_SEC * SR)
    g = np.ones(n, dtype=np.float32)
    g[-ramp:] = 10 ** (np.linspace(0, FADE_DB, ramp) / 20)
    seg *= g[:, None]
    fi, fo = int(EDGE_IN * SR), int(EDGE_OUT * SR)
    seg[:fi] *= (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fi)))[:, None]
    seg[-fo:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fo)))[:, None]
    return seg


def main():
    if not SRC.exists():
        sys.exit('元の曲が無い: ' + str(SRC))
    seg = build(decode(SRC))
    with wave.open(str(OUT), 'wb') as o:
        o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR)
        o.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes())
    print('%s を書き出しました（%d フレーム・%.4f 秒）' % (OUT.name, len(seg), len(seg) / SR))


if __name__ == '__main__':
    main()
