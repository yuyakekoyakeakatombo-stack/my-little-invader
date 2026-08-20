// ══════════════════════════════════════════════════════════════
//  ミニゲーム3本の回帰テスト。node tools/mg-test.js で走る。
//
//  これまでミニゲームはソースの文字列検査（score-= が無いか等）だけで
//  守られていた。全体の1/4にあたる2,690行が、当たり判定も得点計算も
//  ゲームオーバー条件も誰も見張っていない状態だった。しかもミニゲームの
//  得点は最終形態の条件そのものなので、ここが壊れると進化が壊れる。
//
//  update() を手で回して、実際に遊んだときの動きを確かめる。
// ══════════════════════════════════════════════════════════════
const { load, FILES } = require('./mg-harness');

let pass = 0, fail = 0, group = '';
const fails = [];
function describe(name, fn){ group = name; fn(); }
function it(name, fn){
  try { fn(); pass++; }
  catch(e){ fail++; fails.push(`  ${group} › ${name}\n    ${e.message}`); }
}
function eq(actual, expected, msg){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if(a !== b) throw new Error(`${msg||''} 期待 ${b} / 実際 ${a}`);
}
function ok(v, msg){ if(!v) throw new Error(msg || '真であるべき'); }

// 乱数を固定して回す（スポーンや行動パターンの当たり外れで結果が揺れないように）
function seeded(api, sandbox, seq){
  let i = 0;
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = () => seq[(i++) % seq.length];
}
const GAMES = ['spacewalk', 'shootingstar', 'abduction'];
const残機 = api => (api.lives !== undefined ? api.lives : null);

// ══ 3本に共通のきまり ════════════════════════════════════════
describe('ミニゲーム共通', () => {
  it('3本とも読み込めて、遊べる状態になる', () => {
    for(const g of GAMES){
      const { api } = load(g);
      eq(api.state, api.STATE.TITLE, g + ' は最初タイトル:');
      api.startGame();
      eq(api.state, api.STATE.PLAY, g + ' は開始でプレイ中になる:');
      eq(api.score, 0, g + ' の得点は0から:');
    }
  });
  it('得点は遊んでいるあいだ一度も負にならない', () => {
    for(const g of GAMES){
      const { api } = load(g);
      api.startGame();
      let min = 0;
      for(let f=0; f<600; f++){          // 30秒ぶん
        api.update();
        if(api.score < min) min = api.score;
      }
      eq(min, 0, g + ' で負の得点が出た:');
    }
  });
  it('得点はゲームオーバーになるまで下がらない（時間で伸びる）', () => {
    for(const g of ['spacewalk', 'abduction']){   // 時間で伸びる2本
      const { api } = load(g);
      api.startGame();
      const seen = [];
      for(let f=0; f<400 && api.state === api.STATE.PLAY; f++){ api.update(); seen.push(api.score); }
      ok(seen.length > 20, g + ': 20フレームは持つこと');
      ok(seen[seen.length-1] >= seen[0], g + ': 得点が伸びること');
    }
  });
  it('結果は遊び終わるまで保存されない', () => {
    for(const g of GAMES){
      const { api, store } = load(g);
      api.startGame();
      api.step(40);
      eq(store.myvader_result, undefined, g + ': 途中で保存してはいけない:');
    }
  });
  it('遊び終わると、そのゲームの名前と得点が保存される', () => {
    for(const g of GAMES){
      const { api, store } = load(g);
      api.startGame();
      api.score = 1234;
      api.reportScore();
      const r = JSON.parse(store.myvader_result);
      eq(r.game, g, g + ': ゲーム名:');
      eq(r.score, 1234, g + ': 得点:');
      ok(typeof r.at === 'number' && r.at > 0, g + ': 時刻が入ること');
    }
  });
  it('保存される得点は0未満にならない（内部が負でも0で止める）', () => {
    for(const g of GAMES){
      const { api, store } = load(g);
      api.startGame();
      api.score = -500;                 // ありえない値を無理に入れて確かめる
      api.reportScore();
      eq(JSON.parse(store.myvader_result).score, 0, g + ': 0で止まること:');
    }
  });
  it('4桁を超える得点も、そのまま保存される（表示だけの都合で削らない）', () => {
    for(const g of GAMES){
      const { api, store } = load(g);
      api.startGame();
      api.score = 12345;
      api.reportScore();
      eq(JSON.parse(store.myvader_result).score, 12345, g + ':');
    }
  });
});

