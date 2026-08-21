// ══════════════════════════════════════════════════════════════
//  ミニゲームの突然変異チェック。node tools/mg-mutate.js で走る。
//
//  mg-test.js が本当に見張れているかを確かめる道具。ミニゲームを
//  わざと壊して、テストが落ちるかを見る。落ちなければ、その挙動は
//  誰も見ていない。ファイルは毎回かならず元に戻す（finally で復元）。
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, '..');
const TEST = path.join(__dirname, 'mg-test.js');
const FILE = {
  sw: path.join(DIR, 'spacewalk_game.html'),
  ss: path.join(DIR, 'shootingstar_game.html'),
  ab: path.join(DIR, 'abduction_game.html'),
};

// [どのゲーム, 名前, 置換前, 置換後, 期待]
//   期待='caught' … 検出できるべき ／ 'equivalent' … 壊しても挙動が変わらない
const MUTATIONS = [
  // ── 得点まわり（最終形態の条件そのものなので、いちばん大事） ──
  ['sw', '得点の下限を外す（負の得点が保存される）',
   "localStorage.setItem('myvader_result', JSON.stringify({game:'spacewalk', score:Math.max(0,score), at:Date.now()}))",
   "localStorage.setItem('myvader_result', JSON.stringify({game:'spacewalk', score:score, at:Date.now()}))", 'caught'],
  ['ss', '得点の下限を外す',
   "score:Math.max(0,score), at:Date.now()", "score:score, at:Date.now()", 'caught'],
  ['ab', '得点の下限を外す',
   "score:Math.max(0,score), at:Date.now()", "score:score, at:Date.now()", 'caught'],
  ['sw', 'ゲーム名をまちがえて保存する',
   "{game:'spacewalk', score:", "{game:'shootingstar', score:", 'caught'],
  ['ab', '得点を4桁で切り捨てて保存する',
   "score:Math.max(0,score), at:Date.now()",
   "score:Math.min(9999,Math.max(0,score)), at:Date.now()", 'caught'],
  ['ab', '罰点の引きすぎを止めない（得点が負に沈む）',
   "score = Math.max(0, Math.floor(elapsed/FPS*SCORE_PER_SEC) - hitCount*PENALTY_HIT);",
   "score = Math.floor(elapsed/FPS*SCORE_PER_SEC) - hitCount*PENALTY_HIT;", 'caught'],
  ['sw', '遊んでいる途中で結果を保存してしまう',
   "  function update(){", "  function update(){ reportScore();", 'caught'],

  // ── 説明文の読みやすさ（DIM は背景とのコントラストが1.46:1しかない）──
  ['sw', '説明文を読めない色に戻す',
   "txt('STARS SATELLITES',2,32,5,ON);", "txt('STARS SATELLITES',2,32,5,DIM);", 'caught'],
  ['ss', '説明文を読めない色に戻す',
   "txt('MANY HITS',14,45,5,ON);", "txt('MANY HITS',14,45,5,DIM);", 'caught'],
  ['ab', '説明文を読めない色に戻す',
   "txt('TAP TWICE TO DASH',2,19,5,ON);", "txt('TAP TWICE TO DASH',2,19,5,DIM);", 'caught'],

  // ── 戻る操作の統一 ──
  ['sw', 'ゲームオーバーでBが選択画面へ戻らない',
   "else if(state===STATE.TITLE || state===STATE.GAMEOVER) exitToMenu(true);",
   "else if(state===STATE.TITLE) exitToMenu(true);", 'caught'],
  ['ss', 'ゲームオーバーでMENUが選択画面へ戻らない',
   "exitToMenu(state===STATE.GAMEOVER); });", "exitToMenu(); });", 'caught'],
  ['ab', 'ゲームオーバーでMENUが選択画面へ戻らない',
   "exitToMenu(state===STATE.GAMEOVER);   //", "exitToMenu();   //", 'caught'],
  ['sw', '案内を画面の下からはみ出す位置に置く',
   "txtC('A : TITLE   B : BACK',61,5,ON);", "txtC('A : TITLE   B : BACK',64,5,ON);", 'caught'],
  ['sw', '戻る案内にAを出してしまう',
   "txtC('B : BACK',62,5,ON);", "txtC('A/B : BACK',62,5,ON);", 'caught'],

  // ── スペースウォーク ──
  ['sw', '自機が画面の左へはみ出す',
   "if(plyX<PLY_MIN_X) plyX=PLY_MIN_X;", "", 'caught'],
  ['sw', '自機が画面の下へはみ出す',
   "if(plyY>PLY_MAX_Y) plyY=PLY_MAX_Y;", "", 'caught'],
  ['sw', '障害物に当たらなくなる',
   "for(const [px,py] of pp) if(set.has(px+','+py)) return true;", "", 'caught'],
  ['sw', '離れていても当たったことになる',
   "  function hitsObstacle(){\n    const pp=playerPixels();",
   "  function hitsObstacle(){\n    if(objs.length) return true;\n    const pp=playerPixels();", 'caught'],
  ['sw', '残機が尽きても終わらない',
   "if(lives<=0){ state=STATE.GAMEOVER; reportScore(); beep(140,0.45,'sawtooth'); }", "", 'caught'],
  ['sw', 'ワープが減らない（無限に使える）',
   "warpLeft--; warpFx = 8;", "warpFx = 8;", 'caught'],
  ['sw', 'ワープの残りを見ない（負まで使える）',
   "if(warpLeft<=0){ beep(180,0.10,'sawtooth'); return; }", "", 'caught'],
  ['sw', '遊んでいなくてもワープできる',
   "if(state!==STATE.PLAY && state!==STATE.BOSS) return;", "", 'caught'],
  ['sw', '難しさが上がり続ける（頭打ちを外す）',
   "scrollSpeed: Math.min(0.8 + stage*0.25, 2.4),", "scrollSpeed: 0.8 + stage*0.25,", 'caught'],
  ['sw', 'スポーン間隔の下限を外す（0以下まで詰まる）',
   "spawnGap:    Math.max(22 - stage*2.5, 9),", "spawnGap:    22 - stage*2.5,", 'caught'],

  // ── シューティングスター ──
  ['ss', '自機が画面の外へ出る',
   "const PLY_MIN=1, PLY_MAX=W-CH_W-1;", "const PLY_MIN=-50, PLY_MAX=W+50;", 'caught'],
  ['ss', '横入りの星が画面の下からも出てくる（撃てない星）',
   "const SIDE_Y_MAX = Math.floor(H/2) - STAR_H;", "const SIDE_Y_MAX = H - STAR_H;", 'caught'],
  ['ss', '上から落ちる星が画面の端ぎりぎりから出てくる',
   "const TOP_MARGIN = 6;", "const TOP_MARGIN = 0;", 'caught'],
  ['ss', '横から入った星が外へ逃げていく',
   "{x:-3,  y:sideY, vx:0.7+Math.random()*0.3,    vy:0.3+Math.random()*0.3},",
   "{x:-3,  y:sideY, vx:-(0.7+Math.random()*0.3), vy:0.3+Math.random()*0.3},", 'caught'],
  ['ss', '星が下へ流れない（撃てない）',
   "{x:topX, y:-3, vx:inward*Math.random()*0.25, vy:0.6+Math.random()*0.3},",
   "{x:topX, y:-3, vx:inward*Math.random()*0.25, vy:0},", 'caught'],
  ['ss', '隕石が最初から出てくる',
   "meteor=null; metNext=MET_FIRST;", "meteor=null; metNext=0;", 'caught'],
  ['ss', '被弾が上限に達しても終わらない',
   "const MISS_MAX=5;           // 自機被弾の上限", "const MISS_MAX=99999;", 'caught'],

  // ── アブダクション ──
  ['ab', 'ビームに当たらなくなる',
   "      if(px>=beamX-half && px<=beamX+half) return true;", "", 'caught'],
  ['ab', 'ビームが出ていなくても当たる',
   "if(mode!=='beam') return false;", "", 'caught'],
  ['ab', 'UFOに重なっても当たらない',
   "      if(ufoPix.has(px+','+py)) return true;", "", 'caught'],
  ['ab', '序盤から降下してくる',
   "diveChance: (t < DIVE_START) ? 0 : Math.min(0.12 + (t-DIVE_START)*0.006, 0.35),",
   "diveChance: Math.min(0.12 + t*0.006, 0.35),", 'caught'],
  ['ab', '序盤から体当たりしてくる',
   "canCharge: t>=CHARGE_START,", "canCharge: true,", 'caught'],
  ['ab', 'UFOの速さが上がり続ける',
   "ufoSpeed: Math.min(0.5 + t*0.04, 1.6),", "ufoSpeed: 0.5 + t*0.04,", 'caught'],
  ['ab', '安全な時間が短くなり続ける（避けられなくなる）',
   "safeDur:  Math.max(20 - t*0.4, 8),", "safeDur:  20 - t*0.4,", 'caught'],
  ['ab', 'ビームが太くなり続ける',
   "beamHalf: Math.min(3 + Math.floor(t/5), 7),", "beamHalf: 3 + Math.floor(t/5),", 'caught'],
  ['ab', 'つかまってもゲームオーバーにならない',
   "if(caughtTimer<=0){ state=STATE.GAMEOVER; reportScore(); beep(160,0.4,'sawtooth'); }", "", 'caught'],
];

