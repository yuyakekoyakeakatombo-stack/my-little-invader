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
  it('汚れているあいだは、上げても満タンにならない', () => {
    const { api, clock } = load();
    pet(api, clock, { mood:0, W:2 });
    api.pet.moodAcc = api.MOOD_MIN * 0.5;
    for(let i=0;i<6;i++) api.raiseMood();
    ok(lit(api.gaugeMood()) < 10, '満タンに見えてはいけない');
    ok(api.pet.mood === 4, `上限まで上がっていること（実際 ${api.pet.mood}）`);
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
  it('名前をつけた時刻が、その子の起点になる', () => {
    const { api, clock } = load();
    const t0 = arriveAt(api, clock, 23);
    eq(api.pet.birth, t0, 'たんじょう:');
    eq(api.pet.lastTick, t0, '時間の進行の起点:');
    ok(api.pet.eggTargetEP > 0, '進化までの目標が決まること');
    eq(api.petDay(), 1, '1日目から始まること:');
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
    for(let y=0;y<4;y++) for(let x=0;x<6;x++) s.push(api.dustDrift(x, y));
    ok(new Set(s).size >= 3, `粒ごとの流れ方がそろいすぎ（${new Set(s).size}種）`);
    ok(Math.min(...s) > 0, '流れない粒があってはいけない');
    // 同じ粒はいつも同じ動き（ちらつかない）
    eq(api.dustDrift(3, 2), api.dustDrift(3, 2));
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
  it('お別れの形が5種とも言葉になる', () => {
    const { api, clock } = load();
    const got = {};
    for(const [k, o] of [['餓死',{dead:'starve'}], ['病死',{dead:'sick'}],
                         ['帰還',{gone:true, goneBy:'return'}], ['旅立ち',{gone:true, goneBy:'depart'}],
                         ['侵攻',{gone:true, goneBy:'invade'}]]){
      pet(api, clock, o); got[k] = api.endLabel();
      ok(got[k], k + ' の言葉が無い');
    }
    eq(new Set(Object.values(got)).size, 5, '5種とも違う言葉であるべき:');
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
  // オープニングの描画はテストから読めないので、字の大きさをソースで押さえる。
  //  小さすぎて「押していい」ことが伝わらなかった
  it('タイトルの PRESS A が、読める大きさで描かれている', () => {
    const src = read('invader_game.html');
    const m = src.match(/ctxO\.font = '(\d+)px "Press Start 2P"';\s*\n\s*ctxO\.fillStyle = blink/);
    ok(m, 'PRESS A の字の指定が見つからない');
    ok(Number(m[1]) >= 8, `PRESS A が小さい（${m[1]}px）`);
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
    ok(/stampDust\(body, bx, by, DM, 1 - p, p \* GHOST_DUST_X\);/.test(src),
       '体が風で流されて消える処理が無い');
    // 体の上端から出すと、背の低い段階では魂の足元が地面より下になる
    ok(/const from  = MAIN_GY - GHOST_SPR\.length;/.test(src),
       '魂の出発点が「足元を地面に置いた高さ」になっていない');
  });
  it('サービスワーカーのVERSIONが日付の形をしている', () => {
    const m = read('sw.js').match(/const VERSION = '([^']+)'/);
    ok(m, 'VERSION が見つからない');
    ok(/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(m[1]), `VERSION の形が違う: ${m[1]}`);
  });
});

// ══ 結果 ══════════════════════════════════════════════════
console.log('');
if(fails.length){ console.log(fails.join('\n')); console.log(''); }
console.log(`${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