// ══ スペースウォーク ══════════════════════════════════════════
describe('スペースウォーク', () => {
  const g = 'spacewalk';
  it('自機はどれだけ動かしても画面の外へ出ない', () => {
    const { api } = load(g);
    api.startGame();
    for(const dir of ['left','right','up','down']){
      api.startGame();
      Object.keys(api.keys).forEach(k => api.keys[k] = false);
      api.keys[dir] = true;
      for(let f=0; f<200; f++){
        api.movePlayer();
        ok(api.plyX >= api.PLY_MIN_X && api.plyX <= api.PLY_MAX_X,
           `${dir}: x が範囲外（${api.plyX}）`);
        ok(api.plyY >= api.PLY_MIN_Y && api.plyY <= api.PLY_MAX_Y,
           `${dir}: y が範囲外（${api.plyY}）`);
      }
    }
  });
  it('障害物に重なると当たりと判定される', () => {
    const { api } = load(g);
    api.startGame();
    api.objs = [];
    ok(!api.hitsObstacle(), '障害物が無ければ当たらない');
    api.objs = [{ si:0, x: Math.round(api.plyX), y: Math.round(api.plyY) }];   // 自機に重ねる
    ok(api.hitsObstacle(), '重なれば当たる');
  });
  it('離れた障害物には当たらない', () => {
    const { api } = load(g);
    api.startGame();
    api.objs = [{ si:0, x: api.W - 1, y: api.GTOP }];
    ok(!api.hitsObstacle());
  });
  it('残機が尽きるとゲームオーバーになり、結果が保存される', () => {
    const { api, store } = load(g);
    api.startGame();
    for(let i=0; i<api.MISS_MAX; i++) api.loseLife();
    eq(api.lives, 0);
    eq(api.state, api.STATE.GAMEOVER);
    ok(store.myvader_result, '結果が保存されること');
  });
  it('残機は0より下がらない見た目になる（尽きたらそこで終わる）', () => {
    const { api } = load(g);
    api.startGame();
    for(let i=0; i<api.MISS_MAX; i++) api.loseLife();
    const before = api.lives;
    api.update();                        // ゲームオーバー後に回しても減らない
    eq(api.lives, before);
  });
  // ワープは「いまより安全な高さがある」ときだけ効く。ふさがれた状況を作って試す
  const blockAround = api => {
    api.objs = [];
    for(let dy = -2; dy <= 2; dy++)
      api.objs.push({ si:0, x: Math.round(api.plyX) + 12, y: Math.round(api.plyY) + dy });
  };
  it('ワープを使うと残りが1つ減る', () => {
    const { api } = load(g);
    api.startGame();
    eq(api.warpLeft, api.WARP_MAX, '最初は満タン:');
    blockAround(api);
    api.doWarp();
    eq(api.warpLeft, api.WARP_MAX - 1, '1減ること:');
  });
  it('ワープの残りは0より下がらない', () => {
    const { api } = load(g);
    api.startGame();
    api.warpLeft = 0;
    for(let i=0; i<10; i++){ blockAround(api); api.doWarp(); }
    eq(api.warpLeft, 0, '負にならないこと:');
  });
  it('遊んでいないあいだはワープを使えない', () => {
    const { api } = load(g);
    api.startGame();
    blockAround(api);
    api.state = api.STATE.GAMEOVER;
    api.doWarp();
    eq(api.warpLeft, api.WARP_MAX, '減らないこと:');
  });
  it('難しさはステージで上がるが、上限で頭打ちになる', () => {
    const { api } = load(g);
    api.startGame();
    const at = st => { api.stage = st; return api.diff(); };
    const d0 = at(0), d5 = at(5), d99 = at(99);
    ok(d5.scrollSpeed > d0.scrollSpeed, '速くなること');
    ok(d5.spawnGap < d0.spawnGap, '間隔が詰まること');
    eq(d99.scrollSpeed, at(50).scrollSpeed, '速さが頭打ちになる:');
    eq(d99.spawnGap, at(50).spawnGap, '間隔が頭打ちになる:');
    ok(d99.spawnGap > 0, '間隔が0以下にならないこと');
  });
  it('しばらく遊ぶとボスが出る', () => {
    const { api } = load(g);
    api.startGame();
    let sawBoss = false;
    for(let f=0; f<api.BOSS_INTERVAL*api.FPS + 200; f++){
      api.lives = api.MISS_MAX;          // ここではボスが出るかだけを見る
      api.update();
      if(api.state === api.STATE.BOSS_INTRO || api.state === api.STATE.BOSS){ sawBoss = true; break; }
    }
    ok(sawBoss, `${api.BOSS_INTERVAL}秒でボスが出るはず`);
  });
});

