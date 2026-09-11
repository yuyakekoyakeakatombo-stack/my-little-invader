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
  defaultPet, savePet, migratePet, loadPet, readSave,
  SAVE_KEY, SAVE_BAK, SAVE_BAD, get saveRecovered(){ return saveRecovered; }, wasHiddenRoute, bigEater, allRounder, pampered, SAVE_V, MIGRATIONS,
  SNACK_DECAY, BOND_NEGLECT, C_SMOOTH,
  FINAL_DAYS, FINAL_CAP, END_GRACE_MS, STUCK_DAYS, RET_GRACE_DAYS, RET_ESTR_DAYS, RET_PRAISE_RATE, RET_PLAY_RATE, RET_SCOLD_RATE, RET_NOTOUCH_DAYS, RET_LOWB_DAYS, DEPART_B, INV_M_MIN, INV_B_MAX, INV_P_MIN, INV_DAYS, WRATH_HOLD, finalDue, settleEnding, closeOneDay, checkReturn, checkInvade, returnSigns, invadeSigns, wrathful, isWild, redeemed, REDEEM_DAYS,
  gainB, bondCapToday, markTouch, bondDrop, dailyCareScore,
  doCare, careDisabled, onDisabledCare, advancePet, maybeEvolve, rollTantrum, tantrumStageMul, processGameResult, PLAY_HUNGER_MIN,
  get reactType(){ return reactType; },
  discTrait, playBias, careStyle, daysSince, D_SMOOTH,
  LINEAGE_D_MIN, LINEAGE_D_FULL, LINEAGE_TH, LINEAGE_CARE_W, A_SPOIL_SCALE, A_NEGLECT_SCALE,
  // ── 命名（内部の let を getter で渡す。本体は触っていない）──
  startNaming, nameMove, nameDelete, namePressA, nameLayout, nameCurMax, ABC_ROWS, NAME_MAX,
  get nameBuf(){ return nameBuf; }, set nameBuf(v){ nameBuf = v; },
  get nameCur(){ return nameCur; }, set nameCur(v){ nameCur = v; },
  get nameR(){ return nameR; },     set nameR(v){ nameR = v; },
  get nameC(){ return nameC; },     set nameC(v){ nameC = v; },
  get onDone(){ return onDone; },   set onDone(v){ onDone = v; },
  get onDel(){ return onDel; },     set onDel(v){ onDel = v; },
  get onSlots(){ return onSlots; }, set onSlots(v){ onSlots = v; },
  get menuSel(){ return menuSel; }, set menuSel(v){ menuSel = v; },
  menuMove, menuCols, menuList, MENU_BASE, MENU_RIGHT, SETTINGS_KEYS, diaryUnlocked,
  // ── せってい（内部の let を getter で渡す。本体は触っていない）──
  weatherOptions, weatherOptionLabel, weatherSelIndex, cityName, CITIES, BODY_COLORS,
  settingsMove, settingsPressA, settingsPressB, setSound, toggleLang,
  get settingsSel(){ return settingsSel; }, set settingsSel(v){ settingsSel = v; },
  get inWeather(){ return inWeather; },     set inWeather(v){ inWeather = v; },
  get inAbout(){ return inAbout; },         set inAbout(v){ inAbout = v; },
  get confirmReset(){ return confirmReset; }, set confirmReset(v){ confirmReset = v; },
  get locPrime(){ return locPrime; },       set locPrime(v){ locPrime = v; },
  get wSel(){ return wSel; },               set wSel(v){ wSel = v; },
  get soundOn(){ return soundOn; },
  get lang(){ return lang; },
  get bodyColorIdx(){ return bodyColorIdx; }, set bodyColorIdx(v){ bodyColorIdx = v; },
  get weatherMode(){ return weatherMode; },
  get cityIdx(){ return cityIdx; },         set cityIdx(v){ cityIdx = v; },

  set inSettings(v){ inSettings = v; }, set inStatus(v){ inStatus = v; },
  set inFeed(v){ inFeed = v; }, set inPlay(v){ inPlay = v; },
  isWeak, isWeakStarve, isWeakSick, WEAK_STARVE_MIN, WEAK_SICK_MIN, plateOnScreen, needsMed, hungerMin, feedGain, feedFill, HUNGER_MAX,
   gaugeHunger, gaugeMood, raiseMood, MOOD_MIN,
  get walkX(){ return walkX; }, set walkX(v){ walkX = v; },
  pushOutOfObjects, freeSegments, objectSpans, POOP_X, POOP_W, PLATE_X,
  codeToWeather, weatherBase, WEATHER_BASE, isBadWeather, CLOUD_N, CLOUD_THIN, RAIN_STYLE, SNOW_STYLE, RAIN_MAX, SNOW_MAX, DEBUG_STATES,
  FLOWER_DAY, FLOWER_SPAN, FLOWERS, flowerCount, FLOWER_SPR,
  pickTopics, warmCands, DIARY_ROUTINE, SND, REACT_SND, lastWritten, warmth, warmLevel, WARM_WINDOW, WARM_KINDS, WARM_LINE, DIARY_LINES, DIARY_MUSINGS, DIARY_CLOSE, DIARY_PRIORITY, DIARY_NOREPEAT_DAYS, DIARY_MUSING_RATE, diaryStyle, buildDiary, pickMusing, S4_SPR, S4_SLEEP, S4_SHUT, S3_SHUT, G_LIE, CLAMP_SLIDE, eyeRows, sickSprite, charSprites, S3_SPR, S3_SLEEP, lie, withRows, BIRD_UP, BIRD_DOWN, BIRD_FAR_UP, BIRD_FAR_DOWN, BIRD_FAR_X, birdSprite, BIRD_FLAP, BIRD_SPEED, BIRD_GAP, SHOOT_CHANCE,
  get weather(){ return weather; }, set weather(v){ weather = v; },
  get weatherFetched(){ return weatherFetched; }, set weatherFetched(v){ weatherFetched = v; },
  sleepConfig, isAsleep, birthPet, ARRIVE_AWAKE_MS, rewindClock, PET_TIMES, sleepKind, stayingUpLate, effectiveAsleep, owlShift,
  CATCHUP_CAP_DAYS, CATCHUP_CAP_MS,
  EGG_B, EGG_SLEEP, MID_A, MID_B, LARVA_A, LARVA_B, LARVA_RAIN, S3_SPR_B, S3_EYES, S4_SPR_B, S4_EYES,
  UFO_SPR, BABY_SPR, INV_SPR, INV_SPR_B,
  CLOUD_A, CLOUD_B, SUN, MOON, CLOUDS, STARS_O,
  POOP_SPR, MEAL_SPR, SNACK_SPR, SPOIL_LUMP, SPOIL_LUMP_S, SPARKLE_DUST,
  ICO_HEART, ICO_ZZZ, ICO_NOTE, ICO_ANGER,
  DIARY_TITLE, DIARY_EMPTY, I18N, MON_EN, CARE_LABELS, BODY_LABELS,
  MENU_BASE, FEED_ITEMS, HUNGER_BASE, FEED_GAIN, CITIES, BODY_COLORS, BODY_SHELLS,
  EAT_FACE, eatKey, eatSprite, squatFrame, EAT_BOB,
  pickForm, pickLineage, pickVoice, voice, voiceIdx, pTrait,
  todayKey, petDay, dayLabel, daysBetweenKeys,
  formLabel, endLabel, typeLabel, stageLabel, menuList, menuCols, MENU_RIGHT,
  bestText, playText, PLAY_ITEMS, PLAY_KEYS, MEM_PAGES,
  APP_VERSION, APP_COPY, APP_WEATHER_CREDIT, LOC_NOTE, SETTINGS_KEYS,
  CARE_ICONS, CARE_ORDER,
  endedShowMemory, MEM_CHAR_BOT, GHOST_MEM_DELAY,
  // ── 画面を描かせる（移植側と突き合わせるため）──
  tickMain, tickMenu, tickNaming, tickMemory, tickDiary,
  get scene(){ return scene; }, set scene(v){ scene = v; },
  get memPage(){ return memPage; }, set memPage(v){ memPage = v; },
  get diaryPage(){ return diaryPage; }, set diaryPage(v){ diaryPage = v; },
  get fM(){ return fM; }, set fM(v){ fM = v; },
  get fN(){ return fN; }, set fN(v){ fN = v; },
  get fG(){ return fG; }, set fG(v){ fG = v; },
  get fR(){ return fR; }, set fR(v){ fR = v; },
  flowerCount, FLOWER_DAY, FLOWER_SPAN, drawFlowers, drawHeadIcons, headIconX, HEAD_ICON_W, HEAD_ICON_GAP, HEAD_IY,
  get weather(){ return weather; }, set weather(v){ weather = v; },
  get timeOfDay(){ return timeOfDay; }, set timeOfDay(v){ timeOfDay = v; },
  get headSel(){ return headSel; }, set headSel(v){ headSel = v; },
  get diaryUnread(){ return diaryUnread; }, set diaryUnread(v){ diaryUnread = v; },
  healthState, statusAlert, isWeakStarve, isWeakSick, poopHasFlies, needsMed,
  WEAK_STARVE_MIN, WEAK_SICK_MIN, headIcons, headIconX, headAlert, headDefault, HEAD_ICON_W,
  DIARY_ICON, STATUS_ICON, GEAR_ICON, HEAD_FONT, HEAD_TEXT_Y, HEAD_IY, HEAD_ICON_H, HEADER_Y, HEAD_ICON_GAP,
  get nameSelActive(){ return nameSelActive; }, set nameSelActive(v){ nameSelActive = v; },
  get headSel(){ return headSel; }, set headSel(v){ headSel = v; },
  get diaryUnread(){ return diaryUnread; }, set diaryUnread(v){ diaryUnread = v; },
  RUN_ON, RUN_OFF, RUN_TIMES, RUN_STILL, RUN_SPEED, RUN_STEP, RUN_AFTER, runawayLen,
  ICO_DOTS, ICO_SKULL, ICO_DROP, ICO_EXCL, centerX, EMO_GAP, EMO_UP, GHOST_STILL, GHOST_RISE_T, GHOST_HOLD, GHOST_Y_TOP,
  stampDust, fadeKeeps, dustDrift, dustLift, dustHash, dustStartP, charSprites, STARS_M, DITHER4,
  GHOST_SWAY_X, GHOST_SWAY_T, GHOST_DUST_X, HEADER_Y, MAIN_GY, GHOST_SPR,
  ARR_PH, ARR_TOTAL, ARR_RAIN_PH, ARR_RAIN_N, ARR_RAIN_STOP, ARR_BEAM_TOP, ARR_APEX, ARR_MAX_HALF, ARR_CX,
  arrivalPhase, arrivalBeamHalf, arrivalRainShown, resetArrivalRain, arrRain, EGG_A, easeOut,
  get arriveT(){ return arriveT; }, set arriveT(v){ arriveT = v; },
  OPEN_OPTS, ARR_TO_NAME, get nameOpenT(){ return nameOpenT; }, set nameOpenT(v){ nameOpenT = v; },
  LANG_OPTS, setLang, OPT_Y0, OPT_H, selMark, T,
  get openStep(){ return openStep; }, set openStep(v){ openStep = v; },
  get langSel(){ return langSel; }, set langSel(v){ langSel = v; },
  get openSel(){ return openSel; }, set openSel(v){ openSel = v; }, cutscenePlaying,
  addM, addP, addA, addD, M_ADJ, P_ADJ, A_ADJ,
  DIARY_LINES, DIARY_MUSINGS, DIARY_CLOSE, DIARY_PRIORITY,
  STORY_JA, STORY_EN, STORY_TITLE, STORY_TOP, STORY_BOT, STORY_PARA, STORY_PAD,
  buildStory, get lang(){ return lang; }, set lang(v){ lang = v; storyPages = null; },
  get diaryLog(){ return diaryLog; },
  buildDiary, diaryBody, addDiary, clearDiary, trimToShown, DIARY_MAX,
  diaryWriting, diaryLevel, diaryStyle, writeRatio,
  LV_NEW, LV_BABY, LV_CHILD, LV_ADULT,
  bodyRows, DBODY_TOP, DBODY_BOT,
  ensureAudio, playClick, playSeq, playSnd, SND, REACT_SND, EAT_T, EAT_STEP, biteFrame, CLEAN_T, AC_RETRY, get ac(){ return ac; }, setSound, get soundOn(){ return soundOn; },
  MED_T, MED_FLY, MED_BLINK, MED_ARC, MED_FROM, MED_PILL, medPos,
  SICK_P, SICK_DIRT_MIN, BOND_CAP, RET_ESTR_DAYS, RET_GRACE_DAYS, RET_NOTOUCH_DAYS,
  STUCK_DAYS, ALLROUND, ALLROUND_SOFT, allRounderSoft, C_FORM_GOOD, C_FORM_SLEEK, C_FORM_BAD, M_FORM_BAD,
  B_PAMPER, PAMPER_DAYS, PAMPER_SNACKS, INV_M_MIN, INV_B_MAX, INV_P_MIN, INV_DAYS, WRATH_HOLD,
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
  // 描いたものを記録する。移植側と画面を突き合わせるために使う。
  //  opts.recordDraw を立てたときだけ溜める（ふだんは何もしない）
  const drawLog = [];
  const rec = (op) => { if(opts.recordDraw) drawLog.push(op); };

  const ctx = new Proxy({}, {
    get(t, p){
      if(p === 'fillRect') return (x, y, w, h) => rec({ op:'rect', x, y, w, h, fill: t.fillStyle });
      if(p === 'fillText') return (s, x, y) => rec({ op:'text', s: String(s), x, y,
        font: t.font, align: t.textAlign || 'left', base: t.textBaseline || 'alphabetic',
        fill: t.fillStyle });
      if(p === 'clearRect') return (x, y, w, h) => rec({ op:'clear', x, y, w, h });
      // 実物の字幅は測れないので、字送りで近似する。Press Start 2P は
      //  正方形なので1文字＝文字の大きさ。日本語のフォントは全角が1文字ぶん、
      //  半角がその半分。ページ割りが均されているかを測るのに使う
      if(p === 'measureText') return (s) => {
        const m = /(\d+(?:\.\d+)?)px/.exec(t.font || '');
        const size = m ? parseFloat(m[1]) : 10;
        const mono = /Press Start/.test(t.font || '');
        let w = 0;
        for(const ch of String(s)) w += size * (mono || ch.charCodeAt(0) >= 0x100 ? 1 : 0.5);
        return { width: w };
      };
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
  const audioLog = [];       // 作られた AudioContext の並び
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
    // 作られた口をぜんぶ控えておく。iOSの割り込み（interrupted）から
    //  ちゃんと立ち直るかを、テストから確かめられるようにするため
    AudioContext: function(){
      const c = { state:'running', currentTime:0, destination:{}, resumed:0, closed:0,
        createOscillator: () => { c.played++; return { connect(){}, start(){}, stop(){},
          frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, type:'' }; },
        createGain: () => ({ connect(){}, gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} } }),
        resume(){ c.resumed++; if(c.state === 'suspended') c.state = 'running'; return Promise.resolve(); },
        close(){ c.closed++; c.state = 'closed'; return Promise.resolve(); } };
      c.played = 0;
      audioLog.push(c);
      return c;
    },
    devicePixelRatio: 1,
  };
  const sandbox = {
    window: win, document, localStorage, navigator: win.navigator,
    location: win.location, screen: win.screen, console,
    setInterval: (fn, ms) => { timers.push({fn, ms}); return timers.length; },
    clearInterval(){}, setTimeout: (fn) => { timers.push({fn, ms:0}); return timers.length; },
    clearTimeout(){}, requestAnimationFrame(){}, cancelAnimationFrame(){},
    fetch: () => Promise.reject(new Error('offline')),
    // Math はサンドボックスごとに持たせる。グローバルをそのまま渡すと、
    //  テストが Math.random を差し替えたとき その後の全テストに漏れる
    Math: Object.create(Math), JSON, Date: opts.Date || Date, Set, Map, Object, Array, String, Number,
    Boolean, Error, Promise, isNaN, isFinite, parseInt, parseFloat, Uint8ClampedArray,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  Object.assign(win, { localStorage, document });
  return { sandbox, store, timers, audioLog, drawLog };
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
  const { sandbox, store, timers, audioLog, drawLog } =
    makeSandbox({ storage: opts.storage, Date: clock.Date, recordDraw: opts.recordDraw });
  vm.createContext(sandbox);
  vm.runInContext(mainScript(), sandbox, { filename: 'invader_game.html' });
  const api = sandbox.__api;
  if(!api) throw new Error('内部の取り出しに失敗');
  return { api, clock, store, timers, sandbox, audioLog, drawLog };
}

module.exports = { load, mainScript };
