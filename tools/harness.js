// ══════════════════════════════════════════════════════════════
//  invader_game.html の中身を Node 上で動かすための足場。
//
//  本体は一切書き換えない。読み込むときにメモリ上でだけ、IIFE の閉じ括弧の直前に
//  「内部を外へ渡す1行」を差し込む。こうすればテスト用のコードが製品に混ざらない。
//
//  ブラウザのAPIは、このゲームが実際に触っているものだけを最小限で用意する
//  （canvas は形だけ、localStorage は Map、タイマーは呼ばずに溜めておく）。
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.join(__dirname, '..', 'invader_game.html');

// 本体から取り出したい内部。let で再代入されるもの（pet など）は getter で渡す
const EXPORTS = `
;globalThis.__api = {
  get pet(){ return pet; }, set pet(v){ pet = v; },
  defaultPet, savePet, migratePet, wasHiddenRoute, bigEater, allRounder, SAVE_V, MIGRATIONS,
  closeOneDay, checkReturn, checkInvade, returnSigns, invadeSigns, wrathful, isWild,
  gainB, bondCapToday, markTouch, bondDrop, dailyCareScore,
  doCare, careDisabled, advancePet, maybeEvolve,
  hungerMin, feedGain, feedFill, HUNGER_MAX,
  sleepConfig, isAsleep, sleepKind, stayingUpLate, effectiveAsleep, owlShift,
  pickForm, pickLineage, pickVoice, voice, voiceIdx, pTrait,
  todayKey, petDay, daysBetweenKeys,
  formLabel, endLabel, typeLabel, stageLabel, menuList,
  addM, addP, addA, addD, M_ADJ, P_ADJ, A_ADJ,
  DIARY_LINES, DIARY_MUSINGS, DIARY_CLOSE, DIARY_PRIORITY,
  get diaryLog(){ return diaryLog; },
  buildDiary, diaryBody, addDiary, clearDiary,
  SICK_P, SICK_DIRT_MIN, BOND_CAP, RET_ESTR_DAYS, RET_GRACE_DAYS,
  STUCK_DAYS, ALLROUND, INV_M_MIN, INV_B_MAX, INV_P_MIN, INV_DAYS, WRATH_HOLD,
};
`;

function mainScript(){
  const html = fs.readFileSync(GAME, 'utf8');
  // src 付きでない <script> のうち、IIFE で始まる本体を取る
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, body = null;
  while((m = re.exec(html))){
    if(/^\s*\(function\(\)\{/.test(m[1])) body = m[1];
  }
  if(!body) throw new Error('本体スクリプトが見つからない');
  const end = body.lastIndexOf('})();');
  if(end < 0) throw new Error('IIFEの終わりが見つからない');
  return body.slice(0, end) + EXPORTS + body.slice(end);
}

// ── 触っているぶんだけのブラウザAPI ───────────────────────────
function makeSandbox(opts){
  const store = new Map(Object.entries(opts.storage || {}));
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
  const ctx = new Proxy({}, {
    get(t, p){
      if(p === 'measureText') return () => ({ width: 0 });
      if(p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if(p === 'canvas') return { width: 216, height: 260 };
      return typeof t[p] === 'undefined' ? (()=>{}) : t[p];
    },
    set(t, p, v){ t[p] = v; return true; },
  });
  const el = () => new Proxy({
    getContext: () => ctx, addEventListener(){}, removeEventListener(){},
    appendChild(){}, removeChild(){}, click(){}, focus(){}, blur(){},
    style: { setProperty(){}, removeProperty(){}, getPropertyValue: () => '' },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    dataset: {}, children: [], value: '', textContent: '',
    width: 216, height: 260, getBoundingClientRect: () => ({width:216,height:260,top:0,left:0}),
  }, { get(t,p){ return p in t ? t[p] : undefined; }, set(t,p,v){ t[p]=v; return true; } });

  const timers = [];
  const document = {
    getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [],
    createElement: () => el(), addEventListener(){}, removeEventListener(){},
    body: el(), documentElement: el(), hidden: false, visibilityState: 'visible',
  };
  const win = {
    addEventListener(){}, removeEventListener(){},
    matchMedia: () => ({ matches: false, addEventListener(){}, addListener(){} }),
    innerWidth: 400, innerHeight: 800, orientation: 0,
    screen: { width: 400, height: 800 },
    location: { href: '', origin: 'http://localhost', reload(){} },
    navigator: { userAgent: 'node', standalone: false },
    AudioContext: function(){ return { state:'running', currentTime:0, destination:{},
      createOscillator: () => ({ connect(){}, start(){}, stop(){}, frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, type:'' }),
      createGain: () => ({ connect(){}, gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} } }),
      resume: () => Promise.resolve() }; },
    devicePixelRatio: 1,
  };
  const sandbox = {
    window: win, document, localStorage, navigator: win.navigator,
    location: win.location, screen: win.screen, console,
    setInterval: (fn, ms) => { timers.push({fn, ms}); return timers.length; },
    clearInterval(){}, setTimeout: (fn) => { timers.push({fn, ms:0}); return timers.length; },
    clearTimeout(){}, requestAnimationFrame(){}, cancelAnimationFrame(){},
    fetch: () => Promise.reject(new Error('offline')),
    Math, JSON, Date: opts.Date || Date, Set, Map, Object, Array, String, Number,
    Boolean, Error, Promise, isNaN, isFinite, parseInt, parseFloat, Uint8ClampedArray,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  Object.assign(win, { localStorage, document });
  return { sandbox, store, timers };
}

// ── 止められる時計 ─────────────────────────────────────────
function makeClock(startMs){
  let now = startMs;
  class FakeDate extends Date {
    constructor(...a){ if(a.length === 0) super(now); else super(...a); }
    static now(){ return now; }
  }
  return {
    Date: FakeDate,
    now: () => now,
    set(ms){ now = ms; },
    advance(ms){ now += ms; },
    advanceDays(n){ now += n * 86400000; },
    setTime(h, m){ const d = new Date(now); d.setHours(h, m||0, 0, 0); now = d.getTime(); },
  };
}

// ── 読み込み ───────────────────────────────────────────────
//  at … 開始時刻（省略時は「ある日の正午」に固定して、実行時刻で結果が揺れないようにする）
function load(opts = {}){
  const start = opts.at != null ? opts.at : new Date(2026, 5, 15, 12, 0, 0).getTime();
  const clock = makeClock(start);
  const { sandbox, store, timers } = makeSandbox({ storage: opts.storage, Date: clock.Date });
  vm.createContext(sandbox);
  vm.runInContext(mainScript(), sandbox, { filename: 'invader_game.html' });
  const api = sandbox.__api;
  if(!api) throw new Error('内部の取り出しに失敗');
  return { api, clock, store, timers, sandbox };
}

module.exports = { load, mainScript };