// ══ シューティングスター ══════════════════════════════════════
describe('シューティングスター', () => {
  const g = 'shootingstar';
  // 画面そのものと比べる。定数（PLY_MIN/PLY_MAX）と比べると、
  //  定数を壊したときに期待値も一緒に動いてしまい、テストが素通りする
  it('自機は左右の端を越えない', () => {
    const { api } = load(g);
    for(const dir of ['left','right']){
      api.startGame();
      Object.keys(api.keys).forEach(k => api.keys[k] = false);
      api.keys[dir] = true;
      for(let f=0; f<300; f++){
        api.update();
        if(api.state !== api.STATE.PLAY) api.startGame();
        ok(api.plyX >= 0 && api.plyX <= api.W - api.CH_W, `${dir}: x=${api.plyX} が画面の外`);
      }
    }
  });
  // 星の出方は spawnStar() を直に叩いて数多く見る。update() 任せだと
  //  スポーンの間隔ぶんしか集まらず、たまにしか出ない形を取りこぼす
  const sample = (api, n = 3000) => {
    const out = [];
    for(let i=0;i<n;i++){ api.stars = []; api.spawnStar(); out.push(api.stars[0]); }
    return out;
  };
  // 画面中央より下から浅い角度で入る星は撃てないので、出さないよう直した経緯がある
  it('横から入る星は、画面中央より下から出てこない', () => {
    const { api } = load(g);
    api.startGame();
    const side = sample(api).filter(s => s.x < 0 || s.x > api.W - api.STAR_W);
    ok(side.length > 100, '横入りの星が集まること');
    const lowest = Math.max(...side.map(s => s.y + api.STAR_H));
    ok(lowest <= Math.floor(api.H/2) + 1, `横入りの星が下すぎる（下端 y=${lowest}）`);
  });
  it('上から落ちる星は、画面の端ぎりぎりから出てこない', () => {
    const { api } = load(g);
    api.startGame();
    const top = sample(api).filter(s => s.y < 0);
    ok(top.length > 100, '上から落ちる星が集まること');
    const left = Math.min(...top.map(s => s.x));
    const right = Math.max(...top.map(s => s.x + api.STAR_W));
    ok(left >= 1, `左端すぎる星がある（x=${left}）`);
    ok(right <= api.W - 1, `右端すぎる星がある（右端=${right}）`);
  });
  it('星は必ず画面の内側へ向かって動く（外へ逃げない）', () => {
    const { api } = load(g);
    api.startGame();
    for(const s of sample(api)){
      ok(s.vy > 0, `下へ流れないと撃てない（vy=${s.vy}）`);
      if(s.x < 0)                  ok(s.vx > 0, `左外から出た星が左へ向かう（vx=${s.vx}）`);
      if(s.x > api.W - api.STAR_W) ok(s.vx < 0, `右外から出た星が右へ向かう（vx=${s.vx}）`);
    }
  });
  it('隕石は序盤には出てこない', () => {
    const { api } = load(g);
    api.startGame();
    for(let f=0; f < (api.MET_FIRST - 1) * api.FPS; f++){
      api.lives = api.MISS_MAX;                 // ここでは出る時刻だけを見る
      api.update();
      ok(!api.meteor, `${Math.floor(f/api.FPS)}秒で隕石が出た`);
    }
  });
  it('時間がたてば隕石が出る', () => {
    const { api } = load(g);
    api.startGame();
    let saw = false;
    for(let f=0; f < (api.MET_FIRST + 30) * api.FPS && !saw; f++){
      api.lives = api.MISS_MAX;
      api.update();
      if(api.meteor) saw = true;
    }
    ok(saw, `${api.MET_FIRST}秒すぎても隕石が出ない`);
  });
  // 残機の数そのものを見る。api.MISS_MAX と比べると、定数を壊しても素通りする
  it('残機を使い切ると終わる', () => {
    const { api, store } = load(g);
    api.startGame();
    ok(api.lives >= 1 && api.lives <= 10, `残機が現実的な数であること（${api.lives}）`);
    for(let f=0; f<8000 && api.state === api.STATE.PLAY; f++) api.update();
    eq(api.state, api.STATE.GAMEOVER, '避けずにいれば終わること:');
    eq(api.lives, 0, '残機が0になって終わること:');
    ok(store.myvader_result, '結果が保存されること');
  });
});

