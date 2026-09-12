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
  update, movePlayer, startGame, startBossIntro, startBoss, endBoss, resumeWalk,
  pickBossPat, hitsObstacle, hitsBoss, spawnObstacle, findSafeY, leavesSafeGap,
  get lastGapCenter(){ return lastGapCenter; }, set lastGapCenter(v){ lastGapCenter = v; },
  draw, drawField, drawHud, drawPlayer, arrow, arrowRow,
  get warpFx(){ return warpFx; }, set warpFx(v){ warpFx = v; },
  get warpFromY(){ return warpFromY; }, set warpFromY(v){ warpFromY = v; },
  get introTimer(){ return introTimer; }, set introTimer(v){ introTimer = v; },
  get clearTimer(){ return clearTimer; }, set clearTimer(v){ clearTimer = v; },
`,
  shootingstar: `
  GY, HDR_Y, STAR, STAR_W, STAR_H, METEOR, MET_W, MET_H, MET_FIRST, MET_EVERY,
  GEM_A, GEM_B, GEM_W, GEM_H, GEM_FIRST, GEM_EVERY, GEM_VY, DBL_SEC,
  PLY_MIN, PLY_MAX, CY, GUN_X_OFF, SPAWN_RATE_MAX, SIDE_Y_MIN, SIDE_Y_MAX, TOP_MARGIN,
  level, spawnRate, spawnBurst, spawnGap, fireGap, fire, spawnStar,
  update, draw, startGame,
  get plyX(){ return plyX; }, set plyX(v){ plyX = v; },
  get stars(){ return stars; }, set stars(v){ stars = v; },
  get beams(){ return beams; }, set beams(v){ beams = v; },
  get flashes(){ return flashes; }, set flashes(v){ flashes = v; },
  get meteor(){ return meteor; }, set meteor(v){ meteor = v; },
  get metNext(){ return metNext; }, set metNext(v){ metNext = v; },
  get gem(){ return gem; }, set gem(v){ gem = v; },
  get gemNext(){ return gemNext; }, set gemNext(v){ gemNext = v; },
  get dblT(){ return dblT; }, set dblT(v){ dblT = v; },
  get dblSide(){ return dblSide; }, set dblSide(v){ dblSide = v; },
  get spawnTimer(){ return spawnTimer; }, set spawnTimer(v){ spawnTimer = v; },
  get fireTimer(){ return fireTimer; }, set fireTimer(v){ fireTimer = v; },
`,
  abduction: `
  GY, GROUND_Y, UFO, UFO_W, UFO_H, UFO_HIGH, PLY_MIN, PLY_MAX, GRAV, JUMP_V,
  DIVE_START, CHARGE_START, MAX_DIVE_STREAK, BEAM_VARY_START, BEAM_HALF_MIN,
  SCORE_PER_SEC, PENALTY_HIT, CAUGHT_DUR, UFO_TURN_P, DBL_MS, DASH_FR, DASH_SPD,
  curDiff, rollUfoLeg, ufoWander, rollBeamHalf, beamEdge, ufoCenter, endCharge,
  checkBeamHit, checkUfoHit, update, draw, startGame, jump, tapDir,
  get plyX(){ return plyX; }, set plyX(v){ plyX = v; },
  get plyY(){ return plyY; }, set plyY(v){ plyY = v; },
  get vy(){ return vy; }, set vy(v){ vy = v; },
  get jumping(){ return jumping; }, set jumping(v){ jumping = v; },
  get ufoX(){ return ufoX; }, set ufoX(v){ ufoX = v; },
  get ufoY(){ return ufoY; }, set ufoY(v){ ufoY = v; },
  get ufoDir(){ return ufoDir; }, set ufoDir(v){ ufoDir = v; },
  get ufoYtarget(){ return ufoYtarget; }, set ufoYtarget(v){ ufoYtarget = v; },
  get ufoTurnCD(){ return ufoTurnCD; }, set ufoTurnCD(v){ ufoTurnCD = v; },
  get ufoSpdMul(){ return ufoSpdMul; }, set ufoSpdMul(v){ ufoSpdMul = v; },
  get mode(){ return mode; }, set mode(v){ mode = v; },
  get modeTimer(){ return modeTimer; }, set modeTimer(v){ modeTimer = v; },
  get beamX(){ return beamX; }, set beamX(v){ beamX = v; },
  get beamHalfNow(){ return beamHalfNow; }, set beamHalfNow(v){ beamHalfNow = v; },
  get chargeDir(){ return chargeDir; }, set chargeDir(v){ chargeDir = v; },
  get chargeCD(){ return chargeCD; }, set chargeCD(v){ chargeCD = v; },
  get diveStreak(){ return diveStreak; }, set diveStreak(v){ diveStreak = v; },
  get forceBeamNext(){ return forceBeamNext; }, set forceBeamNext(v){ forceBeamNext = v; },
  get graceFrames(){ return graceFrames; }, set graceFrames(v){ graceFrames = v; },
  get caughtTimer(){ return caughtTimer; }, set caughtTimer(v){ caughtTimer = v; },
  get caughtX(){ return caughtX; }, set caughtX(v){ caughtX = v; },
  get hitCount(){ return hitCount; }, set hitCount(v){ hitCount = v; },
  get hitCooldown(){ return hitCooldown; }, set hitCooldown(v){ hitCooldown = v; },
  get dashT(){ return dashT; }, set dashT(v){ dashT = v; },
  get dashDir(){ return dashDir; }, set dashDir(v){ dashDir = v; },
  get dashGhost(){ return dashGhost; }, set dashGhost(v){ dashGhost = v; },
`,
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
