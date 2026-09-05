// ══════════════════════════════════════════════════════════════
//  回帰テスト。node tools/test.js で走る。
//
//  ねらいは「動くけれど間違っている」を捕まえること。目視では気づけなかった
//  たぐいのバグ（薄いアイコンが効いてしまう／得点が内部で負に沈む／
//  リセットで演出が飛ぶ）を、二度と素通りさせないための網。
// ══════════════════════════════════════════════════════════════
const { load } = require('./harness');

let pass = 0, fail = 0, group = '';
const fails = [];
function describe(name, fn){ group = name; fn(); }
function it(name, fn){
  try { fn(); pass++; }
  catch(e){ fail++; fails.push(`  ${group} › ${name}\n    ${e.message}`); }
}
function eq(actual, expected, msg){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if(a === b) return;
  // オブジェクト同士なら、食い違ったキーだけを出す。丸ごと並べても読めないため
  if(actual && expected && typeof actual === 'object' && typeof expected === 'object'
     && !Array.isArray(actual)){
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const diff = [];
    for(const k of keys){
      const x = JSON.stringify(expected[k]), y = JSON.stringify(actual[k]);
      if(x !== y) diff.push(`${k}: 期待 ${x} / 実際 ${y}`);
    }
    throw new Error(`${msg||''} ${diff.join(' , ')}`);
  }
  throw new Error(`${msg||''} 期待 ${b} / 実際 ${a}`);
}
function ok(v, msg){ if(!v) throw new Error(msg || '真であるべき'); }

// テスト用の子を作る。既定は「起きている昼間の、健康な幼体」。
//  時刻はサンドボックス側の時計（clock）で作ること。テストファイル側の Date.now() は
//  実時刻なので、そのまま入れるとゲーム内の「いま」とずれて判定が狂う
function pet(api, clock, over = {}){
  const now = clock.now();
  const tk = api.todayKey();
  Object.assign(api.pet, {
    name:'TEST', stage:'larva', lineage:'', form:'', formWild:false, voice:'',
    hunger:4, mood:4, health:'GOOD', dead:'', gone:false, goneBy:'',
    ufoFlag:false, departFlag:false, invadeFlag:false, homeFlag:false, homeRedeem:false, endGrace:0,
    B:50, C:50, D:50, Dm:50, P:0, M:0, A:0, EP:2, W:0, incubAt:0, poopSince:0,
    best:{sw:0,ss:0,ab:0}, plays:{sw:0,ss:0,ab:0}, diary:{},
    diaryDay:tk, diaryDue:null, diaryMark:null, calDay:tk,
    careStreak:0, dayKey:'', bGainToday:0, bGainKinds:{},
    touchCount:0, touchKinds:{}, touchedToday:false,
    larvaAt: now - 5*86400000, snapL:{praise:0,bad:0,plays:0},
    lastTick: now, birth: now - 8*86400000,
    starveAcc:0, hungerAcc:0, moodAcc:0, sickAcc:0, sickCount:0,
    estrangedDays:0, lowBDays:0, wrathDays:0, noTouchDays:0,
    nightPlayToday:false, nightCareToday:false, nightCareAt:0,
    mealCount:0, snackCount:0, overAcc:0, praiseCount:0, scoldBadCount:0,
    plateAt:0, plateKind:'meal', plateSpoiled:false, tantrumAt:0, tantrumType:'',
    wokeUntil: now + 7200000, rhythmUntil:0, fullFeeds:0, nightPlays:0, finalAt:0,
  }, over);
  return api.pet;
}
// 1日ぶんを締める。care=きちんと世話をした日か
function day(api, care, extra = {}){
  const d = Object.assign({}, extra);
  let touches = 0;
  if(care){ touches = 2; } else { d.hungry = 1; }
  api.pet.dayKey = '';                     // 新しい日として上限を戻す
  if(care){ api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack'); }
  api.closeOneDay(d, touches, false);
}

// ══ なかよし ══════════════════════════════════════════════
describe('なかよし', () => {
  it('まとめて世話をしても、連続0日ならその日は+1で頭打ち', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:0, B:50 });
    api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack'); api.gainB(1,'feed');
    eq(api.pet.B, 51);
  });
  it('連続4日つづけば、その日は+3まで入る', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:50 });
    api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack');
    eq(api.pet.B, 53);
  });
  it('同じ世話を繰り返しても1回ぶんしか効かない', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:50 });
    for(let i=0;i<5;i++) api.gainB(1,'praise');
    eq(api.pet.B, 51);
  });
  it('上限をはみ出さない（以前は最後の1回が超えていた）', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:50 });
    api.gainB(2,'play'); api.gainB(2,'x'); api.gainB(2,'y');
    eq(api.pet.B, 53, '上限3で止まる:');
  });
  it('100を超えない／0を下回らない', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:99 });
    api.gainB(2,'play'); eq(api.pet.B, 100);
    pet(api, clock, { B:2, careStreak:0 });
    api.closeOneDay({hungry:1}, 0, false);
    ok(api.pet.B >= 0, '0未満にならない');
  });
  it('毎日こまめに世話をすると積み上がる', () => {
    const { api, clock } = load();
    pet(api, clock, { B:35, careStreak:2 });
    for(let i=0;i<14;i++) day(api, true);
    ok(api.pet.B >= 70, `14日で70以上になるはず（実際 ${api.pet.B}）`);
  });
  it('2日放置→まとめて世話 を繰り返すと下がっていく', () => {
    const { api, clock } = load();
    pet(api, clock, { B:35, careStreak:2 });
    for(let i=1;i<=12;i++) day(api, i % 3 === 0);
    ok(api.pet.B < 20, `下がるはず（実際 ${api.pet.B}）`);
  });
  //  目盛は round(B/10) 本なので、B40 は「4本の帯（35〜44）」の真ん中。
  //  帯の下端(35)から始めると、1本動かすのに10ポイント要り、最初の数日 手応えが無い
  it('なかよしの初期値は、目盛の帯の真ん中から始まる', () => {
    const { api } = load();
    const B = api.defaultPet ? api.defaultPet().B : null;
    ok(B != null, '初期値が読めない');
    const bar = Math.round(B / 10);                 // ステータス画面と同じ出し方
    const low = bar * 10 - 5, high = bar * 10 + 4;  // その目盛が占める帯
    const mid = (low + high) / 2;
    ok(Math.abs(B - mid) <= 1,
       `初期値 ${B} が ${bar}本の帯（${low}〜${high}）の端に寄っている（真ん中は ${mid}）`);
  });
  //  ごはんは ふれあいに数える。数えないと、毎日ごはんと そうじをしている人が
  //  「ふれあい1種類」と見なされて -2 され、下がり続ける（実際にそうなっていた）
  it('ごはんは ふれあいに数える', () => {
    const { api, clock, sandbox } = load();
    pet(api, clock);
    api.pet.hunger = 2;
    sandbox.Math.random = () => 0.99;       // わがままで拒否されると、ごはんが届かない
    api.doCare('FEED');
    ok(api.pet.touchKinds && api.pet.touchKinds.feed, 'ごはんが ふれあいに数えられていない');
  });
  it('ごはんと そうじだけの日は、なかよしが減らない', () => {
    const { api, clock } = load();
    pet(api, clock, { B:40, careStreak:0 });
    const before = api.pet.B;
    api.closeOneDay({}, 2, false);          // ごはん＋そうじ＝2種類
    ok(api.pet.B >= before, `減っている（${before} → ${api.pet.B}）`);
  });
  //  ただし ごはんでは点も入らない。入れてしまうと、ほめも遊びもしない人が
  //  旅立ちの線(60)に届き、「なかよしは ふれあいで育つ」という軸が消える
  it('ごはんだけでは なかよしの点は入らない', () => {
    const { api, clock, sandbox } = load();
    pet(api, clock, { B:40, careStreak:4 });
    const before = api.pet.B;
    api.pet.hunger = 0;                     // いちばん点が入りそうな状況
    sandbox.Math.random = () => 0.99;
    api.doCare('FEED');
    eq(api.pet.B, before, 'ごはんで なかよしが増えている:');
  });
  it('ごはんと そうじだけを続けても、旅立ちの線には届かない', () => {
    const { api, clock } = load();
    pet(api, clock, { B:40, careStreak:0 });
    for(let i=0;i<40;i++) api.closeOneDay({}, 2, false);   // 40日ぶん、毎日2種類
    ok(api.pet.B < 60, `ふれあい無しで旅立ちの線に届く（${api.pet.B}）`);
  });
});

// ══ ふれあいの数え方 ══════════════════════════════════════
describe('ふれあい', () => {
  it('同じ種類は何回でも1回ぶん', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.markTouch('praise'); api.markTouch('praise'); api.markTouch('praise');
    eq(api.pet.touchCount, 1);
  });
  it('種類が違えば数が増える', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.markTouch('praise'); api.markTouch('play'); api.markTouch('snack');
    eq(api.pet.touchCount, 3);
  });
  it('種類なし（そうじ・くすり）は来訪だけ記録して数には入らない', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.markTouch();
    eq(api.pet.touchCount, 0);
    eq(api.pet.touchedToday, true);
  });
});

// ══ 病気とその日の扱い ════════════════════════════════════
// ══ ねているあいだの くすり ══════════════════════════════
//   起こさないと飲ませられないと、しかって起こす（＝睡眠妨害）しか
//   手が無くなる。具合が悪いのに 罰を受ける形になってしまう
describe('ねているあいだの くすり', () => {
  const night = new Date(2026, 5, 15, 2, 0, 0).getTime();
  const at = (o, when) => {
    const { api, clock } = load({ at: when || night });
    const t0 = clock.now();
    Object.assign(api.pet, api.defaultPet(), { name:'A', stage:'larva', birth:t0-5*86400000,
      lastTick:t0, EP:2, B:40, hunger:3, mood:3, ...o });
    return api;
  };
  it('げんきな子が寝ているときは、これまでどおり押せない', () => {
    const api = at({});
    ok(api.effectiveAsleep(), 'ねている状態のはず');
    ok(!api.needsMed(), 'くすりが要らない状態のはず');
    ok(api.careDisabled('MED'), 'げんきな子にも 寝ているあいだ 飲ませられてしまう');
  });
  it('病気の子は、寝ていても飲ませられる', () => {
    const api = at({ health:'SICK' });
    ok(api.effectiveAsleep(), 'ねている状態のはず');
    ok(!api.careDisabled('MED'), '寝ていると 飲ませられない');
    api.doCare('MED');
    eq(api.pet.health, 'GOOD', 'くすりのあとの けんこう:');
  });
  it('やまいの芽があるときも、寝ていて飲ませられる', () => {
    const api = at({ incubAt: night - 3600000 });
    ok(!api.careDisabled('MED'), '寝ていると 飲ませられない');
    api.doCare('MED');
    ok(!api.pet.incubAt, 'やまいの芽を摘めていない');
  });
  //  起こしてしまうと、しかって起こしたのと同じことになる
  it('寝ている子に飲ませても、起こさないし きげんも下げない', () => {
    const api = at({ health:'SICK', mood:3 });
    const before = { mood: api.pet.mood, scold: api.pet.scoldBadCount || 0 };
    api.doCare('MED');
    ok(api.effectiveAsleep(), 'くすりで 起こしてしまっている');
    eq(api.pet.mood, before.mood, 'くすりのあとの きげん:');
    eq(api.pet.scoldBadCount || 0, before.scold, 'しかるの失敗に数えられている:');
  });
  //  満腹とわがままが重なった日。どちらも「食べない」で終わるが、拒否の仕草を出すと
  //  しかって直したのに やはり食べない、という分かりにくい流れになる。
  //  満腹の無反応を先に見せて、原因が読めるようにする
  it('満腹＋わがまま中は、満腹の無反応が優先される', () => {
    const { api, clock, sandbox } = load();
    pet(api, clock, { P:0 });                       // 性格ふつう（満腹なら食べない）
    api.pet.hunger = api.HUNGER_MAX;
    api.pet.tantrumAt = clock.now();
    api.pet.plateAt = 0;
    sandbox.Math.random = () => 0.99;
    api.doCare('FEED');
    ok(api.reactType !== 'refuse', `満腹なのに拒否の仕草が出ている（${api.reactType}）`);
    ok(api.pet.plateAt, '皿が残らない');
  });
  it('空腹＋わがまま中は、これまで通り拒む', () => {
    const { api, clock, sandbox } = load();
    pet(api, clock, { P:0 });
    api.pet.hunger = 1;
    api.pet.tantrumAt = clock.now();
    api.pet.plateAt = 0;
    sandbox.Math.random = () => 0.99;
    api.doCare('FEED');
    eq(api.reactType, 'refuse', '空腹のわがままの反応:');
  });
  //  おっとりは満腹でも食べてしまう。満腹を先に見る変更で、ここまで
  //  食べなくなってしまうと、食べ過ぎ→病気 という筋道が消える
  it('おっとりは、満腹でも食べてしまう', () => {
    const { api, clock, sandbox } = load();
    pet(api, clock, { P:-100 });                    // おっとり
    api.pet.hunger = api.HUNGER_MAX;
    api.pet.tantrumAt = 0;
    api.pet.plateAt = 0;
    const before = api.pet.overAcc || 0;
    sandbox.Math.random = () => 0.99;
    api.doCare('FEED');
    ok((api.pet.overAcc || 0) > before, 'おっとりが満腹で食べていない');
    eq(api.reactType, 'eat', 'おっとりが満腹で食べたときの反応:');
  });
  //  満腹の子にごはんを出しても、わがままの抽選を引かない。
  //  引いていた頃は、食べない子に出すだけで わがままを増やせてしまった
  it('満腹の子にごはんを出しても、わがままを誘発しない', () => {
    const { api, clock, sandbox } = load();
    pet(api, clock, { P:0 });
    api.pet.hunger = api.HUNGER_MAX;
    api.pet.tantrumAt = 0;
    api.pet.plateAt = 0;
    sandbox.Math.random = () => 0;                  // かならず わがままになる目
    api.doCare('FEED');
    eq(api.pet.tantrumAt, 0, '満腹の子に出して わがままが起きている:');
  });
  //  寝ている子は わがままを言えない。拒まれると 起こすしか手が無くなる
  it('寝ている子は、くすりを拒まない', () => {
    let cured = 0;
    for(let i=0;i<30;i++){
      const api = at({ health:'SICK' });
      api.doCare('MED');
      if(api.pet.health === 'GOOD') cured++;
    }
    eq(cured, 30, '30回のうち 治った回数:');
  });
  //  瀕死のあいだは眠らない。夜でも起きているので、そのまま世話ができる
  it('瀕死の子は、夜でも眠らない', () => {
    for(const [name, o] of [
        ['くうふく', { hunger:0, mood:2, starveAcc:1200 }],
        ['びょうき', { health:'SICK', sickAcc:1500 }]]){
      const api = at(o);
      ok(api.isWeak(), `${name}: 瀕死のはず`);
      ok(!api.effectiveAsleep(), `${name}: 瀕死なのに眠っている`);
      ok(!api.careDisabled('FEED'), `${name}: ごはんが出せない`);
      ok(!api.careDisabled('MED'),  `${name}: くすりが飲ませられない`);
    }
  });
});

// ══ ふたつの ひんし ════════════════════════════════════
//   くうふく（空腹18時間・死は30時間）と びょうき（病気24時間・死は36時間）。
//   どちらも「あと12時間で死ぬ」ところから。見せかたは共通、マークだけ分ける
describe('ふたつの ひんし', () => {
  const mk = (o) => {
    const { api, clock } = load();
    const t0 = clock.now();
    Object.assign(api.pet, api.defaultPet(), { name:'A', stage:'larva', birth:t0-5*86400000,
      lastTick:t0, EP:2, B:40, hunger:4, mood:4, ...o });
    return api;
  };
  it('どちらも 残り12時間から', () => {
    const { api } = load();
    eq(api.WEAK_SICK_MIN, 1440, '病気で瀕死になるまで(分):');       // 36時間 − 12時間
    eq(api.WEAK_STARVE_MIN, 1080, '空腹で瀕死になるまで(分):');     // 30時間 − 12時間
  });
  it('病気を放置すると、途中から ひんし（びょうき）になる', () => {
    for(const [h, want] of [[0,'sick'], [12,'sick'], [23,'sick'], [24,'weakSick'], [35,'weakSick']]){
      const api = mk({ health:'SICK', sickAcc: h*60 });
      eq(api.healthState(), want, `病気 ${h}時間目の表示:`);
    }
  });
  it('空腹を放置すると、途中から ひんし（くうふく）になる', () => {
    for(const [h, want] of [[0,'starving'], [17,'starving'], [18,'weakStarve'], [29,'weakStarve']]){
      const api = mk({ hunger:0, starveAcc: h*60 });
      eq(api.healthState(), want, `空腹 ${h}時間目の表示:`);
    }
  });
  //  空腹のほうが先に死ぬ（30時間 対 36時間）ので、両方ならそちらを出す
  it('両方が瀕死なら、先に死ぬ くうふくを出す', () => {
    const api = mk({ hunger:0, starveAcc:1200, health:'SICK', sickAcc:1500 });
    ok(api.isWeakStarve() && api.isWeakSick(), '両方が瀕死のはず');
    eq(api.healthState(), 'weakStarve', '両方のときの表示:');
  });
  //  ふだんの病気（汗）と同じ絵にすると、瀕死になったことが伝わらない
  it('ひんし（びょうき）は ドクロ、ふだんの病気は 汗', () => {
    const { api } = load();
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(Array.isArray(api.ICO_SKULL), 'ドクロの絵が無い');
    ok(JSON.stringify(api.ICO_SKULL) !== JSON.stringify(api.ICO_DROP), 'ドクロと汗が同じ絵');
    ok(/emo\(isWeakStarve\(\) \? ICO_EXCL : ICO_SKULL\)/.test(src),
       'ひんし（びょうき）に ドクロを出していない');
    // ふだんの病気は これまでどおり 汗
    ok(/\} else if \(pet\.health === 'SICK'\) \{[\s\S]{0,120}?emo\(ICO_DROP\)/.test(src),
       'ふだんの病気の 汗が 変わってしまっている');
  });
  //  ドクロに見えるための形：まるい頭・左右の眼窩・下に歯
  it('ドクロの絵が、眼窩と歯を持っている', () => {
    const { api } = load();
    const g = api.ICO_SKULL, H = g.length, W = g[0].length;
    ok(W >= 5 && H >= 5, `${W}x${H} では 顔に見えない`);
    // 眼窩＝上半分に、まわりを囲まれた 抜けが2つ
    const eyeRow = g.slice(1, Math.ceil(H/2)).find(r => {
      const gaps = r.slice(1, W-1).filter(v => !v).length;
      return r[0] && r[W-1] && gaps === 2;
    });
    ok(eyeRow, '眼窩（左右2つの抜け）が見あたらない');
    // 歯＝いちばん下の行の、はしを除いた中に すきまを空けて3本
    const teeth = g[H-1].slice(1, W-1);
    const n = teeth.join('').split('0').filter(x => x).length;
    eq(n, 3, '歯の本数:');
  });
  it('ふたつの ひんしに、別の名前がついている', () => {
    const { api } = load();
    for(const lg of ['ja', 'en']){
      api.lang = lg;
      const a = api.T('weakStarve'), b = api.T('weakSick');
      ok(a && b, `${lg}: 名前が無い`);
      ok(a !== b, `${lg}: ふたつの ひんしが 同じ名前（${a}）`);
    }
    api.lang = 'ja';
    ok(/くうふく/.test(api.T('weakStarve')), '日本語に くうふく が入っていない');
    ok(/びょうき/.test(api.T('weakSick')), '日本語に びょうき が入っていない');
  });
  //  けんこうの欄は 右端(46ドット)ぞろえ。名前が長いと 項目名にぶつかる
  it('ひんしの名前が、STATUS の行に収まる', () => {
    const { api } = load();
    for(const [lg, px] of [['ja', 9], ['en', 6]]){
      api.lang = lg;
      for(const k of ['weakStarve', 'weakSick']){
        const t = api.T(k);
        let w = 0;
        for(const ch of t) w += px * (ch.charCodeAt(0) < 0x100 ? 0.5 : 1);
        const left = 46*4 - w;                       // 値の左端(px)
        const labelEnd = 2*4 + px * (lg === 'ja' ? 4 : 6);   // けんこう / HEALTH の右端
        ok(left > labelEnd + 4, `${lg} ${k}: 「${t}」が 項目名にぶつかる（値の左端 ${left} / 名前の右端 ${labelEnd}）`);
      }
    }
    api.lang = 'ja';
  });
});

describe('病気', () => {
  it('その日のうちに治せば放置に数えない', () => {
    const { api, clock } = load();
    pet(api, clock, { B:50, careStreak:4 });
    api.closeOneDay({ sick:1, cured:1 }, 2, false);
    eq(api.pet.B, 50, 'なかよしは減らない:');
    eq(api.pet.careStreak, 5, '連続日数は伸びる:');
  });
  it('治さないまま日をまたぐと放置になる', () => {
    const { api, clock } = load();
    pet(api, clock, { B:50, careStreak:4 });
    api.closeOneDay({ sick:1 }, 2, false);
    eq(api.pet.B, 47);
    eq(api.pet.careStreak, 2);
  });
  it('ケア度は治しても健康な日に及ばない（+10が得にならない）', () => {
    const { api, clock } = load();
    pet(api, clock);
    const healthy = api.dailyCareScore({ playSw:1 });
    const cured   = api.dailyCareScore({ sick:1, cured:1, playSw:1 });
    ok(cured < healthy, `病気の日は必ず下（健康 ${healthy} / 治療 ${cured}）`);
  });
});

