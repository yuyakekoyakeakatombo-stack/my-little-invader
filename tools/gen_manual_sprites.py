#!/usr/bin/env python3
"""説明書（manual.html）のミニゲーム章に、ゲーム本体のドット絵を差し込む。

ドット絵はゲームのソースから読むので、絵を直したらこれを流し直せば説明書も追いつく。
差し込み先は manual.html の <!-- SPRITES:キー --> … <!-- /SPRITES:キー --> のあいだ。

  python3 tools/gen_manual_sprites.py
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ON, DIM = '#1a2410', '#8aaa6a'
SCALE = 6                                  # 1ドットあたりの表示px

def js_array(src, name):
    """`const NAME=[ ... ];` を Python のリストとして取り出す"""
    m = re.search(r'const\s+' + name + r'\s*=\s*(\[[\s\S]*?\n\s*\];)', src)
    if not m:
        m = re.search(r'const\s+' + name + r'\s*=\s*(\[[\s\S]*?\];)', src)
    if not m:
        sys.exit('スプライトが見つからない: ' + name)
    body = m.group(1).rstrip(';')
    body = re.sub(r'//[^\n]*', '', body)                  # 行コメントを外す
    body = body.replace('N', '2').replace('Dm', '1')      # spacewalk の定数
    body = re.sub(r'\{\s*g\s*:', '', body)                # {g:[...]} の殻を外す
    body = body.replace('}', '')
    return eval(body)

def join(grids, gap=2):
    """2コマの絵を横に並べて1枚にする（点滅するものは、静止画だと1コマでは伝わらない）"""
    h = max(len(g) for g in grids)
    out = [[] for _ in range(h)]
    for gi, g in enumerate(grids):
        pad = (h - len(g)) // 2
        for y in range(h):
            row = g[y-pad] if pad <= y < pad+len(g) else [0]*len(g[0])
            if gi: out[y] += [0]*gap
            out[y] += list(row)
    return out

def svg(grid, label):
    h = len(grid); w = len(grid[0])
    # 0/1 の2値スプライト（UFOなど）は 1 が濃い色。0/1/2 の3値だけ 1 が薄い色になる。
    #  ここを見ないと、ゲームでは濃く出ているUFOが説明書では薄く出てしまう
    tri = max(max(r) for r in grid) >= 2
    rects = []
    for y, row in enumerate(grid):
        for x, v in enumerate(row):
            if not v: continue
            col = ON if (v == 2 or not tri) else DIM
            rects.append('<rect x="%d" y="%d" width="1" height="1" fill="%s"/>' % (x, y, col))
    return ('<figure><svg viewBox="0 0 %d %d" width="%d" height="%d" shape-rendering="crispEdges" '
            'xmlns="http://www.w3.org/2000/svg">%s</svg><figcaption>%s</figcaption></figure>'
            % (w, h, w*SCALE, h*SCALE, ''.join(rects), label))

def solid(g):
    """0/1の2値スプライトを 0/2 に直す。薄い色(1)と混ぜて描くための下ごしらえ"""
    return [[2 if v else 0 for v in row] for row in g]

def with_beam(ufo, rows=9, half_max=5):
    """UFOの下に、地面へ向かって広がるビームを足す（ゲームと同じく薄い色の三角）"""
    w = len(ufo[0]); cx = w // 2
    g = solid(ufo)
    for i in range(rows):
        half = round((i+1) * half_max / rows)
        row = [0]*w
        for dx in range(-half, half+1):
            x = cx + dx
            if 0 <= x < w: row[x] = 1          # 1 = 薄い色
        g.append(row)
    return g

def charging(ufo, tail=5):
    """地面すれすれを横切ってくる姿。うしろに薄い線を引いて動きを表す"""
    w = len(ufo[0]); h = len(ufo)
    g = [[0]*tail + list(r) for r in solid(ufo)]
    for y in (2, 3, 4):
        for x in range(tail-1):
            if (x + y) % 2 == 0: g[y][x] = 1   # 1 = 薄い色
    g.append([0]*(tail+w))                      # 地面とのすき間
    g.append([2]*(tail+w))                      # 地面
    return g

sw = (ROOT/'spacewalk_game.html').read_text(encoding='utf-8')
ss = (ROOT/'shootingstar_game.html').read_text(encoding='utf-8')
ab = (ROOT/'abduction_game.html').read_text(encoding='utf-8')

sw_objs = js_array(sw, 'SPRITES')          # 星・土星・ロケット・隕石・彗星・衛星
BLOCKS = {
 'spacewalk': [
    (sw_objs[0], 'ほし'), (sw_objs[1], 'どせい'), (sw_objs[5], 'えいせい'),
    (sw_objs[2], 'ロケット'), (sw_objs[3], 'いんせき'), (sw_objs[4], 'すいせい'),
    (js_array(sw, 'UFO'), 'UFO'),
 ],
 'shootingstar': [
    (js_array(ss, 'STAR'),   'ながれぼし'),
    (js_array(ss, 'METEOR'), 'いんせき'),
    # 2コマ目（×の形）だけを出す。1コマ目は ながれぼし と紛らわしい
    (js_array(ss, 'GEM_B'), 'きらきらぼし'),
 ],
 'abduction': [
    (js_array(ab, 'UFO'), 'UFO'),
    (with_beam(js_array(ab, 'UFO')), 'ビーム'),
    (charging(js_array(ab, 'UFO')), 'たいあたり'),
 ],
}

man = ROOT/'manual.html'
s = man.read_text(encoding='utf-8')
for key, items in BLOCKS.items():
    a, b = '<!-- SPRITES:%s -->' % key, '<!-- /SPRITES:%s -->' % key
    if a not in s:
        sys.exit('差し込み先の目印が無い: ' + a)
    i, j = s.index(a) + len(a), s.index(b)
    s = s[:i] + '\n<div class="chars gitems">' + ''.join(svg(g, l) for g, l in items) + '</div>\n' + s[j:]
    print('%-14s %d点' % (key, len(items)))
man.write_text(s, encoding='utf-8')
print('manual.html を更新しました')
