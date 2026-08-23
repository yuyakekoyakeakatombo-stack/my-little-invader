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
    ufoFlag:false, departFlag:false, invadeFlag:false,
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
//   起こさないと飲ませられないと、しかって起こす（＝理不尽なしかる）しか
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
    eq(api.pet.scoldBadCount || 0, before.scold, '理不尽なしかるに数えられている:');
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
  //  選択肢が見えていないうちに押された A で、見えていないものが決まってしまわないように。
  //  そのぶん、押したら待ちを飛ばして すぐ選択肢を出す
  it('選択肢が出る前の A は、待ちを飛ばすだけ', () => {
    ok(/if\(!openingReady\)\{ titleWait = 20; openingReady = true; return; \}/.test(src()),
       '選択肢が見えていないうちに A で決まってしまう');
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
  it('ふつうの夜の睡眠を起こすのは理不尽なしかるのまま', () => {
    const { api, clock } = load();
    clock.setTime(3, 0);
    pet(api, clock, { stage:'adult', lineage:'inv', P:0, wokeUntil:0, scoldBadCount:0 });
    eq(api.sleepKind(new Date(clock.now())), 'night');
    api.doCare('SCOLD');
    eq(api.pet.scoldBadCount, 1, '理不尽として数える:');
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
  //  侵攻は「夜に起こす・理不尽にしかる・夜更かしさせる」を重ねた時だけ
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
    ok(api.pet.ufoFlag, `${api.STUCK_DAYS}日を過ぎたら迎えが来る`);
    eq(api.pet.stage, 'adult', '成体のまま連れて行かれる:');
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

// ══ 日記 ══════════════════════════════════════════════════
describe('日記', () => {
  it('別れの言葉は3口調そろっている', () => {
    const { api, clock } = load();
    for(const tag of ['farewell','farewellWild','departed','wrath'])
      eq(api.DIARY_LINES[tag].length, 3, `${tag}:`);
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
  // 自分の文字だけで書く段階（あかちゃん）は、読み手の言語で字数が変わってはいけない。
  //  英語の文面は かなの倍ちかい字数なので、そのまま置きかえると
  //  同じ出来事なのに英語だけ字がぎっしり並び、入りきらず小さく潰れていた
  const babyEntry = (lg) => {
    const { api, clock } = load({ storage: { myvader_lang: lg } });
    api.lang = lg;
    const t0 = clock.now();
    Object.assign(api.pet, api.defaultPet(), { name:'ALPHA', stage:'mid', birth:t0-86400000, lastTick:t0, EP:1, B:30 });
    return { api, e: api.buildDiary({ fed:2, playSw:1 }, 2, '2026-06-15') };
  };
  const runeCount = (api, e) => api.diaryWords(e).flat().reduce((a,w)=>a + (w.t||w.r||'').length, 0);
  it('あかちゃんの日記は、言語が変わっても字数が変わらない', () => {
    const ja = babyEntry('ja'), en = babyEntry('en');
    // 同じ出来事・同じ言い回しでそろえる
    const e = { ...ja.e };
    eq(en.api.entryLevel(e), en.api.LV_BABY, 'あかちゃんの段階のはず:');
    eq(runeCount(en.api, e), runeCount(ja.api, e), 'あかちゃんの日記の字数（英語 / 日本語）:');
  });
  it('あかちゃんの日記は、どの言語でも1字も読める字が混ざらない', () => {
    for(const lg of ['ja','en']){
      const { api, e } = babyEntry(lg);
      const readable = api.diaryWords(e).flat().filter(w => w.t);
      eq(readable.length, 0, `${lg}: 読める字が混ざっている:`);
    }
  });
  it('あかちゃんの日記は、字を小さく潰さずに収まる', () => {
    const W = 54, S = 4, MAXW = W*S - 8;
    for(const lg of ['ja','en']){
      const { api, e } = babyEntry(lg);
      const k = api.diaryBaseDot(api.entryLevel(e));   // あかちゃんの玉の大きさ（3）
      const F = api.diaryFontSize(), gap = Math.max(4, F*0.4);
      // あかちゃんは全部が自分の文字なので、はばは字数から決まる（フォントを測らずに出せる）
      const lineW = ws => ws.reduce((a,w)=>a + ([...w.r].length*6*k - k) + gap, -gap);
      api.diaryRows(e).filter(r=>r.words).forEach(r => {
        const w = lineW(r.words);
        ok(w <= MAXW, `${lg}: 行が枠からはみ出す（${Math.round(w)}px / 枠${MAXW}px）`);
      });
    }
  });
  // 読める字が混ざる段階から先は、表示中の言語で書く
  it('こどもの日記は、表示中の言語で書かれる', () => {
    const mk = lg => {
      const { api, clock } = load({ storage: { myvader_lang: lg } });
      api.lang = lg;
      const t0 = clock.now();
      Object.assign(api.pet, api.defaultPet(), { name:'ALPHA', stage:'larva', birth:t0-5*86400000, lastTick:t0, EP:4, B:30 });
      const e = api.buildDiary({ fed:2, playSw:1 }, 5, '2026-06-15');
      // 読める字も 自分の文字も、もとの単語は同じところから来る。
      //  ここを見ないと、diaryWords がどの文面を使ったかを確かめられない
      const ws = api.diaryWords(e).flat().map(w => w.t || w.r);
      ok(ws.length > 0, `${lg}: 本文が空`);
      return ws.join(' ');
    };
    ok(/[ぁ-んァ-ン]/.test(mk('ja')), 'ja: かなで書かれていない');
    const en = mk('en');
    ok(!/[ぁ-んァ-ン]/.test(en), `en: かなが混ざっている（${en}）`);
  });

  // その日1日ぶんの材料を持たせた日記をひとつ作る
  const entry = (api, over) => Object.assign({
    d:1, n:'T', t:['fed','praised'], v:[0,0], s:'', vo:'plain', c:'', cv:0,
    ts:0, cd:'2026-8-20' }, over);

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
  //  ストーリーと説明書は1段ずつ下がる
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
  //  一覧の先頭（＝6番）は右の列のいちばん上になるので、そこへ降りると不自然
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
    eq(api.diaryLog[0].lv, api.LV_NEW, 'うまれたての字で書かれること:');
  });
  it('段階は書いた時点で焼き付ける（あとから読み返しても変わらない）', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg', name:'T', diary:{fed:1} });
    const e = api.buildDiary({ fed:1 }, 1);
    eq(e.lv, api.LV_NEW);
    api.pet.stage = 'final';                       // 育っても、その日記の段階は動かない
    eq(api.entryLevel(e), api.LV_NEW);
  });
  it('段階を持たない古い日記は、これまで通り日本語で読める', () => {
    const { api, clock } = load();
    pet(api, clock);
    const e = entry(api, {});
    delete e.lv;
    eq(api.entryLevel(e), api.LV_ADULT);
    ok(api.diaryBody(e).length > 0, '本文が出ること');
  });
  it('あかちゃんは、単語がぜんぶ自分の文字になる', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock);
    const words = api.diaryWords(entry(api, { lv: api.LV_BABY }));
    const flat = words.flat();
    ok(flat.length > 0, '単語が取れること');
    ok(flat.every(w => typeof w.r === 'string' && w.r.length), '日本語がまじらないこと');
    // 宇宙文字の数＝もとの単語の字数。書けなかった単語の長さがそのまま残る
    const body = api.diaryBody(entry(api, { lv: api.LV_BABY }));
    const lens = body.filter(l=>l).flatMap(l => l.split(' ').filter(w=>w).map(w => [...w].length));
    eq(flat.map(w => [...w.r].length), lens, '字数がもとの単語と合うこと:');
  });
  it('おとなは、ぜんぶ日本語になる', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock);
    const flat = api.diaryWords(entry(api, { lv: api.LV_ADULT, wr:1 })).flat();
    ok(flat.length > 0 && flat.every(w => w.t), '自分の文字が残らないこと');
  });
  it('こどもは、書ける単語の割合が増えるほど日本語が増える', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock);
    const jp = wr => api.diaryWords(entry(api, { lv: api.LV_CHILD, wr })).flat().filter(w => w.t).length;
    const lo = jp(0.1), hi = jp(0.9);
    ok(lo < hi, `割合が高いほど日本語が多いこと（0.1→${lo}語 / 0.9→${hi}語）`);
    eq(jp(0), 0, '0なら1語も書けないこと:');
  });
  it('同じ日記は何度組み直しても同じ形になる（開くたびに変わらない）', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock);
    // 2回だけ比べると、乱数で偶然そろって見逃すことがある。
    //  回数を増やし、絵も「並びの数」ではなく字形そのものを見比べる
    const e = entry(api, { lv: api.LV_CHILD, wr:0.5,
                           t:['fed','praised','slept'], v:[0,0,0], c:'plain' });
    const words = api.diaryWords(e);
    for(let i=0;i<6;i++) eq(api.diaryWords(e), words, `${i+2}回目で単語の置き換えが変わった:`);
    const m = entry(api, { lv: api.LV_NEW, t:['fed','praised','slept'], v:[0,0,0] });
    const marks = api.diaryMarks(m);
    for(let i=0;i<6;i++) eq(api.diaryMarks(m), marks, `${i+2}回目で絵の並びが変わった:`);
  });
  it('うまれたては、その日の出来事が絵になる', () => {
    const { api, clock } = load();
    pet(api, clock);
    const rows = api.diaryMarks(entry(api, { lv: api.LV_NEW, t:['fed','praised'] }));
    const flat = rows.flat();
    ok(flat.includes(api.DIARY_PICT.fed), 'ごはんの絵が入ること');
    ok(flat.includes(api.DIARY_PICT.praised), 'ほめられた絵が入ること');
    ok(flat.length >= 3, 'らくがきと自分の文字も混じること');
  });
  it('絵にならないタグの日でも、書いた跡は残る', () => {
    const { api, clock } = load();
    pet(api, clock);
    const rows = api.diaryMarks(entry(api, { lv: api.LV_NEW, t:['evolved'] }));
    ok(rows.flat().length > 0, '空白のページにはしないこと');
  });
  // 英語は本文が6pxしかないので、日本語と同じ2ドット（＝10px）で宇宙文字を描くと
  //  記号だけが文字の倍近く大きくなって浮く。言葉が混ざる段階では文字に合わせる
  it('言葉が混ざる段階では、宇宙文字が文字より大きくならない', () => {
    // 本文の大きさそのものを押さえる。文字と記号を見比べるだけだと、
    //  両方が一緒に動く壊し方（文字も10pxにする）を見逃す
    for(const [lg, expect] of [['ja', 10], ['en', 6]]){
      const { api } = load({ storage:{ myvader_lang: lg } });
      const fs = api.diaryFontSize();
      eq(fs, expect, `${lg} の本文の大きさ:`);
      const h = 5 * api.diaryBaseDot(api.LV_CHILD);        // 宇宙文字は5ドットぶんの高さ
      ok(h <= fs, `${lg}: 宇宙文字${h}px が 文字${fs}px より大きい`);
      ok(h >= fs - 2, `${lg}: 宇宙文字${h}px が 文字${fs}px に対して小さすぎる`);
    }
  });
  it('言葉が混ざらない段階は、言語に関係なく大きいまま', () => {
    const ja = load({ storage:{ myvader_lang:'ja' } }).api;
    const en = load({ storage:{ myvader_lang:'en' } }).api;
    for(const lv of [ja.LV_NEW, ja.LV_BABY])
      eq(en.diaryBaseDot(lv), ja.diaryBaseDot(lv), `段階${lv}は言語で変わらないこと:`);
  });
  it('段階が上がるほど字は小さくなる', () => {
    const { api } = load();
    const d = api.LV_DOT;
    ok(d[api.LV_NEW] > d[api.LV_BABY] && d[api.LV_BABY] > d[api.LV_CHILD],
       `うまれたて>あかちゃん>こども であること（${d.join(',')}）`);
  });
  // ── 宇宙文字26字（A〜Z）──
  it('宇宙文字は26字あって、同じ形が2つない', () => {
    const { api } = load();
    eq(api.RUNE_KEYS.length, 26);
    const seen = new Map();
    for(const k of api.RUNE_KEYS){
      const sig = api.DIARY_RUNE[k].map(r => r.join('')).join('/');
      ok(!seen.has(sig), `${k} と ${seen.get(sig)} が同じ形`);
      seen.set(sig, k);
    }
  });
  it('かなの表は、すべて実在する宇宙文字を指している', () => {
    const { api } = load();
    for(const [kana, letter] of Object.entries(api.KANA_LETTER))
      ok(api.DIARY_RUNE[letter], `${kana} → ${letter} の字が無い`);
  });
  // でたらめに散らすのではなく規則で決まるので、読み比べれば見当がつく
  it('同じ音はいつも同じ字になる（規則で決まる）', () => {
    const { api } = load();
    eq(api.runeOf('こ'), api.runeOf('か'), 'か行は同じ字:');
    eq(api.runeOf('ご'), api.runeOf('が'), 'が行は同じ字:');
    ok(api.runeOf('か') !== api.runeOf('が'), '清音と濁音は別の字であること');
    ok(api.runeOf('あ') !== api.runeOf('い'), '母音どうしも別の字であること');
  });
  it('表に無い字でも、字形が返る（欠けたマスにしない）', () => {
    const { api } = load();
    for(const ch of ['ア','ー','Ｚ','!','漢'])
      ok(Array.isArray(api.runeOf(ch)), `${ch} の字形が無い`);
  });
  it('同じ単語は、いつ書いても同じ並びになる', () => {
    const { api } = load();
    const a = [...'ごはん'].map(c => api.runeOf(c));
    const b = [...'ごはん'].map(c => api.runeOf(c));
    eq(a, b);
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
  });
  it('あかちゃんの日記には、まだ絵が残っている', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock);
    const rows = api.diaryRows(entry(api, { lv: api.LV_BABY, t:['fed','praised'], v:[0,0] }));
    const marks = rows.filter(r => r.marks);
    eq(marks.length, 1, '絵の行が1行あること:');
    ok(marks[0].marks.includes(api.DIARY_PICT.fed), 'その日の出来事の絵であること');
    ok(rows.some(r => r.words), '自分の文字の行もあること');
  });
  it('こどもになると絵は出ず、言葉だけになる', () => {
    const { api, clock } = load({ storage:{ myvader_lang:'ja' } });
    pet(api, clock);
    const rows = api.diaryRows(entry(api, { lv: api.LV_CHILD, wr:0.5 }));
    ok(rows.length > 0 && rows.every(r => r.words), '絵の行が混ざらないこと');
  });
  it('幼いうちは結びの言葉を書かない', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.pet.stage = 'egg';   eq(api.diaryStyle().close, '');
    api.pet.stage = 'mid';   eq(api.diaryStyle().close, '');
    api.pet.stage = 'larva'; ok(api.diaryStyle().close !== '', 'こどもからは書くこと');
  });
  it('絵記号の対応表は、すべて実在する絵を指している', () => {
    const { api } = load();
    for(const [tag, key] of Object.entries(api.TAG_PICT))
      ok(api.DIARY_PICT[key], `${tag} → ${key} の絵が無い`);
  });
});