// ══ タイトルの選択肢 ══════════════════════════════════════
//   遊びはじめる前に説明書を読めるようにする入口。
//   まだ言語を選んでいない場所なので、ここは英語で出す
describe('タイトルの選択肢', () => {
  const src = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
  //  説明書が上、はじめるが下。読んでから始めてほしいので この順
  it('えらべるのは 説明書と はじめるのふたつ、説明書が上', () => {
    const { api } = load();
    eq(api.OPEN_OPTS, ['MANUAL', 'START'], 'タイトルの選択肢（上から）:');
    for(const t of api.OPEN_OPTS) ok(/^[\x20-\x7E]+$/.test(t), `${t}: 英語で書かれていない`);
  });
  it('はじめは いちばん上を選んでいる', () => {
    const { api } = load();
    eq(api.openStep, 0, 'いきなり ことばえらびが出ている:');
    eq(api.openSel, 0, 'はじめに選ばれているもの:');
  });
  //  PRESS A は出さない。タイトルの下に そのまま並べる
  it('PRESS A を出さない', () => {
    ok(!/fillText\('PRESS/.test(src()), 'PRESS A を描くところが残っている');
    ok(!/PRESS\s+A/.test(src().replace(/\/\/[^\n]*/g, '')), 'PRESS A が残っている');
  });
  //  えらんでいる行が点滅する。薄色だと点滅の半分が読めないので 濃↔消で
  it('えらんでいる行だけが点滅する', () => {
    ok(/const on = \(i !== sel\) \|\| blink;/.test(src()), 'えらんでいる行が点滅しない');
    ok(/ctxO\.fillStyle = on \? ON : OFF;/.test(src()), '点滅の片側が薄色（読めない）');
  });
  //  ▶ は点滅させない。字が消えているあいだも どの行を選んでいるか分かるように
  it('▶ は点滅しない', () => {
    ok(/if\(i === sel\) selMark\(ctxO,/.test(src()), 'タイトルの ▶ が selMark で描かれていない');
    ok(!/if\(i === sel && on\)/.test(src()), '▶ まで点滅している');
  });
  //  タイトルから離しすぎず、ふたつが ひとかたまりに見える間隔にする
  it('選択肢どうしが 近くに並んでいる', () => {
    const { api } = load();
    ok(api.OPT_H <= 7, `選択肢のあいだが ${api.OPT_H}ドットあって、ばらばらに見える`);
    ok(api.OPT_H >= 4, `選択肢のあいだが ${api.OPT_H}ドットしかなく、字が重なる`);
    // 2行とも画面(65ドット)に収まる
    ok(api.OPT_Y0 + api.OPT_H + 2 <= 65, '下の選択肢が画面から出る');
  });
  //  演出のあいだ（MANUAL・START が出るまで）は、どのボタンも効かない。
  //  以前は A だけ「押したら選択肢を出す」抜け道があり、画面に何も出ていないのに
  //  選ばれた扱いになって、2回目の押しで説明書が開いていた
  it('演出のあいだは、どのボタンも効かない', () => {
    const s = src();
    //  受けつけない条件は1か所にまとめる。ボタンごとに書くと、足した時に漏れる
    ok(/function openingLocked\(\)\{ return !!manualFrame \|\| !openingReady; \}/.test(s),
       'オープニングの受けつけ判定が無い');
    //  A・B・十字・MENU の4系統すべてが、その判定を通ること
    const handlers = [
      ["document.getElementById('oa')", 'A'],
      ["document.getElementById('ob')", 'B'],
      ["#view-opening .dpad-arrow", '十字'],
      ["document.getElementById('omenu')", 'MENU'],
    ];
    for(const [needle, name] of handlers){
      const at = s.indexOf('onPress(' + needle) >= 0
        ? s.indexOf('onPress(' + needle)
        : s.indexOf(needle);
      ok(at > 0, `${name} のボタン処理が見つからない`);
      const body = s.slice(at, at + 400);
      ok(/openingLocked\(\)\) return;/.test(body), `${name} が演出中でも効いてしまう`);
      //  音も鳴らさない。判定より先に鳴らすと「効いた」と思わせてしまう
      const lock = body.indexOf('openingLocked()');
      const click = body.indexOf('playClick');
      ok(click < 0 || lock < click, `${name} が止める前に音を鳴らしている`);
    }
    //  ready を立てるのは「選択肢を描いた側」だけ。ボタン側で立ててはいけない
    eq([...s.matchAll(/openingReady = true/g)].length, 1, 'openingReady を立てている場所の数:');
    const draw = s.indexOf('if(titleWait > 19){');
    const set  = s.indexOf('openingReady = true');
    ok(draw > 0 && set > draw && set < draw + 200,
       'openingReady を、選択肢を描く場所いがいで立てている');
    //  演出は飛ばさない。押しても最後まで流れること
    ok(!/fO = O_UFO_GONE/.test(s), 'ボタンで演出を飛ばしている');
  });
  //  ことばを聞くのは START のあと。説明書を見にきただけの人にはえらばせない
  it('ことばをえらぶのは、START のあと', () => {
    ok(/openStep = 1; langSel = \(lang === 'en'\) \? 1 : 0; return;/.test(src()),
       'START から ことばえらびへ進まない');
    // 説明書の枝は ことばえらびを通らない
    const m = src().match(/if\(OPEN_OPTS\[openSel\] === 'MANUAL'\)\{[\s\S]{0,200}?\}/);
    ok(m && !/openStep = 1/.test(m[0]), 'MANUAL なのに ことばをえらばされる');
  });
  it('ことばを決めた時点で、はじまる', () => {
    ok(/setLang\(LANG_OPTS\[langSel\]\.k\);\s*\n\s*if\(!pet\.name && !pet\.birth\) startArrival\(\);/.test(src()),
       'ことばを決めても ゲームが始まらない');
  });
  it('ことばは 2つ、それぞれの言語で書いてある', () => {
    const { api } = load();
    eq(api.LANG_OPTS.map(o => o.k), ['ja', 'en'], 'ことばの並び:');
    eq(api.LANG_OPTS[0].t, 'にほんご', '日本語の名前:');
    eq(api.LANG_OPTS[1].t, 'ENGLISH', '英語の名前:');
    ok(api.LANG_OPTS[0].jp, 'かなを ピクセル字体で描こうとしている（グリフが無い）');
    ok(!api.LANG_OPTS[1].jp, '英語まで ゴシック体になっている');
  });
  it('えらんだ ことばが すぐ効く', () => {
    const { api, store } = load({ storage: { myvader_lang: 'ja' } });
    api.setLang('en');
    eq(api.lang, 'en', 'えらんだあとの言語:');
    eq(store.get('myvader_lang'), 'en', '保存された言語:');
    api.setLang('ja');
    eq(api.lang, 'ja', '戻したあとの言語:');
  });
  //  いま設定されているほうに合わせておく（毎回えらび直さずに A だけで進める）
  it('ことばえらびは、いまの設定に合わせて開く', () => {
    ok(/langSel = \(lang === 'en'\) \? 1 : 0;/.test(src()), 'いまの言語に合わせていない');
  });
  it('MANUAL をえらぶと、説明書を開いて そこで止まる', () => {
    const m = src().match(/if\(OPEN_OPTS\[openSel\] === 'MANUAL'\)\{[\s\S]{0,200}?\}/);
    ok(m, 'MANUAL の枝が無い');
    ok(/openManual\(\);/.test(m[0]), '説明書を開いていない');
    ok(/return;/.test(m[0]), 'そのままゲームが始まってしまう');
    ok(!/showView\('main'\)/.test(m[0]), 'MANUAL なのに育成画面へ行ってしまう');
  });
  //  説明書は かぶせて出すだけなので、閉じれば下の選択肢がそのまま見えている
  it('説明書を閉じても、選択肢は畳まれない', () => {
    ok(!/function closeManual\(\)\{[^}]*openMenu\s*=\s*false/.test(src()),
       '説明書を閉じると 選択肢まで畳まれてしまう');
  });
});

// ══ 到着のあと、名前をつける画面へ ══════════════════════════
describe('到着のあと', () => {
  const src = () => require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
  it('着地を見とどける間がある', () => {
    const { api } = load();
    ok(api.ARR_TO_NAME >= 1, `一拍が ${api.ARR_TO_NAME} コマしかない`);
    ok(api.ARR_TO_NAME <= 30, `一拍が ${api.ARR_TO_NAME} コマ（3秒超）は長すぎる`);
    eq(api.nameOpenT, -1, 'はじめから待ちに入っている:');
  });
  it('到着が終わると、名前がまだのときだけ 待ちに入る', () => {
    ok(/if\(pet\.name\)\{ arriveT = -1; return; \}/.test(src()),
       '名前がついているのに 命名画面へ送ろうとしている');
    ok(/if\(nameOpenT < 0\) nameOpenT = ARR_TO_NAME;/.test(src()),
       '到着のあとに 命名画面へ送る仕掛けが無い');
  });
  it('待ちが明けると、命名画面が自動で開く', () => {
    ok(/if\(nameOpenT-- === 0\)\{ arriveT = -1; nameOpenT = -1; startNaming\(\); showView\('naming'\); \}/.test(src()),
       '待ちが明けても命名画面が開かない');
  });
  //  一拍のあいだ ふつうの育成画面を描くと、就寝時間帯に始めたときに
  //  寝姿が一瞬見える（まだ生まれておらず、起きている扱いにもなっていないため）
  it('待っているあいだも、到着の最後のコマのまま止めている', () => {
    ok(/arriveT = ARR_TOTAL - 1;/.test(src()), '最後のコマで止めていない');
    // tickMain 側に「一拍だけ ふつうの画面を描く」枝が残っていないこと
    ok(!/if\(nameOpenT >= 0\)\{\s*\n\s*if\(nameOpenT-- === 0\)/.test(src()),
       '育成画面を描く側に 待ちの処理が残っている');
  });
  //  待っているあいだにボタンが効くと、名前をつける前に画面を離れられてしまう
  it('待っているあいだは ボタンが効かない', () => {
    const { api } = load();
    eq(api.cutscenePlaying(), false, 'ふだんから塞がっている:');
    api.nameOpenT = 3;
    eq(api.cutscenePlaying(), true, '待っているあいだに ボタンが効いてしまう:');
  });
});

// ══ ヘッダーのマーク ══════════════════════════════════════
//   ふだんは薄色で置いておき、知らせがあるときだけ濃い色で点滅する。
//   出っぱなしにするのは「そこから飛べる」と分かってもらうため
describe('ヘッダーのマーク', () => {
  const at = (st, unread) => {
    const { api, clock } = load();
    const t0 = clock.now();
    Object.assign(api.pet, api.defaultPet(), { name:'ALPHA', stage:'larva', birth:t0-5*86400000,
      lastTick:t0, EP:2, B:40, hunger:4, mood:4, ...st });
    api.addDiary({ d:5, n:'ALPHA', t:['fed'], v:[0], c:'', ts:t0, cd:'2026-06-15', lv:2, wr:1 });
    api.diaryUnread = unread || 0;
    return api;
  };
  //  左から日記・ステータス・せってい。せっていはいつでも開ける
  it('左から日記・ステータス・せってい', () => {
    eq(at({}).headIcons(), ['diary','status','settings'], 'ヘッダーのマーク（左から）:');
  });
  //  日記帳が1件もないうちは、マークを出さない＝選べない。
  //  出しても開けるのは空のページで、押した意味が無い
  it('はじめの日記が書かれるまで、日記のマークは選べない', () => {
    const { api, clock } = load();
    const t0 = clock.now();
    Object.assign(api.pet, api.defaultPet(), { name:'ALPHA', stage:'larva', birth:t0-5*86400000,
      lastTick:t0, EP:2, B:40, hunger:4, mood:4 });
    api.clearDiary();
    eq(api.headIcons(), ['status','settings'], '日記が0件のときのマーク:');   // 日記が無ければ ステータスが先頭
    // 上を押しても 日記には行けない（左右に動かしても日記は無い）
    api.headSel = api.headIcons()[0];
    eq(api.headSel, 'status', '上で選ばれるマーク:');
    // 1件書かれたら出る
    api.addDiary({ d:5, n:'ALPHA', t:['fed'], v:[0], c:'', ts:t0, cd:'2026-06-15', lv:2, wr:1 });
    eq(api.headIcons(), ['diary','status','settings'], '1件書かれたあとのマーク:');
  });
  it('命名前は なにも出ない', () => {
    const { api } = load();
    eq(api.headIcons(), [], '命名前のマーク:');
  });
  it('別れたあとは ステータスが消える', () => {
    const api = at({ gone:true, goneBy:'depart' });
    eq(api.headIcons(), ['diary','settings'], '別れたあとのマーク:');
  });
  //  以前は未読のときだけ出ていた。読み終わると消えてしまい、
  //  日記へ飛べる場所だと分からなくなっていた
  it('日記のマークは、読み終わっても残る', () => {
    ok(at({}, 0).headIcons().includes('diary'), '既読で消えている');
  });
  it('ステータスの知らせは、けんこうが「よい」以外のときだけ点く', () => {
    eq(at({}).statusAlert(), false, 'なんともない子:');
    for(const [name, st] of [
        ['びょうき',   { health:'SICK' }],
        ['はらぺこ',   { hunger:0 }],
        ['きげんが底', { mood:0 }],
        ['やまいの芽', { incubAt: 1 }],
      ]){
      ok(at(st).statusAlert(), `${name}: 知らせが点かない`);
    }
  });
  //  STATUS に出る文字と、ヘッダーの点滅は同じところから決める。
  //  別々に書くと「ふつう」と出ているのに知らせだけ点く、が起きる
  it('知らせと STATUS の文字が、同じ状態から出ている', () => {
    for(const st of [{}, { health:'SICK' }, { hunger:0 }, { mood:0 }]){
      const api = at(st);
      eq(api.statusAlert(), api.healthState() !== 'good', `${JSON.stringify(st)}: 知らせと文字が食い違う`);
    }
  });
  // 上を1回押したときに どれが選ばれるか。
  //  点滅しているもの＞せってい の順。点滅が2つあるときはステータスが先
  describe('上を1回押したとき', () => {
    it('どれも点いていなければ せってい', () => {
      const api = at({}, 0);
      eq(api.statusAlert(), false, '知らせが出ている:');
      eq(api.headDefault(), 'settings', '選ばれるマーク:');
    });
    it('ステータスだけ点いていれば ステータス', () => {
      eq(at({ health:'SICK' }, 0).headDefault(), 'status', '選ばれるマーク:');
    });
    it('日記だけ点いていれば 日記', () => {
      eq(at({}, 1).headDefault(), 'diary', '選ばれるマーク:');
    });
    it('両方点いていれば ステータスが先', () => {
      const api = at({ health:'SICK' }, 1);
      ok(api.headAlert('status') && api.headAlert('diary'), '両方点いているはず');
      eq(api.headDefault(), 'status', '選ばれるマーク:');
    });
    //  十字の上が この決め方を使っていること。
    //  ここで list[0] を使うと、点滅を無視して いちばん左が選ばれてしまう
    it('十字の上が、この決め方を使っている', () => {
      const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
      ok(/classList\.contains\('up'\)\s*&& !headSel\) headSel = headDefault\(\);/.test(src),
         '上を押したときに headDefault() を使っていない');
    });
    it('日記がまだ無く、ステータスも点いていなければ せってい', () => {
      const { api, clock } = load();
      const t0 = clock.now();
      Object.assign(api.pet, api.defaultPet(), { name:'ALPHA', stage:'larva', birth:t0-5*86400000,
        lastTick:t0, EP:2, B:40, hunger:4, mood:4 });
      api.clearDiary();
      eq(api.headDefault(), 'settings', '選ばれるマーク:');
    });
  });
  //  せっていは知らせを持たない＝点滅しない。ふだんは ほかと同じ薄い色
  it('せっていは 点滅しない', () => {
    for(const st of [{}, { health:'SICK' }]){
      eq(at(st, 1).headAlert('settings'), false, 'せっていに知らせが出ている:');
    }
  });
  //  命名前は ヘッダーのマークを出さず、上で ????（名前）を選ばせる
  it('命名前は、上で ???? が選ばれる', () => {
    const { api } = load();
    eq(api.pet.name, '', '名前がついていないはず:');
    eq(api.headIcons(), [], '命名前のマーク:');
    eq(api.headDefault(), null, '命名前に選ばれるマーク:');
    // 上の十字が ???? を選ぶ枝を通ること（マークの枝には入らない）
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(/if\(!pet\.name\)\{[\s\S]{0,200}?nameSelActive = true;/.test(src),
       '命名前に ???? を選ぶ枝が無い');
  });
  it('マークが DAY の表示に掛からない', () => {
    const api = at({});
    const list = api.headIcons();
    // DAY表示は「DAY : 99」の8文字。Press Start 2P は1文字＝文字の大きさ
    const dayLeft = 54*4 - 2*4 - 8*api.HEAD_FONT;
    const right = api.headIconX(list.length-1, list.length) + api.HEAD_ICON_W;
    ok(right + 2 <= dayLeft, `いちばん右のマークが ${right}px まで来ていて、DAY(${dayLeft}px〜)に掛かる`);
    // 左どうしが重ならない
    for(let i=1;i<list.length;i++){
      const prev = api.headIconX(i-1, list.length) + api.HEAD_ICON_W;
      ok(api.headIconX(i, list.length) > prev, 'マークどうしが重なっている');
    }
  });
  //  ヘッダーの帯（0〜区切り線）に、文字もマークも収まっていること
  it('文字とマークが、ヘッダーの帯に収まっている', () => {
    const { api } = load();
    const band = api.HEADER_Y * 4;
    ok(api.HEAD_TEXT_Y + api.HEAD_FONT <= band, `文字が帯からはみ出す（下端 ${api.HEAD_TEXT_Y+api.HEAD_FONT} / 帯 ${band}）`);
    ok(api.HEAD_IY + api.HEAD_ICON_H <= band, `マークが帯からはみ出す（下端 ${api.HEAD_IY+api.HEAD_ICON_H} / 帯 ${band}）`);
    // 文字とマークの中心がそろっている（片方だけ浮いて見えないように）
    const tc = api.HEAD_TEXT_Y + api.HEAD_FONT/2, ic = api.HEAD_IY + api.HEAD_ICON_H/2;
    ok(Math.abs(tc - ic) <= 1, `文字(${tc})とマーク(${ic})の中心がずれている`);
  });
  // マークと DAY のあいだの仕切り。メニューの列と同じ半ドットの細さ。
  //  マークと同じ太さだと、もう1つマークがあるように見える
  it('マークと DAY のあいだの仕切りが、どちらにも掛からない', () => {
    const api = at({});
    const S = 4, list = api.headIcons();
    const last = api.headIconX(list.length-1, list.length) + api.HEAD_ICON_W;
    const x = last + api.HEAD_ICON_GAP/2, w = S/2;
    const dayLeft = 54*S - 2*S - 8*api.HEAD_FONT;
    ok(x >= last, `仕切り(${x})が いちばん右のマーク(〜${last})に重なっている`);
    ok(x + w <= dayLeft, `仕切り(〜${x+w})が DAY(${dayLeft}〜)に重なっている`);
    // 左は かな7文字の名前（右端78px）に掛からない
    const first = api.headIconX(0, list.length);
    ok(first >= 78 + 4, `いちばん左のマーク(${first}px)が 名前(〜78px)に近すぎる`);
    eq(w, S/2, '仕切りの太さ(px):');
    eq(x % 1, 0, `仕切りの左端(${x}px)が整数pxでない（にじむ）:`);
  });
  //  マークが1つも無いとき（命名前）は、仕切りも出さない
  it('マークが無いときは、仕切りも出さない', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(/if\(list\.length\)\{[\s\S]{0,220}?fillRect\(last \+ HEAD_ICON_GAP\/2, HEAD_IY, S\/2, HEAD_ICON_H\);/.test(src),
       'マークが無いときにも仕切りを引いている');
  });
  it('3つのマークが、同じ大きさで描かれている', () => {
    const { api } = load();
    for(const [name, g] of [['日記', api.DIARY_ICON], ['ステータス', api.STATUS_ICON], ['せってい', api.GEAR_ICON]]){
      eq(g[0].length, api.HEAD_ICON_W, `${name} の横はば:`);
      eq(g.length, api.HEAD_ICON_H, `${name} の縦はば:`);
    }
  });
  it('2つのマークは、見分けのつく別の絵', () => {
    const { api } = load();
    const a = JSON.stringify(api.DIARY_ICON), b = JSON.stringify(api.STATUS_ICON);
    ok(a !== b, '日記とステータスが同じ絵');
    eq(api.STATUS_ICON[0].length, api.DIARY_ICON[0].length, 'マークの横はば:');
    eq(api.STATUS_ICON.length, api.DIARY_ICON.length, 'マークの縦はば:');
  });
  //  選択中は薄色の枠で囲む。マークまで薄色のままだと枠に溶けて消える
  it('えらんでいるマークは、枠と別の色で描く', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const frame = /if\(sel\)\{ ctxM\.fillStyle = DM;/.test(src);
    ok(frame, '選択中の枠が薄色(DM)で描かれていない');
    ok(/\(sel \|\| blink\) \? NK : DM/.test(src), 'えらんでいるマークが濃い色(NK)にならない（枠に溶ける）');
  });
  //  縦の棒だと携帯の電波マークに見えるので、横に寝かせてある。
  //  グラフに見えるには、左に軸があって、長さの違う棒が横に伸びていること
  it('ステータスのマークが、横向きの棒グラフになっている', () => {
    const { api } = load();
    const g = api.STATUS_ICON, H = g.length, W = g[0].length;
    ok(g.every(r => r[0]), '左の軸が通っていない');
    // 軸より右に、軸から続いて伸びているマスの数＝その行の棒の長さ
    const rowLen = y => {
      let n = 0;
      while(1 + n < W && g[y][1+n]) n++;
      eq(g[y].slice(1).filter(v => v).length, n, `${y}行目の棒が途中で切れている:`);
      return n;
    };
    // 続いている行をひとまとめにして「1本の棒」として数える
    const bars = [];
    for(let y=0;y<H;y++){
      const n = rowLen(y);
      if(!n){ continue; }
      const prev = bars[bars.length-1];
      if(prev && prev.end === y-1){ prev.end = y; prev.len = Math.max(prev.len, n); }
      else bars.push({ start:y, end:y, len:n });
    }
    eq(bars.length, 3, '棒の本数（STATUS の目盛り3本にそろえる）:');
    const lens = bars.map(b => b.len);
    eq(new Set(lens).size, 3, `棒の長さが かぶっている（${lens}）。グラフに見えない:`);
    // 「長い・短い・長い」と対称に並べると E の字に見える。かならず一方向に伸ばす
    const up   = lens.every((v,i) => i === 0 || v > lens[i-1]);
    const down = lens.every((v,i) => i === 0 || v < lens[i-1]);
    ok(up || down, `棒の長さが ${lens} で、山や谷になっている。E の字に見える`);
  });
  //  書いてあるページに見せるための線。減らすと ただの箱になる
  it('日記のマークの中に、横線が3本ある', () => {
    const { api } = load();
    const g = api.DIARY_ICON, H = g.length, W = g[0].length;
    // 綴じ側(0,1列)と外枠を除いた「紙の中」で、線が引かれている行を数える
    let lines = 0;
    for(let y=1;y<H-1;y++) if(g[y].slice(3, W-1).some(v => v)) lines++;
    eq(lines, 3, '紙の中の横線の数:');
  });
});

// ══ お世話アイコン ════════════════════════════════════════
describe('お世話', () => {
  it('薄く表示される操作は、押しても状態を変えない', () => {
    const { api, clock } = load();
    clock.setTime(3, 0);                       // 就寝中
    pet(api, clock, { wokeUntil:0, mood:4 });
    ok(api.careDisabled('PET'), '就寝中のほめるは無効のはず');
    const before = api.pet.mood;
    api.doCare('PET');
    eq(api.pet.mood, before, 'きげんが動いてはいけない:');
  });
  // かつて「アイコンは薄いのに、押すと機嫌が下がる」バグがあった。
  //  個々の分岐が就寝判定を持つようになったので今は二重防御だが、
  //  分岐を足したときに破れないよう、不変条件として総当たりで押さえておく
  it('無効な操作は、どれを押しても状態を変えない（総当たり）', () => {
    const acts = ['FEED','SNACK','CLEAN','MED','PET','SCOLD'];
    const situations = [
      ['就寝中',        { hour:3, over:{ wokeUntil:0 } }],
      ['皿が残っている', { hour:14, over:{ plateAt:1 } }],
      ['片づけるものが無い', { hour:14, over:{ W:0, plateAt:0, plateSpoiled:false } }],
      ['命名前',        { hour:14, over:{ name:'' } }],
      ['おばけ',        { hour:14, over:{ dead:'starve' } }],
      ['帰還後',        { hour:14, over:{ gone:true } }],
    ];
    for(const [label, sit] of situations){
      for(const act of acts){
        const { api, clock } = load();
        clock.setTime(sit.hour, 0);
        pet(api, clock, Object.assign({ plateAt:0 }, sit.over));
        if(!api.careDisabled(act)) continue;          // 有効な操作は対象外
        const before = JSON.stringify(api.pet);
        api.doCare(act);
        eq(JSON.parse(JSON.stringify(api.pet)), JSON.parse(before),
           `${label} の ${act}:`);
      }
    }
  });
  it('片づけるものが無いときの そうじ は無効', () => {
    const { api, clock } = load();
    pet(api, clock, { W:0, plateAt:0, plateSpoiled:false });
    ok(api.careDisabled('CLEAN'));
  });
  it('皿が残っているあいだは ごはん を出せない', () => {
    const { api, clock } = load();
    pet(api, clock, { plateAt: Date.now() });
    ok(api.careDisabled('FEED'));
  });
  it('健康なのにくすりを飲ませると、きげんが下がり恨みが増える', () => {
    const { api, clock } = load();
    pet(api, clock, { health:'GOOD', incubAt:0, mood:4, M:0 });
    api.doCare('MED');
    eq(api.pet.mood, 3);
    eq(api.pet.M, api.M_ADJ.medWell);
  });
  it('潜伏中にくすりを飲ませると発症を防げる（病気回数は増えない）', () => {
    const { api, clock } = load();
    pet(api, clock, { incubAt: clock.now() + 1800000, mood:4, M:0, sickCount:0 });
    api.doCare('MED');
    eq(api.pet.incubAt, 0, '潜伏が解除される:');
    eq(api.pet.mood, 4, 'きげんは下がらない:');
    eq(api.pet.M, 0, '恨みは増えない:');
    eq(api.pet.sickCount, 0, '病気になったことにはしない:');
  });
});

// ══ おなかの段階差 ════════════════════════════════════════
describe('おなか', () => {
  const feeds = (api) => { let n = 0; api.pet.hunger = 0;
    while(api.pet.hunger < api.HUNGER_MAX && n < 20){ api.feedFill(); n++; } return n; };
  // 目盛りは「次の1が減るまでの進み具合」を引いて描いている。満腹にしても
  //  その時計が動いたままだと、食べさせた直後なのに目盛りが欠けて見える
  const lit = g => Math.round(Math.max(0, Math.min(5, g)) * 2);   // 画面の目盛り数（0〜10）

  it('満腹まで食べさせたら、いつでも目盛りが満タンになる', () => {
    for(const st of ['egg','mid','larva','adult','final']){
      for(const f of [0, 0.3, 0.5, 0.9, 0.99]){
        const { api, clock } = load();
        pet(api, clock, { stage:st, lineage:'inv', hunger:0 });
        api.pet.hungerAcc = api.hungerMin() * f;     // 前回の減りからの経過
        feeds(api);
        eq(lit(api.gaugeHunger()), 10, `${st} / 経過${Math.round(f*100)}%:`);
      }
    }
  });
  // 「食べさせた瞬間」だけを見ていたので、直後から欠けはじめて
  //  満タンをほとんど見られない状態に気づけなかった。居続ける時間で押さえる
  it('満腹のあいだは、時間がたっても目盛りが満タンのまま', () => {
    for(const st of ['egg','mid','larva','adult','final']){
      const { api, clock } = load();
      pet(api, clock, { stage:st, lineage:'inv', hunger:0 });
      feeds(api);
      eq(api.pet.hunger, api.HUNGER_MAX, `${st}: 満腹になっていること:`);
      const hm = api.hungerMin();
      for(const f of [0.1, 0.5, 0.9, 0.99]){          // 次に1減るまでの進み具合
        api.pet.hungerAcc = hm * f;
        eq(lit(api.gaugeHunger()), 10, `${st} / 経過${Math.round(f*100)}%:`);
      }
    }
  });
  it('空いたらすぐ食べさせる世話なら、ほとんどの時間 満タンでいられる', () => {
    for(const st of ['larva','adult']){
      const { api, clock, sandbox } = load();
      sandbox.Math.random = () => 0.999;              // わがままで拒まれないようにする
      pet(api, clock, { stage:st, lineage:'inv', hunger:3, mood:5, health:'GOOD' });
      api.pet.hungerAcc = 0;
      let full = 0, total = 0;
      for(let m=0; m<2*24*60; m++){
        clock.advance(60000); api.advancePet();
        if(api.pet.stage !== st) break;               // 進化したら打ち切り
        if(!api.careDisabled('FEED') && api.pet.hunger < api.HUNGER_MAX){
          api.doCare('FEED'); api.pet.plateAt = 0;    // 食事アニメぶんの皿は畳んだものとする
        }
        if(lit(api.gaugeHunger()) === 10) full++;
        total++;
      }
      const pct = Math.round(full/total*100);
      ok(pct >= 50, `${st}: 満タンでいられる時間が ${pct}%（欠けたままに見える）`);
    }
  });
  it('満腹でないうちは、経過ぶんだけ目盛りが欠ける（10段階で動く）', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', lineage:'inv' });
    const hm = api.hungerMin();
    api.pet.hunger = 3; api.pet.hungerAcc = 0;
    eq(lit(api.gaugeHunger()), 6, '減った直後:');
    api.pet.hungerAcc = hm * 0.6;
    eq(lit(api.gaugeHunger()), 5, '半分すぎたら1本ぶん減る:');
  });
  // おやつは満腹でも食べる。ここで時計を数え直すと、おやつを配り続けるだけで
  //  永久に空腹にならなくなる（実際にそうなっていた）
  it('もともと満腹なら、おやつを与えても時計を数え直さない', () => {
    const { api, clock } = load();
    clock.setTime(14, 0);
    pet(api, clock, { stage:'larva', lineage:'inv', hunger:api.HUNGER_MAX, mood:4, plateAt:0 });
    const acc = api.hungerMin() * 0.9;
    for(let i=0;i<3;i++){
      api.pet.hungerAcc = acc; api.pet.plateAt = 0;
      api.doCare('SNACK');
      ok(api.pet.hungerAcc >= acc - 1, `${i+1}回目で時計が巻き戻った（${Math.round(api.pet.hungerAcc)}）`);
    }
  });
  it('空腹からおやつで満腹になった時は、ちゃんと数え直す', () => {
    const { api, clock } = load();
    clock.setTime(14, 0);
    pet(api, clock, { stage:'egg', hunger:3, mood:4, plateAt:0 });
    api.pet.hungerAcc = api.hungerMin() * 0.9;
    api.doCare('SNACK');                       // うまれたては一食で3回復＝満腹になる
    eq(api.pet.hunger, api.HUNGER_MAX, '満腹になること:');
    eq(api.pet.hungerAcc, 0, '数え直すこと:');
    eq(lit(api.gaugeHunger()), 10, '目盛りが満タンになること:');
  });
  it('食べさせても満腹に届かない時は、時計を数え直さない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', hunger:0 });
    const acc = api.hungerMin() * 0.8;
    api.pet.hungerAcc = acc;
    api.feedFill();                                   // 大人は1回では満腹にならない
    ok(api.pet.hunger < api.HUNGER_MAX, '満腹にはなっていないこと');
    eq(api.pet.hungerAcc, acc, '経過はそのまま:');
  });
  it('小さい子ほど少ない回数で満腹になる', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg' });    const egg = feeds(api);
    pet(api, clock, { stage:'larva' });  const larva = feeds(api);
    pet(api, clock, { stage:'adult', lineage:'inv' }); const adult = feeds(api);
    eq([egg, larva, adult], [2, 3, 5]);
  });
  it('小さい子ほど早くおなかがすく', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg' });   const egg = api.hungerMin();
    pet(api, clock, { stage:'larva' }); const larva = api.hungerMin();
    pet(api, clock, { stage:'adult', lineage:'inv' }); const adult = api.hungerMin();
    ok(egg < larva && larva < adult, `${egg} < ${larva} < ${adult} であるべき`);
  });
  it('満腹を超えない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg', hunger:4 });
    api.feedFill();
    eq(api.pet.hunger, api.HUNGER_MAX);
  });
});

// ══ きげん ══════════════════════════════════════════════
//  おなかと同じ作りなので、同じ落とし穴がある
describe('きげん', () => {
  const lit = g => Math.round(Math.max(0, Math.min(5, g)) * 2);

  it('きれいな部屋で上げきったら、目盛りが満タンになる', () => {
    for(const f of [0, 0.5, 0.99]){
      const { api, clock } = load();
      pet(api, clock, { mood:0, W:0, health:'GOOD', plateAt:0, plateSpoiled:false });
      api.pet.moodAcc = api.MOOD_MIN * f;
      for(let i=0;i<6;i++) api.raiseMood();
      eq(lit(api.gaugeMood()), 10, `経過${Math.round(f*100)}%:`);
    }
  });
  it('上げきったら、次に下がるまでの時間が丸ごと残る', () => {
    const { api, clock } = load();
    pet(api, clock, { mood:0, W:0, health:'GOOD', plateAt:0, plateSpoiled:false });
    api.pet.moodAcc = api.MOOD_MIN * 0.9;          // 前回の減りから9割まで進んでいる
    for(let i=0;i<6;i++) api.raiseMood();
    eq(api.pet.mood, 5, '満タンになること:');
    // 数え直していないと、上げた直後なのに数分で1段下がってしまう
    clock.advance(api.MOOD_MIN * 0.5 * 60000);
    api.advancePet();
    eq(api.pet.mood, 5, '半分の時間がたった時点:');
  });
  it('上げきったあいだは、時間がたっても きげんの目盛りが満タンのまま', () => {
    const { api, clock } = load();
    pet(api, clock, { mood:0, W:0, health:'GOOD', plateAt:0, plateSpoiled:false });
    for(let i=0;i<6;i++) api.raiseMood();
    for(const f of [0.1, 0.5, 0.99]){
      api.pet.moodAcc = api.MOOD_MIN * f;
      eq(lit(api.gaugeMood()), 10, `経過${Math.round(f*100)}%:`);
    }
  });
  it('汚れているあいだは、上げても満タンにならない', () => {
    const { api, clock } = load();
    pet(api, clock, { mood:0, W:2 });
    api.pet.moodAcc = api.MOOD_MIN * 0.5;
    for(let i=0;i<6;i++) api.raiseMood();
    ok(lit(api.gaugeMood()) < 10, '満タンに見えてはいけない');
    ok(api.pet.mood === 4, `上限まで上がっていること（実際 ${api.pet.mood}）`);
    // 上限にいるあいだは、その高さで保つ（満点でないからと目減りを描かない）
    for(const f of [0.1, 0.5, 0.99]){
      api.pet.moodAcc = api.MOOD_MIN * f;
      eq(lit(api.gaugeMood()), 8, `汚れているときの上限 / 経過${Math.round(f*100)}%:`);
    }
  });
  it('上限が下がっているあいだは、時計を数え直さない', () => {
    const { api, clock } = load();
    pet(api, clock, { mood:3, W:2 });
    const acc = api.MOOD_MIN * 0.7;
    api.pet.moodAcc = acc;
    api.raiseMood();                        // 4まで上がるが、いちばん上ではない
    eq(api.pet.mood, 4);
    eq(api.pet.moodAcc, acc, '経過はそのまま:');
  });
});

// ══ 生活リズム ════════════════════════════════════════════
describe('生活リズム', () => {
  it('やんちゃなほど就寝と起床が後ろへずれる', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', P:0 });
    const calm = api.sleepConfig();
    api.pet.P = 60;
    const wild = api.sleepConfig();
    ok(wild.bed > calm.bed && wild.wake > calm.wake, '就寝も起床も後ろへ');
    eq(Math.round((wild.bed - calm.bed) * 10) / 10, 5, '最大シフトは5時間:');
  });
  it('リズムが整っている子は「乱れた昼寝」にならない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', P:0 });
    for(let h = 0; h < 24; h++){
      clock.setTime(h, 30);
      ok(api.sleepKind(new Date(clock.now())) !== 'owl', `${h}時が owl になってはいけない`);
    }
  });
  it('昼夜逆転した子は、昼間の睡眠が「乱れ」と判定される', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', P:60 });
    clock.setTime(10, 0);
    eq(api.sleepKind(new Date(clock.now())), 'owl');
  });
  it('夜更かしを叱ると、すぐには寝ないが しばらくして寝る', () => {
    const { api, clock } = load();
    clock.setTime(1, 0);
    pet(api, clock, { stage:'adult', lineage:'inv', P:60, wokeUntil:0, tantrumAt:0 });
    ok(api.stayingUpLate(), '1時は夜更かし中のはず');
    api.doCare('SCOLD');
    ok(!api.effectiveAsleep(), 'しかった直後はまだ起きている');
    clock.advance(10 * 60000);
    ok(api.effectiveAsleep(), '10分後には寝ている');
  });
  it('ふつうの夜の睡眠を起こすのは睡眠妨害のまま', () => {
    const { api, clock } = load();
    clock.setTime(3, 0);
    pet(api, clock, { stage:'adult', lineage:'inv', P:0, wokeUntil:0, scoldBadCount:0 });
    eq(api.sleepKind(new Date(clock.now())), 'night');
    api.doCare('SCOLD');
    eq(api.pet.scoldBadCount, 1, 'しかるの失敗として数える:');
  });
  //  睡眠妨害は「不当なしかるの上位版」。不当なしかるが取るものは全部取ったうえで、
  //  PとMがさらに重い。ここでDとBが免除に戻ると、寝ている子を起こして遊ぶのが
  //  系統・進化のうえで無傷の操作になってしまう
  it('睡眠妨害は、不当なしかるが取るものを全部取ったうえで さらに重い', () => {
    const { api, clock } = load();
    const scold = wantAsleep => {
      let hour = null;
      const seed = h => { clock.setTime(h, 0);
        pet(api, clock, { stage:'adult', lineage:'inv', wokeUntil:0, tantrumAt:0,
          B:50, C:50, D:50, Dm:50, P:0, M:0, A:0 }); };
      for(let h=0; h<24; h++){ seed(h); if(api.effectiveAsleep() === wantAsleep){ hour = h; break; } }
      ok(hour !== null, (wantAsleep?'寝ている':'起きている')+'時刻が見つかること');
      seed(hour);
      const b = { B:api.pet.B, D:api.pet.D, P:api.pet.P, M:api.pet.M, mood:api.pet.mood };
      api.doCare('SCOLD');
      return { B:api.pet.B-b.B, D:api.pet.D-b.D, P:api.pet.P-b.P, M:api.pet.M-b.M, mood:api.pet.mood-b.mood };
    };
    const woken = scold(true), unfair = scold(false);
    for(const k of ['B','D','mood']) eq(woken[k], unfair[k], k+' は不当なしかると同じ:');
    ok(woken.P > unfair.P, `性格Pは睡眠妨害のほうが重い: ${woken.P} vs ${unfair.P}`);
    ok(woken.M > unfair.M, `恨みMは睡眠妨害のほうが重い: ${woken.M} vs ${unfair.M}`);
    ok(woken.D < 0 && woken.B < 0, `しつけ・なかよしがちゃんと減ること: D${woken.D} B${woken.B}`);
  });
  //  しゅん（sad）は「しつけが通った」合図。身に覚えのない叱られ方には怒る。
  //  ここが sad に戻ると、プレイヤーには失敗が成功に見えてしまう
  it('しゅんとするのは、しつけが通った時だけ', () => {
    const { api, clock } = load();
    const at = (h, o) => { clock.setTime(h, 0);
      pet(api, clock, Object.assign({ stage:'adult', lineage:'inv', wokeUntil:0, tantrumAt:0, P:0 }, o));
      api.doCare('SCOLD'); return api.reactType; };
    // 通った側：わがままを叱る／夜更かしを正す
    eq(at(15, { tantrumAt: clock.now() }), 'sad', 'わがままを叱る:');
    eq(at(1,  { P:60 }), 'sad', '夜更かしを正す:');
    // 失敗した側：睡眠妨害／不当なしかる
    eq(at(3,  {}), 'anger', '睡眠妨害:');
    eq(at(15, {}), 'anger', '不当なしかる:');
  });
});

// ══ 来たばかりのころ ══════════════════════════════════════
//  うまれたては19時〜8時が就寝。夜に始めると、名前をつけた直後に
//  寝顔だけ見て終わってしまうので、しばらくは起きているようにした
describe('到着', () => {
  // 指定した時刻ちょうどに名前をつけた状態にする
  const arriveAt = (api, clock, hour) => {
    const x = new Date(clock.now()); x.setHours(hour, 0, 0, 0);
    clock.set(x.getTime());
    Object.assign(api.pet, api.defaultPet(), { stage:'egg', hunger:4, mood:4 });
    api.birthPet('YORU');
    return x.getTime();
  };
  it('夜に始めても、しばらくは起きている', () => {
    for(const h of [23, 2, 5]){
      const { api, clock } = load();
      const t0 = arriveAt(api, clock, h);
      ok(api.isAsleep(new Date(t0)), `${h}時は本来なら就寝中であること`);
      ok(!api.effectiveAsleep(), `${h}時: 来た直後に寝てしまっている`);
      clock.set(t0 + api.ARRIVE_AWAKE_MS - 60000);
      ok(!api.effectiveAsleep(), `${h}時: 30分たつ前に寝てしまっている`);
    }
  });
  it('しばらくしたら、ちゃんと寝る', () => {
    const { api, clock } = load();
    const t0 = arriveAt(api, clock, 23);
    clock.set(t0 + api.ARRIVE_AWAKE_MS + 60000);
    ok(api.effectiveAsleep(), '起きたままにはしない');
  });
  it('起きている時間は30分ぶん（長すぎず短すぎず）', () => {
    const { api } = load();
    eq(api.ARRIVE_AWAKE_MS, 30 * 60000);
  });
  it('昼に始めた場合は、いつもどおり起きている', () => {
    const { api, clock } = load();
    const t0 = arriveAt(api, clock, 10);
    clock.set(t0 + 3 * 3600000);              // 3時間たっても昼のうち
    ok(!api.effectiveAsleep());
  });
  // 端末の時計は、時刻の修正やずれの補正で過去へ動くことがある。
  //  未来の lastTick を抱えたままだと、実時間が追いつくまで進行が止まり、
  //  画面上は何をしても変わらないので故障と見分けがつかない
  it('端末の時計が戻されても、進行が止まらない', () => {
    const { api, clock } = load();
    Object.assign(api.pet, api.defaultPet(), { stage:'larva', EP:3, hunger:5, mood:5 });
    api.birthPet('T');
    const t0 = clock.now();
    clock.set(t0 + 2 * 86400000);           // 時計が2日ぶん進んでいた
    api.advancePet();
    clock.set(t0);                          // 正しい時刻に戻される
    api.advancePet();
    ok(api.pet.lastTick <= clock.now(), `lastTick が未来のまま（${api.pet.lastTick - clock.now()}ms先）`);
    // そのあと実時間が進めば、ちゃんと減る
    const before = api.pet.EP;
    clock.advance(3 * 3600000);
    api.advancePet();
    ok(api.pet.EP > before, '時計を戻したあと、時間が進んでも成長が止まったまま');
  });
  it('時計を戻しても、記録している時刻の間隔は保たれる', () => {
    const { api, clock } = load();
    Object.assign(api.pet, api.defaultPet(), { stage:'larva', EP:3, hunger:5, mood:5 });
    api.birthPet('T');
    const t0 = clock.now();
    clock.set(t0 + 2 * 86400000);
    api.advancePet();
    const day = api.petDay(), gap = api.pet.lastTick - api.pet.birth;
    clock.set(t0);
    api.advancePet();
    eq(api.petDay(), day, '戻したとたんに DAY が巻き戻る:');
    ok(Math.abs((api.pet.lastTick - api.pet.birth) - gap) < 60000,
       'たんじょうと最終更新の間隔が狂っている');
    // ずらす対象に漏れが無いか（未来に取り残された予定が無いこと）
    api.PET_TIMES.forEach(k => {
      if(api.pet[k]) ok(api.pet[k] <= clock.now() + 31 * 60000,
        `${k} が現在より先に取り残されている（${Math.round((api.pet[k]-clock.now())/60000)}分先）`);
    });
  });
  it('DAY は 1 未満にならない（時計がずれて たんじょうが未来でも）', () => {
    const { api, clock } = load();
    Object.assign(api.pet, api.defaultPet());
    api.birthPet('U');
    clock.set(clock.now() - 3 * 86400000);
    eq(api.petDay(), 1, 'たんじょうが未来のときの DAY:');
    eq(api.dayLabel(), 'DAY : 01', '画面に出る文字:');        // 「DAY : -2」と出ていた
  });
  it('名前をつけた時刻が、その子の起点になる', () => {
    const { api, clock } = load();
    const t0 = arriveAt(api, clock, 23);
    eq(api.pet.birth, t0, 'たんじょう:');
    eq(api.pet.lastTick, t0, '時間の進行の起点:');
    ok(api.pet.eggTargetEP > 0, '進化までの目標が決まること');
    eq(api.petDay(), 1, '1日目から始まること:');
  });

  // ── 到着の演出（ストーリーの書き出しに合わせた順番）──
  //   雨 →（音のない稲光＝）ビーム → ぴたりとやむ → 赤ちゃんが降りてくる
  //   コマごとのフェーズと雨の粒数を、演出を頭から流して調べる
  const arrivalTape = (api) => {
    const tape = [];
    for(let t=0; t<api.ARR_TOTAL; t++){
      api.arriveT = t;
      const { ph, t: tt } = api.arrivalPhase();
      tape.push({ t, ph, rain: api.arrivalRainShown(ph, tt) });
    }
    api.arriveT = -1;
    return tape;
  };
  it('雨がやむのは、ビームが伸びきったあと', () => {
    const { api } = load();
    const tape = arrivalTape(api);
    const beamDone = tape.findIndex(f => f.ph >= 2);            // ②が終わった最初のコマ
    const rainEnds = tape.findIndex(f => f.rain === 0);
    ok(beamDone > 0, 'ビームが伸びるフェーズが無い');
    ok(rainEnds > beamDone, `ビームが伸びきる前に雨がやんでいる（雨=${rainEnds} / ビーム=${beamDone}）`);
  });
  it('赤ちゃんが降りてくる前に、雨は完全にやんでいる', () => {
    const { api } = load();
    const tape = arrivalTape(api);
    const babyStarts = tape.findIndex(f => f.ph >= 3);
    ok(babyStarts > 0, '赤ちゃんが降りるフェーズが無い');
    const wet = tape.filter(f => f.t >= babyStarts && f.rain > 0);
    eq(wet.length, 0, `降下中に降り残っている（${wet.length}コマ）:`);
  });
  it('雨は最初から降っていて、しばらく続く', () => {
    const { api } = load();
    const tape = arrivalTape(api);
    eq(tape[0].rain, api.ARR_RAIN_N, '1コマ目から満量で降っていること:');
    const frames = tape.filter(f => f.rain > 0).length;
    ok(frames >= 25, `雨が読み取れるほど続かない（${frames}コマ＝${(frames/10).toFixed(1)}秒）`);
  });
  it('やむのは「ぴたりと」で、だらだら降り残さない', () => {
    const { api } = load();
    const tape = arrivalTape(api);
    const first = tape.findIndex(f => f.rain < api.ARR_RAIN_N);
    const last  = tape.findIndex(f => f.rain === 0);
    const span  = last - first;
    ok(span > 1, '1コマで消えると、止んだというより描き落としに見える');
    ok(span <= 8, `やむまでが長い（${span}コマ＝${(span/10).toFixed(1)}秒）`);
  });
  it('ビームは上から下へ伸び、途中は下端だけが動く', () => {
    const { api } = load();
    const top = api.ARR_BEAM_TOP, bot = api.MAIN_GY - 1;
    eq(api.arrivalBeamHalf(top, 0), -1, '進み0では光が無いこと:');
    ok(api.arrivalBeamHalf(top, 0.5) >= 0, '伸びる途中、上端には光が届いていること');
    eq(api.arrivalBeamHalf(bot, 0.5), -1, '半分しか伸びていないのに地面まで届いている:');
    ok(api.arrivalBeamHalf(bot, 1) >= 0, '伸びきっても地面に届いていない');
    // 下ほど広がる円錐であること
    let prev = -1;
    for(let y=top; y<=bot; y++){
      const h = api.arrivalBeamHalf(y, 1);
      ok(h >= prev, `y=${y} で幅が狭まっている（${prev}→${h}）`);
      prev = h;
    }
    ok(prev <= Math.floor(54/2), `地面際でも画面幅に収まること（半幅${prev}）`);
  });
  it('雨の粒はビームの外にも中にもかかる（どちらの色も使う）', () => {
    const { api } = load();
    api.resetArrivalRain();
    ok(api.arrRain.length === api.ARR_RAIN_N, '粒の数が合わない');
    // 粒は画面の幅いっぱいに湧く。中央のビームに掛かる位置も含まれること
    const half = api.arrivalBeamHalf(api.MAIN_GY - 1, 1);
    let inside = 0, outside = 0;
    for(let n=0; n<200; n++){
      api.resetArrivalRain();
      api.arrRain.forEach(d => (Math.abs(d.x - api.ARR_CX) <= half ? inside++ : outside++));
    }
    ok(inside > 0 && outside > 0, `片側にしか湧かない（中=${inside} 外=${outside}）`);
    api.arrRain.forEach(d => {
      ok(d.y >= api.ARR_BEAM_TOP && d.y < api.MAIN_GY, `粒が画面の外(y=${d.y})`);
      ok(d.speed > 0, '止まったままの粒がある');
    });
  });
  it('演出の長さが、待たされすぎない範囲に収まっている', () => {
    const { api } = load();
    const sec = api.ARR_TOTAL / 10;                              // tickMain は100msごと
    ok(sec >= 6, `短すぎて雨の場面が伝わらない（${sec}秒）`);
    ok(sec <= 13, `名前をつけるまでが長い（${sec}秒）`);
  });
});