const orig = {};
for(const k of Object.keys(FILE)) orig[k] = fs.readFileSync(FILE[k], 'utf8');

let caught = 0; const missed = [], unexpected = [];
try {
  process.stdout.write('突然変異チェック（ミニゲームをわざと壊して、テストが落ちるかを見る）\n\n');
  for(const [g, name, from, to, expect] of MUTATIONS){
    const label = `[${g}] ${name}`;
    if(orig[g].split(from).length - 1 !== 1){
      console.log(`  ？ 対象が1か所に定まらない  ${label}`); continue;
    }
    fs.writeFileSync(FILE[g], orig[g].replace(from, to));
    let died = false;
    try { execFileSync(process.execPath, [TEST], { stdio: 'pipe' }); }
    catch(e){ died = true; }
    fs.writeFileSync(FILE[g], orig[g]);
    const good = (expect === 'caught') ? died : !died;
    if(good && expect === 'caught') caught++;
    if(!good && expect === 'caught') missed.push(label);
    if(!good && expect === 'equivalent') unexpected.push(label);
    console.log(`  ${good ? (expect === 'caught' ? '✓ 検出' : '－ 挙動不変') : '✗ 見逃し'}  ${label}`);
  }
} finally {
  for(const k of Object.keys(FILE)) fs.writeFileSync(FILE[k], orig[k]);
}
console.log('\nミニゲームは元に戻した');
const total = MUTATIONS.filter(m => m[4] === 'caught').length;
console.log(`検出 ${caught} / ${total}`);
if(missed.length) console.log('見逃し: ' + missed.join(' , '));
process.exit(missed.length ? 1 : 0);