// ══ アブダクション ════════════════════════════════════════════
describe('アブダクション', () => {
  const g = 'abduction';
  it('自機は左右の端を越えない', () => {
    const { api } = load(g);
    for(const dir of ['left','right']){
      api.startGame();
      Object.keys(api.keys).forEach(k => api.keys[k] = false);
      api.keys[dir] = true;
      for(let f=0; f<200; f++){
        api.update();
        if(api.state !== api.STATE.PLAY) api.startGame();
        ok(api.plyX >= 0 && api.plyX <= api.W - api.CH_W, `${dir}: x=${api.plyX} が範囲外`);
      }
    }
  });
  it('得点は「生きた秒数×点」から「当たった回数×罰点」を引いた値で、0止まり', () => {
    const { api } = load(g);
    api.startGame();
    api.step(10);
    const t = Math.floor(api.elapsed / api.FPS * api.SCORE_PER_SEC);
    eq(api.score, Math.max(0, t - api.hitCount * api.PENALTY_HIT), '式どおりであること:');
    // 罰点だけが大きくても0で止まる
    api.hitCount = 999;
    api.update();
    eq(api.score, 0, '0で止まること:');
  });
  it('ビームの中に立っていれば当たり、外に出れば当たらない', () => {
    const { api } = load(g);
    api.startGame();
    api.mode = 'beam'; api.modeTimer = 10;
    api.ufoY = api.GROUND_Y - 20;
    api.beamX = Math.round(api.plyX) + Math.floor(api.CH_W/2);   // 自機の真上
    ok(api.checkBeamHit(), 'ビームの真下なら当たること');
    api.beamX = api.plyX < api.W/2 ? api.W - 1 : 0;              // 遠くへずらす
    ok(!api.checkBeamHit(), '離れれば当たらないこと');
  });
  it('ビームが出ていなければ当たらない', () => {
    const { api } = load(g);
    api.startGame();
    api.mode = 'safe';
    api.beamX = Math.round(api.plyX) + Math.floor(api.CH_W/2);
    ok(!api.checkBeamHit());
  });
  it('UFOに重なれば衝突と判定される', () => {
    const { api } = load(g);
    api.startGame();
    api.ufoX = api.W; api.ufoY = 0;
    ok(!api.checkUfoHit(), '離れていれば当たらない');
    api.ufoX = api.plyX - 1; api.ufoY = api.plyY;
    ok(api.checkUfoHit(), '重なれば当たる');
  });
  it('降下と体当たりは、決めた秒数まで出てこない', () => {
    const { api } = load(g);
    api.startGame();
    const at = sec => { api.elapsed = sec * api.FPS; return api.curDiff(); };
    eq(at(api.DIVE_START - 1).diveChance, 0, '降下は序盤ゼロ:');
    ok(at(api.DIVE_START + 10).diveChance > 0, 'あとから出ること');
    eq(at(api.CHARGE_START - 1).canCharge, false, '体当たりは序盤なし:');
    eq(at(api.CHARGE_START + 1).canCharge, true, 'あとから出ること:');
  });
  it('難しさは上がり続けず、どこかで頭打ちになる', () => {
    const { api } = load(g);
    api.startGame();
    const at = sec => { api.elapsed = sec * api.FPS; return api.curDiff(); };
    const mid = at(60), late = at(600);
    eq(late.ufoSpeed, mid.ufoSpeed <= late.ufoSpeed ? late.ufoSpeed : mid.ufoSpeed);
    ok(late.ufoSpeed <= 1.6, `UFOの速さが上限を超えた（${late.ufoSpeed}）`);
    ok(late.safeDur >= 8, `安全時間が短くなりすぎた（${late.safeDur}）`);
    ok(late.diveChance <= 0.35, `降下が多すぎる（${late.diveChance}）`);
    ok(late.beamHalf <= 7, `ビームが太すぎる（${late.beamHalf}）`);
  });
  it('つかまるとゲームオーバーになり、結果が保存される', () => {
    const { api, store } = load(g);
    api.startGame();
    for(let f=0; f<3000 && api.state !== api.STATE.GAMEOVER; f++) api.update();
    eq(api.state, api.STATE.GAMEOVER, '動かずにいれば必ずつかまること:');
    ok(store.myvader_result, '結果が保存されること');
    ok(JSON.parse(store.myvader_result).score >= 0, '得点が0以上であること');
  });
});

// ══ 結果 ══════════════════════════════════════════════════
console.log('');
if(fails.length){ console.log(fails.join('\n')); console.log(''); }
console.log(`${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