// ══ ストーリー ════════════════════════════════════════════
//   原稿（MY LITTLE INVADER_text.rtf）を書き写したもの。
//   片方の言語だけ直して、もう片方が置いていかれるのを防ぐ
describe('ストーリー', () => {
  const blocks = a => {                       // 空行で区切られたかたまりに分ける
    const out = [[]];
    a.forEach(l => l ? out[out.length-1].push(l) : out.push([]));
    return out.filter(b => b.length);
  };
  it('日本語と英語で、段落の切れ目がそろっている', () => {
    const { api } = load();
    eq(blocks(api.STORY_EN).length, blocks(api.STORY_JA).length, 'かたまりの数:');
  });
  it('日本語はすべて かな（この機械は漢字を出さない）', () => {
    const { api } = load();
    const kanji = [...new Set(api.STORY_JA.join('').match(/[一-鿿]/g) || [])];
    eq(kanji.length, 0, `漢字が混ざっている（${kanji.join('')}）:`);
  });
  it('どちらの言語も、空の段落で始まったり終わったりしない', () => {
    const { api } = load();
    for(const [name, arr] of [['ja', api.STORY_JA], ['en', api.STORY_EN]]){
      ok(arr.length > 0, `${name}: 本文が無い`);
      ok(arr[0], `${name}: 先頭が空行`);
      ok(arr[arr.length-1], `${name}: 末尾が空行`);
      ok(!arr.some((l,i) => !l && !arr[i+1]), `${name}: 空行が続いている`);
    }
  });
  it('話の入口と結びが、どちらの言語にもある', () => {
    const { api } = load();
    ok(/あめ/.test(api.STORY_JA[0]), 'ja: 雨から始まっていない');
    ok(/rain/i.test(api.STORY_EN[0]), 'en: 雨から始まっていない');
    ok(/インベーダー/.test(api.STORY_JA[api.STORY_JA.length-1]), 'ja: インベーダーで結んでいない');
    ok(/invader/i.test(api.STORY_EN[api.STORY_EN.length-1]), 'en: インベーダーで結んでいない');
  });
  // 到着の演出は、この書き出し（雨 → 音のない雷 → ぴたりと止む）を絵にしたもの。
  //  文章から雨が消えたら、演出のほうも直さないと辻褄が合わなくなる
  // 上限まで詰めこむと、前のページが天井まで埋まって「改行が少なく詰まって見える」、
  //  そのしわ寄せで最後のページだけが すかすかになる。あまりを全ページに散らす
  const layout = lg => {
    const { api } = load({ storage: { myvader_lang: lg } });
    api.lang = lg;
    const { pages, LH } = api.buildStory();
    const avail = api.STORY_BOT - api.STORY_TOP;
    return { LH, pages, gaps: pages.map(pg => avail - pg.reduce((a, r) => a + r.pad + LH, 0)) };
  };
  it('ページごとの あまりが、そろっている', () => {
    for(const lg of ['ja', 'en']){
      const { LH, gaps } = layout(lg);
      const spread = Math.max(...gaps) - Math.min(...gaps);
      ok(spread <= LH * 2.5, `${lg}: ページごとの あまりが ばらついている（${spread}px＝${(spread/LH).toFixed(1)}行ぶん）`);
      ok(Math.min(...gaps) >= 0, `${lg}: 枠から はみ出している`);
    }
  });
  it('最後のページだけが すかすかにならない', () => {
    for(const lg of ['ja', 'en']){
      const { pages } = layout(lg);
      const most = Math.max(...pages.map(p => p.length));
      const last = pages[pages.length-1].length;
      ok(last >= most - 2, `${lg}: 最後のページが ${last}行 しかない（いちばん多いページは ${most}行）`);
    }
  });
  it('段落のあいだに 空きがある', () => {
    const { api } = load();
    ok(api.STORY_PARA >= 6, `段落の空きが ${api.STORY_PARA}px しかなく、かなの本文が壁のように見える`);
  });
  it('書き出しが、到着の演出と合っている', () => {
    const { api } = load();
    const head = api.STORY_JA.slice(0, 4).join('');
    ok(/あめ/.test(head), '書き出しに雨が無い');
    ok(/かみなり/.test(head), '書き出しに雷が無い');
    ok(/やんだ/.test(head), '雨がやむ場面が無い');
    ok(api.ARR_RAIN_N > 0, '演出のほうに雨が降っていない');
  });
});

// ══ エンディングの棲み分け ════════════════════════════════
describe('エンディング', () => {
  it('無関心な放置は帰還（E3）になる', () => {
    const { api, clock } = load();
    pet(api, clock, { B:40, M:0, larvaAt: clock.now() - 10*86400000, noTouchDays:6 });
    for(let i=0;i<5 && !api.pet.ufoFlag;i++) api.closeOneDay({hungry:1}, 0, false);
    ok(api.pet.ufoFlag, '帰還が確定するはず');
    ok(!api.pet.invadeFlag, '侵攻にはならない');
  });
  it('恨みが溜まっている間は、最終形態に届くまで帰還を止める', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', M:80, B:10, noTouchDays:6, larvaAt: clock.now() - 10*86400000 });
    for(let i=0;i<6;i++) api.closeOneDay({hungry:1}, 0, false);
    ok(!api.pet.ufoFlag, '出て行かず、居座って恨む');
  });
  it('最終形態のワイルド＋恨み＋低いなかよし＋昼夜逆転 で侵攻（E5）', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i3', formWild:true,
               M:100, B:5, P:80, noTouchDays:3, finalAt: clock.now() - 5*86400000 });
    for(let i=0;i<4 && !api.pet.invadeFlag;i++) api.closeOneDay({hungry:1}, 0, false);
    ok(api.pet.invadeFlag, '侵攻が確定するはず');
  });
  it('ワイルドでなければ、条件がそろっても侵攻しない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i1', formWild:false,
               M:100, B:5, P:80, noTouchDays:3, finalAt: clock.now() - 5*86400000 });
    for(let i=0;i<5;i++) api.checkInvade();
    ok(!api.pet.invadeFlag);
  });
  // C（ケア度）と帰還の兆候は見ている材料が違う。あそぶ・ほめるを毎日していれば
  //  兆候はそろわないが、ごはん・そうじ・病気を放置すればCは落ちる
  it('帰還しない程度の放置でも、プリックリーにはなる', () => {
    const { api, clock } = load();
    pet(api, clock, { C:60, B:40, careStreak:2,
                      larvaAt: clock.now() - 10*86400000, snapL:{praise:0,bad:0,plays:0} });
    let wildAt = 0;
    for(let d=1; d<=10; d++){
      const p = api.pet;
      p.dayKey = ''; p.plays.sw++; p.praiseCount++;
      api.markTouch('play'); api.markTouch('praise');
      api.gainB(2,'play'); api.gainB(1,'praise');
      api.closeOneDay({ hungry:1, dirty:1, sick:1, playSw:1 }, p.touchCount, false);
      p.touchCount = 0; p.touchKinds = {};
      if(!wildAt && p.C < 40) wildAt = d;
    }
    ok(wildAt > 0, `Cが40を割るはず（実際 ${api.pet.C}）`);
    ok(!api.pet.ufoFlag, '帰還は確定しないこと');
    // 帰還の線は「ふれあいゼロが続く」か「兆候が2つ以上」。あそぶ・ほめるがある限り届かない
    const sg = api.returnSigns();
    ok(!sg.includes('notouch') && sg.length < 2, `兆候が帰還の線に届かないこと（実際 [${sg}]）`);
  });
  // 放置だけではPが下がる（構えば構うほど落ち着く）ので、昼夜逆転の条件に届かない。
  //  侵攻は「睡眠妨害・不当なしかる・夜更かしさせる」を重ねた時だけ
  it('プリックリーになっても、放置だけなら侵攻は確定しない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i3', formWild:true,
               C:21, M:100, B:0, P:-100, noTouchDays:0, lowBDays:10,
               finalAt: clock.now() - 15*86400000, lastTick: clock.now() - 3600000 });
    ok(api.isWild(), 'プリックリーであること');
    ok(!api.invadeSigns(), 'Pが低いので侵攻の兆候は立たない');
    for(let i=0;i<5;i++) api.checkInvade();
    ok(!api.pet.invadeFlag, '侵攻しないこと');
    api.advancePet();                       // 最終形態から14日 → プリックリーの幕引き
    ok(api.pet.ufoFlag, '行き止まりにはならず、静かな幕引きが来る');
    eq(api.diaryLog.slice(-1)[0].t, ['farewellWild']);
  });
  it('ワイルドにはお迎え（E4）が来ない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i3', formWild:true,
               B:90, health:'GOOD', finalAt: clock.now() - 20*86400000,
               lastTick: clock.now() - 120000, touchCount:2 });
    api.advancePet();
    ok(!api.pet.departFlag, '旅立ちは出ない');
    ok(api.pet.ufoFlag, 'かわりに静かな帰還で幕が下りる');
  });
  //  住み分け：家出は「世話をしなかった」結果だけに残す。
  //  育ちきらなかった子・立て直した子は、迎えが来る帰還で受ける
  it('家出と帰還の住み分け', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    //  家出（ufoFlag）を立てるのは、疎遠が続いた時と、とげとげのまま立て直せなかった時だけ
    const ufo = [...src.matchAll(/pet\.ufoFlag = true;/g)].length;
    eq(ufo, 2, '家出の入口の数:');
    //  帰還（homeFlag）は3つ。成体の時間切れ、とげとげの立て直し、
    //  そして最終形態まで来たのに なかよしが旅立ちの線に届かなかった子
    const home = [...src.matchAll(/pet\.homeFlag = true;/g)].length;
    eq(home, 3, '帰還の入口の数:');
    //  それぞれの日記が対応していること
    for(const [flag, tags] of [['ufoFlag', ['farewell','farewellWild']],
                               ['homeFlag', ['broughtHome','redeemed']]])
      for(const t of tags)
        ok(src.includes(`t: ['${t}']`), `${flag} 側の日記 ${t} が無い`);
  });
  //  とげとげの行き先は3つ。立て直せば帰還、そのままなら家出、
  //  恨みを溜めたまま放置すれば侵攻。姿は変えられないが行き先は変えられる
  const wildPet = (api, clock, over) => pet(api, clock, Object.assign({
    stage:'final', lineage:'inv', form:'i3', formWild:true, health:'GOOD',
    finalAt: clock.now() - 15*86400000, lastTick: clock.now() - 120000,
    larvaAt: clock.now() - 40*86400000, snapL:{praise:0,bad:0,plays:0},
    praiseCount:99, touchCount:3, plays:{sw:30,ss:30,ab:30},
    B:70, C:80, M:0, P:0, careStreak:0 }, over));

  it('とげとげでも、立て直せば迎えが来る', () => {
    const { api, clock } = load();
    wildPet(api, clock, { careStreak: api.REDEEM_DAYS, M: api.WRATH_HOLD - 1 });
    ok(api.redeemed(), '立て直しの条件を満たしていること');
    api.advancePet();
    ok(api.pet.homeFlag, '帰還になること');
    ok(api.pet.homeRedeem, '立て直しとして記録されること');
    ok(!api.pet.ufoFlag, '家出にはならないこと');
    eq(api.diaryLog[api.diaryLog.length-1].t, ['redeemed'], '日記は立て直しのもの:');
  });
  it('とげとげのまま立て直さなければ、黙って出ていく', () => {
    const { api, clock } = load();
    wildPet(api, clock, { careStreak: api.REDEEM_DAYS - 1, M: api.WRATH_HOLD - 1 });
    ok(!api.redeemed(), '立て直しには足りないこと');
    api.advancePet();
    ok(api.pet.ufoFlag, '家出になること');
    ok(!api.pet.homeFlag, '帰還にはならないこと');
    eq(api.diaryLog[api.diaryLog.length-1].t, ['farewellWild'], '日記は家出のもの:');
  });
  it('立て直しは、世話を続けることと恨みを薄れさせることの両方が要る', () => {
    const { api, clock } = load();
    wildPet(api, clock, {});
    const q = api.pet;
    q.careStreak = api.REDEEM_DAYS;     q.M = api.WRATH_HOLD;
    ok(!api.redeemed(), '恨みが残っていれば立て直しではない');
    q.careStreak = api.REDEEM_DAYS - 1; q.M = 0;
    ok(!api.redeemed(), '世話の続きが足りなければ立て直しではない');
    q.careStreak = api.REDEEM_DAYS;     q.M = api.WRATH_HOLD - 1;
    ok(api.redeemed(), '両方そろえば立て直し');
  });
  //  とげとげに旅立ちは来ない。立て直しても、行き先は帰還どまり
  it('とげとげには旅立ちが来ない', () => {
    const { api, clock } = load();
    wildPet(api, clock, { careStreak: api.REDEEM_DAYS, M: 0, B: 100 });
    api.advancePet();
    ok(!api.pet.departFlag, '旅立ちは開かないこと');
    ok(api.pet.homeFlag, '帰還のほうになること');
  });
  //  行き止まり対策：最終形態のとげとげ以外には期限が無いので、なつかれないまま
  //  固まると どの結末にも辿り着けなくなる。lowB を単独で成立させて受ける
  it('なつかれないまま固まった子にも、いつかは結末が来る', () => {
    const { api, clock } = load();
    //  ごはんも掃除もしている（notouch は立たない）が、なかよしだけが低いまま
    pet(api, clock, { stage:'final', lineage:'inv', form:'i1', formWild:false, health:'GOOD',
                      B:5, lowBDays:5, C:80, M:0, praiseCount:99, touchCount:3,
                      plays:{sw:30,ss:30,ab:30}, snapL:{praise:0,bad:0,plays:0},
                      noTouchDays:0, estrangedDays:0,
                      larvaAt: clock.now() - 40*86400000, finalAt: clock.now() - 20*86400000 });
    eq(api.returnSigns(), ['lowB'], '立つ兆候はこれだけ:');
    for(let d=0; d<api.RET_ESTR_DAYS; d++) api.checkReturn();
    ok(api.pet.ufoFlag, `なつかれないままなら ${api.RET_ESTR_DAYS}日で家出になること`);
  });
  //  ごはんは与えているが、ほかは何もしない。丁寧に育てた履歴があると
  //  ほめる／遊ぶの通算は足りているので、立つ兆候は notouch だけになる
  it('ふれあいゼロが続けば、それだけで家出になる', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i1', formWild:false, health:'GOOD',
                      B:80, lowBDays:0, C:80, M:0, praiseCount:99, touchCount:0,
                      plays:{sw:30,ss:30,ab:30}, snapL:{praise:0,bad:0,plays:0},
                      noTouchDays: api.RET_NOTOUCH_DAYS, estrangedDays:0,
                      larvaAt: clock.now() - 40*86400000, finalAt: clock.now() - 20*86400000 });
    eq(api.returnSigns(), ['notouch'], '立つ兆候はこれだけ:');
    for(let d=0; d<api.RET_ESTR_DAYS; d++) api.checkReturn();
    ok(api.pet.ufoFlag, `ふれあいゼロなら ${api.RET_ESTR_DAYS}日で家出になること`);
  });
  it('兆候が1つでも、ふれあいもなつきも足りていれば家出にはならない', () => {
    const { api, clock } = load();
    //  「遊んでいない」だけの子。ふれあいはあり、なつかれてもいる
    pet(api, clock, { stage:'adult', lineage:'inv', B:80, lowBDays:0, C:80, M:0,
                      praiseCount:99, touchCount:3, plays:{sw:0,ss:0,ab:0},
                      snapL:{praise:0,bad:0,plays:0}, noTouchDays:0, estrangedDays:0,
                      larvaAt: clock.now() - 40*86400000 });
    eq(api.returnSigns(), ['play'], '立つ兆候はこれだけ:');
    for(let d=0; d<api.RET_ESTR_DAYS + 2; d++) api.checkReturn();
    ok(!api.pet.ufoFlag, '1つだけでは家出にならないこと');
  });
  //  成体の期限（STUCK_DAYS）は「最終形態に届かないまま止まった子」のための区切り。
  //  最終形態まで来た子には、それぞれの行き先があるので効かせてはいけない
  //  以前ここは「最終形態まで来た子には何も来ない」を正しいこととして書いていた。
  //  それが行き止まりだった。なかよしが20〜59で固まると、旅立ち（60以上）も
  //  家出（lowB は20未満）も来ず、どの結末にも辿り着けなかった
  it('最終形態でも なかよしが届かなければ、迎えが来る', () => {
    const { api, clock } = load();
    const put = (B) => pet(api, clock, { stage:'final', lineage:'inv', form:'i2', formWild:false,
                      health:'GOOD', B, C:80, M:0, praiseCount:99, touchCount:3,
                      plays:{sw:30,ss:30,ab:30}, snapL:{praise:0,bad:0,plays:0},
                      larvaAt: clock.now() - 60*86400000,
                      finalAt:  clock.now() - (api.FINAL_DAYS + 1)*86400000,
                      lineageAt: clock.now() - (api.FINAL_DAYS + 3)*86400000,
                      lastTick: clock.now() - 120000 });
    for(const B of [25, 40, 55, 59]){
      put(B); api.advancePet();
      ok(api.pet.homeFlag, `なかよし${B} で結末が来ない（行き止まり）`);
      ok(!api.pet.homeRedeem, `なかよし${B} が立て直し扱いになっている`);
      ok(!api.pet.departFlag, `なかよし${B} で旅立ってしまう`);
    }
    //  60以上なら今までどおり旅立ち
    put(60); api.advancePet();
    ok(api.pet.departFlag, 'なかよし60で旅立たない');
    ok(!api.pet.homeFlag, 'なかよし60なのに迎えが来ている');
  });
  //  成体の期限（STUCK_DAYS）そのものは、最終形態まで来た子には効かない。
  //  最終形態は自分の期限（FINAL_DAYS／通し上限）で終わる
  it('成体の期限では、最終形態の子を連れて行かない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i2', formWild:false, health:'GOOD',
                      B:30, C:80, M:0, praiseCount:99, touchCount:3, plays:{sw:30,ss:30,ab:30},
                      snapL:{praise:0,bad:0,plays:0}, larvaAt: clock.now() - 60*86400000,
                      finalAt:  clock.now(),                              // なったばかり
                      //  成体の期限（28日）を過ぎてから最終形態になることは無い。
                      //  期限の判定が進化より先にあるので、その前に迎えが来る
                      lineageAt: clock.now() - (api.STUCK_DAYS - 1)*86400000,
                      lastTick: clock.now() - 120000 });
    api.advancePet();
    ok(!api.pet.homeFlag, '成体の期限で連れて行かれないこと');
    ok(!api.pet.ufoFlag,  '家出にもならないこと');
  });
  //  最終形態から14日を足すと、成体で粘った子ほど長く一緒にいられる逆転が起きる。
  //  成体到達からの通しで頭を打つ
  it('幕引きは、成体到達からの通し上限を超えない', () => {
    const { api, clock } = load();
    const D = 86400000;
    ok(api.FINAL_CAP > api.FINAL_DAYS, '通し上限が最終形態の日数より短い');
    //  早く最終形態になった子は、満額いられる
    let q = { finalAt: clock.now() - 100*D, lineageAt: clock.now() - 105*D };
    eq(api.finalDue(q), q.finalAt + api.FINAL_DAYS*D, '早く着いた子の幕引き:');
    //  遅く最終形態になった子は、通し上限で切られる
    q = { finalAt: clock.now() - 100*D, lineageAt: clock.now() - 125*D };
    eq(api.finalDue(q), q.lineageAt + api.FINAL_CAP*D, '遅く着いた子の幕引き:');
    //  最終形態になっていない子には期限が無い
    eq(api.finalDue({ finalAt:0, lineageAt: clock.now() }), Infinity, '最終形態前の幕引き:');
    //  甘やかしルート（毎日通う人は成体到達から15日で成立）は満額いられること
    const late = api.STUCK_DAYS;                       // 成体到達からの日数
    ok(15 + api.FINAL_DAYS <= api.FINAL_CAP,
       `甘やかしが満額いられない（成立15日＋${api.FINAL_DAYS}日 > 上限${api.FINAL_CAP}日）`);
    ok(late + api.FINAL_DAYS > api.FINAL_CAP,
       '上限がゆるすぎて、逆転が残る');
  });
  //  猶予は「入っているか」だけでなく「守られるか」まで見る。
  //  幕引きの判定が endGrace を読まなければ、猶予を入れた意味が無い
  it('猶予のあいだは、幕引きが来ない', () => {
    const { api, clock } = load();
    const D = 86400000;
    const put = (grace) => pet(api, clock, { stage:'final', lineage:'inv', form:'i2',
      formWild:false, health:'GOOD', B:90, C:80, M:0, praiseCount:99, touchCount:3,
      plays:{sw:30,ss:30,ab:30}, snapL:{praise:0,bad:0,plays:0},
      larvaAt: clock.now() - 60*D,
      finalAt: clock.now() - (api.FINAL_DAYS + 2)*D,       // 期限は過ぎている
      lineageAt: clock.now() - (api.FINAL_DAYS + 4)*D,
      endGrace: grace, lastTick: clock.now() - 120000 });
    put(clock.now() + 2*D); api.advancePet();
    ok(!api.pet.departFlag && !api.pet.homeFlag && !api.pet.ufoFlag,
       '猶予の内側なのに幕引きが来ている');
    put(clock.now() - 1000); api.advancePet();
    ok(api.pet.departFlag, '猶予が明けたのに幕引きが来ない');
  });
  //  成体の期限（STUCK_DAYS）は成体だけのもの。最終形態には自分の期限がある。
  //  ここが混ざると、最終形態になったばかりの子まで成体の期限で連れて行かれる
  it('成体の期限は、成体の子にしか効かない', () => {
    const { api, clock } = load();
    const D = 86400000;
    //  成体の期限は過ぎているが、最終形態の期限（通し上限）はまだ来ていない状態
    pet(api, clock, { stage:'final', lineage:'inv', form:'i2', formWild:false,
      health:'GOOD', B:90, C:80, M:0, praiseCount:99, touchCount:3,
      plays:{sw:30,ss:30,ab:30}, snapL:{praise:0,bad:0,plays:0},
      larvaAt: clock.now() - 60*D,
      finalAt:   clock.now() - 1*D,
      lineageAt: clock.now() - (api.FINAL_CAP - 1)*D,
      lastTick: clock.now() - 120000 });
    ok((api.FINAL_CAP - 1) > api.STUCK_DAYS,
       `成体の期限(${api.STUCK_DAYS})を過ぎた状態を作れていない`);
    ok(api.finalDue() > clock.now(), '最終形態の期限まで来てしまっている');
    api.advancePet();
    ok(!api.pet.homeFlag, '成体の期限で連れて行かれている');
    ok(!api.pet.ufoFlag && !api.pet.departFlag, 'ほかの結末も来ないこと');
  });
  //  上限を後から入れたので、すでに越えている子は更新した瞬間に終わってしまう
  it('更新で いきなり終わらないよう、育っている子には猶予を与える', () => {
    const { api, clock } = load();
    const D = 86400000;
    const sv = { v:2, name:'T', stage:'final', lineage:'inv', form:'i2', formWild:false,
                 B:30, health:'GOOD', finalAt: clock.now() - 40*D, lineageAt: clock.now() - 60*D };
    const p = api.migratePet(sv);
    ok(p.endGrace > clock.now(), '猶予が入っていない（更新した瞬間に終わる）');
    ok(p.endGrace <= clock.now() + api.END_GRACE_MS + 1000, `猶予が長すぎる: ${p.endGrace - clock.now()}`);
    //  まだ期限に達していない子には、余計な猶予を付けない
    const fresh = api.migratePet({ v:2, name:'T', stage:'final', lineage:'inv', form:'i2',
                                   finalAt: clock.now(), lineageAt: clock.now() });
    eq(fresh.endGrace, 0, 'まだ期限前の子の猶予:');
  });
  it('成体のまま長くとどまった子には、やがて迎えが来る', () => {
    const { api, clock } = load();
    // 世話は行き届いていて放置の兆候も無いが、最終形態の条件に届いていない子
    pet(api, clock, { stage:'adult', lineage:'inv', form:'', EP:30, C:55,
                      B:100, health:'GOOD', best:{sw:0,ss:0,ab:0},
                      fullFeeds:0, sickCount:0, praiseCount:99, touchCount:3,
                      plays:{sw:30, ss:30, ab:30},          // 遊んでもいる（放置の兆候を出さない）
                      snapL:{praise:0, bad:0, plays:0},
                      larvaAt: clock.now() - 40*86400000,
                      lineageAt: clock.now() - (api.STUCK_DAYS - 1)*86400000,
                      lastTick: clock.now() - 120000 });
    eq(api.returnSigns(), [], '放置の兆候は無い:');
    api.advancePet();
    ok(!api.pet.ufoFlag, `${api.STUCK_DAYS}日たつまでは来ない`);
    api.pet.lineageAt = clock.now() - (api.STUCK_DAYS + 1)*86400000;
    api.pet.lastTick  = clock.now() - 120000;
    api.advancePet();
    ok(api.pet.homeFlag, `${api.STUCK_DAYS}日を過ぎたら迎えが来る`);
    ok(!api.pet.ufoFlag, '家出ではなく帰還であること');
    ok(!api.pet.homeRedeem, '立て直しではなく時間切れとして記録されること');
    eq(api.pet.stage, 'adult', '成体のまま連れて行かれる:');
    //  世話はしていたのだから、黙って出ていく別れにはしない
    eq(api.diaryLog[api.diaryLog.length-1].t, ['broughtHome'], '日記は帰還のもの:');
  });
  // 21日だったころ、「週に1日だけ休む」人の甘やかしは成立と期限が同じ日になり、
  //  間に合わなかった。なかよしは1日に3までしか伸びず、休んだ日は5下がるので、
  //  B80まで積むのに時間がかかる。期限のほうを1週間ぶん延ばして直した
  it('週に1日休みながら通う人でも、甘やかしが期限に間に合う', () => {
    const { api, clock } = load();
    Object.assign(api.pet, api.defaultPet(), { name:'T', stage:'adult', lineage:'inv' });
    api.pet.B = 35; api.pet.careStreak = 2;
    api.pet.total = { feed:0, snack:0, clean:0, med:0 };
    const ADULT_DAY = 7;                       // 成体になるのは7日目あたり
    let at = 0;
    for(let d=1; d<=60 && !at; d++){
      api.pet.dayKey = '';
      if(d % 7 !== 0){                         // 週に1日だけ休む
        api.pet.total.snack += 2;
        api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack'); api.gainB(1,'feed');
        api.closeOneDay({ playSw:1 }, 3, false);
      } else {
        api.closeOneDay({}, 0, false);
      }
      if(api.pampered()) at = d;
    }
    ok(at > 0, `甘やかしが成立しないまま60日たった（B=${api.pet.B}）`);
    // ちょうど期限の日に成立するのでは「間に合った」とは言えない。数日の余裕を求める
    const margin = ADULT_DAY + api.STUCK_DAYS - at;
    ok(margin >= 5,
       `余裕が${margin}日しかない（成立${at}日目 / 期限${ADULT_DAY + api.STUCK_DAYS}日目）`);
  });
  it('毎日通う人には、この期限は邪魔をしない', () => {
    const { api, clock } = load();
    Object.assign(api.pet, api.defaultPet(), { name:'T', stage:'adult', lineage:'inv' });
    api.pet.B = 35; api.pet.careStreak = 2;
    api.pet.total = { feed:0, snack:0, clean:0, med:0 };
    let at = 0;
    for(let d=1; d<=60 && !at; d++){
      api.pet.dayKey = '';
      api.pet.total.snack += 2;
      api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack'); api.gainB(1,'feed');
      api.closeOneDay({ playSw:1 }, 3, false);
      if(api.pampered()) at = d;
    }
    ok(at > 0, `毎日通っても甘やかしが成立しない（B=${api.pet.B}）`);
    const margin = 7 + api.STUCK_DAYS - at;
    ok(margin >= 7, `毎日通っても余裕が${margin}日しかない（成立${at}日目）`);
  });
  it('期限は現実的な長さである', () => {
    const { api } = load();
    ok(api.STUCK_DAYS >= 21 && api.STUCK_DAYS <= 60,
       `成体で止まる期限が極端（${api.STUCK_DAYS}日）`);
  });
  it('最終形態になった子は、成体の期限では連れて行かれない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i2', formWild:false,
                      B:100, health:'GOOD',
                      lineageAt: clock.now() - 60*86400000,
                      finalAt:   clock.now() - 2*86400000,
                      lastTick:  clock.now() - 120000, touchCount:3 });
    api.advancePet();
    ok(!api.pet.ufoFlag, '最終形態には別の区切りがある');
  });
  it('ワイルドでなければ、条件を満たすとお迎えが来る', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i1', formWild:false,
               B:90, health:'GOOD', finalAt: clock.now() - 20*86400000,
               lastTick: clock.now() - 120000, touchCount:2 });
    api.advancePet();
    ok(api.pet.departFlag, '旅立ちが確定するはず');
  });
});

// ══ 天気 ══════════════════════════════════════════════════
describe('天気', () => {
  //  見た目は8通りだが、ゲームへの効きかたは4通りのまま。
  //  薄曇りは「雲は出るが、キャラへの影響は晴れと同じ」
  const KINDS = ['clear','thin','cloudy','rain','rainHeavy','storm','snow','snowHeavy'];

  it('WMOコードの強度を拾っている', () => {
    const { api } = load();
    const want = {
      0:'clear', 1:'clear', 2:'thin', 3:'cloudy', 45:'cloudy', 48:'cloudy',
      51:'rain', 53:'rain', 61:'rain', 63:'rain', 80:'rain', 81:'rain',
      55:'rainHeavy', 65:'rainHeavy', 82:'rainHeavy',
      95:'storm', 96:'storm', 99:'storm',
      71:'snow', 73:'snow', 77:'snow', 85:'snow', 56:'snow', 57:'snow', 66:'snow', 67:'snow',
      75:'snowHeavy', 86:'snowHeavy',
    };
    for(const [code, w] of Object.entries(want))
      eq(api.codeToWeather(+code), w, `コード${code}:`);
  });
  it('見た目8通りが、ゲームでは4通りに畳まれる', () => {
    const { api } = load();
    for(const k of KINDS) ok(api.WEATHER_BASE[k], `${k} の扱いが決まっていない`);
    eq(new Set(Object.values(api.WEATHER_BASE)).size, 4, 'ゲーム側の種類:');
    //  雨・大雨・嵐は同じ扱い（影響度は変えない）
    eq(api.weatherBase('rainHeavy'), api.weatherBase('rain'), '大雨:');
    eq(api.weatherBase('storm'),     api.weatherBase('rain'), '嵐:');
    eq(api.weatherBase('snowHeavy'), api.weatherBase('snow'), '大雪:');
  });
  it('薄曇りは晴れ扱い', () => {
    const { api } = load();
    eq(api.weatherBase('thin'), 'clear', '薄曇りの扱い:');
    api.weather = 'thin';
    eq(api.isBadWeather(), false, '薄曇りが悪天候になっている:');
    api.weather = 'cloudy';
    eq(api.weatherBase(), 'cloudy', '曇りは曇りのまま:');
  });
  it('悪天候は雨と雪だけ', () => {
    const { api } = load();
    const bad = KINDS.filter(k => { api.weather = k; return api.isBadWeather(); });
    eq(bad, ['rain','rainHeavy','storm','snow','snowHeavy'], '悪天候になるもの:');
  });
  //  強度は 本数・速さ・線の長さ で描き分ける。ここが同じだと見分けがつかない
  it('雨は3段、雪は2段で濃さが変わる', () => {
    const { api } = load();
    const R = api.RAIN_STYLE, S = api.SNOW_STYLE;
    eq(Object.keys(R), ['rain','rainHeavy','storm'], '雨の段:');
    eq(Object.keys(S), ['snow','snowHeavy'], '雪の段:');
    //  雨→大雨→嵐 で、本数も速さも増える
    ok(R.rain.n < R.rainHeavy.n && R.rainHeavy.n < R.storm.n,
       `本数が増えていない: ${R.rain.n},${R.rainHeavy.n},${R.storm.n}`);
    ok(R.rain.spd < R.rainHeavy.spd && R.rainHeavy.spd < R.storm.spd,
       `速さが増えていない: ${R.rain.spd},${R.rainHeavy.spd},${R.storm.spd}`);
    //  横なぐりは嵐だけ
    eq(R.rain.slant, 0, '雨に傾きが付いている:');
    eq(R.rainHeavy.slant, 0, '大雨に傾きが付いている:');
    ok(R.storm.slant > 0, '嵐に傾きが付いていない');
    //  用意してある粒の数が足りているか（足りないと嵐で薄くなる）
    ok(api.RAIN_MAX >= R.storm.n, `雨粒の用意が足りない: ${api.RAIN_MAX} < ${R.storm.n}`);
    ok(api.SNOW_MAX >= S.snowHeavy.n, `雪粒の用意が足りない: ${api.SNOW_MAX} < ${S.snowHeavy.n}`);
    ok(S.snow.n < S.snowHeavy.n, `雪→大雪 で粒が増えていない: ${S.snow.n},${S.snowHeavy.n}`);
  });
  //  晴れた昼だけ、ときどき鳥が横切る。夜の流れ星・曇りの夜のUFOと対になる出来事
  it('鳥は晴れた昼だけ飛ぶ', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    //  太陽を出す枝（＝晴れか薄曇りの昼）の中で、さらに晴れに絞って呼んでいること
    const at = src.indexOf("stamp(ctxM, SUN,");
    ok(at > 0, '太陽を描く場所が見つからない');
    const seg = src.slice(at, at + 300);
    ok(/if \(weather === 'clear'\) updateBirds\(DM\);/.test(seg),
       '鳥が晴れの昼に結びついていない');
    //  夜の枝（timeOfDay==='night' から 太陽の枝の手前まで）には入っていないこと
    const nightAt = src.indexOf("} else if (timeOfDay==='night') {");
    ok(nightAt > 0 && nightAt < at, '夜の枝が見つからない');
    ok(!/updateBirds/.test(src.slice(nightAt, at)), '夜にも鳥が飛んでいる');
    //  呼んでいるのは1か所だけ
    eq((src.match(/updateBirds\(/g) || []).length, 2, '鳥を呼ぶ場所（定義1＋呼び出し1）:');
  });
  it('鳥は2羽で、はばたく', () => {
    const { api } = load();
    eq(api.BIRD_GAP.length, 2, '羽の数:');
    //  2羽が重ならない。翼を広げた幅より離れていること
    const w = api.BIRD_UP[0].length;
    ok(Math.abs(api.BIRD_GAP[1][0] - api.BIRD_GAP[0][0]) >= w, '2羽が重なる');
    ok(JSON.stringify(api.BIRD_UP) !== JSON.stringify(api.BIRD_DOWN), 'はばたきの2コマが同じ');
    ok(api.BIRD_SPEED > 0, '鳥が進まない');
  });
  //  3×2 の「へ」の字だと点にしか見えなかった。
  //  胴を固定して翼の先だけ上下させると、羽ばたきとして読める
  //   手前は片翼2ドット、遠ざかったら1ドット。どちらも同じ決まりで組む
  const birdPair = (up, dn, wing, lbl) => {
    eq(up.length, dn.length, `${lbl} コマの高さ:`);
    ok(up.length >= 3, `${lbl} 段が足りない（翼を振る余地がない）: ${up.length}`);
    ok(up[0].length >= wing * 2 + 1, `${lbl} 幅が足りない（翼が広がらない）: ${up[0].length}`);
    //  まん中が胴。2コマで動かないこと
    const mid = (up.length - 1) >> 1;
    eq(up[mid], dn[mid], `${lbl} 胴の段（動いてしまっている）:`);
    ok(up[mid].some(v => v), `${lbl} 胴が空`);
    //  翼の先は、上げた時は胴より上・下げた時は胴より下
    ok(up[mid-1].some(v => v) && !up[mid+1].some(v => v), `${lbl} 翼を上げた形になっていない`);
    ok(dn[mid+1].some(v => v) && !dn[mid-1].some(v => v), `${lbl} 翼を下げた形になっていない`);
    //  胴は1ドット
    eq(up[mid].filter(v => v).length, 1, `${lbl} 胴のドット数:`);
    //  翼は片側 wing ドット。段をまたいで斜めに置く（横一列だと棒に見える）
    const half = (up[0].length - 1) >> 1;
    const side = (rows, from, to) => rows.reduce((a, r) => a + r.slice(from, to).filter(v => v).length, 0);
    const wingRows = up.slice(0, mid);
    eq(side(wingRows, 0, half), wing, `${lbl} 左の翼のドット数:`);
    eq(side(wingRows, half + 1, up[0].length), wing, `${lbl} 右の翼のドット数:`);
    //  同じ段に2つ並んでいたら水平＝棒。段が分かれていること
    for(const r of wingRows){
      ok(r.slice(0, half).filter(v => v).length <= 1, `${lbl} 左の翼が水平に並んでいる: ${r.join('')}`);
      ok(r.slice(half + 1).filter(v => v).length <= 1, `${lbl} 右の翼が水平に並んでいる: ${r.join('')}`);
    }
    //  外へ行くほど上（胴から離れるほど高い）
    if(wing >= 2){
      const tipX = up[0].findIndex(v => v), innerX = up[1].findIndex(v => v);
      ok(tipX < innerX, `${lbl} 翼の先が内側より外にない: 先${tipX} 内${innerX}`);
    }
  };
  it('鳥は胴を動かさず、翼だけ振る', () => {
    const { api } = load();
    birdPair(api.BIRD_UP, api.BIRD_DOWN, 2, '手前');
  });

  //  画面の半分を過ぎたら翼を1ドット減らして、遠ざかっていくように見せる。
  //  小さくしても胴の位置は動かさない（縮んだ拍子に跳ねたら、飛び方が変わって見える）
  it('鳥は後半、翼が1ドット減って小さくなる', () => {
    const { api } = load();
    birdPair(api.BIRD_FAR_UP, api.BIRD_FAR_DOWN, 1, '遠く');
    const dots = g => g.reduce((a, r) => a + r.filter(v => v).length, 0);
    ok(dots(api.BIRD_FAR_UP) < dots(api.BIRD_UP),
       `遠くの鳥(${dots(api.BIRD_FAR_UP)})が手前(${dots(api.BIRD_UP)})より小さくない`);
    //  切り替えは画面を横切る途中で起きること
    ok(api.BIRD_FAR_X > 0 && api.BIRD_FAR_X < 1, `切り替え位置がおかしい: ${api.BIRD_FAR_X}`);
    //  遠近・はばたきの4通りとも、ずれを足した胴の位置が同じ
    const bodyAt = (far, t) => {
      const s = api.birdSprite(t, far);
      const row = (s.spr.length - 1) >> 1;
      return [s.dx + s.spr[row].findIndex(v => v), s.dy + row].join(',');
    };
    const at = [bodyAt(false, 0), bodyAt(false, api.BIRD_FLAP), bodyAt(true, 0), bodyAt(true, api.BIRD_FLAP)];
    eq(new Set(at).size, 1, `胴の位置がそろっていない [${at.join(' / ')}] 種類:`);
    //  実際に位置で切り替えていること
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const at2 = src.indexOf('function updateBirds');
    const bodySrc = src.slice(at2, src.indexOf('\n  }', at2));
    ok(/birds\.x\s*<\s*W\s*\*\s*BIRD_FAR_X/.test(bodySrc), '遠近を鳥の位置で切り替えていない');
  });

  //  薄曇りは天体が見える。曇りは天体を隠すので、雲は薄曇りより多い
  it('天体が見えるのは 晴れ と 薄曇り だけ', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(/const skyOpen = \(weather === 'clear' \|\| weather === 'thin'\);/.test(src),
       '天体を出す条件が 晴れ・薄曇り になっていない');
    const { api } = load();
    ok(api.CLOUD_THIN < api.CLOUD_N,
       `薄曇りの雲(${api.CLOUD_THIN})が曇り(${api.CLOUD_N})以上ある`);
    ok(api.CLOUD_THIN > 0, '薄曇りに雲が無い');
  });
});

