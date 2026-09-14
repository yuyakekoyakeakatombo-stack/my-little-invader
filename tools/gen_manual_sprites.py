#!/usr/bin/env python3
"""説明書（manual.html）に、ゲーム本体のドット絵を差し込む。

ドット絵はゲームのソースから読むので、絵を直したらこれを流し直せば説明書も追いつく。
  ・ミニゲーム章：<!-- SPRITES:キー --> … <!-- /SPRITES:キー --> のあいだ
  ・お世話アイコン：<div class="icons"> の中の6枚の絵（CARE_ORDER の順）。
    **名前と説明の文はさわらず、絵だけを入れ替える**

  python3 tools/gen_manual_sprites.py [説明書のパス ...]   （省略時は manual.html）
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

def svg_only(grid):
    """svg() から figure と見出しを外したもの"""
    return re.search(r'<svg [\s\S]*?</svg>', svg(grid, '')).group(0)

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

# ── お世話アイコン（invader_game.html の CARE_ICONS）──────────
game = (ROOT/'invader_game.html').read_text(encoding='utf-8')
ICON_SCALE = 4                             # MENU のアイコンは 1ドット 4px で並べる

def care_icons():
    m = re.search(r'const CARE_ICONS = \{([\s\S]*?)\n  \};', game)
    if not m:
        sys.exit('お世話アイコンが見つからない: CARE_ICONS')
    icons = {k: [[2 if c == '#' else 1 if c == '+' else 0 for c in r.strip()]
                 for r in body.strip().split('\n')]
             for k, body in re.findall(r'(\w+): careIcon\(`([\s\S]*?)`\)', m.group(1))}
    order = re.search(r"const CARE_ORDER\s*=\s*\[([^\]]*)\]", game)
    keys = re.findall(r"'(\w+)'", order.group(1))
    return [icons[k] for k in keys]

def icon_svg(grid):
    h = len(grid); w = len(grid[0])
    rects = ''.join('<rect x="%d" y="%d" width="1" height="1" fill="%s"/>'
                    % (x, y, ON if v == 2 else DIM)
                    for y, row in enumerate(grid) for x, v in enumerate(row) if v)
    return ('<svg viewBox="0 0 %d %d" width="%d" height="%d" shape-rendering="crispEdges" '
            'xmlns="http://www.w3.org/2000/svg">%s</svg>' % (w, h, w*ICON_SCALE, h*ICON_SCALE, rects))

def put_icons(s):
    a = '<div class="icons">'
    if a not in s:
        sys.exit('お世話アイコンの一覧が無い: ' + a)
    i = s.index(a); j = s.index('\n</div>', i)
    block = s[i:j]
    grids = care_icons()
    svgs = list(re.finditer(r'<svg [\s\S]*?</svg>', block))
    if len(svgs) != len(grids):
        sys.exit('アイコンの数が合わない: 説明書 %d / ゲーム %d' % (len(svgs), len(grids)))
    for m, g in reversed(list(zip(svgs, grids))):
        block = block[:m.start()] + icon_svg(g) + block[m.end():]
    print('%-14s %d点' % ('care icons', len(grids)))
    return s[:i] + block + s[j:]

paths = [pathlib.Path(p) for p in sys.argv[1:]] or [ROOT/'manual.html']
for man in paths:
  s = man.read_text(encoding='utf-8')
  s = put_icons(s)
  for key, items in BLOCKS.items():
    a, b = '<!-- SPRITES:%s -->' % key, '<!-- /SPRITES:%s -->' % key
    if a not in s:
        sys.exit('差し込み先の目印が無い: ' + a)
    i, j = s.index(a) + len(a), s.index(b)
    #  **絵だけを入れ替える。** 見出し（figcaption）は説明書の側で2言語に書いてあるので残す。
    #  まだ何も無いときだけ、ここの名前で一式を作る
    block = s[i:j]
    figs = list(re.finditer(r'<svg [\s\S]*?</svg>', block))
    if not figs:
        block = '\n<div class="chars gitems">' + ''.join(svg(g, l) for g, l in items) + '</div>\n'
    elif len(figs) != len(items):
        sys.exit('%s の絵の数が合わない: 説明書 %d / ゲーム %d' % (key, len(figs), len(items)))
    else:
        for m, (g, _) in reversed(list(zip(figs, items))):
            block = block[:m.start()] + svg_only(g) + block[m.end():]
    s = s[:i] + block + s[j:]
    print('%-14s %d点' % (key, len(items)))
  man.write_text(s, encoding='utf-8')
  print('%s を更新しました' % man)
