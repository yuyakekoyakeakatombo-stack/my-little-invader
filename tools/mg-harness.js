// ══════════════════════════════════════════════════════════════
//  ミニゲーム3本を Node に読み込むための土台。
//
//  本体（invader_game.html）用の harness.js と同じ考え方で、ゲームの
//  ソースには一切手を入れず、IIFE の閉じ括弧の直前に取り出し口を差し込む。
//  キャンバス・音・タイマーは差し替えるので、update() を好きな回数だけ
//  手で回して、当たり判定や得点や残機を確かめられる。
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..');

// ── 何もしないキャンバス ──
//  ミニゲームは描画結果を読まないので、呼ばれても平気なだけでよい
function fakeCtx(){
  const noop = () => {};
  return {
    canvas: { width: 216, height: 260 },
    fillStyle: '', font: '', textAlign: '', textBaseline: '',
    fillRect: noop, clearRect: noop, fillText: noop, measureText: () => ({ width: 0 }),
    beginPath: noop, arc: noop, fill: noop, stroke: noop, save: noop, restore: noop,
    drawImage: noop, translate: noop, scale: noop, setTransform: noop,
    getImageData: () => ({ data: new Uint8ClampedArray(216*260*4) }),
    putImageData: noop, createLinearGradient: () => ({ addColorStop: noop }),
  };
}
function fakeEl(id){
  const el = {
    id, style: { setProperty(){}, getPropertyValue(){ return ''; }, removeProperty(){} }, className: '', classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    width: 216, height: 260, dataset: {},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, focus(){}, blur(){}, click(){},
    getContext: () => el.__ctx || (el.__ctx = fakeCtx()),
    getBoundingClientRect: () => ({ left:0, top:0, width:216, height:260, right:216, bottom:260 }),
    querySelector: () => fakeEl('q'), querySelectorAll: () => [],
    textContent: '', innerHTML: '', setAttribute(){}, getAttribute(){ return null; },
  };
  return el;
}

// ── 止められる時計（本体の harness と同じ作り） ──
function makeClock(startMs){
  let now = startMs;
  class FakeDate extends Date {
    constructor(...a){ if(a.length === 0) super(now); else super(...a); }
    static now(){ return now; }
  }
  return {
    Date: FakeDate, now: () => now,
    set(ms){ now = ms; }, advance(ms){ now += ms; },
  };
}

function makeSandbox({ storage, Date: D }){
  const store = Object.assign({}, storage || {});
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for(const k of Object.keys(store)) delete store[k]; },
  };
  const els = {};
  const document = {
    getElementById: id => els[id] || (els[id] = fakeEl(id)),
    querySelector: () => fakeEl('q'),
    querySelectorAll: () => [],
    addEventListener(){}, removeEventListener(){},
    createElement: t => fakeEl(t),
    body: fakeEl('body'), documentElement: fakeEl('html'),
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  };
  const timers = [];      // setInterval は動かさない。update() は手で回す
  const sandbox = {
    // Math はサンドボックスごとに持たせる（差し替えがグローバルへ漏れないように）
    console, Math: Object.create(Math), JSON, Object, Array, String, Number, Boolean, Set, Map,
    isNaN, isFinite, parseInt, parseFloat, Promise, Error, RegExp, Uint8ClampedArray,
    Date: D,
    setInterval: (fn, ms) => { timers.push({ fn, ms, kind:'interval' }); return timers.length; },
    setTimeout:  (fn, ms) => { timers.push({ fn, ms, kind:'timeout'  }); return timers.length; },
    clearInterval(){}, clearTimeout(){},
    requestAnimationFrame: fn => { timers.push({ fn, kind:'raf' }); return timers.length; },
    cancelAnimationFrame(){},
    localStorage, document,
    location: { href: '', search: '', replace(){}, assign(){} },
    navigator: { userAgent: 'node', language: 'ja' },
    // 音は鳴らさない。beep() が触るぶんだけ形をあわせる
    AudioContext: function(){ return {
      state: 'running', currentTime: 0, destination: {},
      createOscillator: () => ({ type:'', frequency:{ value:0, setValueAtTime(){} },
        connect(){}, start(){}, stop(){}, onended:null }),
      createGain: () => ({ gain:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){},
        linearRampToValueAtTime(){} }, connect(){} }),
      resume: () => Promise.resolve(), close: () => Promise.resolve(),
    }; },
    performance: { now: () => D.now() },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.webkitAudioContext = sandbox.AudioContext;
  return { sandbox, store, timers, els };
}