// ══ 地面の花 ══════════════════════════════════════════════
describe('地面の花', () => {
  //  最終形態まで来ると育成画面の変化が止まるので、そのあとも日々が動いていると分かるように、
  //  20日目から5日かけて少しずつ咲かせる
  it('20日目から咲きはじめ、5日でそろう', () => {
    const { api } = load();
    const N = api.FLOWERS.length;
    //  最終形態は通算17日ごろ。そこまでは進化そのものが画面の変化なので、
    //  花はそのあとから咲かせる。ここを早めると、育っている最中に咲いてしまう
    ok(api.FLOWER_DAY >= 18, `咲きはじめが早すぎる: DAY${api.FLOWER_DAY}`);
    ok(api.FLOWER_SPAN >= 3, `咲きそろうのが急すぎる: ${api.FLOWER_SPAN}日`);
    eq(api.flowerCount(api.FLOWER_DAY - 1), 0, '前日はまだ咲かない:');
    ok(api.flowerCount(api.FLOWER_DAY) > 0, '20日目に咲きはじめていない');
    eq(api.flowerCount(api.FLOWER_DAY + api.FLOWER_SPAN - 1), N, '5日目で咲きそろう:');
    eq(api.flowerCount(api.FLOWER_DAY + 20), N, 'そのあとも増えも減りもしない:');
  });
  it('本数は減らずに増えていく', () => {
    const { api } = load();
    let prev = 0;
    for(let d = api.FLOWER_DAY - 2; d <= api.FLOWER_DAY + api.FLOWER_SPAN + 2; d++){
      const n = api.flowerCount(d);
      ok(n >= prev, `DAY${d} で減っている: ${prev}→${n}`);
      prev = n;
    }
  });
  //  皿は大きくて出ている時間も長いので、そこに咲かせると隠れっぱなしになる
  it('花は皿の帯を避け、画面にも収まる', () => {
    const { api } = load();
    const w = api.FLOWER_SPR[0][0].length;
    for(const [x] of api.FLOWERS){
      ok(!(x < api.PLATE_X + 11 && x + w > api.PLATE_X), `x=${x} が皿の帯と重なる`);
      ok(x >= 0 && x + w <= 54, `x=${x} が画面からはみ出す`);
    }
    //  花どうしがくっつかない
    const xs = api.FLOWERS.map(f => f[0]).sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)
      ok(xs[i] - xs[i-1] >= w, `x=${xs[i-1]} と x=${xs[i]} がくっついている`);
  });
  //  「全部同じ高さ」だと並木のように見えるので、育ち具合で背丈を変える。
  //  まだ咲いていない双葉はいちばん低い
  it('花は3種あり、背丈がばらけている', () => {
    const { api } = load();
    eq(api.FLOWER_SPR.length, 3, '花の種類:');
    const h = api.FLOWER_SPR.map(g => g.length);
    ok(h[0] < h[1] && h[1] < h[2], `双葉 < つぼみ < 咲いた花 になっていない: ${h.join(',')}`);
    //  庭に置いた並びでも、高さが1種類に偏っていないこと
    const used = new Set(api.FLOWERS.map(([, k]) => api.FLOWER_SPR[k].length));
    eq(used.size, 3, '庭に出ている背丈の種類:');
    //  どの種類も同じ幅（位置の計算を1つで済ませるため）
    for(const g of api.FLOWER_SPR) eq(g[0].length, api.FLOWER_SPR[0][0].length, '幅:');
  });
  //  十字（.#./###/.#.）はプラス記号に見えて花に読めなかった。
  //  咲いた花は中心を空けて、花びらの輪にしてある
  it('咲いた花は、中心が空いている', () => {
    const { api } = load();
    const bloom = api.FLOWER_SPR[2];
    eq(bloom[1], [1,0,1], '花びらの段（中心が空いていない）:');
    //  茎は1本。下2段が縦一列であること
    for(const row of bloom.slice(-2)) eq(row, [0,1,0], '茎の段:');
  });
  it('咲く順は左から順ではない（端から埋まって見えないように）', () => {
    const { api } = load();
    const xs = api.FLOWERS.map(f => f[0]);
    const sorted = [...xs].sort((a,b)=>a-b);
    ok(JSON.stringify(xs) !== JSON.stringify(sorted), '左から順に咲いている');
  });
  //  花は背景。キャラや皿より先に描くので、歩くと花の前を通る
  it('花は背景として、キャラより先に描かれる', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const flower = src.indexOf('drawFlowers(DM);');
    const chara  = src.indexOf('// ── キャラクター（段階別スプライト');
    ok(flower > 0 && chara > 0, '描画の場所が見つからない');
    ok(flower < chara, '花がキャラより後に描かれている（キャラを覆ってしまう）');
  });
});

// ══ 立ち位置 ══════════════════════════════════════════════
describe('立ち位置', () => {
  //  うんち・皿の上に重ならないよう、重なっていたら最寄りの空きへ寄っていく。
  //  この押し出しは歩行の中に置いてはいけない。睡眠中・病気・瀕死・演出中は
  //  歩行を通らないので、足元にうんちが出たまま重なって寝てしまう
  const overlap = (api, gw) => {
    const x = Math.round(api.walkX);
    return api.objectSpans().some(([a,b]) => x < b && x + gw > a);
  };
  it('重なっていたら、止まっていても押し出される', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i2', W:2, poopSince: clock.now() });
    const gw = api.charSprites().rest[0].length;
    api.walkX = api.POOP_X[0];                    // うんちの真上に立たせる
    ok(overlap(api, gw), '重なった状態が作れていること');
    for(let k=0; k<60 && overlap(api, gw); k++) api.pushOutOfObjects(gw);
    ok(!overlap(api, gw), `押し出されない（x=${api.walkX}）`);
  });
  it('重なっていなければ動かさない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i2', W:2, poopSince: clock.now() });
    const gw = api.charSprites().rest[0].length;
    const seg = api.freeSegments(gw)[0];
    api.walkX = seg[0] + 1;
    const before = api.walkX;
    for(let k=0;k<10;k++) api.pushOutOfObjects(gw);
    eq(api.walkX, before, '空いているのに動いた:');
  });
  it('押し出しは一気に飛ばず、少しずつ寄る', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i2', W:2, poopSince: clock.now() });
    const gw = api.charSprites().rest[0].length;
    api.walkX = api.POOP_X[0];
    const first = api.walkX;
    api.pushOutOfObjects(gw);
    const step = Math.abs(api.walkX - first);
    ok(step > 0, '1コマで動いていない');
    ok(step <= 1, `1コマで飛びすぎ（${step}ドット）。瞬間移動して見える`);
  });
  //  歩行の中に戻すと、止まっている子で効かなくなる。ここが今回の不具合だった
  it('押し出しは、歩行の外で呼ばれている', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const at = src.indexOf('const moving = !(asleep');
    ok(at > 0, '移動の可否を決める場所が見つからない');
    const call = src.indexOf('pushOutOfObjects(gw);', at);
    ok(call > 0, '押し出しが呼ばれていない');
    //  if(moving){ … } の閉じより後で呼ばれていること
    const closes = src.indexOf('// ← モゾモゾ中でなければ歩行', at);
    ok(closes > 0 && call > closes, '押し出しが歩行の中にある（止まっている子で効かない）');
  });
});

// ══ 世話の音とくすりの演出 ══════════════════════════════════
describe('世話の音', () => {
  //  playClick はボタンの手ざわり用の1音。SND は「何が起きたか」を伝える節。
  //  鳴らす先を間違えると、良いことと良くないことの区別がつかなくなる
  it('場面ぶんの音がそろっている', () => {
    const { api } = load();
    for(const k of ['med','bite','praise','anger','sad','tantrum','sparkle'])
      ok(Array.isArray(api.SND[k]) && api.SND[k].length, `${k} の音が無い`);
  });
  it('上がる音は良いこと、下がる音は良くないこと', () => {
    const { api } = load();
    const hz = k => api.SND[k].map(n => n[0]).filter(f => f > 0);
    const up = a => a[a.length-1] > a[0], down = a => a[a.length-1] < a[0];
    ok(up(hz('med')),    'くすりが上がっていない');
    ok(up(hz('praise')), 'ほめるが上がっていない');
    ok(down(hz('anger')), 'イライラが下がっていない');
    ok(down(hz('sad')),   'しゅんが下がっていない');
    //  わがままは低いところで揺れる（上がりも下がりもしない）
    const t = hz('tantrum');
    ok(Math.max(...t) < Math.min(...hz('praise')), 'わがままがほめるより高い');
  });
  //  下がるだけでは足りない。完全5度や長3度で落とすと「解決」して明るく聞こえるので、
  //  良くないほうは音域そのものを低く取る。ここが崩れると、叱っても前向きに聞こえる
  it('良くない音は、良い音より低いところで鳴る', () => {
    const { api } = load();
    const hz = k => api.SND[k].map(n => n[0]).filter(f => f > 0);
    const bad  = ['anger','sad','tantrum'];
    const good = ['med','praise','sparkle'];
    const badHi  = Math.max(...bad.flatMap(hz));
    const goodLo = Math.min(...good.flatMap(hz));
    ok(badHi < goodLo, `良くない音の上端(${badHi}Hz)が、良い音の下端(${goodLo}Hz)を越えている`);
    //  いちばん低く着地するのはイライラ（いちばん強い否定）
    const floor = k => Math.min(...hz(k));
    ok(floor('anger') < floor('sad'), 'イライラがしゅんより上で着地している');
    ok(floor('anger') <= Math.min(...Object.keys(api.SND).flatMap(hz)),
       'イライラより低い音がある');
  });
  //  そうじは、汚れの数によらず1回だけ。仕草に紐づけて頭で鳴らす
  it('キラキラは、そうじ1回につき1回だけ鳴る', () => {
    const { api } = load();
    eq(api.REACT_SND.clean, 'sparkle', 'そうじの仕草に紐づいていない:');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    //  汚れごとに鳴らす作りが残っていないこと（数だけ鳴ると うるさくなる）
    eq((src.match(/playSnd\('sparkle'\)/g) || []).length, 0,
       '汚れごとに鳴らす場所が残っている:');
  });
  it('キラキラは、いちばん高いところで鳴る', () => {
    const { api } = load();
    const hz = k => api.SND[k].map(n => n[0]).filter(f => f > 0);
    const top = Math.max(...hz('sparkle'));
    for(const k of Object.keys(api.SND))
      if(k !== 'sparkle') ok(Math.max(...hz(k)) < top, `${k} がキラキラより高い`);
  });
  //  「キラキラキランッ」。見た目のキラキラは3秒ほど続くので、
  //  単発の点ではなく、ひと続きのフレーズにしてある
  it('キラキラは、ひと続きのフレーズになっている', () => {
    const { api } = load();
    const v = api.SND.sparkle;
    const len = v.reduce((a,n)=>a+n[1], 0);
    ok(len > 0.6, `短すぎて点に聞こえる: ${len.toFixed(2)}秒`);
    ok(len < 2.0, `長すぎて掃除より延びる: ${len.toFixed(2)}秒`);
    //  休符で区切って「キラ・キラ・キラン」と3つに分かれていること
    const rests = v.filter(n => n[0] === 0).length;
    ok(rests >= 2, `区切りが足りない（キラキラキランに聞こえない）: 休符${rests}個`);
    //  最後の一音がいちばん長く伸びる（「ンッ」）
    const last = v[v.length-1];
    ok(last[0] > 0, '最後が休符で終わっている');
    ok(last[1] === Math.max(...v.map(n=>n[1])), `最後が伸びていない: ${last[1]}秒`);
  });
  //  しゅんは3段でうなだれる。最後は全音だけ下げて、ため息のように落とす。
  //  2音に戻すと、落ちきらずに途中で止まって聞こえる
  it('しゅんは3段で落ちて、最後の一段がいちばん浅い', () => {
    const { api } = load();
    const hz = api.SND.sad.map(n => n[0]).filter(f => f > 0);
    ok(hz.length >= 3, `段が足りない: ${hz.length}音`);
    //  段ごとに必ず下がる
    for(let i = 1; i < hz.length; i++)
      ok(hz[i] < hz[i-1], `${i}段目で下がっていない: ${hz.join('→')}`);
    //  最後の一段は、最初の一段より浅い（落差の比で見る）
    const first = hz[1] / hz[0], last = hz[hz.length-1] / hz[hz.length-2];
    ok(last > first, `最後の一段が深すぎる（ため息にならない）: ${hz.join('→')}`);
  });
  //  しゅんは受け入れた顔、イライラは尖った顔。同じ「下がる」でも手ざわりを分ける
  it('しゅんは、イライラよりやわらかい', () => {
    const { api } = load();
    const vol = k => api.SND[k].map(n => n[2] == null ? 0.13 : n[2]);
    ok(Math.max(...vol('sad')) < Math.max(...vol('anger')), 'しゅんの音量がイライラ以上');
    const len = k => api.SND[k].reduce((a,n)=>a+n[1], 0);
    ok(len('sad') > len('anger'), 'しゅんがイライラより短い（余韻が無い）');
  });
  //  音はボタンではなく「キャラがどう反応したか」に紐づける。
  //  同じ SCOLD でも、しゅんとしたのか怒ったのかで鳴る音が変わる
  it('音は仕草に紐づいている', () => {
    const { api } = load();
    eq(api.REACT_SND, { heart:'praise', anger:'anger', sad:'sad', refuse:'tantrum', clean:'sparkle' });
    for(const k of Object.values(api.REACT_SND))
      ok(api.SND[k], `${k} の音が無い`);
    //  たべる・くすりは動きに合わせて鳴らすので、ここには入れない
    ok(!api.REACT_SND.eat && !api.REACT_SND.med, '動きに合わせる音が仕草側にも入っている');
  });
  it('たべる音が、皿の減りと噛み合っている', () => {
    const { api } = load();
    //  判定は本体の biteFrame をそのまま使う。条件を写すと、本体だけ変えたときに気づけない
    const fire = [];
    for(let reactT = api.EAT_T; reactT > 0; reactT--){
      const el = api.EAT_T - reactT;
      if(api.biteFrame(reactT)) fire.push({ el, lvl: Math.max(0, 3 - Math.floor(el/api.EAT_STEP)) });
    }
    eq(fire.length, 3, '鳴る回数（＝口の数）:');
    eq(fire.map(f => f.el), [api.EAT_STEP, api.EAT_STEP*2, api.EAT_STEP*3], '鳴るコマ:');
    eq(fire.map(f => f.lvl), [2, 1, 0], 'その時の皿:');
    //  ひと口ぶんの音は、口の間隔（1.5秒）より短いこと
    const bite = api.SND.bite.reduce((a,n)=>a+n[1], 0);
    ok(bite < api.EAT_STEP / 10, `ひと口の音が長すぎて次の口に重なる: ${bite}秒`);
  });
  it('音が消えていない（鳴らす場所がソースにある）', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    //  仕草ぶんは setReaction が一括で鳴らす
    ok(/const snd = quiet \? null : REACT_SND\[type\];\s*\n\s*if\(snd\) playSnd\(snd\);/.test(src),
       'setReaction が仕草の音を鳴らしていない');
    //  動きに合わせる3つは、それぞれの場所で鳴らす
    ok(/playSnd\('bite'\)/.test(src), 'ひと口の音を鳴らす場所が無い');
    ok(/playSnd\('med'\)/.test(src),  'くすりの音を鳴らす場所が無い');
    //  静かに片づける／静かに食べる場面（quiet）では、♪と同じく音も出さない
    ok(/const snd = quiet \? null : REACT_SND\[type\];/.test(src),
       '静かにしたい場面でも音が鳴ってしまう');
    //  呼び出し元に散らばっていた鳴らしは、setReaction に寄せたので残っていないこと
    for(const k of ['praise','tantrum','anger','sad','sparkle'])
      ok(!new RegExp(`playSnd\\('${k}'\\)`).test(src), `${k} が仕草の外でも鳴っている（二重に鳴る）`);
  });
});

describe('くすりの演出', () => {
  //  右の画面外から放物線で飛んできて、当たってから点滅する
  it('飛来のあとに点滅が来る', () => {
    const { api } = load();
    eq(api.MED_T, api.MED_FLY + api.MED_BLINK, '全体の長さ:');
    ok(api.MED_FLY > 0 && api.MED_BLINK > 0, '飛来と点滅の両方があること');
    ok(api.MED_FROM > 54, `右の画面外から飛んでこない: ${api.MED_FROM}`);
  });
  it('最後のコマで、ちょうど狙った場所に着く', () => {
    const { api } = load();
    //  本体の medPos をそのまま使う。式を写すと、本体だけ変えたときに気づけない
    const tx = 19, ty = 54;
    const at = t => api.medPos(t, tx, ty);
    const last = at(api.MED_FLY - 1);
    eq(last, { x: tx, y: ty }, '着弾点:');
    eq(at(0), { x: api.MED_FROM, y: ty }, '飛び出す位置:');
    //  途中はキャラの上を通る（頂点が狙った場所より高い）
    const top = at(Math.floor((api.MED_FLY - 1) / 2));
    ok(top.y < ty - 5, `弧が低すぎて、まっすぐ飛んで見える: 頂点 y=${top.y}`);
    //  行きも帰りも単調（放物線が波打たない）
    let prevY = 99;
    for(let t = 0; t <= (api.MED_FLY - 1) / 2; t++){ const y = at(t).y;
      ok(y <= prevY, `上がる途中で下がっている t=${t}`); prevY = y; }
  });
  //  右から飛ぶので、進む向きは 右→左。途中で戻らないこと
  it('右から左へ、まっすぐ寄っていく', () => {
    const { api } = load();
    const tx = 19, ty = 54;
    const at = t => api.medPos(t, tx, ty);
    ok(at(0).x > tx, `飛び出しが狙った先より左にある: ${at(0).x}`);
    let prev = at(0).x;
    for(let t = 1; t < api.MED_FLY; t++){
      const x = at(t).x;
      ok(x <= prev, `途中で右へ戻っている t=${t}（${prev} → ${x}）`);
      prev = x;
    }
  });
  //  お世話アイコンと同じ形にそろえる。ばらばらだと、何が飛んできたのか読めない
  it('薬の絵は、お世話アイコンを小さくした形', () => {
    const { api } = load();
    const P = api.MED_PILL, I = api.CARE_ICONS.MED;
    ok(Array.isArray(P) && P.length, '絵が無い');
    ok(P.some(r => r.some(v => v)), '中身が空');
    //  アイコンより小さく、それでも形が読める大きさ
    ok(P[0].length < I[0].length && P.length < I.length,
       `アイコン(${I[0].length}×${I.length})より小さくない: ${P[0].length}×${P.length}`);
    ok(P[0].length >= 7 && P.length >= 6, `小さすぎて形が読めない: ${P[0].length}×${P.length}`);
    //  画面(54×65)を飛ぶので、大きすぎないこと
    ok(P[0].length <= 12 && P.length <= 11, `飛ばすには大きすぎる: ${P[0].length}×${P.length}`);
    //  2色カプセル：右上は塗りつぶし、左下は輪郭だけ
    const dots = g => g.reduce((a,r)=>a + r.filter(v=>v).length, 0);
    const half = (g, top) => {
      let n = 0;
      g.forEach((r, y) => r.forEach((v, x) => {
        const upper = (x / (g[0].length-1)) - (y / (g.length-1)) > 0;   // 右上か左下か
        if(v && upper === top) n++;
      }));
      return n;
    };
    ok(half(P, true) > half(P, false) * 1.5,
       `右上が塗りつぶしになっていない（右上${half(P,true)} / 左下${half(P,false)}）`);
    //  左下は輪郭なので、中に空きがあること
    const lower = P.slice(Math.floor(P.length/2));
    ok(lower.some(r => { const on = r.map((v,i)=>v?i:-1).filter(i=>i>=0);
      return on.length >= 2 && (on[on.length-1] - on[0] + 1) > on.length; }),
       '左下が塗りつぶされていて、輪郭になっていない');
    ok(dots(P) < dots(I), 'アイコンより点が多い');
  });
});

// ══ 日記 ══════════════════════════════════════════════════
describe('音の表', () => {
  //  日記の文面を足すとき、SND の同じ名前の項目（tantrum など）を
  //  上書きしてしまったことがある。テストは素通りし、わがままの音だけが消えていた
  it('音はすべて [周波数, 長さ] の並びである', () => {
    const { api } = load();
    const keys = Object.keys(api.SND);
    ok(keys.length >= 7, `音が ${keys.length} 種しかない`);
    for(const k of keys){
      const seq = api.SND[k];
      ok(Array.isArray(seq) && seq.length > 0, `${k} が空`);
      for(const step of seq){
        ok(Array.isArray(step), `${k} に配列でない要素がある: ${JSON.stringify(step)}`);
        ok(step.length >= 2 && step.length <= 3, `${k} の要素の長さが ${step.length}`);
        for(const v of step)
          ok(typeof v === 'number' && Number.isFinite(v),
             `${k} に数値でない値がある: ${JSON.stringify(step)}`);
        ok(step[0] >= 0 && step[0] <= 8000, `${k} の周波数が範囲外: ${step[0]}`);
        ok(step[1] > 0 && step[1] <= 2, `${k} の長さが範囲外: ${step[1]}`);
      }
    }
  });
  it('リアクションが指す音が、全部そろっている', () => {
    const { api } = load();
    for(const [react, snd] of Object.entries(api.REACT_SND))
      ok(api.SND[snd], `${react} が指す音 ${snd} が無い`);
  });
});

describe('日記の重複', () => {
  //  育成は30日ほど。その間ずっと、同じ言い回しが二度出ないようにしたい。
  //  30日で書かれる文は、1日4話題＋結び＝最大150本。これが下限で、
  //  用意したのはその倍。ただし配り方を誤ると、一部のタグに負担が集中して破綻する
  //  最低限の世話でも毎日立つ。1タグが採られる回数がいちばん多い
  const ROUTINE = ['fed','cleaned','dirty','noPlay','slept','praised','snack',
                   'playSw','playSs','playAb','clear','rain','snow'];
  //  しつけや甘やかしを続ける遊び方だけで立つ。持ち回りの中で分け合うので、
  //  上の組ほどは要らないが、2本のままだと毎日おなじ2文が交互に出る
  const ROUTINE2 = ['scoldedUnfair','taught','snackMany','woken',
                    'rhythmDay','rhythmNight','tantrum'];
  const WARM_MIN = 24;              // 毎日出るタグが30日で採られる最大回数
  it('毎日出うるタグは、必要数の倍を持っている', () => {
    const { api } = load();
    for(const t of ROUTINE){
      const set = api.DIARY_LINES[t];
      ok(set, `${t} の文面が無い`);
      ok(set.length >= WARM_MIN * 2, `${t} が ${set.length}本（必要 ${WARM_MIN*2}本）`);
      //  どの親密度でも、単独で30日ぶんまかなえること。
      //   段階つきの文しか無いと、段階が変わらない子で候補が尽きる
      const any = set.filter(v => v.w == null).length;
      ok(any >= WARM_MIN, `${t} の共通ぶんが ${any}本（必要 ${WARM_MIN}本）`);
      for(const w of [0,1,2]){
        const n = set.filter(v => v.w === w).length;
        ok(n >= 4, `${t} の親密度${w}が ${n}本しか無い`);
      }
    }
  });
  it('しつけ・甘やかしで毎日立つタグも、持ち回りに入っている', () => {
    const { api } = load();
    for(const t of ROUTINE2){
      ok(api.DIARY_ROUTINE.has(t), `${t} が持ち回りの外にある（毎回いちばん先に採られる）`);
      const set = api.DIARY_LINES[t];
      ok(set, `${t} の文面が無い`);
      ok(set.length >= 24, `${t} が ${set.length}本しかない`);
      const any = set.filter(v => v.w == null).length;
      ok(any >= 12, `${t} の共通ぶんが ${any}本`);
      for(const w of [0,1,2])
        ok(set.filter(v => v.w === w).length >= 3, `${t} の親密度${w}が足りない`);
    }
    //  報せるべき出来事は持ち回りに入れない（書ける数が少ない日に押し出される）
    for(const t of ['evolved','sick','cured','hungry','lonely','wrath',
                    'farewell','farewellWild','broughtHome','redeemed','departed'])
      ok(!api.DIARY_ROUTINE.has(t), `${t} を持ち回りに入れてはいけない`);
  });
  //  正当なしかる（わがままが収まった）にも日記を残す。
  //  以前は 放置したわがままだけが残り、正しく対処した時は何も残らなかった
  it('しつけが通った日にも、日記に残る', () => {
    const { api } = load();
    ok(api.DIARY_LINES.taught, 'しつけが通った日の文面が無い');
    ok(api.DIARY_PRIORITY.includes('taught'), 'taught が優先度表に無い');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const at = src.indexOf("} else if(pet.tantrumAt){");
    ok(at > 0, 'わがままを収める枝が見つからない');
    const body = src.slice(at, src.indexOf('} else if(stayingUpLate())', at));
    ok(/note\('taught'\)/.test(body), 'わがままを収めた枝に日記の印が無い');
  });
  //  旧セーブの日記は 'scolded' を指している。読めなくなると過去の日記が空になる
  it('旧セーブの しかる の日記が、いまも読める', () => {
    const { api } = load();
    eq(api.DIARY_LINES.scolded, api.DIARY_LINES.scoldedUnfair, '旧名の指す先:');
    const e = { d:5, n:'Z', t:['scolded'], v:[1], s:'', vo:'plain', c:'', cv:0,
                ts:Date.now(), cd:'x', lv:3, wr:1 };
    ok(api.diaryBody(e, 'ja').length > 0, '旧名の日記が空になる');
  });
  //  結びは ひとりごとが出なかった日に書く。ひとりごとが一度も出ない30日でも
  //  重複しないよう、30日ぶん持たせる
  it('結びは、ひとりごとが一度も出なくても30日もつ', () => {
    const { api } = load();
    for(const vo of ['plain','calm','rough']){
      const set = api.DIARY_CLOSE[vo];
      const any = set.filter(v => v.w == null).length;
      const each = [0,1,2].map(w => set.filter(v => v.w === w).length);
      ok(any + Math.min(...each) >= 30,
         `${vo}: どの親密度でも選べるのが ${any + Math.min(...each)}本（必要30本）`);
    }
  });
  //  ひとりごとは天気と成長段階でしぼられる。しぼられた先でも足りていること
  it('ひとりごとは、どの天気でも30日ぶんの候補がある', () => {
    const { api } = load();
    const M = api.DIARY_MUSINGS;
    const NEED = 18;                // 30日 × 出る確率60%
    for(const wk of ['clear','cloudy','rain','snow'])
      for(const st of ['young','grown'])
        for(const warm of [0,1,2]){
          const s = { clear:0, cloudy:0, rain:0, snow:0, young:0, grown:0, bond:50, trait:0, warm };
          s[wk] = 1; s[st] = 1;
          const n = Object.keys(M).filter(k => M[k].when(s)).length;
          ok(n >= NEED, `${wk}/${st}/親密度${warm}: 候補が ${n}種（必要${NEED}種）`);
        }
  });
  //  ふだんの話題を優先度の上から採ると、最低限の世話では毎日おなじ顔ぶれが並ぶ。
  //  久しく書いていないものから採ること、同着は散らすこと
  it('ふだんの話題は持ち回りになる', () => {
    const { api, clock } = load();
    api.pet.stage = 'adult'; api.pet.lineage = 'grey'; api.pet.EP = 4;
    api.pet.birth = clock.now(); api.diaryLog.length = 0;
    const count = {};
    for(let day = 1; day <= 30; day++){
      const e = api.buildDiary({ fed:1, cleaned:1, dirty:1, noPlay:1, clear:1, slept:1, solo:'' }, day, 'd'+day);
      if(e){ api.diaryLog.push(e); (e.t||[]).forEach(t => count[t] = (count[t]||0) + 1); }
      clock.advanceDays(1);
    }
    const n = Object.values(count);
    ok(Object.keys(count).length >= 5, `採られたタグが ${Object.keys(count).length}種しかない`);
    ok(Math.max(...n) <= 24, `1つのタグが30日で ${Math.max(...n)}回 採られている`);
  });
  //  実物の字幅は Node では測れないので、すでに出荷ずみの最長行を予算にする。
  //  画面のフォントは大文字しか持たないので、英文に小文字が混じると字が欠ける
  it('増やした文面が、幅の予算と字種を守っている', () => {
    const { api } = load();
    const BUDGET = { ja: 15, en: 24 };
    const seen = {};
    const chk = (name, v) => {
      for(const lg of ['ja','en'])
        for(const l of (v[lg] || [])){
          ok([...l].length <= BUDGET[lg], `${name} ${lg}: ${[...l].length}字「${l}」`);
          if(lg === 'en') ok(!/[a-z]/.test(l), `${name} en に小文字「${l}」`);
        }
      //  同じ文が二重に入っていると、候補が実質減る
      const k = name.split('[')[0] + '|' + (v.ja || []).join('/');
      ok(!seen[k], `${name} が ${seen[k]} と同じ文`);
      seen[k] = name;
    };
    for(const [t, arr] of Object.entries(api.DIARY_LINES)) arr.forEach((v, i) => chk(`LINES.${t}[${i}]`, v));
    for(const [t, arr] of Object.entries(api.DIARY_CLOSE)) arr.forEach((v, i) => chk(`CLOSE.${t}[${i}]`, v));
    for(const [k, m] of Object.entries(api.DIARY_MUSINGS))
      for(const vo of ['plain','calm','rough'])
        chk(`MUSING.${k}.${vo}`, { ja: m.ja[vo], en: m.en[vo] });
  });
  //  持ち回りにするのは ふだんの話題だけ。進化・病気・別れのような報せるべき
  //  出来事まで混ぜると、書ける数が少ない日に押し出されて消える
  it('報せるべき出来事は、ふだんの話題より先に書く', () => {
    const { api, clock } = load();
    api.pet.stage = 'adult'; api.pet.lineage = 'grey'; api.pet.EP = 4;
    api.pet.birth = clock.now(); api.diaryLog.length = 0;
    //  ふだんの話題を先に何日か書いて、持ち回りの順番を作っておく
    for(let day = 1; day <= 6; day++){
      const e = api.buildDiary({ fed:1, cleaned:1, dirty:1, noPlay:1, clear:1, slept:1, solo:'' }, day, 'd'+day);
      if(e) api.diaryLog.push(e);
      clock.advanceDays(1);
    }
    for(const big of ['evolved','sick','cured','wrath','woken','tantrum']){
      const d = { fed:1, cleaned:1, dirty:1, noPlay:1, clear:1, slept:1, solo:'' };
      d[big] = 1;
      for(let n = 1; n <= 4; n++){
        const picked = api.pickTopics(d, n);
        ok(picked.includes(big), `書ける数が${n}のとき ${big} が落ちる: ${picked.join(',')}`);
      }
    }
  });
  //  はじめの日記は、まだ何も書いていないので全タグが同着になる。
  //  同着を優先度順で解くと、どの子も1日目は おなじ話題から始まってしまう
  it('はじめの日記の話題が、いつも同じにならない', () => {
    const seen = new Set();
    for(let i = 0; i < 40; i++){
      const { api, clock } = load();
      api.pet.stage = 'adult'; api.pet.lineage = 'grey'; api.pet.EP = 4;
      api.pet.birth = clock.now(); api.diaryLog.length = 0;
      const e = api.buildDiary({ fed:1, cleaned:1, dirty:1, noPlay:1, clear:1, slept:1, solo:'' }, 1, 'd1');
      if(e) e.t.forEach(t => seen.add(t));
    }
    ok(seen.size >= 3, `はじめの話題が ${seen.size}種しか出ない: ${[...seen].join(',')}`);
  });
  //  親密度に合わない言い回しが選ばれると、関係の変化が文面に出ない
  it('その親密度の言い回ししか選ばない', () => {
    const { api, clock } = load();
    api.pet.stage = 'adult'; api.pet.lineage = 'grey'; api.pet.EP = 4;
    api.pet.B = 50; api.pet.birth = clock.now();
    for(const lv of [0, 1, 2]){
      api.pet.touchLog = Array(api.WARM_WINDOW).fill([0, 1, 3][lv]);
      eq(api.warmLevel(), lv, `想定した段階にならない（${lv}）:`);
      api.diaryLog.length = 0;
      const wrongBody = [], wrongClose = [];
      for(let day = 1; day <= 25; day++){
        const e = api.buildDiary({ fed:1, cleaned:1, praised:1, clear:1, slept:1, solo:'' }, day, 'd'+day);
        if(!e) continue;
        api.diaryLog.push(e);
        e.t.forEach((t, i) => {
          const w = api.DIARY_LINES[t][e.v[i]].w;
          if(w != null && w !== lv) wrongBody.push(`${t}[${e.v[i]}] は段階${w}`);
        });
        if(e.c){
          const w = api.DIARY_CLOSE[e.c][e.cv].w;
          if(w != null && w !== lv) wrongClose.push(`${e.c}[${e.cv}] は段階${w}`);
        }
      }
      eq(wrongBody.length, 0, `段階${lv} で よその段階の本文が出た（${wrongBody[0] || ''}）:`);
      eq(wrongClose.length, 0, `段階${lv} で よその段階の結びが出た（${wrongClose[0] || ''}）:`);
    }
  });
  //  ひとりごとの条件にも親密度を渡していないと、うちとけた子に
  //  「だれも こなかった」のような ひとりごとが出続ける
  it('ひとりごとも親密度で出しわける', () => {
    const { api, clock } = load();
    api.pet.stage = 'adult'; api.pet.lineage = 'grey'; api.pet.EP = 4;
    api.pet.B = 50; api.pet.birth = clock.now(); api.weatherFetched = true;
    const only = lv => Object.keys(api.DIARY_MUSINGS).filter(k => {
      const s = { clear:1, cloudy:0, rain:0, snow:0, young:0, grown:1, bond:50, trait:0, warm:lv };
      const other = [0,1,2].filter(w => w !== lv)
        .some(w => api.DIARY_MUSINGS[k].when({ ...s, warm:w }));
      return api.DIARY_MUSINGS[k].when(s) && !other;
    });
    for(const lv of [0, 1, 2]) ok(only(lv).length > 0, `段階${lv} だけの ひとりごとが無い`);
    //  実際に選ばれるのが その段階のものだけであること
    for(const lv of [0, 1, 2]){
      api.pet.touchLog = Array(api.WARM_WINDOW).fill([0, 1, 3][lv]);
      const wrong = [];
      for(let i = 0; i < 120; i++){
        const k = api.pickMusing();
        if(!k) continue;
        for(const other of [0,1,2].filter(w => w !== lv))
          if(only(other).includes(k)) wrong.push(`${k}（段階${other}用）`);
      }
      eq(wrong.length, 0, `段階${lv} で よその段階の ひとりごとが出た（${wrong[0] || ''}）:`);
    }
  });
  //  重複を避ける窓が短いと、育成の途中で同じ文が戻ってくる
  //  窓は「日記の件数」で数える。育成は最長35日ほどなので、30件だと
  //  31日目に1日目の文が候補へ戻ってきていた。日記帳が持っている数まで広げる
  it('同じ言い回しを避ける窓が、日記帳の保持ぶんある', () => {
    const { api } = load();
    ok(api.DIARY_NOREPEAT_DAYS >= api.DIARY_MAX,
       `窓 ${api.DIARY_NOREPEAT_DAYS} 件 < 日記帳 ${api.DIARY_MAX} 件`);
    ok(api.DIARY_MAX >= 36, `日記帳が ${api.DIARY_MAX} 件しか持たない（育成は最長35日ほど）`);
  });
  //  表示は7行まで。載りきらなかった話題まで「書いた」ことにすると、
  //  読まれないまま持ち回りと重複よけを消費する
  it('画面に載らなかった話題は、書いたことにしない', () => {
    const { api } = load();
    //  2行の話題を4つ＋2行の結び＝10行。7行には入りきらない
    const e = { d:5, n:'Z', t:['fed','cleaned','dirty','slept'], v:[1,1,1,1],
                s:'', vo:'plain', c:'plain', cv:0, ts:Date.now(), cd:'x', lv:3, wr:1 };
    const before = e.t.length;
    const shown = api.diaryBody(e, 'ja');
    const fit = e.t.filter((t,i) =>
      api.DIARY_LINES[t][e.v[i]].ja.every(l => shown.includes(l))).length;
    ok(fit < before, `この組み合わせでは落ちない（${fit}/${before}）— 検査になっていない`);
    const kept = api.trimToShown(Object.assign({}, e, { t:[...e.t], v:[...e.v] }));
    eq(kept.t.length, fit, '残した話題の数:');
    eq(kept.v.length, kept.t.length, '言い回しの数が話題と合っていない:');
    //  載ったものは残っていること（消しすぎない）
    for(const t of kept.t) ok(e.t.includes(t), `${t} が元に無い`);
    ok(kept.t.length > 0, '全部 消してしまっている');
    //  そもそも入りきる日は、何も落とさない
    const small = { d:5, n:'Z', t:['fed'], v:[0], s:'', vo:'plain', c:'', cv:0,
                    ts:Date.now(), cd:'x', lv:3, wr:1 };
    eq(api.trimToShown(small).t, ['fed'], '入りきる日まで削っている:');
    //  日記帳に入れる時に通っていること。関数があっても呼ばれなければ意味がない
    api.diaryLog.length = 0;
    api.addDiary(Object.assign({}, e, { t:[...e.t], v:[...e.v] }));
    eq(api.diaryLog[0].t.length, fit, '日記帳に残った話題の数:');
    api.diaryLog.length = 0;
  });
  //  いちばん長い話題が、結びを引いた残りに収まること。
  //  ここが崩れると「話題が1つも載らない日」が生まれ、絵だけの日記になる
  it('いちばん長い話題でも、結びと一緒に載る', () => {
    const { api } = load();
    const maxClose = Math.max(...['plain','calm','rough']
      .flatMap(v => api.DIARY_CLOSE[v].map(x => x.ja.length)));
    const maxTopic = Math.max(...Object.values(api.DIARY_LINES)
      .flatMap(a => a.map(x => x.ja.length)));
    ok(maxTopic <= 7 - maxClose,
       `いちばん長い話題 ${maxTopic}行 が、結び ${maxClose}行 を引いた残り ${7-maxClose}行 に入らない`);
  });
});