// ══ 進化 ══════════════════════════════════════════════════
//  プランプ＝大食い または 甘やかし ／ スリーク＝丁寧なケア かつ ミニゲーム制覇 ／
//  プリックリー＝ケアが雑。どれにも当たらなければ最終形態にならず、成体のままとどまる
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
  it('ノーマルは、ケアが丁寧かつミニゲーム制覇の両方が要る', () => {
    const { api, clock } = load();
    const BEST = { sw:600, ss:700, ab:400 };
    setup(api, clock, { C:85, best:BEST });
    eq(api.pickForm(), 'i2', '両方そろえば:');
    setup(api, clock, { C:85, best:{sw:0,ss:0,ab:0} });
    eq(api.pickForm(), '', 'ケアだけでは足りない:');
    setup(api, clock, { C:55, best:BEST });
    eq(api.pickForm(), '', 'ミニゲームだけでも足りない:');
  });
  it('ミニゲームの基準は3本すべてを越えること', () => {
    const { api, clock } = load();
    eq(api.ALLROUND, { sw:600, ss:700, ab:400 });
    for(const k of ['sw','ss','ab']){
      const b = Object.assign({}, api.ALLROUND); b[k] -= 1;   // 1本だけ届いていない
      setup(api, clock, { C:85, best:b });
      eq(api.pickForm(), '', k+' が届かない:');
    }
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
    ok(/PLAY_ITEMS\.forEach\(\(label,i\)=> memBestRow\(label, bestText\(i\), 27 \+ i\*8\)\);/.test(src),
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
    ok(/emo\(isWeakStarve\(\) \? ICO_EXCL : ICO_DROP\)/.test(emo),
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
