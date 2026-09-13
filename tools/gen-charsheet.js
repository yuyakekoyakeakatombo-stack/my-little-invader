// ══════════════════════════════════════════════════════════════
//  キャラクターシートを invader_chars2.html へ書き出す。
//  node tools/gen-charsheet.js
//
//  **絵は本体から取り出す。** 以前のシートは invader_game.html の
//  スプライト定義を手で写していたので、本体を直すたびにずれていった。
//  ここでは harness で本体を読み込み、そこから出てきた配列をそのまま描く。
//  ずれようがないかわりに、本体を直したら**このコマンドを流し直す**。
//
//  動きは PNG の帯（コマを横に並べたもの）＋ CSS の steps() で出す。
//  JavaScript は使わない——シートは人に渡すことがあるので、
//  開くだけで動く・中身が読める形にしておく
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { load } = require('./harness.js');
const mg = require('./minigame-harness.js');

const OUT = path.join(__dirname, '..', 'invader_chars2.html');
const SCALE = 5;                       // 1ドットあたりの画素
const PAL = { 0: [184, 200, 144], 1: [138, 170, 106], 2: [26, 36, 16] };  // 昼の3色

// ── PNG（帯）を作る ───────────────────────────────────────
//  コマを横に並べた1枚。CSS の background-position を steps() で送る
function png(frames, scale = SCALE, ink = 2) {
  const h = Math.max(...frames.map((f) => f.length));
  const w = Math.max(...frames.map((f) => f[0].length));
  const W = w * frames.length * scale, H = h * scale;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  //  下ぞろえで置く（足元をそろえる）。空きは地の色
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;                       // フィルタ種別
    for (let x = 0; x < W; x++) {
      const fi = Math.floor(x / (w * scale));
      const f = frames[fi] || [];
      const dx = Math.floor((x % (w * scale)) / scale);
      const off = h - f.length;                     // 下ぞろえ
      const dy = Math.floor(y / scale) - off;
      const v = (f[dy] && f[dy][dx]) ? ink : 0;
      const c = PAL[v];
      const p = y * (W * 3 + 1) + 1 + x * 3;
      raw[p] = c[0]; raw[p + 1] = c[1]; raw[p + 2] = c[2];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8bit RGB
  const buf = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return { url: 'data:image/png;base64,' + buf.toString('base64'),
           w: w * scale, h: H, n: frames.length };
}

let CRC_T = null;
function crc32(buf) {
  if (!CRC_T) {
    CRC_T = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_T[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = CRC_T[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── 見せ方 ────────────────────────────────────────────────
let idSeq = 0;
const css = [];
//  コマの帯をひとつ置く。1コマなら止め絵、2コマ以上なら steps() で送る
function cell(frames, ms, label, ink = 2) {
  const p = png(frames, SCALE, ink);
  let style = `width:${p.w}px;height:${p.h}px;background-image:url(${p.url});` +
              `background-size:${p.w * p.n}px ${p.h}px;`;
  if (p.n > 1) {
    const id = 'a' + (++idSeq);
    css.push(`@keyframes ${id}{to{background-position:-${p.w * p.n}px 0}}`);
    style += `animation:${id} ${(ms * p.n) / 1000}s steps(${p.n}) infinite;`;
    return `<div class="item"><div class="cell"><i style="${style}"></i></div>` +
           `<span>${label}</span></div>`;
  }
  return `<div class="item"><div class="cell"><i style="${style}"></i></div>` +
         `<span>${label}</span></div>`;
}

// ── 本体からキャラを取り出す ──────────────────────────────
const { api } = load();
function setPet(over) {
  Object.assign(api.pet, { name: 'T', stage: 'larva', lineage: '', form: '',
                           health: 'GOOD' }, over);
  return api.charSprites();
}

//  その子の「状態ごとの姿」。本体のどの枝で出るかを併記する
function statesOf(over) {
  const sp = setPet(over);
  const crouched = sp.rest !== sp.a;
  const out = [];
  out.push(['あるく（晴れ）', [sp.a, sp.b], 500]);
  out.push(['屈伸（跳ねる前）', [api.squatPose(sp, sp.a)], 0]);
  //  上下動は「1ドット沈む」ので、上に空の段を足したコマと交互にする
  const sink = (g) => [new Array(g[0].length).fill(0), ...g];
  out.push([crouched ? '休み・雨・雪（沈まない）' : '休み・雨・雪（上下する）',
            crouched ? [sp.rest] : [sp.rest, sink(sp.rest)], 600]);
  out.push(['びょうき（動かない）', [api.sickSprite(sp)], 0]);
  out.push(['ねている', [sp.sleep], 0]);
  out.push(['ひんし', [sp.rest], 0, 1]);
  const eat = api.eatSprite();
  out.push(['たべる', [eat, api.squatFrame(eat)], 200]);
  if (over.lineage === 'grey' && over.stage === 'adult') {
    out.push(['見まわす', [api.shiftEyes(sp, sp.a, -1), sp.a,
                          api.shiftEyes(sp, sp.a, 1)], 400]);
  }
  if (over.stage === 'egg' || over.stage === 'mid') {
    out.push(['モゾモゾ', [sp.b, api.flipH(sp.b)], 200]);
  }
  return out;
}

function charBlock(title, sub, over) {
  const rows = statesOf(over)
    .map(([n, f, ms, ink]) => cell(f, ms || 400, n, ink || 2)).join('');
  return `<div class="who"><b>${title}</b><span>${sub}</span></div>` +
         `<div class="row">${rows}</div>`;
}

// ── 並べる ────────────────────────────────────────────────
const parts = [];
parts.push(`<h2>STAGE 1〜2 — たまご・あかちゃん・こども</h2>
<p class="note">系統はまだ決まっていない。<b>病気は寝姿</b>で丸まる（どの段階も同じ）。</p>`);
parts.push(charBlock('うまれたて', 'STAGE 1 ／ たまご期', { stage: 'egg' }));
parts.push(charBlock('あかちゃん', 'STAGE 1.5 ／ 中間体', { stage: 'mid' }));
parts.push(charBlock('こども', 'STAGE 2 ／ 幼体期。休み姿は専用の絵（雨の日の姿）',
                     { stage: 'larva' }));

parts.push(`<h2>STAGE 3 — 成体（系統が決まる）</h2>
<p class="note">遊んだミニゲームの偏りで決まり、世話の傾向が弱く足される。
<b>グレイだけ休み姿が専用</b>（2コマ目の形で足を縮めたもの）で、
<b>病気も寝姿を使わない</b>——寝姿が仰向けなので、起きているのに寝ているように見えるため。</p>`);
for (const [L, name, sub] of [
  ['grey', 'グレイ', 'ABDUCTION をよく遊んだ／しつけが通っている'],
  ['tako', 'マーシャン', 'SPACEWALK をよく遊んだ／甘やかし気味'],
  ['inv', 'インベーダー', 'SHOOTING STAR をよく遊んだ／どちらでもない'],
]) parts.push(charBlock(name, sub, { stage: 'adult', lineage: L }));

parts.push(`<h2>STAGE 4 — 最終形態（体型が決まる）</h2>
<p class="note">体型は育て方に対応する。プランプ＝大食い または 甘やかし／
スリーク＝丁寧なケアとミニゲーム制覇／プリックリー＝ひどい扱いを受けた姿。</p>`);
for (const [L, base] of [['grey', 'グレイ'], ['tako', 'マーシャン'], ['inv', 'インベーダー']]) {
  const k = L === 'grey' ? 'g' : (L === 'tako' ? 't' : 'i');
  for (const [n, form] of [['プランプ', k + '1'], ['スリーク', k + '2'],
                           ['プリックリー', k + '3']]) {
    parts.push(charBlock(`${base}・${n}`, `STAGE 4 ／ ${form}`,
                         { stage: 'final', lineage: L, form }));
  }
}

// ── ミニゲームのデフォルメ ────────────────────────────────
{
  const { api: g } = mg.load('spacewalk');
  const rows = Object.keys(g.CHARS).map((k) =>
    cell([g.CHARS[k], g.CHARS_CROUCH[k]], 300, k)).join('');
  parts.push(`<h2>ミニゲーム用（デフォルメ）</h2>
<p class="note">3本のミニゲームで共通。立ち姿と屈伸の2コマで、走っている感じを出す。
<b>本体の系統・体型ではなく、この6種に丸めて</b>出す（小さい画面で見分けるため）。</p>
<div class="row">${rows}</div>`);
}

// ── 小物 ──────────────────────────────────────────────────
function iconRow(title, note, list) {
  const rows = list.filter(([, g]) => g && g.length)
                   .map(([n, g]) => cell([g], 0, n)).join('');
  return `<h2>${title}</h2><p class="note">${note}</p><div class="row">${rows}</div>`;
}
parts.push(iconRow('ごはん・おやつ', '皿の減りは3段階。おやつは小さい皿。',
  [['ごはん', api.MEAL_SPR], ['おやつ', api.SNACK_SPR], ['くすり', api.MED_PILL]]));
parts.push(iconRow('気もちのマーク', 'キャラの横に出る。<b>押したボタンではなく、どう応えたかで決まる</b>。',
  [['ハート', api.ICO_HEART], ['おこる', api.ICO_ANGER], ['・・・', api.ICO_DOTS],
   ['音符', api.ICO_NOTE], ['あせ', api.ICO_DROP], ['！', api.ICO_EXCL],
   ['どくろ', api.ICO_SKULL], ['ZZZ', api.ICO_ZZZ]]));
parts.push(iconRow('お世話アイコン（MENU）', '並びは ごはん・そうじ・くすり・なでる・しかる・ゲーム。',
  [['ごはん', 'FEED'], ['そうじ', 'CLEAN'], ['くすり', 'MED'],
   ['なでる', 'PET'], ['しかる', 'SCOLD'], ['ゲーム', 'GAME']]
    .map(([n, k]) => [n, (api.CARE_ICONS || {})[k]])));
parts.push(iconRow('空と地面', '天気で出しわける。花は20日目から5日かけて咲きそろう。',
  [['たいよう', api.SUN], ['つき', api.MOON], ['くも（大）', api.CLOUD_A],
   ['くも（小）', api.CLOUD_B], ['とり', api.BIRD_UP], ['とり（遠い）', api.BIRD_FAR_UP],
   ['UFO', api.UFO_SPR], ['おばけ', api.GHOST_SPR], ['うんち', api.POOP_SPR],
   ['花（双葉）', api.FLOWER_SPR[0]], ['花（つぼみ）', api.FLOWER_SPR[1]],
   ['花（さいた）', api.FLOWER_SPR[2]], ['侵攻', api.INV_SPR]]));

// ── 動きの癖（moveProfile） ───────────────────────────────
{
  const rows = [];
  const cases = [['うまれたて', { stage: 'egg' }], ['あかちゃん', { stage: 'mid' }],
                 ['こども', { stage: 'larva' }],
                 ['グレイ', { stage: 'adult', lineage: 'grey' }],
                 ['マーシャン', { stage: 'adult', lineage: 'tako' }],
                 ['インベーダー', { stage: 'adult', lineage: 'inv' }]];
  const keys = [['speed', '歩く速さ'], ['jump', 'ジャンプ'], ['float', '浮遊'],
                ['wiggle', 'モゾモゾ'], ['squat', 'その場屈伸'],
                ['squatWalk', '屈伸歩き'], ['look', '見まわす'], ['dash', 'ダッシュ']];
  for (const [name, over] of cases) {
    setPet(over);
    const pr = api.moveProfile();
    rows.push(`<tr><td>${name}</td>` + keys.map(([k]) =>
      `<td>${pr[k] ? (k === 'speed' ? pr[k].toFixed(2) : Math.round(pr[k] * 100) + '%')
                    : '—'}</td>`).join('') + '</tr>');
  }
  parts.push(`<h2>動きの癖（系統ごと）</h2>
<p class="note">次の行動を決めるときの出やすさ。性格（やんちゃ⇔おっとり）と
なかよしの低さで、この値がさらに増減する。<b>最終形態は成体の値をそのまま引き継ぐ。</b></p>
<table><tr><th>だれ</th>${keys.map(([, n]) => `<th>${n}</th>`).join('')}</tr>
${rows.join('\n')}</table>`);
}

// ── 状態の決まり（表） ────────────────────────────────────
parts.push(`<h2>どの姿が いつ出るか</h2>
<p class="note">上から順に見て、当てはまった最初のものを出す（本体 tickMain の並びと同じ）。</p>
<table>
<tr><th>状態</th><th>姿</th><th>上下動</th><th>備考</th></tr>
<tr><td>ひんし</td><td>休み姿（薄色）</td><td>しない</td><td>この間は眠らない</td></tr>
<tr><td>ねている</td><td>寝姿</td><td>しない</td><td>グレイは仰向け</td></tr>
<tr><td>びょうき</td><td><b>寝姿</b>（グレイ系だけ休み姿＋とじ目）</td><td><b>しない</b></td>
    <td>沈めると足が地面に埋まるため</td></tr>
<tr><td>雨・雪</td><td>休み姿</td><td>うずくまり姿の子はしない</td><td>歩く速さも落ちる</td></tr>
<tr><td>くもり</td><td>あるき2コマ</td><td>する</td><td>少しゆっくり</td></tr>
<tr><td>晴れ</td><td>あるき2コマ</td><td>跳ねる（前に屈伸で溜める）</td><td>—</td></tr>
</table>
<p class="note"><b>うずくまり姿を持つのは こども と 成体グレイ だけ</b>——
歩き1コマ目をそのまま休み姿にしていない2つ。足が1段しかないので、
1ドット沈めると足が地面の線に埋まって形が分からなくなる。</p>`);

// ── 書き出し ──────────────────────────────────────────────
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>my Vader — CHARACTER SHEET</title>
<style>
  :root{ --on:#1a2410; --off:#b8c890; --dim:#8aaa6a; --ink:#2b2f1c; }
  *{box-sizing:border-box}
  body{margin:0;padding:24px;background:#e8e4c8;color:var(--ink);
       font-family:"Hiragino Maru Gothic ProN","Yu Gothic","Hiragino Sans",sans-serif}
  h1{font-size:20px;margin:0 0 4px}
  .lead{font-size:12px;line-height:1.7;margin:0 0 20px;color:#5a5a44}
  h2{font-size:14px;margin:26px 0 4px;padding:5px 8px;background:var(--ink);
     color:#e8e4c8;border-radius:3px}
  .note{font-size:11px;color:#6a6a50;margin:6px 0 10px;line-height:1.6}
  .who{font-size:13px;margin:14px 0 4px}
  .who b{display:block}
  .who span{font-size:10px;color:#6a6a50}
  .row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:6px;align-items:flex-end}
  .item{text-align:center;font-size:10px;color:#5a5a44}
  .cell{display:inline-block;background:var(--off);border:1px solid #a8b880;
        border-radius:2px;padding:5px;line-height:0}
  .cell i{display:block;image-rendering:pixelated;background-repeat:no-repeat}
  .item span{display:block;margin-top:3px}
  table{border-collapse:collapse;width:100%;margin:8px 0}
  th,td{border:1px solid #c4c0a0;padding:6px;font-size:11px;text-align:left;
        vertical-align:top}
  th{background:#d8d4b4;font-weight:600}
${css.join('\n')}
</style></head><body>
<h1>my Vader — CHARACTER SHEET</h1>
<p class="lead">
<b>invader_game.html から取り出して描いています。</b>手で写していないので、絵はいつでも本体と同じです
（本体を直したら <code>node tools/gen-charsheet.js</code> を流し直してください）。
最終更新：${new Date().toISOString().slice(0, 10)}<br>
動く枠は、本体と同じ間隔でコマを送っています（CSS だけで動かしているので、
このファイルを開くだけで動きます）。色は昼の配色。夜は同じ形で色だけが変わります。
</p>
${parts.join('\n')}
</body></html>
`;
fs.writeFileSync(OUT, html);
console.log(`書き出した: ${path.relative(process.cwd(), OUT)}  ` +
            `${(Buffer.byteLength(html) / 1024).toFixed(0)} KB / 動く枠 ${idSeq} 個`);