describe('親密度', () => {
  //  ごはん・そうじは生かすための世話。ふれあい（ほめる・遊ぶ・くすり）だけを数える
  it('ごはんとそうじだけでは、親密度は上がらない', () => {
    const { api } = load();
    api.pet.B = 50; api.pet.touchLog = Array(api.WARM_WINDOW).fill(0);
    eq(api.warmLevel(), 0, 'ふれあい0での段階:');
    api.pet.touchLog = Array(api.WARM_WINDOW).fill(3);
    ok(api.warmLevel() > 0, 'ふれあいを増やしても段階が上がらない');
  });
  //  1日の締めで積むところも見る。上の検査は warmth() に直に値を入れているので、
  //  「何を積んでいるか」が入れ替わっても気づけない
  it('1日の締めで積むのは、ふれあいの回数だけ', () => {
    const { api } = load();
    api.pet.touchLog = [];
    //  ごはんもそうじもしたが、ふれあい（ほめる・遊ぶ・くすり）は0回の日
    api.closeOneDay({ fed:1, cleaned:1, clear:1, slept:1 }, 0, false);
    eq(api.pet.touchLog, [0], 'ごはんとそうじだけの日に積んだ値:');
    api.closeOneDay({ fed:1, cleaned:1 }, 2, false);
    eq(api.pet.touchLog, [0, 2], 'ふれあい2回の日まで積んだ値:');
  });
  //  記録の件数で割ると、来たばかりの子が1日よく構われただけで平均が満点になり、
  //  2日目に「うちとけた」まで飛んでいた。記録の無い日は0として数える
  it('来たばかりの子は、1日で うちとけた にならない', () => {
    const { api } = load();
    api.pet.B = 35;
    api.pet.touchLog = [3];                       // 1日目に3種ふれあった
    eq(api.warmLevel(), 0, '1日目の段階:');
    ok(api.warmth() < 0.3, `1日目の親密度が高すぎる: ${api.warmth().toFixed(2)}`);
    //  同じ関わりを続ければ、窓のぶんかけて上がっていく
    const seen = [];
    api.pet.touchLog = [];
    for(let d = 1; d <= api.WARM_WINDOW; d++){
      api.pet.touchLog.push(3);
      seen.push(api.warmLevel());
    }
    eq(seen[seen.length-1], 2, `${api.WARM_WINDOW}日 続けたときの段階:`);
    ok(seen.filter((v,i) => i && v !== seen[i-1]).length >= 2,
       `段階が一気に飛んでいる: [${seen}]`);
    ok(seen.indexOf(2) >= 4, `${seen.indexOf(2)+1}日目で最高段階に届いてしまう`);
  });
  it('直近の関わり方で段階が変わる', () => {
    const { api } = load();
    api.pet.B = 50;
    const lv = t => { api.pet.touchLog = Array(api.WARM_WINDOW).fill(t); return api.warmLevel(); };
    ok(lv(0) < lv(2), `ふれあい0(${lv(0)}) と 2(${lv(2)}) で段階が同じ`);
    ok(lv(2) <= lv(3), '関わりを増やしたのに段階が下がる');
    eq(lv(3), 2, 'よく関わったときの段階:');
  });
  //  なかよし度は貯金なので動きが鈍い。直近の窓のほうが強く効くこと
  it('なかよしが高くても、関わらなくなれば よそよそしい側へ戻る', () => {
    const { api } = load();
    api.pet.B = 90; api.pet.touchLog = Array(api.WARM_WINDOW).fill(3);
    const near = api.warmth();
    api.pet.touchLog = Array(api.WARM_WINDOW).fill(0);
    ok(api.warmth() < near * 0.6, `離れても親密度が ${api.warmth().toFixed(2)} のまま`);
  });
  it('窓は直近ぶんだけ残す', () => {
    const { api } = load();
    ok(api.WARM_WINDOW >= 3 && api.WARM_WINDOW <= 14, `窓が ${api.WARM_WINDOW}日`);
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(/pet\.touchLog\.splice\(0, pet\.touchLog\.length - WARM_WINDOW\)/.test(src),
       '古いぶんを捨てていない（際限なく貯まる）');
  });
  //  段階が変わったら、書かれる文も変わること
  it('段階が変わると、選ばれる言い回しも変わる', () => {
    const { api } = load();
    api.pet.B = 50;
    const seen = [0,1,2].map(t => {
      api.pet.touchLog = Array(api.WARM_WINDOW).fill([0,1,3][t]);
      return new Set(api.warmCands(api.DIARY_LINES.fed)
        .filter(i => api.DIARY_LINES.fed[i].w != null));
    });
    for(let a = 0; a < 3; a++)
      for(let b = a + 1; b < 3; b++){
        const both = [...seen[a]].filter(i => seen[b].has(i));
        eq(both.length, 0, `段階${a}と${b}で同じ文が候補になっている:`);
      }
    for(const s of seen) ok(s.size > 0, 'ある段階で専用の文が1つも無い');
  });
});

describe('日記', () => {
  it('別れの言葉は3口調そろっている', () => {
    const { api, clock } = load();
    for(const tag of ['farewell','farewellWild','departed','wrath'])
      eq(api.DIARY_LINES[tag].length, 3, `${tag}:`);
  });
  //  実物の字幅はNodeでは測れないので、すでに出荷ずみの最長行を予算にする。
  //  LCDに収まることが確認できている長さなので、これを超えなければはみ出さない
  it('別れの言葉が、これまでの最長行より長くならない', () => {
    const { api } = load();
    const BUDGET = { ja: 14, en: 23 };
    for(const tag of ['farewell','farewellWild','departed','wrath'])
      api.DIARY_LINES[tag].forEach((v, i) => {
        for(const lg of ['ja','en'])
          for(const line of (v[lg] || [])){
            const n = [...line].length;
            ok(n <= BUDGET[lg], `${tag}[${i}] ${lg}: ${n}文字（予算${BUDGET[lg]}）「${line}」`);
          }
      });
  });
  //  旅立ちだけが「また会おう」で終わる。育ちきった子との別れなので、
  //  ここが無いと言い切りで終わって、他の別れと後味が変わらなくなる
  it('旅立ちの日記は「また いつか」で終わる', () => {
    const { api } = load();
    api.DIARY_LINES.departed.forEach((v,i)=>{
      ok(/また いつか/.test(v.ja[v.ja.length-1]), `departed[${i}] ja の最後が「また いつか」でない: ${v.ja[v.ja.length-1]}`);
      ok(/AGAIN/.test(v.en[v.en.length-1]),      `departed[${i}] en の最後が再会の言葉でない: ${v.en[v.en.length-1]}`);
    });
    //  帰還にも再会の言葉があるので、読み分けの「いつか」は旅立ち側だけに置く
    for(const tag of ['broughtHome','redeemed'])
      api.DIARY_LINES[tag].forEach((v,i)=>
        ok(!v.ja.some(l=>/また いつか/.test(l)), `${tag}[${i}] に「また いつか」が入っている`));
  });
  //  帰還は入口が2つあるが、演出は共通。おもいでに残る一文だけが分かれる。
  //  ここが同じに戻ると、立て直した子にも「じかんが きた」と出てしまう
  it('帰還の2つの入口で、おもいでの一文が変わる', () => {
    const { api } = load();
    const label = (redeem) => { api.pet.dead = ''; api.pet.homeRedeem = redeem;
      api.pet.goneBy = redeem ? 'redeem' : 'home'; return api.endLabel(); };
    const time = label(false), redeemed = label(true);
    ok(time && redeemed, '両方に言葉があること');
    ok(time !== redeemed, `入口で一文が変わらない: ${time}`);
    ok(!/ひとりで/.test(time), `時間切れに「ひとりで」が入っている: ${time}`);
    ok(!/じかん/.test(redeemed), `立て直しに「じかん」が入っている: ${redeemed}`);
    //  演出の終わりで goneBy を決めているのは描画側。ここが homeRedeem を見ていないと、
    //  上の分岐があっても立て直しの一文には辿り着けない
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const line = src.split('\n').find(l => /pet\.goneBy = .*homeFlag = false/.test(l));
    ok(line, '帰還の演出の終わりが見つからない');
    ok(/homeRedeem/.test(line), `入口を見ずに goneBy を決めている: ${line.trim()}`);
    ok(/'redeem'/.test(line) && /'home'/.test(line), `どちらか一方しか出していない: ${line.trim()}`);
  });
  it('5つの結末すべてに、おもいでの一文がある', () => {
    const { api } = load();
    for(const lg of ['ja','en']){
      api.lang = lg;
      for(const by of ['depart','home','redeem','return','invade']){
        api.pet.dead = ''; api.pet.goneBy = by;
        ok(api.endLabel(), `${lg}/${by} の一文が無い`);
      }
      for(const d of ['starve','sick']){
        api.pet.goneBy = ''; api.pet.dead = d;
        ok(api.endLabel(), `${lg}/${d} の一文が無い`);
      }
    }
  });
  //  演出のあとの静止画面は「演出の最終画面と同じ位置に同じ言葉」を置く決まり。
  //  家出の演出は言葉を出さずに終わるので、静止画面にも出してはいけない
  it('家出のあとの画面に、別れの言葉が残らない', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const line = src.split('\n').find(l => l.includes('GAME OVER...') && l.includes('THANK YOU!'));
    ok(line, '静止画面のメッセージを組む行が見つかること');
    ok(!/goneBy\s*===\s*'return'/.test(line), `家出に言葉が付いている: ${line.trim()}`);
    ok(line.includes("'depart'") && line.includes("'invade'"), '旅立ち・侵攻の言葉は残っていること');
  });
  //  家出の演出は「自分で歩いて出ていく」（drawUfoEnding にUFOは出ない）。
  //  日記が「むかえが きた」だと、画面で起きていることと食い違う
  it('家出の日記は、迎えが来た体で書かれていない', () => {
    const { api } = load();
    for(const tag of ['farewell','farewellWild'])
      api.DIARY_LINES[tag].forEach((v, i) => {
        ok(!v.ja.some(l => l.includes('むかえ')), `${tag}[${i}] ja に「むかえ」が入っている`);
        ok(!v.en.some(l => /CAME FOR/i.test(l)), `${tag}[${i}] en に CAME FOR が入っている`);
      });
    //  逆に、旅立ち（E4）は本当に迎えが来るので、そちらには残っていること
    ok(api.DIARY_LINES.departed.every(v => v.ja.some(l => l.includes('むかえ'))),
       '旅立ちの日記から「むかえ」が消えている');
  });
  it('ひとりごとは全部が3口調ぶんそろっている', () => {
    const { api, clock } = load();
    for(const [k, m] of Object.entries(api.DIARY_MUSINGS))
      for(const lang of ['ja','en'])
        for(const v of ['plain','calm','rough'])
          ok(Array.isArray(m[lang][v]) && m[lang][v].length > 0, `${k}.${lang}.${v} が無い`);
  });
  it('結びも3口調そろっている', () => {
    const { api, clock } = load();
    for(const v of ['plain','calm','rough'])
      ok(api.DIARY_CLOSE[v] && api.DIARY_CLOSE[v].length > 0, `${v} が無い`);
  });
  it('DIARY_PRIORITY に載っているタグは、全部 文面を持っている', () => {
    const { api, clock } = load();
    for(const t of api.DIARY_PRIORITY) ok(api.DIARY_LINES[t], `${t} の文面が無い`);
  });
  it('口調は成体で確定し、それまでは共通', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', voice:'' });
    eq(api.voice(), 'plain');
    api.pet.lineage = 'grey'; api.pet.P = 60;
    eq(api.pickVoice(), 'rough');
    api.pet.lineage = 'tako'; api.pet.P = -60;
    eq(api.pickVoice(), 'calm');
  });
  it('古い日記（口調を持たない形）でも文面が欠けない', () => {
    const { api, clock } = load();
    pet(api, clock);
    const body = api.diaryBody({ d:1, n:'OLD', t:['farewell'], s:'star1', c:'lively', cv:0 });
    ok(body.length > 0, '本文が出るはず');
  });
});

// ══ にっきの字 ══════════════════════════════════════════
//  よその星から来たばかりの子は地球の言葉を書けない。段階が上がるにつれて書けるようになる
describe('にっきの字', () => {
  //  宇宙文字は廃止した。書き始めは来たその日のまま。
  //  うまれたては絵、あかちゃんからは ふつうに読める文になる
  it('来たその日から日記を書く（うまれたてでも書く）', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg', name:'T' });
    ok(api.diaryWriting(), 'うまれたてでも書くこと');
    eq(api.diaryLevel(), api.LV_NEW);
  });
  it('名前をつける前は書かない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg', name:'' });
    ok(!api.diaryWriting());
  });
  it('宇宙文字は もう使わない', () => {
    const { api } = load();
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    for(const name of ['DIARY_RUNE', 'RUNE_KEYS', 'runeOf', 'KANA_LETTER'])
      ok(!src.includes(name), `${name} が残っている`);
    ok(api.runeOf === undefined, 'runeOf が呼べてしまう');
  });
  //  どの段階でも読めること。以前は あかちゃん・こども が読めない字で書いていた
  it('どの段階の日記も、ふつうに読める文で出る', () => {
    for(const lg of ['ja','en']){
      const { api, clock } = load({ storage: { myvader_lang: lg } });
      api.lang = lg;
      for(const [stage, lv] of [['egg', api.LV_NEW], ['mid', api.LV_BABY], ['larva', api.LV_CHILD], ['adult', api.LV_ADULT]]){
        pet(api, clock, { stage, lineage:'grey', EP: stage==='adult' ? 8 : 2 });
        api.pet.birth = clock.now() - 5*86400000;
        const e = api.buildDiary({ fed:1, cleaned:1, solo:'' }, 5, 'x');
        ok(e, `${lg}/${stage}: 日記が組めない`);
        eq(e.lv, lv, `${lg}/${stage} の段階:`);
        const body = api.diaryBody(e, lg).filter(Boolean);
        ok(body.length > 0, `${lg}/${stage}: 本文が空`);
        //  文面がそのまま出ること（置きかえられていない）
        for(const t of e.t){
          const m = api.DIARY_LINES[t][e.v[e.t.indexOf(t)]];
          ok(m[lg].every(l => body.includes(l)), `${lg}/${stage}: ${t} の文が出ていない`);
        }
      }
    }
  });
  // 中身が無いうちに開かせると「まだ なにも かいていない」だけの画面になる
  it('メニューの「にっき」は、1件目が書かれてから並ぶ', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg', name:'T' });
    api.clearDiary();
    ok(!api.menuList().some(m => m[1] === 'diary'), 'まだ何も書いていないので並ばないこと');
    api.addDiary(api.buildDiary({ fed:1, praised:1 }, 1));
    ok(api.diaryLog.length > 0, '1件書かれたこと');
    ok(api.menuList().some(m => m[1] === 'diary'), '書かれたら並ぶこと');
  });
  // 下段は2列。左＝その子の状態を見るもの、右＝読みもの
  it('ストーリーと説明書は右の列に入る', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock, { name:'T' });
    api.clearDiary();
    const name = (list, idx) => list[idx][1];
    let { list, left, right } = api.menuCols();
    eq(right.map(i => name(list,i)), ['story','manual'], '右の列:');
    eq(left.map(i => name(list,i)), ['status','settings'], '左の列（日記なし）:');
    api.addDiary(api.buildDiary({ fed:1, praised:1 }, 1));
    ({ list, left, right } = api.menuCols());
    eq(left.map(i => name(list,i)), ['status','diary','settings'], '左の列（日記あり）:');
    eq(right.map(i => name(list,i)), ['story','manual'], '日記が増えても右は変わらない:');
  });
  // おもいでは別れたあとにだけ出る。右の列のいちばん上（ストーリーの上）に入り、
  // ストーリーと説明書は1段ずつ下がる
  it('おもいでは右の列のいちばん上に入り、ストーリーが1段下がる', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock, { name:'T', gone:true, goneBy:'return' });
    api.clearDiary();
    api.addDiary(api.buildDiary({ fed:1, praised:1 }, 1));
    const { list, left, right } = api.menuCols();
    eq(right.map(i => list[i][1]), ['memory','story','manual'], '右の列:');
    eq(left.map(i => list[i][1]), ['status','diary','settings'], '左の列は変わらない:');
  });
  // アイコンから下へ降りたときの着地点は左の列の先頭。おもいでが出ていると
  // 一覧の先頭（＝6番）は右の列のいちばん上になるので、そこへ降りると不自然
  it('おもいでが出ていても、左の列の先頭はステータスのまま', () => {
    for(const over of [{}, { gone:true, goneBy:'return' }]){
      const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
      pet(api, clock, Object.assign({ name:'T' }, over));
      api.clearDiary();
      const { list, left } = api.menuCols();
      eq(list[left[0]][1], 'status', `${JSON.stringify(over)} の左の列の先頭:`);
    }
  });
  it('どの状態でも、下段は3行までに収まる', () => {
    for(const over of [{}, { gone:true, goneBy:'return' }, { dead:'starve' }]){
      const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
      pet(api, clock, Object.assign({ name:'T' }, over));
      api.clearDiary();
      api.addDiary(api.buildDiary({ fed:1, praised:1 }, 1));
      const { left, right } = api.menuCols();
      const rows = Math.max(left.length, right.length);
      ok(rows <= 3, `${JSON.stringify(over)} で ${rows}行になる（行間の想定は3行まで）`);
    }
  });
  it('全部そろっても、項目はメニューから消えない', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock, { name:'T', dead:'starve' });
    api.clearDiary();
    api.addDiary(api.buildDiary({ fed:1 }, 1));
    const { list, left, right } = api.menuCols();
    eq(left.length + right.length, list.length, '振り分けで抜け落ちが無いこと:');
  });
  it('帰ったあと・死んだあとも、書いた日記は読み返せる', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', name:'T' });
    api.clearDiary();
    api.addDiary(api.buildDiary({ fed:1, praised:1 }, 1));
    api.pet.gone = true; api.pet.goneBy = 'return';
    ok(api.menuList().some(m => m[1] === 'diary'), '帰ったあとも並ぶこと');
    api.pet.gone = false; api.pet.dead = 'starve';
    ok(api.menuList().some(m => m[1] === 'diary'), '死んだあとも並ぶこと');
  });
  // 段階は書いた時点で焼き付ける（あとから読み返しても変わらない）
  it('日記の段階は、書いた時点のまま動かない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg', name:'T', diary:{fed:1} });
    const e = api.buildDiary({ fed:1 }, 1);
    eq(e.lv, api.LV_NEW, '書いた時点の段階:');
    api.pet.stage = 'final';
    eq(e.lv, api.LV_NEW, '育っても動かないこと:');
  });
  //  絵日記だった頃のセーブ（lv=0）も、いまは同じ文として読める
  it('うまれたての日記も、段階を持たない古い日記も、文として読める', () => {
    const { api, clock } = load();
    pet(api, clock);
    const base = { d:1, n:'T', t:['fed'], v:[0], s:'', vo:'plain', c:'', cv:0,
                   ts: clock.now(), cd:'x' };
    ok(api.diaryBody(base).length > 0, '段階が無い日記の本文が出ない');
    const old = Object.assign({}, base, { lv: api.LV_NEW, wr: 0 });
    ok(api.diaryBody(old).length > 0, 'うまれたての日記の本文が出ない');
  });
  //  実際に描いている値を見る。以前は同じ判定を持つ別の関数（diaryFontSize）を
  //  調べていたが、その関数はどこからも呼ばれておらず、描画側を壊しても素通りしていた
  it('本文の大きさは 言語で変わる', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const at = src.indexOf('function drawDiaryText');
    ok(at > 0, '本文を描くところが見つからない');
    const body = src.slice(at, at + 700);
    const m = body.match(/const fs = \(lang === 'ja'\) \? (\d+) : (\d+);/);
    ok(m, `本文の大きさを決めるところが見つからない`);
    eq(+m[1], 10, '日本語の本文の大きさ:');
    eq(+m[2], 6,  '英語の本文の大きさ:');
    //  書体もそれぞれに合わせて切り替えていること
    const fontLine = body.split('\n').find(l => l.includes('ctxT.font'));
    ok(fontLine, '書体を決めているところが見つからない');
    ok(/lang\s*===\s*'ja'/.test(fontLine), `言語で書体を切り替えていない: ${fontLine.trim()}`);
    ok(fontLine.includes('JP_FONT') && fontLine.includes('Press Start 2P'),
       `両方の書体を使っていない: ${fontLine.trim()}`);
  });
  //  初日の一言が読めることが目的なので、段階で描き分けないこと。
  //  絵記号に戻すと、いちばん短い日の日記だけが読めなくなる
  it('どの段階の日記も、文で描く（描き分けを作らない）', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    for(const name of ['DIARY_PICT', 'TAG_PICT', 'DIARY_SCRAWL', 'diaryMarks', 'drawDiaryMarks'])
      ok(!src.includes(name), `${name} が残っている`);
    const at = src.indexOf('drawDiaryText(e);');
    ok(at > 0, '本文を描くところが見つからない');
    //  描く直前に段階での分岐が無いこと
    const before = src.slice(Math.max(0, at - 400), at);
    ok(!/if\s*\(.*LV_NEW/.test(before), 'うまれたてだけ別扱いする分岐が残っている');
  });
  // 来たばかりの子がいきなり画面いっぱいに書くのは、絵として不自然
  it('書く量は日を追って少しずつ増える', () => {
    const { api, clock } = load();
    pet(api, clock, { P:0 });
    const at = d => { api.pet.birth = clock.now() - (d-1)*86400000; return api.diaryStyle().topics; };
    const got = [1,2,3,4,5].map(at);
    eq(got.slice(0,3), [1,2,3], '1日目1話題／2日目2話題／3日目3話題:');
    eq(got[3], got[4], '4日目で通常にもどり、以後は増えない:');
    ok(got.every((v,i) => i === 0 || v >= got[i-1]), `減らないこと（${got}）`);
    //  おっとりは4話題まで伸びる
    pet(api, clock, { P:-100 });
    eq(at(4), 4, 'おっとりの4日目:');
  });
  //  到着した日の夜に、その日ぶんが1件書かれる
  it('到着した日の夜に、その日ぶんが1件書かれる', () => {
    const { api, clock } = load();
    const now = clock.now();
    pet(api, clock, { stage:'egg', name:'DAY1', birth:now, lastTick:now,
                      calDay:api.todayKey(), diaryDay:'', EP:0.2, eggTargetEP:1.25,
                      wokeUntil: now + 86400000 });
    api.pet.diary = { fed:1, cleaned:1, praised:1 };
    const base = (()=>{ const x = new Date(now); x.setHours(0,0,0,0); return x.getTime(); })();
    for(let h=10; h<=22; h++){ clock.set(base + h*3600000); api.advancePet(); }
    eq(api.diaryLog.length, 1, '初日の夜に届くこと:');
    eq(api.diaryLog[0].lv, api.LV_NEW, 'うまれたての段階で書かれること:');
    //  初日の日記が読めること。以前は絵記号に置きかわり、一言も読めなかった
    const body = api.diaryBody(api.diaryLog[0]).filter(Boolean);
    ok(body.length > 0, '初日の本文が空');
    //  用意した文だけで出来ていること（絵記号や記号の代替が混ざっていない）。
    //  出どころは 出来事・結び・ひとりごとの3つ
    const all = [];
    for(const set of Object.values(api.DIARY_LINES))
      for(const m of set) all.push(...(m.ja||[]), ...(m.en||[]));
    for(const set of Object.values(api.DIARY_CLOSE))
      for(const m of set) all.push(...(m.ja||[]), ...(m.en||[]));
    for(const m of Object.values(api.DIARY_MUSINGS))
      for(const lg of ['ja','en'])
        for(const vo of Object.values(m[lg]||{})) all.push(...vo);
    ok(body.every(l => all.includes(l)), `本文に用意した文以外が出ている: ${JSON.stringify(body)}`);
  });
  //  「最初は一言、だんだん長くなる」こと。話題の上限は日数で開く（diaryStyle の cap）。
  //  話題の数は日数で決まるので単調に増えるが、本文の行数は
  //  選ばれた言い回しが1行か2行かで日ごとに揺れる。行数は平均で見る
  it('初日は一言ほど短く、日を追って長くなる', () => {
    const facts = { fed:1, cleaned:1, praised:1, clear:1, slept:1 };
    const topics = [], lines = [];
    const TRIALS = 40;
    for(let d=1; d<=4; d++){
      let t = 0, l = 0;
      for(let i=0;i<TRIALS;i++){
        const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
        pet(api, clock, { stage:'mid', name:'T' });
        api.pet.birth = clock.now() - (d-1)*86400000;
        const e = api.buildDiary(facts, d, '2026-06-' + (14+d));
        if(e){ t += e.t.length; l += api.diaryBody(e).filter(Boolean).length; }
      }
      topics.push(t / TRIALS); lines.push(l / TRIALS);
    }
    eq(topics[0], 1, '初日の話題数:');
    for(let i=1;i<topics.length;i++)
      ok(topics[i] >= topics[i-1], `${i+1}日目で話題が減っている: ${topics}`);
    ok(topics[3] > topics[0], `4日目になっても話題が増えていない: ${topics}`);
    ok(lines[0] <= 3, `初日が平均${lines[0].toFixed(1)}行あって、一言に見えない`);
    ok(lines[3] > lines[0] + 1,
       `4日目の本文が伸びていない（初日 ${lines[0].toFixed(1)}行 → 4日目 ${lines[3].toFixed(1)}行）`);
  });
  it('幼いうちは結びの言葉を書かない', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.pet.stage = 'egg';   eq(api.diaryStyle().close, '');
    api.pet.stage = 'mid';   eq(api.diaryStyle().close, '');
    api.pet.stage = 'larva'; ok(api.diaryStyle().close !== '', 'こどもからは書くこと');
  });
});

// ══ 系統わけ ══════════════════════════════════════════════
//  ミニゲームの偏りが主、世話の傾向が従。ぶつかったらゲームが勝つ。
//  spacewalk/甘やかし→マーシャン、abduction/しつけ→グレイ、shootingstar/どちらでもない→インベーダー
describe('系統わけ', () => {
  //  A/日 を狙った値にするため、birth を DAYS 日前に置いて A をその倍数で入れる
  const DAYS = 5;
  const setup = (api, clock, o) => pet(api, clock, Object.assign({
    stage:'adult', lineage:'', birth: clock.now() - DAYS*86400000,
    plays:{sw:0,ss:0,ab:0}, A:0, D:50, Dm:50 }, o));
  const aPerDay = n => n * DAYS;

  it('遊びも世話も偏りがなければインベーダー（決め手なし）', () => {
    const { api, clock } = load();
    setup(api, clock, { plays:{sw:5,ss:5,ab:5}, A:aPerDay(5) });
    eq(api.pickLineage(), 'inv');
  });
  it('ミニゲーム3種が3系統に対称に対応する', () => {
    const { api, clock } = load();
    for(const [k, want] of [['sw','tako'], ['ss','inv'], ['ab','grey']]){
      const p = {sw:0,ss:0,ab:0}; p[k] = 12;              // 全振り＝playBias 1.0
      setup(api, clock, { plays:p });
      eq(api.pickLineage(), want, k+' 全振り:');
    }
  });
  it('均等に遊んでも、甘やかせばマーシャン', () => {
    const { api, clock } = load();
    const need = api.LINEAGE_TH / api.LINEAGE_CARE_W * api.A_SPOIL_SCALE;   // A/日 20
    setup(api, clock, { plays:{sw:5,ss:5,ab:5}, A:aPerDay(need + 0.5) });
    eq(api.pickLineage(), 'tako', '線を越えた:');
    setup(api, clock, { plays:{sw:5,ss:5,ab:5}, A:aPerDay(need - 0.5) });
    eq(api.pickLineage(), 'inv', '線に少し足りない:');
  });
  it('均等に遊んでも、しつけが通っていればグレイ', () => {
    const { api, clock } = load();
    const need = api.LINEAGE_D_MIN
      + api.LINEAGE_TH / api.LINEAGE_CARE_W * (api.LINEAGE_D_FULL - api.LINEAGE_D_MIN);
    setup(api, clock, { plays:{sw:5,ss:5,ab:5}, Dm:need + 0.5 });
    eq(api.pickLineage(), 'grey', '線を越えた:');
    setup(api, clock, { plays:{sw:5,ss:5,ab:5}, Dm:need - 0.5 });
    eq(api.pickLineage(), 'inv', '線に少し足りない:');
  });
  it('しつけが単独で決め手になる線は、ふつうに遊んで毎回叱れば届く高さ', () => {
    const { api } = load();
    //  実測：1日6回さそって毎回叱ると Dm≒67、いい加減（3割）だと Dm≒47 で LINEAGE_D_MIN 未満。
    //  ここが甘やかし側（A/日20＝おやつ数回で届く）と釣り合っていないと、
    //  しつけルートだけ実質到達不能になる
    const need = api.LINEAGE_D_MIN
      + api.LINEAGE_TH / api.LINEAGE_CARE_W * (api.LINEAGE_D_FULL - api.LINEAGE_D_MIN);
    ok(need <= 70, 'しつけの線が高すぎる: Dm' + need.toFixed(1));
    ok(need > api.LINEAGE_D_MIN, 'しつけの線が低すぎる: Dm' + need.toFixed(1));
  });
  it('しつけ度が下限以下なら寄与しない', () => {
    const { api, clock } = load();
    setup(api, clock, {});
    eq(api.discTrait(), 0, 'Dm50:');
    api.pet.Dm = api.LINEAGE_D_MIN;
    eq(api.discTrait(), 0, '下限ちょうど:');
    api.pet.Dm = api.LINEAGE_D_FULL;
    eq(api.discTrait(), 1, '上限:');
  });
  it('世話と遊びがぶつかったらゲームが勝つ', () => {
    const { api, clock } = load();
    //  甘やかしを最大にしても、アブダクション全振りには勝てない（0.45 < 1.0）
    setup(api, clock, { plays:{sw:0,ss:0,ab:12}, A:aPerDay(api.A_SPOIL_SCALE) });
    eq(api.pickLineage(), 'grey');
  });
  it('放置は系統に対して中立（放置してもしなくても結果が変わらない）', () => {
    const { api, clock } = load();
    //  放置の帰結は体型と帰還エンディングで効かせる。ここでも効かせると
    //  「グレイ＝手を抜いた結果」になり、系統に優劣をつけない方針と衝突する。
    //  偏りが決め手ぎりぎり（playBias 0.31）の並びを使うと、放置が少しでも効けば結果が動く
    const NEAR = [{sw:7,ss:3,ab:3}, {sw:3,ss:3,ab:7}, {sw:3,ss:7,ab:3}, {sw:5,ss:5,ab:5}];
    for(const p of NEAR){
      setup(api, clock, { plays:p, A:0 });
      const base = api.pickLineage();
      setup(api, clock, { plays:p, A:aPerDay(-api.A_NEGLECT_SCALE) });   // 放置度100
      eq(api.pickLineage(), base, JSON.stringify(p)+' 放置しても:');
    }
  });
});