// ── 取り出し口 ──
//  3本に共通のもの＋ゲームごとのもの。ソースに手を入れず、ここで差し込む
const COMMON = `
  get state(){ return state; }, set state(v){ state = v; },
  get score(){ return score; }, set score(v){ score = v; },
  get elapsed(){ return elapsed; }, set elapsed(v){ elapsed = v; },
  STATE, TICK, FPS, W, H, keys, startGame, update, draw, reportScore,
`;
const EXTRA = {
  spacewalk: `
    get lives(){ return lives; }, set lives(v){ lives = v; },
    get plyX(){ return plyX; }, set plyX(v){ plyX = v; },
    get plyY(){ return plyY; }, set plyY(v){ plyY = v; },
    get objs(){ return objs; }, set objs(v){ objs = v; },
    get stage(){ return stage; }, set stage(v){ stage = v; },
    get warpLeft(){ return warpLeft; }, set warpLeft(v){ warpLeft = v; },
    get hitCooldown(){ return hitCooldown; }, set hitCooldown(v){ hitCooldown = v; },
    get phaseTimer(){ return phaseTimer; }, set phaseTimer(v){ phaseTimer = v; },
    get clearTimer(){ return clearTimer; }, set clearTimer(v){ clearTimer = v; },
    get bx(){ return bx; }, set bx(v){ bx = v; },
    get by(){ return by; }, set by(v){ by = v; },
    diff, hitsObstacle, hitsBoss, loseLife, movePlayer, doWarp,
    SPRITES, UFO, CHAR, MISS_MAX, WARP_MAX, GTOP, GBOT, CH_W, CH_H,
    PLY_MIN_X, PLY_MAX_X, PLY_MIN_Y, PLY_MAX_Y, BOSS_INTERVAL, BOSS_TIME,
  `,
  shootingstar: `
    get lives(){ return lives; }, set lives(v){ lives = v; },
    get plyX(){ return plyX; }, set plyX(v){ plyX = v; },
    get stars(){ return stars; }, set stars(v){ stars = v; },
    get beams(){ return beams; }, set beams(v){ beams = v; },
    get meteor(){ return meteor; }, set meteor(v){ meteor = v; },
    fire, spawnStar, level,
    MISS_MAX, GY, CY, CH_W, CH_H, STAR_W, STAR_H, PLY_MIN, PLY_MAX,
    MET_FIRST, MET_W, MET_H,
  `,
  abduction: `
    get plyX(){ return plyX; }, set plyX(v){ plyX = v; },
    get plyY(){ return plyY; }, set plyY(v){ plyY = v; },
    get ufoX(){ return ufoX; }, set ufoX(v){ ufoX = v; },
    get ufoY(){ return ufoY; }, set ufoY(v){ ufoY = v; },
    get hitCount(){ return hitCount; }, set hitCount(v){ hitCount = v; },
    get hitCooldown(){ return hitCooldown; }, set hitCooldown(v){ hitCooldown = v; },
    get mode(){ return mode; }, set mode(v){ mode = v; },
    get modeTimer(){ return modeTimer; }, set modeTimer(v){ modeTimer = v; },
    get beamX(){ return beamX; }, set beamX(v){ beamX = v; },
    get jumping(){ return jumping; }, set jumping(v){ jumping = v; },
    get graceFrames(){ return graceFrames; }, set graceFrames(v){ graceFrames = v; },
    curDiff, checkBeamHit, checkUfoHit, jump, beamEdge,
    GY, GROUND_Y, UFO_W, UFO_H, CH_W, CH_H,
    SCORE_PER_SEC, PENALTY_HIT, DIVE_START, CHARGE_START,
  `,
};

const FILES = {
  spacewalk:    'spacewalk_game.html',
  shootingstar: 'shootingstar_game.html',
  abduction:    'abduction_game.html',
};

// src 付きでない <script> のうち、IIFE 本体（いちばん長いもの）を取る
function mainScript(game){
  const html = fs.readFileSync(path.join(DIR, FILES[game]), 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if(!blocks.length) throw new Error(game + ': script が見つからない');
  const body = blocks.sort((a, b) => b.length - a.length)[0];
  // IIFE の閉じ括弧の直前に取り出し口を差し込む（ソースには手を入れない）
  const close = body.lastIndexOf('})();');
  if(close < 0) throw new Error(game + ': IIFE の閉じ括弧が見つからない');
  const exp = `\n;globalThis.__mg = {\n${COMMON}${EXTRA[game] || ''}\n};\n`;
  return body.slice(0, close) + exp + body.slice(close);
}

function load(game, opts = {}){
  if(!FILES[game]) throw new Error('知らないゲーム: ' + game);
  const start = opts.at != null ? opts.at : new Date(2026, 5, 15, 12, 0, 0).getTime();
  const clock = makeClock(start);
  const { sandbox, store, timers, els } = makeSandbox({ storage: opts.storage, Date: clock.Date });
  vm.createContext(sandbox);
  vm.runInContext(mainScript(game), sandbox, { filename: FILES[game] });
  const api = sandbox.__mg;
  if(!api) throw new Error(game + ': 内部の取り出しに失敗');
  // 1フレーム進める（本体の setInterval と同じ中身）
  api.step = (n = 1) => { for(let i=0;i<n;i++){ api.update(); } };
  return { api, clock, store, timers, els, sandbox };
}

module.exports = { load, mainScript, FILES };
