// ══════════════════════════════════════════════════════════════
//  ミニゲーム3本を Node 上で動かすための足場。
//
//  本体用の harness.js と同じ考え方で、**ゲームのHTMLは一切書き換えない。**
//  読み込むときにメモリ上でだけ、IIFE の閉じ括弧の直前に
//  「内部を外へ渡す1行」を差し込む。
//
//  3本は描画の下ごしらえ（dot/stamp/文字）とデフォルメ6種のキャラを
//  共通で持っているので、取り出す名前もほぼ共通にしてある。
//  ゲームごとに違うものは、後ろの EXTRA で足す。
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAMES = {
  spacewalk:    'spacewalk_game.html',
  shootingstar: 'shootingstar_game.html',
  abduction:    'abduction_game.html',
};

// 3本に共通して在るもの
const COMMON = `
  W, H, S, GTOP: (typeof GTOP !== 'undefined' ? GTOP : null),
  GBOT: (typeof GBOT !== 'undefined' ? GBOT : null),
  CHARS, CHAR, CHAR2, CHARS_CROUCH, CH_W, CH_H,
  STATE, TICK, MISS_MAX: (typeof MISS_MAX !== 'undefined' ? MISS_MAX : null),
  reportScore,
  get lineage(){ return lineage; }, set lineage(v){ lineage = v; },
  get state(){ return state; }, set state(v){ state = v; },
  get score(){ return score; }, set score(v){ score = v; },
  get lives(){ return lives; }, set lives(v){ lives = v; },
  get elapsed(){ return elapsed; }, set elapsed(v){ elapsed = v; },
  get menuSel(){ return menuSel; }, set menuSel(v){ menuSel = v; },
  get keys(){ return keys; },
`;

// ゲームごとに違うもの
const EXTRA = {
  spacewalk: `
  GTOP, GBOT, SPRITES, SPR_COL, sprSize, UFO, UFO_W, UFO_H,
  BOSS_PATS, BOSS_INTERVAL, BOSS_TIME, BOSS_EXIT_SPEED,
  PLY_MIN_X, PLY_MAX_X, PLY_MIN_Y, PLY_MAX_Y,
  SAFE_GAP, FIELD_H, WARP_MAX, diff, safestY, doWarp, relevantRanges,
  get plyX(){ return plyX; }, set plyX(v){ plyX = v; },
  get plyY(){ return plyY; }, set plyY(v){ plyY = v; },
  get objs(){ return objs; }, set objs(v){ objs = v; },
  get stage(){ return stage; }, set stage(v){ stage = v; },
  get spawnTimer(){ return spawnTimer; }, set spawnTimer(v){ spawnTimer = v; },
  get phaseTimer(){ return phaseTimer; }, set phaseTimer(v){ phaseTimer = v; },
  get warpLeft(){ return warpLeft; }, set warpLeft(v){ warpLeft = v; },
  get hitCooldown(){ return hitCooldown; }, set hitCooldown(v){ hitCooldown = v; },
  get bx(){ return bx; }, set bx(v){ bx = v; },
  get by(){ return by; }, set by(v){ by = v; },
  get bossPat(){ return bossPat; }, set bossPat(v){ bossPat = v; },
`,
  shootingstar: '',
  abduction: '',
};

function gameScript(name){
  const file = GAMES[name];
  if(!file) throw new Error('知らないゲーム: ' + name);
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, body = null;
  while((m = re.exec(html))){
    if(/^\s*\(function\(\)\{/.test(m[1])) body = m[1];
  }
  if(!body) throw new Error('本体スクリプトが見つからない: ' + file);
  const end = body.lastIndexOf('})();');
  if(end < 0) throw new Error('IIFEの終わりが見つからない: ' + file);
  const exports = `\n;globalThis.__api = {\n${COMMON}${EXTRA[name] || ''}};\n`;
  return body.slice(0, end) + exports + body.slice(end);
}

// 本体のハーネスから、ブラウザAPIの見立てを借りる
const { makeSandbox, makeClock } = require('./harness.js');

function load(name, opts = {}){
  const start = opts.at != null ? opts.at : new Date(2026, 5, 15, 12, 0, 0).getTime();
  const clock = makeClock(start);
  const { sandbox, store, timers, audioLog, drawLog } =
    makeSandbox({ storage: opts.storage, Date: clock.Date, recordDraw: opts.recordDraw });
  vm.createContext(sandbox);
  vm.runInContext(gameScript(name), sandbox, { filename: GAMES[name] });
  const api = sandbox.__api;
  if(!api) throw new Error('内部の取り出しに失敗: ' + name);
  return { api, clock, store, timers, sandbox, audioLog, drawLog };
}

module.exports = { load, gameScript, GAMES };