// ══ 進化 ══════════════════════════════════════════════════
//  プランプ＝大食い または 甘やかし ／ スリーク＝丁寧なケア かつ ミニゲーム制覇 ／
//  プリックリー＝ケアが雑。どれにも当たらなければ最終形態にならず、成体のままとどまる
describe('寝姿', () => {
  //  タコ・インベーダーは人型ではないので、横たわらせると何の形か読めない。
  //  足を体の下に畳むだけにする。2段では足先が残って立って見えたので、もう1段落とす
  //   （タコ系は足がそのまま見た目の芯なので、畳む量を1段ぶん控えめ）
  const TUCK = { t1:2, t2:2, t3:3, i1:3, i2:3, i3:3 };
  it('タコとインベーダーは 足を畳んで寝る', () => {
    const { api } = load();
    for(const [k, n] of Object.entries(TUCK)){
      const a = api.S4_SPR[k], z = api.S4_SLEEP[k];
      ok(a && z, `${k} のスプライトが無い`);
      eq(a.length - z.length, n, `${k} 畳んだ段数:`);
      ok(a.length - z.length >= 2, `${k} 足が伸びたまま`);
      //  幅は変わらない。畳むのは下の段だけで、体を作り直しているわけではない
      eq(z[0].length, a[0].length, `${k} 寝姿の幅:`);
      //  上から順に、起きている姿と同じ段が残っていること（目の閉じ線だけが違う）
      const eyes = z.filter((r, y) => JSON.stringify(r) !== JSON.stringify(a[y])).length;
      ok(eyes >= 1 && eyes <= 2, `${k} 目の描き替えが ${eyes}段ある`);
    }
  });

  //  グレイは人型なので、仰向けを横から見た姿を別に描いている（原画から起こしたもの）。
  //  顔も横を向くので、とじた目は たて線の穴になる
  it('グレイは 仰向けで寝る', () => {
    const { api } = load();
    const pair = { grey: [api.S3_SPR.grey, api.S3_SLEEP.grey],
                   g1: [api.S4_SPR.g1, api.S4_SLEEP.g1],
                   g2: [api.S4_SPR.g2, api.S4_SLEEP.g2],
                   g3: [api.S4_SPR.g3, api.S4_SLEEP.g3] };
    for(const [k, [a, z]] of Object.entries(pair)){
      eq(z, api.G_LIE[k], `${k} が横たわり姿を使っていない:`);
      //  立ち姿は縦長、寝姿は横長。向きが入れ替わるのが「横になる」ということ
      ok(a.length > a[0].length, `${k} の立ち姿が縦長でない: ${a[0].length}×${a.length}`);
      ok(z[0].length > z.length, `${k} の寝姿が横長でない: ${z[0].length}×${z.length}`);
      ok(z.length <= a.length, `${k} 寝たら背が高くなった: ${a.length}段 → ${z.length}段`);
      ok(z[0].length >= a[0].length, `${k} 寝たら幅が狭くなった: ${a[0].length} → ${z[0].length}`);
      ok(z[0].length <= 20, `${k} 寝姿が広すぎる（画面と歩ける幅を圧迫する）: ${z[0].length}`);

      //  とじた目は たて線。立ち姿の よこ線を90度まわしたもので、
      //  これが無い＝顔だけ正面を向いたままということ。
      //   まわりを ぐるりと塗りに囲まれた たて2ドット以上の穴を さがす。
      //   左右も見ないと、触覚のあいだの すきまを 目と数えてしまう
      const eyes = [];
      for(let x = 1; x < z[0].length - 1; x++){
        let run = 0;
        for(let y = 0; y < z.length; y++){
          if(!z[y][x]){ run++; continue; }
          const y0 = y - run;
          if(run >= 2 && y0 - 1 >= 0 && z[y0 - 1][x] &&
             z.slice(y0, y).every(r => r[x - 1] && r[x + 1])) eyes.push([x, run]);
          run = 0;
        }
      }
      ok(eyes.length >= 1, `${k} たて線のとじた目が無い（顔が正面を向いたまま）`);

      //  体を縦にすっぱり切っている列。足首のすきま1本までは許すが、
      //  頭と胴のあいだで切れていたら、生きものが2匹に見える
      const cols = z[0].length, gaps = [];
      for(let x = 1; x < cols - 1; x++){
        if(z.every(r => !r[x]) &&
           z.some(r => r.slice(0, x).some(v => v)) &&
           z.some(r => r.slice(x + 1).some(v => v))) gaps.push(x);
      }
      ok(gaps.length <= 1, `${k} 体が ${gaps.length + 1}つに切れている: ${gaps.join(',')}列目`);
      if(gaps.length) ok(gaps[0] >= cols * 0.7,
        `${k} 頭と胴のあいだで体が切れている: ${gaps[0]}列目（幅${cols}）`);
    }
    //  4種が同じ絵になっていないこと
    const seen = Object.keys(pair).map(k => JSON.stringify(api.G_LIE[k]));
    eq(new Set(seen).size, 4, 'グレイ4種で違う絵になっている数:');
  });

  //  グレイの寝姿は立ち姿から作れない別絵なので、
  //  病気の姿と 目を左右に動かす処理が 寝姿を見に行くと、体が入れ替わって壊れる
  it('病気の姿は 寝姿ではなく 正面のとじ目から作る', () => {
    const { api } = load();
    const cases = [['final','g1'],['final','g2'],['final','g3'],['final','i2'],['final','t1'],
                   ['adult','grey'],['adult','tako'],['adult','inv'],['larva',null]];
    for(const [stage, key] of cases){
      api.pet.stage = stage;
      if(stage === 'final') api.pet.form = key; else if(key) api.pet.lineage = key;
      const sp = api.charSprites();
      const rows = api.eyeRows(sp);
      ok(rows.length >= 1, `${stage}/${key} で目の段が見つからない`);
      const sick = api.sickSprite(sp);
      ok(JSON.stringify(sick) !== JSON.stringify(sp.rest),
         `${stage}/${key} の病気の姿が 立ち姿のまま（目が閉じていない）`);
      //  差し替えた段も 立ち姿と同じ幅であること（横向きの絵が混ざっていない）
      eq(sick.length, sp.rest.length, `${stage}/${key} 病気の姿の段数:`);
      for(const r of sick) eq(r.length, sp.rest[0].length, `${stage}/${key} 病気の姿の幅:`);
    }
  });

  //  グレイの寝姿は立ち姿より7ドット広い。端で寝ると画面からはみ出すので押し戻されるが、
  //  一度に動かすと瞬間移動に見える
  it('端で寝たとき、寝姿の幅ぶん ずり寄る（飛ばない）', () => {
    const { api } = load();
    ok(api.CLAMP_SLIDE > 0 && api.CLAMP_SLIDE <= 1,
       `1コマで寄せる量が大きすぎる（瞬間移動に見える）: ${api.CLAMP_SLIDE}`);
    //  グレイの寝姿は 立ち姿より広い＝押し戻しが起きる形になっている
    const over = Math.max(api.S3_SLEEP.grey[0].length - api.S3_SPR.grey[0].length,
                          ...['g1','g2','g3'].map(k => api.S4_SLEEP[k][0].length - api.S4_SPR[k][0].length));
    ok(over > 0, `どの寝姿も立ち姿より広くない: ${over}`);
    //  寄せきるまでが長すぎない（1コマ100ms）
    const frames = Math.ceil(over / api.CLAMP_SLIDE);
    ok(frames <= 20, `寄せきるのに ${frames}コマ（${(frames*0.1).toFixed(1)}秒）かかる`);
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(/if\(lim !== walkX\) walkX \+= Math\.sign\(lim - walkX\)/.test(src),
       '端に着いたとき 一気にクランプしている');
  });

  it('足を畳んでも 足元は地面に着く', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    //  背が縮んだぶん浮いてしまわないよう、下端を地面に合わせて描いていること
    ok(/const by = MAIN_GY - body\.length;/.test(src), '足元を地面に据える計算が無い');
  });
});

describe('進化', () => {
  const setup = (api, clock, o) => {
    api.pet.total = { feed:0, snack:0, clean:0, med:0 };
    return pet(api, clock, Object.assign({
      stage:'larva', lineage:'inv', C:55, fullFeeds:0, sickCount:0, highBDays:0,
      best:{sw:0,ss:0,ab:0}, nightPlays:0, D:50 }, o));
  };
  // 甘やかしルートを満たす一式。setup のあとに呼ぶこと（setup が total を戻すため）。
  //  over で片方だけ崩して「両方いる」ことを確かめる
  const pamper = (api, over) => {
    api.pet.highBDays = api.PAMPER_DAYS;
    api.pet.total.snack = api.PAMPER_SNACKS;
    Object.assign(api.pet, over || {});
  };

  it('ケアが雑ならワイルド。印が残る', () => {
    const { api, clock } = load();
    setup(api, clock, { C:10 });
    eq(api.pickForm(), 'i3');
    eq(api.pet.formWild, true);
  });
  it('大食いならプチ', () => {
    const { api, clock } = load();
    setup(api, clock, { fullFeeds:12, sickCount:2 });
    eq(api.pickForm(), 'i1');
    eq(api.pet.formWild, false);
  });
  //  すらりへの道は3つ。「ケアだけ」「ゲームだけ」「両方そこそこ」
  //  ケアは足りていても、構い倒して恨みを溜めた子は素直には育たない
  it('ケアが高くても、恨みが溜まっていればとげとげ', () => {
    const { api, clock } = load();
    const NONE = { sw:0, ss:0, ab:0 };
    setup(api, clock, { C:99, M:api.M_FORM_BAD, best:NONE });
    eq(api.pickForm(), 'i3', '恨みが線に届いた:');
    eq(api.pet.formWild, true, '印も残ること:');
    setup(api, clock, { C:99, M:api.M_FORM_BAD - 1, best:NONE });
    eq(api.pickForm(), 'i2', '恨みがあと1なら、ケアどおり すらり:');
  });
  it('恨みの線は、たまに起こす程度では届かない高さ', () => {
    const { api } = load();
    //  睡眠妨害1回で+9、きちんと世話をした日は-9。3日に1回起こす程度なら
    //  差し引き0で溜まらない（実測でもDm相当の位置に留まる）。
    //  毎日のように起こし続けた場合だけ届くよう、8回ぶんより上に置く
    ok(api.M_FORM_BAD > api.M_ADJ.wokenUp * 7, `線が低すぎる: ${api.M_FORM_BAD}`);
    ok(api.M_FORM_BAD < 100, `線が上限に張り付いている: ${api.M_FORM_BAD}`);
  });
  it('すらりには3つの道があり、どれか1つ満たせば足りる', () => {
    const { api, clock } = load();
    const NONE = { sw:0, ss:0, ab:0 };
    setup(api, clock, { C:api.C_FORM_SLEEK, best:NONE });
    eq(api.pickForm(), 'i2', 'ケアだけで極めた:');
    setup(api, clock, { C:api.C_FORM_BAD, best:api.ALLROUND });
    eq(api.pickForm(), 'i2', 'ゲームだけで極めた:');
    setup(api, clock, { C:api.C_FORM_GOOD, best:api.ALLROUND_SOFT });
    eq(api.pickForm(), 'i2', '両方そこそこ:');
  });
  it('すらりの3つの道は、どれも一歩手前では届かない', () => {
    const { api, clock } = load();
    const NONE = { sw:0, ss:0, ab:0 };
    setup(api, clock, { C:api.C_FORM_SLEEK - 1, best:NONE });
    eq(api.pickForm(), '', 'ケアがあと1:');
    setup(api, clock, { C:api.C_FORM_GOOD - 1, best:api.ALLROUND_SOFT });
    eq(api.pickForm(), '', '両方そこそこのケアがあと1:');
    // ゲーム単独・併用とも、3本すべてを越えることが要る
    for(const [nm, C, base] of [['単独', api.C_FORM_BAD, api.ALLROUND],
                                ['併用', api.C_FORM_GOOD, api.ALLROUND_SOFT]])
      for(const k of ['sw','ss','ab']){
        const b = Object.assign({}, base); b[k] -= 1;
        setup(api, clock, { C, best:b });
        eq(api.pickForm(), '', `${nm}: ${k} があと1:`);
      }
  });
  it('ゆるいほうの線は、単独ルートより必ず低い', () => {
    const { api } = load();
    for(const k of ['sw','ss','ab'])
      ok(api.ALLROUND_SOFT[k] < api.ALLROUND[k],
         `${k}: ゆるい線(${api.ALLROUND_SOFT[k]})が単独(${api.ALLROUND[k]})より低くない`);
    ok(api.C_FORM_GOOD < api.C_FORM_SLEEK, 'ケアの線が逆転している');
  });
  it('どれにも当たらなければ最終形態にならない', () => {
    const { api, clock } = load();
    setup(api, clock, { C:55 });
    eq(api.pickForm(), '');
  });
  it('ワイルドは何よりも優先する', () => {
    const { api, clock } = load();
    setup(api, clock, { C:10, fullFeeds:12, sickCount:2, best:{sw:300,ss:150,ab:500} });
    eq(api.pickForm(), 'i3');
    eq(api.pet.formWild, true);
  });
  it('大食いはケアが丁寧より優先（プランプが上）', () => {
    const { api, clock } = load();
    setup(api, clock, { C:85, fullFeeds:12, sickCount:2 });
    eq(api.pickForm(), 'i1');
  });
  it('甘やかしでもプランプになる（大食いを通らない道）', () => {
    const { api, clock } = load();
    setup(api, clock, { C:55 }); pamper(api);
    ok(!api.bigEater(), '大食いは成立していないこと');
    ok(api.pampered(), '甘やかしが成立すること');
    eq(api.pickForm(), 'i1');
    eq(api.pet.formWild, false);
  });
  it('甘やかしは「なかよしを長く保つ」と「おやつ」の両方が要る', () => {
    const { api, clock } = load();
    setup(api, clock, { C:55 }); pamper(api, { highBDays: api.PAMPER_DAYS - 1 });
    eq(api.pickForm(), '', '連続日数が1日足りない:');
    setup(api, clock, { C:55 }); pamper(api);
    api.pet.total.snack = api.PAMPER_SNACKS - 1;
    eq(api.pickForm(), '', 'おやつが1回足りない:');
    setup(api, clock, { C:55, highBDays: api.PAMPER_DAYS });   // おやつを一度も与えていない
    eq(api.pickForm(), '', 'なかよしだけでは足りない:');
  });
  it('甘やかしていてもケアが雑ならプリックリーが勝つ', () => {
    const { api, clock } = load();
    setup(api, clock, { C:10 }); pamper(api);
    eq(api.pickForm(), 'i3');
    eq(api.pet.formWild, true);
  });
  it('甘やかしとミニゲーム制覇が両立したらプランプになる', () => {
    const { api, clock } = load();
    setup(api, clock, { C:85, best:{sw:900,ss:900,ab:900} }); pamper(api);
    ok(api.allRounder(), 'スリークの条件も満たしていること');
    eq(api.pickForm(), 'i1', '接し方が戦績より優先される:');
  });
  it('なかよしを高く保った日数は、下がった日に切れる', () => {
    const { api, clock } = load();
    pet(api, clock, { B: api.B_PAMPER, careStreak:5 });
    api.closeOneDay({}, 2, false);
    eq(api.pet.highBDays, 1, '境目ちょうどでも数える:');
    api.closeOneDay({}, 2, false);
    eq(api.pet.highBDays, 2);
    api.pet.B = api.B_PAMPER - 1;
    api.closeOneDay({}, 2, false);
    eq(api.pet.highBDays, 0, '1日でも下回れば0に戻る:');
  });
  // 少し余裕のある高さ（線+5）から放置すると、なかよしが削られて線を割る。
  //  1日の遅れで即アウトにはしないが、放り出せば必ず切れる、という効き方
  it('放置を続ければ、なかよしが削られて連続日数が切れる', () => {
    const { api, clock } = load();
    pet(api, clock, { B: api.B_PAMPER + 5, careStreak:5, highBDays:4 });
    api.closeOneDay({}, 0, false);
    eq(api.pet.highBDays, 5, '1日ぶんの余裕はある:');
    api.closeOneDay({}, 0, false);
    eq(api.pet.highBDays, 0, '2日目で線を割る:');
  });
  it('体型は系統によらず、どの系統でも3つとも出る', () => {
    const { api, clock } = load();
    for(const [L, k] of [['grey','g'], ['tako','t'], ['inv','i']]){
      setup(api, clock, { lineage:L, C:10 });                      eq(api.pickForm(), k+'3', L+':');
      setup(api, clock, { lineage:L, fullFeeds:12, sickCount:2 });  eq(api.pickForm(), k+'1', L+':');
      setup(api, clock, { lineage:L, C:85, best:{sw:600,ss:700,ab:400} });
                                                                  eq(api.pickForm(), k+'2', L+':');
    }
  });
  it('「夜更かし＋しつけ」ではもう進化しない（廃止した）', () => {
    const { api, clock } = load();
    setup(api, clock, { lineage:'inv', C:55, nightPlays:20, D:90 });
    eq(api.pickForm(), '', '条件にならない:');
  });
  it('条件がそろわないうちは成体のまま。あとで満たせば最終形態になる', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', EP:12, C:55,
                      fullFeeds:0, sickCount:0, best:{sw:0,ss:0,ab:0} });
    api.maybeEvolve();
    eq(api.pet.stage, 'adult', 'まだ成体:');
    eq(api.pet.form, '', '姿も決まらない:');
    api.pet.C = 85; api.pet.best = { sw:600, ss:700, ab:400 };   // 世話を立て直し、記録も伸ばした
    api.maybeEvolve();
    eq(api.pet.stage, 'final', '最終形態になる:');
    eq(api.pet.form, 'i2');
  });
});

// ══ セーブデータの移行 ════════════════════════════════════
// ══ セーブの保護 ══════════════════════════════════════════
//  読めなかったときに黙って新しいたまごから始めると、3週間育てた子が
//  何の断りもなく消える。実際に一度起きているので、控えと退避で守る
describe('セーブの保護', () => {
  const good = JSON.stringify({ name:'GOOD', stage:'larva', lineage:'inv',
    B:50, C:50, D:50, Dm:50, P:0, EP:4, v:2, hunger:4, mood:4, health:'GOOD' });

  it('読み込めたら、その原文を控えに残す', () => {
    const { api, store } = load({ storage:{ myvader_pet: good } });
    eq(api.pet.name, 'GOOD', 'ふつうに読めること:');
    eq(store.get('myvader_pet_bak'), good, '控えが原文のまま残ること:');
    ok(!store.has('myvader_pet_bad'), '退避は作られないこと');
  });
  it('本体が壊れていたら、控えから戻す', () => {
    const { api } = load({ storage:{ myvader_pet: '{こわれた', myvader_pet_bak: good } });
    eq(api.pet.name, 'GOOD', '控えの子が戻ること:');
    ok(api.saveRecovered, '控えから戻したことが分かること');
  });
  it('読めなかった原文は捨てずに退避する', () => {
    const { store } = load({ storage:{ myvader_pet: '{こわれた' } });
    eq(store.get('myvader_pet_bad'), '{こわれた', '原文がそのまま残ること:');
  });
  it('本体も控えも壊れていても、落ちずに新しく始まる', () => {
    const { api } = load({ storage:{ myvader_pet: '{こわれた', myvader_pet_bak: 'これも壊れている' } });
    eq(api.pet.name, '', '新しいたまごから始まること:');
  });
  // 「まだ子がいない」状態と「壊れている」状態を取り違えると、
  //  リセットしたあとに前の子が掘り起こされてしまう
  it('まだ子がいないときは、控えを掘り起こさない', () => {
    const empty = JSON.stringify({ name:'', stage:'egg' });
    const { api } = load({ storage:{ myvader_pet: empty, myvader_pet_bak: good } });
    eq(api.pet.name, '', '前の子が戻ってこないこと:');
  });
  it('セーブが空でも、控えを掘り起こさない', () => {
    const { api } = load({ storage:{ myvader_pet_bak: good } });
    eq(api.pet.name, '', '');
  });
  it('控えから戻した子も、ちゃんと移行を通る', () => {
    const oldSave = JSON.stringify({ name:'OLD', stage:'final', lineage:'inv', form:'i1',
      B:50, C:50, D:50, EP:11 });                       // 版番号なし
    const { api } = load({ storage:{ myvader_pet: '{こわれた', myvader_pet_bak: oldSave } });
    eq(api.pet.name, 'OLD');
    eq(api.pet.v, api.SAVE_V, '最新の版に上がっていること:');
    eq(api.pet.total, { feed:0, snack:0, clean:0, med:0 }, '欠けた項目が埋まること:');
  });
  it('控え・退避の鍵は本体とぶつからない', () => {
    const { api } = load();
    const keys = [api.SAVE_KEY, api.SAVE_BAK, api.SAVE_BAD];
    eq(new Set(keys).size, 3, '3つとも別の名前であること:');
  });
});

describe('セーブ移行', () => {
  // 版番号を持たない、いちばん古い形のセーブ（隠しパラメータが増える前）
  const old = (over = {}) => Object.assign({
    name:'ZUZU', birth: 0, lastTick: 0, hunger:4, mood:4, health:'GOOD',
    P:0, D:50, Dm:50, C:50, B:60, W:0, A:0, EP:11,
    stage:'final', lineage:'inv', form:'i1',
    best:{sw:0, ss:0, ab:0}, plays:{sw:0, ss:0, ab:0},
    dead:'', gone:false, sickCount:0, fullFeeds:0,
  }, over);

  it('版番号が付き、欠けた項目が既定で埋まる', () => {
    const { api } = load();
    const p = api.migratePet(old());
    eq(p.v, api.SAVE_V);
    eq(p.M, 0);
    eq(typeof p.touchKinds, 'object');
    eq(p.rhythmUntil, 0);
  });
  it('すでに成体・最終形態の子には口調を与える（空のままにしない）', () => {
    const { api } = load();
    eq(api.migratePet(old({ stage:'final', lineage:'grey', P:60 })).voice, 'rough');
    eq(api.migratePet(old({ stage:'adult', lineage:'tako', P:-60 })).voice, 'calm');
    eq(api.migratePet(old({ stage:'final', lineage:'inv',  P:0   })).voice, 'plain');
  });
  it('まだ成体になっていない子には口調を与えない（成体で決まるため）', () => {
    const { api } = load();
    eq(api.migratePet(old({ stage:'larva', form:'' })).voice, '');
  });
  it('ワイルド系の印を姿から復元する', () => {
    const { api } = load();
    eq(api.migratePet(old({ form:'i3' })).formWild, true,  'i3はワイルド:');
    eq(api.migratePet(old({ form:'i1' })).formWild, false, 'i1は違う:');
    eq(api.migratePet(old({ form:'t2' })).formWild, false, 't2は違う:');
  });
  it('ごほうびの隠し形態はワイルド扱いにしない', () => {
    const { api } = load();
    eq(api.migratePet(old({ lineage:'grey', form:'g3',
        best:{sw:300, ss:150, ab:500} })).formWild, false,
        'オールラウンダー（当時の基準で判定する）:');
    eq(api.migratePet(old({ lineage:'tako', form:'t3',
        fullFeeds:12, sickCount:2 })).formWild, false, 'クラーケン:');
    eq(api.migratePet(old({ lineage:'grey', form:'g3',
        best:{sw:0, ss:0, ab:0} })).formWild, true, '条件を満たさないg3はワイルド:');
  });
  it('育っている途中の子に、生まれたての下駄を与えない', () => {
    const { api } = load();
    eq(api.migratePet(old()).careStreak, 0);
    eq(api.defaultPet().careStreak, 2, '新しく来る子には下駄がある:');
  });
  it('入れ子の項目が欠けていても埋まる', () => {
    const { api } = load();
    const p = api.migratePet(old({ best:{sw:100}, plays:{ab:3}, snapL:{praise:2} }));
    eq(p.best,  {sw:100, ss:0, ab:0});
    eq(p.plays, {sw:0, ss:0, ab:3});
    eq(p.snapL, {praise:2, bad:0, plays:0});
  });
  it('壊れた数値は既定に戻す（NaNのまま比較すると静かに壊れる）', () => {
    const { api } = load();
    const p = api.migratePet(old({ B:'こわれた', C:null, EP:undefined }));
    ok(Number.isFinite(p.B) && Number.isFinite(p.C) && Number.isFinite(p.EP));
  });
  it('移行ずみのセーブは、もう一度読んでも変わらない', () => {
    const { api } = load();
    const once  = api.migratePet(old({ form:'i3' }));
    const twice = api.migratePet(JSON.parse(JSON.stringify(once)));
    eq(twice, once);
  });
  //  移行関数そのものが正しくても、読み込みに繋がっていなければ意味がない。
  //  localStorage に古いセーブを置いた状態で起動して、実際に適用されるかを見る
  it('起動時に、保存されている古いセーブへ移行が実際に走る', () => {
    const saved = old({ stage:'final', lineage:'grey', form:'g3', P:60, C:20,
                        best:{sw:0, ss:0, ab:0} });
    const { api } = load({ storage: { myvader_pet: JSON.stringify(saved) } });
    eq(api.pet.name, 'ZUZU', '読み込めている:');
    eq(api.pet.v, api.SAVE_V, '版番号が付く:');
    eq(api.pet.voice, 'rough', '口調が与えられる:');
    eq(api.pet.formWild, true, 'ワイルドの印が復元される:');
    eq(api.pet.careStreak, 0, '生まれたての下駄を与えない:');
  });
  it('名前が無いセーブ（開始前）は読み込まない', () => {
    const { api } = load({ storage: { myvader_pet: JSON.stringify({ name:'', B:99 }) } });
    eq(api.pet.name, '');
    eq(api.pet.B, api.defaultPet().B, '既定のまま:');
  });
  it('セーブが壊れていても起動できる', () => {
    const { api } = load({ storage: { myvader_pet: '{壊れたJSON' } });
    eq(api.pet.name, '');
  });
  it('版番号を上げたら手当てを書き忘れていないか', () => {
    const { api } = load();
    for(let v = 1; v <= api.SAVE_V; v++)
      ok(typeof api.MIGRATIONS[v] === 'function', `v${v} の移行処理が無い`);
  });
});

// ══ おもいで画面 ══════════════════════════════════════════
describe('おもいで', () => {
  it('体型の呼び名が形態IDの末尾で決まる', () => {
    const { api, clock } = load({ storage: { myvader_lang: 'ja' } });
    pet(api, clock, { form:'i1' }); eq(api.formLabel(), 'プランプ');
    pet(api, clock, { form:'g2' }); eq(api.formLabel(), 'スリーク');
    pet(api, clock, { form:'t3' }); eq(api.formLabel(), 'プリックリー');
    pet(api, clock, { form:''   }); eq(api.formLabel(), '', '未確定なら空:');
  });
  // 言語の選択が保存されていない＝初回起動。日本語で始める
  it('言語の指定が無ければ日本語で始まる', () => {
    const { api, clock } = load();
    pet(api, clock, { form:'i1' }); eq(api.formLabel(), 'プランプ');
  });
  it('体型の呼び名は英語でも出る', () => {
    const { api, clock } = load({ storage: { myvader_lang: 'en' } });
    pet(api, clock, { form:'i1' }); eq(api.formLabel(), 'PLUMP');
    pet(api, clock, { form:'g2' }); eq(api.formLabel(), 'SLEEK');
    pet(api, clock, { form:'t3' }); eq(api.formLabel(), 'PRICKLY');
  });
  // 帰還・旅立ち・侵攻は演出の終わりでおもいでが開く。死には演出が無いので、
  //  おばけをしばらく見せたところが唯一の区切りになる（そこが抜けていた）
  it('おもいでを開くのは一度だけ', () => {
    const { api, clock, store } = load();
    pet(api, clock, { dead:'starve', memShown:false });
    api.endedShowMemory();
    eq(api.pet.memShown, true, '開いた印がつくこと:');
    // 2度目は何もしないはず。開けば必ず保存もするので、保存の跡で見分ける
    store.delete('myvader_pet');
    api.endedShowMemory();
    ok(!store.has('myvader_pet'), '2度目は保存が走った＝また開いている');
  });
  it('おばけを見せてからおもいでを開くまでが、短すぎず長すぎない', () => {
    const { api } = load();
    const sec = api.GHOST_MEM_DELAY * 100 / 1000;   // tickMain は100msごと
    ok(sec >= 2 && sec <= 8, `${sec}秒（おばけをひと目見る間があること）`);
  });
  // ただ揺れているだけだと、待たずにMENUを押されてしまう。
  //  うずくまった体から魂が抜けて昇る動きが「まだ続きがある」と伝える役をしている
  it('うずくまる間・昇る間・開くまでの間が、順に並んでいる', () => {
    const { api } = load();
    const { GHOST_STILL:A, GHOST_RISE_T:B, GHOST_HOLD:C, GHOST_MEM_DELAY:D } = api;
    ok(A > 0, 'うずくまったまま動かない間が要る');
    ok(B > A, `昇る間（${B}）が、うずくまる間（${A}）より短い`);
    ok(C > 0, '昇りきってから開くまでの間が要る');
    eq(D, A + B + C, '合計が おもいでを開くまでの時間と合うこと:');
    const sec = D * 100 / 1000;
    ok(sec >= 3 && sec <= 8, `全体で${sec}秒（長すぎず短すぎず）`);
  });
  // 体の上端から出すと、背の低い子では魂の足元が地面より下になる
  it('魂は足元が地面より下から出ない（どの段階でも）', () => {
    const { api, clock } = load();
    const from = api.MAIN_GY - api.GHOST_SPR.length;     // 足元を地面に置いた高さ
    eq(from + api.GHOST_SPR.length, api.MAIN_GY, '足元が地面にそろうこと:');
    // 体の上端から出していたころは、背の低い段階で地面より下に足が出ていた
    let below = 0;
    for(const st of ['egg','mid','larva','adult','final']){
      pet(api, clock, { dead:'starve', stage:st, lineage:'inv', form:'i2' });
      const body = api.charSprites().sleep || api.charSprites().rest;
      if(api.MAIN_GY - body.length + api.GHOST_SPR.length > api.MAIN_GY) below++;
    }
    ok(below > 0, '体の上端から出すと沈む段階が無い（この直しが要る理由が消えている）');
  });
  it('魂は左右にゆれながら昇る', () => {
    const { api } = load();
    ok(api.GHOST_SWAY_X > 0, 'ゆれ幅が0');
    ok(api.GHOST_SWAY_X <= 4, `ゆれ幅が大きすぎる（${api.GHOST_SWAY_X}）`);
    ok(api.GHOST_SWAY_T >= 2, 'ゆれが速すぎる（ちらついて見える）');
    // 昇るあいだに何度か往復すること
    const cycles = api.GHOST_RISE_T / (2 * Math.PI * api.GHOST_SWAY_T);
    ok(cycles >= 0.8 && cycles <= 4, `ゆれの回数が極端（${cycles.toFixed(1)}往復）`);
  });
  it('体は風にさらわれて左へ流れ、粒ごとに流れ方が違う', () => {
    const { api } = load();
    ok(api.GHOST_DUST_X > 0, '流れる距離が0');
    const s = [];
    for(let y=0;y<8;y++) for(let x=0;x<12;x++) s.push(api.dustDrift(x, y));
    ok(new Set(s).size >= 6, `粒ごとの流れ方がそろいすぎ（${new Set(s).size}種）`);
    ok(Math.min(...s) > 0, '流れない粒があってはいけない');
    // 同じ粒はいつも同じ動き（ちらつかない）
    eq(api.dustDrift(3, 2), api.dustDrift(3, 2));
    ok(api.dustLift(3, 2) === api.dustLift(3, 2), '上下のばらつきもぶれないこと');
  });
  // rx*7 + ry*13 を 6 で割っていたころ、7も13も余りが1で (rx+ry)%6 と同じになり、
  //  同じ値が斜めに並んで「／／」の筋が見えていた
  it('粒の飛び方が斜めにそろわない', () => {
    const { api } = load();
    // 斜めは2方向ある。「＼」だけ見ていると「／」の筋を見逃す
    for(const [dx, dy, name] of [[1, 1, '＼'], [1, -1, '／']]){
      let same = 0, total = 0;
      for(let y=1;y<12;y++) for(let x=0;x<15;x++){
        total++;
        if(api.dustDrift(x, y) === api.dustDrift(x+dx, y+dy)) same++;
      }
      ok(same/total < 0.25, `${name} の向きに同じ値が並びすぎ（${(same/total*100).toFixed(0)}%）`);
    }
    // 横・縦にも筋が出ていないこと
    let row = 0, col = 0, n = 0;
    for(let y=0;y<12;y++) for(let x=0;x<15;x++){
      n++;
      if(api.dustDrift(x, y) === api.dustDrift(x+1, y)) row++;
      if(y+1 < 12 && api.dustDrift(x, y) === api.dustDrift(x, y+1)) col++;
    }
    ok(row / n < 0.25, `横に同じ値が並びすぎ（${(row/n*100).toFixed(0)}%）`);
    ok(col / n < 0.25, `縦に同じ値が並びすぎ（${(col/n*100).toFixed(0)}%）`);
  });
  // 離れる前から崩れると、まだ中にいるのに体だけ消えていくように見える
  it('体が散りはじめるのは、魂が完全に離れてから', () => {
    const { api, clock } = load();
    const gh = api.GHOST_SPR.length, from = api.MAIN_GY - gh, to = api.GHOST_Y_TOP;
    for(const st of ['egg','mid','larva','adult','final']){
      pet(api, clock, { dead:'starve', stage:st, lineage:'inv', form:'i2' });
      const b = api.charSprites().sleep || api.charSprites().rest;
      const by = api.MAIN_GY - b.length;
      const s0 = api.dustStartP(by);
      ok(s0 > 0, `${st}: 昇りはじめと同時に散っている（p=${s0}）`);
      ok(s0 < 1, `${st}: 散る間が残っていない（p=${s0}）`);
      // その時点で、魂の下端が体の上端を追い越していること
      const gy = Math.round(from + (to - from) * s0);
      ok(gy + gh <= by, `${st}: まだ重なっているのに散りはじめる（魂の下端 ${gy+gh} / 体の上端 ${by}）`);
      // ひとつ手前ではまだ重なっている＝遅らせすぎてもいない
      const prev = Math.max(0, s0 - 1/api.GHOST_RISE_T);
      const gyPrev = Math.round(from + (to - from) * prev);
      ok(gyPrev + gh >= by - 1, `${st}: 離れてから散りはじめるまでが遅すぎる`);
    }
  });
  // 上下のばらつきで、チリが地面の線を突き抜けて見えていた
  it('チリは地面より下へ飛ばない', () => {
    const { api, clock } = load();
    for(const st of ['egg','mid','larva','adult','final']){
      pet(api, clock, { dead:'starve', stage:st, lineage:'inv', form:'i2' });
      const b = api.charSprites().sleep || api.charSprites().rest;
      const by = api.MAIN_GY - b.length;
      let worst = -99;
      for(let f=0; f<=api.GHOST_RISE_T; f++){
        const p = f / api.GHOST_RISE_T, drift = p * api.GHOST_DUST_X;
        b.forEach((row,ry)=>row.forEach((v,rx)=>{
          if(!v || !api.fadeKeeps(rx, ry, 1-p)) return;
          const y = Math.min(api.MAIN_GY - 1,
                             by + ry + Math.round(drift * 0.15 * api.dustLift(rx, ry)));
          if(y > worst) worst = y;
        }));
      }
      ok(worst < api.MAIN_GY, `${st}: チリが y=${worst} まで出る（地面は ${api.MAIN_GY}）`);
    }
  });
  it('魂は画面のまんなかまで昇り、はみ出さない', () => {
    const { api, clock } = load();
    pet(api, clock, { dead:'starve', stage:'larva' });
    const body = api.charSprites().sleep || api.charSprites().rest;
    const from = api.MAIN_GY - body.length;          // 体の位置（足元は地面）
    const to   = api.GHOST_Y_TOP;
    ok(to > api.HEADER_Y, `昇りすぎてヘッダーに掛かる（${to} / 線 ${api.HEADER_Y}）`);
    ok(to + api.GHOST_SPR.length < api.MAIN_GY, '地面より下へ行かないこと');
    ok(from - to >= 12, `ほとんど昇らない（${from} → ${to}）`);
    const mid = (api.HEADER_Y + api.MAIN_GY) / 2;
    ok(Math.abs((to + api.GHOST_SPR.length/2) - mid) <= 4,
       `まんなかから離れすぎ（中心 ${to + api.GHOST_SPR.length/2} / 画面のまんなか ${mid}）`);
  });
  it('体は魂が離れるにつれて薄れ、最後は消える', () => {
    const { api } = load();
    // 本体の判定をそのまま呼ぶ。ここで写しを作ると、本体を壊しても気づけない
    const count = keep => { let n = 0;
      for(let y=0;y<4;y++) for(let x=0;x<4;x++) if(api.fadeKeeps(x, y, keep)) n++;
      return n; };
    eq(count(1), 16, 'はじめは全部見えること:');
    eq(count(0), 0,  '最後は残らないこと:');
    ok(count(0.5) > 0 && count(0.5) < 16, '途中は半分ほど残ること');
    ok(count(0.25) < count(0.75), '薄れるほど点が減ること');
    // 同じ点は毎回おなじ扱い（ちらつかない）
    eq(api.fadeKeeps(1, 2, 0.5), api.fadeKeeps(1, 2, 0.5), '判定がぶれないこと:');
  });
  // 世話不足の別れは「家出」。旅立ち（迎えが来る）と印象を分けるため、
  //  迎えは出さず、「・・・」を3回見せてから歩いて出ていく
  it('家出は、迎えを出さずに歩いて出ていく', () => {
    const { api, clock } = load();
    eq(api.RUN_TIMES, 3, '「・・・」の回数:');
    eq(api.RUN_STILL, (api.RUN_ON + api.RUN_OFF) * api.RUN_TIMES, '立ちつくす長さ:');
    ok(api.RUN_SPEED > 0 && api.RUN_SPEED <= 1, `足どりが速すぎる（${api.RUN_SPEED}ドット/コマ）`);
    ok(api.RUN_AFTER > 0, '出ていったあとの間が無い');
    for(const o of [{stage:'larva'}, {stage:'adult', lineage:'grey'},
                    {stage:'final', lineage:'grey', form:'g1'},
                    {stage:'final', lineage:'inv',  form:'i2'}]){
      pet(api, clock, o);
      const cw = api.charSprites().a[0].length;
      const walk = api.runawayLen(cw) - api.RUN_AFTER - api.RUN_STILL;   // 歩いているコマ数
      const x = api.centerX(cw) - walk * api.RUN_SPEED;
      ok(x + cw <= 0, `${o.stage}/${o.form||''}: 画面に残ったまま終わる（右端 ${x + cw}）`);
      // 長すぎない（見ている側が待たされない）
      ok(api.runawayLen(cw) <= 160, `長すぎる（${(api.runawayLen(cw)/10).toFixed(1)}秒）`);
    }
  });
  it('お別れの形が5種とも言葉になる', () => {
    const { api, clock } = load();
    const got = {};
    for(const [k, o] of [['餓死',{dead:'starve'}], ['病死',{dead:'sick'}],
                         ['帰還',{gone:true, goneBy:'return'}], ['旅立ち',{gone:true, goneBy:'depart'}],
                         ['侵攻',{gone:true, goneBy:'invade'}]]){
      pet(api, clock, o); got[k] = api.endLabel();
      ok(got[k], k + ' の言葉が無い');
    }
    // 餓死と病死は同じ言葉（どちらも「ちからつきた」）。連れて行かれる3種は互いに違う
    eq(got['餓死'], got['病死'], '亡くなった子の言葉:');
    const away = [got['帰還'], got['旅立ち'], got['侵攻']];
    eq(new Set(away).size, 3, '連れて行かれる3種は違う言葉であるべき:');
    ok(!away.includes(got['餓死']), '亡くなった子と同じ言葉になっている');
    pet(api, clock, {});                       // まだ続いている子
    eq(api.endLabel(), '', '別れていなければ空:');
  });
  it('おもいでは、別れたあとだけメニューに並ぶ', () => {
    const { api, clock } = load();
    const has = () => api.menuList().some(r => r[0] === 'MEMORY');
    pet(api, clock, {});                       ok(!has(), '育成中は出ない');
    pet(api, clock, { gone:true });            ok(has(),  '帰還後は出る');
    pet(api, clock, { dead:'starve' });        ok(has(),  'おばけでも出る');
  });
  it('おもいでがメニューのいちばん上に来る', () => {
    const { api, clock } = load();
    pet(api, clock, { gone:true });
    eq(api.menuList()[0][0], 'MEMORY');
  });
  it('通算カウンタは世話をするたび増える', () => {
    const { api, clock, sandbox } = load();
    // わがままの抽選は下限5%残るので、固定しないと20回に1回ほど落ちる
    sandbox.Math.random = () => 0.999;
    clock.setTime(14, 0);
    pet(api, clock, { hunger:2, W:2, poopSince: clock.now(), health:'SICK', D:100, Dm:100 });
    const before = JSON.parse(JSON.stringify(api.pet.total));
    api.doCare('FEED');  api.doCare('CLEAN');  api.doCare('MED');
    ok(api.pet.total.feed  > before.feed,  'ごはん:');
    ok(api.pet.total.clean > before.clean, 'そうじ:');
    ok(api.pet.total.med   > before.med,   'くすり:');
  });
  it('通算カウンタは日をまたいでも減らない（mealCountとは別）', () => {
    const { api, clock } = load();
    pet(api, clock, { total:{feed:50, snack:10, clean:20, med:3}, mealCount:9 });
    api.closeOneDay({}, 2, false);
    eq(api.pet.total.feed, 50, '通算はそのまま:');
    ok(api.pet.mealCount < 9, '日次のほうは減衰する:');
  });
  it('古いセーブでも通算カウンタが用意される', () => {
    const { api } = load({ storage: { myvader_pet: JSON.stringify({
      name:'OLD', stage:'final', lineage:'inv', form:'i1', B:50, C:50, D:50, EP:11 }) } });
    eq(api.pet.total, { feed:0, snack:0, clean:0, med:0 });
    eq(api.pet.v, api.SAVE_V);
  });
});

// ══ ファイル全体の健全性 ══════════════════════════════════
//  ミニゲームは本体と別のHTMLで、この足場では動かせない。
//  代わりに「構文が通るか」と「壊しやすい約束事」をソースの上で確かめる
describe('ファイル', () => {
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const dir = path.join(__dirname, '..');
  const files = ['invader_game.html','spacewalk_game.html','shootingstar_game.html',
                 'abduction_game.html','manual.html'];
  const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
  const scripts = f => {
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g, out = [];
    let m; while((m = re.exec(read(f)))) out.push(m[1]);
    return out;
  };
  it('すべてのHTMLの中のJavaScriptが構文エラーを起こさない', () => {
    for(const f of files)
      scripts(f).forEach((code, i) => {
        try { new vm.Script(code); }
        catch(e){ throw new Error(`${f} の script#${i+1}: ${e.message}`); }
      });
  });
  it('検証用の一時コードが残っていない', () => {
    //  window.__placeLed は本番のコード（同じファイル内の2つのscriptでLEDの位置を共有する）
    const ALLOWED = ['__placeLed'];
    for(const f of files){
      const src = read(f);
      ok(!src.includes('globalThis.__'), `${f} に globalThis.__ が残っている`);
      ok(!/\bdebugger\b/.test(src), `${f} に debugger が残っている`);
      for(const m of src.matchAll(/window\.(__\w+)/g))
        ok(ALLOWED.includes(m[1]), `${f} に検証用の window.${m[1]} が残っている`);
    }
  });
  // 「画面のみかた」の絵は、実機の画面から取り込んだもの。
  //  ヘッダーを作り変えたのに絵だけ古いまま、を防ぐ
  it('説明書の画面の絵が、実機のヘッダーと合っている', () => {
    const { api } = load();
    const src = read('manual.html');
    const m = src.match(/<div class="screen">[\s\S]*?<\/div>/);
    ok(m, '画面の絵が見つからない');
    const svg = m[0];
    // 文字を字体で置くのはやめて、実機の画素をそのまま並べてある
    ok(!/<text[^>]*>(ZUZU|DAY[^<]*)<\/text>/.test(svg), '名前や DAY が 昔の字体のままになっている');
    // 1ドットより細かい矩形がある＝実機（1ドット=4px）から取り込んだ証拠
    ok(/<rect x="[\d.]+" y="[\d.]*\.(25|5|75)"/.test(svg), '実機から取り込んだ細かさになっていない');
    // ヘッダーのマークがある帯（x=25〜34 / y=2〜6ドット）に、何か描かれている。
    //  絵に出しているのは まだ にっきが無い状態＝ステータスと せっていの2つ
    const inBand = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"/g)]
      .filter(([, x, y]) => +x >= 25 && +x <= 34 && +y >= 2 && +y <= 6).length;
    ok(inBand > 20, `マークの帯に ${inBand} 個しか無い。マークが描かれていない`);
    // 日記のマークがある位置（x=21.5〜24.5）には、何も無い
    const diaryBand = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"/g)]
      .filter(([, x, y]) => +x >= 21 && +x < 25 && +y >= 2 && +y <= 6).length;
    eq(diaryBand, 0, 'にっきのマークの位置に 何か描かれている:');
    // 区切り線（ドットのy=8）が1本ある
    ok(/<rect x="0" y="8" width="54"/.test(svg), 'ヘッダーの区切り線が無い');
    // 引き出し線の数と、下の表の行数がそろっている
    const marks = (svg.match(/<circle/g) || []).length;
    const after = src.slice(src.indexOf(m[0]) + m[0].length);
    const rows = (after.slice(0, after.indexOf('</table>')).match(/<tr>/g) || []).length;
    eq(marks, rows, '引き出し線の数と 表の行数:');
    eq(marks, 5, '引き出し線の数:');
  });
  // ツリーの図は iPhone の画面で左右が切れていた。原因は2つ。
  //  ・詰める指定の区切りが 379px で、390〜414px（iPhone 12〜16 のふつうの幅）が
  //    どの段にも入らず、大きいままの箱が枠から あふれていた
  //  ・あふれたとき justify-content:center だと、はみ出したぶんが左右に半分ずつ出る。
  //    左に出たぶんは横に送っても出てこないので、読めないまま切れる
  it('説明書のツリーが、iPhoneの幅で切れない', () => {
    const src = read('manual.html');
    // あふれても左そろえで横に送れる形にしてある
    const root = src.match(/\.tree > ul\{[^}]*\}/);
    ok(root, '.tree > ul の指定が見つからない');
    ok(/width:\s*max-content/.test(root[0]), '.tree > ul に width:max-content が無い（左右が切れる）');
    ok(/min-width:\s*100%/.test(root[0]), '.tree > ul に min-width:100% が無い（収まるとき中央に来ない）');
    // 大きいままの箱に要るはば(459px)＋枠の余白ぶんまで、詰める指定が届いている
    const bps = [...src.matchAll(/@media \(max-width:(\d+)px\)\{\s*\n\s*\.tree/g)].map(m => +m[1]);
    ok(bps.length >= 1, 'ツリーを詰める指定が見つからない');
    ok(Math.max(...bps) >= 460, `ツリーを詰める区切りが ${Math.max(...bps)}px しかない（iPhone の 390〜440px で あふれる）`);
  });
  // 説明書は3つのタイプを名指しし、そこからさらに3つに分かれると書いている。
  //  ゲーム側で名前や分岐の数が変わったのに説明書だけ古いまま、を防ぐ
  it('説明書の3タイプが、ゲームの呼び名と合っている', () => {
    const { api, clock } = load();
    const src = read('manual.html');
    const names = ['grey','tako','inv'].map(L => {
      pet(api, clock, { stage:'adult', lineage:L });
      return api.typeLabel();
    });
    eq(new Set(names).size, 3, '3つとも違う呼び名であるべき:');
    for(const n of names) ok(src.includes(n), `説明書に「${n}」が無い`);
    // さいごの分岐は各タイプ3つ。数字を書き換えたら、ここで気づけるようにしておく
    const forms = new Set();
    for(const L of ['grey','tako','inv']) for(const f of ['1','2','3']){
      pet(api, clock, { stage:'final', lineage:L, form:(L==='grey'?'g':L==='tako'?'t':'i')+f });
      forms.add(api.typeLabel() + '/' + api.formLabel());
    }
    eq(forms.size, 9, 'さいごの すがたは9とおりであるべき:');
    ok(src.includes('9とおり'), '説明書が9とおりと書いていない');
    // 図のほうも数が合っているか。枝を1本消しても本文だけ9のまま、を防ぐ
    const tree = src.slice(src.indexOf('<div class="tree">'), src.indexOf('</div>', src.indexOf('<div class="tree">')));
    eq((tree.match(/class="n q"/g) || []).length, 9, '図の葉（？）の数:');
    for(const n of names)
      eq((tree.match(new RegExp(n, 'g')) || []).length, 1, `図に「${n}」が出る回数:`);
    // 条件そのものは伏せておく。名前が出ていたら、それは書きすぎ
    for(const bad of ['プランプ','スリーク','プリックリー'])
      ok(!src.includes(bad), `説明書が最終形態の名前（${bad}）まで明かしている`);
    // 右端の枝は ::before の角が縦線を兼ねる。::after の border-left を残すと
    //  2本が隣り合って縦線が二重に見える（一度そうなった）
    ok(/\.tree li:last-child::after\s*\{[^}]*border-left:\s*0/.test(src),
       'ツリーの右端で、縦線が二重になる指定が戻っている');
  });
  it('ミニゲーム3本とも、得点は0未満にならない', () => {
    for(const f of ['spacewalk_game.html','shootingstar_game.html','abduction_game.html']){
      const src = read(f);
      ok(!/score\s*-=/.test(src), `${f}: 下限のない減点（score-=）が残っている`);
      ok(!/padStart\(5,/.test(src), `${f}: 5桁の得点表示が残っている`);
    }
  });
  it('ミニゲーム3本とも、HUDの並びが揃っている', () => {
    for(const f of ['spacewalk_game.html','shootingstar_game.html','abduction_game.html']){
      const src = read(f);
      ok(/txt\('SCORE',1,1,8,ON\)/.test(src), `${f}: ヘッダーの SCORE が定位置にない`);
      ok(/txtR\(String\(Math\.max\(0,score\)\)\.padStart\(4,'0'\), W-1, 1, 8, ON\)/.test(src),
         `${f}: 得点が右そろえ4桁になっていない`);
      ok(/,\s*59,\s*7,/.test(src), `${f}: フッターが y=59 / 7px になっていない`);
    }
  });
  // ALL RESET の処理は画面の操作の中にあり、テストから呼べない。
  //  控えを消し忘れると、リセットして育て直した子のセーブが壊れたときに
  //  前の子が掘り起こされる。消しているかをソースで押さえておく
  it('ALL RESET が控えと退避もまとめて消している', () => {
    const src = read('invader_game.html');
    ok(/\[SAVE_KEY,\s*SAVE_BAK,\s*SAVE_BAD\]\.forEach\(k\s*=>\s*localStorage\.removeItem\(k\)\)/.test(src),
       'ALL RESET が3つの鍵をまとめて消していない');
  });
  // ミニゲーム選択画面の描画はテストから呼べないので、
  //  いちばん良かった点数の出しかたをソースで押さえる
  // ページを足したのに数を増やし忘れると、最後のページへ行けなくなる（実際にやりかけた）
  // 薄い色(DIM)は地との差が小さく、文字にすると読めない（実測 1.46:1）。
  //  ミニゲームの説明文と おもいでの見出しで2度やっているので、機械で見張る
  it('薄い色で文字を描いていない', () => {
    const bad = [];
    for(const f of files){
      const lines = read(f).split('\n');
      let cur = null;
      lines.forEach((l, i) => {
        // 代入の右辺に薄色が出てくるか（三項で片側だけ薄い、も拾う）
        for(const m of l.matchAll(/fillStyle\s*=\s*([^;]+);/g)) cur = /\b(DM|DIM)\b/.test(m[1]);
        if(/\btxt[CR]?M?\([^;]*,\s*(DIM|DM)\s*\)/.test(l))      // ミニゲーム側の描画
          bad.push(`${f}:${i+1} ${l.trim().slice(0,70)}`);
        else if(/fillText\(/.test(l) && cur)
          bad.push(`${f}:${i+1} ${l.trim().slice(0,70)}`);
      });
    }
    eq(bad.length, 0, '薄い色の文字:\n      ' + bad.join('\n      '));
  });
  // 1ページ目に置く姿は、段階で背の高さが6〜13ドットと変わる。
  //  上でそろえると、姿ごとに下の名前との間隔が変わってしまう
  it('おもいでの姿は、下辺をそろえて置く', () => {
    const { api, clock } = load();
    const tops = new Set(), bots = new Set();
    for(const o of [{stage:'larva'}, {stage:'adult', lineage:'grey'},
                    {stage:'final', lineage:'grey', form:'g2'},
                    {stage:'final', lineage:'tako', form:'t1'},
                    {stage:'final', lineage:'inv',  form:'i3'}]){
      pet(api, clock, Object.assign({ gone:true, goneBy:'return' }, o));
      const sp = api.charSprites(), body = sp.rest || sp.a;
      ok(body, `${o.stage}/${o.form||''}: 姿が無い`);
      const h = body.length, w = body[0].length;
      tops.add(api.MEM_CHAR_BOT - h); bots.add(api.MEM_CHAR_BOT);
      ok(h >= 4 && h <= 14, `背の高さが想定外（${h}）`);
      ok(w <= 54, `横幅が画面をはみ出す（${w}）`);
      // 見出しの区切り線(y=13)と、名前(y=31)のあいだに収まること
      ok(api.MEM_CHAR_BOT - h > 13, `${o.stage}: 区切り線に掛かる（上端 ${api.MEM_CHAR_BOT - h}）`);
      ok(api.MEM_CHAR_BOT < 31, `名前に掛かる（足元 ${api.MEM_CHAR_BOT}）`);
    }
    eq(bots.size, 1, '足元がそろっていない:');
    ok(tops.size > 1, '背の高さが全部同じなら、この置きかたを試せていない');
  });
  it('おもいでのページ数が、実際に描いているページ数と合っている', () => {
    const src = read('invader_game.html');
    const at = src.indexOf('function tickMemory()');
    ok(at > 0, 'tickMemory が見つからない');
    const seg = src.slice(at, src.indexOf('setInterval(tickMemory', at));
    const branches = (seg.match(/memPage === \d/g) || []).length;   // 明示の分岐＋最後の else
    const m = src.match(/const MEM_PAGES = (\d+);/);
    ok(m, 'MEM_PAGES が見つからない');
    eq(Number(m[1]), branches + 1, 'ページ数:');
  });
  // 日数は数から読ませる（にほんご「25 にち いっしょにいた」／英語「25 DAYS TOGETHER」）。
  //  タイプ・形態はその上に置く（名前のすぐ下が「どんな子だったか」になるように）
  it('おもいで1ページ目の並びが、姿→名前→タイプ→日数→別れ になっている', () => {
    const src = read('invader_game.html');
    const at = src.indexOf('// 1ページ目：だれと、どれだけ');
    const seg = src.slice(at, src.indexOf('} else if(memPage === 1)', at));
    ok(/petDay\(\) \+ ' ' \+ T\('mdays'\)/.test(seg), '日数が数から始まっていない');
    const y = t => { const m = seg.match(new RegExp(t + '[^;]*?(\\d+)\\*S\\);')); return m ? +m[1] : -1; };
    const name = y("fillText\\(pet\\.name"), form = y("typeLabel\\(\\)"), days = y("petDay\\(\\) \\+ ' '");
    const end  = (()=>{ const m = seg.match(/MEM_END_Y \+ i\*MEM_END_LH/); if(!m) return -1;
      const c = src.match(/const MEM_END_Y = (\d+)/); return c ? +c[1] : -1; })();
    ok(name > 0 && form > 0 && days > 0 && end > 0, `位置が読めない（名前${name} タイプ${form} 日数${days} 別れ${end}）`);
    ok(name < form, `名前(${name})より上にタイプ(${form})がある`);
    ok(form < days, `タイプ(${form})より上に日数(${days})がある＝入れ替わっている`);
    ok(days < end,  `日数(${days})より上に別れ(${end})がある`);
  });
  // お迎えと侵攻は2行になる。2行目がページ数に掛からないこと、
  //  1行目の位置が日数より下にあることを、数の上で押さえる
  it('別れかたの2行目が、ページ数に掛からない', () => {
    const { api, clock } = load();
    const src = read('invader_game.html');
    const g = re => { const m = src.match(re); return m ? +m[1] : -1; };
    const y0 = g(/const MEM_END_Y = (\d+)/), lh = g(/MEM_END_Y = \d+, MEM_END_LH = (\d+)/);
    const page = g(/MEM_PAGES, \(W\*S\)\/2, (\d+)\*S\);/);
    ok(y0 > 0 && lh > 0 && page > 0, `位置が読めない（1行目${y0} 行送り${lh} ページ数${page}）`);
    // いちばん行数の多い別れかたで確かめる
    let max = 1;
    for(const o of [{dead:'starve'}, {dead:'sick'}, {gone:true, goneBy:'return'},
                    {gone:true, goneBy:'depart'}, {gone:true, goneBy:'invade'}]){
      pet(api, clock, Object.assign({ stage:'final', lineage:'inv', form:'i3' }, o));
      const n = api.endLabel().split('\n').length;
      ok(n >= 1 && n <= 2, `行数が想定外（${n}行）`);
      max = Math.max(max, n);
    }
    eq(max, 2, '2行になる別れかたがあること:');
    // 最終行の下端（6px≒1.5ドット）が、ページ数の上に収まること
    const last = y0 + (max-1)*lh;
    ok(last + 2 <= page, `2行目(${last})がページ数(${page})に掛かる`);
  });
  // 描画はテストから呼べないので、姿を置く一行をソースで押さえる
  it('おもいでの1ページ目に、姿を足元ぞろえで置いている', () => {
    const src = read('invader_game.html');
    ok(/const MEM_CHAR_BOT = \d+;/.test(src), '足元の高さの決めが無い');
    ok(/stamp\(ctxR, body, Math\.round\(\(W - body\[0\]\.length\)\/2\), MEM_CHAR_BOT - body\.length, NK\);/.test(src),
       '姿を足元ぞろえ・中央ぞろえで置いていない');
    // 1ページ目の分岐の中にあること（他のページに紛れ込んでいない）
    const at = src.indexOf('// 1ページ目：だれと、どれだけ');
    ok(at > 0 && src.indexOf('stamp(ctxR, body', at) < src.indexOf('} else if(memPage === 1)', at),
       '姿を置く処理が1ページ目の中にない');
  });
  //  ベストだけでは「どれをよく遊んだか」が残らないので、回数も並べる。
  //  未プレイの扱いはベストと同じ（0点と区別して --- を出す）
  it('おもいでに あそんだ回数が3本ぶん出る', () => {
    const { api, clock } = load();
    pet(api, clock, { best:{sw:1200, ss:860, ab:445}, plays:{sw:12, ss:5, ab:128} });
    eq([0,1,2].map(i => api.playText(i)), ['12','5','128'], '回数:');
    eq([0,1,2].map(i => api.bestText(i)), ['1200','860','445'], 'ベスト:');
    pet(api, clock, { best:{sw:0, ss:0, ab:0}, plays:{sw:0, ss:0, ab:0} });
    eq([0,1,2].map(i => api.playText(i)), ['---','---','---'], '未プレイの回数:');
    eq([0,1,2].map(i => api.bestText(i)), ['---','---','---'], '未プレイのベスト:');
    //  遊んだうえで0点だった場合は 0 と出す（未プレイと区別する）
    pet(api, clock, { best:{sw:0, ss:0, ab:0}, plays:{sw:3, ss:0, ab:0} });
    eq(api.bestText(0), '0', '遊んで0点のベスト:');
    eq(api.playText(0), '3', '遊んで0点の回数:');
  });
  it('おもいでの2列は、桁が最大でも重ならない', () => {
    const src = read('invader_game.html');
    const m = /const MEM_BEST_R = (\d+), MEM_PLAY_R = (\d+);/.exec(src);
    ok(m, '列の位置が定数になっていない');
    const bestR = +m[1], playR = +m[2];
    //  ピクセル字体は1文字6px＝1.5ドット。ベスト4桁・回数3桁が最大
    const bestW = 4 * 1.5, playW = 3 * 1.5, headW = 5 * 1.5;   // PLAYS が見出しの最長
    ok(bestR < playR - playW, `ベスト(右端${bestR})と回数(左端${playR-playW})が重なる`);
    ok(bestR < playR - headW, `ベスト(右端${bestR})と見出しPLAYS(左端${playR-headW})が重なる`);
    //  いちばん長いゲーム名の右端（3 + 13文字×1.5 = 22.5）と、ベストの左端
    ok(22.5 < bestR - bestW, `ゲーム名(右端22.5)とベスト(左端${bestR-bestW})が重なる`);
    ok(playR <= 51, `回数が右の余白(51)を越える: ${playR}`);
  });
  it('いちばん良かった点数が、選択画面と おもいで の両方に出る', () => {
    const src = read('invader_game.html');
    // 表示の決めかたは1か所。2画面で食い違わないようにしておく
    ok(/function bestText\(i\)\{/.test(src), '点数の出しかたが共通になっていない');
    ok(/PLAY_KEYS\[i\]/.test(src) && /'---'/.test(src), '未プレイと 0点 を区別していない');
    ok(/p\[k\] > 0/.test(src), '遊んだ回数を見ていない（0点と区別できない）');
    // 選択画面：カーソルを合わせているゲームのぶん
    const at = src.indexOf('// ── PLAY サブ画面（ミニゲーム選択）──');
    ok(at > 0, 'ミニゲーム選択画面が見つからない');
    const seg = src.slice(at, src.indexOf('} else {', at));
    ok(/ctxN\.fillText\('BEST ' \+ bestText\(playSel\)/.test(seg),
       '選択画面がカーソルの位置と結びついていない');
    // おもいで：3本ぶんを並べる
    ok(/PLAY_ITEMS\.forEach\(\(label,i\)=> memGameRow\(label, bestText\(i\), playText\(i\), \d+ \+ i\*8\)\);/.test(src),
       'おもいでに3本ぶんが並んでいない');
  });
  // tickMain は表示中の画面に関係なく回るので、そのままだと メニューや日記、
  //  ミニゲームを開いている裏でエンディングが始まって終わり、見ないうちに
  //  おもいでだけが開いてしまう（亡くなった子はオープニングを経由するので、
  //  タイトルを見ているあいだに魂が抜けきっていた）
  it('育成画面を見ていないあいだは、演出が進まない', () => {
    const src = read('invader_game.html');
    const at = src.indexOf('function tickMain()');
    ok(at > 0, 'tickMain が見つからない');
    const head = src.slice(at, src.indexOf('const col = getColors();', at));
    ok(/if\(scene !== 'main' \|\| miniFrame \|\| manualFrame\) return;/.test(head),
       '育成画面かどうかの門番が無い');
    // 時間の進行より後ろ＝待たせても遅れが出ないこと
    ok(head.indexOf('advancePet()') < head.indexOf("scene !== 'main'"),
       '門番が時間の進行より手前にある（開いている画面しだいで時間が止まる）');
    // 門番は、演出を始める判定より手前にあること
    const body = src.slice(at, src.indexOf('\n  }', at));
    ok(body.indexOf("scene !== 'main'") < body.indexOf('departEnding = true'),
       '門番が、演出を始める判定より後ろにある');
  });
  // 時刻で色を変えてよいのは、空を映す画面だけ。読みものの画面が夜に沈むと、
  //  固定色で描いている行（memRow など）とのつり合いも崩れる
  it('時刻で色が変わるのは、空を映す画面だけ', () => {
    const src = read('invader_game.html');
    const users = [];
    for(const m of src.matchAll(/getColors\(\)/g)){
      // その呼び出しが、どの関数の中にあるかを手前から探す
      const head = src.lastIndexOf('function ', m.index);
      const name = src.slice(head).match(/function (\w+)/)[1];
      if(!users.includes(name)) users.push(name);
    }
    users.sort();
    eq(users.join(' '), 'getColors startArrival tickMain',
       '時刻で色を変えている場所:');   // 育成画面と到着演出だけ
    // おもいでは、メニュー・にっきと同じ固定色
    const at = src.indexOf('function tickMemory()');
    const body = src.slice(at, src.indexOf('setInterval(tickMemory', at));
    ok(/const BG = OFF, DM = DIM, NK = ON;/.test(body), 'おもいでが固定色になっていない');
    ok(!body.includes('getColors'), 'おもいでが時刻で色を変えている');
  });
  // 家出の「・・・」は、退屈のときと同じ位置に出す。置き方が2か所にあると
  //  片方だけ直して食い違うので、1つの関数にまとめてある
  it('気もちのマークの置き場所が、育成画面と家出で共通になっている', () => {
    const src = read('invader_game.html');
    ok(/function stampEmo\(ctx, spr, charX, charTop, gw, col\)\{/.test(src),
       'マークの置き場所をまとめた関数が無い');
    // 育成画面の emo() は、その関数に委ねているだけ
    ok(/function emo\(spr\)\{ stampEmo\(ctxM, spr, charX, charY \+ yOff - airOff, gw, NK\); \}/.test(src),
       '育成画面が独自に位置を決めている');
    // 家出も同じ関数を通す
    ok(/stampEmo\(ctxM, ICO_DOTS, x0, y, cw, NK\);/.test(src),
       '家出が独自に位置を決めている');
    // キャラの左に置く決まりが1か所だけであること
    const lines = src.split('\n').filter(l => l.includes('charX - EMO_GAP - w'));
    eq(lines.length, 1, 'マークの位置を決めている行:');   // 三項の中に2回出るので、行で数える
  });
  // 演出中に押せてしまうと、別れの場面でメニューが開いたりする。
  //  音や凹みだけ返るのも「効いているのに何も起きない」ように見えるので、
  //  playClick より手前で止める
  it('演出のあいだ、育成画面のボタンがすべて無効になっている', () => {
    const src = read('invader_game.html');
    const g = src.match(/function cutscenePlaying\(\)\{[\s\S]*?\n  \}/);
    ok(g, '演出中かどうかの判定が無い');
    for(const st of ['ufoEnding', 'departEnding', 'invadeEnding', 'pet.dead', 'arriveT'])
      ok(g[0].includes(st), `判定に ${st} が入っていない`);
    ok(/!pet\.memShown/.test(g[0]), 'おばけは、おもいでを見たあとも操作できないままになる');
    // 4つのボタンすべてが、音を鳴らす前に止めていること
    const heads = [
      /getElementById\('mmenu'\),\(\)=>\{ if\(cutscenePlaying\(\)\) return; playClick/,
      /getElementById\('mb'\),\(\)=>\{ if\(cutscenePlaying\(\)\) return; playClick/,
      /getElementById\('ma'\),\(\)=>\{\s*\n\s*if\(cutscenePlaying\(\)\) return;\s*\n\s*playClick/,
      /#view-main \.dpad-arrow[\s\S]*?onPress\(el,\(\)=>\{\s*\n\s*if\(cutscenePlaying\(\)\) return;\s*\n\s*playClick/,
    ];
    const names = ['MENU', 'B', 'A', '十字'];
    heads.forEach((re, i) => ok(re.test(src), `${names[i]} が演出中でも反応する`));
  });
  // ボタンの字は、字面が送りの左寄り・行の上寄りに乗る（Press Start 2P）。
  //  flex の中央ぞろえが合わせるのは「送り幅」と「行の箱」なので、そのままだと
  //  字そのものが左上へずれる。ブラウザが要る計測はテストから出来ないので、
  //  実測して入れた補正が4ファイルすべてに残っているかを押さえる
  it('A・B・MENU の字が、ボタンの中心に寄せてある', () => {
    for(const f of ['invader_game.html','spacewalk_game.html','shootingstar_game.html','abduction_game.html']){
      const src = read(f).replace(/\s+/g, '');
      ok(src.includes('transform:translate(0.061em,0.0625em)'),
         `${f}: A・B の字の位置合わせが無い`);
      ok(src.includes('transform:translate(0.103em,0.0625em)'),
         `${f}: MENU の字の位置合わせが無い（字間ぶんを含む 0.103em）`);
    }
  });
  // ミニゲームの iframe は画面全体を覆い、閉じる手立ては中からの postMessage しかない。
  //  中で立ち上がりに失敗すると、閉じられず 進行も止まったまま（inMiniGame）になる。
  //  ブラウザが要るのでテストからは動かせないため、逃げ道の有無をソースで押さえる
  it('ミニゲームが立ち上がらなかったときの逃げ道がある', () => {
    const src = read('invader_game.html');
    ok(/const MINI_GUARD_MS = \d+;/.test(src), '見張りの待ち時間が無い');
    ok(/miniGuard = setTimeout\(\(\)=>\{ if\(miniFrame === f && !miniAlive\(f\)\) closeMiniGame\(true\); \}/.test(src),
       'ミニゲームを開くときに見張りを仕掛けていない');
    ok(/if\(miniGuard\)\{ clearTimeout\(miniGuard\); miniGuard = 0; \}/.test(src),
       '閉じるときに見張りを解除していない（別のゲームを巻き添えにする）');
    // 生死は「画面が塗られたか」で見る。canvas の有無だけだと、
    //  中のスクリプトが落ちた場合（HTMLは出るが何も描かれない）を取り逃す
    ok(/getImageData\(0, 0, 2, 2\)/.test(src), '塗られたかを見ていない');
    ok(/catch\(e\)\{ return true; \}/.test(src), '中を覗けないときに勝手に閉じない扱いが無い');
  });
  // 到着の描画もテストから呼べない。粒の色分けはビームの位置を見て決めるので、
  //  ビームより先に雨を描くと、光の中の粒が上書きされて消えてしまう
  it('到着演出で、雨がビームより後に描かれている', () => {
    const src = read('invader_game.html');
    const body = src.slice(src.indexOf('function drawArrival(BG, DM, NK)'));
    for(const head of ['} else if(ph===1){', '} else if(ph===2){']){
      const at = body.indexOf(head);
      ok(at > 0, `${head} の分岐が無い`);
      const seg = body.slice(at, body.indexOf('} else if(ph===', at + 5));
      const beam = seg.indexOf('drawArrivalBeam');
      const rain = seg.indexOf('updateArrivalRain');
      ok(beam >= 0 && rain >= 0, `${head}: ビームか雨の描画が無い`);
      ok(beam < rain, `${head}: 雨をビームより先に描いている（光の中の粒が消える）`);
    }
    // 粒はビームの中と外で色を入れ替える。暗い画面に暗い粒だと沈んで見えない
    ok(/\(half >= 0 && Math\.abs\(d\.x-ARR_CX\) <= half\) \? DM : BG/.test(src),
       '雨の色分け（外は明るく、光の中は暗く）が無い');
  });
  // オープニングの描画はテストから読めないので、字の大きさをソースで押さえる。
  //  小さすぎて「押していい」ことが伝わらなかった
  it('タイトルの選択肢が、読める大きさで描かれている', () => {
    const src = read('invader_game.html');
    const m = src.match(/ctxO\.font = o\.jp \? \('(\d+)px ' \+ JP_FONT\) : '(\d+)px "Press Start 2P"';/);
    ok(m, '選択肢の字の指定が見つからない');
    ok(Number(m[1]) >= 10, `かなの選択肢が小さい（${m[1]}px）`);
    ok(Number(m[2]) >= 8, `英語の選択肢が小さい（${m[2]}px）`);
  });
  // 十字キーの処理は画面の操作の中にあり、テストから呼べない。
  //  アイコンから下へ降りた着地点が「左の列の先頭」であることをソースで押さえる
  //  （6番決め打ちだと、おもいでが出ているとき右の列のいちばん上に着く）
  it('メニューでアイコンから降りる先が、左の列の先頭になっている', () => {
    const src = read('invader_game.html');
    ok(/const topLeft\s*=\s*6\s*\+\s*left\[0\];/.test(src), 'topLeft の定義が無い');
    ok(/if\(dir==='down'\)\s+menuSel = \(r===0\) \? menuSel\+3 : topLeft;/.test(src),
       'アイコンから下へ降りる先が topLeft になっていない');
  });
  // 描画関数はテストから呼べないので、4つの別れが全部おもいでへ繋がっているかを
  //  ソースで確かめる。死だけ演出が無く、ここが抜けていた
  it('どの別れ方でも、おもいでを開く処理に繋がっている', () => {
    const src = read('invader_game.html');
    const n = (src.match(/endedShowMemory\(\)/g) || []).length;
    ok(n >= 5, `endedShowMemory の呼び出しが ${n} か所（定義1＋帰還・旅立ち・侵攻・死 の4か所が要る）`);
    ok(/if\(\+\+ghostT === GHOST_MEM_DELAY\) endedShowMemory\(\);/.test(src),
       'おばけの画面からおもいでへ繋がっていない');
    // 昇る動きは「いなくなった直後」だけ。おもいでを見たあとの画面は
    //  ALL RESET まで続くので、ここで昇り続けると おばけが画面から消えたままになる
    ok(/if\(pet\.memShown\)\{\s*\n[^\n]*ALL RESET まで続くので/.test(src),
       'おばけの描き分け（見たあとは漂う姿で止める）が無い');
    ok(/stampDust\(body, bx, by, DM, 1 - dp, dp \* GHOST_DUST_X\);/.test(src),
       '体が風で流されて消える処理が無い');
    // 体の上端から出すと、背の低い段階では魂の足元が地面より下になる
    ok(/const from  = MAIN_GY - GHOST_SPR\.length;/.test(src),
       '魂の出発点が「足元を地面に置いた高さ」になっていない');
    // 左へ流すだけだと横一列のまま動くので、上下にもばらけさせる
    ok(/oy \+ ry \+ Math\.round\(drift \* [\d.]+ \* dustLift\(rx, ry\)\)\)/.test(src),
       '粒が上下にばらける処理が無い');
    ok(/Math\.min\(MAIN_GY - 1,/.test(src), 'チリが地面より下へ出ないようにしていない');
    // 魂が離れるまでは体をそのまま保つ
    ok(/const dp = \(p <= s0\) \? 0 : \(p - s0\) \/ \(1 - s0\);/.test(src),
       '散りはじめを遅らせる処理が無い');
  });
  // iOSの割り込みからの立ち直りは、本体だけでなく3本のミニゲームにも要る
  it('ミニゲームも、音の割り込みから立ち直るようにしてある', () => {
    for(const f of ['spacewalk_game.html','shootingstar_game.html','abduction_game.html']){
      const src = read(f);
      ok(/ensureAudio\(\)/.test(src), `${f}: 割り込みからの立ち直りが無い`);
      ok(/interrupted/.test(src), `${f}: interrupted に触れていない`);
      ok(!/if\(!ac\) ac=new \(window\.AudioContext/.test(src), `${f}: 口をその場で作る古い書き方が残っている`);
      ok(/pagehide/.test(src), `${f}: 閉じるときに口を閉じていない`);
    }
  });
  // 画面に出す版と、キャッシュを切り替える版がずれると、
  //  テスターの画面に出ている版と 中身が食い違う
  it('画面に出す版と sw.js の版がそろっている', () => {
    const { api } = load();
    const m = read('sw.js').match(/const VERSION = '([^']+)'/);
    ok(m, 'sw.js に VERSION が無い');
    eq(api.APP_VERSION, m[1], '画面の版 と sw.js の版:');
  });
  it('版を上げる道具が、両方いっしょに書き換える', () => {
    const sh = read('tools/bump-sw.sh');
    ok(/APP_VERSION/.test(sh), 'bump-sw.sh が invader_game.html の APP_VERSION を書き換えていない');
  });
  // メニュー下段の2列のあいだの仕切り。網掛けは左が25まで・右が27からなので、
  //  26 に引く。ここを外すと 項目の字や網掛けに重なる
  it('メニューの列の仕切りが、網掛けの外側にあって画面に収まる', () => {
    const src = read('invader_game.html');
    const col = src.match(/const COL = \[ \{ x0:(\d+), x1:(\d+),[\s\S]*?\{ x0:(\d+), x1:([^,]+),/);
    ok(col, '列の範囲（COL）が見つからない');
    const leftEnd = +col[2] - 1, rightStart = +col[3];      // 網掛けは x1 の手前まで
    const line = src.match(/ctxN\.fillRect\((\d+)\*S \+ S\/(\d+), Y0\*S, S\/(\d+), rows\*HL_H\*S\);/);
    ok(line, '列の仕切りが引かれていない');
    const x = +line[1], S = 4;
    ok(x > leftEnd, `仕切り(x=${x})が左の網掛け(〜${leftEnd})に重なっている`);
    ok(x < rightStart, `仕切り(x=${x})が右の網掛け(${rightStart}〜)に重なっている`);
    // 太さは半ドット。1ドットだと項目の字と同じ太さで、区切りに見えない
    const thick = S / +line[3];
    eq(thick, S/2, '仕切りの太さ(px):');
    // 空いているドットの まんなかに置く（左右どちらの列にも寄らない）。
    //  整数pxなので、拡大されても にじまない
    const left = x*S + S / +line[2];
    eq(left, x*S + (S - thick)/2, `仕切りの左端(${left}px)がドットの中央でない:`);
    eq(left % 1, 0, `仕切りの左端(${left}px)が整数pxでない（にじむ）:`);
    ok(left >= x*S && left + thick <= (x+1)*S, '仕切りが となりのドットへ はみ出している');
    // 行数が増えても、いちばん下が画面(y=64)からはみ出さない
    const hl = src.match(/const HL_H = \(rows >= 4\) \? (\d+) : (\d+);/);
    const y0 = src.match(/const Y0   = \(rows >= 4\) \? (\d+) : \(rows === 3 \? (\d+) : (\d+)\);/);
    ok(hl && y0, '行間と開始位置が見つからない');
    for(const rows of [2,3,4]){
      const h = rows >= 4 ? +hl[1] : +hl[2];
      const top = rows >= 4 ? +y0[1] : (rows === 3 ? +y0[2] : +y0[3]);
      const bottom = top + rows*h - 1;
      ok(bottom <= 64, `${rows}行のとき、仕切りの下端が画面から出る（${bottom} / 画面は64まで）`);
    }
  });
  // ホーム画面に追加したときの名前。iOSは マニフェストがあると short_name を
  //  使うので、そこが略名だと「My Invader」のような別の名前で並んでしまう。
  //  どの入口（QRの行き先＝index.html／説明書／ゲーム本体）から追加しても
  //  同じ名前になるよう、名前を書いている場所を全部そろえる
  it('ホーム画面の名前が、どこから追加しても同じ', () => {
    const APP = 'My Little Invader';
    const mf = JSON.parse(read('manifest.json'));
    eq(mf.name, APP, 'マニフェストの name:');
    eq(mf.short_name, APP, 'マニフェストの short_name:');
    for(const f of ['index.html', 'manual.html', 'invader_game.html']){
      const src = read(f);
      ok(/<link rel="manifest"/.test(src), `${f}: マニフェストを読んでいない`);
      const m = src.match(/<meta name="apple-mobile-web-app-title" content="([^"]*)"/);
      ok(m, `${f}: apple-mobile-web-app-title が無い（iOSで別の名前になる）`);
      eq(m[1], APP, `${f} の apple-mobile-web-app-title:`);
    }
  });
  //  ▶（U+25B6）は Press Start 2P（Latinのみ）に無く、文字で置くと
  //  そこだけ別の字体に落ちて形が浮く。画素で三角を描いて使う
  it('選択中の印が、どの画面でも同じ ▶ で描かれている', () => {
    const src = read('invader_game.html');
    ok(/function selMark\(ctx, x, cy, col, len, dir\)\{/.test(src), '▶ を描く selMark が無い');
    // '<' '>' を字で置いているところが 1つも残っていないこと
    const gt = [...src.matchAll(/fillText\('[<>]'[^)]*\)/g)].map(m => m[0]);
    eq(gt.length, 0, `＜＞ を字で置いているところが残っている: ${gt.join(' / ')}`);
    // 一覧のほうは selMark を使っている
    const marks = (src.match(/if\(isSel\) selMark\(/g) || []).length;
    ok(marks >= 5, `一覧の ▶ が ${marks} か所しか無い（メニュー・設定・天気・ごはん・ゲームの5つ）`);
  });
  //  描いた画素を拾って、ちゃんと右向きの三角になっているかを見る
  it('▶ が 右向きの三角になっている', () => {
    const { api } = load();
    const cells = [];
    const rec = { set fillStyle(v){}, fillRect(x, y, w, h){ cells.push([x, y, w, h]); } };
    const L = 7;
    api.selMark(rec, 0, 10, '#000', L);          // 行の中心 y=10
    eq(cells.length, Math.ceil(L/2), '段の数（頂点までの段数）:');
    // 左の列ほど縦に長く、右へ行くほど短い＝右向きの三角
    const byX = cells.slice().sort((a, b) => a[0] - b[0]);
    for(let i = 1; i < byX.length; i++)
      ok(byX[i][3] < byX[i-1][3], `${i}列目が ${byX[i][3]} で 前の列(${byX[i-1][3]})より短くない。三角に見えない`);
    eq(byX[0][3], L, 'いちばん左の縦の長さ（文字と同じ高さ）:');
    eq(byX[byX.length-1][3], 1, 'いちばん右（頂点）の縦の長さ:');
    // 左向きも作れる（日記・おもいでの「前のページがある」印）
    const lc = [];
    const rec2 = { set fillStyle(v){}, fillRect(x, y, w, h){ lc.push([x, y, w, h]); } };
    api.selMark(rec2, 0, 10, '#000', L, 'left');
    const lx = lc.slice().sort((a, b) => a[0] - b[0]);
    eq(lx[0][3], 1, '左向きの いちばん左（頂点）の縦の長さ:');
    eq(lx[lx.length-1][3], L, '左向きの いちばん右（底）の縦の長さ:');
    // 上下の中心が、渡した中心にそろっている。
    //  高さが奇数(7)なので、画素の格子に乗せるぶん 半画素までは ずれる
    const top = Math.min(...cells.map(c => c[1])), bot = Math.max(...cells.map(c => c[1] + c[3]));
    const mid = (top + bot) / 2;
    ok(Math.abs(mid - 10) <= 0.5, `三角の上下の中心が ${mid} で、行の中心(10)から ずれている`);
  });
  //  命名画面の見出し。日本語は 9px のゴシック体で描くので、
  //  長くすると 画面(54ドット=216px)から はみ出す
  it('命名画面の見出しが、画面のはばに収まる', () => {
    const { api } = load();
    for(const [lg, px] of [['ja', 9], ['en', 6]]){
      api.lang = lg;
      const t = api.T('nameq');
      ok(t, `${lg}: 見出しが空`);
      // 全角は文字の大きさぶん、半角はその半分
      let w = 0;
      for(const ch of t) w += px * (ch.charCodeAt(0) < 0x100 ? 0.5 : 1);
      ok(w <= 54*4 - 8, `${lg}: 「${t}」が ${w}px で 画面からはみ出す`);
    }
    api.lang = 'ja';
    ok(/^この/.test(api.T('nameq')), '日本語の見出しが「このこの…」で始まっていない');
    //  英語でも この子のことを聞いていると分かる言い方に。
    //  ほかの英文と同じく、この子は they／their で呼ぶ
    api.lang = 'en';
    ok(/THEIR/.test(api.T('nameq')), `英語の見出しが この子を指していない（${api.T('nameq')}）`);
    api.lang = 'ja';
  });
  //  来たばかりの子を 満たされた状態で置かない。
  //  さっそく世話をする余地があるようにしておく
  it('到着直後の おなかと きげん', () => {
    const { api } = load();
    const p = api.defaultPet();
    const lit = v => Math.round(v * 2);            // 目盛りは10本（1目盛り＝0.5）
    eq(lit(p.hunger), 5, 'おなかの目盛り（満タン10の半分）:');
    eq(lit(p.mood), 4, 'きげんの目盛り（満タン10から4目盛りぶん下）:');
    ok(p.hunger > 1, 'はじめから ひもじい扱いになっている');
    ok(p.mood > 1, 'はじめから きげんが底になっている');
  });
  //  おなかが 0.5刻みになったので、1ずつ引くと 0 を通りこして負になりうる。
  //  負になると「ちょうど0」で見ている はらぺこ判定が しなくなる
  it('おなかが 0より下に行かない', () => {
    const { api, clock } = load();
    const t0 = clock.now();
    Object.assign(api.pet, api.defaultPet(), { name:'A', stage:'larva', birth:t0, lastTick:t0, EP:2, B:40 });
    const hm = api.hungerMin();
    const seen = [];
    for(let i=0;i<12;i++){ clock.advance(hm*60000); api.advancePet(); seen.push(api.pet.hunger); }
    ok(!seen.some(v => v < 0), `おなかが負になった: ${seen.join(',')}`);
    ok(seen.includes(0), `ちょうど0を通らない（はらぺこ判定が効かない）: ${seen.join(',')}`);
  });
  //  ミニゲームで遊んだぶんの減りも、同じく 0で止まること
  it('ミニゲームで遊んでも、おなかが 0より下に行かない', () => {
    const { api, clock, store } = load();
    const t0 = clock.now();
    Object.assign(api.pet, api.defaultPet(), { name:'A', stage:'larva', birth:t0, lastTick:t0, EP:2, B:40, hunger:0.5 });
    // ひと息に たくさん減るぶんを積んでおく（立て続けに遊んだ状態）
    api.pet.hungerAcc = api.hungerMin() * 3;
    store.set('myvader_result', JSON.stringify({ game:'spacewalk', score:100, at: t0 }));
    api.processGameResult();
    ok(api.pet.hunger >= 0, `おなかが ${api.pet.hunger} になった（負）`);
    eq(api.pet.hunger, 0, '遊びきったあとの おなか:');
  });
  //  ページ送りの印も、選択中の ▶ と同じ三角にそろえてある。
  //  字で置いていたころは 言語で字の大きさが変わり、高さがずれていた
  it('前後のページの印が、どちらの言語でも同じ位置に出る', () => {
    const src = read('invader_game.html');
    ok(/function pageMark\(ctx, dir, cx, cy, col\)\{/.test(src), 'ページ送りの印を描く pageMark が無い');
    for(const [name, key] of [['にっき', 'diaryPage'], ['おもいで', 'memPage']]){
      const left  = new RegExp(`if\\(${key} > 0\\)\\s*pageMark\\(ctx., 'left',`);
      const right = new RegExp(`pageMark\\(ctx., 'right',`);
      ok(left.test(src),  `${name}: 前のページの ◀ が無い`);
      ok(right.test(src), `${name}: 次のページの ▶ が無い`);
    }
    // 位置は 言語に関係ない数だけで決まっている（フォントの大きさを見ていない）
    ok(!/pageMark\([^)]*uiFont/.test(src), 'ページ送りの印の位置が 字の大きさに引きずられている');
  });
  // 説明書は 日本語と英語を1枚に持ち、根の data-lang で出し分ける。
  //  はじめて遊ぶ人は 言語をえらぶ前に説明書を開けるので、こちらにも切り替えを置く
  it('説明書が 日本語と英語の両方を持っている', () => {
    const src = read('manual.html');
    const ja = (src.match(/<span class="lang-ja">/g) || []).length;
    const en = (src.match(/<span class="lang-en">/g) || []).length;
    ok(ja > 200, `日本語の入れものが ${ja} しかない`);
    eq(en, ja, '日本語と英語の入れものの数:');
    // 出し分けの指定と、切り替えのボタン
    ok(/html:not\(\[data-lang="en"\]\) \.lang-en\{ display:none \}/.test(src), '英語を隠す指定が無い');
    ok(/html\[data-lang="en"\] \.lang-ja\{ display:none \}/.test(src), '日本語を隠す指定が無い');
    ok(/id="lang-ja"/.test(src) && /id="lang-en"/.test(src), 'ことばの切り替えボタンが無い');
    //  もともと使っている .en（英語の併記ラベル）とは 別の名前になっていること
    ok(!/\.en\{ display:none \}/.test(src), '既存の .en（併記ラベル）を隠してしまっている');
  });
  it('説明書は ゲームと同じ設定を読み書きする', () => {
    const src = read('manual.html');
    ok(/localStorage\.getItem\(KEY\)/.test(src) && /localStorage\.setItem\(KEY, v\)/.test(src),
       '説明書が 言語設定を読み書きしていない');
    ok(/var KEY = 'myvader_lang';/.test(src), 'ゲームと同じキーを見ていない');
  });
  //  説明書でえらんだことばを、閉じたときに ゲーム側へ引き継ぐ
  it('説明書を閉じると、ゲームの言語が追従する', () => {
    const src = read('invader_game.html');
    const m = src.match(/function closeManual\(\)\{[\s\S]*?\n  \}/);
    ok(m, 'closeManual が見つからない');
    ok(/myvader_lang/.test(m[0]) && /setLang\(v\)/.test(m[0]),
       '説明書でえらんだことばを ゲームに引き継いでいない');
  });
  //  更新のおしらせは ゲームと説明書で共通。設定した言語で出す
  it('更新のおしらせも、設定した言語で出る', () => {
    const src = read('register-sw.js');
    ok(/myvader_lang/.test(src), 'おしらせが 言語設定を見ていない');
    ok(/A new version is available/.test(src) && /あたらしい バージョンが あります/.test(src),
       'おしらせに 両方の言語が無い');
  });
  //  瀕死（衰弱）は あと半日で死ぬ状態。眠っていても ふつうの寝姿・Zzz に
  //  戻ってしまうと「ただ寝ているだけ」に見えて、手を打つ機会を逃す
  it('瀕死のときは、眠っていても 衰弱の見せかたが優先される', () => {
    const src = read('invader_game.html');
    //  分岐の並び順そのものを見る。あとに置いてあると、
    //  眠っているあいだは 手前の asleep で拾われてしまう
    const order = (block, label) => {
      const w = block.indexOf('isWeak()'), a = block.indexOf('asleep');
      ok(w >= 0 && a >= 0, `${label}: 分岐が見つからない`);
      ok(w < a, `${label}: isWeak が asleep より後ろにある（眠っていると衰弱の見せかたにならない）`);
    };
    // 姿の分岐（drawMainBackdrop のあとの、姿を決めるところ）
    const sprite = src.slice(src.indexOf('let charCol = NK;'), src.indexOf("} else if (isBadWeather())"));
    order(sprite, '姿');
    ok(/charCol = DM;/.test(sprite), '瀕死の姿が 薄い色になっていない');
    ok(/grid = sp\.rest; yOff = 0; charCol = DM;/.test(sprite), 'うずくまって動かない姿になっていない');
    // マークの分岐
    //  マークを出すところ（showReact から 疎遠期の枝まで）を切り出す
    const emoFrom = src.indexOf('if (showReact) {');
    const emo = src.slice(emoFrom, src.indexOf('isEstranged()', emoFrom));
    order(emo, 'マーク');
    //  くうふくは ！、びょうきは 汗。どちらで死にかけているかが分かるように
    ok(/emo\(isWeakStarve\(\) \? ICO_EXCL : ICO_SKULL\)/.test(emo),
       '瀕死のマークが くうふく／びょうき で分かれていない');
  });
  it('サービスワーカーのVERSIONが日付の形をしている', () => {
    const m = read('sw.js').match(/const VERSION = '([^']+)'/);
    ok(m, 'VERSION が見つからない');
    ok(/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(m[1]), `VERSION の形が違う: ${m[1]}`);
  });
});

// ══ お世話アイコン ══════════════════════════════════════
describe('お世話アイコン', () => {
  //  アイコンは半ドット(S/2)で描くので、1マス(18×11ドット)には
  //  36×22 まで入る。はみ出すと となりのマスに掛かる
  it('6つとも マスに収まる', () => {
    const { api } = load();
    const MAXW = 18*2, MAXH = 11*2;
    for(const k of api.CARE_ORDER){
      const g = api.CARE_ICONS[k];
      ok(g && g.length, `${k}: アイコンが無い`);
      ok(g.length <= MAXH, `${k}: 縦が ${g.length} で マス(${MAXH})から はみ出す`);
      ok(g[0].length <= MAXW, `${k}: 横が ${g[0].length} で マス(${MAXW})から はみ出す`);
      ok(g.every(r => r.length === g[0].length), `${k}: 行の長さが そろっていない`);
    }
  });
  //  ゲームはパッドの形。左の十字キーと右のボタン4つで「操作するもの」に見えている。
  //  どちらかが潰れると ただの黒い塊になり、何のアイコンか読めなくなる
  describe('ゲーム', () => {
    const game = () => load().api.CARE_ICONS.GAME;
    //  地の色(0)のかたまりを拾う。外周とつながっているものは背景なので除く
    const holes = g => {
      const H=g.length, W=g[0].length, seen=g.map(r=>r.map(()=>false)), out=[];
      const outside = new Set();
      const flood = (sy,sx,bag) => {
        const st=[[sy,sx]];
        while(st.length){
          const [y,x]=st.pop();
          if(y<0||x<0||y>=H||x>=W||seen[y][x]||g[y][x]) continue;
          seen[y][x]=true; bag.push([y,x]);
          st.push([y+1,x],[y-1,x],[y,x+1],[y,x-1]);
        }
      };
      for(let x=0;x<W;x++){ flood(0,x,[]); flood(H-1,x,[]); }
      for(let y=0;y<H;y++){ flood(y,0,[]); flood(y,W-1,[]); }
      for(let y=0;y<H;y++) for(let x=0;x<W;x++){
        if(!g[y][x] && !seen[y][x]){ const bag=[]; flood(y,x,bag); if(bag.length) out.push(bag); }
      }
      return out;
    };
    it('本体の中に、操作する部分が2つある（十字キーとボタン）', () => {
      const hs = holes(game());
      ok(hs.length >= 2, `本体の中の空きが ${hs.length} 個しかない（十字キーとボタンが要る）`);
    });
    it('左が十字キーの形（縦横に伸びた1かたまり）', () => {
      const g = game(), W = g[0].length;
      const left = holes(g).filter(b => b.every(([,x]) => x < W/2));
      ok(left.length === 1, `左の空きが ${left.length} 個（十字キーは1かたまり）`);
      const b = left[0];
      const ys = b.map(([y])=>y), xs = b.map(([,x])=>x);
      ok(Math.max(...ys)-Math.min(...ys) >= 2, '十字キーが縦に伸びていない');
      ok(Math.max(...xs)-Math.min(...xs) >= 2, '十字キーが横に伸びていない');
    });
    it('右がボタンの並び（離れた点が複数）', () => {
      const g = game(), W = g[0].length;
      const right = holes(g).filter(b => b.every(([,x]) => x >= W/2));
      ok(right.length >= 2, `右の空きが ${right.length} 個（ボタンは離れて複数あること）`);
      //  くっつくと ひとかたまりの穴になり、ボタンに見えない
      ok(right.every(b => b.length <= 2), `ボタンが ${Math.max(...right.map(b=>b.length))} マスに広がっている`);
    });
    //  下は中央がへこんで、両側がグリップ。グリップが細いと持ち手に見えず、
    //  切れ込みだけが目立って「割れた四角」になる
    it('下の両側にグリップがあり、細すぎない', () => {
      const g = game();
      const last = g[g.length-1];
      const runs = [];                       // 濃い所・薄い所を、端から順に長さで並べる
      let n = 1;
      for(let i = 1; i <= last.length; i++){
        if(i < last.length && !!last[i] === !!last[i-1]){ n++; continue; }
        runs.push({ on: !!last[i-1], n }); n = 1;
      }
      const grips = runs.filter(r => r.on);
      eq(grips.length, 2, 'いちばん下の段の かたまりの数（左右のグリップ）:');
      //  切れ込みは、2つのグリップに挟まれた薄い所だけ。外側の余白は数えない
      const gi = runs.findIndex(r => r.on);
      const notch = runs.slice(gi + 1).find(r => !r.on);
      ok(notch, '中央の切れ込みが見つからない');
      ok(grips.every(r => r.n >= notch.n),
         `グリップ(${grips.map(r=>r.n).join('/')}) が 切れ込み(${notch.n}) より細い`);
    });
    //  十字キーとボタンの段以外が左右でずれると、パッドが傾いて見える
    it('十字キーとボタンの段をのぞいて、左右対称', () => {
      const g = game(), W = g[0].length;
      //  操作部のある段は、左右で中身が違うのが正しい
      const ctrl = new Set();
      for(const b of holes(g)) for(const [y] of b) ctrl.add(y);
      const bad = [];
      g.forEach((row, y) => {
        if(ctrl.has(y)) return;
        for(let x = 0; x < W; x++) if(row[x] !== row[W-1-x]){ bad.push(y); return; }
      });
      ok(bad.length === 0, `左右がずれている段: ${bad.join(', ')}`);
    });
    //  かつては古典的なインベーダーの形だった。戻すと権利面の懸念が復活する
    it('インベーダーの形に戻っていない', () => {
      const g = game();
      //  上端に離れた2本の突起（触角）が無いこと
      const top = g[0];
      const runs = top.join('').split(/0+/).filter(s => s.includes('2') || s.includes('1'));
      ok(!(runs.length === 2 && runs.every(r => r.length <= 2)),
         '上端に触角のような突起が2本ある');
    });
  });
  //  くすりは「片側だけ中身が入ったカプセル」。この形でくすりに見えているので、
  //  片側が空いていること・輪郭が閉じていることを見張る
  describe('くすり', () => {
    const med = () => load().api.CARE_ICONS.MED;
    // 外から塗りつぶして、届かなかった地の色のマス＝輪郭で閉じた空き
    const closedHole = g => {
      const H = g.length, W = g[0].length;
      const seen = g.map(r => r.map(() => false));
      const q = [];
      for(let y=0;y<H;y++) for(let x=0;x<W;x++)
        if((x===0||y===0||x===W-1||y===H-1) && g[y][x]===0 && !seen[y][x]){ seen[y][x]=true; q.push([x,y]); }
      while(q.length){
        const [x,y] = q.pop();
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx, ny=y+dy;
          if(nx<0||ny<0||nx>=W||ny>=H||seen[ny][nx]||g[ny][nx]!==0) continue;
          seen[ny][nx]=true; q.push([nx,ny]);
        }
      }
      let n = 0;
      for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(g[y][x]===0 && !seen[y][x]) n++;
      return n;
    };
    it('濃い輪郭と、中間色の中身の両方を持つ', () => {
      const flat = med().flat();
      ok(flat.includes(2), '濃い色（輪郭）が無い');
      ok(flat.includes(1), '中間色（中身）が無い。片側だけ色が入った形に見えない');
    });
    //  半分ずつでないと、カプセルではなく「輪郭だけの棒」や「ただの塊」に見える。
    //  中身（中間色）と 空き（閉じた地の色）が同じくらいの広さであることを見る
    it('色が入った側と 空いている側が、同じくらいの広さ', () => {
      const g = med();
      const dim = g.flat().filter(v => v === 1).length;
      const hole = closedHole(g);
      ok(dim >= 8, `中身が ${dim} マスしかない（輪郭だけの棒に見える）`);
      ok(hole >= 8, `空きが ${hole} マスしかない（ただの塊に見える）`);
      const r = Math.max(dim, hole) / Math.min(dim, hole);
      ok(r <= 1.8, `中身 ${dim} と 空き ${hole} が偏っている（${r.toFixed(1)}倍）`);
    });
    it('輪郭が閉じていて、空いている側が外とつながっていない', () => {
      ok(closedHole(med()) > 0, '空いている側が外へつながっている（輪郭に穴がある）');
    });
  });
});

// ══ バージョンと著作権 ════════════════════════════════════
describe('バージョンと著作権', () => {
  it('SETTINGS に バージョンの項目がある', () => {
    const { api } = load();
    ok(api.SETTINGS_KEYS.includes('version'), 'バージョンの項目が無い');
    eq(api.SETTINGS_KEYS[api.SETTINGS_KEYS.length-1], 'reset', 'いちばん下の項目:');   // 消す操作は最後のまま
  });
  it('項目がぜんぶ画面に収まる', () => {
    const { api } = load();
    // 行間は本体から読む。ここに数を書き写すと、本体だけ変わっても気づけない
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const m = src.match(/const ITEM_H = (\d+);/);
    ok(m, 'SETTINGS の行間（ITEM_H）が見つからない');
    const TOP = 19, ITEM_H = +m[1], HL_H = 7, H = 65;
    const bottom = TOP + (api.SETTINGS_KEYS.length - 1) * ITEM_H + HL_H;
    ok(bottom <= H, `いちばん下の項目が画面から はみ出す（行間 ${ITEM_H} / 下端 ${bottom} / 画面 ${H}）`);
  });
  // 一覧には版の番号を出さない。番号だけ並んでいても読みどころが無く、
  //  点線と数字で その一行だけ賑やかになる。中身は A を押した先で見せる
  it('一覧の行には、版の番号を出さない', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(!/key==='version'\s*\?/.test(src), '一覧の行に版の番号が出ている');
  });
  it('版の番号は、バージョンの画面には出す', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(/fillText\('VER ' \+ APP_VERSION/.test(src), 'バージョンの画面に版が出ていない');
  });
  // 天気の出どころ表示。Open-Meteo は CC BY 4.0 で、無料利用でも帰属が要る。
  //  消すとライセンス違反になるので、消えたら気づけるようにしておく
  it('天気の出どころが、バージョンの画面に出ている', () => {
    const { api } = load();
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    ok(/open-?meteo/i.test(api.APP_WEATHER_CREDIT), `出どころの名が無い: ${api.APP_WEATHER_CREDIT}`);
    ok(/fillText\(APP_WEATHER_CREDIT/.test(src), 'バージョンの画面に出どころが描かれていない');
  });
  it('天気の出どころは、天気の設定に関係なく出る', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const m = src.match(/ctxN\.fillText\(APP_WEATHER_CREDIT[^\n]*\n/);
    ok(m, '出どころを描く行が見つからない');
    // 描く行が weatherMode や weatherFetched で括られていたら、オフの人に出なくなる
    const line = m[0];
    ok(!/weatherMode|weatherFetched/.test(line), '天気の設定次第で出どころが消える');
  });
  it('出どころの行が、画面の幅と著作権の行に ぶつからない', () => {
    const { api } = load();
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
    const W = 54, S = 4;
    // Press Start 2P は等幅で、字送りは指定した大きさとほぼ同じ
    const px = +(src.match(/ctxN\.font='(\d+)px "Press Start 2P"';\s*\n\s*ctxN\.fillText\(APP_WEATHER_CREDIT/) || [])[1];
    ok(px, '出どころの字の大きさが読めない');
    const wide = api.APP_WEATHER_CREDIT.length * px;
    ok(wide <= W * S, `出どころが画面からはみ出す（${wide}px / 画面 ${W*S}px）`);
    const yCredit = +(src.match(/fillText\(APP_WEATHER_CREDIT[^,]*,[^,]*,\s*(\d+)\*S/) || [])[1];
    const yCopy   = +(src.match(/fillText\(APP_COPY[^,]*,[^,]*,\s*(\d+)\*S/) || [])[1];
    ok(yCredit && yCopy, '行の位置が読めない');
    ok(yCopy - yCredit >= px, `出どころと著作権が重なる（間 ${yCopy-yCredit} ドット / 字 ${px}px）`);
  });
  it('著作権に名義が入っている', () => {
    const { api } = load();
    ok(/\d{4}/.test(api.APP_COPY), `年が無い: ${api.APP_COPY}`);
    ok(api.APP_COPY.replace(/\(C\)|\d|[\s.]/g, '').length > 0, `名義が無い: ${api.APP_COPY}`);
  });
  // Press Start 2P に © は無く、書くと1文字だけ別の字体に落ちて形が浮く
  it('© ではなく (C) で書いてある', () => {
    const { api } = load();
    ok(!/©/.test(api.APP_COPY), `© が混ざっている: ${api.APP_COPY}`);
    ok(/\(C\)/.test(api.APP_COPY), `(C) が無い: ${api.APP_COPY}`);
  });
  it('バージョン画面の行が、画面幅に収まる', () => {
    const { api, sandbox } = load();
    const S = 4, W = 54;
    const c = sandbox.document.createElement('canvas').getContext('2d');
    const wide = (font, t) => { c.font = font; return c.measureText(t).width / S; };
    const rows = [
      ['6px "Press Start 2P"', 'MY LITTLE INVADER'],
      ['6px "Press Start 2P"', 'VER ' + api.APP_VERSION],
      ['5px "Press Start 2P"', api.APP_COPY],
    ];
    rows.forEach(([f, t]) => {
      const w = wide(f, t);
      ok(w <= W - 2, `画面から はみ出す：「${t}」 ${w.toFixed(1)}ドット（画面は ${W}）`);
    });
  });
});

// ══ 音 ════════════════════════════════════════════════════
//   iOSは 電話・アラーム・ほかのアプリの音・画面ロックのたびに音を止める。
//   このとき WebKit は state を 'suspended' ではなく 'interrupted' にすることがあり、
//   そこからは resume() が効かないまま戻らない。suspended だけ面倒を見ていると、
//   一度これに当たった時点で、アプリを閉じるまで ずっと無音になる
describe('音', () => {
  const first = () => {
    const { api, clock, audioLog } = load();
    api.playClick(1200);
    return { api, clock, audioLog, ac: audioLog[0] };
  };
  it('ふつうに鳴らすと、口はひとつだけ', () => {
    const { audioLog } = first();
    eq(audioLog.length, 1, '作られた口の数:');
    eq(audioLog[0].played, 1, '鳴らした回数:');
  });
  it('割り込み（interrupted）に当たっても、鳴るところまで戻る', () => {
    const { api, clock, audioLog, ac } = first();
    ac.state = 'interrupted';
    clock.advance(api.AC_RETRY + 1);
    api.playClick(1200);
    ok(audioLog.length === 2, `作り直していない（口の数 ${audioLog.length}）`);
    eq(audioLog[1].state, 'running', '新しい口の状態:');
    eq(audioLog[1].played, 1, '新しい口で鳴らした回数:');
  });
  it('作り直したら、古い口は閉じる', () => {
    const { api, clock, audioLog, ac } = first();
    ac.state = 'interrupted';
    clock.advance(api.AC_RETRY + 1);
    api.playClick(1200);
    eq(ac.closed, 1, '古い口を閉じた回数:');
  });
  it('割り込みが続くあいだ、口を作り続けない', () => {
    const { api, clock, audioLog, ac } = first();
    ac.state = 'interrupted';
    clock.advance(api.AC_RETRY + 1);
    api.playClick(1200);                       // ここで2つめができる
    audioLog[1].state = 'interrupted';         // 新しいほうも割り込まれたまま
    for(let i=0;i<20;i++) api.playClick(1200); // 立て続けに鳴らそうとする
    eq(audioLog.length, 2, '短いあいだに作られた口の数:');
  });
  it('止まっているだけ（suspended）なら、作り直さずに起こす', () => {
    const { api, clock, audioLog, ac } = first();
    ac.state = 'suspended';
    clock.advance(api.AC_RETRY + 1);
    api.playClick(1200);
    eq(audioLog.length, 1, '作られた口の数:');
    ok(ac.resumed > 0, 'resume していない');
    eq(ac.state, 'running', '起きたあとの状態:');
  });
  // 押しても何も起きないアイコンは、断りの低い音だけを鳴らす。
  //  ふだんの音と2つ鳴ると、いちど押せてから断られたように聞こえる
  describe('押せないアイコンの音', () => {
    const at = (sel, st) => {
      const { api, clock } = load();
      const t0 = clock.now();
      Object.assign(api.pet, api.defaultPet(), { name:'ALPHA', stage:'larva', birth:t0-5*86400000,
        lastTick:t0, EP:2, B:40, hunger:4, mood:4, ...st });
      api.menuSel = sel;
      return api;
    };
    it('押せないアイコンの上では、断りの音を選ぶ', () => {
      const api = at(1, { W:0, plateAt:0, plateSpoiled:false });   // そうじ＝片づけるものが無い
      ok(api.careDisabled('CLEAN'), 'そうじが押せない状態のはず');
      ok(api.onDisabledCare(), '断りの音にならない');
    });
    it('押せるアイコンの上では、ふだんの音を選ぶ', () => {
      const api = at(1, { W:2 });                                  // よごれあり
      ok(!api.careDisabled('CLEAN'), 'そうじが押せる状態のはず');
      ok(!api.onDisabledCare(), 'ふだんの音にならない');
    });
    it('下段の項目の上では、アイコンの状態を見ない', () => {
      const api = at(1, { W:0, plateAt:0, plateSpoiled:false });
      ok(api.onDisabledCare(), 'まず断りの音になるはず');
      api.menuSel = 7;                                             // 6以上＝下段の項目
      ok(!api.onDisabledCare(), '下段の項目でも断りの音になっている');
    });
    //  サブ画面に入っても menuSel はアイコンを指したまま。
    //  そこを見てしまうと、SETTINGS などで決定したのに断りの音が鳴る
    it('サブ画面に入っているあいだは、アイコンの状態を見ない', () => {
      for(const key of ['inSettings','inStatus','inFeed','inPlay']){
        const api = at(1, { W:0, plateAt:0, plateSpoiled:false });
        ok(api.onDisabledCare(), `${key}: まず断りの音になるはず`);
        api[key] = true;
        ok(!api.onDisabledCare(), `${key} の画面なのに断りの音になっている`);
      }
    });
    it('Aを押して鳴る音は1つだけ', () => {
      const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'invader_game.html'), 'utf8');
      ok(/playClick\(onDisabledCare\(\) \? 300 : 900\);/.test(src), '押した時点で音を選び分けていない');
      ok(!/setTimeout\(\(\)\s*=>\s*playClick\(/.test(src), '押した音に重ねて鳴らす書き方が残っている');
    });
  });
  //  作れなかったときに いまの口を捨てると、二度と鳴らなくなる。
  //  割り込みは明けることがあるので、そのまま持っておく
  it('新しい口を作れなくても、いまの口を捨てない', () => {
    const { api, clock, sandbox, audioLog } = load();
    api.playClick(1200);
    const ac = audioLog[0];
    eq(audioLog.length, 1, '口の数:');
    ac.state = 'interrupted';
    sandbox.window.AudioContext = function(){ throw new Error('作れない'); };
    sandbox.window.webkitAudioContext = sandbox.window.AudioContext;
    for(let i=0;i<3;i++){ clock.advance(api.AC_RETRY + 1); api.playClick(1200); }
    eq(api.ac, ac, 'いまの口が 捨てられている:');
    eq(ac.closed, 0, '作れないのに 古い口を閉じている:');
    ok(ac.resumed > 0, '持っているだけで resume を試していない');
  });
  it('割り込みが明ければ、そのままの口で鳴る', () => {
    const { api, clock, sandbox, audioLog } = load();
    api.playClick(1200);
    const ac = audioLog[0];
    ac.state = 'interrupted';
    sandbox.window.AudioContext = function(){ throw new Error('作れない'); };
    sandbox.window.webkitAudioContext = sandbox.window.AudioContext;
    clock.advance(api.AC_RETRY + 1); api.playClick(1200);
    ac.state = 'running';                       // 割り込みが明けた
    const before = ac.played;
    api.playClick(1200);
    ok(ac.played > before, '明けたのに鳴らない');
    eq(audioLog.length, 1, '余分な口を作った:');
  });
  //  作れない状況で毎回試すと、そのたびに例外が出て重い。
  //  「作ろうとした時刻」で歯止めをかける
  it('作れないときも、試すのは歯止めの間隔ごと', () => {
    const { api, clock, sandbox, audioLog } = load();
    api.playClick(1200);
    audioLog[0].state = 'interrupted';
    let tries = 0;
    sandbox.window.AudioContext = function(){ tries++; throw new Error('作れない'); };
    sandbox.window.webkitAudioContext = sandbox.window.AudioContext;
    clock.advance(api.AC_RETRY + 1);
    for(let i=0;i<20;i++) api.playClick(1200);   // 時間を進めずに立て続けに
    eq(tries, 1, '歯止めの中で作ろうとした回数:');
  });
  it('SOUND=OFF なら、口を作らない', () => {
    const { api, audioLog } = load({ storage: { myvader_sound: 'off' } });
    api.playClick(1200);
    eq(audioLog.length, 0, '作られた口の数:');
  });
});

// ══ 結果 ══════════════════════════════════════════════════
console.log('');
if(fails.length){ console.log(fails.join('\n')); console.log(''); }
console.log(`${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
